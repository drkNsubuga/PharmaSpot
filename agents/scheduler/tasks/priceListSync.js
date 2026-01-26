/**
 * TİTCK Fiyat Güncelleme Görevi
 * TİTCK referans fiyat listesini kontrol eder ve günceller
 */

const Datastore = require("@seald-io/nedb");
const path = require("path");
const fs = require('fs');
const notifications = require('../../notifications');

const appName = process.env.APPNAME;
const appData = process.env.APPDATA;
const drugDBPath = path.join(appData, appName, "server", "databases", "drugs.db");
const inventoryDBPath = path.join(appData, appName, "server", "databases", "inventory.db");

let drugDB = new Datastore({
    filename: drugDBPath,
    autoload: true,
});

let inventoryDB = new Datastore({
    filename: inventoryDBPath,
    autoload: true,
});

// Yerel fiyat listesi yolu
const localPriceListPath = path.join(process.cwd(), 'data', 'ilac_fiyatlari.json');

/**
 * Fiyat güncellemesi kontrolü yap
 * @param {Object} config - Görev konfigürasyonu
 * @returns {Promise<Object>} Sonuç
 */
async function execute(config = {}) {
    const autoUpdate = config.autoUpdate || false;
    const notifyOnChange = config.notifyOnChange !== false;

    const result = {
        timestamp: new Date().toISOString(),
        checked: 0,
        changesFound: 0,
        updated: 0,
        priceIncreases: [],
        priceDecreases: [],
        newProducts: [],
        errors: []
    };

    try {
        // Yerel fiyat listesini oku
        let priceList = [];
        if (fs.existsSync(localPriceListPath)) {
            const data = fs.readFileSync(localPriceListPath, 'utf8');
            priceList = JSON.parse(data);
        }

        if (priceList.length === 0) {
            notifications.warning(
                'Fiyat Listesi Bulunamadı',
                'Yerel fiyat listesi dosyası boş veya mevcut değil.',
                { source: 'priceListSync', taskName: 'priceListSync' }
            );
            result.message = 'Fiyat listesi bulunamadı';
            return result;
        }

        // Envanterdeki ürünlerle karşılaştır
        const inventoryProducts = await getInventoryProducts();
        result.checked = inventoryProducts.length;

        for (const product of inventoryProducts) {
            if (!product.barcode) continue;

            // Fiyat listesinde ara
            const priceEntry = priceList.find(p =>
                p.barcode === product.barcode ||
                p.barkod === product.barcode
            );

            if (!priceEntry) continue;

            const currentPrice = parseFloat(product.salePrice) || 0;
            const newPrice = parseFloat(priceEntry.perakendeSatisFiyati || priceEntry.price) || 0;

            if (newPrice === 0) continue;

            // Fiyat değişikliği var mı?
            if (Math.abs(currentPrice - newPrice) >= 0.01) {
                result.changesFound++;

                const change = {
                    id: product._id,
                    name: product.name,
                    barcode: product.barcode,
                    oldPrice: currentPrice,
                    newPrice: newPrice,
                    difference: Math.round((newPrice - currentPrice) * 100) / 100,
                    percentChange: currentPrice > 0
                        ? Math.round(((newPrice - currentPrice) / currentPrice) * 10000) / 100
                        : 0
                };

                if (newPrice > currentPrice) {
                    result.priceIncreases.push(change);
                } else {
                    result.priceDecreases.push(change);
                }

                // Otomatik güncelleme aktifse
                if (autoUpdate) {
                    try {
                        await updateProductPrice(product._id, newPrice);
                        result.updated++;
                    } catch (err) {
                        result.errors.push({
                            product: product.name,
                            error: err.message
                        });
                    }
                }
            }
        }

        // Sonuç bildirimi
        if (result.changesFound > 0) {
            const message = autoUpdate
                ? `${result.changesFound} üründe fiyat değişikliği tespit edildi, ${result.updated} ürün güncellendi.`
                : `${result.changesFound} üründe fiyat değişikliği tespit edildi. Manuel güncelleme gerekiyor.`;

            if (notifyOnChange) {
                notifications.warning(
                    'Fiyat Değişiklikleri Tespit Edildi',
                    message,
                    {
                        source: 'priceListSync',
                        taskName: 'priceListSync',
                        data: {
                            increases: result.priceIncreases.length,
                            decreases: result.priceDecreases.length
                        }
                    }
                );
            }
        } else {
            notifications.success(
                'Fiyat Kontrolü Tamamlandı',
                'Fiyat değişikliği bulunamadı.',
                { source: 'priceListSync', taskName: 'priceListSync' }
            );
        }

        return result;
    } catch (err) {
        notifications.error(
            'Fiyat Güncelleme Hatası',
            `Fiyat kontrolü sırasında hata: ${err.message}`,
            { source: 'priceListSync', taskName: 'priceListSync' }
        );
        throw err;
    }
}

/**
 * Envanter ürünlerini getir
 * @returns {Promise<Array>}
 */
function getInventoryProducts() {
    return new Promise((resolve, reject) => {
        inventoryDB.find({}, function (err, products) {
            if (err) reject(err);
            else resolve(products);
        });
    });
}

/**
 * Ürün fiyatını güncelle
 * @param {string|number} productId - Ürün ID
 * @param {number} newPrice - Yeni fiyat
 * @returns {Promise<number>}
 */
function updateProductPrice(productId, newPrice) {
    return new Promise((resolve, reject) => {
        inventoryDB.update(
            { _id: productId },
            {
                $set: {
                    salePrice: newPrice,
                    priceUpdatedAt: new Date().toISOString()
                }
            },
            {},
            function (err, numReplaced) {
                if (err) reject(err);
                else resolve(numReplaced);
            }
        );
    });
}

/**
 * İlaç veritabanından fiyat bilgisi getir
 * @param {string} barcode - Barkod
 * @returns {Promise<Object>}
 */
function getDrugByBarcode(barcode) {
    return new Promise((resolve, reject) => {
        drugDB.findOne({ barcode: barcode }, function (err, drug) {
            if (err) reject(err);
            else resolve(drug);
        });
    });
}

/**
 * Toplu fiyat güncelleme
 * @param {Array} updates - Güncellenecek ürünler [{id, newPrice}]
 * @returns {Promise<Object>}
 */
async function bulkUpdatePrices(updates) {
    const results = {
        success: 0,
        failed: 0,
        errors: []
    };

    for (const update of updates) {
        try {
            await updateProductPrice(update.id, update.newPrice);
            results.success++;
        } catch (err) {
            results.failed++;
            results.errors.push({
                id: update.id,
                error: err.message
            });
        }
    }

    return results;
}

/**
 * Görev meta bilgileri
 */
const meta = {
    name: 'priceListSync',
    displayName: 'TİTCK Fiyat Güncelleme',
    description: 'TİTCK referans fiyat listesini kontrol eder',
    defaultCron: '0 6 * * 1',
    configSchema: {
        autoUpdate: { type: 'boolean', default: false },
        notifyOnChange: { type: 'boolean', default: true }
    }
};

module.exports = {
    execute,
    meta,
    getDrugByBarcode,
    bulkUpdatePrices
};
