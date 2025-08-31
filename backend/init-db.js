const { Client } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();
        console.log('Connected to Neon PostgreSQL database');

        // Read the SQL file
        const sqlFile = fs.readFileSync(path.join(__dirname, 'init-db.sql'), 'utf8');
        
        // Execute the SQL
        await client.query(sqlFile);
        console.log('Database tables and indexes created successfully!');
        
    } catch (error) {
        console.error('Error initializing database:', error);
    } finally {
        await client.end();
    }
}

initializeDatabase();
