/**
 * Bildirim Yöneticisi
 * Agent bildirimlerini yönetir ve renderer process'e iletir
 */

const { BrowserWindow } = require('electron');

/**
 * Bildirim tipleri
 */
const NotificationType = {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error'
};

/**
 * Bildirim öncelikleri
 */
const NotificationPriority = {
    LOW: 'low',
    NORMAL: 'normal',
    HIGH: 'high',
    CRITICAL: 'critical'
};

/**
 * Bildirim geçmişi (bellekte)
 */
let notificationHistory = [];
const MAX_HISTORY = 100;

/**
 * Tüm açık pencerelere bildirim gönder
 * @param {Object} notification - Bildirim nesnesi
 */
function broadcastNotification(notification) {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
        if (win && !win.isDestroyed()) {
            win.webContents.send('agent:notification', notification);
        }
    });
}

/**
 * Bildirim oluştur ve gönder
 * @param {Object} options - Bildirim seçenekleri
 * @returns {Object} Oluşturulan bildirim
 */
function notify(options) {
    const notification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: options.type || NotificationType.INFO,
        title: options.title || 'Agent Bildirimi',
        message: options.message,
        priority: options.priority || NotificationPriority.NORMAL,
        source: options.source || 'agent',
        taskName: options.taskName || null,
        data: options.data || null,
        timestamp: new Date().toISOString(),
        read: false
    };

    // Geçmişe ekle
    notificationHistory.unshift(notification);
    if (notificationHistory.length > MAX_HISTORY) {
        notificationHistory = notificationHistory.slice(0, MAX_HISTORY);
    }

    // Yayınla
    broadcastNotification(notification);

    // Konsola da yaz
    const logLevel = notification.type === 'error' ? 'error' :
                     notification.type === 'warning' ? 'warn' : 'log';
    console[logLevel](`[Agent/${notification.source}] ${notification.title}: ${notification.message}`);

    return notification;
}

/**
 * Bilgi bildirimi
 * @param {string} title - Başlık
 * @param {string} message - Mesaj
 * @param {Object} options - Ek seçenekler
 */
function info(title, message, options = {}) {
    return notify({
        ...options,
        type: NotificationType.INFO,
        title,
        message
    });
}

/**
 * Başarı bildirimi
 * @param {string} title - Başlık
 * @param {string} message - Mesaj
 * @param {Object} options - Ek seçenekler
 */
function success(title, message, options = {}) {
    return notify({
        ...options,
        type: NotificationType.SUCCESS,
        title,
        message
    });
}

/**
 * Uyarı bildirimi
 * @param {string} title - Başlık
 * @param {string} message - Mesaj
 * @param {Object} options - Ek seçenekler
 */
function warning(title, message, options = {}) {
    return notify({
        ...options,
        type: NotificationType.WARNING,
        title,
        message,
        priority: options.priority || NotificationPriority.HIGH
    });
}

/**
 * Hata bildirimi
 * @param {string} title - Başlık
 * @param {string} message - Mesaj
 * @param {Object} options - Ek seçenekler
 */
function error(title, message, options = {}) {
    return notify({
        ...options,
        type: NotificationType.ERROR,
        title,
        message,
        priority: options.priority || NotificationPriority.CRITICAL
    });
}

/**
 * Stok uyarısı bildirimi
 * @param {Array} products - Düşük stoklu ürünler
 * @param {string} severity - Önem seviyesi ('warning' veya 'critical')
 */
function stockAlert(products, severity = 'warning') {
    const count = products.length;
    const title = severity === 'critical' ? 'Kritik Stok Uyarısı' : 'Stok Uyarısı';
    const message = `${count} üründe ${severity === 'critical' ? 'kritik' : 'düşük'} stok seviyesi tespit edildi.`;

    return notify({
        type: severity === 'critical' ? NotificationType.ERROR : NotificationType.WARNING,
        title,
        message,
        source: 'stockCheck',
        taskName: 'stockCheck',
        priority: severity === 'critical' ? NotificationPriority.CRITICAL : NotificationPriority.HIGH,
        data: { products, count, severity }
    });
}

/**
 * Miad uyarısı bildirimi
 * @param {Array} products - Son kullanma tarihi yaklaşan ürünler
 * @param {number} days - Kalan gün sayısı
 */
function expiryAlert(products, days) {
    const count = products.length;
    const severity = days <= 7 ? 'critical' : 'warning';
    const title = severity === 'critical' ? 'Kritik Miad Uyarısı' : 'Miad Uyarısı';
    const message = `${count} ürünün son kullanma tarihi ${days} gün içinde dolacak.`;

    return notify({
        type: severity === 'critical' ? NotificationType.ERROR : NotificationType.WARNING,
        title,
        message,
        source: 'expiryCheck',
        taskName: 'expiryCheck',
        priority: severity === 'critical' ? NotificationPriority.CRITICAL : NotificationPriority.HIGH,
        data: { products, count, days }
    });
}

/**
 * Rapor tamamlandı bildirimi
 * @param {string} reportType - Rapor tipi
 * @param {Object} summary - Rapor özeti
 */
function reportReady(reportType, summary) {
    const title = reportType === 'daily' ? 'Günlük Rapor Hazır' : 'Haftalık Rapor Hazır';
    const message = `${reportType === 'daily' ? 'Günlük' : 'Haftalık'} satış raporu oluşturuldu. Toplam: ₺${summary.totalSales?.toLocaleString('tr-TR') || 0}`;

    return notify({
        type: NotificationType.SUCCESS,
        title,
        message,
        source: 'salesReport',
        taskName: 'salesReport',
        priority: NotificationPriority.NORMAL,
        data: summary
    });
}

/**
 * Yedekleme bildirimi
 * @param {boolean} success - Başarılı mı?
 * @param {string} backupPath - Yedek dosya yolu
 */
function backupNotification(success, backupPath = null) {
    if (success) {
        return notify({
            type: NotificationType.SUCCESS,
            title: 'Yedekleme Tamamlandı',
            message: 'Veritabanı başarıyla yedeklendi.',
            source: 'databaseBackup',
            taskName: 'databaseBackup',
            priority: NotificationPriority.LOW,
            data: { backupPath }
        });
    } else {
        return notify({
            type: NotificationType.ERROR,
            title: 'Yedekleme Hatası',
            message: 'Veritabanı yedeklenirken bir hata oluştu.',
            source: 'databaseBackup',
            taskName: 'databaseBackup',
            priority: NotificationPriority.HIGH,
            data: { backupPath }
        });
    }
}

/**
 * AI sorgu sonucu bildirimi
 * @param {string} query - Sorgu
 * @param {boolean} success - Başarılı mı?
 */
function aiQueryResult(query, success) {
    if (success) {
        return notify({
            type: NotificationType.SUCCESS,
            title: 'AI Sorgu Tamamlandı',
            message: 'Sorgunuz işlendi ve yanıt hazır.',
            source: 'ai',
            priority: NotificationPriority.NORMAL,
            data: { query }
        });
    } else {
        return notify({
            type: NotificationType.ERROR,
            title: 'AI Sorgu Hatası',
            message: 'Sorgunuz işlenirken bir hata oluştu.',
            source: 'ai',
            priority: NotificationPriority.HIGH,
            data: { query }
        });
    }
}

/**
 * Bildirim geçmişini getir
 * @param {number} limit - Maksimum kayıt
 * @returns {Array}
 */
function getHistory(limit = 50) {
    return notificationHistory.slice(0, limit);
}

/**
 * Okunmamış bildirimleri getir
 * @returns {Array}
 */
function getUnread() {
    return notificationHistory.filter(n => !n.read);
}

/**
 * Bildirimi okundu olarak işaretle
 * @param {string} notificationId - Bildirim ID
 */
function markAsRead(notificationId) {
    const notification = notificationHistory.find(n => n.id === notificationId);
    if (notification) {
        notification.read = true;
    }
}

/**
 * Tüm bildirimleri okundu olarak işaretle
 */
function markAllAsRead() {
    notificationHistory.forEach(n => n.read = true);
}

/**
 * Bildirim geçmişini temizle
 */
function clearHistory() {
    notificationHistory = [];
}

module.exports = {
    NotificationType,
    NotificationPriority,
    notify,
    info,
    success,
    warning,
    error,
    stockAlert,
    expiryAlert,
    reportReady,
    backupNotification,
    aiQueryResult,
    getHistory,
    getUnread,
    markAsRead,
    markAllAsRead,
    clearHistory
};
