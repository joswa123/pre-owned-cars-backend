'use strict';

require('dotenv').config();
const sequelize = require('../src/config/database');
const { reconcileCarStats } = require('../src/services/analyticsService');
const { Car, CarStat, View, Wishlist, Lead } = require('../src/models');

async function run() {
  console.log('🔄 Starting car_stats Reconciliation & Backfill Script...');

  try {
    await sequelize.authenticate();
    console.log(`✅ Connected to database: ${sequelize.config.database}`);

    const startTime = Date.now();
    const result = await reconcileCarStats();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n========================================`);
    console.log(`📊 RECONCILIATION SUMMARY (${duration}s)`);
    console.log(`========================================`);
    console.log(`Total cars processed: ${result.total}`);
    console.log(`Cars updated / healed: ${result.updated}`);
    console.log(`Drifts detected: ${result.drifts.length}`);

    if (result.drifts.length > 0) {
      console.log(`\nDrift details (first 10 shown):`);
      result.drifts.slice(0, 10).forEach((d, idx) => {
        console.log(`  [${idx + 1}] Car: ${d.car_id}`);
        console.log(`      Before: ${JSON.stringify(d.before)}`);
        console.log(`      After : ${JSON.stringify(d.after)}`);
      });
      if (result.drifts.length > 10) {
        console.log(`  ... and ${result.drifts.length - 10} more cars.`);
      }
    } else {
      console.log(`✅ Zero drift! All car_stats perfectly match live base tables.`);
    }

    // Verify consistency
    const [totalCars, totalStats] = await Promise.all([
      Car.count(),
      CarStat.count(),
    ]);

    console.log(`\nFinal Check:`);
    console.log(`  cars table rows     : ${totalCars}`);
    console.log(`  car_stats table rows: ${totalStats}`);

    if (totalCars === totalStats) {
      console.log(`🎉 SUCCESS: 100% parity achieved between cars and car_stats!`);
    } else {
      console.warn(`⚠️ Parity warning: cars count (${totalCars}) !== car_stats count (${totalStats})`);
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Reconciliation failed:', err);
    process.exit(1);
  }
}

run();
