/**
 * Görev Kayıt Defteri
 * Tüm scheduler görevlerini yönetir ve yükler
 */

const stockCheck = require('./tasks/stockCheck');
const expiryCheck = require('./tasks/expiryCheck');
const salesReport = require('./tasks/salesReport');
const databaseBackup = require('./tasks/databaseBackup');
const priceListSync = require('./tasks/priceListSync');

/**
 * Kayıtlı görevler
 */
const tasks = {
    stockCheck: stockCheck,
    expiryCheck: expiryCheck,
    salesReport: salesReport,
    databaseBackup: databaseBackup,
    priceListSync: priceListSync
};

/**
 * Haftalık rapor görevi (salesReport'un haftalık versiyonu)
 */
const weeklyReport = {
    execute: async (config) => {
        return salesReport.execute({ ...config, reportType: 'weekly', includeComparison: true });
    },
    meta: {
        name: 'weeklyReport',
        displayName: 'Haftalık Satış Raporu',
        description: 'Haftalık satış analizini oluşturur',
        defaultCron: '0 23 * * 0'
    }
};

// Haftalık raporu da ekle
tasks.weeklyReport = weeklyReport;

/**
 * Tüm görevleri getir
 * @returns {Object} Görev listesi
 */
function getAllTasks() {
    return tasks;
}

/**
 * Belirli bir görevi getir
 * @param {string} taskName - Görev adı
 * @returns {Object|null}
 */
function getTask(taskName) {
    return tasks[taskName] || null;
}

/**
 * Görev var mı kontrol et
 * @param {string} taskName - Görev adı
 * @returns {boolean}
 */
function hasTask(taskName) {
    return taskName in tasks;
}

/**
 * Görev meta bilgilerini getir
 * @param {string} taskName - Görev adı
 * @returns {Object|null}
 */
function getTaskMeta(taskName) {
    const task = getTask(taskName);
    return task ? task.meta : null;
}

/**
 * Tüm görevlerin meta bilgilerini getir
 * @returns {Array}
 */
function getAllTaskMetas() {
    return Object.values(tasks).map(task => task.meta);
}

/**
 * Görevi çalıştır
 * @param {string} taskName - Görev adı
 * @param {Object} config - Görev konfigürasyonu
 * @returns {Promise<Object>}
 */
async function executeTask(taskName, config = {}) {
    const task = getTask(taskName);
    if (!task) {
        throw new Error(`Görev bulunamadı: ${taskName}`);
    }

    return task.execute(config);
}

/**
 * Yeni görev kaydet (dinamik)
 * @param {string} taskName - Görev adı
 * @param {Object} taskModule - Görev modülü
 */
function registerTask(taskName, taskModule) {
    if (!taskModule.execute || typeof taskModule.execute !== 'function') {
        throw new Error('Görev modülü execute fonksiyonu içermelidir');
    }
    if (!taskModule.meta) {
        throw new Error('Görev modülü meta bilgisi içermelidir');
    }
    tasks[taskName] = taskModule;
}

/**
 * Görevi kaldır
 * @param {string} taskName - Görev adı
 */
function unregisterTask(taskName) {
    if (tasks[taskName]) {
        delete tasks[taskName];
    }
}

/**
 * Görev sayısını getir
 * @returns {number}
 */
function getTaskCount() {
    return Object.keys(tasks).length;
}

/**
 * Görev adlarını getir
 * @returns {Array<string>}
 */
function getTaskNames() {
    return Object.keys(tasks);
}

module.exports = {
    getAllTasks,
    getTask,
    hasTask,
    getTaskMeta,
    getAllTaskMetas,
    executeTask,
    registerTask,
    unregisterTask,
    getTaskCount,
    getTaskNames
};
