'use strict';
const { parseId } = require('../utils/validators');
const exerciseService = require('../services/exercise.service');

// ท่ากลาง + ท่าของฉัน
async function list(req, res) {
  res.json(await exerciseService.listForUser(req.user.id));
}

// ท่าที่ผู้ใช้สร้างเอง: ownerId = ผู้ใช้คนนี้เสมอ
async function create(req, res) {
  res.status(201).json({ exercise: await exerciseService.create(req.body || {}, req.user.id) });
}

async function update(req, res) {
  res.json({ exercise: await exerciseService.update(parseId(req.params.id), req.body || {}, req.user.id) });
}

async function remove(req, res) {
  await exerciseService.remove(parseId(req.params.id), req.user.id);
  res.status(204).end();
}

module.exports = { list, create, update, remove };
