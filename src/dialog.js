const { ipcMain, dialog, shell } = require('electron');

let mainWindow = null;

function setWindow(browserWindow) { mainWindow = browserWindow; }

function register() {
  ipcMain.handle('open-file-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Spreadsheets', extensions: ['xlsx', 'xls', 'csv'] },
        { name: 'All Files',    extensions: ['*'] },
      ],
    });
    return canceled || filePaths.length === 0 ? null : filePaths[0];
  });

  ipcMain.handle('open-external', async (event, url) => {
    await shell.openExternal(url);
  });
}

module.exports = { register, setWindow };
