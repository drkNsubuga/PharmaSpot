const {app, dialog,ipcRenderer} = require('electron');
const path = require('path');
const iconPath=path.join(__dirname, '../../../assets/images/favicon.png');
const appVersion = app.getVersion();
const appName= app.getName();
const pkg = require('../../../package.json');
const {configVars} = require('./config');
const { autoUpdater } = require('electron-updater');
const isPackaged = app.isPackaged;
const updateServer = configVars.UPDATE_SERVER;
const updateUrl = `${updateServer}/update/${process.platform}/${app.getVersion()}`


function showAbout()
{
  const options={
    applicationName:`${appName}`,
    applicationVersion:`v${appVersion}`,
    copyright:`Copyright © ${configVars.COPYRIGHT_YEAR}-${new Date().getFullYear()} ${pkg.author}`,
    version:`v${appVersion}`,
    authors:[pkg.author],
    website:pkg.website,
    iconPath:iconPath
  }
  app.setAboutPanelOptions(options)
  app.showAboutPanel()
}

function checkForUpdates() {
const dialogOpts = {
        type: 'info',
        buttons: ['Update now', 'Later'],
        title: 'New version available',
        message: `Current version: v${pkg.version}`,
      }
      dialog.showMessageBox(dialogOpts);
      
  if (isPackaged) {
    autoUpdater.setFeedURL({
      provider: "generic",
      url: updateUrl
    });

        autoUpdater.checkForUpdates();
        autoUpdater.autoDownload=false;

    autoUpdater.on('update-available', (info) => {
            // mainWindow.webContents.send('update_available');
      console.log("Update available: " + info.version);
      const dialogOpts = {
        type: 'info',
        buttons: ['Update now', 'Later'],
        title: 'New version available',
        message: `Current version: ${pkg.version}
                  New Version: ${info.version}
        `,
        detail: process.platform === 'win32' ? releaseNotes : releaseName,
      }

      dialog.showMessageBox(dialogOpts).then((returnValue) => {
        if (returnValue.response === 0) autoUpdater.downloadUpdate()
      })

    });

    autoUpdater.on('update-not-available', (info) => {
            // mainWindow.webContents.send('update_not_available');
      console.log("Update not available: " + info.version);
  
      const dialogOpts = {
        type: 'info',
        // buttons: ['Update now', 'Retry'],
        title: 'Update not available',
        message: `You are using the latest version: ${info.version}`,
      }

      dialog.showMessageBox(dialogOpts)
    });

    autoUpdater.on('update-downloaded', (info) => {
            // mainWindow.webContents.send('update_downloaded');
      console.log("Update downloaded " + info.version);
    });

    autoUpdater.on('error', (err) => {
            // mainWindow.webContents.send('update_error');
      console.error("Error checking for updates: " + err);
      const dialogOpts = {
        type: 'error',
        buttons: ['Retry', 'Cancel'],
        title: 'Update Failed',
        message: "Error checking for updates",
        detail: err
      }

      dialog.showMessageBox(dialogOpts)
    });

        //save a backup of the db
    autoUpdater.on('before-quit-for-update', () => {
            // mainWindow.webContents.send('before_quit_for_update');
    });
  }
}

module.exports={showAbout,checkForUpdates}