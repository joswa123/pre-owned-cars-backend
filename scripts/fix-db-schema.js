// scripts/fix-db-schema.js
// Run once: node scripts/fix-db-schema.js
//
// Fixes:
//  1. Drops duplicate indexes on `users.phone` that accumulated from repeated
//     sequelize.sync({ alter: true }) calls (ER_TOO_MANY_KEYS / max 64 keys).
//  2. Adds `is_featured` column to `cars` table if missing.
//  3. Fixes `otp_verifications` table: drops it if exists with wrong FK types,
//     then recreates with correct UUID types so Sequelize sync works cleanly.

const dotenv = require('dotenv');
dotenv.config();
const sequelize = require('../src/config/database');

async function run() {
  await sequelize.authenticate();
  console.log('✅ Connected to DB:', process.env.DB_NAME);

  // ── 1. Fix users table: drop all duplicate phone indexes ─────────────────
  console.log('\n🔄 Step 1: Cleaning up duplicate indexes on users.phone...');
  const [indexes] = await sequelize.query(
    "SHOW INDEX FROM users WHERE Column_name = 'phone' AND Key_name != 'PRIMARY';"
  );
  const seen = new Set();
  for (const idx of indexes) {
    const keyName = idx.Key_name;
    if (seen.has(keyName)) continue; // already planned to drop
    seen.add(keyName);
    console.log(`  Dropping index: ${keyName}`);
    try {
      await sequelize.query(`ALTER TABLE users DROP INDEX \`${keyName}\`;`);
      console.log(`  ✅ Dropped index: ${keyName}`);
    } catch (e) {
      console.log(`  ⚠️  Could not drop ${keyName}: ${e.message}`);
    }
  }
  // Re-add one clean unique index
  try {
    await sequelize.query('ALTER TABLE users ADD UNIQUE INDEX `users_phone_unique` (`phone`);');
    console.log('  ✅ Added single clean unique index on phone');
  } catch (e) {
    if (e.message.includes('Duplicate key name')) {
      console.log('  ✅ Unique index already present (no duplicate)');
    } else {
      console.log('  ⚠️  Could not add unique index:', e.message);
    }
  }

  // ── 2. Add is_featured to cars if missing ─────────────────────────────────
  console.log('\n🔄 Step 2: Adding is_featured column to cars (if missing)...');
  const [carCols] = await sequelize.query("SHOW COLUMNS FROM cars LIKE 'is_featured';");
  if (carCols.length === 0) {
    await sequelize.query(
      "ALTER TABLE cars ADD COLUMN `is_featured` TINYINT(1) NOT NULL DEFAULT 0;"
    );
    console.log('  ✅ is_featured column added to cars');
  } else {
    console.log('  ✅ is_featured already exists – no change needed');
  }

  // ── 3. Fix otp_verifications: drop and recreate if FK types are wrong ─────
  console.log('\n🔄 Step 3: Fixing otp_verifications table...');
  const [otpCols] = await sequelize.query("SHOW COLUMNS FROM otp_verifications LIKE 'user_id';").catch(() => [[]]);
  if (otpCols.length > 0 && otpCols[0].Type.toLowerCase().includes('int')) {
    console.log('  ⚠️  user_id is INTEGER – wrong type. Dropping and recreating table...');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    await sequelize.query('DROP TABLE IF EXISTS otp_verifications;');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('  ✅ Dropped otp_verifications (will be recreated by Sequelize sync)');
  } else if (otpCols.length === 0) {
    console.log('  ✅ otp_verifications does not exist yet – Sequelize sync will create it');
  } else {
    console.log('  ✅ otp_verifications.user_id is already correct type:', otpCols[0].Type);
  }

  // ── 4. Verify final car indexes count ─────────────────────────────────────
  console.log('\n🔄 Step 4: Verifying users index count...');
  const [allIdx] = await sequelize.query('SHOW INDEX FROM users;');
  const unique = [...new Set(allIdx.map(r => r.Key_name))];
  console.log(`  Total distinct indexes on users: ${unique.length} (max 64 allowed)`);
  if (unique.length <= 64) {
    console.log('  ✅ Index count is within MySQL limit');
  } else {
    console.log('  ❌ Still too many indexes! Manual cleanup needed.');
  }

  await sequelize.close();
  console.log('\n🎉 Schema fix complete! Now run: npm run dev');
}

run().catch(err => {
  console.error('❌ Fix failed:', err.message);
  process.exit(1);
});
