/**
 * Zamanlanmış Görev Veritabanı Modülü
 * Görev konfigürasyonlarını ve durumlarını yönetir
 */

const Datastore = require("@seald-io/nedb");
const path = require("path");

const appName = process.env.APPNAME;
const appData = process.env.APPDATA;
const dbPath = path.join(appData, appName, "server", "databases", "scheduled_tasks.db");

const scheduledTasksDB = new Datastore({
    filename: dbPath,
    autoload: true,
});

// Index oluştur
scheduledTasksDB.ensureIndex({ fieldName: "_id", unique: true });
scheduledTasksDB.ensureIndex({ fieldName: "name", unique: true });

/**
 * Varsayılan görev tanımları
 */
const defaultTasks = [
    {
        _id: 'task_stock_check',
        name: 'stockCheck',
        displayName: 'Stok Kontrolü',
        description: 'Minimum stok seviyesinin altındaki ürünleri tespit eder',
        cronExpression: '0 8,18 * * *', // Günde 2x (08:00 ve 18:00)
        enabled: true,
        taskType: 'scheduler',
        config: {
            thresholds: {
                critical: 5,
                warning: 10
            },
            notifyOnWarning: true,
            notifyOnCritical: true
        },
        lastRun: null,
        nextRun: null,
        runCount: 0,
        failCount: 0
    },
    {
        _id: 'task_expiry_check',
        name: 'expiryCheck',
        displayName: 'Miad Takibi',
        description: 'Son kullanma tarihi yaklaşan ürünleri tespit eder',
        cronExpression: '0 9 * * *', // Her gün 09:00
        enabled: true,
        taskType: 'scheduler',
        config: {
            daysThreshold: 30,
            criticalDays: 7
        },
        lastRun: null,
        nextRun: null,
        runCount: 0,
        failCount: 0
    },
    {
        _id: 'task_daily_report',
        name: 'salesReport',
        displayName: 'Günlük Satış Raporu',
        description: 'Günlük satış özetini oluşturur',
        cronExpression: '0 23 * * *', // Her gece 23:00
        enabled: true,
        taskType: 'scheduler',
        config: {
            reportType: 'daily',
            includeDetails: true
        },
        lastRun: null,
        nextRun: null,
        runCount: 0,
        failCount: 0
    },
    {
        _id: 'task_weekly_report',
        name: 'weeklyReport',
        displayName: 'Haftalık Satış Raporu',
        description: 'Haftalık satış analizini oluşturur',
        cronExpression: '0 23 * * 0', // Her Pazar 23:00
        enabled: true,
        taskType: 'scheduler',
        config: {
            reportType: 'weekly',
            includeComparison: true
        },
        lastRun: null,
        nextRun: null,
        runCount: 0,
        failCount: 0
    },
    {
        _id: 'task_db_backup',
        name: 'databaseBackup',
        displayName: 'Veritabanı Yedekleme',
        description: 'Veritabanı dosyalarını otomatik yedekler',
        cronExpression: '0 3 * * *', // Her gece 03:00
        enabled: true,
        taskType: 'scheduler',
        config: {
            keepBackups: 7,
            compressBackups: true
        },
        lastRun: null,
        nextRun: null,
        runCount: 0,
        failCount: 0
    },
    {
        _id: 'task_price_sync',
        name: 'priceListSync',
        displayName: 'TİTCK Fiyat Güncelleme',
        description: 'TİTCK referans fiyat listesini kontrol eder',
        cronExpression: '0 6 * * 1', // Her Pazartesi 06:00
        enabled: true,
        taskType: 'scheduler',
        config: {
            autoUpdate: false, // Manuel onay gerektirir
            notifyOnChange: true
        },
        lastRun: null,
        nextRun: null,
        runCount: 0,
        failCount: 0
    }
];

/**
 * Varsayılan görevleri veritabanına ekle (yoksa)
 */
function initializeDefaultTasks() {
    return new Promise((resolve, reject) => {
        let completed = 0;
        const total = defaultTasks.length;

        defaultTasks.forEach(task => {
            scheduledTasksDB.findOne({ name: task.name }, function (err, existing) {
                if (!existing) {
                    scheduledTasksDB.insert(task, function (err) {
                        if (err) console.error(`Görev eklenirken hata: ${task.name}`, err);
                        completed++;
                        if (completed === total) resolve();
                    });
                } else {
                    completed++;
                    if (completed === total) resolve();
                }
            });
        });
    });
}

/**
 * Tüm görevleri getir
 * @returns {Promise<Array>}
 */
function getAllTasks() {
    return new Promise((resolve, reject) => {
        scheduledTasksDB.find({}).sort({ name: 1 }).exec(function (err, tasks) {
            if (err) {
                reject(err);
            } else {
                resolve(tasks);
            }
        });
    });
}

/**
 * Aktif görevleri getir
 * @returns {Promise<Array>}
 */
function getEnabledTasks() {
    return new Promise((resolve, reject) => {
        scheduledTasksDB.find({ enabled: true }).exec(function (err, tasks) {
            if (err) {
                reject(err);
            } else {
                resolve(tasks);
            }
        });
    });
}

/**
 * Belirli bir görevi getir
 * @param {string} taskName - Görev adı
 * @returns {Promise<Object>}
 */
function getTask(taskName) {
    return new Promise((resolve, reject) => {
        scheduledTasksDB.findOne({ name: taskName }, function (err, task) {
            if (err) {
                reject(err);
            } else {
                resolve(task);
            }
        });
    });
}

/**
 * Görev durumunu güncelle
 * @param {string} taskName - Görev adı
 * @param {Object} updateData - Güncellenecek veriler
 * @returns {Promise<number>}
 */
function updateTask(taskName, updateData) {
    return new Promise((resolve, reject) => {
        scheduledTasksDB.update(
            { name: taskName },
            { $set: updateData },
            {},
            function (err, numReplaced) {
                if (err) {
                    reject(err);
                } else {
                    resolve(numReplaced);
                }
            }
        );
    });
}

/**
 * Görev çalıştırma bilgisini güncelle
 * @param {string} taskName - Görev adı
 * @param {boolean} success - Başarılı mı?
 * @param {Date} nextRun - Sonraki çalışma zamanı
 * @returns {Promise<number>}
 */
function updateTaskRun(taskName, success, nextRun = null) {
    return new Promise((resolve, reject) => {
        const update = {
            lastRun: new Date().toISOString()
        };

        if (nextRun) {
            update.nextRun = nextRun.toISOString();
        }

        const incUpdate = success ? { runCount: 1 } : { runCount: 1, failCount: 1 };

        scheduledTasksDB.update(
            { name: taskName },
            {
                $set: update,
                $inc: incUpdate
            },
            {},
            function (err, numReplaced) {
                if (err) {
                    reject(err);
                } else {
                    resolve(numReplaced);
                }
            }
        );
    });
}

/**
 * Görevi etkinleştir/devre dışı bırak
 * @param {string} taskName - Görev adı
 * @param {boolean} enabled - Etkin mi?
 * @returns {Promise<number>}
 */
function setTaskEnabled(taskName, enabled) {
    return updateTask(taskName, { enabled });
}

/**
 * Görev konfigürasyonunu güncelle
 * @param {string} taskName - Görev adı
 * @param {Object} config - Yeni konfigürasyon
 * @returns {Promise<number>}
 */
function updateTaskConfig(taskName, config) {
    return new Promise((resolve, reject) => {
        scheduledTasksDB.findOne({ name: taskName }, function (err, task) {
            if (err) {
                reject(err);
            } else if (!task) {
                reject(new Error(`Görev bulunamadı: ${taskName}`));
            } else {
                const newConfig = { ...task.config, ...config };
                scheduledTasksDB.update(
                    { name: taskName },
                    { $set: { config: newConfig } },
                    {},
                    function (err, numReplaced) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(numReplaced);
                        }
                    }
                );
            }
        });
    });
}

/**
 * Cron ifadesini güncelle
 * @param {string} taskName - Görev adı
 * @param {string} cronExpression - Yeni cron ifadesi
 * @returns {Promise<number>}
 */
function updateCronExpression(taskName, cronExpression) {
    return updateTask(taskName, { cronExpression });
}

/**
 * Görev istatistiklerini getir
 * @returns {Promise<Object>}
 */
function getTaskStats() {
    return new Promise((resolve, reject) => {
        scheduledTasksDB.find({}, function (err, tasks) {
            if (err) {
                reject(err);
            } else {
                const stats = {
                    total: tasks.length,
                    enabled: tasks.filter(t => t.enabled).length,
                    disabled: tasks.filter(t => !t.enabled).length,
                    totalRuns: tasks.reduce((sum, t) => sum + (t.runCount || 0), 0),
                    totalFails: tasks.reduce((sum, t) => sum + (t.failCount || 0), 0),
                    tasks: tasks.map(t => ({
                        name: t.name,
                        displayName: t.displayName,
                        enabled: t.enabled,
                        lastRun: t.lastRun,
                        runCount: t.runCount,
                        failCount: t.failCount,
                        successRate: t.runCount > 0
                            ? Math.round(((t.runCount - t.failCount) / t.runCount) * 100)
                            : 0
                    }))
                };
                resolve(stats);
            }
        });
    });
}

module.exports = {
    scheduledTasksDB,
    initializeDefaultTasks,
    getAllTasks,
    getEnabledTasks,
    getTask,
    updateTask,
    updateTaskRun,
    setTaskEnabled,
    updateTaskConfig,
    updateCronExpression,
    getTaskStats
};
