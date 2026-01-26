/**
 * Veritabanı Sorgu Aracı
 * Claude'un veritabanını sorgulamasını sağlar
 */

const Datastore = require("@seald-io/nedb");
const path = require("path");

const appName = process.env.APPNAME;
const appData = process.env.APPDATA;

// Veritabanı bağlantıları
const databases = {};

/**
 * Veritabanı bağlantısını getir veya oluştur
 * @param {string} dbName - Veritabanı adı
 * @returns {Datastore}
 */
function getDatabase(dbName) {
    if (!databases[dbName]) {
        const dbPath = path.join(appData, appName, "server", "databases", `${dbName}.db`);
        databases[dbName] = new Datastore({
            filename: dbPath,
            autoload: true
        });
    }
    return databases[dbName];
}

/**
 * Tool tanımı (Claude API formatında)
 */
const toolDefinition = {
    name: 'database_query',
    description: `Eczane POS veritabanını sorgular. Mevcut tablolar:
- inventory: Ürün envanteri (name, barcode, quantity, salePrice, costPrice, category, expiryDate, minStock)
- transactions: Satış işlemleri (date, total, products, paymentMethod, customerId, status)
- customers: Müşteriler (name, phone, email, address, totalPurchases)
- categories: Kategoriler (name, description)
- drugs: İlaç referans veritabanı (name, barcode, manufacturer, atcCode, perakendeSatisFiyati)

Sorgu sonuçları JSON formatında döner.`,
    input_schema: {
        type: 'object',
        properties: {
            database: {
                type: 'string',
                description: 'Sorgulanacak veritabanı: inventory, transactions, customers, categories, drugs',
                enum: ['inventory', 'transactions', 'customers', 'categories', 'drugs']
            },
            operation: {
                type: 'string',
                description: 'Sorgu operasyonu',
                enum: ['find', 'count', 'aggregate']
            },
            query: {
                type: 'object',
                description: 'MongoDB tarzı sorgu filtresi. Örnek: {"quantity": {"$lt": 10}}'
            },
            sort: {
                type: 'object',
                description: 'Sıralama. Örnek: {"quantity": 1} (artan), {"salePrice": -1} (azalan)'
            },
            limit: {
                type: 'number',
                description: 'Maksimum döndürülecek kayıt sayısı (varsayılan: 50, maksimum: 100)'
            },
            fields: {
                type: 'array',
                items: { type: 'string' },
                description: 'Döndürülecek alanlar. Örnek: ["name", "quantity", "salePrice"]'
            }
        },
        required: ['database', 'operation']
    }
};

/**
 * Sorguyu çalıştır
 * @param {Object} input - Tool input
 * @returns {Promise<Object>}
 */
async function execute(input) {
    const { database, operation, query, sort, limit, fields } = input;

    // Güvenlik kontrolü
    const allowedDatabases = ['inventory', 'transactions', 'customers', 'categories', 'drugs'];
    if (!allowedDatabases.includes(database)) {
        return { error: `Geçersiz veritabanı: ${database}` };
    }

    const db = getDatabase(database);
    const queryLimit = Math.min(limit || 50, 100); // Maksimum 100

    try {
        switch (operation) {
            case 'find':
                return await executeFind(db, query || {}, sort, queryLimit, fields);

            case 'count':
                return await executeCount(db, query || {});

            case 'aggregate':
                return await executeAggregate(db, query || {}, input);

            default:
                return { error: `Geçersiz operasyon: ${operation}` };
        }
    } catch (err) {
        console.error('[DatabaseQuery] Sorgu hatası:', err);
        return { error: err.message };
    }
}

/**
 * Find sorgusu
 */
function executeFind(db, query, sort, limit, fields) {
    return new Promise((resolve, reject) => {
        let cursor = db.find(query);

        if (sort) {
            cursor = cursor.sort(sort);
        }

        cursor = cursor.limit(limit);

        cursor.exec(function (err, docs) {
            if (err) {
                reject(err);
            } else {
                // Sadece belirtilen alanları döndür
                if (fields && fields.length > 0) {
                    docs = docs.map(doc => {
                        const filtered = { _id: doc._id };
                        fields.forEach(field => {
                            if (doc[field] !== undefined) {
                                filtered[field] = doc[field];
                            }
                        });
                        return filtered;
                    });
                }

                resolve({
                    success: true,
                    count: docs.length,
                    data: docs
                });
            }
        });
    });
}

/**
 * Count sorgusu
 */
function executeCount(db, query) {
    return new Promise((resolve, reject) => {
        db.count(query, function (err, count) {
            if (err) {
                reject(err);
            } else {
                resolve({
                    success: true,
                    count: count
                });
            }
        });
    });
}

/**
 * Aggregate (toplu hesaplama) sorgusu
 */
function executeAggregate(db, query, input) {
    return new Promise((resolve, reject) => {
        db.find(query, function (err, docs) {
            if (err) {
                reject(err);
                return;
            }

            try {
                const result = {
                    success: true,
                    totalRecords: docs.length
                };

                // Toplam hesaplamaları
                if (input.sum) {
                    result.sums = {};
                    const sumFields = Array.isArray(input.sum) ? input.sum : [input.sum];
                    sumFields.forEach(field => {
                        result.sums[field] = docs.reduce((sum, doc) => {
                            return sum + (parseFloat(doc[field]) || 0);
                        }, 0);
                    });
                }

                // Ortalama hesaplamaları
                if (input.avg) {
                    result.averages = {};
                    const avgFields = Array.isArray(input.avg) ? input.avg : [input.avg];
                    avgFields.forEach(field => {
                        const values = docs.map(doc => parseFloat(doc[field]) || 0);
                        result.averages[field] = values.length > 0
                            ? values.reduce((a, b) => a + b, 0) / values.length
                            : 0;
                    });
                }

                // Min/Max hesaplamaları
                if (input.min) {
                    result.minimums = {};
                    const minFields = Array.isArray(input.min) ? input.min : [input.min];
                    minFields.forEach(field => {
                        const values = docs.map(doc => parseFloat(doc[field]) || 0);
                        result.minimums[field] = values.length > 0 ? Math.min(...values) : 0;
                    });
                }

                if (input.max) {
                    result.maximums = {};
                    const maxFields = Array.isArray(input.max) ? input.max : [input.max];
                    maxFields.forEach(field => {
                        const values = docs.map(doc => parseFloat(doc[field]) || 0);
                        result.maximums[field] = values.length > 0 ? Math.max(...values) : 0;
                    });
                }

                // Gruplama
                if (input.groupBy) {
                    result.groups = {};
                    docs.forEach(doc => {
                        const key = doc[input.groupBy] || 'Diğer';
                        if (!result.groups[key]) {
                            result.groups[key] = { count: 0, items: [] };
                        }
                        result.groups[key].count++;
                        if (result.groups[key].items.length < 5) {
                            result.groups[key].items.push(doc.name || doc._id);
                        }
                    });
                }

                resolve(result);
            } catch (aggErr) {
                reject(aggErr);
            }
        });
    });
}

/**
 * Hızlı sorgular (önceden tanımlanmış)
 */
const quickQueries = {
    // En çok satan ürünler (son 30 gün)
    topSellingProducts: async (limit = 10) => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const db = getDatabase('transactions');
        return new Promise((resolve, reject) => {
            db.find({
                date: { $gte: thirtyDaysAgo.toISOString() }
            }, function (err, transactions) {
                if (err) {
                    reject(err);
                    return;
                }

                const productSales = {};
                transactions.forEach(tx => {
                    if (tx.products) {
                        tx.products.forEach(p => {
                            const id = p.id || p._id;
                            if (!productSales[id]) {
                                productSales[id] = { name: p.name, quantity: 0, revenue: 0 };
                            }
                            productSales[id].quantity += parseInt(p.quantity) || 1;
                            productSales[id].revenue += (parseFloat(p.price) || 0) * (parseInt(p.quantity) || 1);
                        });
                    }
                });

                const sorted = Object.entries(productSales)
                    .map(([id, data]) => ({ id, ...data }))
                    .sort((a, b) => b.quantity - a.quantity)
                    .slice(0, limit);

                resolve({ success: true, data: sorted });
            });
        });
    },

    // Düşük stoklu ürünler
    lowStockProducts: async (threshold = 10) => {
        const db = getDatabase('inventory');
        return executeFind(db, { quantity: { $lte: threshold } }, { quantity: 1 }, 50);
    },

    // Günlük satış özeti
    dailySalesSummary: async (date = null) => {
        const targetDate = date ? new Date(date) : new Date();
        const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

        const db = getDatabase('transactions');
        return new Promise((resolve, reject) => {
            db.find({
                date: {
                    $gte: startOfDay.toISOString(),
                    $lte: endOfDay.toISOString()
                }
            }, function (err, transactions) {
                if (err) {
                    reject(err);
                    return;
                }

                const summary = {
                    date: startOfDay.toISOString().split('T')[0],
                    totalTransactions: transactions.length,
                    totalSales: transactions.reduce((sum, tx) => sum + (parseFloat(tx.total) || 0), 0),
                    totalItems: transactions.reduce((sum, tx) => {
                        return sum + (tx.products || []).reduce((pSum, p) => pSum + (parseInt(p.quantity) || 1), 0);
                    }, 0)
                };

                resolve({ success: true, data: summary });
            });
        });
    },

    // Süresi yaklaşan ürünler
    expiringProducts: async (days = 30) => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);

        const db = getDatabase('inventory');
        return new Promise((resolve, reject) => {
            db.find({
                expiryDate: { $lte: futureDate.toISOString() }
            }, function (err, products) {
                if (err) {
                    reject(err);
                    return;
                }

                const now = new Date();
                const result = products.map(p => ({
                    ...p,
                    daysUntilExpiry: Math.ceil((new Date(p.expiryDate) - now) / (1000 * 60 * 60 * 24))
                })).sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

                resolve({ success: true, data: result });
            });
        });
    }
};

module.exports = {
    toolDefinition,
    execute,
    quickQueries,
    getDatabase
};
