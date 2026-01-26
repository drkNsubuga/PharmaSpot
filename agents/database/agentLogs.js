/**
 * Agent Log Veritabanı Modülü
 * Agent çalışma geçmişini kaydeder ve yönetir
 */

const Datastore = require("@seald-io/nedb");
const path = require("path");

const appName = process.env.APPNAME;
const appData = process.env.APPDATA;
const dbPath = path.join(appData, appName, "server", "databases", "agent_logs.db");

const agentLogsDB = new Datastore({
    filename: dbPath,
    autoload: true,
});

// Index oluştur
agentLogsDB.ensureIndex({ fieldName: "_id", unique: true });
agentLogsDB.ensureIndex({ fieldName: "agentType" });
agentLogsDB.ensureIndex({ fieldName: "taskName" });
agentLogsDB.ensureIndex({ fieldName: "startTime" });

/**
 * Yeni log kaydı oluştur
 * @param {Object} logData - Log verileri
 * @returns {Promise<Object>} Oluşturulan log
 */
function createLog(logData) {
    return new Promise((resolve, reject) => {
        const log = {
            _id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            agentType: logData.agentType, // 'scheduler' veya 'ai'
            taskName: logData.taskName,
            status: logData.status || 'running', // 'running', 'completed', 'failed'
            startTime: new Date().toISOString(),
            endTime: null,
            duration: null,
            result: null,
            error: null,
            metadata: logData.metadata || {}
        };

        agentLogsDB.insert(log, function (err, newLog) {
            if (err) {
                reject(err);
            } else {
                resolve(newLog);
            }
        });
    });
}

/**
 * Log kaydını güncelle
 * @param {string} logId - Log ID
 * @param {Object} updateData - Güncellenecek veriler
 * @returns {Promise<number>} Güncellenen kayıt sayısı
 */
function updateLog(logId, updateData) {
    return new Promise((resolve, reject) => {
        const update = { $set: updateData };

        // Eğer durum tamamlandı veya başarısız ise bitiş zamanını hesapla
        if (updateData.status === 'completed' || updateData.status === 'failed') {
            update.$set.endTime = new Date().toISOString();
        }

        agentLogsDB.update({ _id: logId }, update, {}, function (err, numReplaced) {
            if (err) {
                reject(err);
            } else {
                // Süreyi hesapla ve güncelle
                if (updateData.status === 'completed' || updateData.status === 'failed') {
                    agentLogsDB.findOne({ _id: logId }, function (err, log) {
                        if (!err && log) {
                            const start = new Date(log.startTime);
                            const end = new Date(log.endTime);
                            const duration = end - start; // milliseconds
                            agentLogsDB.update({ _id: logId }, { $set: { duration } }, {}, function () {
                                resolve(numReplaced);
                            });
                        } else {
                            resolve(numReplaced);
                        }
                    });
                } else {
                    resolve(numReplaced);
                }
            }
        });
    });
}

/**
 * Log kaydını tamamla
 * @param {string} logId - Log ID
 * @param {Object} result - Sonuç verisi
 * @returns {Promise<number>}
 */
function completeLog(logId, result) {
    return updateLog(logId, {
        status: 'completed',
        result: result
    });
}

/**
 * Log kaydını başarısız olarak işaretle
 * @param {string} logId - Log ID
 * @param {Error|string} error - Hata bilgisi
 * @returns {Promise<number>}
 */
function failLog(logId, error) {
    return updateLog(logId, {
        status: 'failed',
        error: error instanceof Error ? error.message : error
    });
}

/**
 * Logları getir
 * @param {Object} filter - Filtre kriterleri
 * @param {number} limit - Maksimum kayıt sayısı
 * @returns {Promise<Array>}
 */
function getLogs(filter = {}, limit = 100) {
    return new Promise((resolve, reject) => {
        agentLogsDB.find(filter)
            .sort({ startTime: -1 })
            .limit(limit)
            .exec(function (err, logs) {
                if (err) {
                    reject(err);
                } else {
                    resolve(logs);
                }
            });
    });
}

/**
 * Belirli bir göreve ait logları getir
 * @param {string} taskName - Görev adı
 * @param {number} limit - Maksimum kayıt sayısı
 * @returns {Promise<Array>}
 */
function getLogsByTask(taskName, limit = 50) {
    return getLogs({ taskName }, limit);
}

/**
 * Belirli bir agent tipine ait logları getir
 * @param {string} agentType - Agent tipi
 * @param {number} limit - Maksimum kayıt sayısı
 * @returns {Promise<Array>}
 */
function getLogsByAgentType(agentType, limit = 50) {
    return getLogs({ agentType }, limit);
}

/**
 * Son N günün loglarını getir
 * @param {number} days - Gün sayısı
 * @returns {Promise<Array>}
 */
function getRecentLogs(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return new Promise((resolve, reject) => {
        agentLogsDB.find({
            startTime: { $gte: startDate.toISOString() }
        })
        .sort({ startTime: -1 })
        .exec(function (err, logs) {
            if (err) {
                reject(err);
            } else {
                resolve(logs);
            }
        });
    });
}

/**
 * Log istatistiklerini getir
 * @returns {Promise<Object>}
 */
function getStats() {
    return new Promise((resolve, reject) => {
        agentLogsDB.find({}, function (err, logs) {
            if (err) {
                reject(err);
            } else {
                const stats = {
                    total: logs.length,
                    completed: logs.filter(l => l.status === 'completed').length,
                    failed: logs.filter(l => l.status === 'failed').length,
                    running: logs.filter(l => l.status === 'running').length,
                    byAgentType: {},
                    byTaskName: {},
                    avgDuration: 0
                };

                // Agent tipine göre grupla
                logs.forEach(log => {
                    if (!stats.byAgentType[log.agentType]) {
                        stats.byAgentType[log.agentType] = 0;
                    }
                    stats.byAgentType[log.agentType]++;

                    if (!stats.byTaskName[log.taskName]) {
                        stats.byTaskName[log.taskName] = 0;
                    }
                    stats.byTaskName[log.taskName]++;
                });

                // Ortalama süre
                const completedLogs = logs.filter(l => l.duration);
                if (completedLogs.length > 0) {
                    const totalDuration = completedLogs.reduce((sum, l) => sum + l.duration, 0);
                    stats.avgDuration = Math.round(totalDuration / completedLogs.length);
                }

                resolve(stats);
            }
        });
    });
}

/**
 * Eski logları temizle
 * @param {number} daysToKeep - Tutulacak gün sayısı
 * @returns {Promise<number>} Silinen kayıt sayısı
 */
function cleanupOldLogs(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    return new Promise((resolve, reject) => {
        agentLogsDB.remove(
            { startTime: { $lt: cutoffDate.toISOString() } },
            { multi: true },
            function (err, numRemoved) {
                if (err) {
                    reject(err);
                } else {
                    resolve(numRemoved);
                }
            }
        );
    });
}

module.exports = {
    agentLogsDB,
    createLog,
    updateLog,
    completeLog,
    failLog,
    getLogs,
    getLogsByTask,
    getLogsByAgentType,
    getRecentLogs,
    getStats,
    cleanupOldLogs
};
