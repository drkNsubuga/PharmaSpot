/**
 * Agent Sistemi Ana Modülü
 * Scheduler ve AI agent'ları yönetir
 */

const scheduler = require('./scheduler');
const aiAgent = require('./ai');
const agentLogs = require('./database/agentLogs');
const scheduledTasksDB = require('./database/scheduledTasks');
const notifications = require('./notifications');

/**
 * Agent sistemi durumu
 */
let isInitialized = false;
let initializationError = null;

/**
 * Agent sistemini başlat
 * @returns {Promise<Object>}
 */
async function initialize() {
    console.log('[AgentSystem] Başlatılıyor...');

    try {
        // Scheduler'ı başlat
        await scheduler.start();
        console.log('[AgentSystem] Scheduler başlatıldı');

        // AI Agent'ı başlat
        await aiAgent.initialize();
        console.log('[AgentSystem] AI Agent başlatıldı');

        // Eski logları temizle (30 günden eski)
        const cleanedLogs = await agentLogs.cleanupOldLogs(30);
        if (cleanedLogs > 0) {
            console.log(`[AgentSystem] ${cleanedLogs} eski log kaydı temizlendi`);
        }

        isInitialized = true;
        initializationError = null;

        notifications.success(
            'Agent Sistemi Hazır',
            'Scheduler ve AI agent başarıyla başlatıldı.',
            { source: 'system' }
        );

        return {
            success: true,
            message: 'Agent sistemi başlatıldı'
        };
    } catch (err) {
        console.error('[AgentSystem] Başlatma hatası:', err);
        initializationError = err.message;

        notifications.error(
            'Agent Sistemi Hatası',
            `Başlatma sırasında hata: ${err.message}`,
            { source: 'system' }
        );

        return {
            success: false,
            error: err.message
        };
    }
}

/**
 * Agent sistemini durdur
 */
function shutdown() {
    console.log('[AgentSystem] Kapatılıyor...');

    try {
        scheduler.stop();
        console.log('[AgentSystem] Scheduler durduruldu');

        isInitialized = false;
        console.log('[AgentSystem] Kapatıldı');
    } catch (err) {
        console.error('[AgentSystem] Kapatma hatası:', err);
    }
}

/**
 * Agent sistemi durumunu getir
 * @returns {Promise<Object>}
 */
async function getStatus() {
    try {
        const [schedulerStatus, aiStatus, logStats] = await Promise.all([
            scheduler.getStatus(),
            aiAgent.getStatus(),
            agentLogs.getStats()
        ]);

        return {
            isInitialized,
            initializationError,
            scheduler: schedulerStatus,
            ai: aiStatus,
            logs: logStats
        };
    } catch (err) {
        return {
            isInitialized,
            initializationError: initializationError || err.message,
            error: err.message
        };
    }
}

/**
 * Zamanlanmış görevleri getir
 * @returns {Promise<Array>}
 */
async function getScheduledTasks() {
    return scheduledTasksDB.getAllTasks();
}

/**
 * Görevi manuel tetikle
 * @param {string} taskName - Görev adı
 * @param {string} userId - Tetikleyen kullanıcı
 * @returns {Promise<Object>}
 */
async function triggerTask(taskName, userId = null) {
    return scheduler.triggerTask(taskName, userId);
}

/**
 * Görevi etkinleştir/devre dışı bırak
 * @param {string} taskName - Görev adı
 * @param {boolean} enabled - Etkin mi?
 * @returns {Promise<void>}
 */
async function setTaskEnabled(taskName, enabled) {
    if (enabled) {
        await scheduler.enableTask(taskName);
    } else {
        await scheduler.disableTask(taskName);
    }
}

/**
 * Görev zamanlamasını güncelle
 * @param {string} taskName - Görev adı
 * @param {string} cronExpression - Yeni cron ifadesi
 * @returns {Promise<void>}
 */
async function updateTaskSchedule(taskName, cronExpression) {
    return scheduler.updateTaskSchedule(taskName, cronExpression);
}

/**
 * AI sorgusu gönder
 * @param {string} query - Sorgu metni
 * @param {Object} options - Ek seçenekler
 * @returns {Promise<Object>}
 */
async function aiQuery(query, options = {}) {
    return aiAgent.query(query, options);
}

/**
 * AI API anahtarını ayarla
 * @param {string} apiKey - API anahtarı
 * @returns {Promise<Object>}
 */
async function setAiApiKey(apiKey) {
    return aiAgent.setApiKey(apiKey);
}

/**
 * AI konuşmasını temizle
 * @param {string} conversationId - Konuşma ID
 */
function clearAiConversation(conversationId = 'default') {
    aiAgent.clearConversation(conversationId);
}

/**
 * Log geçmişini getir
 * @param {Object} filter - Filtre
 * @param {number} limit - Limit
 * @returns {Promise<Array>}
 */
async function getLogs(filter = {}, limit = 100) {
    return agentLogs.getLogs(filter, limit);
}

/**
 * Son logları getir
 * @param {number} days - Gün sayısı
 * @returns {Promise<Array>}
 */
async function getRecentLogs(days = 7) {
    return agentLogs.getRecentLogs(days);
}

/**
 * Bildirim geçmişini getir
 * @param {number} limit - Limit
 * @returns {Array}
 */
function getNotifications(limit = 50) {
    return notifications.getHistory(limit);
}

/**
 * Okunmamış bildirimleri getir
 * @returns {Array}
 */
function getUnreadNotifications() {
    return notifications.getUnread();
}

/**
 * Bildirimi okundu işaretle
 * @param {string} notificationId - Bildirim ID
 */
function markNotificationAsRead(notificationId) {
    notifications.markAsRead(notificationId);
}

/**
 * Tüm bildirimleri okundu işaretle
 */
function markAllNotificationsAsRead() {
    notifications.markAllAsRead();
}

/**
 * Önerilen AI sorgularını getir
 * @returns {Array}
 */
function getSuggestedQueries() {
    return aiAgent.getSuggestedQueries();
}

// Modülleri dışa aktar
module.exports = {
    // Yaşam döngüsü
    initialize,
    shutdown,
    getStatus,

    // Scheduler
    scheduler,
    getScheduledTasks,
    triggerTask,
    setTaskEnabled,
    updateTaskSchedule,

    // AI Agent
    ai: aiAgent,
    aiQuery,
    setAiApiKey,
    clearAiConversation,
    getSuggestedQueries,

    // Logs
    getLogs,
    getRecentLogs,

    // Notifications
    notifications,
    getNotifications,
    getUnreadNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,

    // Alt modüller
    agentLogs,
    scheduledTasksDB
};
