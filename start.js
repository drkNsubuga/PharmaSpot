require("@electron/remote/main").initialize();
require("electron-store").initRenderer();
const setupEvents = require("./installers/setupEvents");
if (setupEvents.handleSquirrelEvent()) {
    return;
}
const server = require('./server');
const { app, BrowserWindow, ipcMain, screen} = require("electron");
const path = require("path");
const contextMenu = require("electron-context-menu");
let { Menu, template } = require("./assets/js/native_menu/menu");
const menuController = require('./assets/js/native_menu/menuController.js');
const isPackaged = app.isPackaged;
const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
let mainWindow;
let childWindows = new Map(); // Açık alt pencereleri takip et
let windowCounter = 0; // Pencere numaralandırma

//stop app from launching multiple times during these squirrel spawning events
if (require('electron-squirrel-startup')) app.quit();

function createWindow() {

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    mainWindow = new BrowserWindow({
        width: width,
        height: height,
        frame: true,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
            contextIsolation: false,
        },
    });
    menuController.initializeMainWindow(mainWindow);
    mainWindow.maximize();
    mainWindow.show();

    mainWindow.loadURL(`file://${path.join(__dirname, "index.html")}`);

    mainWindow.on("closed", () => {
        mainWindow = null;
        // Ana pencere kapandığında tüm alt pencereleri kapat
        childWindows.forEach((win) => {
            if (win && !win.isDestroyed()) win.close();
        });
        childWindows.clear();
    });

}

// Çoklu pencere açma fonksiyonu
function createChildWindow(windowType, options = {}) {
    windowCounter++;
    const windowId = `${windowType}-${windowCounter}`;

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    // Pencere boyutları ve başlıkları
    const windowConfigs = {
        'pos': {
            title: `Nakit Satış #${windowCounter}`,
            width: Math.floor(width * 0.8),
            height: Math.floor(height * 0.85),
            page: 'pos-window.html'
        },
        'products': {
            title: `Ürün Listesi #${windowCounter}`,
            width: Math.floor(width * 0.7),
            height: Math.floor(height * 0.8),
            page: 'products-window.html'
        },
        'customers': {
            title: `Müşteri Listesi #${windowCounter}`,
            width: Math.floor(width * 0.6),
            height: Math.floor(height * 0.7),
            page: 'customers-window.html'
        },
        'transactions': {
            title: `İşlem Listesi #${windowCounter}`,
            width: Math.floor(width * 0.75),
            height: Math.floor(height * 0.8),
            page: 'transactions-window.html'
        },
        'categories': {
            title: `Kategoriler #${windowCounter}`,
            width: 600,
            height: 500,
            page: 'categories-window.html'
        },
        'settings': {
            title: 'Ayarlar',
            width: 700,
            height: 600,
            page: 'settings-window.html'
        },
        'new-product': {
            title: `Yeni Ürün #${windowCounter}`,
            width: 600,
            height: 700,
            page: 'new-product-window.html'
        },
        'new-customer': {
            title: `Yeni Müşteri #${windowCounter}`,
            width: 500,
            height: 500,
            page: 'new-customer-window.html'
        }
    };

    const config = windowConfigs[windowType] || {
        title: `Pencere #${windowCounter}`,
        width: 800,
        height: 600,
        page: 'index.html'
    };

    // Cascade pozisyonu (her yeni pencere biraz kaydırılmış açılır)
    const offset = (windowCounter % 10) * 25;

    const childWindow = new BrowserWindow({
        width: config.width,
        height: config.height,
        x: 100 + offset,
        y: 50 + offset,
        parent: null, // Bağımsız pencere (modal değil)
        modal: false,
        frame: true,
        title: config.title,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
            contextIsolation: false,
        },
    });

    childWindow.setTitle(config.title);
    childWindow.loadURL(`file://${path.join(__dirname, 'windows', config.page)}`);

    childWindows.set(windowId, childWindow);

    childWindow.on('closed', () => {
        childWindows.delete(windowId);
    });

    // Pencere ID'sini geri döndür
    return windowId;
}

app.on("browser-window-created", (_, window) => {
    require("@electron/remote/main").enable(window.webContents);
});

app.whenReady().then(() => {
    createWindow();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (mainWindow === null) {
        createWindow();
    }
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});

ipcMain.on("app-quit", (evt, arg) => {
    app.quit();
});

ipcMain.on("app-reload", (event, arg) => {
    mainWindow.reload();
});

ipcMain.on("restart-app", () => {
    autoUpdater.quitAndInstall();
});

// Çoklu pencere açma IPC handler'ları
ipcMain.on("open-window", (event, windowType, options) => {
    const windowId = createChildWindow(windowType, options);
    event.reply("window-opened", windowId);
});

ipcMain.handle("open-window-sync", async (event, windowType, options) => {
    const windowId = createChildWindow(windowType, options);
    return windowId;
});

// Açık pencere listesini al
ipcMain.handle("get-open-windows", async () => {
    const windows = [];
    childWindows.forEach((win, id) => {
        if (win && !win.isDestroyed()) {
            windows.push({ id, title: win.getTitle() });
        }
    });
    return windows;
});

// Belirli bir pencereyi öne getir
ipcMain.on("focus-window", (event, windowId) => {
    const win = childWindows.get(windowId);
    if (win && !win.isDestroyed()) {
        win.focus();
    }
});

// Belirli bir pencereyi kapat
ipcMain.on("close-window", (event, windowId) => {
    const win = childWindows.get(windowId);
    if (win && !win.isDestroyed()) {
        win.close();
    }
});

// API portunu al
ipcMain.handle("get-api-port", async () => {
    return process.env.PORT || '3000';
});

//Context menu
contextMenu({
    prepend: (params, browserWindow) => [
        {
            label: "Yenile",
            click() {
                mainWindow.reload();
            },
        },
    ],
});

//Live reload during development
if (!isPackaged) {
    try {
        require("electron-reloader")(module);
    } catch (_) {}
}


