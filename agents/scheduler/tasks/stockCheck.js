/**
 * Stok Kontrolü Görevi
 * Minimum stok seviyesinin altındaki ürünleri tespit eder
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
 * Stok kontrolü yap
 * @param {Object} config - Görev konfigürasyonu
 * @returns {Promise<Object>} Sonuç
 */
async function execute(config = {}) {
    const thresholds = config.thresholds || { critical: 5, warning: 10 };
    const notifyOnWarning = config.notifyOnWarning !== false;
    const notifyOnCritical = config.notifyOnCritical !== false;

    return new Promise((resolve, reject) => {
        inventoryDB.find({}, function (err, products) {
            if (err) {
                reject(err);
                return;
            }

            const criticalProducts = [];
            const warningProducts = [];
            const normalProducts = [];

            products.forEach(product => {
                const quantity = parseInt(product.quantity) || 0;
                const minStock = parseInt(product.minStock) || thresholds.warning;

                if (quantity <= thresholds.critical) {
                    criticalProducts.push({
                        id: product._id,
                        name: product.name,
                        barcode: product.barcode,
                        quantity: quantity,
                        minStock: minStock,
                        status: 'critical'
                    });
                } else if (quantity <= minStock || quantity <= thresholds.warning) {
                    warningProducts.push({
                        id: product._id,
                        name: product.name,
                        barcode: product.barcode,
                        quantity: quantity,
                        minStock: minStock,
                        status: 'warning'
                    });
                } else {
                    normalProducts.push({
                        id: product._id,
                        name: product.name,
                        quantity: quantity
                    });
                }
            });

            const result = {
                timestamp: new Date().toISOString(),
                totalProducts: products.length,
                criticalCount: criticalProducts.length,
                warningCount: warningProducts.length,
                normalCount: normalProducts.length,
                criticalProducts: criticalProducts,
                warningProducts: warningProducts,
                hasIssues: criticalProducts.length > 0 || warningProducts.length > 0
            };

            // Bildirimler gönder
            if (notifyOnCritical && criticalProducts.length > 0) {
                notifications.stockAlert(criticalProducts, 'critical');
            }

            if (notifyOnWarning && warningProducts.length > 0) {
                notifications.stockAlert(warningProducts, 'warning');
            }

            // Sorun yoksa başarı bildirimi
            if (!result.hasIssues) {
                notifications.success(
                    'Stok Kontrolü Tamamlandı',
                    'Tüm ürünler yeterli stok seviyesinde.',
                    { source: 'stockCheck', taskName: 'stockCheck' }
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
    name: 'stockCheck',
    displayName: 'Stok Kontrolü',
    description: 'Minimum stok seviyesinin altındaki ürünleri tespit eder',
    defaultCron: '0 8,18 * * *',
    configSchema: {
        thresholds: {
            type: 'object',
            properties: {
                critical: { type: 'number', default: 5 },
                warning: { type: 'number', default: 10 }
            }
        },
        notifyOnWarning: { type: 'boolean', default: true },
        notifyOnCritical: { type: 'boolean', default: true }
    }
};

module.exports = { execute, meta };
