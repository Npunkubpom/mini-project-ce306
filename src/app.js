'use strict';
// สร้าง Express app: middleware ความปลอดภัย -> API -> หน้าเว็บ -> error handler
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const apiRoutes = require('./routes');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        // บน http://localhost (dev) ไม่ควรบังคับอัปเกรดเป็น https
        ...(env.IS_PROD ? {} : { 'upgrade-insecure-requests': null }),
      },
    },
  })
);

// CORS: ปิดไว้เป็นค่าเริ่มต้น (same-origin) เปิดเฉพาะโดเมนที่ระบุใน CORS_ORIGIN
app.use(cors({ origin: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : false, credentials: true }));

app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.use('/api/v1', apiRoutes);
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(errorHandler);

module.exports = app;
