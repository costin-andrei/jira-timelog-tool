const https = require('https');

const tlsAgent = new https.Agent({ rejectUnauthorized: false });

function jiraFetch(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const request = https.request(
      {
        hostname: parsedUrl.hostname,
        port:     parsedUrl.port || 443,
        path:     parsedUrl.pathname + parsedUrl.search,
        method,
        headers,
        agent: tlsAgent,
      },
      response => {
        let responseBody = '';
        response.on('data', chunk => { responseBody += chunk; });
        response.on('end', () => resolve({
          status: response.statusCode,
          ok:     response.statusCode >= 200 && response.statusCode < 300,
          text:   () => Promise.resolve(responseBody),
          json:   () => Promise.resolve(JSON.parse(responseBody)),
        }));
      }
    );
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

module.exports = { jiraFetch };
