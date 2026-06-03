const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog:      ()          => ipcRenderer.invoke('open-file-dialog'),
  readExcel:           (filePath)  => ipcRenderer.invoke('read-excel', filePath),
  saveCredentials:     (creds)     => ipcRenderer.invoke('save-credentials', creds),
  loadCredentials:     ()          => ipcRenderer.invoke('load-credentials'),
  testConnection:      (creds)     => ipcRenderer.invoke('test-connection', creds),
  sendWorklog:         (data)      => ipcRenderer.invoke('send-worklog', data),
  openExternal:        (url)       => ipcRenderer.invoke('open-external', url),
  searchJiraIssues:    (query, c)  => ipcRenderer.invoke('search-jira-issues', query, c),
  getLogPath:          ()          => ipcRenderer.invoke('get-log-path'),
  appendLog:           (entry)     => ipcRenderer.invoke('append-log', entry),
  readLogs:            ()          => ipcRenderer.invoke('read-logs'),
  clearLogs:           ()          => ipcRenderer.invoke('clear-logs'),
  checkForUpdate:      (url)       => ipcRenderer.invoke('check-for-update', url),
  downloadUpdate:      (url)       => ipcRenderer.invoke('download-update', url),
  openPath:            (filePath)  => ipcRenderer.invoke('open-path', filePath),
  onDownloadProgress:  (cb)        => ipcRenderer.on('download-progress', (_e, pct) => cb(pct)),
  offDownloadProgress: ()          => ipcRenderer.removeAllListeners('download-progress'),
});
