const { ipcMain } = require('electron');
const { jiraFetch } = require('./jiraFetch');

function buildAuthHeader(user, apiToken) {
  return 'Basic ' + Buffer.from(`${user}:${apiToken}`).toString('base64');
}

function register() {
  ipcMain.handle('test-connection', async (event, credentials) => {
    const { jiraUrl, user, apiToken } = credentials;
    try {
      const response = await jiraFetch(`${jiraUrl}/rest/api/3/myself`, {
        headers: { Authorization: buildAuthHeader(user, apiToken), Accept: 'application/json' },
      });
      if (response.ok) {
        const accountData = await response.json();
        return { success: true, displayName: accountData.displayName || accountData.emailAddress };
      }
      return { success: false, error: `HTTP ${response.status}: ${await response.text()}`.slice(0, 200) };
    } catch (error) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('search-jira-issues', async (event, query, credentials) => {
    const { jiraUrl, user, apiToken } = credentials;
    const searchUrl = `${jiraUrl}/rest/api/3/issue/picker?query=${encodeURIComponent(query)}&currentJQL=&showSubTasks=true&showSubTaskParent=true`;
    try {
      const response = await jiraFetch(searchUrl, {
        headers: { Authorization: buildAuthHeader(user, apiToken), Accept: 'application/json' },
      });
      if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
      const data = await response.json();
      const seenKeys = new Set();
      const issues = [];
      for (const section of (data.sections ?? [])) {
        for (const issue of (section.issues ?? [])) {
          if (!seenKeys.has(issue.key)) {
            seenKeys.add(issue.key);
            issues.push({ key: issue.key, summary: issue.summaryText || issue.summary || '' });
          }
        }
      }
      return { success: true, issues };
    } catch (error) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('send-worklog', async (event, { issueKey, date, timeSpent, credentials }) => {
    const { jiraUrl, user, apiToken } = credentials;
    const requestBody = JSON.stringify({ timeSpent, started: `${date}T09:00:00.000+0000` });
    try {
      const response = await jiraFetch(`${jiraUrl}/rest/api/3/issue/${issueKey}/worklog`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: buildAuthHeader(user, apiToken),
          Accept: 'application/json',
        },
        body: requestBody,
      });
      if (response.status === 201) return { success: true };
      let errorMessage = '';
      try {
        const errorData = await response.json();
        errorMessage = (errorData.errorMessages ?? []).join(', ') || JSON.stringify(errorData);
      } catch { errorMessage = await response.text().catch(() => ''); }
      return { success: false, error: `HTTP ${response.status}: ${errorMessage}`.slice(0, 250) };
    } catch (error) { return { success: false, error: error.message }; }
  });
}

module.exports = { register };
