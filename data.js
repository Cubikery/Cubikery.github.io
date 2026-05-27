/* STAFF LOCATOR — DATA & UTILITIES */

const PERIOD_TIMES = [
  { period: 1, start: '08:50', end: '09:50', label: 'Period 1' },
  { period: 2, start: '09:50', end: '10:50', label: 'Period 2' },
  { period: 0, start: '10:50', end: '11:10', label: 'Morning break', isBreak: true },
  { period: 3, start: '11:10', end: '12:10', label: 'Period 3' },
  { period: 4, start: '12:10', end: '13:10', label: 'Period 4' },
  { period: 0, start: '13:10', end: '14:00', label: 'Lunch',         isBreak: true },
  { period: 5, start: '14:00', end: '15:00', label: 'Period 5' },
];

const AVATAR_PALETTE = [
  '#4f6fa8', '#9e6b4a', '#4a7a5a', '#7a5490',
  '#b08030', '#3d7a8a', '#7040a0', '#6b5840',
];

function initials(name) {
  return name
    .replace(/^(Dr|Mrs|Mr|Ms|Prof)\.?\s+/i, '')
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function avatarStyle(idx) {
  return `background:${AVATAR_PALETTE[idx % AVATAR_PALETTE.length]};`;
}

/* ─── Teachers ─────────────────────────────────────────────────────────── */
const TEACHERS = [
  { id: 't01', name: 'Mrs Wilde',   subject: 'Digital Technology' },
  { id: 't02', name: 'Mr Smith',    subject: 'English' },
  { id: 't03', name: 'Mrs Johnson', subject: 'Mathematics' },
  { id: 't04', name: 'Mr Brown',    subject: 'Science' },
  { id: 't05', name: 'Ms Davis',    subject: 'History' },
  { id: 't06', name: 'Mr Taylor',   subject: 'Physical Education' },
  { id: 't07', name: 'Ms Anderson', subject: 'Art' },
  { id: 't08', name: 'Mr Thomas',   subject: 'Music' },
];

/* TIMETABLE[teacherId][periodNumber] → { class, room } | null */
const TIMETABLE = {
  t01: { 1: { class: '13 DGT', room: 'JP11' }, 2: { class: '11 DGT', room: 'JP12' }, 3: null,                              4: { class: '12 DGT', room: 'JP11' }, 5: { class: '10 DGT', room: 'JP14' } },
  t02: { 1: { class: '12 ENG', room: 'B04'  }, 2: null,                              3: { class: '10 ENG', room: 'B04'  }, 4: { class: '11 ENG', room: 'B05'  }, 5: null                              },
  t03: { 1: null,                              2: { class: '13 MAT', room: 'A01'  }, 3: { class: '11 MAT', room: 'A02'  }, 4: null,                              5: { class: '12 MAT', room: 'A01'  } },
  t04: { 1: { class: '10 SCI', room: 'C12'  }, 2: { class: '12 SCI', room: 'C11'  }, 3: null,                              4: { class: '11 SCI', room: 'C12'  }, 5: { class: '13 SCI', room: 'C10'  } },
  t05: { 1: null,                              2: { class: '12 HIS', room: 'D03'  }, 3: { class: '10 HIS', room: 'D03'  }, 4: null,                              5: { class: '11 HIS', room: 'D04'  } },
  t06: { 1: { class: '11 PE',  room: 'GYM'  }, 2: null,                              3: { class: '13 PE',  room: 'OVAL' }, 4: { class: '10 PE',  room: 'GYM'  }, 5: null                              },
  t07: { 1: { class: '10 ART', room: 'E07'  }, 2: null,                              3: null,                              4: { class: '12 ART', room: 'E07'  }, 5: { class: '11 ART', room: 'E07'  } },
  t08: { 1: null,                              2: { class: '11 MUS', room: 'F01'  }, 3: { class: '13 MUS', room: 'F01'  }, 4: null,                              5: { class: '10 MUS', room: 'F02'  } },
};

/* ─── Absent — localStorage, cleared overnight ──────────────────────────── */
const ABSENT_KEY      = 'staff-locator-absent';
const ABSENT_DATE_KEY = 'staff-locator-absent-date';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function clearIfNewDay() {
  try {
    if (localStorage.getItem(ABSENT_DATE_KEY) !== todayKey()) {
      localStorage.removeItem(ABSENT_KEY);
      localStorage.setItem(ABSENT_DATE_KEY, todayKey());
    }
  } catch (_) {}
}

function loadAbsent() {
  clearIfNewDay();
  try {
    const raw = localStorage.getItem(ABSENT_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (_) { return new Set(); }
}

function saveAbsent(set) {
  try {
    localStorage.setItem(ABSENT_KEY, JSON.stringify([...set]));
    localStorage.setItem(ABSENT_DATE_KEY, todayKey());
  } catch (_) {}
}

function isAbsent(id)    { return loadAbsent().has(id); }
function markAbsent(id)  { const s = loadAbsent(); s.add(id);    saveAbsent(s); }
function markPresent(id) { const s = loadAbsent(); s.delete(id); saveAbsent(s); }
function listAbsent()    { return [...loadAbsent()]; }

/* ─── Period detection ──────────────────────────────────────────────────── */
function currentPeriodInfo(now = new Date()) {
  const dow = now.getDay();
  if (dow === 0 || dow === 6) {
    return { state: 'closed', label: 'Weekend — school closed', period: null };
  }
  const hhmm = now.toTimeString().slice(0, 5);
  if (hhmm < PERIOD_TIMES[0].start) {
    return { state: 'closed', label: 'Before school', period: null };
  }
  if (hhmm >= PERIOD_TIMES[PERIOD_TIMES.length - 1].end) {
    return { state: 'closed', label: 'After school', period: null };
  }
  for (const slot of PERIOD_TIMES) {
    if (hhmm >= slot.start && hhmm < slot.end) {
      if (slot.isBreak) return { state: 'break', label: slot.label, period: null };
      return { state: 'in-class', label: slot.label, period: slot.period };
    }
  }
  return { state: 'closed', label: 'Outside school hours', period: null };
}

function teacherStatus(teacherId, now = new Date()) {
  if (isAbsent(teacherId)) {
    return { state: 'absent', label: 'Absent today', class: null, room: null };
  }
  const p = currentPeriodInfo(now);
  if (p.state === 'closed') return { state: 'away', label: p.label,                    class: null, room: null };
  if (p.state === 'break')  return { state: 'away', label: 'On ' + p.label.toLowerCase(), class: null, room: null };
  const slot = TIMETABLE[teacherId]?.[p.period];
  if (!slot) return { state: 'away', label: 'Free period', class: null, room: null };
  return { state: 'in-class', label: 'In class now', class: slot.class, room: slot.room };
}

/* ─── Shared pointer-drag utility ───────────────────────────────────────── */
function makeDraggable(card, onDrop, getTarget) {
  let clone = null, startX, startY, moved = false, pointerId = null;

  card.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    pointerId = e.pointerId;
    startX = e.clientX; startY = e.clientY;
    moved = false;
    try { card.setPointerCapture(e.pointerId); } catch (_) {}
    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerup',   onUp);
    card.addEventListener('pointercancel', cleanup);
  });

  function onMove(e) {
    if (e.pointerId !== pointerId) return;
    if (!moved && Math.hypot(e.clientX - startX, e.clientY - startY) < 6) return;
    if (!moved) {
      moved = true;
      const rect = card.getBoundingClientRect();
      clone = card.cloneNode(true);
      clone.className = 'faculty-card faculty-card-clone';
      Object.assign(clone.style, { width: rect.width+'px', height: rect.height+'px', left: rect.left+'px', top: rect.top+'px' });
      card._ox = e.clientX - rect.left;
      card._oy = e.clientY - rect.top;
      document.body.appendChild(clone);
      card.classList.add('dragging');
    }
    clone.style.left = (e.clientX - card._ox) + 'px';
    clone.style.top  = (e.clientY - card._oy) + 'px';
    const t = getTarget();
    if (t) t.classList.toggle('dragover', _isOver(t, e.clientX, e.clientY));
  }

  function onUp(e) {
    const wasMoved = moved;
    cleanup();
    if (wasMoved) {
      const t = getTarget();
      if (t && _isOver(t, e.clientX, e.clientY)) onDrop();
      card.dataset.justDragged = '1';
    }
  }

  function cleanup() {
    card.removeEventListener('pointermove', onMove);
    card.removeEventListener('pointerup',   onUp);
    card.removeEventListener('pointercancel', cleanup);
    if (clone) { clone.remove(); clone = null; }
    card.classList.remove('dragging');
    const t = getTarget();
    if (t) t.classList.remove('dragover');
    moved = false;
  }
}

function _isOver(el, x, y) {
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

/* ─── Undo toast ────────────────────────────────────────────────────────── */
let _toastTimer = null;

function showToast(msg, undoFn) {
  let toast = document.getElementById('sl-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'sl-toast';
    document.body.appendChild(toast);
  }
  clearTimeout(_toastTimer);
  toast.innerHTML = `<span>${msg}</span>`;
  if (undoFn) {
    const btn = document.createElement('button');
    btn.textContent = 'Undo';
    btn.onclick = () => { undoFn(); toast.classList.remove('visible'); };
    toast.appendChild(btn);
  }
  toast.classList.add('visible');
  _toastTimer = setTimeout(() => toast.classList.remove('visible'), 4000);
}

/* ─── Custom teachers — localStorage, persisted across sessions ─────────── */
const CUSTOM_KEY = 'staff-locator-teachers';

function loadCustomTeachers() {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) { return []; }
}

function saveCustomTeachers(arr) {
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(arr)); } catch (_) {}
}

function getTeachers() {
  return [...TEACHERS, ...loadCustomTeachers()];
}

function addTeacher(name, subject) {
  const t = { id: 'tc' + Date.now(), name: name.trim(), subject: subject.trim() };
  const custom = loadCustomTeachers();
  custom.push(t);
  saveCustomTeachers(custom);
  return t;
}

function removeTeacher(id) {
  saveCustomTeachers(loadCustomTeachers().filter(t => t.id !== id));
}

function isCustomTeacher(id) {
  return !TEACHERS.some(t => t.id === id);
}

/* ─── Exports ───────────────────────────────────────────────────────────── */
window.StaffLocatorData = {
  ABSENT_KEY,
  CUSTOM_KEY,
  TEACHERS,
  getTeachers,
  addTeacher,
  removeTeacher,
  isCustomTeacher,
  initials,
  avatarStyle,
  currentPeriodInfo,
  teacherStatus,
  isAbsent,
  markAbsent,
  markPresent,
  listAbsent,
  makeDraggable,
  showToast,
};
