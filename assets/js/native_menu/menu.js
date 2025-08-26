const { app, Menu, dialog } = require("electron");
const isMac = process.platform === "darwin";
const {
  showAbout,
  checkForUpdates,
  // sendFeedback,
  getDocs,
  handleClick,
  saveBackupDialog,
  restoreBackupDialog,
  dbFolderPath,
  uploadsFolderPath
} = require("./menuController");
const template = [
  ...(isMac
    ? [
        {
          label: app.name,
          submenu: [
            { role: "about" },
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        },
      ]
    : []),

  {
    label: "File",
    submenu: [
      {
        label: "New",
        submenu: [
          {
            label: "Product",
            click: () => handleClick("newProductModal"),
          },
          {
            label: "Category",
            click: () => handleClick("newCategoryModal"),
          },
          {
            label: "Customer",
            click: () => handleClick("newCustomerModal"),
          },
        ],
      },
      { 
        label: "Backup",
        click: ()=>saveBackupDialog(dbFolderPath,uploadsFolderPath)

      },
      { label: "Restore",
      click: ()=>restoreBackupDialog(dbFolderPath,uploadsFolderPath)
       },
      {
        label: "Logout",
        click: () => handleClick("log-out"),
      },
      isMac ? { role: "close" } : { role: "quit" },
    ],
  },
  // { role: 'editMenu' }
  {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      ...(isMac
        ? [
            { role: "pasteAndMatchStyle" },
            { role: "delete" },
            { role: "selectAll" },
            { type: "separator" },
            {
              label: "Speech",
              submenu: [{ role: "startSpeaking" }, { role: "stopSpeaking" }],
            },
          ]
        : [{ role: "delete" }, { type: "separator" }, { role: "selectAll" }]),
    ],
  },
  // { role: 'viewMenu' }
  {
    label: "View",
    submenu: [
      { 
        label: "Point of Sale",
        click: ()=>handleClick('pointofsale')
      },
      { 
        label: "Transactions",
        click: ()=>handleClick('transactions')
      },
      { 
        label: "Products",
        click: ()=>handleClick('productModal')
      },
      { 
        label: "Settings",
        click: ()=>handleClick('settings')
      },
      { type: "separator" },
      { label: "Refresh", role: "reload" },
      ...(!app.isPackaged
        ? [{ role: "toggleDevTools", after: ["Refresh"] }]
        : []),
      { type: "separator" },
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
    ],
  },
  // { role: 'helpMenu' }

  {
    role: "Help",
    submenu: [
      {
        label: "Documentation",
        click: () => getDocs(),
      },
      {
        label: "Send feedback",
        // click: () => sendFeedBack(),
      },
      { type: "separator" },
      {
        label: "Check for updates...",
        click: () => checkForUpdates(),
      },
      { type: "separator" },
      {
        label: `About ${app.getName()}`,
        click: () => showAbout(),
      },
    ],
  },
];

module.exports = { template, Menu };