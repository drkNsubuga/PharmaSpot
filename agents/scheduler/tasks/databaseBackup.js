/**
 * Veritabanı Yedekleme Görevi
 * Veritabanı dosyalarını otomatik yedekler
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const notifications = require('../../notifications');

const copyFile = promisify(fs.copyFile);
const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);

const appName = process.env.APPNAME;
const appData = process.env.APPDATA;
const databasesPath = path.join(appData, appName, "server", "databases");
const backupsPath = path.join(appData, appName, "backups");

/**
 * Veritabanı yedekleme yap
 * @param {Object} config - Görev konfigürasyonu
 * @returns {Promise<Object>} Sonuç
 */
async function execute(config = {}) {
    const keepBackups = config.keepBackups || 7;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(backupsPath, `backup_${timestamp}`);

    try {
        // Backup klasörünü oluştur
        await mkdir(backupsPath, { recursive: true });
        await mkdir(backupDir, { recursive: true });

        // Veritabanı dosyalarını listele
        const files = await readdir(databasesPath);
        const dbFiles = files.filter(f => f.endsWith('.db'));

        const backedUpFiles = [];
        const failedFiles = [];

        // Her dosyayı yedekle
        for (const file of dbFiles) {
            const sourcePath = path.join(databasesPath, file);
            const destPath = path.join(backupDir, file);

            try {
                await copyFile(sourcePath, destPath);
                const fileStat = await stat(destPath);
                backedUpFiles.push({
                    name: file,
                    size: fileStat.size,
                    path: destPath
                });
            } catch (err) {
                failedFiles.push({
                    name: file,
                    error: err.message
                });
            }
        }

        // Eski yedekleri temizle
        const cleanupResult = await cleanupOldBackups(keepBackups);

        const result = {
            timestamp: new Date().toISOString(),
            backupPath: backupDir,
            totalFiles: dbFiles.length,
            backedUpCount: backedUpFiles.length,
            failedCount: failedFiles.length,
            backedUpFiles: backedUpFiles,
            failedFiles: failedFiles,
            totalSize: backedUpFiles.reduce((sum, f) => sum + f.size, 0),
            cleanedBackups: cleanupResult.removed,
            success: failedFiles.length === 0
        };

        // Bildirim gönder
        notifications.backupNotification(result.success, backupDir);

        return result;
    } catch (err) {
        notifications.backupNotification(false);
        throw err;
    }
}

/**
 * Eski yedekleri temizle
 * @param {number} keepCount - Tutulacak yedek sayısı
 * @returns {Promise<Object>} Temizleme sonucu
 */
async function cleanupOldBackups(keepCount) {
    try {
        const entries = await readdir(backupsPath);
        const backupDirs = [];

        for (const entry of entries) {
            if (entry.startsWith('backup_')) {
                const entryPath = path.join(backupsPath, entry);
                const entryStat = await stat(entryPath);
                if (entryStat.isDirectory()) {
                    backupDirs.push({
                        name: entry,
                        path: entryPath,
                        created: entryStat.birthtime
                    });
                }
            }
        }

        // Tarihe göre sırala (yeniden eskiye)
        backupDirs.sort((a, b) => b.created - a.created);

        // Silinecek yedekleri belirle
        const toDelete = backupDirs.slice(keepCount);
        const removed = [];

        for (const dir of toDelete) {
            try {
                await deleteDirectory(dir.path);
                removed.push(dir.name);
            } catch (err) {
                console.error(`Yedek silinirken hata: ${dir.name}`, err);
            }
        }

        return {
            total: backupDirs.length,
            kept: Math.min(keepCount, backupDirs.length),
            removed: removed
        };
    } catch (err) {
        console.error('Yedek temizleme hatası:', err);
        return { total: 0, kept: 0, removed: [] };
    }
}

/**
 * Klasörü sil (içindeki dosyalarla birlikte)
 * @param {string} dirPath - Klasör yolu
 */
async function deleteDirectory(dirPath) {
    const entries = await readdir(dirPath);

    for (const entry of entries) {
        const entryPath = path.join(dirPath, entry);
        const entryStat = await stat(entryPath);

        if (entryStat.isDirectory()) {
            await deleteDirectory(entryPath);
        } else {
            await unlink(entryPath);
        }
    }

    await promisify(fs.rmdir)(dirPath);
}

/**
 * Mevcut yedekleri listele
 * @returns {Promise<Array>} Yedek listesi
 */
async function listBackups() {
    try {
        const entries = await readdir(backupsPath);
        const backups = [];

        for (const entry of entries) {
            if (entry.startsWith('backup_')) {
                const entryPath = path.join(backupsPath, entry);
                const entryStat = await stat(entryPath);
                if (entryStat.isDirectory()) {
                    // Klasördeki dosyaları say
                    const files = await readdir(entryPath);
                    let totalSize = 0;
                    for (const file of files) {
                        const fileStat = await stat(path.join(entryPath, file));
                        totalSize += fileStat.size;
                    }

                    backups.push({
                        name: entry,
                        path: entryPath,
                        created: entryStat.birthtime,
                        fileCount: files.length,
                        totalSize: totalSize
                    });
                }
            }
        }

        return backups.sort((a, b) => b.created - a.created);
    } catch (err) {
        return [];
    }
}

/**
 * Görev meta bilgileri
 */
const meta = {
    name: 'databaseBackup',
    displayName: 'Veritabanı Yedekleme',
    description: 'Veritabanı dosyalarını otomatik yedekler',
    defaultCron: '0 3 * * *',
    configSchema: {
        keepBackups: { type: 'number', default: 7, min: 1, max: 30 },
        compressBackups: { type: 'boolean', default: true }
    }
};

module.exports = { execute, meta, listBackups };
