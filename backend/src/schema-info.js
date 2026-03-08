const db = require('./db');

let info = null;

async function detect() {
  if (info) return info;

  // Detect password column name
  const pwdRes = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='users' AND column_name IN ('password_hash','password')
     ORDER BY column_name DESC LIMIT 1`
  );
  const passwordColumn = pwdRes.rows.length ? pwdRes.rows[0].column_name : 'password';

  // Detect role column type and correct admin/user literals
  const roleRes = await db.query(
    `SELECT udt_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='users' AND column_name='role'`
  );
  const roleUdt = roleRes.rows.length ? roleRes.rows[0].udt_name : null;

  let adminRole = 'ADMIN';
  let userRole = 'USER';

  if (roleUdt && roleUdt !== 'role') {
    // varchar/text column — inspect CHECK constraint for expected casing
    const ckRes = await db.query(
      `SELECT pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c
       JOIN pg_class t ON c.conrelid = t.oid
       JOIN pg_namespace n ON t.relnamespace = n.oid
       WHERE n.nspname = 'public' AND t.relname = 'users' AND c.contype = 'c'
         AND pg_get_constraintdef(c.oid) ILIKE '%role%'
       LIMIT 1`
    );
    if (ckRes.rows.length) {
      const def = ckRes.rows[0].def;
      if (def.includes("'admin'")) adminRole = 'admin';
      else if (def.includes("'Admin'")) adminRole = 'Admin';
      if (def.includes("'user'")) userRole = 'user';
      else if (def.includes("'User'")) userRole = 'User';
    }
  }

  // Detect if updated_at column exists
  const updRes = await db.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='users' AND column_name='updated_at'`
  );
  const hasUpdatedAt = updRes.rows.length > 0;

  info = { passwordColumn, adminRole, userRole, hasUpdatedAt };
  return info;
}

module.exports = { detect };
