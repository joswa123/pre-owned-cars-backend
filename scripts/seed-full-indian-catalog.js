require('dotenv').config({ override: true });
const sequelize = require('../src/config/database');
const { Brand, Model, Variant } = require('../src/models');

const catalog = [
  {
    name: 'Maruti Suzuki',
    models: [
      { name: 'Swift', body_type: 'Hatchback', variants: [
        { name: 'LXi', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1197, price: 600000 },
        { name: 'VXi', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1197, price: 690000 },
        { name: 'ZXi+', fuel_type: 'Petrol', transmission: 'AMT', engine_cc: 1197, price: 880000 }
      ]},
      { name: 'Brezza', body_type: 'SUV', variants: [
        { name: 'LXi', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1462, price: 834000 },
        { name: 'VXi', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1462, price: 970000 },
        { name: 'ZXi+ AT', fuel_type: 'Petrol', transmission: 'Automatic', engine_cc: 1462, price: 1414000 }
      ]},
      { name: 'Dzire', body_type: 'Sedan', variants: [
        { name: 'LXi', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1197, price: 650000 },
        { name: 'VXi CNG', fuel_type: 'CNG', transmission: 'Manual', engine_cc: 1197, price: 840000 }
      ]},
      { name: 'Ertiga', body_type: 'MUV', variants: [
        { name: 'LXi', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1462, price: 869000 },
        { name: 'VXi CNG', fuel_type: 'CNG', transmission: 'Manual', engine_cc: 1462, price: 1073000 },
        { name: 'ZXi AT', fuel_type: 'Petrol', transmission: 'Automatic', engine_cc: 1462, price: 1230000 }
      ]},
      { name: 'Baleno', body_type: 'Hatchback', variants: [
        { name: 'Sigma', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1197, price: 666000 },
        { name: 'Delta', fuel_type: 'Petrol', transmission: 'AMT', engine_cc: 1197, price: 800000 },
        { name: 'Alpha', fuel_type: 'Petrol', transmission: 'AMT', engine_cc: 1197, price: 988000 }
      ]},
      { name: 'Alto', body_type: 'Hatchback', variants: [
        { name: 'LXi', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 796, price: 354000 },
        { name: 'VXi', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 796, price: 443000 }
      ]},
      { name: 'WagonR', body_type: 'Hatchback', variants: [
        { name: 'LXi 1.0', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 998, price: 554000 },
        { name: 'VXi 1.2', fuel_type: 'Petrol', transmission: 'AMT', engine_cc: 1197, price: 650000 }
      ]},
      { name: 'Fronx', body_type: 'Crossover', variants: [
        { name: 'Sigma 1.2', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1197, price: 751000 },
        { name: 'Zeta 1.0 Turbo', fuel_type: 'Petrol', transmission: 'Automatic', engine_cc: 998, price: 1055000 }
      ]},
      { name: 'Jimny', body_type: 'SUV', variants: [
        { name: 'Zeta', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1462, price: 1274000 },
        { name: 'Alpha AT', fuel_type: 'Petrol', transmission: 'Automatic', engine_cc: 1462, price: 1479000 }
      ]},
      { name: 'Grand Vitara', body_type: 'SUV', variants: [
        { name: 'Sigma', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1462, price: 1087000 },
        { name: 'Zeta+ Hybrid', fuel_type: 'Hybrid', transmission: 'CVT', engine_cc: 1490, price: 1843000 }
      ]}
    ]
  },
  {
    name: 'Hyundai',
    models: [
      { name: 'Creta', body_type: 'SUV', variants: [
        { name: 'E', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1497, price: 1100000 },
        { name: 'EX', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1497, price: 1221000 },
        { name: 'SX (O) Diesel AT', fuel_type: 'Diesel', transmission: 'Automatic', engine_cc: 1493, price: 2000000 }
      ]},
      { name: 'i20', body_type: 'Hatchback', variants: [
        { name: 'Magna', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1197, price: 704000 },
        { name: 'Asta (O) IVT', fuel_type: 'Petrol', transmission: 'CVT', engine_cc: 1197, price: 1120000 }
      ]},
      { name: 'Venue', body_type: 'SUV', variants: [
        { name: 'E 1.2', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1197, price: 794000 },
        { name: 'SX 1.5 CRDi', fuel_type: 'Diesel', transmission: 'Manual', engine_cc: 1493, price: 1237000 }
      ]},
      { name: 'Verna', body_type: 'Sedan', variants: [
        { name: 'EX', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1497, price: 1100000 },
        { name: 'SX (O) Turbo DCT', fuel_type: 'Petrol', transmission: 'DCT', engine_cc: 1482, price: 1742000 }
      ]},
      { name: 'Grand i10 Nios', body_type: 'Hatchback', variants: [
        { name: 'Era', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1197, price: 592000 },
        { name: 'Sportz AMT', fuel_type: 'Petrol', transmission: 'AMT', engine_cc: 1197, price: 785000 }
      ]},
      { name: 'Tucson', body_type: 'SUV', variants: [
        { name: 'Platinum Petrol AT', fuel_type: 'Petrol', transmission: 'Automatic', engine_cc: 1999, price: 2902000 },
        { name: 'Signature Diesel 4WD', fuel_type: 'Diesel', transmission: 'Automatic', engine_cc: 1997, price: 3594000 }
      ]},
      { name: 'Alcazar', body_type: 'SUV', variants: [
        { name: 'Prestige', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1482, price: 1677000 },
        { name: 'Signature (O)', fuel_type: 'Diesel', transmission: 'Automatic', engine_cc: 1493, price: 2128000 }
      ]},
      { name: 'Ioniq 5', body_type: 'SUV', variants: [
        { name: 'RWD Electric', fuel_type: 'Electric', transmission: 'Automatic', engine_cc: 0, price: 4605000 }
      ]}
    ]
  },
  {
    name: 'Tata Motors',
    models: [
      { name: 'Nexon', body_type: 'SUV', variants: [
        { name: 'Smart', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1199, price: 815000 },
        { name: 'Creative DCA', fuel_type: 'Petrol', transmission: 'DCT', engine_cc: 1199, price: 1220000 },
        { name: 'Fearless+ S Diesel AT', fuel_type: 'Diesel', transmission: 'AMT', engine_cc: 1497, price: 1550000 }
      ]},
      { name: 'Punch', body_type: 'SUV', variants: [
        { name: 'Pure', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1199, price: 613000 },
        { name: 'Accomplished Dazzle AMT', fuel_type: 'Petrol', transmission: 'AMT', engine_cc: 1199, price: 885000 },
        { name: 'Empowered+ iCNG', fuel_type: 'CNG', transmission: 'Manual', engine_cc: 1199, price: 985000 }
      ]},
      { name: 'Harrier', body_type: 'SUV', variants: [
        { name: 'Smart', fuel_type: 'Diesel', transmission: 'Manual', engine_cc: 1956, price: 1549000 },
        { name: 'Fearless+ AT', fuel_type: 'Diesel', transmission: 'Automatic', engine_cc: 1956, price: 2644000 }
      ]},
      { name: 'Safari', body_type: 'SUV', variants: [
        { name: 'Smart', fuel_type: 'Diesel', transmission: 'Manual', engine_cc: 1956, price: 1619000 },
        { name: 'Accomplished+ Dark AT', fuel_type: 'Diesel', transmission: 'Automatic', engine_cc: 1956, price: 2734000 }
      ]},
      { name: 'Tiago', body_type: 'Hatchback', variants: [
        { name: 'XE', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1199, price: 565000 },
        { name: 'XT AMT', fuel_type: 'Petrol', transmission: 'AMT', engine_cc: 1199, price: 695000 },
        { name: 'XZ+ Tech Lux EV', fuel_type: 'Electric', transmission: 'Automatic', engine_cc: 0, price: 1189000 }
      ]},
      { name: 'Altroz', body_type: 'Hatchback', variants: [
        { name: 'XE', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1199, price: 665000 },
        { name: 'XZ+ DCA', fuel_type: 'Petrol', transmission: 'DCT', engine_cc: 1199, price: 1000000 }
      ]},
      { name: 'Tigor', body_type: 'Sedan', variants: [
        { name: 'XE', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1199, price: 630000 },
        { name: 'XZ+ iCNG AMT', fuel_type: 'CNG', transmission: 'AMT', engine_cc: 1199, price: 955000 }
      ]},
      { name: 'Curvv', body_type: 'Coupe', variants: [
        { name: 'Creative', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1199, price: 1000000 },
        { name: 'Empowered+ EV', fuel_type: 'Electric', transmission: 'Automatic', engine_cc: 0, price: 2200000 }
      ]}
    ]
  },
  {
    name: 'Mahindra',
    models: [
      { name: 'Thar', body_type: 'SUV', variants: [
        { name: 'AX Opt RWD Hard Top', fuel_type: 'Diesel', transmission: 'Manual', engine_cc: 1497, price: 1135000 },
        { name: 'LX 4WD Hard Top AT', fuel_type: 'Petrol', transmission: 'Automatic', engine_cc: 1997, price: 1700000 },
        { name: 'AX Opt 4-Str Hard Top Diesel', fuel_type: 'Diesel', transmission: 'Manual', engine_cc: 2184, price: 1450000 }
      ]},
      { name: 'XUV700', body_type: 'SUV', variants: [
        { name: 'MX 5-Str', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1999, price: 1399000 },
        { name: 'AX7 L 7-Str Diesel AWD AT', fuel_type: 'Diesel', transmission: 'Automatic', engine_cc: 2179, price: 2699000 }
      ]},
      { name: 'Scorpio-N', body_type: 'SUV', variants: [
        { name: 'Z2 Petrol', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1997, price: 1385000 },
        { name: 'Z8 L Diesel 4WD AT', fuel_type: 'Diesel', transmission: 'Automatic', engine_cc: 2184, price: 2454000 }
      ]},
      { name: 'XUV300', body_type: 'SUV', variants: [
        { name: 'W4', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1197, price: 799000 },
        { name: 'W8 (O) Diesel AMT', fuel_type: 'Diesel', transmission: 'AMT', engine_cc: 1497, price: 1475000 }
      ]},
      { name: 'Bolero', body_type: 'SUV', variants: [
        { name: 'B4', fuel_type: 'Diesel', transmission: 'Manual', engine_cc: 1493, price: 979000 },
        { name: 'B6 (O)', fuel_type: 'Diesel', transmission: 'Manual', engine_cc: 1493, price: 1080000 }
      ]}
    ]
  },
  {
    name: 'Toyota',
    models: [
      { name: 'Innova Crysta', body_type: 'MUV', variants: [
        { name: 'GX 7STR', fuel_type: 'Diesel', transmission: 'Manual', engine_cc: 2393, price: 1999000 },
        { name: 'VX 7STR', fuel_type: 'Diesel', transmission: 'Manual', engine_cc: 2393, price: 2464000 },
        { name: 'ZX 7STR', fuel_type: 'Diesel', transmission: 'Manual', engine_cc: 2393, price: 2630000 }
      ]},
      { name: 'Fortuner', body_type: 'SUV', variants: [
        { name: '4x2 MT Petrol', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 2694, price: 3343000 },
        { name: '4x4 AT Diesel', fuel_type: 'Diesel', transmission: 'Automatic', engine_cc: 2755, price: 4232000 },
        { name: 'Legender 4x4 AT', fuel_type: 'Diesel', transmission: 'Automatic', engine_cc: 2755, price: 4764000 }
      ]},
      { name: 'Urban Cruiser Hyryder', body_type: 'SUV', variants: [
        { name: 'E', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1462, price: 1114000 },
        { name: 'V Strong Hybrid', fuel_type: 'Hybrid', transmission: 'CVT', engine_cc: 1490, price: 1999000 }
      ]},
      { name: 'Glanza', body_type: 'Hatchback', variants: [
        { name: 'E', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1197, price: 686000 },
        { name: 'V AMT', fuel_type: 'Petrol', transmission: 'AMT', engine_cc: 1197, price: 1000000 }
      ]},
      { name: 'Hilux', body_type: 'Pickup', variants: [
        { name: 'STD MT', fuel_type: 'Diesel', transmission: 'Manual', engine_cc: 2755, price: 3040000 },
        { name: 'High AT', fuel_type: 'Diesel', transmission: 'Automatic', engine_cc: 2755, price: 3790000 }
      ]}
    ]
  },
  {
    name: 'Honda',
    models: [
      { name: 'City', body_type: 'Sedan', variants: [
        { name: 'SV', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1498, price: 1182000 },
        { name: 'VX CVT', fuel_type: 'Petrol', transmission: 'CVT', engine_cc: 1498, price: 1500000 },
        { name: 'e:HEV ZX Hybrid', fuel_type: 'Hybrid', transmission: 'CVT', engine_cc: 1498, price: 2055000 }
      ]},
      { name: 'Amaze', body_type: 'Sedan', variants: [
        { name: 'E', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1199, price: 716000 },
        { name: 'VX CVT', fuel_type: 'Petrol', transmission: 'CVT', engine_cc: 1199, price: 986000 }
      ]},
      { name: 'Elevate', body_type: 'SUV', variants: [
        { name: 'SV', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1498, price: 1169000 },
        { name: 'ZX CVT', fuel_type: 'Petrol', transmission: 'CVT', engine_cc: 1498, price: 1643000 }
      ]}
    ]
  },
  {
    name: 'Kia',
    models: [
      { name: 'Seltos', body_type: 'SUV', variants: [
        { name: 'HTE', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1497, price: 1090000 },
        { name: 'GTX+ Turbo DCT', fuel_type: 'Petrol', transmission: 'DCT', engine_cc: 1482, price: 1940000 },
        { name: 'X-Line Diesel AT', fuel_type: 'Diesel', transmission: 'Automatic', engine_cc: 1493, price: 2035000 }
      ]},
      { name: 'Sonet', body_type: 'SUV', variants: [
        { name: 'HTE 1.2', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1197, price: 799000 },
        { name: 'GTX+ Diesel AT', fuel_type: 'Diesel', transmission: 'Automatic', engine_cc: 1493, price: 1575000 }
      ]},
      { name: 'Carens', body_type: 'MUV', variants: [
        { name: 'Premium 1.5', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1497, price: 1052000 },
        { name: 'Luxury Plus Diesel AT', fuel_type: 'Diesel', transmission: 'Automatic', engine_cc: 1493, price: 1950000 }
      ]},
      { name: 'EV6', body_type: 'SUV', variants: [
        { name: 'GT Line AWD', fuel_type: 'Electric', transmission: 'Automatic', engine_cc: 0, price: 6595000 }
      ]}
    ]
  },
  {
    name: 'Volkswagen',
    models: [
      { name: 'Virtus', body_type: 'Sedan', variants: [
        { name: 'Comfortline 1.0 TSI', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 999, price: 1156000 },
        { name: 'GT Plus 1.5 TSI DSG', fuel_type: 'Petrol', transmission: 'DCT', engine_cc: 1498, price: 1915000 }
      ]},
      { name: 'Taigun', body_type: 'SUV', variants: [
        { name: 'Comfortline 1.0 TSI', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 999, price: 1170000 },
        { name: 'GT Edge 1.5 DSG', fuel_type: 'Petrol', transmission: 'DCT', engine_cc: 1498, price: 1974000 }
      ]},
      { name: 'Tiguan', body_type: 'SUV', variants: [
        { name: '2.0 TSI Elegance', fuel_type: 'Petrol', transmission: 'DCT', engine_cc: 1984, price: 3517000 }
      ]}
    ]
  },
  {
    name: 'Skoda',
    models: [
      { name: 'Kushaq', body_type: 'SUV', variants: [
        { name: 'Classic 1.0 TSI', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 999, price: 1089000 },
        { name: 'Monte Carlo 1.5 DSG', fuel_type: 'Petrol', transmission: 'DCT', engine_cc: 1498, price: 1879000 }
      ]},
      { name: 'Slavia', body_type: 'Sedan', variants: [
        { name: 'Classic 1.0 TSI', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 999, price: 1069000 },
        { name: 'Prestige 1.5 DSG', fuel_type: 'Petrol', transmission: 'DCT', engine_cc: 1498, price: 1869000 }
      ]},
      { name: 'Kodiaq', body_type: 'SUV', variants: [
        { name: 'L&K 2.0 TSI', fuel_type: 'Petrol', transmission: 'DCT', engine_cc: 1984, price: 3999000 }
      ]}
    ]
  },
  {
    name: 'BMW',
    models: [
      { name: 'X1', body_type: 'SUV', variants: [
        { name: 'sDrive20i M Sport', fuel_type: 'Petrol', transmission: 'Automatic', engine_cc: 1499, price: 4950000 },
        { name: 'sDrive18d M Sport', fuel_type: 'Diesel', transmission: 'Automatic', engine_cc: 1995, price: 5250000 }
      ]},
      { name: '3 Series', body_type: 'Sedan', variants: [
        { name: '320ld M Sport', fuel_type: 'Petrol', transmission: 'Automatic', engine_cc: 1998, price: 6060000 },
        { name: 'M340i xDrive', fuel_type: 'Petrol', transmission: 'Automatic', engine_cc: 2998, price: 7290000 }
      ]},
      { name: 'X5', body_type: 'SUV', variants: [
        { name: 'xDrive40i xLine', fuel_type: 'Petrol', transmission: 'Automatic', engine_cc: 2998, price: 9600000 },
        { name: 'xDrive30d M Sport', fuel_type: 'Diesel', transmission: 'Automatic', engine_cc: 2993, price: 10900000 }
      ]}
    ]
  },
  {
    name: 'Audi',
    models: [
      { name: 'A4', body_type: 'Sedan', variants: [
        { name: '40 TFSI Premium', fuel_type: 'Petrol', transmission: 'Automatic', engine_cc: 1984, price: 4534000 },
        { name: '40 TFSI Technology', fuel_type: 'Petrol', transmission: 'Automatic', engine_cc: 1984, price: 5350000 }
      ]},
      { name: 'Q3', body_type: 'SUV', variants: [
        { name: '40 TFSI Premium', fuel_type: 'Petrol', transmission: 'Automatic', engine_cc: 1984, price: 4381000 },
        { name: '40 TFSI Technology', fuel_type: 'Petrol', transmission: 'Automatic', engine_cc: 1984, price: 5165000 }
      ]},
      { name: 'Q7', body_type: 'SUV', variants: [
        { name: '55 TFSI Premium Plus', fuel_type: 'Petrol', transmission: 'Automatic', engine_cc: 2995, price: 8692000 }
      ]}
    ]
  },
  {
    name: 'Mercedes-Benz',
    models: [
      { name: 'C-Class', body_type: 'Sedan', variants: [
        { name: 'C 200', fuel_type: 'Petrol', transmission: 'Automatic', engine_cc: 1496, price: 6185000 },
        { name: 'C 220d', fuel_type: 'Diesel', transmission: 'Automatic', engine_cc: 1993, price: 6285000 }
      ]},
      { name: 'E-Class', body_type: 'Sedan', variants: [
        { name: 'E 200 Exclusive', fuel_type: 'Petrol', transmission: 'Automatic', engine_cc: 1991, price: 7605000 },
        { name: 'E 220d Exclusive', fuel_type: 'Diesel', transmission: 'Automatic', engine_cc: 1950, price: 7705000 }
      ]},
      { name: 'GLC', body_type: 'SUV', variants: [
        { name: 'GLC 300 4MATIC', fuel_type: 'Petrol', transmission: 'Automatic', engine_cc: 1999, price: 7590000 },
        { name: 'GLC 220d 4MATIC', fuel_type: 'Diesel', transmission: 'Automatic', engine_cc: 1993, price: 7690000 }
      ]}
    ]
  },
  {
    name: 'Nissan',
    models: [
      { name: 'Magnite', body_type: 'SUV', variants: [
        { name: 'XE 1.0', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 999, price: 600000 },
        { name: 'XV Premium Turbo CVT', fuel_type: 'Petrol', transmission: 'CVT', engine_cc: 999, price: 1111000 }
      ]}
    ]
  },
  {
    name: 'Renault',
    models: [
      { name: 'Kiger', body_type: 'SUV', variants: [
        { name: 'RXE 1.0', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 999, price: 600000 },
        { name: 'RXZ Turbo CVT', fuel_type: 'Petrol', transmission: 'CVT', engine_cc: 999, price: 1123000 }
      ]},
      { name: 'Kwid', body_type: 'Hatchback', variants: [
        { name: 'RXE 1.0', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 999, price: 470000 },
        { name: 'Climber AMT', fuel_type: 'Petrol', transmission: 'AMT', engine_cc: 999, price: 645000 }
      ]},
      { name: 'Triber', body_type: 'MUV', variants: [
        { name: 'RXE', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 999, price: 600000 },
        { name: 'RXZ AMT', fuel_type: 'Petrol', transmission: 'AMT', engine_cc: 999, price: 897000 }
      ]}
    ]
  },
  {
    name: 'Ford',
    models: [
      { name: 'EcoSport', body_type: 'SUV', variants: [
        { name: '1.5 Ti-VCT Ambiente', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1496, price: 819000 },
        { name: '1.5 TDCi Titanium', fuel_type: 'Diesel', transmission: 'Manual', engine_cc: 1498, price: 1000000 }
      ]},
      { name: 'Endeavour', body_type: 'SUV', variants: [
        { name: '2.0 Titanium+ 4x4 AT', fuel_type: 'Diesel', transmission: 'Automatic', engine_cc: 1996, price: 3380000 }
      ]}
    ]
  },
  {
    name: 'Jeep',
    models: [
      { name: 'Compass', body_type: 'SUV', variants: [
        { name: 'Sport 2.0 Diesel', fuel_type: 'Diesel', transmission: 'Manual', engine_cc: 1956, price: 2069000 },
        { name: 'Model S 4x4 AT', fuel_type: 'Diesel', transmission: 'Automatic', engine_cc: 1956, price: 3241000 }
      ]},
      { name: 'Wrangler', body_type: 'SUV', variants: [
        { name: 'Unlimited', fuel_type: 'Petrol', transmission: 'Automatic', engine_cc: 1995, price: 6765000 }
      ]}
    ]
  },
  {
    name: 'MG',
    models: [
      { name: 'Hector', body_type: 'SUV', variants: [
        { name: 'Style 1.5 Turbo', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1451, price: 1399000 },
        { name: 'Savvy Pro 2.0 Diesel', fuel_type: 'Diesel', transmission: 'Manual', engine_cc: 1956, price: 2224000 }
      ]},
      { name: 'ZS EV', body_type: 'SUV', variants: [
        { name: 'Executive', fuel_type: 'Electric', transmission: 'Automatic', engine_cc: 0, price: 1898000 }
      ]}
    ]
  },
  {
    name: 'BYD',
    models: [
      { name: 'Atto 3', body_type: 'SUV', variants: [
        { name: 'Extended Range', fuel_type: 'Electric', transmission: 'Automatic', engine_cc: 0, price: 3399000 }
      ]},
      { name: 'Seal', body_type: 'Sedan', variants: [
        { name: 'Dynamic Range', fuel_type: 'Electric', transmission: 'Automatic', engine_cc: 0, price: 4100000 }
      ]}
    ]
  },
  {
    name: 'Citroën',
    models: [
      { name: 'C3', body_type: 'Hatchback', variants: [
        { name: 'Feel 1.2', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1198, price: 616000 }
      ]},
      { name: 'C3 Aircross', body_type: 'SUV', variants: [
        { name: 'You 1.2 Turbo', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1199, price: 999000 }
      ]}
    ]
  },
  {
    name: 'Other',
    models: [
      { name: 'Other Model', body_type: 'Others', variants: [
        { name: 'Other Variant', fuel_type: 'Petrol', transmission: 'Manual', engine_cc: 1000, price: 0 }
      ]}
    ]
  }
];

const brandLogos = {
  'Maruti Suzuki': 'https://www.carlogos.org/car-logos/suzuki-logo.png',
  'Hyundai': 'https://www.carlogos.org/car-logos/hyundai-logo.png',
  'Tata Motors': 'https://www.carlogos.org/car-logos/tata-logo.png',
  'Mahindra': 'https://www.carlogos.org/car-logos/mahindra-logo.png',
  'Toyota': 'https://www.carlogos.org/car-logos/toyota-logo.png',
  'Honda': 'https://www.carlogos.org/car-logos/honda-logo.png',
  'Kia': 'https://www.carlogos.org/car-logos/kia-logo.png',
  'Audi': 'https://www.carlogos.org/car-logos/audi-logo.png',
  'BMW': 'https://www.carlogos.org/car-logos/bmw-logo.png',
  'Jaguar': 'https://www.carlogos.org/car-logos/jaguar-logo.png',
  'Volkswagen': 'https://www.carlogos.org/car-logos/volkswagen-logo.png',
  'Skoda': 'https://www.carlogos.org/car-logos/skoda-logo.png',
  'Nissan': 'https://www.carlogos.org/car-logos/nissan-logo.png',
  'Renault': 'https://www.carlogos.org/car-logos/renault-logo.png',
  'Ford': 'https://www.carlogos.org/car-logos/ford-logo.png',
  'Jeep': 'https://www.carlogos.org/car-logos/jeep-logo.png',
  'MG': 'https://www.carlogos.org/car-logos/mg-logo.png',
  'BYD': 'https://www.carlogos.org/car-logos/byd-logo.png',
  'Citroën': 'https://www.carlogos.org/car-logos/citroen-logo.png',
  'Mercedes-Benz': 'https://www.carlogos.org/car-logos/mercedes-benz-logo.png'
};

async function seedCatalog() {
  let brandsCreated = 0;
  let modelsCreated = 0;
  let variantsCreated = 0;
  let skipped = 0;

  const transaction = await sequelize.transaction();
  try {
    for (const brandData of catalog) {
      const logoUrl = brandLogos[brandData.name] || '';
      const [brand, brandCreated] = await Brand.findOrCreate({
        where: { name: brandData.name },
        defaults: { name: brandData.name, logo: logoUrl, is_active: true },
        transaction
      });

      if (brandCreated) {
        brandsCreated++;
      } else {
        skipped++;
        if (brand.logo !== logoUrl && logoUrl) {
          await brand.update({ logo: logoUrl }, { transaction });
        }
      }

      for (const modelData of brandData.models) {
        const [model, modelCreated] = await Model.findOrCreate({
          where: { name: modelData.name, brandId: brand.id },
          defaults: {
            name: modelData.name,
            brandId: brand.id,
            body_type: modelData.body_type,
            is_active: true
          },
          transaction
        });

        if (modelCreated) modelsCreated++;
        else skipped++;

        for (const variantData of modelData.variants) {
          const [variant, variantCreated] = await Variant.findOrCreate({
            where: { name: variantData.name, model_id: model.id },
            defaults: {
              name: variantData.name,
              model_id: model.id,
              fuel_type: variantData.fuel_type,
              transmission: variantData.transmission,
              engine_cc: variantData.engine_cc,
              price: variantData.price,
              is_active: true
            },
            transaction
          });

          if (variantCreated) variantsCreated++;
          else skipped++;
        }
      }
    }
    await transaction.commit();
    console.log(`✅ Seeded: ${brandsCreated} brands, ${modelsCreated} models, ${variantsCreated} variants.`);
    console.log(`⚠️ Skipped ${skipped} entries because they already exist.`);
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Failed to seed catalog:', error);
  } finally {
    process.exit(0);
  }
}

seedCatalog();
