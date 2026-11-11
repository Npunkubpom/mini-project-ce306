'use strict';
const { parseId } = require('../utils/validators');
const statsService = require('../services/stats.service');

async function summary(req, res) {
  res.json({ summary: await statsService.getSummary(req.user.id) });
}

async function personalRecords(req, res) {
  res.json({ prs: await statsService.getPersonalRecords(req.user.id) });
}

async function progress(req, res) {
  const exerciseId = parseId(req.params.exercise_id, 'exercise_id');
  res.json(await statsService.getProgress(req.user.id, exerciseId));
}

module.exports = { summary, personalRecords, progress };
