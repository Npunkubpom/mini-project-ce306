'use strict';
const { parseId } = require('../utils/validators');
const workoutService = require('../services/workout.service');

/* Sessions */
async function getDay(req, res) {
  res.json(await workoutService.getDay(req.user.id, req.query.date));
}

async function createSession(req, res) {
  res.status(201).json({ session: await workoutService.createSession(req.user.id, req.body || {}) });
}

async function listSessions(req, res) {
  res.json(await workoutService.listSessions(req.user.id, req.query));
}

async function getSession(req, res) {
  res.json(await workoutService.getSession(req.user.id, parseId(req.params.id)));
}

async function updateSession(req, res) {
  const session = await workoutService.updateNotes(req.user.id, parseId(req.params.id), req.body || {});
  res.json({ session });
}

async function deleteSession(req, res) {
  await workoutService.deleteSession(req.user.id, parseId(req.params.id));
  res.status(204).end();
}

/* History + Sets */
async function getHistory(req, res) {
  const exerciseId = parseId(req.params.exercise_id, 'exercise_id');
  res.json(await workoutService.getLastHistory(req.user.id, exerciseId, req.query.exclude_session_id));
}

async function addSet(req, res) {
  res.status(201).json({ set: await workoutService.addSet(req.user.id, req.body || {}) });
}

async function updateSet(req, res) {
  const id = parseId(req.params.id);
  res.json({ set: await workoutService.updateSet(req.user.id, id, req.body || {}) });
}

async function deleteSet(req, res) {
  await workoutService.deleteSet(req.user.id, parseId(req.params.id));
  res.status(204).end();
}

module.exports = {
  getDay,
  createSession,
  listSessions,
  getSession,
  updateSession,
  deleteSession,
  getHistory,
  addSet,
  updateSet,
  deleteSet,
};
