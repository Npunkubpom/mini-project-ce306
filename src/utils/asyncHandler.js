'use strict';
// ห่อ async function ให้ error ที่ throw ออกมาถูกส่งต่อไปยัง errorHandler อัตโนมัติ
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
