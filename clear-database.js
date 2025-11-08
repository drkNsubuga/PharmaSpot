/**
 * Database Cleanup Utility
 * Clears all data from PharmaSpot databases for fresh start
 */

const Datastore = require("@seald-io/nedb");
const path = require("path");
const fs = require("fs");

const appName = process.env.APPNAME || "PharmaSpot";
const appData = process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming');

const dbBasePath = path.join(appData, appName, "server", "databases");

console.log('\n🗄️  PharmaSpot Database Cleanup Utility\n');
console.log('Database path:', dbBasePath);

// Database files to clear
const databases = [
  { name: 'Inventory', file: 'inventory.db' },
  { name: 'Categories', file: 'categories.db' },
  { name: 'Customers', file: 'customers.db' },
  { name: 'Transactions', file: 'transactions.db' },
  { name: 'Users', file: 'users.db' },
  { name: 'Settings', file: 'settings.db' }
];

function clearDatabase(dbPath, dbName) {
  return new Promise((resolve, reject) => {
    const db = new Datastore({
      filename: dbPath,
      autoload: true
    });

    db.remove({}, { multi: true }, (err, numRemoved) => {
      if (err) {
        reject(err);
      } else {
        db.persistence.compactDatafile();
        resolve(numRemoved);
      }
    });
  });
}

async function clearAllDatabases() {
  console.log('\n🧹 Starting database cleanup...\n');
  
  let totalCleared = 0;
  
  for (const database of databases) {
    const dbPath = path.join(dbBasePath, database.file);
    
    if (fs.existsSync(dbPath)) {
      try {
        const numRemoved = await clearDatabase(dbPath, database.name);
        console.log(`✅ ${database.name}: Cleared ${numRemoved} records`);
        totalCleared += numRemoved;
      } catch (error) {
        console.error(`❌ ${database.name}: Error -`, error.message);
      }
    } else {
      console.log(`⚠️  ${database.name}: Database file not found (will be created when needed)`);
    }
  }
  
  console.log(`\n✨ Cleanup complete! Total records cleared: ${totalCleared}`);
  console.log('📝 Your database is now clean and ready for fresh data.\n');
  
  // Create default admin user and settings
  await createDefaultData();
}

async function createDefaultData() {
  console.log('🔧 Creating default data...\n');
  
  // Create default settings
  const settingsPath = path.join(dbBasePath, 'settings.db');
  const settingsDB = new Datastore({ filename: settingsPath, autoload: true });
  
  const defaultSettings = {
    shop_name: 'PharmaSpot',
    symbol: '₦',
    tax: 0,
    address: '',
    phone: '',
    email: ''
  };
  
  settingsDB.insert(defaultSettings, (err) => {
    if (!err) {
      console.log('✅ Default settings created');
    }
  });
  
  // Create default admin user
  const usersPath = path.join(dbBasePath, 'users.db');
  const usersDB = new Datastore({ filename: usersPath, autoload: true });
  
  const defaultUser = {
    name: 'Administrator',
    username: 'admin',
    password: 'admin123', // User should change this!
    role: 'admin',
    createdAt: new Date()
  };
  
  usersDB.insert(defaultUser, (err) => {
    if (!err) {
      console.log('✅ Default admin user created');
      console.log('   Username: admin');
      console.log('   Password: admin123');
      console.log('   ⚠️  Please change the password after first login!\n');
    }
  });
  
  // Create sample categories
  const categoriesPath = path.join(dbBasePath, 'categories.db');
  const categoriesDB = new Datastore({ filename: categoriesPath, autoload: true });
  
  const sampleCategories = [
    { name: 'Analgesics' },
    { name: 'Antibiotics' },
    { name: 'Supplements' },
    { name: 'Antihistamines' },
    { name: 'Antacids' }
  ];
  
  categoriesDB.insert(sampleCategories, (err) => {
    if (!err) {
      console.log('✅ Sample categories created (5 categories)\n');
      console.log('🎉 Database is now initialized and ready to use!');
    }
  });
}

// Run the cleanup
clearAllDatabases().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
