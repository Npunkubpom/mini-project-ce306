'use strict';
// การเชื่อมต่อ PostgreSQL (connection pool) ใช้ร่วมกันทุก repository
const { Pool, types } = require('pg');
const env = require('./env');

// NUMERIC (OID 1700) -> JS number (ค่าเริ่มต้นของ pg จะส่งกลับเป็น string)
types.setTypeParser(1700, (v) => parseFloat(v));

const pool = new Pool({ connectionString: env.DATABASE_URL });
pool.on('error', (err) => console.error('Unexpected PG pool error:', err));

module.exports = pool;
