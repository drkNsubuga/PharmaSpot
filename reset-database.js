/**
 * Database Reset Utility
 * Clears all data from PharmaSpot databases for a fresh start
 * 
 * Usage: node reset-database.js
 */

const Datastore = require("@seald-io/nedb");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const saltRounds = 10;

const appName = process.env.APPNAME || "PharmaSpot";
const appData = process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming');
const dbFolder = path.join(appData, appName, "server", "databases");

console.log("\n🔄 PharmaSpot Database Reset Utility\n");
console.log("📁 Database Location:", dbFolder);

// Database files to reset
const databases = [
  { name: "inventory.db", description: "Products & Inventory" },
  { name: "categories.db", description: "Product Categories" },
  { name: "customers.db", description: "Customers" },
  { name: "transactions.db", description: "Sales Transactions" },
  { name: "users.db", description: "System Users" },
  { name: "settings.db", description: "Application Settings" }
];

// Backup folder
const backupFolder = path.join(dbFolder, "backups", new Date().toISOString().replace(/:/g, '-').split('.')[0]);

async function resetDatabase(dbFile, description) {
  const dbPath = path.join(dbFolder, dbFile);
  
  if (!fs.existsSync(dbPath)) {
    console.log(`⚠️  ${description} - Database not found (${dbFile})`);
    return { skipped: true };
  }

  try {
    // Create backup
    if (!fs.existsSync(backupFolder)) {
      fs.mkdirSync(backupFolder, { recursive: true });
    }
    
    const backupPath = path.join(backupFolder, dbFile);
    fs.copyFileSync(dbPath, backupPath);
    console.log(`💾 Backed up: ${description}`);

    // Load database
    const db = new Datastore({ filename: dbPath, autoload: true });
    
    // Count records before deletion
    const count = await new Promise((resolve, reject) => {
      db.count({}, (err, count) => {
        if (err) reject(err);
        else resolve(count);
      });
    });

    // Remove all documents
    await new Promise((resolve, reject) => {
      db.remove({}, { multi: true }, (err, numRemoved) => {
        if (err) reject(err);
        else resolve(numRemoved);
      });
    });

    // Compact database
    db.persistence.compactDatafile();

    console.log(`✅ Cleared: ${description} (${count} records removed)`);
    return { success: true, count };

  } catch (error) {
    console.error(`❌ Error with ${description}:`, error.message);
    return { error: true, message: error.message };
  }
}

async function initializeDefaultData() {
  console.log("\n🔧 Initializing default data...\n");

  // Create default admin user
  const usersPath = path.join(dbFolder, "users.db");
  const usersDB = new Datastore({ filename: usersPath, autoload: true });
  
  // Hash the default password
  const hashedPassword = await bcrypt.hash("admin123", saltRounds);
  
  const defaultAdmin = {
    username: "admin",
    password: hashedPassword,
    fullname: "Administrator",
    role: "Administrator",
    perm_products: 1,
    perm_categories: 1,
    perm_transactions: 1,
    perm_users: 1,
    perm_settings: 1,
    status: "Active",
    createdAt: new Date()
  };

  await new Promise((resolve, reject) => {
    usersDB.insert(defaultAdmin, (err, doc) => {
      if (err) reject(err);
      else resolve(doc);
    });
  });
  console.log("👤 Created default admin user (username: admin, password: admin123)");

  // Create default settings
  const settingsPath = path.join(dbFolder, "settings.db");
  const settingsDB = new Datastore({ filename: settingsPath, autoload: true });
  
  const defaultSettings = {
    storeName: "PharmaSpot",
    symbol: "₦",
    currency: "NGN",
    taxRate: 0,
    receiptFooter: "Thank you for your patronage!",
    createdAt: new Date()
  };

  await new Promise((resolve, reject) => {
    settingsDB.insert(defaultSettings, (err, doc) => {
      if (err) reject(err);
      else resolve(doc);
    });
  });
  console.log("⚙️  Created default settings");

  // Create sample categories
  const categoriesPath = path.join(dbFolder, "categories.db");
  const categoriesDB = new Datastore({ filename: categoriesPath, autoload: true });
  
  const sampleCategories = [
    { name: "Analgesics", description: "Pain relief medications" },
    { name: "Antibiotics", description: "Bacterial infection treatments" },
    { name: "Vitamins & Supplements", description: "Nutritional supplements" },
    { name: "First Aid", description: "Basic medical supplies" }
  ];

  for (const category of sampleCategories) {
    await new Promise((resolve, reject) => {
      categoriesDB.insert(category, (err, doc) => {
        if (err) reject(err);
        else resolve(doc);
      });
    });
  }
  console.log(`📂 Created ${sampleCategories.length} sample categories`);
}

async function main() {
  try {
    console.log("\n⚠️  WARNING: This will delete ALL data from the database!");
    console.log("📦 A backup will be created at:", backupFolder);
    console.log("\nPress Ctrl+C to cancel, or wait 5 seconds to continue...\n");

    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log("🚀 Starting database reset...\n");

    let totalRecords = 0;
    for (const db of databases) {
      const result = await resetDatabase(db.name, db.description);
      if (result.count) totalRecords += result.count;
    }

    console.log(`\n📊 Total records removed: ${totalRecords}`);
    console.log(`💾 Backup saved to: ${backupFolder}`);

    // Initialize default data
    await initializeDefaultData();

    console.log("\n✨ Database reset complete!");
    console.log("\n📝 Next steps:");
    console.log("   1. Restart the application");
    console.log("   2. Login with: admin / admin123");
    console.log("   3. Add your products using the form or bulk upload\n");

  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().then(() => process.exit(0));
}

module.exports = { resetDatabase, initializeDefaultData };
