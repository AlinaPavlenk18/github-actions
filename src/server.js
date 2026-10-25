const http = require('http');
const { isPalindrome } = require('./textUtils.js');

const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    service: 'gha-ci-lab',
    version: process.env.APP_VERSION || 'unknown',
    isPalindromeCheck: isPalindrome('racecar'),
  }));
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});