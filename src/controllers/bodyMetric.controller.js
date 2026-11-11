'use strict';
const { parseId } = require('../utils/validators');
const bodyMetricService = require('../services/bodyMetric.service');

async function list(req, res) {
  res.json({ metrics: await bodyMetricService.list(req.user.id, req.query) });
}

// วันเดียวกันบันทึกซ้ำ = แทนค่าเดิม
async function save(req, res) {
  res.status(201).json({ metric: await bodyMetricService.save(req.user.id, req.body || {}) });
}

async function remove(req, res) {
  await bodyMetricService.remove(req.user.id, parseId(req.params.id));
  res.status(204).end();
}

module.exports = { list, save, remove };
