'use strict';

const { randomUUID } = require('crypto');

const slugify = (str) =>
  String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const BIKE_VEHICLE_TYPES = [
  { name: 'Motorcycles', slug: 'motorcycles', order: 1 },
  { name: 'Scooters', slug: 'scooters', order: 2 },
  { name: 'Electric Two-Wheelers', slug: 'electric-two-wheelers', order: 3 },
  { name: 'Superbikes', slug: 'superbikes', order: 4 },
  { name: 'Mopeds & Others', slug: 'mopeds-and-others', order: 5 },
];

const BIKE_BRANDS = [
  'Royal Enfield',
  'Honda',
  'Bajaj',
  'Hero',
  'Yamaha',
  'TVS',
  'Harley-Davidson',
  'Yezdi',
  'BMW',
  'Kawasaki',
  'Revolt',
  'Ducati',
  'Jawa',
  'Benelli',
  'Aprilia',
  'Avanturaa Choppers',
  'BSA',
  'CFMoto',
  'Cleveland CycleWerks',
  'Eider',
  'Emflux Motors',
  'Escorts',
  'Evolet',
  'FB Mondial',
  'Hero Electric',
  'Hop Electric',
  'Husqvarna',
  'Hyosung',
  'Indian',
  'Keeway',
  'LML',
  'Mahindra',
  'Matter',
  'Moto Guzzi',
  'Moto Morini',
  'MV Agusta',
  'Norton',
  'Odysse',
  'Okinawa',
  'OLA',
  'PURE EV',
  'QJ Motor',
  'SWM',
  'Tork',
  'Triumph',
  'UM',
  'Vespa',
  'Victory',
  'Vida',
  'Zontes',
  'Oben',
  'Suzuki',
  'Other Brands',
];

const ROYAL_ENFIELD_MODELS = [
  // Current / Modern
  { name: 'Bullet 350', body_type: 'Motorcycle' },
  { name: 'Bullet 350X', body_type: 'Motorcycle' },
  { name: 'Bullet 350 (2021-2023)', body_type: 'Motorcycle' },
  { name: 'Bullet 350 (2007-2011)', body_type: 'Motorcycle' },
  { name: 'Bullet 350 Bobber', body_type: 'Motorcycle' },
  { name: 'Bullet 350 BS VI', body_type: 'Motorcycle' },
  { name: 'Bullet 350 Twin', body_type: 'Motorcycle' },
  { name: 'Bullet 500', body_type: 'Motorcycle' },
  { name: 'Bullet 650', body_type: 'Motorcycle' },
  { name: 'Bullet Electra 350', body_type: 'Motorcycle' },
  { name: 'Bullet Electra Twinspark', body_type: 'Motorcycle' },
  { name: 'Bullet Trials 350', body_type: 'Motorcycle' },

  { name: 'Classic 350', body_type: 'Motorcycle' },
  { name: 'Classic 350 (2020)', body_type: 'Motorcycle' },
  { name: 'Classic 350 BS VI', body_type: 'Motorcycle' },
  { name: 'Classic 350 Bobber', body_type: 'Motorcycle' },
  { name: 'Classic 350 Dark Series With Dual-Channel', body_type: 'Motorcycle' },
  { name: 'Classic 350 Pegasus', body_type: 'Motorcycle' },
  { name: 'Classic 500', body_type: 'Motorcycle' },
  { name: 'Classic Chrome', body_type: 'Motorcycle' },
  { name: 'Classic Desert Storm', body_type: 'Motorcycle' },
  { name: 'Classic Gunmetal Grey', body_type: 'Motorcycle' },
  { name: 'Classic Signals', body_type: 'Motorcycle' },
  { name: 'Classic Squadron Blue', body_type: 'Motorcycle' },
  { name: 'Classic Stealth Black', body_type: 'Motorcycle' },
  { name: 'Classic 650', body_type: 'Motorcycle' },
  { name: 'Classic', body_type: 'Motorcycle' },

  { name: 'Hunter 350', body_type: 'Motorcycle' },
  { name: 'Meteor 350', body_type: 'Motorcycle' },
  { name: 'Super Meteor 650', body_type: 'Motorcycle' },
  { name: 'Shotgun 650', body_type: 'Motorcycle' },

  { name: 'Himalayan', body_type: 'Adventure' },
  { name: 'Himalayan 450', body_type: 'Adventure' },
  { name: 'Himalayan 650', body_type: 'Adventure' },
  { name: 'Himalayan Electric', body_type: 'Electric Two-Wheeler' },
  { name: 'Himalayan Raid 450', body_type: 'Adventure' },
  { name: 'New Himalayan', body_type: 'Adventure' },
  { name: 'Himalayan 750', body_type: 'Adventure' },
  { name: 'Himalayan 440', body_type: 'Adventure' },

  { name: 'Scram 411', body_type: 'Adventure' },
  { name: 'Scram 440', body_type: 'Adventure' },
  { name: 'Scrambler 450', body_type: 'Adventure' },

  { name: 'Interceptor 650', body_type: 'Motorcycle' },
  { name: 'Interceptor Bear 650', body_type: 'Motorcycle' },
  { name: 'Bear 650', body_type: 'Motorcycle' },
  { name: 'Sherpa 650', body_type: 'Motorcycle' },

  { name: 'Continental GT 535', body_type: 'Motorcycle' },
  { name: 'Continental GT 650', body_type: 'Motorcycle' },
  { name: 'Continental GT 650 (2013-2018)', body_type: 'Motorcycle' },
  { name: 'Continental GT 450', body_type: 'Motorcycle' },
  { name: 'Continental GT', body_type: 'Motorcycle' },

  { name: 'Guerrilla 450', body_type: 'Motorcycle' },
  { name: 'Goan Classic 350', body_type: 'Motorcycle' },
  { name: 'Flying Flea C6', body_type: 'Electric Two-Wheeler' },
  { name: 'Flying Flea S6 Scrambler', body_type: 'Electric Two-Wheeler' },
  { name: 'Roadster 450', body_type: 'Motorcycle' },

  { name: 'Electra 4 S', body_type: 'Motorcycle' },
  { name: 'Electra 5 S', body_type: 'Motorcycle' },
  { name: 'Electra Twinspark', body_type: 'Motorcycle' },
  { name: 'Electra (1995-1997)', body_type: 'Motorcycle' },

  { name: 'Thunderbird 500', body_type: 'Motorcycle' },
  { name: 'Thunderbird 500X', body_type: 'Motorcycle' },
  { name: 'Thunderbird 350', body_type: 'Motorcycle' },
  { name: 'Thunderbird 350X', body_type: 'Motorcycle' },
  { name: 'Thunderbird Twinspark', body_type: 'Motorcycle' },
  { name: 'Thunderbird', body_type: 'Motorcycle' },

  // Older / Legacy
  { name: 'Machismo 350', body_type: 'Motorcycle' },
  { name: 'Machismo 500', body_type: 'Motorcycle' },
  { name: 'Machismo', body_type: 'Motorcycle' },
  { name: 'Crusader', body_type: 'Motorcycle' },
  { name: 'Lightning', body_type: 'Motorcycle' },
  { name: 'Mini Bullet', body_type: 'Motorcycle' },
  { name: 'Superstar', body_type: 'Motorcycle' },
];

const BMW_MODELS = [
  // Sport
  { name: 'G 310 RR', body_type: 'Superbike' },
  { name: 'S 1000 RR', body_type: 'Superbike' },
  // M
  { name: 'M 1000 RR', body_type: 'Superbike' },
  { name: 'M 1000 R', body_type: 'Superbike' },
  { name: 'M 1000 XR', body_type: 'Superbike' },
  // Tour
  { name: 'R 1250 RT', body_type: 'Motorcycle' },
  { name: 'K 1600 GTL', body_type: 'Motorcycle' },
  { name: 'K 1600 B', body_type: 'Motorcycle' },
  // Roadster
  { name: 'G 310 R', body_type: 'Motorcycle' },
  { name: 'F 900 R', body_type: 'Motorcycle' },
  { name: 'S 1000 R', body_type: 'Superbike' },
  { name: 'R 1250 R', body_type: 'Motorcycle' },
  // Heritage
  { name: 'R nineT', body_type: 'Motorcycle' },
  { name: 'R 12', body_type: 'Motorcycle' },
  { name: 'R 18', body_type: 'Motorcycle' },
  // Adventure
  { name: 'G 310 GS', body_type: 'Adventure' },
  { name: 'F 900 GS', body_type: 'Adventure' },
  { name: 'R 1250 GS', body_type: 'Adventure' },
  { name: 'R 1300 GS', body_type: 'Adventure' },
  // Urban Mobility
  { name: 'C 400 GT', body_type: 'Scooter' },
  { name: 'CE 04', body_type: 'Electric Two-Wheeler' },
  { name: 'CE 02', body_type: 'Electric Two-Wheeler' },
];

const OTHER_BRAND_MODELS = {
  'Honda': [
    { name: 'Activa 6G', body_type: 'Scooter' },
    { name: 'Activa 125', body_type: 'Scooter' },
    { name: 'CB Shine', body_type: 'Motorcycle' },
    { name: 'SP 125', body_type: 'Motorcycle' },
    { name: 'Unicorn', body_type: 'Motorcycle' },
    { name: 'Hornet 2.0', body_type: 'Motorcycle' },
    { name: 'Hness CB350', body_type: 'Motorcycle' },
    { name: 'CB350RS', body_type: 'Motorcycle' },
    { name: 'Dio', body_type: 'Scooter' },
  ],
  'Bajaj': [
    { name: 'Pulsar 150', body_type: 'Motorcycle' },
    { name: 'Pulsar NS200', body_type: 'Motorcycle' },
    { name: 'Pulsar N160', body_type: 'Motorcycle' },
    { name: 'Pulsar 220 F', body_type: 'Motorcycle' },
    { name: 'Dominar 400', body_type: 'Motorcycle' },
    { name: 'Platina 100', body_type: 'Motorcycle' },
    { name: 'Avenger Cruise 220', body_type: 'Motorcycle' },
    { name: 'Chetak Electric', body_type: 'Electric Two-Wheeler' },
  ],
  'Hero': [
    { name: 'Splendor Plus', body_type: 'Motorcycle' },
    { name: 'HF Deluxe', body_type: 'Motorcycle' },
    { name: 'Passion Pro', body_type: 'Motorcycle' },
    { name: 'Glamour', body_type: 'Motorcycle' },
    { name: 'Xtreme 160R', body_type: 'Motorcycle' },
    { name: 'XPulse 200 4V', body_type: 'Adventure' },
    { name: 'Pleasure Plus', body_type: 'Scooter' },
    { name: 'Destini 125', body_type: 'Scooter' },
  ],
  'Yamaha': [
    { name: 'R15 V4', body_type: 'Motorcycle' },
    { name: 'MT-15 V2', body_type: 'Motorcycle' },
    { name: 'FZ-S FI', body_type: 'Motorcycle' },
    { name: 'FZX', body_type: 'Motorcycle' },
    { name: 'RayZR 125', body_type: 'Scooter' },
    { name: 'Fascino 125', body_type: 'Scooter' },
    { name: 'Aerox 155', body_type: 'Scooter' },
  ],
  'TVS': [
    { name: 'Apache RTR 160 4V', body_type: 'Motorcycle' },
    { name: 'Apache RTR 200 4V', body_type: 'Motorcycle' },
    { name: 'Apache RR 310', body_type: 'Superbike' },
    { name: 'Raider 125', body_type: 'Motorcycle' },
    { name: 'Jupiter', body_type: 'Scooter' },
    { name: 'NTORQ 125', body_type: 'Scooter' },
    { name: 'iQube Electric', body_type: 'Electric Two-Wheeler' },
    { name: 'XL100 Heavy Duty', body_type: 'Moped & Others' },
  ],
  'Suzuki': [
    { name: 'Access 125', body_type: 'Scooter' },
    { name: 'Burgman Street', body_type: 'Scooter' },
    { name: 'Avenis 125', body_type: 'Scooter' },
    { name: 'Gixxer', body_type: 'Motorcycle' },
    { name: 'Gixxer SF 250', body_type: 'Motorcycle' },
    { name: 'V-Strom SX', body_type: 'Adventure' },
    { name: 'Hayabusa', body_type: 'Superbike' },
  ],
  'Harley-Davidson': [
    { name: 'X440', body_type: 'Motorcycle' },
    { name: 'Street 750', body_type: 'Motorcycle' },
    { name: 'Iron 883', body_type: 'Motorcycle' },
    { name: 'Fat Boy', body_type: 'Superbike' },
  ],
  'Yezdi': [
    { name: 'Roadster', body_type: 'Motorcycle' },
    { name: 'Scrambler', body_type: 'Motorcycle' },
    { name: 'Adventure', body_type: 'Adventure' },
  ],
  'Kawasaki': [
    { name: 'Ninja 300', body_type: 'Superbike' },
    { name: 'Ninja ZX-10R', body_type: 'Superbike' },
    { name: 'Z900', body_type: 'Superbike' },
    { name: 'Vulcan S', body_type: 'Motorcycle' },
  ],
  'Revolt': [
    { name: 'RV400', body_type: 'Electric Two-Wheeler' },
    { name: 'RV400 BRZ', body_type: 'Electric Two-Wheeler' },
  ],
  'Ducati': [
    { name: 'Panigale V4', body_type: 'Superbike' },
    { name: 'Monster', body_type: 'Superbike' },
    { name: 'Scrambler Icon', body_type: 'Motorcycle' },
    { name: 'Multistrada V4', body_type: 'Adventure' },
  ],
  'Jawa': [
    { name: 'Jawa 42', body_type: 'Motorcycle' },
    { name: 'Jawa 42 Bobber', body_type: 'Motorcycle' },
    { name: 'Perak', body_type: 'Motorcycle' },
    { name: '350 Legacy', body_type: 'Motorcycle' },
  ],
  'Benelli': [
    { name: 'Imperiale 400', body_type: 'Motorcycle' },
    { name: 'TRK 502', body_type: 'Adventure' },
    { name: 'Leoncino 500', body_type: 'Motorcycle' },
  ],
  'Aprilia': [
    { name: 'SR 160', body_type: 'Scooter' },
    { name: 'SXR 160', body_type: 'Scooter' },
    { name: 'RS 457', body_type: 'Superbike' },
  ],
  'Avanturaa Choppers': [{ name: 'Rudra', body_type: 'Motorcycle' }],
  'BSA': [{ name: 'Gold Star 650', body_type: 'Motorcycle' }],
  'CFMoto': [{ name: '300NK', body_type: 'Motorcycle' }, { name: '650MT', body_type: 'Adventure' }],
  'Cleveland CycleWerks': [{ name: 'Ace Deluxe', body_type: 'Motorcycle' }],
  'Eider': [{ name: 'Stoic', body_type: 'Motorcycle' }],
  'Emflux Motors': [{ name: 'One', body_type: 'Electric Two-Wheeler' }],
  'Escorts': [{ name: 'Rajdoot Classic', body_type: 'Motorcycle' }],
  'Evolet': [{ name: 'Hawk', body_type: 'Electric Two-Wheeler' }, { name: 'Derby', body_type: 'Electric Two-Wheeler' }],
  'FB Mondial': [{ name: 'HPS 300', body_type: 'Motorcycle' }],
  'Hero Electric': [{ name: 'Optima CX', body_type: 'Electric Two-Wheeler' }, { name: 'NYX HX', body_type: 'Electric Two-Wheeler' }],
  'Hop Electric': [{ name: 'OXO', body_type: 'Electric Two-Wheeler' }, { name: 'Leo', body_type: 'Electric Two-Wheeler' }],
  'Husqvarna': [{ name: 'Vitpilen 250', body_type: 'Motorcycle' }, { name: 'Svartpilen 401', body_type: 'Motorcycle' }],
  'Hyosung': [{ name: 'GT250R', body_type: 'Superbike' }, { name: 'Aquila 250', body_type: 'Motorcycle' }],
  'Indian': [{ name: 'Scout Bobber', body_type: 'Superbike' }, { name: 'Chief Dark Horse', body_type: 'Superbike' }],
  'Keeway': [{ name: 'K300 N', body_type: 'Motorcycle' }, { name: 'V302C', body_type: 'Motorcycle' }],
  'LML': [{ name: 'Star', body_type: 'Scooter' }, { name: 'Freedom', body_type: 'Motorcycle' }],
  'Mahindra': [{ name: 'Mojo 300', body_type: 'Motorcycle' }, { name: 'Gusto 125', body_type: 'Scooter' }],
  'Matter': [{ name: 'Aera 5000', body_type: 'Electric Two-Wheeler' }],
  'Moto Guzzi': [{ name: 'V85 TT', body_type: 'Adventure' }],
  'Moto Morini': [{ name: 'X-Cape 650', body_type: 'Adventure' }],
  'MV Agusta': [{ name: 'Brutale 800', body_type: 'Superbike' }],
  'Norton': [{ name: 'Commando 961', body_type: 'Superbike' }],
  'Odysse': [{ name: 'Vader', body_type: 'Electric Two-Wheeler' }, { name: 'Evoqis', body_type: 'Electric Two-Wheeler' }],
  'Okinawa': [{ name: 'PraisePro', body_type: 'Electric Two-Wheeler' }, { name: 'Ridge+', body_type: 'Electric Two-Wheeler' }],
  'OLA': [
    { name: 'S1 Pro', body_type: 'Electric Two-Wheeler' },
    { name: 'S1 Air', body_type: 'Electric Two-Wheeler' },
    { name: 'S1 X', body_type: 'Electric Two-Wheeler' },
    { name: 'Roadster X', body_type: 'Electric Two-Wheeler' },
  ],
  'PURE EV': [{ name: 'EPluto 7G', body_type: 'Electric Two-Wheeler' }, { name: 'ecoDryft', body_type: 'Electric Two-Wheeler' }],
  'QJ Motor': [{ name: 'SRC 250', body_type: 'Motorcycle' }, { name: 'SRK 400', body_type: 'Motorcycle' }],
  'SWM': [{ name: 'Superdual T', body_type: 'Adventure' }],
  'Tork': [{ name: 'Kratos R', body_type: 'Electric Two-Wheeler' }],
  'Triumph': [
    { name: 'Speed 400', body_type: 'Motorcycle' },
    { name: 'Scrambler 400 X', body_type: 'Adventure' },
    { name: 'Street Triple 765', body_type: 'Superbike' },
    { name: 'Tiger 900', body_type: 'Adventure' },
  ],
  'UM': [{ name: 'Renegade Commando', body_type: 'Motorcycle' }],
  'Vespa': [
    { name: 'VXL 125', body_type: 'Scooter' },
    { name: 'SXL 125', body_type: 'Scooter' },
    { name: 'ZX 125', body_type: 'Scooter' },
    { name: 'Elegante 150', body_type: 'Scooter' },
  ],
  'Victory': [{ name: 'Octane', body_type: 'Motorcycle' }],
  'Vida': [{ name: 'V1 Pro', body_type: 'Electric Two-Wheeler' }, { name: 'V1 Plus', body_type: 'Electric Two-Wheeler' }],
  'Zontes': [{ name: '350R', body_type: 'Motorcycle' }, { name: '350T', body_type: 'Adventure' }],
  'Oben': [{ name: 'Rorr', body_type: 'Electric Two-Wheeler' }],
  'Other Brands': [{ name: 'Other Two-Wheeler Model', body_type: 'Motorcycle' }],
};

module.exports = {
  up: async (queryInterface) => {
    const seq = queryInterface.sequelize;

    // 1. Ensure Bike Category exists
    let [catRows] = await seq.query("SELECT id FROM categories WHERE slug = 'bike' LIMIT 1");
    let bikeCategoryId;
    if (catRows.length > 0) {
      bikeCategoryId = catRows[0].id;
    } else {
      bikeCategoryId = randomUUID();
      await seq.query(
        "INSERT INTO categories (id, name, slug, `order`, is_active, created_at, updated_at) VALUES (:id, 'Bike', 'bike', 2, 1, NOW(), NOW())",
        { replacements: { id: bikeCategoryId } }
      );
    }

    // 2. Ensure Bike Vehicle Types exist under Bike Category
    const typeIds = [];
    for (const vt of BIKE_VEHICLE_TYPES) {
      const [existingType] = await seq.query(
        'SELECT id FROM car_types WHERE slug = :slug LIMIT 1',
        { replacements: { slug: vt.slug } }
      );
      let typeId;
      if (existingType.length > 0) {
        typeId = existingType[0].id;
        await seq.query(
          'UPDATE car_types SET category_id = :catId WHERE id = :id AND category_id IS NULL',
          { replacements: { catId: bikeCategoryId, id: typeId } }
        );
      } else {
        typeId = randomUUID();
        await seq.query(
          'INSERT INTO car_types (id, name, slug, category_id, `order`, is_active, created_at, updated_at) VALUES (:id, :name, :slug, :catId, :order, 1, NOW(), NOW())',
          { replacements: { id: typeId, name: vt.name, slug: vt.slug, catId: bikeCategoryId, order: vt.order } }
        );
      }
      typeIds.push({ id: typeId, slug: vt.slug });
    }

    const defaultBikeTypeId = typeIds[0].id;

    // 3. Upsert all 53 Bike Brands & link to Bike types via brand_types
    const brandMap = {};
    for (const brandName of BIKE_BRANDS) {
      const slug = slugify(brandName);
      const [existingBrand] = await seq.query(
        'SELECT id FROM brands WHERE LOWER(name) = LOWER(:name) OR slug = :slug LIMIT 1',
        { replacements: { name: brandName, slug } }
      );
      let brandId;
      if (existingBrand.length > 0) {
        brandId = existingBrand[0].id;
      } else {
        brandId = randomUUID();
        await seq.query(
          'INSERT INTO brands (id, name, slug, type_id, is_active, created_at, updated_at) VALUES (:id, :name, :slug, :typeId, 1, NOW(), NOW())',
          { replacements: { id: brandId, name: brandName, slug, typeId: defaultBikeTypeId } }
        );
      }
      brandMap[brandName] = brandId;

      // Link brand to Bike vehicle types in brand_types
      for (const t of typeIds) {
        const [pivot] = await seq.query(
          'SELECT id FROM brand_types WHERE brand_id = :brandId AND type_id = :typeId LIMIT 1',
          { replacements: { brandId, typeId: t.id } }
        );
        if (pivot.length === 0) {
          await seq.query(
            'INSERT INTO brand_types (id, brand_id, type_id, created_at, updated_at) VALUES (:id, :brandId, :typeId, NOW(), NOW())',
            { replacements: { id: randomUUID(), brandId, typeId: t.id } }
          );
        }
      }
    }

    // 4. Insert Models for Royal Enfield, BMW, and all remaining brands
    const seedModelsForBrand = async (brandName, modelList) => {
      const brandId = brandMap[brandName];
      if (!brandId || !modelList) return;
      for (const m of modelList) {
        const [existingModel] = await seq.query(
          'SELECT id, category_id FROM models WHERE brand_id = :brandId AND LOWER(name) = LOWER(:name) LIMIT 1',
          { replacements: { brandId, name: m.name } }
        );
        if (existingModel.length > 0) {
          if (!existingModel[0].category_id) {
            await seq.query(
              'UPDATE models SET category_id = :catId, body_type = :bodyType WHERE id = :id',
              { replacements: { catId: bikeCategoryId, bodyType: m.body_type, id: existingModel[0].id } }
            );
          }
        } else {
          await seq.query(
            'INSERT INTO models (id, name, brand_id, category_id, body_type, is_active, created_at, updated_at) VALUES (:id, :name, :brandId, :catId, :bodyType, 1, NOW(), NOW())',
            {
              replacements: {
                id: randomUUID(),
                name: m.name,
                brandId,
                catId: bikeCategoryId,
                bodyType: m.body_type || 'Motorcycle',
              },
            }
          );
        }
      }
    };

    await seedModelsForBrand('Royal Enfield', ROYAL_ENFIELD_MODELS);
    await seedModelsForBrand('BMW', BMW_MODELS);
    for (const [brandName, models] of Object.entries(OTHER_BRAND_MODELS)) {
      await seedModelsForBrand(brandName, models);
    }
  },

  down: async (queryInterface) => {
    const seq = queryInterface.sequelize;
    const [catRows] = await seq.query("SELECT id FROM categories WHERE slug = 'bike' LIMIT 1");
    if (catRows.length > 0) {
      const bikeCategoryId = catRows[0].id;
      await seq.query('DELETE FROM models WHERE category_id = :catId', {
        replacements: { catId: bikeCategoryId },
      });
      await seq.query(
        'DELETE bt FROM brand_types bt JOIN car_types ct ON bt.type_id = ct.id WHERE ct.category_id = :catId',
        { replacements: { catId: bikeCategoryId } }
      );
      await seq.query(
        'DELETE FROM car_types WHERE category_id = :catId AND slug IN (:slugs)',
        { replacements: { catId: bikeCategoryId, slugs: BIKE_VEHICLE_TYPES.map((t) => t.slug) } }
      );
    }
  },
};
