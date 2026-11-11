'use strict';
const { parseId } = require('../utils/validators');
const adminService = require('../services/admin.service');

async function stats(req, res) {
  res.json(await adminService.getStats());
}

async function listUsers(req, res) {
  res.json({ users: await adminService.listUsers(req.query) });
}

async function changeRole(req, res) {
  const userId = parseId(req.params.id);
  res.json({ user: await adminService.changeRole(req.user.id, userId, (req.body || {}).role) });
}

async function listExercises(req, res) {
  res.json(await adminService.listGlobalExercises());
}

async function createExercise(req, res) {
  res.status(201).json({ exercise: await adminService.createGlobalExercise(req.body || {}) });
}

async function updateExercise(req, res) {
  res.json({ exercise: await adminService.updateGlobalExercise(parseId(req.params.id), req.body || {}) });
}

async function deleteExercise(req, res) {
  await adminService.deleteGlobalExercise(parseId(req.params.id));
  res.status(204).end();
}

module.exports = { stats, listUsers, changeRole, listExercises, createExercise, updateExercise, deleteExercise };
