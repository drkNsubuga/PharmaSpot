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
    label: "Dosya",
    submenu: [
      {
        label: "Yeni",
        submenu: [
          {
            label: "Ürün",
            click: () => handleClick("newProductModal"),
          },
          {
            label: "Kategori",
            click: () => handleClick("newCategoryModal"),
          },
          {
            label: "Müşteri",
            click: () => handleClick("newCustomerModal"),
          },
        ],
      },
      {
        label: "Yedekle",
        click: ()=>saveBackupDialog(dbFolderPath,uploadsFolderPath)

      },
      { label: "Geri Yükle",
      click: ()=>restoreBackupDialog(dbFolderPath,uploadsFolderPath)
       },
      {
        label: "Çıkış",
        click: () => handleClick("log-out"),
      },
      isMac ? { role: "close" } : { role: "quit" },
    ],
  },
  // { role: 'editMenu' }
  {
    label: "Düzenle",
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
              label: "Konuşma",
              submenu: [{ role: "startSpeaking" }, { role: "stopSpeaking" }],
            },
          ]
        : [{ role: "delete" }, { type: "separator" }, { role: "selectAll" }]),
    ],
  },
  // { role: 'viewMenu' }
  {
    label: "Görünüm",
    submenu: [
      {
        label: "Satış Noktası",
        click: ()=>handleClick('pointofsale')
      },
      {
        label: "İşlemler",
        click: ()=>handleClick('transactions')
      },
      {
        label: "Ürünler",
        click: ()=>handleClick('productModal')
      },
      {
        label: "Ayarlar",
        click: ()=>handleClick('settings')
      },
      { type: "separator" },
      {
        label: "🤖 Agent Paneli",
        click: ()=>handleClick('agent-panel')
      },
      { type: "separator" },
      { label: "Yenile", role: "reload" },
      ...(!app.isPackaged
        ? [{ role: "toggleDevTools", after: ["Yenile"] }]
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
        label: "Dokümantasyon",
        click: () => getDocs(),
      },
      {
        label: "Geri bildirim gönder",
        // click: () => sendFeedBack(),
      },
      { type: "separator" },
      {
        label: "Güncellemeleri kontrol et...",
        click: () => checkForUpdates(),
      },
      { type: "separator" },
      {
        label: `${app.getName()} Hakkında`,
        click: () => showAbout(),
      },
    ],
  },
];

module.exports = { template, Menu };