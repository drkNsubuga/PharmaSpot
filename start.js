require('@electron/remote/main').initialize();
require('electron-store').initRenderer();
const setupEvents = require('./installers/setupEvents')
if (setupEvents.handleSquirrelEvent()) {
    return;
}
const server = require('./server');
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const contextMenu = require('electron-context-menu');
let { Menu, template } = require('./assets/js/utils/menu');
// const { MenuItem } = require('@electron/remote/main');
const isPackaged = app.isPackaged;
const menu = Menu.buildFromTemplate(template);

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

    
}


app.on('browser-window-created', (_, window) => {
    require("@electron/remote/main").enable(window.webContents);
});

// app.on('ready', createWindow)
app.whenReady().then(() => {
  createWindow()
})

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

ipcMain.on('restart-app', () => {
    autoUpdater.quitAndInstall();
});

//Build menus
contextMenu({
    prepend: (params, browserWindow) => [{
        label: "Refresh",
        click() {
            mainWindow.reload();
        }
    }, ]

});

if (!isPackaged) {
    try {
        require('electron-reloader')(module)
    } catch (_) {}
}


Menu.setApplicationMenu(menu)