'use strict';
// One-time cleanup script: hard-deletes all users with is_active = 0
// Run with: node cleanup-deactivated.js

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'defensched.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('\n🔍 Finding deactivated users (is_active = 0)...');
const deactivated = db.prepare("SELECT id, name, email, role FROM users WHERE is_active = 0").all();

if (deactivated.length === 0) {
  console.log('✅ No deactivated users found. Database is clean.\n');
  process.exit(0);
}

console.log(`Found ${deactivated.length} deactivated user(s):`);
deactivated.forEach(u => console.log(`  - [${u.role}] ${u.name} (${u.email}) — ID #${u.id}`));

console.log('\n🗑️  Hard-deleting them...');

const deleteUser = db.transaction((uid) => {
  // Remove panelist entries
  db.prepare('DELETE FROM appointment_panelists WHERE panelist_id = ?').run(uid);
  // Remove appointments where user is student or adviser
  db.prepare('DELETE FROM appointments WHERE student_id = ?').run(uid);
  db.prepare('DELETE FROM appointments WHERE adviser_id = ?').run(uid);
  // Delete user (notifications cascade)
  db.prepare('DELETE FROM users WHERE id = ?').run(uid);
});

let deleted = 0;
for (const u of deactivated) {
  try {
    deleteUser(u.id);
    console.log(`  ✅ Deleted: ${u.name} (ID #${u.id})`);
    deleted++;
  } catch (err) {
    console.error(`  ❌ Failed to delete ${u.name}: ${err.message}`);
  }
}

console.log(`\n✅ Cleanup complete. Deleted ${deleted}/${deactivated.length} users.\n`);
db.close();
