const http = require('http');
const { Pool } = require('pg');
const { isPalindrome } = require('./textUtils.js');
const { readSecret } = require('./config.js');

const port = process.env.PORT || 3000;

let pool;
function getPool() {
  if (!pool) {
    pool = new Pool({
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER,
      database: process.env.PGDATABASE,
      password: readSecret('PGPASSWORD'), 
      max: 2,
      connectionTimeoutMillis: 3000,
    });
  }
  return pool;
}

function sendJson(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  if (req.url === '/health/db') {
    if (!process.env.PGHOST) {
      sendJson(res, 503, { status: 'error', error: 'db_not_configured' });
      return;
    }
    getPool()
      .query('SELECT current_user AS db_user, (SELECT count(*) FROM notes)::int AS notes')
      .then((r) => sendJson(res, 200, {
        status: 'ok',
        db_user: r.rows[0].db_user,
        notes: r.rows[0].notes,
        secret_version: process.env.DB_SECRET_VERSION || 'unknown',
      }))
      .catch((err) => sendJson(res, 503, { status: 'error', error: err.code || 'db_error' }));
    return;
  }

  sendJson(res, 200, {
    service: 'gha-ci-lab',
    version: process.env.APP_VERSION || 'unknown',
    isPalindromeCheck: isPalindrome('racecar'),
  });
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});