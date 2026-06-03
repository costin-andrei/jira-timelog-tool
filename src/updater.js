const { ipcMain, app, shell } = require('electron');
const { jiraFetch } = require('./jiraFetch');
const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const { spawn } = require('child_process');

function compareVersions(versionA, versionB) {
  const partsA = versionA.split('.').map(Number);
  const partsB = versionB.split('.').map(Number);
  for (let index = 0; index < Math.max(partsA.length, partsB.length); index++) {
    const difference = (partsA[index] ?? 0) - (partsB[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);

function streamToFile(url, destPath, agent, event, redirects) {
  return new Promise((resolve) => {
    if (redirects > 5) { resolve({ success: false, error: 'Too many redirects' }); return; }

    const client = url.startsWith('https') ? https : http;
    const file   = fs.createWriteStream(destPath);

    const req = client.get(url, { agent }, (res) => {
      if (REDIRECT_CODES.has(res.statusCode) && res.headers.location) {
        file.close();
        fs.unlink(destPath, () => {});
        streamToFile(res.headers.location, destPath, agent, event, redirects + 1).then(resolve);
        return;
      }

      const total      = parseInt(res.headers['content-length'] || '0', 10);
      let   downloaded = 0;

      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (total > 0) {
          try { event.sender.send('download-progress', Math.round((downloaded / total) * 100)); }
          catch { /* renderer destroyed */ }
        }
      });

      res.pipe(file);
      file.on('finish', () => { file.close(); resolve({ success: true, filePath: destPath }); });
      file.on('error',  (err) => { fs.unlink(destPath, () => {}); resolve({ success: false, error: err.message }); });
    });

    req.on('error', (err) => { fs.unlink(destPath, () => {}); resolve({ success: false, error: err.message }); });
  });
}

const UPDATE_URL = 'https://raw.githubusercontent.com/costin-andrei/jira-timelog-tool/main';

function register() {
  ipcMain.handle('check-for-update', async (event) => {
    const currentVersion = app.getVersion();
    try {
      const manifestUrl = `${UPDATE_URL}/version.json`;
      const response = await jiraFetch(manifestUrl);
      if (!response.ok) return { available: false, current: currentVersion, error: `HTTP ${response.status}` };
      const manifest = await response.json();
      const isNewer = compareVersions(manifest.version, currentVersion) > 0;
      return {
        available:   isNewer,
        current:     currentVersion,
        latest:      manifest.version,
        downloadUrl: manifest.downloadUrl,
        notes:       manifest.notes,
      };
    } catch (error) {
      return { available: false, current: currentVersion, error: error.message };
    }
  });

  ipcMain.handle('download-update', async (event, downloadUrl) => {
    const destPath = path.join(os.tmpdir(), 'JiraTimeline-update.zip');
    const agent    = new https.Agent({ rejectUnauthorized: false });
    return streamToFile(downloadUrl, destPath, agent, event, 0);
  });

  ipcMain.handle('apply-update', async (_event, zipPath) => {
    if (!app.isPackaged) {
      return { success: false, error: 'Cannot auto-update in development mode' };
    }

    const appDir  = path.dirname(process.execPath);
    const exePath = process.execPath;

    const psScript = `
param([string]$ZipPath, [string]$AppDir, [string]$ExePath)
Start-Sleep -Seconds 3
try {
  Expand-Archive -Path $ZipPath -DestinationPath $AppDir -Force
  Start-Process -FilePath $ExePath
} finally {
  Remove-Item -Path $ZipPath -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
  Remove-Item -LiteralPath $MyInvocation.MyCommand.Path -Force -ErrorAction SilentlyContinue
}
`.trimStart();

    const scriptPath = path.join(os.tmpdir(), 'jira-timelog-update.ps1');
    fs.writeFileSync(scriptPath, psScript, 'utf8');

    spawn('powershell.exe', [
      '-WindowStyle', 'Hidden',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath,
      '-ZipPath', zipPath,
      '-AppDir', appDir,
      '-ExePath', exePath,
    ], { detached: true, stdio: 'ignore' }).unref();

    app.quit();
  });

  ipcMain.handle('open-path', async (_event, filePath) => {
    await shell.openPath(filePath);
  });
}

module.exports = { register };
