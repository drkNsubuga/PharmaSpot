/**
 * Scheduler Servisi
 * node-cron tabanlı zamanlanmış görev yöneticisi
 */

const cron = require('node-cron');
const taskRegistry = require('./taskRegistry');
const scheduledTasksDB = require('../database/scheduledTasks');
const agentLogs = require('../database/agentLogs');

/**
 * Aktif cron görevleri
 */
const activeJobs = new Map();

/**
 * Scheduler durumu
 */
let isRunning = false;
let initializationComplete = false;

/**
 * Scheduler'ı başlat
 * @returns {Promise<void>}
 */
async function start() {
    if (isRunning) {
        console.log('[Scheduler] Zaten çalışıyor');
        return;
    }

    console.log('[Scheduler] Başlatılıyor...');

    try {
        // Varsayılan görevleri veritabanına ekle
        await scheduledTasksDB.initializeDefaultTasks();

        // Aktif görevleri yükle
        const tasks = await scheduledTasksDB.getEnabledTasks();

        for (const task of tasks) {
            scheduleTask(task);
        }

        isRunning = true;
        initializationComplete = true;
        console.log(`[Scheduler] ${activeJobs.size} görev zamanlandı`);
    } catch (err) {
        console.error('[Scheduler] Başlatma hatası:', err);
        throw err;
    }
}

/**
 * Scheduler'ı durdur
 */
function stop() {
    if (!isRunning) return;

    console.log('[Scheduler] Durduruluyor...');

    activeJobs.forEach((job, taskName) => {
        job.stop();
        console.log(`[Scheduler] Görev durduruldu: ${taskName}`);
    });

    activeJobs.clear();
    isRunning = false;
    console.log('[Scheduler] Durduruldu');
}

/**
 * Görevi zamanla
 * @param {Object} taskConfig - Görev konfigürasyonu
 */
function scheduleTask(taskConfig) {
    const { name, cronExpression, config } = taskConfig;

    // Geçerli cron ifadesi mi kontrol et
    if (!cron.validate(cronExpression)) {
        console.error(`[Scheduler] Geçersiz cron ifadesi: ${cronExpression} (${name})`);
        return;
    }

    // Zaten zamanlanmış mı?
    if (activeJobs.has(name)) {
        activeJobs.get(name).stop();
    }

    // Cron görevi oluştur
    const job = cron.schedule(cronExpression, async () => {
        await runTask(name, config);
    }, {
        scheduled: true,
        timezone: 'Europe/Istanbul'
    });

    activeJobs.set(name, job);

    // Sonraki çalışma zamanını hesapla ve kaydet
    const nextRun = getNextRunTime(cronExpression);
    scheduledTasksDB.updateTask(name, { nextRun: nextRun.toISOString() });

    console.log(`[Scheduler] Görev zamanlandı: ${name} (${cronExpression})`);
}

/**
 * Görevi iptal et
 * @param {string} taskName - Görev adı
 */
function unscheduleTask(taskName) {
    const job = activeJobs.get(taskName);
    if (job) {
        job.stop();
        activeJobs.delete(taskName);
        console.log(`[Scheduler] Görev iptal edildi: ${taskName}`);
    }
}

/**
 * Görevi çalıştır
 * @param {string} taskName - Görev adı
 * @param {Object} config - Görev konfigürasyonu
 * @param {Object} options - Ek seçenekler
 * @returns {Promise<Object>}
 */
async function runTask(taskName, config = {}, options = {}) {
    const triggeredBy = options.triggeredBy || 'scheduler';

    console.log(`[Scheduler] Görev başlatılıyor: ${taskName}`);

    // Log kaydı oluştur
    const log = await agentLogs.createLog({
        agentType: 'scheduler',
        taskName: taskName,
        metadata: {
            triggeredBy: triggeredBy,
            config: config
        }
    });

    try {
        // Görevi çalıştır
        const result = await taskRegistry.executeTask(taskName, config);

        // Log'u tamamla
        await agentLogs.completeLog(log._id, result);

        // Görev çalışma bilgisini güncelle
        const cronExpr = await getTaskCronExpression(taskName);
        const nextRun = cronExpr ? getNextRunTime(cronExpr) : null;
        await scheduledTasksDB.updateTaskRun(taskName, true, nextRun);

        console.log(`[Scheduler] Görev tamamlandı: ${taskName}`);
        return result;
    } catch (err) {
        // Log'u başarısız olarak işaretle
        await agentLogs.failLog(log._id, err);

        // Görev çalışma bilgisini güncelle
        const cronExpr = await getTaskCronExpression(taskName);
        const nextRun = cronExpr ? getNextRunTime(cronExpr) : null;
        await scheduledTasksDB.updateTaskRun(taskName, false, nextRun);

        console.error(`[Scheduler] Görev hatası: ${taskName}`, err);
        throw err;
    }
}

/**
 * Görevi manuel tetikle
 * @param {string} taskName - Görev adı
 * @param {string} userId - Tetikleyen kullanıcı
 * @returns {Promise<Object>}
 */
async function triggerTask(taskName, userId = null) {
    // Registry'de var mı kontrol et
    if (!taskRegistry.hasTask(taskName)) {
        throw new Error(`Görev bulunamadı: ${taskName}`);
    }

    // Veritabanından konfigürasyonu al
    const taskConfig = await scheduledTasksDB.getTask(taskName);
    const config = taskConfig?.config || {};

    return runTask(taskName, config, {
        triggeredBy: 'manual',
        userId: userId
    });
}

/**
 * Görev cron ifadesini getir
 * @param {string} taskName - Görev adı
 * @returns {Promise<string>}
 */
async function getTaskCronExpression(taskName) {
    const task = await scheduledTasksDB.getTask(taskName);
    return task?.cronExpression || null;
}

/**
 * Sonraki çalışma zamanını hesapla
 * @param {string} cronExpression - Cron ifadesi
 * @returns {Date}
 */
function getNextRunTime(cronExpression) {
    const cronParser = require('node-cron');

    // Basit hesaplama (node-cron next run time desteklemiyor)
    // Bu yüzden manuel hesaplama yapıyoruz
    const now = new Date();
    const parts = cronExpression.split(' ');

    if (parts.length < 5) return new Date(now.getTime() + 60000);

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    // Basit durum: sabit saat ve dakika
    if (!minute.includes('*') && !minute.includes('/') &&
        !hour.includes('*') && !hour.includes('/')) {

        const targetMinute = parseInt(minute);
        const targetHour = parseInt(hour.split(',')[0]); // İlk saati al

        const next = new Date(now);
        next.setHours(targetHour, targetMinute, 0, 0);

        if (next <= now) {
            next.setDate(next.getDate() + 1);
        }

        return next;
    }

    // Varsayılan: 1 gün sonra
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Görevi etkinleştir
 * @param {string} taskName - Görev adı
 */
async function enableTask(taskName) {
    await scheduledTasksDB.setTaskEnabled(taskName, true);
    const task = await scheduledTasksDB.getTask(taskName);
    if (task) {
        scheduleTask(task);
    }
}

/**
 * Görevi devre dışı bırak
 * @param {string} taskName - Görev adı
 */
async function disableTask(taskName) {
    await scheduledTasksDB.setTaskEnabled(taskName, false);
    unscheduleTask(taskName);
}

/**
 * Görev zamanlamasını güncelle
 * @param {string} taskName - Görev adı
 * @param {string} cronExpression - Yeni cron ifadesi
 */
async function updateTaskSchedule(taskName, cronExpression) {
    if (!cron.validate(cronExpression)) {
        throw new Error(`Geçersiz cron ifadesi: ${cronExpression}`);
    }

    await scheduledTasksDB.updateCronExpression(taskName, cronExpression);
    const task = await scheduledTasksDB.getTask(taskName);

    if (task && task.enabled) {
        scheduleTask(task);
    }
}

/**
 * Scheduler durumunu getir
 * @returns {Object}
 */
async function getStatus() {
    const tasks = await scheduledTasksDB.getAllTasks();
    const stats = await scheduledTasksDB.getTaskStats();

    return {
        isRunning,
        initializationComplete,
        activeJobCount: activeJobs.size,
        tasks: tasks.map(t => ({
            name: t.name,
            displayName: t.displayName,
            cronExpression: t.cronExpression,
            enabled: t.enabled,
            lastRun: t.lastRun,
            nextRun: t.nextRun,
            runCount: t.runCount,
            failCount: t.failCount,
            isActive: activeJobs.has(t.name)
        })),
        stats
    };
}

/**
 * Aktif görev listesini getir
 * @returns {Array}
 */
function getActiveJobs() {
    return Array.from(activeJobs.keys());
}

module.exports = {
    start,
    stop,
    scheduleTask,
    unscheduleTask,
    runTask,
    triggerTask,
    enableTask,
    disableTask,
    updateTaskSchedule,
    getStatus,
    getActiveJobs,
    isRunning: () => isRunning
};
