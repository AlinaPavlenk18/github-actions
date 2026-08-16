require('dotenv').config();
const { createPool, initSchema, addNote, getNotes } = require('../../src/notesRepo.js');

async function run() {
  const pool = createPool();
  await initSchema(pool);
  await addNote(pool, 'Hello from integration test');
  const notes = await getNotes(pool);

  if (notes.length === 0 || notes[notes.length - 1].text !== 'Hello from integration test') {
    console.error('FAILED: integration test — note was not saved correctly');
    process.exit(1);
  }

  console.log('PASSED: integration test — note saved and retrieved');
  await pool.end();
}

run().catch((err) => {
  console.error('Integration test crashed:', err);
  process.exit(1);
});