// Gym Log Tracker — Frontend (Vanilla JS, ES module + Fetch API)
// ทุกการเรียก API เป็น async/await และอัปเดต DOM เฉพาะส่วนที่เปลี่ยน (partial render)

const API = '/api/v1';
const DEFAULT_REST_SECONDS = 90;

const CATEGORY_LABEL = {
  Chest: 'Chest · อก',
  Back: 'Back · หลัง',
  Legs: 'Legs · ขา',
  Shoulders: 'Shoulders · ไหล่',
  Arms: 'Arms · แขน',
  Core: 'Core · หน้าท้อง',
  Cardio: 'Cardio · คาร์ดิโอ',
  Other: 'Other · อื่นๆ',
};

const state = {
  user: null,
  exercises: [],
  session: null, // { id, workout_date, notes } | null
  sessionPromise: null, // กันสร้าง session ซ้ำเมื่อกดรัว
  sets: [], // เซตของวันนี้ (มี exercise_name)
  exerciseId: null,
  historyToken: 0, // กัน response เก่ามาเขียนทับตอนเปลี่ยนท่าเร็วๆ
  categories: Object.keys(CATEGORY_LABEL),
  equipment: ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Kettlebell', 'Band', 'Other'],
};

const isAdmin = () => state.user && state.user.role === 'ADMIN';
const restSeconds = () => (state.user && state.user.rest_seconds) || DEFAULT_REST_SECONDS;

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */
const $ = (sel, root = document) => root.querySelector(sel);

// สร้าง element แบบปลอดภัย (ใช้ textContent เสมอ ไม่ใช้ innerHTML กับข้อมูลผู้ใช้)
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, value);
  }
  el.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return el;
}

// สร้าง element ของ SVG (กราฟ)
function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...children);
  return el;
}

const pad = (n) => String(n).padStart(2, '0');
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}
const fmtNum = (n) => String(parseFloat(Number(n).toFixed(2)));
const fmtInt = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
function fmtDateLong(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' });
}

let toastTimer = null;
function toast(message, isError = true) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.toggle('is-error', isError);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

/* ------------------------------------------------------------------ */
/* API client                                                          */
/* ------------------------------------------------------------------ */
async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(API + path, {
      method,
      credentials: 'same-origin', // ส่ง HTTP-Only cookie ไปด้วย
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
  }

  let data = null;
  if (res.status !== 204) {
    try { data = await res.json(); } catch { /* ไม่มี body */ }
  }

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) onSessionExpired();
    const err = new Error((data && data.error) || `เกิดข้อผิดพลาด (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ------------------------------------------------------------------ */
/* Views / Auth                                                        */
/* ------------------------------------------------------------------ */
function showView(name) {
  $('#auth-view').hidden = name !== 'auth';
  $('#tracker-view').hidden = name !== 'tracker';
}

let authMode = 'login';
function setAuthMode(mode) {
  authMode = mode;
  const isLogin = mode === 'login';
  $('#tab-login').setAttribute('aria-pressed', String(isLogin));
  $('#tab-register').setAttribute('aria-pressed', String(!isLogin));
  $('#name-field').hidden = isLogin;
  $('#password-hint').hidden = isLogin;
  $('#auth-submit').textContent = isLogin ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก';
  $('#password').autocomplete = isLogin ? 'current-password' : 'new-password';
  $('#auth-error').textContent = '';
}

async function onAuthSubmit(e) {
  e.preventDefault();
  const errorEl = $('#auth-error');
  errorEl.textContent = '';

  const email = $('#email').value.trim();
  const password = $('#password').value;
  const name = $('#name').value.trim();

  if (!email || !password) { errorEl.textContent = 'กรุณากรอกอีเมลและรหัสผ่าน'; return; }
  if (authMode === 'register') {
    if (!name) { errorEl.textContent = 'กรุณากรอกชื่อ'; return; }
    if (password.length < 8) { errorEl.textContent = 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร'; return; }
  }

  const btn = $('#auth-submit');
  btn.disabled = true;
  try {
    if (authMode === 'register') {
      await api('/auth/register', { method: 'POST', body: { name, email, password } });
    }
    const { user } = await api('/auth/login', { method: 'POST', body: { email, password } });
    state.user = user;
    $('#password').value = '';
    await enterTracker();
  } catch (err) {
    errorEl.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

async function onLogout() {
  try { await api('/auth/logout', { method: 'POST' }); } catch { /* ออกฝั่ง client ต่ออยู่ดี */ }
  resetTrackerState();
  setAuthMode('login');
  showView('auth');
}

function onSessionExpired() {
  if (!state.user) return;
  resetTrackerState();
  setAuthMode('login');
  showView('auth');
  $('#auth-error').textContent = 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง';
}

function resetTrackerState() {
  state.user = null;
  state.exercises = [];
  state.session = null;
  state.sessionPromise = null;
  state.sets = [];
  state.exerciseId = null;
  stopRestTimer();
  clearTimeout(notesTimer);
  $('#today-notes').value = '';
  $('#notes-status').textContent = '';
  $('#tab-admin').hidden = true;
  $('#admin-badge').hidden = true;
  hist.offset = 0;
  hist.points = [];
  body.metrics = [];
  $('#body-date').value = '';
  currentPage = null;
  $('#sets-body').replaceChildren();
  $('#exercise').replaceChildren();
  $('#last-log').hidden = true;
  updateSetsView();
}

/* ------------------------------------------------------------------ */
/* Tracker: initial load                                               */
/* ------------------------------------------------------------------ */
async function enterTracker() {
  showView('tracker');
  $('#user-name').textContent = state.user.name;
  $('#tab-admin').hidden = !isAdmin();
  $('#admin-badge').hidden = !isAdmin();
  $('#rest-select').value = String(restSeconds());
  if (!$('#rest-select').value) {
    // ค่าที่ไม่มีในรายการ -> เพิ่มเป็นตัวเลือกพิเศษ
    $('#rest-select').append(h('option', { value: restSeconds() }, `${restSeconds()} วินาที`));
    $('#rest-select').value = String(restSeconds());
  }
  $('#today-label').textContent = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const [exRes, todayRes] = await Promise.all([
    api('/exercises'),
    api(`/workouts/sessions/today?date=${todayStr()}`),
  ]);
  applyExerciseList(exRes);
  state.session = todayRes.session;
  state.sessionPromise = null;
  state.sets = todayRes.sets;
  state.exerciseId = null;
  $('#today-notes').value = (state.session && state.session.notes) || '';
  $('#notes-status').textContent = '';

  renderExerciseSelect();
  $('#sets-body').replaceChildren(...state.sets.map(createRow));
  $('#last-log').hidden = true;
  updateSetsView();
  resetForm();
  currentPage = null;
  route();
}

function applyExerciseList(res) {
  state.exercises = res.exercises;
  if (res.categories) state.categories = res.categories;
  if (res.equipment) state.equipment = res.equipment;
}

const exerciseLabel = (ex) => `${ex.is_custom ? '★ ' : ''}${ex.name} (${ex.equipment_type})`;

function fillExerciseOptions(select, exercises, placeholder) {
  const keep = select.value;
  select.replaceChildren(h('option', { value: '' }, placeholder));

  const groups = new Map();
  for (const ex of exercises) {
    if (!groups.has(ex.category)) groups.set(ex.category, []);
    groups.get(ex.category).push(ex);
  }
  for (const [category, list] of groups) {
    select.append(
      h('optgroup', { label: CATEGORY_LABEL[category] || category },
        ...list.map((ex) => h('option', { value: ex.id }, exerciseLabel(ex))))
    );
  }
  // คงท่าที่เลือกไว้ถ้ายังมีอยู่ในรายการ
  if (keep && exercises.some((ex) => String(ex.id) === keep)) select.value = keep;
}

function renderExerciseSelect() {
  fillExerciseOptions($('#exercise'), state.exercises, '— เลือกท่าเล่น —');
  if (!$('#exercise').value && state.exerciseId) {
    // ท่าที่เลือกอยู่ถูกลบไป
    state.exerciseId = null;
    $('#last-log').hidden = true;
    resetForm();
  }
}

/* ------------------------------------------------------------------ */
/* Exercise selection + last log suggestion                            */
/* ------------------------------------------------------------------ */
async function onExerciseChange() {
  const id = Number($('#exercise').value) || null;
  state.exerciseId = id;
  const token = ++state.historyToken;

  prefillForm(null);
  if (!id) { $('#last-log').hidden = true; return; }

  const box = $('#last-log');
  box.hidden = false;
  $('#last-log-title').textContent = 'กำลังโหลดประวัติ…';
  $('#last-log-chips').replaceChildren();

  try {
    const excludeParam = state.session ? `?exclude_session_id=${state.session.id}` : '';
    const history = await api(`/workouts/history/${id}${excludeParam}`);
    if (token !== state.historyToken) return; // ผู้ใช้เปลี่ยนท่าไปแล้ว
    renderLastLog(history);
    prefillForm(history);
  } catch (err) {
    if (token !== state.historyToken) return;
    $('#last-log-title').textContent = 'โหลดประวัติไม่สำเร็จ';
    toast(err.message);
  }
}

function renderLastLog(history) {
  const title = $('#last-log-title');
  const chips = $('#last-log-chips');
  chips.replaceChildren();

  if (!history.sets.length) {
    title.textContent = 'ยังไม่มีประวัติของท่านี้ — เริ่มบันทึกครั้งแรกเลย!';
    return;
  }
  title.textContent = `ครั้งล่าสุด (${fmtDate(history.workout_date)}) — แตะเพื่อใช้ค่านี้`;
  for (const s of history.sets) {
    chips.append(
      h('button', {
        type: 'button',
        class: 'chip',
        onClick: () => {
          $('#weight').value = fmtNum(s.weight_kg);
          $('#reps').value = s.reps;
        },
      }, `เซต ${s.set_number}: ${fmtNum(s.weight_kg)} kg × ${s.reps}`)
    );
  }
}

/* ------------------------------------------------------------------ */
/* Set form                                                            */
/* ------------------------------------------------------------------ */
function nextSetNumber(exerciseId) {
  const nums = state.sets.filter((s) => s.exercise_id === exerciseId).map((s) => s.set_number);
  return nums.length ? Math.max(...nums) + 1 : 1;
}

function resetForm() {
  $('#set-number').value = 1;
  $('#weight').value = '';
  $('#reps').value = '';
}

// เติมค่าเริ่มต้นให้ฟอร์ม: เซตล่าสุดของวันนี้ > เซตแรกของครั้งก่อน
function prefillForm(history) {
  const id = state.exerciseId;
  if (!id) { resetForm(); return; }

  $('#set-number').value = nextSetNumber(id);
  const today = state.sets.filter((s) => s.exercise_id === id);
  if (today.length) {
    const last = today[today.length - 1];
    $('#weight').value = fmtNum(last.weight_kg);
    $('#reps').value = last.reps;
  } else if (history && history.sets.length) {
    $('#weight').value = fmtNum(history.sets[0].weight_kg);
    $('#reps').value = history.sets[0].reps;
  } else {
    $('#weight').value = '';
    $('#reps').value = '';
  }
}

function onStepClick(e) {
  const btn = e.target.closest('.step-btn');
  if (!btn) return;
  const input = document.getElementById(btn.dataset.target);
  const step = Number(btn.dataset.step);
  const min = Number(input.min || 0);
  const max = Number(input.max || 1000);
  const next = (Number(input.value) || 0) + step;
  input.value = fmtNum(Math.min(max, Math.max(min, next)));
}

function ensureSession() {
  if (state.session) return Promise.resolve(state.session);
  if (!state.sessionPromise) {
    state.sessionPromise = api('/workouts/sessions', {
      method: 'POST',
      body: { workout_date: todayStr() },
    })
      .then(({ session }) => { state.session = session; return session; })
      .finally(() => { state.sessionPromise = null; });
  }
  return state.sessionPromise;
}

async function onAddSet(e) {
  e.preventDefault();
  if (!state.exerciseId) { toast('กรุณาเลือกท่าเล่นก่อน'); $('#exercise').focus(); return; }

  const setNumber = Number($('#set-number').value);
  const weight = Number($('#weight').value);
  const reps = Number($('#reps').value);

  if (!Number.isInteger(setNumber) || setNumber < 1) { toast('เลขเซตต้องเป็นจำนวนเต็มตั้งแต่ 1'); return; }
  if ($('#weight').value === '' || !Number.isFinite(weight) || weight < 0) { toast('กรุณากรอกน้ำหนัก (0 ขึ้นไป)'); $('#weight').focus(); return; }
  if (!Number.isInteger(reps) || reps < 1) { toast('กรุณากรอกจำนวนครั้ง (อย่างน้อย 1)'); $('#reps').focus(); return; }

  const btn = $('#add-set-btn');
  btn.disabled = true;
  try {
    const session = await ensureSession();
    const { set } = await api('/workouts/sets', {
      method: 'POST',
      body: {
        session_id: session.id,
        exercise_id: state.exerciseId,
        set_number: setNumber,
        weight_kg: weight,
        reps,
      },
    });
    const ex = state.exercises.find((x) => x.id === set.exercise_id);
    const full = { ...set, exercise_name: ex ? ex.name : '' };
    state.sets.push(full);
    $('#sets-body').append(createRow(full));
    updateSetsView();
    $('#set-number').value = nextSetNumber(state.exerciseId);
  } catch (err) {
    toast(err.message);
  } finally {
    btn.disabled = false;
  }
}

/* ------------------------------------------------------------------ */
/* Sets table (rows are built & patched individually)                  */
/* ------------------------------------------------------------------ */
function createRow(set) {
  const weightInput = h('input', {
    class: 'cell-input', type: 'number', inputmode: 'decimal', min: '0', max: '1000', step: '0.5',
    value: fmtNum(set.weight_kg), 'aria-label': 'น้ำหนัก กิโลกรัม',
    onChange: () => saveEdit(set.id),
  });
  const repsInput = h('input', {
    class: 'cell-input', type: 'number', inputmode: 'numeric', min: '1', max: '1000', step: '1',
    value: set.reps, 'aria-label': 'จำนวนครั้ง',
    onChange: () => saveEdit(set.id),
  });
  const completeBtn = h('button', {
    type: 'button', class: 'icon-btn complete-btn',
    'aria-pressed': String(set.is_completed), 'aria-label': 'ทำเครื่องหมายว่าเล่นเสร็จแล้ว',
    onClick: () => toggleComplete(set.id),
  }, '✔');
  const deleteBtn = h('button', {
    type: 'button', class: 'icon-btn delete-btn', 'aria-label': 'ลบเซตนี้',
    onClick: () => deleteSet(set.id),
  }, '🗑');

  return h('tr', { dataset: { id: set.id }, class: set.is_completed ? 'done' : '' },
    h('td', { class: 'ex-name' }, set.exercise_name),
    h('td', { class: 'num' }, String(set.set_number)),
    h('td', { class: 'cell-w' }, weightInput),
    h('td', { class: 'cell-r' }, repsInput),
    h('td', {}, h('div', { class: 'row-actions' }, completeBtn, deleteBtn))
  );
}

const rowOf = (id) => $(`#sets-body tr[data-id="${id}"]`);

function setRowDone(id, done) {
  const tr = rowOf(id);
  if (!tr) return;
  tr.classList.toggle('done', done);
  $('.complete-btn', tr).setAttribute('aria-pressed', String(done));
  if (done) {
    tr.classList.remove('flash');
    void tr.offsetWidth; // รีสตาร์ท animation
    tr.classList.add('flash');
  }
}

function readRowValues(tr) {
  const [w, r] = tr.querySelectorAll('.cell-input');
  const weight = Number(w.value);
  const reps = Number(r.value);
  const valid = w.value !== '' && Number.isFinite(weight) && weight >= 0 && Number.isInteger(reps) && reps >= 1;
  return { valid, weight, reps, inputs: [w, r] };
}

function restoreRowInputs(tr, set) {
  const [w, r] = tr.querySelectorAll('.cell-input');
  w.value = fmtNum(set.weight_kg);
  r.value = set.reps;
}

// แก้น้ำหนัก/จำนวนครั้งในแถว -> PATCH
async function saveEdit(id) {
  const set = state.sets.find((s) => s.id === id);
  const tr = rowOf(id);
  if (!set || !tr) return;

  const { valid, weight, reps } = readRowValues(tr);
  if (!valid) { toast('น้ำหนักต้อง≥ 0 และจำนวนครั้งต้องเป็นจำนวนเต็ม ≥ 1'); restoreRowInputs(tr, set); return; }
  if (weight === set.weight_kg && reps === set.reps) return;

  try {
    const { set: updated } = await api(`/workouts/sets/${id}`, {
      method: 'PATCH', body: { weight_kg: weight, reps },
    });
    Object.assign(set, updated);
  } catch (err) {
    restoreRowInputs(tr, set);
    toast(err.message);
  }
}

// ✔ Complete: เปลี่ยนแถวเป็นสีเขียวทันที (optimistic) + เริ่ม Rest Timer แล้วค่อย PATCH
async function toggleComplete(id) {
  const set = state.sets.find((s) => s.id === id);
  const tr = rowOf(id);
  if (!set || !tr) return;

  const next = !set.is_completed;
  const { valid, weight, reps } = readRowValues(tr);
  if (!valid) { toast('กรุณาตรวจสอบน้ำหนักและจำนวนครั้งก่อน'); restoreRowInputs(tr, set); return; }

  set.is_completed = next;
  setRowDone(id, next);
  updateSetsView();
  if (next) startRestTimer();

  try {
    const { set: updated } = await api(`/workouts/sets/${id}`, {
      method: 'PATCH', body: { is_completed: next, weight_kg: weight, reps },
    });
    Object.assign(set, updated);
  } catch (err) {
    // ล้มเหลว -> ย้อนกลับ
    set.is_completed = !next;
    setRowDone(id, !next);
    updateSetsView();
    if (next) stopRestTimer();
    toast(err.message);
  }
}

async function deleteSet(id) {
  const set = state.sets.find((s) => s.id === id);
  if (!set) return;
  if (!window.confirm(`ลบ ${set.exercise_name} เซต ${set.set_number} ?`)) return;

  try {
    await api(`/workouts/sets/${id}`, { method: 'DELETE' });
    state.sets = state.sets.filter((s) => s.id !== id);
    rowOf(id)?.remove();
    updateSetsView();
    if (state.exerciseId) $('#set-number').value = nextSetNumber(state.exerciseId);
  } catch (err) {
    toast(err.message);
  }
}

function updateWorkoutSummary() {
  const totalSets = state.sets.length;
  const totalReps = state.sets.reduce((sum, s) => sum + Number(s.reps || 0), 0);
  const totalVolume = state.sets.reduce(
    (sum, s) => sum + Number(s.weight_kg || 0) * Number(s.reps || 0),
    0
  );
  const uniqueExercises = new Set(state.sets.map((s) => s.exercise_name || 'ไม่ระบุ'));
  const bestExercise = [...state.sets].reduce((acc, s) => {
    const key = s.exercise_name || 'ไม่ระบุ';
    const volume = Number(s.weight_kg || 0) * Number(s.reps || 0);
    acc[key] = (acc[key] || 0) + volume;
    return acc;
  }, {});
  const bestEntry = Object.entries(bestExercise).sort((a, b) => b[1] - a[1])[0];

  $('#summary-sets').textContent = String(totalSets);
  $('#summary-reps').textContent = fmtNum(totalReps);
  $('#summary-volume').textContent = `${fmtNum(totalVolume)} kg`;
  $('#summary-best').textContent = bestEntry ? bestEntry[0] : '-';
  $('#session-count-badge').textContent = `${uniqueExercises.size} ท่า`;
}

function updateSetsView() {
  const total = state.sets.length;
  const done = state.sets.filter((s) => s.is_completed).length;
  $('#sets-summary').textContent = `${done}/${total}`;
  $('#sets-empty').hidden = total > 0;
  $('#sets-table').hidden = total === 0;
  updateWorkoutSummary();
}

/* ------------------------------------------------------------------ */
/* Rest timer (floating, 90s countdown)                                */
/* ------------------------------------------------------------------ */
const timer = { endAt: 0, total: DEFAULT_REST_SECONDS, intervalId: null, hideId: null };

function formatClock(totalSeconds) {
  return `${pad(Math.floor(totalSeconds / 60))}:${pad(totalSeconds % 60)}`;
}

function startRestTimer(seconds = restSeconds()) {
  clearInterval(timer.intervalId);
  clearTimeout(timer.hideId);
  timer.total = seconds;
  timer.endAt = Date.now() + seconds * 1000;

  const el = $('#rest-timer');
  el.classList.remove('finished');
  el.hidden = false;
  $('#rest-label').textContent = 'พักเซต';
  // ใช้ timestamp ปลายทางแทนการลบทีละ 1 วินาที จึงไม่เพี้ยนแม้แท็บถูกหน่วง
  timer.intervalId = setInterval(tickRestTimer, 200);
  tickRestTimer();
}

function tickRestTimer() {
  const msLeft = timer.endAt - Date.now();
  if (msLeft <= 0) { finishRestTimer(); return; }
  $('#rest-time').textContent = formatClock(Math.ceil(msLeft / 1000));
  $('#rest-bar-fill').style.width = `${Math.min(100, (msLeft / (timer.total * 1000)) * 100)}%`;
}

function adjustRestTimer(deltaSeconds) {
  if ($('#rest-timer').classList.contains('finished')) {
    if (deltaSeconds > 0) startRestTimer(deltaSeconds);
    return;
  }
  timer.endAt += deltaSeconds * 1000;
  timer.total = Math.max(1, timer.total + deltaSeconds);
  tickRestTimer();
}

function finishRestTimer() {
  clearInterval(timer.intervalId);
  const el = $('#rest-timer');
  el.classList.add('finished');
  $('#rest-label').textContent = 'พักครบแล้ว — ลุยเซตต่อไป 💪';
  $('#rest-time').textContent = '00:00';
  $('#rest-bar-fill').style.width = '0%';
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  beep();
  timer.hideId = setTimeout(stopRestTimer, 6000);
}

function stopRestTimer() {
  clearInterval(timer.intervalId);
  clearTimeout(timer.hideId);
  $('#rest-timer').hidden = true;
}

function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.25].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.22);
    });
    setTimeout(() => ctx.close(), 800);
  } catch { /* เบราว์เซอร์ไม่อนุญาตเสียง ก็ข้ามไป */ }
}

/* ------------------------------------------------------------------ */
/* Settings: เวลาพัก + โน้ตวันนี้                                      */
/* ------------------------------------------------------------------ */
async function onRestChange() {
  const select = $('#rest-select');
  const seconds = Number(select.value);
  const before = restSeconds();
  state.user.rest_seconds = seconds; // ใช้ค่าใหม่ทันที
  try {
    const { user } = await api('/auth/me', { method: 'PATCH', body: { rest_seconds: seconds } });
    state.user.rest_seconds = user.rest_seconds;
    toast(`ตั้งเวลาพักเป็น ${select.selectedOptions[0].textContent} แล้ว`, false);
  } catch (err) {
    state.user.rest_seconds = before;
    select.value = String(before);
    toast(err.message);
  }
}

let notesTimer = null;
let notesSaving = Promise.resolve();

function onNotesInput() {
  $('#notes-status').textContent = 'ยังไม่บันทึก';
  clearTimeout(notesTimer);
  notesTimer = setTimeout(saveNotes, 900); // รอผู้ใช้หยุดพิมพ์ก่อนค่อยบันทึก
}

function saveNotes() {
  clearTimeout(notesTimer);
  // ต่อคิวกันการบันทึกซ้อนกัน
  notesSaving = notesSaving.then(async () => {
    const text = $('#today-notes').value.trim();
    const current = (state.session && state.session.notes) || '';
    if (text === current) { $('#notes-status').textContent = text ? 'บันทึกแล้ว' : ''; return; }
    if (!text && !state.session) { $('#notes-status').textContent = ''; return; }

    $('#notes-status').textContent = 'กำลังบันทึก…';
    try {
      const session = await ensureSession();
      const { session: updated } = await api(`/workouts/sessions/${session.id}`, {
        method: 'PATCH', body: { notes: text || null },
      });
      state.session = updated;
      $('#notes-status').textContent = 'บันทึกแล้ว ✓';
    } catch (err) {
      $('#notes-status').textContent = 'บันทึกไม่สำเร็จ';
      toast(err.message);
    }
  });
  return notesSaving;
}

/* ------------------------------------------------------------------ */
/* Router (#/today, #/history, #/exercises, #/admin)                   */
/* ------------------------------------------------------------------ */
const PAGES = ['today', 'history', 'exercises', 'body', 'admin'];
let currentPage = null;

function route() {
  if (!state.user) return;
  let page = (location.hash.match(/^#\/(\w+)/) || [])[1] || 'today';
  if (!PAGES.includes(page) || (page === 'admin' && !isAdmin())) page = 'today';
  if (page === currentPage && $(`#page-${page}`).hidden === false) return;
  currentPage = page;

  for (const p of PAGES) $(`#page-${p}`).hidden = p !== page;
  document.querySelectorAll('.tab').forEach((a) => {
    if (a.dataset.page === page) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  $('#page-title').textContent = $(`#page-${page}`).dataset.title;
  window.scrollTo(0, 0);

  // โหลดข้อมูลของหน้านั้นทุกครั้งที่เปิด (ข้อมูลอาจเปลี่ยนจากหน้าอื่น)
  const loaders = { history: loadHistoryPage, exercises: loadExercisesPage, body: loadBodyPage, admin: loadAdminPage };
  if (loaders[page]) loaders[page]().catch((err) => toast(err.message));
}

/* ------------------------------------------------------------------ */
/* หน้า ประวัติ: ภาพรวม + กราฟ + PR + รายการ session                   */
/* ------------------------------------------------------------------ */
const hist = { offset: 0, metric: 'max_weight', points: [], token: 0 };
const PAGE_SIZE = 10;

async function loadHistoryPage() {
  hist.offset = 0;
  $('#session-list').replaceChildren(h('p', { class: 'muted' }, 'กำลังโหลด…'));

  const [{ summary }, { prs }] = await Promise.all([api('/stats/summary'), api('/stats/prs')]);
  $('#hs-sessions').textContent = `${summary.sessions} ครั้ง`;
  $('#hs-7d').textContent = `${summary.sessions_7d} ครั้ง`;
  $('#hs-sets').textContent = fmtInt(summary.completed_sets);
  $('#hs-volume').textContent = `${fmtInt(summary.volume)} kg`;
  renderPrs(prs);

  // เลือกท่าสำหรับกราฟ: ใช้เฉพาะท่าที่เคยเล่นเสร็จแล้ว
  const select = $('#progress-exercise');
  const played = state.exercises.filter((ex) => prs.some((p) => p.exercise_id === ex.id));
  fillExerciseOptions(select, played, played.length ? '— เลือกท่าเพื่อดูกราฟ —' : 'ยังไม่มีท่าที่เล่นเสร็จ');
  if (!select.value && played.length) {
    // ค่าเริ่มต้น = ท่าที่เล่นบ่อย/หนักที่สุด (PR อันดับแรก)
    select.value = String(prs[0].exercise_id);
  }
  await loadProgress();
  await loadSessions(false);
}

function renderPrs(prs) {
  $('#pr-count').textContent = `${prs.length} ท่า`;
  const list = $('#pr-list');
  if (!prs.length) {
    list.replaceChildren(h('p', { class: 'muted' }, 'กด ✔ เซตที่เล่นเสร็จ แล้วสถิติส่วนตัวจะขึ้นที่นี่'));
    return;
  }
  list.replaceChildren(...prs.map((p) =>
    h('div', { class: 'item' },
      h('div', { class: 'item-main' },
        h('span', { class: 'item-title' }, p.exercise_name),
        h('span', { class: 'item-sub' }, `${fmtDate(p.workout_date)} · ${p.reps} ครั้ง`)),
      h('span', { class: 'item-value' }, `${fmtNum(p.weight_kg)} kg`))
  ));
}

async function loadProgress() {
  const id = Number($('#progress-exercise').value) || null;
  const token = ++hist.token;
  if (!id) { hist.points = []; renderProgress(); return; }
  const { points } = await api(`/stats/progress/${id}`);
  if (token !== hist.token) return;
  hist.points = points;
  renderProgress();
}

const METRIC = {
  max_weight: { label: 'น้ำหนักสูงสุด', unit: 'kg' },
  est_1rm: { label: '1RM ประมาณ (สูตร Epley)', unit: 'kg' },
  volume: { label: 'ปริมาณ (น้ำหนัก × ครั้ง)', unit: 'kg' },
  weight_kg: { label: 'น้ำหนักตัว', unit: 'kg' },
  body_fat_pct: { label: '%ไขมัน', unit: '%' },
  muscle_mass_kg: { label: 'มวลกล้ามเนื้อ', unit: 'kg' },
};

function renderProgress() {
  const box = $('#progress-chart');
  const caption = $('#progress-caption');
  document.querySelectorAll('[data-metric]').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.metric === hist.metric)));

  const pts = hist.points;
  if (!pts.length) {
    box.replaceChildren(h('p', { class: 'muted' }, 'ยังไม่มีข้อมูลสำหรับกราฟ'));
    caption.textContent = '';
    return;
  }
  const { label, unit } = METRIC[hist.metric];
  // กว้างตามการ์ดจริง (ขั้นต่ำ 420) ตัวอักษรในกราฟจึงไม่ใหญ่เกินบนจอคอม
  box.replaceChildren(lineChart(pts, hist.metric, unit, Math.min(900, Math.max(420, box.clientWidth))));

  const first = Number(pts[0][hist.metric]);
  const last = Number(pts[pts.length - 1][hist.metric]);
  const diff = last - first;
  caption.textContent = pts.length < 2
    ? `${label}: ${fmtNum(last)} ${unit} (มีข้อมูล 1 ครั้ง)`
    : `${label} ${pts.length} ครั้งล่าสุด: ${fmtNum(first)} → ${fmtNum(last)} ${unit} `
      + `(${diff >= 0 ? '+' : ''}${fmtNum(diff)} ${unit}${first > 0 ? `, ${diff >= 0 ? '+' : ''}${fmtNum((diff / first) * 100)}%` : ''})`;
}

function niceStep(raw) {
  if (!(raw > 0)) return 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}

// กราฟเส้นแบบวาด SVG เอง (ไม่ใช้ library)
function lineChart(points, key, unit, width = 420) {
  const W = Math.round(width), H = W >= 600 ? 280 : 230, L = 40, R = 14, T = 26, B = 30;
  const vals = points.map((p) => Number(p[key]));
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 5; max += 5; }
  const step = niceStep((max - min) / 4);
  let lo = Math.max(0, Math.floor(min / step) * step);
  const hi = Math.ceil(max / step) * step;
  // ขาลงและจุดสุดท้ายชิดขอบล่าง -> เผื่อที่ด้านล่างอีก 1 ช่องไว้วางป้ายค่า
  const lastVal = vals[vals.length - 1];
  if (vals.length > 1 && lastVal < vals[vals.length - 2] && (lastVal - lo) / (hi - lo) < 0.2) {
    lo = Math.max(0, lo - step);
  }
  const x = (i) => (points.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (points.length - 1));
  const y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B);

  const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `กราฟ ${METRIC[key].label}` });

  const tickCount = Math.round((hi - lo) / step);
  for (let i = 0; i <= tickCount; i++) {
    const v = lo + i * step; // นับด้วย index กันทศนิยมคลาดเคลื่อนสะสม
    chart.append(
      svg('line', { class: 'grid-line', x1: L, x2: W - R, y1: y(v), y2: y(v) }),
      svg('text', { class: 'axis-text', x: L - 8, y: y(v) + 4, 'text-anchor': 'end' }, step < 1 ? fmtNum(v) : fmtInt(v))
    );
  }
  // ป้ายวันที่ใต้แกน x (ไม่เกิน ~6 ป้าย)
  const every = Math.max(1, Math.ceil(points.length / 6));
  points.forEach((p, i) => {
    if (i % every === 0 || i === points.length - 1) {
      if (i !== points.length - 1 && points.length - 1 - i < every) return; // กันป้ายท้ายชนกัน
      chart.append(svg('text', { class: 'axis-text', x: x(i), y: H - 10, 'text-anchor': 'middle' }, fmtDate(p.workout_date)));
    }
  });

  const coords = vals.map((v, i) => `${x(i)},${y(v)}`);
  if (points.length > 1) {
    chart.append(
      svg('polygon', { class: 'area', points: `${x(0)},${y(lo)} ${coords.join(' ')} ${x(points.length - 1)},${y(lo)}` }),
      svg('polyline', { class: 'line', points: coords.join(' ') })
    );
  }
  vals.forEach((v, i) => {
    const isLast = i === vals.length - 1;
    chart.append(svg('circle', { class: `dot${isLast ? ' dot-last' : ''}`, cx: x(i), cy: y(v), r: isLast ? 5 : 3.5 },
      svg('title', {}, `${fmtDate(points[i].workout_date)}: ${fmtNum(v)} ${unit}`)));
  });
  // ป้ายค่าล่าสุด: ขาขึ้นวางเหนือจุด, ขาลงวางใต้-ซ้ายของจุด (ไม่ทับเส้น)
  const lastV = vals[vals.length - 1];
  const falling = vals.length > 1 && lastV < vals[vals.length - 2];
  const below = falling && y(lastV) + 18 < H - B;
  chart.append(svg('text', {
    class: 'value-text',
    x: x(vals.length - 1) - (below ? 10 : 0),
    y: below ? y(lastV) + 18 : y(lastV) - 12,
    'text-anchor': points.length === 1 ? 'middle' : 'end',
  }, `${fmtNum(lastV)} ${unit}`));
  return chart;
}

async function loadSessions(append) {
  const list = $('#session-list');
  const btn = $('#more-sessions');
  btn.disabled = true;
  try {
    const { sessions, has_more } = await api(`/workouts/sessions?limit=${PAGE_SIZE}&offset=${hist.offset}`);
    hist.offset += sessions.length;
    const cards = sessions.map(createSessionCard);
    if (append) list.append(...cards);
    else list.replaceChildren(...cards);
    if (!list.children.length) list.replaceChildren(h('p', { class: 'muted' }, 'ยังไม่มีประวัติ เริ่มบันทึกที่หน้า “วันนี้” ได้เลย'));
    btn.hidden = !has_more;
  } finally {
    btn.disabled = false;
  }
}

function createSessionCard(s) {
  const [y, m, d] = s.workout_date.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const body = h('div', { class: 'session-body' });
  body.hidden = true;

  const card = h('article', { class: 'session', dataset: { id: s.id } });
  const head = h('button', {
    type: 'button', class: 'session-head', 'aria-expanded': 'false',
    onClick: () => toggleSession(card, head, body, s),
  },
    h('span', { class: 'session-date' },
      h('b', {}, String(d)),
      h('span', {}, dateObj.toLocaleDateString('th-TH', { month: 'short' }))),
    h('span', { class: 'item-main' },
      h('span', { class: 'item-title' }, s.exercises.length ? s.exercises.join(' · ') : 'ไม่มีเซต'),
      h('span', { class: 'item-sub' },
        `${fmtDateLong(s.workout_date)} · ${s.completed_count}/${s.set_count} เซต · ${fmtInt(s.volume)} kg`)),
    h('span', { class: 'session-chevron', 'aria-hidden': 'true' }, '›'));

  card.append(head, body);
  return card;
}

async function toggleSession(card, head, body, summary) {
  const open = !card.classList.contains('open');
  card.classList.toggle('open', open);
  head.setAttribute('aria-expanded', String(open));
  body.hidden = !open;
  if (!open || body.dataset.loaded) return;

  body.replaceChildren(h('p', { class: 'muted' }, 'กำลังโหลด…'));
  try {
    const { session, sets } = await api(`/workouts/sessions/${summary.id}`);
    body.dataset.loaded = '1';
    renderSessionBody(card, body, session, sets);
  } catch (err) {
    body.replaceChildren(h('p', { class: 'error' }, err.message));
  }
}

function renderSessionBody(card, body, session, sets) {
  // จัดกลุ่มเซตตามท่า
  const groups = new Map();
  for (const st of sets) {
    if (!groups.has(st.exercise_name)) groups.set(st.exercise_name, []);
    groups.get(st.exercise_name).push(st);
  }
  const groupEls = [...groups].map(([name, list]) =>
    h('div', { class: 'set-group' },
      h('span', { class: 'set-group-title' }, name),
      h('div', { class: 'set-pills' }, ...list.map((st) =>
        h('span', { class: `set-pill${st.is_completed ? ' done' : ''}` },
          `${fmtNum(st.weight_kg)}×${st.reps}`)))));

  const notes = h('textarea', { rows: '2', maxlength: '2000', placeholder: 'โน้ตของวันนี้', 'aria-label': 'โน้ต' });
  notes.value = session.notes || '';
  const status = h('span', { class: 'muted small' });
  const saveBtn = h('button', {
    type: 'button', class: 'btn btn-secondary btn-sm',
    onClick: async () => {
      saveBtn.disabled = true;
      try {
        const { session: updated } = await api(`/workouts/sessions/${session.id}`, {
          method: 'PATCH', body: { notes: notes.value.trim() || null },
        });
        session.notes = updated.notes;
        if (state.session && state.session.id === session.id) {
          state.session.notes = updated.notes;
          $('#today-notes').value = updated.notes || '';
        }
        status.textContent = 'บันทึกแล้ว ✓';
      } catch (err) { toast(err.message); } finally { saveBtn.disabled = false; }
    },
  }, 'บันทึกโน้ต');
  const deleteBtn = h('button', {
    type: 'button', class: 'btn btn-ghost btn-sm',
    onClick: () => deleteSession(card, session),
  }, '🗑 ลบทั้งวัน');

  body.replaceChildren(
    ...(groupEls.length ? groupEls : [h('p', { class: 'muted' }, 'ไม่มีเซต')]),
    notes,
    h('div', { class: 'session-actions' }, h('div', {}, saveBtn, ' ', status), deleteBtn)
  );
}

async function deleteSession(card, session) {
  if (!window.confirm(`ลบการเล่นวันที่ ${fmtDateLong(session.workout_date)} ทั้งหมด?`)) return;
  try {
    await api(`/workouts/sessions/${session.id}`, { method: 'DELETE' });
    card.remove();
    hist.offset = Math.max(0, hist.offset - 1);
    toast('ลบแล้ว', false);
    if (state.session && state.session.id === session.id) await reloadToday();
    // สถิติเปลี่ยน -> โหลดส่วนบนใหม่
    const [{ summary }, { prs }] = await Promise.all([api('/stats/summary'), api('/stats/prs')]);
    $('#hs-sessions').textContent = `${summary.sessions} ครั้ง`;
    $('#hs-7d').textContent = `${summary.sessions_7d} ครั้ง`;
    $('#hs-sets').textContent = fmtInt(summary.completed_sets);
    $('#hs-volume').textContent = `${fmtInt(summary.volume)} kg`;
    renderPrs(prs);
    await loadProgress();
  } catch (err) {
    toast(err.message);
  }
}

// โหลดข้อมูลหน้า "วันนี้" ใหม่ (เช่น หลังลบ session ของวันนี้จากหน้าประวัติ)
async function reloadToday() {
  const todayRes = await api(`/workouts/sessions/today?date=${todayStr()}`);
  state.session = todayRes.session;
  state.sets = todayRes.sets;
  $('#sets-body').replaceChildren(...state.sets.map(createRow));
  $('#today-notes').value = (state.session && state.session.notes) || '';
  updateSetsView();
  prefillForm(null);
}

/* ------------------------------------------------------------------ */
/* ฟอร์มท่าเล่น (ใช้ร่วมกัน: ท่าของฉัน / ท่ากลางของ Admin)             */
/* ------------------------------------------------------------------ */
function createExerciseForm(form, { basePath, onSaved }) {
  const prefix = form.id;
  const nameInput = h('input', { id: `${prefix}-name`, type: 'text', maxlength: '100', required: true, placeholder: 'เช่น Bulgarian Split Squat' });
  const catSelect = h('select', { id: `${prefix}-cat` },
    ...state.categories.map((c) => h('option', { value: c }, CATEGORY_LABEL[c] || c)));
  const eqSelect = h('select', { id: `${prefix}-eq` },
    ...state.equipment.map((e) => h('option', { value: e }, e)));
  const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, '＋ เพิ่มท่า');
  const cancel = h('button', { type: 'button', class: 'btn btn-secondary', hidden: true, onClick: () => reset() }, 'ยกเลิก');
  let editingId = null;

  form.replaceChildren(
    h('div', { class: 'field full' }, h('label', { for: nameInput.id }, 'ชื่อท่า'), nameInput),
    h('div', { class: 'field' }, h('label', { for: catSelect.id }, 'หมวดหมู่'), catSelect),
    h('div', { class: 'field' }, h('label', { for: eqSelect.id }, 'อุปกรณ์'), eqSelect),
    h('div', { class: 'form-actions' }, submit, cancel)
  );

  function reset() {
    editingId = null;
    form.reset();
    submit.textContent = '＋ เพิ่มท่า';
    cancel.hidden = true;
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (name.length < 2) { toast('ชื่อท่าต้องยาวอย่างน้อย 2 ตัวอักษร'); nameInput.focus(); return; }
    const body = { name, category: catSelect.value, equipment_type: eqSelect.value };
    submit.disabled = true;
    try {
      if (editingId) await api(`${basePath}/${editingId}`, { method: 'PATCH', body });
      else await api(basePath, { method: 'POST', body });
      toast(editingId ? 'แก้ไขท่าแล้ว' : `เพิ่ม “${name}” แล้ว`, false);
      reset();
      await onSaved();
    } catch (err) {
      toast(err.message);
    } finally {
      submit.disabled = false;
    }
  };

  return {
    edit(ex) {
      editingId = ex.id;
      nameInput.value = ex.name;
      catSelect.value = ex.category;
      eqSelect.value = ex.equipment_type;
      submit.textContent = 'บันทึกการแก้ไข';
      cancel.hidden = false;
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      nameInput.focus();
    },
  };
}

// รายการท่าแบ่งตามหมวด; actions(ex) คืนปุ่มของแต่ละแถว
function renderExerciseList(container, exercises, { sub, actions }) {
  if (!exercises.length) {
    container.replaceChildren(h('p', { class: 'muted' }, 'ไม่พบท่า'));
    return;
  }
  const out = [];
  let lastCat = null;
  for (const ex of exercises) {
    if (ex.category !== lastCat) {
      lastCat = ex.category;
      out.push(h('p', { class: 'list-group-title' }, CATEGORY_LABEL[ex.category] || ex.category));
    }
    out.push(h('div', { class: 'item' },
      h('div', { class: 'item-main' },
        h('span', { class: 'item-title' }, ex.name, ex.is_custom ? h('span', { class: 'tag' }, 'ของฉัน') : null),
        h('span', { class: 'item-sub' }, sub(ex))),
      h('div', { class: 'item-actions' }, ...actions(ex))));
  }
  container.replaceChildren(...out);
}

/* ------------------------------------------------------------------ */
/* หน้า ท่าเล่น                                                        */
/* ------------------------------------------------------------------ */
let myExForm = null;

async function refreshExercises() {
  applyExerciseList(await api('/exercises'));
  renderExerciseSelect();
}

async function loadExercisesPage() {
  if (!myExForm) {
    myExForm = createExerciseForm($('#my-ex-form'), {
      basePath: '/exercises',
      onSaved: async () => { await refreshExercises(); renderMyExercises(); },
    });
  }
  await refreshExercises();
  renderMyExercises();
}

function renderMyExercises() {
  const q = $('#ex-search').value.trim().toLowerCase();
  const list = state.exercises.filter((ex) => !q || ex.name.toLowerCase().includes(q));
  $('#ex-count').textContent = `${state.exercises.length} ท่า · ของฉัน ${state.exercises.filter((e) => e.is_custom).length}`;
  renderExerciseList($('#ex-list'), list, {
    sub: (ex) => ex.equipment_type,
    actions: (ex) => (ex.is_custom ? [
      h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': `แก้ไข ${ex.name}`, onClick: () => myExForm.edit(ex) }, '✎'),
      h('button', {
        type: 'button', class: 'icon-btn sm delete-btn', 'aria-label': `ลบ ${ex.name}`,
        onClick: async () => {
          if (!window.confirm(`ลบท่า “${ex.name}” ?`)) return;
          try {
            await api(`/exercises/${ex.id}`, { method: 'DELETE' });
            toast('ลบท่าแล้ว', false);
            await refreshExercises();
            renderMyExercises();
          } catch (err) { toast(err.message); }
        },
      }, '🗑'),
    ] : []),
  });
}

/* ------------------------------------------------------------------ */
/* หน้า ร่างกาย: น้ำหนักตัว / %ไขมัน / มวลกล้ามเนื้อ                   */
/* ------------------------------------------------------------------ */
const body = { metrics: [], metric: 'body_fat_pct' };
const BODY_FIELDS = ['weight_kg', 'body_fat_pct', 'muscle_mass_kg'];
const BODY_INPUT = { weight_kg: '#body-weight', body_fat_pct: '#body-fat', muscle_mass_kg: '#body-muscle' };
// ทิศทางที่ "ดี": ไขมันลด = ดี, กล้ามเนื้อเพิ่ม = ดี, น้ำหนักตัวไม่ตัดสิน
const BODY_GOOD = { body_fat_pct: -1, muscle_mass_kg: 1, weight_kg: 0, fat_mass: -1 };

const fatMass = (m) => (m.weight_kg != null && m.body_fat_pct != null ? (m.weight_kg * m.body_fat_pct) / 100 : null);

async function loadBodyPage() {
  if (!$('#body-date').value) $('#body-date').value = todayStr();
  $('#body-date').max = todayStr();
  const { metrics } = await api('/body-metrics?limit=180');
  body.metrics = metrics; // ใหม่สุดก่อน
  renderBodyLatest();
  renderBodyChart();
  renderBodyList();
  fillBodyForm($('#body-date').value);
}

// ค่าล่าสุด + ค่าก่อนหน้า ของแต่ละช่อง (อาจมาจากคนละวัน)
function latestTwo(getter) {
  const vals = body.metrics.map(getter).filter((v) => v != null);
  return [vals[0] ?? null, vals[1] ?? null];
}

function renderBodyLatest() {
  const tile = (label, key, unit, getter) => {
    const [now, prev] = latestTwo(getter);
    const change = h('span', { class: 'stat-change' });
    if (now != null && prev != null) {
      const d = now - prev;
      const dir = Math.sign(Math.round(d * 100)) * BODY_GOOD[key];
      change.textContent = `${d >= 0 ? '+' : ''}${fmtNum(d.toFixed(2))} ${unit} จากครั้งก่อน`;
      if (dir > 0) change.classList.add('good');
      if (dir < 0) change.classList.add('bad');
    } else if (now != null) {
      change.textContent = 'ครั้งแรก';
    }
    return h('div', { class: 'stat' },
      h('span', { class: 'stat-label' }, label),
      h('strong', {}, now == null ? '-' : `${fmtNum(Number(now).toFixed(2))} ${unit}`),
      change);
  };
  $('#body-latest-date').textContent = body.metrics.length ? fmtDateLong(body.metrics[0].measured_on) : 'ยังไม่มีข้อมูล';
  $('#body-latest').replaceChildren(
    tile('%ไขมัน', 'body_fat_pct', '%', (m) => m.body_fat_pct),
    tile('มวลกล้ามเนื้อ', 'muscle_mass_kg', 'kg', (m) => m.muscle_mass_kg),
    tile('น้ำหนักตัว', 'weight_kg', 'kg', (m) => m.weight_kg),
    tile('มวลไขมัน (คำนวณ)', 'fat_mass', 'kg', fatMass)
  );
}

function renderBodyChart() {
  const box = $('#body-chart');
  const caption = $('#body-caption');
  document.querySelectorAll('[data-body-metric]').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.bodyMetric === body.metric)));

  const key = body.metric;
  const { label, unit } = METRIC[key];
  // แปลงเป็นรูปแบบที่ lineChart ใช้ (เก่าสุดก่อน)
  const pts = body.metrics.filter((m) => m[key] != null).reverse()
    .map((m) => ({ workout_date: m.measured_on, [key]: m[key] }));
  if (!pts.length) {
    box.replaceChildren(h('p', { class: 'muted' }, `ยังไม่มีข้อมูล${label}`));
    caption.textContent = '';
    return;
  }
  box.replaceChildren(lineChart(pts, key, unit, Math.min(900, Math.max(420, box.clientWidth))));
  const first = Number(pts[0][key]);
  const last = Number(pts[pts.length - 1][key]);
  const diff = last - first;
  caption.textContent = pts.length < 2
    ? `${label}: ${fmtNum(last)} ${unit} (วัด 1 ครั้ง)`
    : `${label} ${pts.length} ครั้ง: ${fmtNum(first)} → ${fmtNum(last)} ${unit} (${diff >= 0 ? '+' : ''}${fmtNum(diff.toFixed(2))} ${unit})`;
}

function renderBodyList() {
  const list = $('#body-list');
  $('#body-count').textContent = `${body.metrics.length} ครั้ง`;
  if (!body.metrics.length) {
    list.replaceChildren(h('p', { class: 'muted' }, 'ยังไม่มีข้อมูล ลองบันทึกครั้งแรกจากเครื่องชั่งหรือเครื่อง InBody'));
    return;
  }
  list.replaceChildren(...body.metrics.map((m) => {
    const parts = [];
    if (m.weight_kg != null) parts.push(`น้ำหนัก ${fmtNum(m.weight_kg)} kg`);
    if (m.body_fat_pct != null) parts.push(`ไขมัน ${fmtNum(m.body_fat_pct)}%`);
    if (m.muscle_mass_kg != null) parts.push(`กล้ามเนื้อ ${fmtNum(m.muscle_mass_kg)} kg`);
    const fm = fatMass(m);
    return h('div', { class: 'item' },
      h('div', { class: 'item-main' },
        h('span', { class: 'item-title' }, fmtDateLong(m.measured_on)),
        h('span', { class: 'item-sub' }, parts.join(' · ')),
        fm != null ? h('span', { class: 'item-sub' }, `มวลไขมัน ≈ ${fmtNum(fm.toFixed(1))} kg`) : null),
      h('div', { class: 'item-actions' },
        h('button', {
          type: 'button', class: 'icon-btn sm', 'aria-label': `แก้ไขวันที่ ${m.measured_on}`,
          onClick: () => {
            $('#body-date').value = m.measured_on;
            fillBodyForm(m.measured_on);
            $('#body-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
          },
        }, '✎'),
        h('button', {
          type: 'button', class: 'icon-btn sm delete-btn', 'aria-label': `ลบวันที่ ${m.measured_on}`,
          onClick: () => deleteBodyMetric(m),
        }, '🗑')));
  }));
}

// เลือกวันที่ที่เคยบันทึกแล้ว -> เติมค่าเดิมในฟอร์ม (บันทึกซ้ำ = แก้ไข)
function fillBodyForm(date) {
  const found = body.metrics.find((m) => m.measured_on === date);
  for (const f of BODY_FIELDS) $(BODY_INPUT[f]).value = found && found[f] != null ? fmtNum(found[f]) : '';
  $('#body-submit').textContent = found ? 'บันทึกการแก้ไข' : 'บันทึก';
}

async function onBodySubmit(e) {
  e.preventDefault();
  const date = $('#body-date').value;
  if (!date) { toast('กรุณาเลือกวันที่'); return; }
  const payload = { measured_on: date };
  for (const f of BODY_FIELDS) {
    const raw = $(BODY_INPUT[f]).value.trim();
    payload[f] = raw === '' ? null : Number(raw);
  }
  if (BODY_FIELDS.every((f) => payload[f] === null)) {
    toast('กรอกอย่างน้อย 1 ค่า');
    $('#body-fat').focus();
    return;
  }
  const btn = $('#body-submit');
  btn.disabled = true;
  try {
    await api('/body-metrics', { method: 'POST', body: payload });
    toast('บันทึกค่าร่างกายแล้ว', false);
    await loadBodyPage();
  } catch (err) {
    toast(err.message);
  } finally {
    btn.disabled = false;
  }
}

async function deleteBodyMetric(m) {
  if (!window.confirm(`ลบข้อมูลวันที่ ${fmtDateLong(m.measured_on)} ?`)) return;
  try {
    await api(`/body-metrics/${m.id}`, { method: 'DELETE' });
    toast('ลบแล้ว', false);
    await loadBodyPage();
  } catch (err) {
    toast(err.message);
  }
}

/* ------------------------------------------------------------------ */
/* หน้า Admin                                                          */
/* ------------------------------------------------------------------ */
let adminExForm = null;
let userSearchTimer = null;

async function loadAdminPage() {
  if (!adminExForm) {
    adminExForm = createExerciseForm($('#admin-ex-form'), {
      basePath: '/admin/exercises',
      onSaved: async () => { await loadAdminExercises(); await refreshExercises(); },
    });
  }
  await Promise.all([loadAdminStats(), loadAdminUsers(), loadAdminExercises()]);
}

async function loadAdminStats() {
  const { totals, top_exercises } = await api('/admin/stats');
  const stat = (label, value) => h('div', { class: 'stat' }, h('span', { class: 'stat-label' }, label), h('strong', {}, value));
  $('#admin-stats').replaceChildren(
    stat('ผู้ใช้ทั้งหมด', fmtInt(totals.users)),
    stat('ผู้ใช้ใหม่ 7 วัน', fmtInt(totals.new_users_7d)),
    stat('ใช้งาน 7 วัน', fmtInt(totals.active_users_7d)),
    stat('Sessions', fmtInt(totals.sessions)),
    stat('เซตทั้งหมด', fmtInt(totals.sets)),
    stat('ท่ากลาง / ท่าผู้ใช้', `${totals.global_exercises} / ${totals.custom_exercises}`)
  );
  $('#admin-top').replaceChildren(...(top_exercises.length ? top_exercises.map((t, i) =>
    h('div', { class: 'item' },
      h('span', { class: 'item-value' }, `#${i + 1}`),
      h('div', { class: 'item-main' },
        h('span', { class: 'item-title' }, t.name),
        h('span', { class: 'item-sub' }, `ผู้ใช้ ${t.user_count} คน`)),
      h('span', { class: 'item-value' }, `${fmtInt(t.set_count)} เซต`)))
    : [h('p', { class: 'muted' }, 'ยังไม่มีข้อมูลการเล่น')]));
}

async function loadAdminUsers() {
  const q = $('#user-search').value.trim();
  const { users } = await api(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  $('#admin-user-count').textContent = `${users.length} คน`;
  if (!users.length) { $('#admin-users').replaceChildren(h('p', { class: 'muted' }, 'ไม่พบผู้ใช้')); return; }

  $('#admin-users').replaceChildren(...users.map((u) => {
    const isMe = u.id === state.user.id;
    const roleBtn = h('button', {
      type: 'button', class: 'btn btn-secondary btn-sm', disabled: isMe,
      title: isMe ? 'เปลี่ยน role ของตัวเองไม่ได้' : undefined,
      onClick: async () => {
        const next = u.role === 'ADMIN' ? 'USER' : 'ADMIN';
        if (!window.confirm(`เปลี่ยน ${u.name} เป็น ${next}?`)) return;
        roleBtn.disabled = true;
        try {
          await api(`/admin/users/${u.id}`, { method: 'PATCH', body: { role: next } });
          toast(`${u.name} เป็น ${next} แล้ว`, false);
          await loadAdminUsers();
        } catch (err) { toast(err.message); roleBtn.disabled = false; }
      },
    }, u.role === 'ADMIN' ? 'ถอด Admin' : 'ตั้งเป็น Admin');

    return h('div', { class: 'item' },
      h('div', { class: 'item-main' },
        h('span', { class: 'item-title' }, u.name,
          u.role === 'ADMIN' ? h('span', { class: 'tag tag-admin' }, 'ADMIN') : null,
          isMe ? h('span', { class: 'tag' }, 'คุณ') : null),
        h('span', { class: 'item-sub' }, u.email),
        h('span', { class: 'item-sub' },
          `${u.session_count} ครั้ง · ล่าสุด ${u.last_workout ? fmtDate(u.last_workout) : '-'} · สมัคร ${fmtDate(u.created_at.slice(0, 10))}`)),
      roleBtn);
  }));
}

async function loadAdminExercises() {
  const res = await api('/admin/exercises');
  renderExerciseList($('#admin-ex-list'), res.exercises, {
    sub: (ex) => `${ex.equipment_type} · ใช้แล้ว ${fmtInt(ex.usage_count)} เซต`,
    actions: (ex) => [
      h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': `แก้ไข ${ex.name}`, onClick: () => adminExForm.edit(ex) }, '✎'),
      h('button', {
        type: 'button', class: 'icon-btn sm delete-btn', 'aria-label': `ลบ ${ex.name}`,
        disabled: ex.usage_count > 0,
        title: ex.usage_count > 0 ? 'มีประวัติการเล่นแล้ว ลบไม่ได้' : undefined,
        onClick: async () => {
          if (!window.confirm(`ลบท่ากลาง “${ex.name}” ?`)) return;
          try {
            await api(`/admin/exercises/${ex.id}`, { method: 'DELETE' });
            toast('ลบท่าแล้ว', false);
            await loadAdminExercises();
            await refreshExercises();
          } catch (err) { toast(err.message); }
        },
      }, '🗑'),
    ],
  });
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */
function bindEvents() {
  $('#tab-login').addEventListener('click', () => setAuthMode('login'));
  $('#tab-register').addEventListener('click', () => setAuthMode('register'));
  $('#auth-form').addEventListener('submit', onAuthSubmit);
  $('#logout-btn').addEventListener('click', onLogout);

  $('#exercise').addEventListener('change', onExerciseChange);
  $('#set-form').addEventListener('submit', onAddSet);
  $('#set-form').addEventListener('click', onStepClick);

  $('#rest-minus').addEventListener('click', () => adjustRestTimer(-15));
  $('#rest-plus').addEventListener('click', () => adjustRestTimer(15));
  $('#rest-skip').addEventListener('click', stopRestTimer);
  $('#rest-close').addEventListener('click', stopRestTimer);

  $('#rest-select').addEventListener('change', onRestChange);
  $('#today-notes').addEventListener('input', onNotesInput);
  $('#today-notes').addEventListener('blur', saveNotes);

  window.addEventListener('hashchange', route);
  // ย่อ/ขยายหน้าต่าง -> วาดกราฟใหม่ให้พอดีความกว้าง
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (currentPage === 'history') renderProgress();
      if (currentPage === 'body') renderBodyChart();
    }, 150);
  });
  $('#progress-exercise').addEventListener('change', () => loadProgress().catch((err) => toast(err.message)));
  document.querySelectorAll('[data-metric]').forEach((btn) =>
    btn.addEventListener('click', () => { hist.metric = btn.dataset.metric; renderProgress(); }));
  $('#more-sessions').addEventListener('click', () => loadSessions(true).catch((err) => toast(err.message)));

  $('#ex-search').addEventListener('input', renderMyExercises);

  $('#body-form').addEventListener('submit', onBodySubmit);
  $('#body-date').addEventListener('change', () => fillBodyForm($('#body-date').value));
  document.querySelectorAll('[data-body-metric]').forEach((btn) =>
    btn.addEventListener('click', () => { body.metric = btn.dataset.bodyMetric; renderBodyChart(); }));
  $('#user-search').addEventListener('input', () => {
    clearTimeout(userSearchTimer);
    userSearchTimer = setTimeout(() => loadAdminUsers().catch((err) => toast(err.message)), 300);
  });
}

async function boot() {
  bindEvents();
  setAuthMode('login');

  let user = null;
  try {
    ({ user } = await api('/auth/me'));
  } catch {
    showView('auth');
    return;
  }

  state.user = user;
  try {
    await enterTracker();
  } catch (err) {
    toast(err.message);
  }
}

boot();