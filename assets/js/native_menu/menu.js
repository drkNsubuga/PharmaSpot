const { app, Menu, dialog } = require("electron");
const isMac = process.platform === "darwin";
const { showAbout, checkForUpdates } = require("./menuController");
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
      { label: "Backup" },
      { label: "Restore" },
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
      },
      {
        label: "Send feedback",
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