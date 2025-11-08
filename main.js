const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Keep a global reference of the window object
let mainWindow;
let serverProcess;

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            webSecurity: false
        },
        icon: path.join(__dirname, 'assets/images/icon.ico'),
        title: 'ASALIFE PharmaSpot - Professional Pharmacy Management',
        show: false,
        frame: true,
        titleBarStyle: 'default'
    });

    // Remove default menu for a cleaner look
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Reload',
                    accelerator: 'F5',
                    click: () => {
                        mainWindow.reload();
                    }
                },
                {
                    label: 'Exit',
                    accelerator: 'Alt+F4',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Toggle Fullscreen',
                    accelerator: 'F11',
                    click: () => {
                        mainWindow.setFullScreen(!mainWindow.isFullScreen());
                    }
                },
                {
                    label: 'Developer Tools',
                    accelerator: 'F12',
                    click: () => {
                        mainWindow.webContents.toggleDevTools();
                    }
                }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About PharmaSpot',
                    click: () => {
                        const { dialog } = require('electron');
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'About PharmaSpot',
                            message: 'ASALIFE PharmaSpot v1.5.1',
                            detail: 'Professional Pharmacy Management System\n\nDeveloped for ASALIFE\nBuilt with Electron & Node.js'
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    // Start the server first
    startServer();

    // Load the main application directly
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    
    // Show window
    mainWindow.show();

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
        if (serverProcess) {
            serverProcess.kill();
        }
    });

    // Handle navigation
    mainWindow.webContents.on('new-window', (event, navigationUrl) => {
        event.preventDefault();
        mainWindow.loadURL(navigationUrl);
    });
}

function startServer() {
    console.log('Starting PharmaSpot server...');
    
    // Start the Node.js server
    serverProcess = spawn('node', ['server.js'], {
        cwd: __dirname,
        stdio: 'pipe'
    });
    
    serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`Server: ${output}`);
    });

    serverProcess.stderr.on('data', (data) => {
        console.error(`Server Error: ${data}`);
    });

    serverProcess.on('error', (err) => {
        console.error('Failed to start server:', err);
    });
}

// App event handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Handle app quit
app.on('before-quit', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
});