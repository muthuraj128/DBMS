require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./src/db');
const schemaInfo = require('./src/schema-info');

async function main() {
  const { passwordColumn, adminRole, hasUpdatedAt } = await schemaInfo.detect();
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  const hashed = await bcrypt.hash(password, 10);

  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) {
    const setClause = `${passwordColumn} = $1, role = $2` + (hasUpdatedAt ? ', updated_at = now()' : '');
    await db.query(`UPDATE users SET ${setClause} WHERE email = $3`, [hashed, adminRole, email]);
    console.log('Updated admin:', email);
  } else {
    await db.query(
      `INSERT INTO users(email,name,${passwordColumn},role) VALUES($1,$2,$3,$4)`,
      [email, 'Admin', hashed, adminRole]
    );
    console.log('Created admin:', email);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.pool.end();
  });
