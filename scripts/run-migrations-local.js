'use strict';

require('dotenv').config();
const sequelize = require('../src/config/database');
const path = require('path');
const fs = require('fs');

async function runMigrations() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database:', sequelize.config.database);

    const queryInterface = sequelize.getQueryInterface();
    const Sequelize = sequelize.Sequelize;

    // Ensure SequelizeMeta exists
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS SequelizeMeta (
        name VARCHAR(255) NOT NULL,
        PRIMARY KEY (name),
        UNIQUE KEY name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
    `);

    const [rows] = await sequelize.query('SELECT name FROM SequelizeMeta');
    const executedMigrations = new Set(rows.map(r => r.name));

    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js')).sort();

    for (const file of files) {
      if (!executedMigrations.has(file)) {
        console.log(`Running migration: ${file}...`);
        const migration = require(path.join(migrationsDir, file));
        if (typeof migration.up === 'function') {
          await migration.up(queryInterface, Sequelize);
          await sequelize.query('INSERT INTO SequelizeMeta (name) VALUES (?)', {
            replacements: [file]
          });
          console.log(`✅ Applied: ${file}`);
        }
      } else {
        console.log(`Skipping already executed: ${file}`);
      }
    }

    console.log('🎉 All migrations applied successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
