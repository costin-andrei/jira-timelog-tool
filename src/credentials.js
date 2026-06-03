const { ipcMain, app } = require('electron');
const fs   = require('fs');
const path = require('path');

function getDataDirectory() {
  return app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath();
}

function getEnvFilePath() {
  return path.join(getDataDirectory(), '.env');
}

function parseEnvFile(fileContent) {
  const result = {};
  for (const line of fileContent.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) continue;
    const equalsIndex = trimmedLine.indexOf('=');
    if (equalsIndex === -1) continue;
    result[trimmedLine.slice(0, equalsIndex).trim()] = trimmedLine.slice(equalsIndex + 1).trim();
  }
  return result;
}

function buildEnvFileContent(credentials) {
  return [
    `JIRA_URL=${credentials.jiraUrl   || ''}`,
    `JIRA_USER=${credentials.user      || ''}`,
    `JIRA_API_TOKEN=${credentials.apiToken  || ''}`,
    `UPDATE_URL=${credentials.updateUrl || ''}`,
  ].join('\n') + '\n';
}

function register() {
  ipcMain.handle('save-credentials', async (event, credentials) => {
    fs.writeFileSync(getEnvFilePath(), buildEnvFileContent(credentials), 'utf-8');
    return { success: true };
  });

  ipcMain.handle('load-credentials', async () => {
    const filePath = getEnvFilePath();
    if (!fs.existsSync(filePath)) return null;
    try {
      const parsedEnv = parseEnvFile(fs.readFileSync(filePath, 'utf-8'));
      const credentials = {
        jiraUrl:   parsedEnv['JIRA_URL']       || '',
        user:      parsedEnv['JIRA_USER']      || '',
        apiToken:  parsedEnv['JIRA_API_TOKEN'] || '',
        updateUrl: parsedEnv['UPDATE_URL']     || '',
      };
      return (credentials.jiraUrl || credentials.user || credentials.apiToken) ? credentials : null;
    } catch { return null; }
  });
}

module.exports = { register };
