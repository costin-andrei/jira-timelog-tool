const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

const credentials = require('./src/credentials');
const excel = require('./src/excel');
const dialog = require('./src/dialog');
const jira = require('./src/jira');
const logs = require('./src/logs');
const updater = require('./src/updater');

Menu.setApplicationMenu(null);

credentials.register();
excel.register();
dialog.register();
jira.register();
logs.register();
updater.register();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 820, minWidth: 900, minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Jira Worklog Import Tool',
    backgroundColor: '#1a1d23',
  });
  dialog.setWindow(mainWindow);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
