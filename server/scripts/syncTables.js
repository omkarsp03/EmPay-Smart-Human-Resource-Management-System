/**
 * ==============================================================================
 * DATABASE SYNC SCRIPT (PLAIN ENGLISH EXPLANATION)
 * ==============================================================================
 * Think of this script as an "Archivist". 
 * 
 * Our app is super fast because it stores everything in "memory" (like a whiteboard)
 * and backs it up into a single file (`app-state.json`).
 * 
 * However, proper databases like PostgreSQL prefer things organized into separate 
 * tables (like spreadsheets for Users, Attendance, Leaves, etc.).
 * 
 * What this script does:
 * 1. It reads the giant "whiteboard" file (`app-state.json`).
 * 2. It looks at all the different types of data (Users, Attendance, Payroll).
 * 3. It automatically creates a brand new, perfectly shaped "spreadsheet" (Table) 
 *    in our PostgreSQL database for each type of data.
 * 4. It copies all the information line-by-line into those new tables.
 * 
 * You can run this script whenever you want to update PostgreSQL with the latest
 * information from the app's memory!
 * ==============================================================================
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// 1. Connect to our main SQL Database (PostgreSQL)
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgres://empay_user:empay_pass@localhost:5432/empay';

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function sync() {
  // 2. Open our temporary "whiteboard" file where the app saves its fast memory
  const dataPath = path.join(__dirname, '../data/app-state.json');
  if (!fs.existsSync(dataPath)) {
    console.error('No app-state.json found! (Nothing to save)');
    return;
  }
  
  // Read the whole file
  const state = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  
  // 3. Decide what to name each table in the database
  const tableMapping = {
    activityLogs: 'activity_logs',
    attendance: 'attendance',
    leaves: 'leaves',
    leaveAllocations: 'leave_allocations',
    payroll: 'payrolls',
    notifications: 'notifications',
    users: 'users'
  };

  // 4. Go through each group of data one by one (e.g., all Users, then all Attendance)
  for (const [collectionName, records] of Object.entries(state)) {
    if (!Array.isArray(records)) continue; // Skip if it's not a list of items
    
    const tableName = tableMapping[collectionName] || collectionName.toLowerCase();
    
    // 5. Figure out what columns we need (Name, Email, Date, Hours, etc.)
    const allKeys = new Set();
    const colTypes = {};
    
    records.forEach(record => {
      Object.entries(record).forEach(([k, v]) => {
        allKeys.add(k);
        // Guess if it's Text, a Number, or True/False
        if (v !== null && v !== undefined) {
          if (typeof v === 'object') {
            colTypes[k] = 'JSONB'; // For complex data
          } else if (typeof v === 'number') {
            if (!colTypes[k] || colTypes[k] === 'INTEGER') colTypes[k] = Number.isInteger(v) ? 'INTEGER' : 'NUMERIC';
          } else if (typeof v === 'boolean') {
            colTypes[k] = 'BOOLEAN';
          } else {
            colTypes[k] = 'TEXT';
          }
        }
      });
    });
    
    if (allKeys.size === 0) {
      // If empty, just create an empty table
      await pool.query(`CREATE TABLE IF NOT EXISTS "${tableName}" ( _id BIGINT PRIMARY KEY )`);
      continue;
    }
    
    // 6. Delete the old table to make room for a fresh updated one
    await pool.query(`DROP TABLE IF EXISTS "${tableName}"`);
    
    // 7. Create the new table with all the correct columns
    const columns = Array.from(allKeys);
    const colDefs = columns.map(col => {
      // Force the main ID column to be a BIGINT and PRIMARY KEY
      if (col === '_id') {
        return `"_id" BIGINT PRIMARY KEY`;
      }
      const type = colTypes[col] || 'TEXT';
      return `"${col}" ${type}`;
    }).join(', ');
    
    await pool.query(`CREATE TABLE "${tableName}" ( ${colDefs} )`);
    
    // 8. Insert every single record (row) into the new table
    for (const record of records) {
      const values = columns.map(col => {
        const val = record[col];
        if (val === null || val === undefined) return null;
        if (typeof val === 'object') return JSON.stringify(val);
        return val;
      });
      
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const colNames = columns.map(col => `"${col}"`).join(', ');
      
      await pool.query(`INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders})`, values);
    }
    console.log(`Synced ${records.length} records to table: ${tableName}`);
  }
  
  console.log("All tables created and data successfully migrated to separate tables!");
  process.exit(0);
}

sync().catch(console.error);
