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

  ipcMain.handle('fetch-worklogs', async (event, { from, to, credentials }) => {
    const { jiraUrl, user, apiToken } = credentials;
    const auth = buildAuthHeader(user, apiToken);
    const jql  = `worklogAuthor = currentUser() AND worklogDate >= "${from}" AND worklogDate <= "${to}" ORDER BY key ASC`;

    // Jira expects Unix ms timestamps for the worklog endpoint date filters
    const startedAfter  = new Date(`${from}T00:00:00.000Z`).getTime();
    const startedBefore = new Date(`${to}T23:59:59.999Z`).getTime();

    try {
      // Step 1: collect matching issue keys + summaries (no worklog field needed)
      const allIssues   = [];
      let nextPageToken = undefined;
      let safetyCount   = 0;

      while (true) {
        const reqBody = { jql, fields: ['summary'], maxResults: 50 };
        if (nextPageToken) reqBody.nextPageToken = nextPageToken;

        const response = await jiraFetch(`${jiraUrl}/rest/api/3/search/jql`, {
          method: 'POST',
          headers: { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody),
        });

        if (!response.ok) {
          const text = await response.text();
          return { success: false, error: `HTTP ${response.status}: ${text}`.slice(0, 200) };
        }

        const data = await response.json();
        for (const issue of (data.issues ?? [])) {
          allIssues.push({ key: issue.key, summary: issue.fields?.summary || '' });
        }

        nextPageToken  = data.nextPageToken;
        safetyCount   += (data.issues ?? []).length;
        if (!nextPageToken || !(data.issues ?? []).length || safetyCount >= 500) break;
      }

      // Step 2: fetch worklogs per issue using server-side date filtering
      const allWorklogs = [];

      for (const issue of allIssues) {
        const wlUrl = `${jiraUrl}/rest/api/3/issue/${issue.key}/worklog` +
          `?startedAfter=${startedAfter}&startedBefore=${startedBefore}&maxResults=200`;
        const wlRes = await jiraFetch(wlUrl, {
          headers: { Authorization: auth, Accept: 'application/json' },
        });
        if (!wlRes.ok) continue;

        const wlData = await wlRes.json();
        for (const wl of (wlData.worklogs ?? [])) {
          const wlAuthor = (wl.author?.emailAddress || wl.author?.name || '').toLowerCase();
          if (wlAuthor === user.toLowerCase()) {
            allWorklogs.push({
              issueKey:         issue.key,
              summary:          issue.summary,
              date:             (wl.started || '').slice(0, 10),
              timeSpent:        wl.timeSpent,
              timeSpentSeconds: wl.timeSpentSeconds || 0,
              worklogId:        wl.id,
            });
          }
        }
      }

      allWorklogs.sort((a, b) => a.date.localeCompare(b.date) || a.issueKey.localeCompare(b.issueKey));
      return { success: true, worklogs: allWorklogs };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('delete-worklog', async (event, { issueKey, worklogId, credentials }) => {
    const { jiraUrl, user, apiToken } = credentials;
    try {
      const response = await jiraFetch(
        `${jiraUrl}/rest/api/3/issue/${issueKey}/worklog/${worklogId}`,
        { method: 'DELETE', headers: { Authorization: buildAuthHeader(user, apiToken), Accept: 'application/json' } },
      );
      if (response.status === 204) return { success: true };
      const text = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${text}`.slice(0, 200) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { register };

