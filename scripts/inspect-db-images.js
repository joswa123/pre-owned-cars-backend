const sequelize = require('../src/config/database');
const { QueryTypes } = require('sequelize');

async function inspectDbImages() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    // 1. Car Images
    const carImages = await sequelize.query(
      'SELECT id, car_id, image_url, is_primary FROM car_images',
      { type: QueryTypes.SELECT }
    );
    console.log(`\n=== Total car_images records: ${carImages.length} ===`);
    let carCloudinary = 0;
    let carLocalDisk = 0;
    let carRenderUrl = 0;
    let carOther = 0;

    const localOrBrokenImages = [];

    for (const img of carImages) {
      const url = img.image_url || '';
      if (url.startsWith('https://res.cloudinary.com')) {
        carCloudinary++;
      } else if (url.includes('pre-owned-cars-backend.onrender.com')) {
        carRenderUrl++;
        localOrBrokenImages.push(img);
      } else if (url.match(/^[a-zA-Z]:[/\\]/) || url.includes('/uploads/') || url.includes('uploads\\') || url.includes('uploads/')) {
        carLocalDisk++;
        localOrBrokenImages.push(img);
      } else {
        carOther++;
        localOrBrokenImages.push(img);
      }
    }

    console.log(`Cloudinary URLs: ${carCloudinary}`);
    console.log(`Render server URLs: ${carRenderUrl}`);
    console.log(`Local disk paths: ${carLocalDisk}`);
    console.log(`Other / Unknown: ${carOther}`);

    if (localOrBrokenImages.length > 0) {
      console.log(`\nSample local/broken car_images (found ${localOrBrokenImages.length}, showing up to 15):`);
      console.log(JSON.stringify(localOrBrokenImages.slice(0, 15), null, 2));
    }

    // 2. Cars table (video_url, audio_url)
    const cars = await sequelize.query(
      'SELECT id, video_url, audio_url FROM cars WHERE video_url IS NOT NULL OR audio_url IS NOT NULL',
      { type: QueryTypes.SELECT }
    );
    console.log(`\n=== Cars with video_url or audio_url: ${cars.length} ===`);
    for (const c of cars) {
      console.log(`Car ${c.id}: video=${c.video_url}, audio=${c.audio_url}`);
    }

    // 3. Check brands logo
    const brands = await sequelize.query(
      'SELECT id, name, logo FROM brands WHERE logo IS NOT NULL',
      { type: QueryTypes.SELECT }
    );
    let brandCloudinary = 0;
    let brandLocal = 0;
    for (const b of brands) {
      if ((b.logo || '').startsWith('https://res.cloudinary.com')) brandCloudinary++;
      else brandLocal++;
    }
    console.log(`\n=== Brands with logo: ${brands.length} (Cloudinary: ${brandCloudinary}, Non-Cloudinary: ${brandLocal}) ===`);
    if (brandLocal > 0) {
      const nonCloudBrands = brands.filter(b => !(b.logo || '').startsWith('https://res.cloudinary.com'));
      console.log('Sample non-Cloudinary brand logos:', nonCloudBrands.slice(0, 5));
    }

    // 4. Check banners image_url
    const banners = await sequelize.query(
      'SELECT id, title, image_url FROM banners',
      { type: QueryTypes.SELECT }
    );
    console.log(`\n=== Banners: ${banners.length} ===`);
    for (const bn of banners) {
      console.log(`Banner ${bn.title || bn.id}: image_url=${bn.image_url}`);
    }

    // 5. Check users profile_picture
    const usersWithPic = await sequelize.query(
      'SELECT id, full_name, profile_picture FROM users WHERE profile_picture IS NOT NULL',
      { type: QueryTypes.SELECT }
    );
    console.log(`\n=== Users with profile_picture: ${usersWithPic.length} ===`);
    let userCloudinary = 0;
    let userLocal = 0;
    for (const u of usersWithPic) {
      if ((u.profile_picture || '').startsWith('https://res.cloudinary.com')) userCloudinary++;
      else userLocal++;
    }
    console.log(`Users Cloudinary: ${userCloudinary}, Non-Cloudinary: ${userLocal}`);
    if (userLocal > 0) {
      const nonCloudUsers = usersWithPic.filter(u => !(u.profile_picture || '').startsWith('https://res.cloudinary.com'));
      console.log('Sample non-Cloudinary users:', nonCloudUsers.slice(0, 5));
    }

    process.exit(0);
  } catch (err) {
    console.error('Inspection failed:', err);
    process.exit(1);
  }
}

inspectDbImages();
