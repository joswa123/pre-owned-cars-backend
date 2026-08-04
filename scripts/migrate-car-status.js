const sequelize = require('../src/config/database');

async function migrate() {
  try {
    console.log('🔄 Connecting to database...');
    await sequelize.authenticate();

    console.log('🔄 Adding status column...');
    try {
      await sequelize.query(`ALTER TABLE cars ADD COLUMN status ENUM('sold', 'active', 'deleted', 'expired') NOT NULL DEFAULT 'active';`);
    } catch (e) {
      console.log('ℹ️ status column might already exist:', e.message);
    }

    console.log('🔄 Migrating is_available to status...');
    try {
      await sequelize.query(`UPDATE cars SET status = 'active' WHERE is_available = true;`);
      await sequelize.query(`UPDATE cars SET status = 'deleted' WHERE is_available = false;`);
    } catch (e) {
      console.log('ℹ️ Could not migrate is_available data (might not exist):', e.message);
    }

    console.log('🔄 Dropping is_available column and index...');
    try {
      await sequelize.query(`ALTER TABLE cars DROP INDEX cars_is_available;`);
    } catch (e) {
      console.log('ℹ️ cars_is_available index drop skipped:', e.message);
    }
    try {
      await sequelize.query(`ALTER TABLE cars DROP COLUMN is_available;`);
    } catch (e) {
      console.log('ℹ️ is_available column drop skipped:', e.message);
    }

    console.log('🔄 Dropping buyer_id column and FK...');
    try {
      const [fks] = await sequelize.query(`
        SELECT CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'cars' 
          AND COLUMN_NAME = 'buyer_id' 
          AND REFERENCED_TABLE_NAME IS NOT NULL;
      `);
      for (const fk of fks) {
        await sequelize.query(`ALTER TABLE cars DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\`;`);
      }
    } catch (e) {
      console.log('ℹ️ buyer_id FK drop skipped:', e.message);
    }
    
    try {
      await sequelize.query(`ALTER TABLE cars DROP INDEX cars_buyer_id;`);
    } catch (e) {
      console.log('ℹ️ cars_buyer_id index drop skipped:', e.message);
    }
    try {
      await sequelize.query(`ALTER TABLE cars DROP COLUMN buyer_id;`);
    } catch (e) {
      console.log('ℹ️ buyer_id column drop skipped:', e.message);
    }

    console.log('🔄 Adding status index...');
    try {
      await sequelize.query(`ALTER TABLE cars ADD INDEX cars_status (status);`);
    } catch (e) {
      console.log('ℹ️ status index might already exist:', e.message);
    }

    console.log('✅ Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
