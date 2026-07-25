const { Pool } = require('pg');

function createPool() {
  return new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
  });
}

async function initSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      text TEXT NOT NULL
    )
  `);
}

async function addNote(pool, text) {
  const result = await pool.query('INSERT INTO notes (text) VALUES ($1) RETURNING id', [text]);
  return result.rows[0].id;
}

async function getNotes(pool) {
  const result = await pool.query('SELECT id, text FROM notes ORDER BY id');
  return result.rows;
}

module.exports = { createPool, initSchema, addNote, getNotes };