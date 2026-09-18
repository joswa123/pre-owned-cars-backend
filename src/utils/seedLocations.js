const { State, District, City } = require('../models');
const logger = require('./logger');

// ─── Location Seeder Data (All 28 States + 8 UTs of India) ────────────────────
const locationTree = {
  'Tamil Nadu': {
    code: 'TN',
    districts: {
      'Coimbatore': [
        'Coimbatore', 'Gandhipuram', 'RS Puram', 'Peelamedu', 'Saravanampatti', 'Singanallur', 
        'Saibaba Colony', 'Thudiyalur', 'Ganapathy', 'Vadavalli', 'Kuniyamuthur', 'Kovaipudur', 
        'Ramanathapuram', 'Ondipudur', 'Sulur', 'Pollachi', 'Mettupalayam', 'Annur', 
        'Kinathukadavu', 'Valparai', 'Madukkarai', 'Karumathampatti', 'Kalapatti', 
        'Malumichampatti', 'Periyanaickenpalayam', 'Narasimhanaickenpalayam', 'Vellalore', 
        'Irugur', 'Sirumugai', 'Negamam', 'Alandurai', 'Chettipalayam', 'Othakkalmandapam', 
        'Kavundampalayam', 'Tatabad', 'Race Course', 'Ram Nagar', 'Siddhapudur', 'Ukkadam', 
        'Sundarapuram', 'Podanur', 'Vilankurichi', 'Perur', 'Eachanari', 'Chinnavedampatti', 
        'Neelambur', 'Kurichi', 'Telungupalayam', 'Veerakeralam', 'Thondamuthur', 'Karamadai', 
        'Vedapatti', 'Pooluvapatti', 'Thenkarai', 'Anamalai', 'Kottur', 'Samathur', 
        'Suleeswaranpatti', 'Zamin Uthukuli', 'Senjerimalai', 'Sultanpet'
      ],
      'Chennai': [
        'Chennai', 'T. Nagar', 'Anna Nagar', 'Adyar', 'Velachery', 'Guindy', 'Tambaram', 
        'Porur', 'Nungambakkam', 'Mylapore', 'Alwarpet', 'Kodambakkam', 'Vadapalani', 
        'Sholinganallur', 'Thoraipakkam', 'Karapakkam', 'Navalur', 'Kelambakkam', 'Pallavaram', 
        'Chromepet', 'Medavakkam', 'Perungudi', 'Thiruvanmiyur', 'Kottivakkam', 'Palavakkam', 
        'Neelankarai', 'Injambakkam', 'Kilpauk', 'Egmore', 'Royapettah', 'Saidapet', 
        'Mogappair', 'Ambattur', 'Avadi', 'Poonamallee', 'Madipakkam', 'Keelkattalai', 
        'Nanganallur', 'Royapuram', 'Tondiarpet', 'Perambur', 'Kolathur', 'Villivakkam', 
        'Ashok Nagar', 'KK Nagar', 'Valasaravakkam', 'Virugambakkam', 'Alandur', 'Pallikaranai', 
        'Semmancheri', 'Siruseri', 'Urapakkam', 'Vandalur', 'Guduvanchery'
      ],
      'Tiruppur': [
        'Tiruppur', 'Avinashi', 'Palladam', 'Dharapuram', 'Kangeyam', 'Udumalaipettai', 
        'Uthukuli', 'Vellakoil', 'Madathukulam', 'Veerapandi', 'Nallur', 'Chettipalayam (Tiruppur)', 
        '15 Velampalayam', 'Mangalam', 'Pongalur', 'Kundadam', 'Kaniyur', 'Mulanur', 
        'Komaralingam', 'Samalapuram', 'Chinnakkampalayam', 'Rudravathi', 'Kannivadi (Tiruppur)'
      ],
      'Erode': [
        'Erode', 'Perundurai', 'Gobichettipalayam', 'Bhavani', 'Sathyamangalam', 'Anthiyur', 
        'Kodumudi', 'Modakkurichi', 'Chennimalai', 'Nambiyur', 'Sivagiri', 'Chithode', 
        'Thindal', 'Veerappanchatram', 'Kasipalayam', 'Surampatti', 'Brahmana Periya Agraharam', 
        'Appakudal', 'Olagadam', 'Ammapettai (Erode)', 'Bhavanisagar', 'Kanjikoil', 'Kollankoil', 
        'Pasur', 'Periyasemur', 'Venkampatti', 'Arachalur', 'Kuhalur', 'P. Mettupalayam'
      ],
      'Salem': [
        'Salem', 'Fairlands', 'Hasthampatti', 'Suramangalam', 'Ammapet', 'Shevapet', 
        'Attur', 'Mettur', 'Omalur', 'Edappadi', 'Sankagiri', 'Thammampatti', 
        'Jalakandapuram', 'Mecheri', 'Vazhapadi', 'Ayothiapattinam', 'Kannankurichi', 
        'Pethanaickenpalayam', 'Tharamangalam', 'Nangavalli', 'Kolathur (Salem)', 'Veeraganur', 
        'Mallur', 'Panamarathupatti', 'Kadayampatti', 'Gangavalli', 'Sentharappatti', 
        'Thedavur', 'Konganapuram', 'Poolampatti', 'Avadattur', 'Karamandurai'
      ],
      'Madurai': [
        'Madurai', 'Anna Nagar (Madurai)', 'KK Nagar (Madurai)', 'Goripalayam', 'Mattuthavani', 'Simmakkal', 
        'Thirunagar', 'Teppakulam', 'Melur', 'Thirumangalam', 'Usilampatti', 'Vadipatti', 
        'Sholavandan', 'Alanganallur', 'Othakadai', 'Samayanallur', 'Paravai', 'Avaniyapuram', 
        'Villapuram', 'Tirupparankunram', 'Kochadai', 'Pasumalai', 'Anaiyur', 'Harveypatti', 
        'Kalligudi', 'Peraiyur', 'Sedapatti', 'Chekkanurani', 'T. Kallupatti', 'Elumalai', 'Palamedu'
      ],
      'Tiruchirappalli': [
        'Tiruchirappalli', 'Trichy', 'Thillai Nagar', 'Cantonment', 'Srirangam', 'K.K. Nagar (Trichy)', 
        'Woraiyur', 'Ponmalai', 'Golden Rock', 'Kattur', 'Thuvakudi', 'Lalgudi', 
        'Manapparai', 'Musiri', 'Thottiyam', 'Thuraiyur', 'Samayapuram', 'Vayalur', 
        'Tiruverumbur', 'Manachanallur', 'Uppiliapuram', 'Marungapuri', 'Pullambadi', 
        'Kattuputhur', 'Sirugamani', 'Balakrishnampatti'
      ],
      'Dindigul': [
        'Dindigul', 'Palani', 'Kodaikanal', 'Oddanchatram', 'Natham', 'Nilakottai', 
        'Vedasandur', 'Batlagundu', 'Ayakudi', 'Balasamudram', 'Chinnalapatti', 
        'Kannivadi', 'Keeranur', 'Neikkarappatti', 'Palayam', 'Pannaikadu', 
        'Pattiveeranpatti', 'Sevugampatti', 'Sithayankottai', 'Vadamadurai', 'Guziliamparai'
      ],
      'Namakkal': [
        'Namakkal', 'Tiruchengode', 'Rasipuram', 'Paramathi Velur', 'Komarapalayam', 
        'Sendamangalam', 'Kolli Hills', 'Mohanur', 'Kabilarmalai', 'Puduchatram', 
        'Erumapatti', 'Vennandur', 'Mallasamudram', 'Padaiveedu', 'Pandamangalam', 
        'Pillanallur', 'Pothanur', 'R.Pudupatti', 'Seerapalli', 'Alampalayam'
      ],
      'Karur': [
        'Karur', 'Kulithalai', 'Aravakurichi', 'Manmangalam', 'Pugalur', 'Krishnarayapuram', 
        'Kadavur', 'Inam Karur', 'Thanthoni', 'Puliyur', 'Uppidamangalam', 'Nangavaram', 
        'Marudur', 'Palanichettipatti', 'Punjaipugalur', 'TNPL Pugalur'
      ],
      'Krishnagiri': [
        'Krishnagiri', 'Hosur', 'Pochampalli', 'Uthangarai', 'Denkanikottai', 'Bargur', 
        'Shoolagiri', 'Kelamangalam', 'Kaveripattinam', 'Mathur', 'Anchetty', 
        'Rayakottai', 'Berigai', 'Bagalur', 'Nagojanahalli'
      ],
      'Dharmapuri': [
        'Dharmapuri', 'Harur', 'Palacode', 'Pennagaram', 'Pappireddipatti', 'Karimangalam', 
        'Morappur', 'Marandahalli', 'Kambainallur', 'B.Mallapuram', 'Kadathur', 'Papparapatti'
      ],
      'Vellore': [
        'Vellore', 'Katpadi', 'Gudiyatham', 'Anaicut', 'Konavattam', 'Sathuvachari', 
        'Thorapadi', 'Dharapadavedu', 'Shenbakkam', 'Pennathur', 'Allapuram', 
        'Virinjipuram', 'Pallikonda', 'Odugathur', 'Kaniyambadi'
      ],
      'Ranipet': [
        'Ranipet', 'Walajapet', 'Arcot', 'Arakkonam', 'Sholinghur', 'Nemili', 
        'Kalavai', 'Thakkolam', 'Panapakkam', 'Melvisharam', 'Timiri', 'Kaverypakkam'
      ],
      'Tirupathur': [
        'Tirupathur', 'Vaniyambadi', 'Ambur', 'Natrampalli', 'Jolarpet', 'Yelagiri', 
        'Alangayam', 'Madhanur'
      ],
      'Tiruvannamalai': [
        'Tiruvannamalai', 'Arani', 'Cheyyar', 'Polur', 'Chengam', 'Vandavasi', 
        'Kilpennathur', 'Kalasapakkam', 'Jawadhu Hills', 'Peranamallur', 'Desur', 
        'Chetpet', 'Vettavalam', 'Kannamangalam', 'Pudupalayam'
      ],
      'Kanchipuram': [
        'Kanchipuram', 'Sriperumbudur', 'Walajabad', 'Uthiramerur', 'Kundrathur', 
        'Sunguvarchatram', 'Pillaiyarpatti', 'Tenambakkam', 'Sevilimedu', 'Ayyampettai'
      ],
      'Chengalpattu': [
        'Chengalpattu', 'Tambaram South', 'Pallavaram', 'Chromepet', 'Mahabalipuram', 
        'Mamallapuram', 'Madurantakam', 'Cheyyur', 'Tirukalukundram', 'Kelambakkam', 
        'Thiruporur', 'Guduvanchery', 'Maraimalai Nagar', 'Singaperumal Koil', 'Vandalur', 
        'Urapakkam', 'Padappai', 'Anupuram', 'Acharapakkam', 'Kalpakkam'
      ],
      'Tiruvallur': [
        'Tiruvallur', 'Avadi', 'Poonamallee', 'Ambattur', 'Ponneri', 'Gummidipoondi', 
        'Tiruttani', 'Uthukkottai', 'Pallipattu', 'RK Pet', 'Minjur', 'Naravarikuppam', 
        'Thiruninravur', 'Thirumazhisai', 'Manavalanagar', 'Arani (Tiruvallur)'
      ],
      'Cuddalore': [
        'Cuddalore', 'Chidambaram', 'Panruti', 'Vridhachalam', 'Neyveli', 'Tittakudi', 
        'Kattumannarkoil', 'Kurinjipadi', 'Bhuvanagiri', 'Srimushnam', 'Pennadam', 
        'Annamalai Nagar', 'Lalpet', 'Parangipettai', 'Porto Novo', 'Gangaikondan'
      ],
      'Viluppuram': [
        'Viluppuram', 'Tindivanam', 'Gingee', 'Marakkanam', 'Vanur', 'Vikravandi', 
        'Kandachipuram', 'Valavanur', 'Ananthapuram', 'Tiruvennainallur'
      ],
      'Kallakurichi': [
        'Kallakurichi', 'Sankarapuram', 'Chinnasalem', 'Ulundurpet', 'Tirukkoyilur', 
        'Kalvarayan Hills', 'Rishivandiyam', 'Thiagadurgam', 'Manalurpet', 'Vadakkanandal'
      ],
      'Thanjavur': [
        'Thanjavur', 'Kumbakonam', 'Pattukkottai', 'Orathanadu', 'Thiruvaiyaru', 
        'Peravurani', 'Budalur', 'Thiruvidaimarudur', 'Papanasam', 'Vallam', 
        'Adirampattinam', 'Madukkar', 'Swamimalai', 'Dharasuram'
      ],
      'Mayiladuthurai': [
        'Mayiladuthurai', 'Sirkazhi', 'Tharangambadi', 'Kuthalam', 'Poompuhar', 
        'Vaitheeswarankoil', 'Manalmedu', 'Sembanarkoil'
      ],
      'Nagapattinam': [
        'Nagapattinam', 'Velankanni', 'Vedaranyam', 'Kilvelur', 'Thirukkuvalai', 
        'Nagore', 'Thalaignayiru'
      ],
      'Tiruvarur': [
        'Tiruvarur', 'Mannargudi', 'Thiruthuraipoondi', 'Needamangalam', 'Kodavasal', 
        'Valangaiman', 'Nannilam', 'Muthupet', 'Koradacherry', 'Peralam'
      ],
      'Pudukkottai': [
        'Pudukkottai', 'Aranthangi', 'Illuppur', 'Alangudi', 'Gandarvakottai', 
        'Kulathur', 'Ponnamaravathi', 'Thirumayam', 'Avudaiyarkoil', 'Manamelkudi', 
        'Viralimalai', 'Karambakkudi', 'Annavasal', 'Keeramangalam'
      ],
      'Ariyalur': [
        'Ariyalur', 'Udayarpalayam', 'Sendurai', 'Andimadam', 'Jayankondam', 
        'Varadarajanpettai'
      ],
      'Perambalur': [
        'Perambalur', 'Kunnam', 'Veppanthattai', 'Alathur', 'Poolambadi', 
        'Kurumbalur', 'Labbaikudikadu'
      ],
      'Sivaganga': [
        'Sivaganga', 'Karaikudi', 'Devakottai', 'Manamadurai', 'Tiruppattur (Sivaganga)', 
        'Kalaiyarkovil', 'Ilayangudi', 'Singampunari', 'Kanadukathan', 'Kottaiyur', 
        'Pallathur', 'Puduvayal', 'Nerkuppai'
      ],
      'Ramanathapuram': [
        'Ramanathapuram', 'Rameswaram', 'Paramakudi', 'Kilakarai', 'Mudukulathur', 
        'Kamuthi', 'Tiruvadanai', 'Kadaladi', 'R.S. Mangalam', 'Mandapam', 
        'Sayalgudi', 'Abiramam', 'Thondi'
      ],
      'Virudhunagar': [
        'Virudhunagar', 'Sivakasi', 'Rajapalayam', 'Srivilliputhur', 'Aruppukkottai', 
        'Sattur', 'Watrap', 'Vembakottai', 'Kariapatti', 'Tiruchuli', 'Seithur', 
        'Mamsapuram', 'Sundarapandiam', 'Chettiarpatti'
      ],
      'Theni': [
        'Theni', 'Periyakulam', 'Bodinayakanur', 'Uthamapalayam', 'Cumbum', 
        'Chinnamanur', 'Andipatti', 'Gudalur (Theni)', 'Devadanapatti', 'Kamayagoundanpatti', 
        'Kuchanur', 'Kombai', 'Markayankottai', 'Pannaipuram', 'Thamaraikulam', 'Veerapandi (Theni)'
      ],
      'Tirunelveli': [
        'Tirunelveli', 'Palayamkottai', 'Ambasamudram', 'Cheranmahadevi', 'Nanguneri', 
        'Radhapuram', 'Manur', 'Tisayanvilai', 'Kalakkad', 'Mukkudal', 'Vikramasingapuram', 
        'Kallidaikurichi', 'Alwarkurichi', 'Gopalasamudram', 'Melaseval', 'Panagudi', 'Vadakkuvalliyur'
      ],
      'Tenkasi': [
        'Tenkasi', 'Sankarankovil', 'Courtallam', 'Kadayanallur', 'Puliyangudi', 
        'Shenkottai', 'Alangulam (Tenkasi)', 'Thiruvengadam', 'Veerakeralampudur', 
        'Surandai', 'Ilangi', 'Sundarapandiapuram', 'Achanpudur', 'Rayagiri', 'Sivagiri (Tenkasi)'
      ],
      'Thoothukudi': [
        'Thoothukudi', 'Tuticorin', 'Kovilpatti', 'Tiruchendur', 'Kayathar', 
        'Ottapidaram', 'Srivaikuntam', 'Vilathikulam', 'Ettayapuram', 'Sathankulam', 
        'Arumuganeri', 'Authoor', 'Eral', 'Kadambur', 'Kalugumalai', 'Kanam', 
        'Nazareth', 'Perungulam', 'Udangudi'
      ],
      'Kanyakumari': [
        'Nagercoil', 'Kanyakumari', 'Marthandam', 'Padmanabhapuram', 'Colachel', 
        'Kuzhithurai', 'Thuckalay', 'Killiyoor', 'Vilavancode', 'Thiruvattar', 
        'Agastheeswaram', 'Boothapandi', 'Eraniel', 'Karungal', 'Kulasekharam', 
        'Manavalakurichi', 'Mulagumoodu', 'Mundakkal', 'Pazhugal', 'Suchindram', 
        'Thiruvithamcode', 'Vadasery'
      ],
      'Nilgiris': [
        'Ooty', 'Udhagamandalam', 'Coonoor', 'Kotagiri', 'Gudalur (Nilgiris)', 
        'Wellington', 'Aruvankadu', 'Devala', 'Naduvattam', 'Ketti', 
        'Hubbathala', 'Jagathala', 'Adikaratti', 'Bikkatty', 'O\'Valley'
      ]
    }
  },
  'Kerala': {
    code: 'KL',
    districts: {
      'Thiruvananthapuram': ['Thiruvananthapuram', 'Neyyattinkara'],
      'Ernakulam': ['Kochi', 'Aluva', 'Muvattupuzha'],
      'Kozhikode': ['Kozhikode', 'Vatakara'],
      'Thrissur': ['Thrissur', 'Chalakudy'],
      'Kollam': ['Kollam', 'Punalur'],
      'Kannur': ['Kannur', 'Thalassery'],
      'Alappuzha': ['Alappuzha', 'Cherthala'],
      'Palakkad': ['Palakkad', 'Ottapalam']
    }
  },
  'Karnataka': {
    code: 'KA',
    districts: {
      'Bengaluru Urban': ['Bengaluru', 'Electronic City', 'Whitefield'],
      'Mysuru': ['Mysuru', 'Nanjangud'],
      'Dharwad': ['Hubli', 'Dharwad'],
      'Dakshina Kannada': ['Mangaluru', 'Puttur'],
      'Belagavi': ['Belagavi', 'Chikkodi'],
      'Shivamogga': ['Shivamogga', 'Bhadravathi'],
      'Tumakuru': ['Tumakuru', 'Sira']
    }
  },
  'Andhra Pradesh': {
    code: 'AP',
    districts: {
      'Visakhapatnam': ['Visakhapatnam', 'Anakapalle'],
      'NTR': ['Vijayawada'],
      'Guntur': ['Guntur', 'Tenali'],
      'Tirupati': ['Tirupati', 'Srikalahasti'],
      'Kurnool': ['Kurnool', 'Adoni'],
      'SPSR Nellore': ['Nellore', 'Kavali']
    }
  },
  'Telangana': {
    code: 'TS',
    districts: {
      'Hyderabad': ['Hyderabad', 'Secunderabad'],
      'Hanamkonda': ['Warangal', 'Hanamkonda'],
      'Karimnagar': ['Karimnagar'],
      'Nizamabad': ['Nizamabad'],
      'Khammam': ['Khammam']
    }
  },
  'Maharashtra': {
    code: 'MH',
    districts: {
      'Mumbai City': ['Mumbai', 'South Mumbai'],
      'Pune': ['Pune', 'Pimpri-Chinchwad'],
      'Nagpur': ['Nagpur'],
      'Nashik': ['Nashik'],
      'Chhatrapati Sambhajinagar': ['Aurangabad'],
      'Kolhapur': ['Kolhapur'],
      'Solapur': ['Solapur'],
      'Thane': ['Thane', 'Kalyan', 'Navi Mumbai']
    }
  },
  'Gujarat': {
    code: 'GJ',
    districts: {
      'Ahmedabad': ['Ahmedabad', 'Sanand'],
      'Surat': ['Surat'],
      'Vadodara': ['Vadodara'],
      'Rajkot': ['Rajkot'],
      'Bhavnagar': ['Bhavnagar'],
      'Jamnagar': ['Jamnagar']
    }
  },
  'Delhi': {
    code: 'DL',
    districts: {
      'New Delhi': ['New Delhi'],
      'North Delhi': ['North Delhi'],
      'South Delhi': ['South Delhi'],
      'East Delhi': ['East Delhi'],
      'West Delhi': ['West Delhi']
    }
  },
  'Rajasthan': {
    code: 'RJ',
    districts: {
      'Jaipur': ['Jaipur'],
      'Jodhpur': ['Jodhpur'],
      'Udaipur': ['Udaipur'],
      'Ajmer': ['Ajmer'],
      'Kota': ['Kota'],
      'Bikaner': ['Bikaner']
    }
  },
  'Punjab': {
    code: 'PB',
    districts: {
      'Ludhiana': ['Ludhiana'],
      'Amritsar': ['Amritsar'],
      'Jalandhar': ['Jalandhar'],
      'Patiala': ['Patiala'],
      'SAS Nagar': ['Mohali']
    }
  },
  'Uttar Pradesh': {
    code: 'UP',
    districts: {
      'Lucknow': ['Lucknow'],
      'Kanpur Nagar': ['Kanpur'],
      'Agra': ['Agra'],
      'Varanasi': ['Varanasi'],
      'Prayagraj': ['Prayagraj'],
      'Gautam Buddha Nagar': ['Noida'],
      'Ghaziabad': ['Ghaziabad'],
      'Meerut': ['Meerut']
    }
  },
  'West Bengal': {
    code: 'WB',
    districts: {
      'Kolkata': ['Kolkata'],
      'Howrah': ['Howrah'],
      'Paschim Bardhaman': ['Durgapur', 'Asansol'],
      'Darjeeling': ['Siliguri']
    }
  },
  'Madhya Pradesh': {
    code: 'MP',
    districts: {
      'Bhopal': ['Bhopal'],
      'Indore': ['Indore'],
      'Jabalpur': ['Jabalpur'],
      'Gwalior': ['Gwalior'],
      'Ujjain': ['Ujjain']
    }
  },
  'Haryana': {
    code: 'HR',
    districts: {
      'Gurugram': ['Gurugram'],
      'Faridabad': ['Faridabad'],
      'Panipat': ['Panipat'],
      'Hisar': ['Hisar'],
      'Ambala': ['Ambala']
    }
  },
  'Bihar': {
    code: 'BR',
    districts: {
      'Patna': ['Patna'],
      'Gaya': ['Gaya'],
      'Muzaffarpur': ['Muzaffarpur'],
      'Bhagalpur': ['Bhagalpur']
    }
  },
  'Odisha': {
    code: 'OD',
    districts: {
      'Khordha': ['Bhubaneswar'],
      'Cuttack': ['Cuttack'],
      'Sundargarh': ['Rourkela'],
      'Sambalpur': ['Sambalpur']
    }
  },
  'Assam': {
    code: 'AS',
    districts: {
      'Kamrup Metropolitan': ['Guwahati'],
      'Cachar': ['Silchar'],
      'Dibrugarh': ['Dibrugarh'],
      'Jorhat': ['Jorhat']
    }
  },
  'Chhattisgarh': {
    code: 'CG',
    districts: {
      'Raipur': ['Raipur'],
      'Durg': ['Bhilai', 'Durg'],
      'Bilaspur': ['Bilaspur'],
      'Korba': ['Korba']
    }
  },
  'Jharkhand': {
    code: 'JH',
    districts: {
      'Ranchi': ['Ranchi'],
      'East Singhbhum': ['Jamshedpur'],
      'Dhanbad': ['Dhanbad'],
      'Bokaro': ['Bokaro Steel City']
    }
  },
  'Himachal Pradesh': {
    code: 'HP',
    districts: {
      'Shimla': ['Shimla'],
      'Kangra': ['Dharamshala'],
      'Mandi': ['Mandi'],
      'Solan': ['Solan']
    }
  },
  'Uttarakhand': {
    code: 'UK',
    districts: {
      'Dehradun': ['Dehradun', 'Rishikesh'],
      'Haridwar': ['Haridwar', 'Roorkee'],
      'Nainital': ['Haldwani', 'Nainital']
    }
  },
  'Goa': {
    code: 'GA',
    districts: {
      'North Goa': ['Panaji', 'Mapusa'],
      'South Goa': ['Margao', 'Vasco da Gama']
    }
  },
  'Tripura': {
    code: 'TR',
    districts: {
      'West Tripura': ['Agartala']
    }
  },
  'Manipur': {
    code: 'MN',
    districts: {
      'Imphal East': ['Imphal']
    }
  },
  'Meghalaya': {
    code: 'ML',
    districts: {
      'East Khasi Hills': ['Shillong']
    }
  },
  'Nagaland': {
    code: 'NL',
    districts: {
      'Kohima': ['Kohima'],
      'Dimapur': ['Dimapur']
    }
  },
  'Mizoram': {
    code: 'MZ',
    districts: {
      'Aizawl': ['Aizawl']
    }
  },
  'Sikkim': {
    code: 'SK',
    districts: {
      'Gangtok': ['Gangtok']
    }
  },
  'Arunachal Pradesh': {
    code: 'AR',
    districts: {
      'Papum Pare': ['Itanagar']
    }
  },
  'Jammu and Kashmir': {
    code: 'JK',
    districts: {
      'Srinagar': ['Srinagar'],
      'Jammu': ['Jammu']
    }
  },
  'Ladakh': {
    code: 'LA',
    districts: {
      'Leh': ['Leh'],
      'Kargil': ['Kargil']
    }
  },
  'Chandigarh': {
    code: 'CH',
    districts: {
      'Chandigarh': ['Chandigarh']
    }
  },
  'Puducherry': {
    code: 'PY',
    districts: {
      'Puducherry': ['Puducherry'],
      'Karaikal': ['Karaikal']
    }
  },
  'Andaman and Nicobar Islands': {
    code: 'AN',
    districts: {
      'South Andaman': ['Port Blair']
    }
  },
  'Dadra and Nagar Haveli and Daman and Diu': {
    code: 'DN',
    districts: {
      'Daman': ['Daman'],
      'Diu': ['Diu'],
      'Dadra and Nagar Haveli': ['Silvassa']
    }
  },
  'Lakshadweep': {
    code: 'LD',
    districts: {
      'Lakshadweep': ['Kavaratti']
    }
  }
};

const seedLocations = async (force = false) => {
  try {
    const districtCount = await District.count();

    // If districts are already seeded and force is not true, skip
    if (districtCount > 0 && !force) {
      logger.info('📍 Districts and locations already fully seeded');
      return;
    }

    logger.info('⏳ Seeding States, Districts, and Cities...');

    // 1. Process all entries in locationTree
    for (const [stateName, stateInfo] of Object.entries(locationTree)) {
      let [state] = await State.findOrCreate({
        where: { name: stateName },
        defaults: { name: stateName, code: stateInfo.code }
      });

      for (const [districtName, cityList] of Object.entries(stateInfo.districts)) {
        let [district] = await District.findOrCreate({
          where: { state_id: state.id, name: districtName },
          defaults: { state_id: state.id, name: districtName }
        });

        for (const cityName of cityList) {
          let city = await City.findOne({ where: { state_id: state.id, name: cityName } });
          if (city) {
            if (!city.district_id) {
              await city.update({ district_id: district.id });
            }
          } else {
            await City.create({
              state_id: state.id,
              district_id: district.id,
              name: cityName
            });
          }
        }
      }
    }

    // 2. FALLBACK GUARANTEE: Ensure EVERY state in DB has at least one District and linked Cities
    const allDbStates = await State.findAll();
    for (const state of allDbStates) {
      const dCount = await District.count({ where: { state_id: state.id } });
      if (dCount === 0) {
        logger.info(`📍 Generating fallback district for state: ${state.name}`);
        const defaultDistrictName = `${state.name} District`;
        const district = await District.create({
          state_id: state.id,
          name: defaultDistrictName
        });

        // Link any orphan cities belonging to this state to the new district
        const [updatedRows] = await City.update(
          { district_id: district.id },
          { where: { state_id: state.id, district_id: null } }
        );

        if (updatedRows === 0) {
          logger.info(`📍 Generating fallback city for district: ${district.name}`);
          await City.create({
            state_id: state.id,
            district_id: district.id,
            name: `${state.name} City`
          });
        }
      }
    }

    logger.info('✅ States, Districts, and Cities fully seeded across all Indian states and UTs');
  } catch (error) {
    logger.error('❌ Failed to seed locations:', error);
  }
};

module.exports = seedLocations;