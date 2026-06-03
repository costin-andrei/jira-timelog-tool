const { ipcMain, app } = require('electron');
const fs   = require('fs');
const path = require('path');

function getDataDirectory() {
  return app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath();
}

function getLogFilePath() {
  return path.join(getDataDirectory(), 'import-log.jsonl');
}

function register() {
  ipcMain.handle('get-log-path', () => getLogFilePath());

  ipcMain.handle('append-log', async (event, logEntry) => {
    fs.appendFileSync(getLogFilePath(), JSON.stringify(logEntry) + '\n', 'utf-8');
    return { success: true };
  });

  ipcMain.handle('read-logs', async () => {
    const logFilePath = getLogFilePath();
    if (!fs.existsSync(logFilePath)) return { success: true, entries: [] };
    try {
      const entries = fs.readFileSync(logFilePath, 'utf-8')
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line))
        .reverse();
      return { success: true, entries };
    } catch (error) { return { success: false, error: error.message, entries: [] }; }
  });

  ipcMain.handle('clear-logs', async () => {
    fs.writeFileSync(getLogFilePath(), '', 'utf-8');
    return { success: true };
  });
}

module.exports = { register };
