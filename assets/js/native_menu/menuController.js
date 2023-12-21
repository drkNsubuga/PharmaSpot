const {app, dialog,ipcRenderer} = require('electron');
const path = require('path');
const iconPath=path.join(__dirname, '../../../assets/images/favicon.png');
const appVersion = app.getVersion();
const appName= app.getName();
const pkg = require('../../../package.json');
const {appConfig} = require('../../../app.config');
const { autoUpdater } = require('electron-updater');
const isPackaged = app.isPackaged;
const updateServer = appConfig.UPDATE_SERVER;
const updateUrl = `${updateServer}/update/${process.platform}/${app.getVersion()}`


function showAbout()
{
  const options={
    applicationName:`${appName}`,
    applicationVersion:`v${appVersion}`,
    copyright:`Copyright © ${appConfig.COPYRIGHT_YEAR}-${new Date().getFullYear()} ${pkg.author}`,
    version:`v${appVersion}`,
    authors:[pkg.author],
    website:pkg.website,
    iconPath:iconPath
  }
  app.setAboutPanelOptions(options)
  app.showAboutPanel()
}

function checkForUpdates() {
  if (!isPackaged) {
    console.log(`Skipping update check in development mode`);
    return;
  }

  const dialogOpts = {
    type: 'info',
    buttons: ['Update now', 'Later'],
    title: 'New version available',
  };

  autoUpdater.setFeedURL({
    provider: "generic",
    url: updateUrl
  });

  autoUpdater.checkForUpdates();
  autoUpdater.autoDownload = false;

  const handleUpdateAvailable = (info) => {
    const message = `Current version: ${pkg.version}\nNew Version: ${info.version}`;
    dialogOpts.message = message;
    dialogOpts.detail = process.platform === 'win32' ? releaseNotes : releaseName;

    dialog.showMessageBox(dialogOpts).then((returnValue) => {
      if (returnValue.response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  };

  const handleUpdateNotAvailable = (info) => {
    dialogOpts.type = 'info';
    dialogOpts.buttons = ['OK'];
    dialogOpts.title = 'Update not available';
    dialogOpts.message = `You are using the latest version: ${info.version}`;
    dialog.showMessageBox(dialogOpts);
  };

  const handleUpdateDownloaded = (info) => {
    console.log(`Update downloaded for version ${info.version}`);
    dialogOpts.buttons = ['Install now', 'Later'];
    dialogOpts.title = 'Update downloaded';
    dialogOpts.message = `The update for version ${info.version} is downloaded.
Click Install now to restart the app and apply the update.`;
    dialog.showMessageBox(dialogOpts).then((returnValue) => {
      if (returnValue.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  };

  const handleError = (err) => {
    console.error(`Error checking for updates: ${err}`);
    dialogOpts.type = 'error';
    dialogOpts.message = `Error checking for updates: ${err}`;
    dialog.showMessageBox(dialogOpts);
  };

  autoUpdater.on('update-available', handleUpdateAvailable);
  autoUpdater.on('update-not-available', handleUpdateNotAvailable);
  autoUpdater.on('update-downloaded', handleUpdateDownloaded);
  autoUpdater.on('error', handleError);

  // Implement backup creation for 'before-quit-for-update' event if needed
}

module.exports={showAbout,checkForUpdates}