const { app, dialog} = require("electron");
let mainWindow;
const path = require("path");
const iconPath = path.join(__dirname, "../../../assets/images/favicon.png");
const appVersion = app.getVersion();
const appName = app.getName();
const pkg = require("../../../package.json");
const { appConfig } = require("../../../app.config");
const { autoUpdater } = require("electron-updater");
const unzipper = require('unzipper');
const archiver = require('archiver');
const dbFolderPath = path.join(
  process.env.APPDATA,
  process.env.APPNAME,
  "server",
  "databases"
);
const uploadsFolderPath = path.join(
  process.env.APPDATA,
  process.env.APPNAME,
  "uploads"
);
const fs = require('fs');
const crypto = require('crypto'); 
const isPackaged = app.isPackaged;
const updateServer = appConfig.UPDATE_SERVER;
const updateUrl = `${updateServer}/update/${
  process.platform
}/${app.getVersion()}`;

function showAbout() {
  const options = {
    applicationName: `${appName}`,
    applicationVersion: `v${appVersion}`,
    copyright: `Copyright © ${
      appConfig.COPYRIGHT_YEAR
    }-${new Date().getFullYear()} ${pkg.author}`,
    version: `v${appVersion}`,
    authors: [pkg.author],
    website: pkg.website,
    iconPath: iconPath,
  };
  app.setAboutPanelOptions(options);
  app.showAboutPanel();
}

function getDocs() {}

function sendFeedback() {}

function checkForUpdates() {
  if (!isPackaged) {
    console.log(`Skipping update check in development mode`);
    return;
  }

  const dialogOpts = {
    type: "info",
    buttons: ["Update now", "Later"],
    title: "New version available",
  };

  autoUpdater.setFeedURL({
    provider: "generic",
    url: updateUrl,
  });

  autoUpdater.checkForUpdates();
  autoUpdater.autoDownload = false;

  const handleUpdateAvailable = (info) => {
    const message = `Current version: ${pkg.version}\nNew Version: ${info.version}`;
    dialogOpts.message = message;
    dialogOpts.detail =
      process.platform === "win32" ? releaseNotes : releaseName;

    dialog.showMessageBox(dialogOpts).then((returnValue) => {
      if (returnValue.response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  };

  const handleUpdateNotAvailable = (info) => {
    dialogOpts.type = "info";
    dialogOpts.buttons = ["OK"];
    dialogOpts.title = "No Updates Available";
    dialogOpts.message = `You are using the latest version: ${info.version}`;
    dialog.showMessageBox(dialogOpts);
  };

  const handleUpdateDownloaded = (info) => {
    console.log(`Update downloaded for version ${info.version}`);
    dialogOpts.buttons = ["Install now", "Later"];
    dialogOpts.title = "Ready to Install Update";
    dialogOpts.message = `The update for version ${info.version} is downloaded.\nClick 'Install now' to restart the app and apply the update.`;
    dialog.showMessageBox(dialogOpts).then((returnValue) => {
      if (returnValue.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  };


const handleError = async (err) => {
  try {
    console.error(`Error checking for updates: ${err}`);
    
    const dialogOpts = {
      type: "error",
      title: "Update check failed",
      message: "An error occurred while checking for updates.",
      detail: err,
      buttons: ["Retry", "Cancel"]
    };

    const returnValue = await dialog.showMessageBox(dialogOpts);

    if (returnValue.response === 0) {
      checkForUpdates();
    }
  } catch (error) {
    console.error(`Error in handleError function: ${error}`);
  }
};

  autoUpdater.on("update-available", handleUpdateAvailable);
  autoUpdater.on("update-not-available", handleUpdateNotAvailable);
  autoUpdater.on("update-downloaded", handleUpdateDownloaded);
  autoUpdater.on("error", handleError);
}

/**
 * Backs up all database files in the dbFolderPath folder and the uploads folder to a zip archive at a custom location.
 * Stores the SHA256 hash as a file inside the zip (sha256.txt).
 * @param {string} dbFolderPath - Path to the folder containing all NeDB databases.
 * @param {string} uploadsFolderPath - Path to the uploads folder.
 * @param {string} backupZipPath - Path to save the backup zip file.
 * @returns {Promise<void>}
 */
const createBackup = async (dbFolderPath, uploadsFolderPath, backupZipPath) => {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const output = fs.createWriteStream(backupZipPath);

    output.on('close', async () => {
      // Calculate hash of the zip file
      try {
        const hash = crypto.createHash('sha256');
        const input = fs.createReadStream(backupZipPath);
        input.on('data', chunk => hash.update(chunk));
        input.on('end', async () => {
          const digest = hash.digest('hex');
          // Add sha256.txt to the zip
          const tempZipPath = backupZipPath + '.tmp';
          const tempArchive = archiver('zip', { zlib: { level: 9 } });
          const tempOutput = fs.createWriteStream(tempZipPath);

          tempOutput.on('close', () => {
            // Replace original zip with new zip containing sha256.txt
            fs.renameSync(tempZipPath, backupZipPath);
            resolve();
          });

          tempArchive.on('error', reject);

          tempArchive.pipe(tempOutput);
          tempArchive.append(fs.createReadStream(backupZipPath), { name: 'backup.zip' });
          tempArchive.append(digest, { name: 'sha256.txt' });
          tempArchive.finalize();
        });
      } catch (err) {
        reject(err);
      }
    });

    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(dbFolderPath, 'databases');
    archive.directory(uploadsFolderPath, 'uploads');
    archive.finalize();
  });
}

/**
 * Restores the database and uploads folder from a zip archive to the specified folders.
 * Verifies the SHA256 hash from sha256.txt inside the zip before restoring.
 * @param {string} backupZipPath - Path to the backup zip file.
 * @param {string} dbFolderPath - Path to restore the NeDB data folder.
 * @param {string} uploadsFolderPath - Path to restore the uploads folder.
 * @returns {Promise<void>}
 */
const restoreBackup = async (backupZipPath, dbFolderPath, uploadsFolderPath) => {
  // Read sha256.txt from the zip
  const zip = await unzipper.Open.file(backupZipPath);
  const shaFileEntry = zip.files.find(f => f.path === 'sha256.txt');
  if (!shaFileEntry) throw new Error('SHA256 file not found in backup!');
  const expectedHash = (await shaFileEntry.buffer()).toString().trim();

  // Find backup.zip entry (the actual backup data)
  const backupEntry = zip.files.find(f => f.path === 'backup.zip');
  if (!backupEntry) throw new Error('backup.zip not found in backup!');

  // Calculate hash of backup.zip only (not the whole archive)
  const hash = crypto.createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = backupEntry.stream();
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => {
      const digest = hash.digest('hex');
      if (digest !== expectedHash) {
        reject(new Error('Backup file integrity check failed!'));
      } else {
        resolve();
      }
    });
    stream.on('error', reject);
  });

  // Restore directly from backup.zip stream
  await new Promise((resolve, reject) => {
    backupEntry.stream()
      .pipe(unzipper.Parse())
      .on('entry', entry => {
        let targetPath;
        if (entry.path.startsWith('databases/')) {
          targetPath = path.join(dbFolderPath, entry.path.replace('databases/', ''));
        } else if (entry.path.startsWith('uploads/')) {
          targetPath = path.join(uploadsFolderPath, entry.path.replace('uploads/', ''));
        } else {
          entry.autodrain();
          return;
        }

        // Prevent directory traversal
        const allowedBase = entry.path.startsWith('databases/') ? dbFolderPath : uploadsFolderPath;
        const resolvedPath = path.resolve(targetPath);
        if (!resolvedPath.startsWith(path.resolve(allowedBase))) {
          entry.autodrain();
          throw new Error('Security violation: Attempted directory traversal in backup!');
        }

        // Ensure parent directory exists
        fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
        entry.pipe(fs.createWriteStream(resolvedPath));
      })
      .on('close', resolve)
      .on('error', reject);
  });
}

/**
 * Opens a dialog for the user to select a folder and saves the backup zip there.
 * Adds a timestamp to the backup file name.
 * @param {string} dbFolderPath - Path to the NeDB data folder.
 * @param {string} uploadsFolderPath - Path to the uploads folder.
 */
const saveBackupDialog = async (dbFolderPath, uploadsFolderPath) => {
  // Simple timestamp: YYYYMMDD-HHmmss
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const defaultName = `${process.env.APPNAME}-backup-${timestamp}.zip`;
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Save Database Backup",
    defaultPath: defaultName,
    filters: [{ name: "Zip Files", extensions: ["zip"] }]
  });

  if (!canceled && filePath) {
    try {
      await createBackup(dbFolderPath, uploadsFolderPath, filePath);
      dialog.showMessageBox({
        type: "info",
        title: "Backup Successful",
        message: "Backup saved successfully.",
        detail: `${filePath}`
      });
    } catch (err) {
      dialog.showErrorBox("Backup Failed", err.message || String(err));
    }
  }
};

/**
 * Opens a dialog for the user to select a backup zip file and restores the database and uploads folder.
 * @param {string} dbFolderPath - Path to restore the NeDB data folder.
 * @param {string} uploadsFolderPath - Path to restore the uploads folder.
 */
const restoreBackupDialog = async (dbFolderPath, uploadsFolderPath) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Select Database Backup to Restore",
    filters: [{ name: "Zip Files", extensions: ["zip"] }],
    properties: ["openFile"]
  });

  if (!canceled && filePaths && filePaths[0]) {
    try {
      await restoreBackup(filePaths[0], dbFolderPath, uploadsFolderPath);
      dialog.showMessageBox({
        type: "info",
        title: "Restore Successful",
        message: "Backup restored successfully.",
        detail: filePaths[0]
      });
    } catch (err) {
      dialog.showErrorBox("Restore Failed", err.message || String(err));
    }
  }
};

const initializeMainWindow = (win)=>{
mainWindow = win;
} 

const handleClick = (elementId)=>{
  mainWindow.webContents.send('click-element', elementId);
}

module.exports = {
  showAbout, 
  checkForUpdates, 
  getDocs, 
  sendFeedback,
  initializeMainWindow,
  handleClick,
  dbFolderPath,
  uploadsFolderPath,
  saveBackupDialog,
  restoreBackupDialog
 };