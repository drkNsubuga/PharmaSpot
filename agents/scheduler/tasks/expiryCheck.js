/**
 * Miad Takibi Görevi
 * Son kullanma tarihi yaklaşan ürünleri tespit eder
 */

const Datastore = require("@seald-io/nedb");
const path = require("path");
const notifications = require('../../notifications');

const appName = process.env.APPNAME;
const appData = process.env.APPDATA;
const inventoryDBPath = path.join(appData, appName, "server", "databases", "inventory.db");

let inventoryDB = new Datastore({
    filename: inventoryDBPath,
    autoload: true,
});

/**
 * Miad kontrolü yap
 * @param {Object} config - Görev konfigürasyonu
 * @returns {Promise<Object>} Sonuç
 */
async function execute(config = {}) {
    const daysThreshold = config.daysThreshold || 30;
    const criticalDays = config.criticalDays || 7;

    return new Promise((resolve, reject) => {
        inventoryDB.find({}, function (err, products) {
            if (err) {
                reject(err);
                return;
            }

            const now = new Date();
            const expiredProducts = [];
            const criticalProducts = [];
            const warningProducts = [];

            products.forEach(product => {
                // expiryDate alanı varsa kontrol et
                if (!product.expiryDate) return;

                const expiryDate = new Date(product.expiryDate);
                const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

                const productInfo = {
                    id: product._id,
                    name: product.name,
                    barcode: product.barcode,
                    quantity: product.quantity,
                    expiryDate: product.expiryDate,
                    daysUntilExpiry: daysUntilExpiry
                };

                if (daysUntilExpiry < 0) {
                    // Süresi dolmuş
                    productInfo.status = 'expired';
                    expiredProducts.push(productInfo);
                } else if (daysUntilExpiry <= criticalDays) {
                    // Kritik (7 gün veya daha az)
                    productInfo.status = 'critical';
                    criticalProducts.push(productInfo);
                } else if (daysUntilExpiry <= daysThreshold) {
                    // Uyarı (30 gün veya daha az)
                    productInfo.status = 'warning';
                    warningProducts.push(productInfo);
                }
            });

            const result = {
                timestamp: new Date().toISOString(),
                totalProducts: products.length,
                productsWithExpiry: products.filter(p => p.expiryDate).length,
                expiredCount: expiredProducts.length,
                criticalCount: criticalProducts.length,
                warningCount: warningProducts.length,
                expiredProducts: expiredProducts,
                criticalProducts: criticalProducts,
                warningProducts: warningProducts,
                hasIssues: expiredProducts.length > 0 || criticalProducts.length > 0 || warningProducts.length > 0
            };

            // Bildirimler gönder
            if (expiredProducts.length > 0) {
                notifications.error(
                    'Süresi Dolmuş Ürünler',
                    `${expiredProducts.length} ürünün son kullanma tarihi geçmiş!`,
                    {
                        source: 'expiryCheck',
                        taskName: 'expiryCheck',
                        data: { products: expiredProducts }
                    }
                );
            }

            if (criticalProducts.length > 0) {
                notifications.expiryAlert(criticalProducts, criticalDays);
            }

            if (warningProducts.length > 0) {
                notifications.expiryAlert(warningProducts, daysThreshold);
            }

            // Sorun yoksa başarı bildirimi
            if (!result.hasIssues) {
                notifications.success(
                    'Miad Kontrolü Tamamlandı',
                    'Yakın zamanda süresi dolacak ürün bulunamadı.',
                    { source: 'expiryCheck', taskName: 'expiryCheck' }
                );
            }

            resolve(result);
        });
    });
}

/**
 * Görev meta bilgileri
 */
const meta = {
    name: 'expiryCheck',
    displayName: 'Miad Takibi',
    description: 'Son kullanma tarihi yaklaşan ürünleri tespit eder',
    defaultCron: '0 9 * * *',
    configSchema: {
        daysThreshold: { type: 'number', default: 30 },
        criticalDays: { type: 'number', default: 7 }
    }
};

module.exports = { execute, meta };
