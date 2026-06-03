const { ipcMain } = require('electron');
const XLSX = require('xlsx');

function register() {
  ipcMain.handle('read-excel', async (event, filePath) => {
    try {
      const workbook  = XLSX.readFile(filePath, { cellDates: true, dateNF: 'yyyy-mm-dd' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      return {
        success: true,
        data: XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false, dateNF: 'yyyy-mm-dd' }),
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = { register };
