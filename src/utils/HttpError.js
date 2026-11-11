'use strict';
// error ที่รู้ status code แน่นอน (400, 401, 403, 404, 409) -> errorHandler ส่งกลับเป็น JSON
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = HttpError;
