/**
 * Satış Raporu Görevi
 * Günlük ve haftalık satış raporları oluşturur
 */

const Datastore = require("@seald-io/nedb");
const path = require("path");
const notifications = require('../../notifications');

const appName = process.env.APPNAME;
const appData = process.env.APPDATA;
const transactionsDBPath = path.join(appData, appName, "server", "databases", "transactions.db");
const inventoryDBPath = path.join(appData, appName, "server", "databases", "inventory.db");

let transactionsDB = new Datastore({
    filename: transactionsDBPath,
    autoload: true,
});

let inventoryDB = new Datastore({
    filename: inventoryDBPath,
    autoload: true,
});

/**
 * Satış raporu oluştur
 * @param {Object} config - Görev konfigürasyonu
 * @returns {Promise<Object>} Sonuç
 */
async function execute(config = {}) {
    const reportType = config.reportType || 'daily';
    const includeDetails = config.includeDetails !== false;
    const includeComparison = config.includeComparison || false;

    const now = new Date();
    let startDate, endDate, previousStartDate, previousEndDate;

    if (reportType === 'daily') {
        // Bugünün başlangıcı
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        // Dün
        previousStartDate = new Date(startDate);
        previousStartDate.setDate(previousStartDate.getDate() - 1);
        previousEndDate = new Date(endDate);
        previousEndDate.setDate(previousEndDate.getDate() - 1);
    } else {
        // Bu haftanın Pazartesi'si
        const dayOfWeek = now.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59);

        // Geçen hafta
        previousStartDate = new Date(startDate);
        previousStartDate.setDate(previousStartDate.getDate() - 7);
        previousEndDate = new Date(endDate);
        previousEndDate.setDate(previousEndDate.getDate() - 7);
    }

    return new Promise((resolve, reject) => {
        // Mevcut dönem işlemlerini getir
        transactionsDB.find({
            date: {
                $gte: startDate.toISOString(),
                $lte: endDate.toISOString()
            }
        }, function (err, transactions) {
            if (err) {
                reject(err);
                return;
            }

            // Analiz yap
            const analysis = analyzeTransactions(transactions);

            const result = {
                timestamp: new Date().toISOString(),
                reportType: reportType,
                period: {
                    start: startDate.toISOString(),
                    end: endDate.toISOString()
                },
                summary: {
                    totalTransactions: analysis.totalTransactions,
                    totalSales: analysis.totalSales,
                    totalItems: analysis.totalItems,
                    averageTransactionValue: analysis.averageTransactionValue,
                    cashSales: analysis.cashSales,
                    cardSales: analysis.cardSales
                },
                topProducts: analysis.topProducts.slice(0, 10),
                hourlyBreakdown: analysis.hourlyBreakdown,
                categoryBreakdown: analysis.categoryBreakdown
            };

            // Karşılaştırma isteniyorsa önceki dönemi de getir
            if (includeComparison) {
                transactionsDB.find({
                    date: {
                        $gte: previousStartDate.toISOString(),
                        $lte: previousEndDate.toISOString()
                    }
                }, function (err, previousTransactions) {
                    if (!err) {
                        const previousAnalysis = analyzeTransactions(previousTransactions);
                        result.comparison = {
                            previousPeriod: {
                                start: previousStartDate.toISOString(),
                                end: previousEndDate.toISOString()
                            },
                            previousSales: previousAnalysis.totalSales,
                            previousTransactions: previousAnalysis.totalTransactions,
                            salesChange: calculateChange(analysis.totalSales, previousAnalysis.totalSales),
                            transactionChange: calculateChange(analysis.totalTransactions, previousAnalysis.totalTransactions)
                        };
                    }

                    // Bildirim gönder
                    notifications.reportReady(reportType, result.summary);
                    resolve(result);
                });
            } else {
                // Bildirim gönder
                notifications.reportReady(reportType, result.summary);
                resolve(result);
            }
        });
    });
}

/**
 * İşlemleri analiz et
 * @param {Array} transactions - İşlem listesi
 * @returns {Object} Analiz sonucu
 */
function analyzeTransactions(transactions) {
    const productSales = {};
    const categorySales = {};
    const hourlySales = {};

    let totalSales = 0;
    let totalItems = 0;
    let cashSales = 0;
    let cardSales = 0;

    transactions.forEach(tx => {
        // Toplam satış
        const txTotal = parseFloat(tx.total) || 0;
        totalSales += txTotal;

        // Ödeme yöntemi
        if (tx.paymentMethod === 'cash') {
            cashSales += txTotal;
        } else if (tx.paymentMethod === 'card') {
            cardSales += txTotal;
        }

        // Ürün analizi
        if (tx.products && Array.isArray(tx.products)) {
            tx.products.forEach(product => {
                const qty = parseInt(product.quantity) || 1;
                totalItems += qty;

                // Ürün satışları
                const productId = product.id || product._id;
                if (!productSales[productId]) {
                    productSales[productId] = {
                        id: productId,
                        name: product.name,
                        quantity: 0,
                        revenue: 0
                    };
                }
                productSales[productId].quantity += qty;
                productSales[productId].revenue += (parseFloat(product.price) || 0) * qty;

                // Kategori satışları
                const category = product.category || 'Diğer';
                if (!categorySales[category]) {
                    categorySales[category] = { name: category, quantity: 0, revenue: 0 };
                }
                categorySales[category].quantity += qty;
                categorySales[category].revenue += (parseFloat(product.price) || 0) * qty;
            });
        }

        // Saatlik dağılım
        if (tx.date) {
            const hour = new Date(tx.date).getHours();
            if (!hourlySales[hour]) {
                hourlySales[hour] = { hour, transactions: 0, revenue: 0 };
            }
            hourlySales[hour].transactions++;
            hourlySales[hour].revenue += txTotal;
        }
    });

    // En çok satan ürünleri sırala
    const topProducts = Object.values(productSales)
        .sort((a, b) => b.quantity - a.quantity);

    return {
        totalTransactions: transactions.length,
        totalSales: Math.round(totalSales * 100) / 100,
        totalItems: totalItems,
        averageTransactionValue: transactions.length > 0
            ? Math.round((totalSales / transactions.length) * 100) / 100
            : 0,
        cashSales: Math.round(cashSales * 100) / 100,
        cardSales: Math.round(cardSales * 100) / 100,
        topProducts: topProducts,
        categoryBreakdown: Object.values(categorySales),
        hourlyBreakdown: Object.values(hourlySales).sort((a, b) => a.hour - b.hour)
    };
}

/**
 * Değişim yüzdesi hesapla
 * @param {number} current - Mevcut değer
 * @param {number} previous - Önceki değer
 * @returns {Object} Değişim bilgisi
 */
function calculateChange(current, previous) {
    if (previous === 0) {
        return { percentage: current > 0 ? 100 : 0, direction: 'up' };
    }
    const change = ((current - previous) / previous) * 100;
    return {
        percentage: Math.round(Math.abs(change) * 100) / 100,
        direction: change >= 0 ? 'up' : 'down'
    };
}

/**
 * Görev meta bilgileri
 */
const meta = {
    name: 'salesReport',
    displayName: 'Satış Raporu',
    description: 'Günlük ve haftalık satış raporları oluşturur',
    defaultCron: '0 23 * * *',
    configSchema: {
        reportType: { type: 'string', enum: ['daily', 'weekly'], default: 'daily' },
        includeDetails: { type: 'boolean', default: true },
        includeComparison: { type: 'boolean', default: false }
    }
};

module.exports = { execute, meta };
