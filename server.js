'use strict';
// จุดเริ่มต้น: เปิดเซิร์ฟเวอร์ และปิดอย่างนุ่มนวลเมื่อกด Ctrl+C
const env = require('./src/config/env');
const pool = require('./src/config/db');
const app = require('./src/app');

const server = app.listen(env.PORT, () => {
  console.log(`Gym Log Tracker พร้อมใช้งานที่ http://localhost:${env.PORT}`);
});

function shutdown() {
  server.close(() => pool.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
