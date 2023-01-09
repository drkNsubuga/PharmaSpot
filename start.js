require('@electron/remote/main').initialize();
require('electron-store').initRenderer();
const setupEvents = require('./installers/setupEvents')
 if (setupEvents.handleSquirrelEvent()) {
    return;
 }
const server = require('./server');
const {app, BrowserWindow, ipcMain} = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const contextMenu = require('electron-context-menu');
let {Menu, template} = require('./assets/js/utils/menu')
let isDev = require('electron-is-dev')




let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 1200,
    frame: true,
    minWidth: 1200, 
    minHeight: 750,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: false,
      contextIsolation: false
    },
  });

  mainWindow.maximize();
  mainWindow.show();

  mainWindow.loadURL(
    `file://${path.join(__dirname, 'index.html')}`
  )

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.once('ready-to-show', () => {
  autoUpdater.checkForUpdatesAndNotify();
});
}

// https://github.com/electron/remote/issues/94#issuecomment-1024849702
app.on('browser-window-created', (_, window) => {
    require("@electron/remote/main").enable(window.webContents);
});

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

ipcMain.on('app-quit', (evt, arg) => {
  app.quit()
})


ipcMain.on('app-reload', (event, arg) => {
  mainWindow.reload();
});

ipcMain.on('app-version', (event) => {
  event.sender.send('app_version', { version: app.getVersion() });
});

ipcMain.on('app-name', (event) => {
  event.sender.send('app_name', { name: app.getName() });
});

ipcMain.on('app-about', (event,mainWindow) => {
  mainWindow.webContents.send('app_about', { name: app.getName() });
});

ipcMain.on('restart-app', () => {
  autoUpdater.quitAndInstall();
});

//auto update application
// mainWindow.on('ready-to-show', () => {
//   autoUpdater.checkForUpdatesAndNotify();
// });

autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update_available');
});

autoUpdater.on('update-not-available', () => {
  mainWindow.webContents.send('update_not_available');
});

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update_downloaded');
});

autoUpdater.on('error', () => {
  mainWindow.webContents.send('update_error');
});

//save a backup of the db
autoUpdater.on('before-quit-for-update', () => {
  mainWindow.webContents.send('before_quit_for_update');
});

//Build menus
contextMenu({
  prepend: (params, browserWindow) => [
     { 
      label: "Refresh", 
        click() {
          mainWindow.reload();
      }
     },
  ]

});

// if(isDev)
// {
// //show developer tools
//       template={...template, ...{ role: 'toggleDevTools',after:['Refresh'] }}
// }

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu)