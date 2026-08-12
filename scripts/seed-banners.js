const { Banner } = require('../src/models');
const sequelize = require('../src/config/database');

const bannerUrls = [
  "https://admindashboard.vandimandi.com/uploads/banners/1778308921.png",
  "https://admindashboard.vandimandi.com/uploads/banners/1778308857.png",
  "https://admindashboard.vandimandi.com/uploads/banners/1778308816.png",
  "https://admindashboard.vandimandi.com/uploads/banners/1778308746.png",
  "https://admindashboard.vandimandi.com/uploads/banners/1778308708.png",
  "https://admindashboard.vandimandi.com/uploads/banners/1778308556.png",
  "https://admindashboard.vandimandi.com/uploads/banners/1778308104.png",
  "https://admindashboard.vandimandi.com/uploads/banners/1778307950.png",
  "https://admindashboard.vandimandi.com/uploads/banners/1778307909.png",
  "https://admindashboard.vandimandi.com/uploads/banners/1778307850.png",
  "https://admindashboard.vandimandi.com/uploads/banners/1778307806.png",
  "https://admindashboard.vandimandi.com/uploads/banners/1778307761.png",
  "https://admindashboard.vandimandi.com/uploads/banners/1778307655.png",
  "https://admindashboard.vandimandi.com/uploads/banners/1778307483.png",
  "https://admindashboard.vandimandi.com/uploads/banners/1778307436.png",
  "https://admindashboard.vandimandi.com/uploads/banners/1778307333.png",
  "https://admindashboard.vandimandi.com/uploads/banners/1778307167.png",
  "https://admindashboard.vandimandi.com/uploads/banners/1778307128.png",
  "https://admindashboard.vandimandi.com/uploads/banners/1778306972.png",
  "https://admindashboard.vandimandi.com/uploads/banners/1778306933.png",
  "https://admindashboard.vandimandi.com/uploads/banners/1778306888.png",
  "https://admindashboard.vandimandi.com/uploads/banners/1778306484.jpg",
  "https://admindashboard.vandimandi.com/uploads/banners/1769497345.png"
];

async function seedBanners() {
  try {
    // Authenticate with DB
    await sequelize.authenticate();
    console.log('Database connected.');

    // Check if banners already exist
    const count = await Banner.count();
    if (count > 0) {
      console.log(`Found ${count} banners already in the database. Skipping seeding to prevent duplication.`);
      process.exit(0);
    }

    console.log('Seeding banners...');
    
    // Seed sequentially to maintain the exact order
    for (let i = 0; i < bannerUrls.length; i++) {
      try {
        await Banner.create({
          image_url: bannerUrls[i],
          order: i,
          is_active: true,
          title: `Initial Banner ${i + 1}`,
        });
        console.log(`Successfully seeded banner ${i + 1}/${bannerUrls.length}`);
      } catch (err) {
        console.error(`Failed to seed banner ${bannerUrls[i]}: ${err.message}`);
        // Continuing on failure as requested (skip gracefully)
      }
    }

    console.log('Banners seeding completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Fatal error during seeding:', err);
    process.exit(1);
  }
}

seedBanners();
