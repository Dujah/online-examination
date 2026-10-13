const mysql = require('mysql2');
require('dotenv').config();

// Exam dates and times are stored as local wall-clock values and compared against NOW(),
// so every connection must use the institution's time zone, not the server's (cloud MySQL is usually UTC)
const TIME_ZONE = process.env.DB_TIMEZONE || '+05:30';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Many hosted MySQL services require an encrypted connection; set DB_SSL=true for those
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  // How mysql2 converts DATETIME values to and from JS Dates; must match the session time zone below
  timezone: TIME_ZONE
});

// Runs once per new pooled connection, before any query sent on it, so NOW() and the triggers use local time
pool.on('connection', (connection) => {
  connection.query('SET time_zone = ?', [TIME_ZONE]);
});

module.exports = pool.promise(); // .promise() lets us use async/await instead of callbacks
