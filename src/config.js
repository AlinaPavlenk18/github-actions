const fs = require('fs');

// Reads NAME_FILE (Docker/Compose secret) first, falls back to NAME env var.
function readSecret(name) {
  const file = process.env[`${name}_FILE`];
  if (file) {
    return fs.readFileSync(file, 'utf8').trim();
  }
  return process.env[name];
}

module.exports = { readSecret };