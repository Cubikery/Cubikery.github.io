const ANCHOR_DATE = '2026-06-23';
// ============================================
// DATA
// ============================================
let allLessons = [];
let allTeachers = [];
let currentTeacher = null;
let absentPeriods = {};
let draggedTeacherName = null;

const SCHOOL_DAY = {
    periods: [
        { period: 0, start: '08:40', end: '08:50', label: 'Roll call' },
        { period: 1, start: '08:50', end: '09:40', label: 'Period 1' },
        { period: 2, start: '09:40', end: '10:30', label: 'Period 2' },
        { period: 3, start: '10:30', end: '10:50', label: 'Morning break' },
        { period: 4, start: '10:50', end: '11:40', label: 'Period 3' },
        { period: 5, start: '11:40', end: '12:30', label: 'Period 4' },
        { period: 6, start: '12:30', end: '13:50', label: 'Lunch' },
        { period: 7, start: '13:50', end: '14:40', label: 'Period 5' },
        { period: 8, start: '14:40', end: '15:30', label: 'Period 6' }
    ],
    schoolDays: [1, 2, 3, 4, 5],
    breakPeriods: [0, 3, 6],
    breakLabels: { 0: 'Roll call', 3: 'Morning break', 6: 'Lunch' },
    teachingPeriods: [1, 2, 4, 5, 7, 8]
};

// ============================================
// SIMPLE ABSENCE STORAGE
// ============================================
function saveAbsences() {
    // Convert Sets to simple objects for storage
    const data = {};
    for (const [name, periods] of Object.entries(absentPeriods)) {
        data[name] = Array.from(periods);
    }
    localStorage.setItem('absences', JSON.stringify(data));
}

function loadAbsences() {
    const saved = localStorage.getItem('absences');
    if (saved) {
        const data = JSON.parse(saved);
        for (const [name, periods] of Object.entries(data)) {
            absentPeriods[name] = new Set(periods);
        }
    }
}
// Load saved absences when page loads
loadAbsences();

// ============================================
// TIMETABLE DAY
// ============================================
function getEffectiveTimetableDay() {
    const from = new Date(ANCHOR_DATE + 'T00:00:00');
    const to = new Date();
    to.setHours(0, 0, 0, 0);
    const elapsed = Math.floor((to - from) / (1000 * 60 * 60 * 24));
    return elapsed % 7+1;
}

// ============================================
// CSV PARSING
// ============================================
function parseCSV(text) {
    const lines = text.split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].trim().split(',');
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',');
        if (!vals.length) continue;
        const entry = {};
        headers.forEach((h, idx) => {
            let v = vals[idx] || '';
            if (h === 'day' || h === 'period') v = parseInt(v, 10);
            entry[h] = v;
        });
        data.push({
            teacher: entry.teacher || '',
            tutorGroup: entry.tutor_group || '',
            day: entry.day,
            period: entry.period,
            className: entry.class || '',
            room: entry.room || ''
        });
    }
    return data.filter(d => d.teacher);
}

async function loadCSV() {
    const resp = await fetch('timetable.csv');
    const text = await resp.text();
    allLessons = parseCSV(text);
    const set = new Set();
    allLessons.forEach(l => set.add(l.teacher));
    allTeachers = Array.from(set).sort();
    loadAbsences();
    renderList();
    setupDragDrop();
    setupTouchDrag();
    updateUI();
}

// ============================================
// ABSENT PERIODS
// ============================================
function getAbsencePeriodsForTeacher(name) {
    return absentPeriods[name] || new Set();
}

function isAbsentAtPeriod(name, period) {
    const set = absentPeriods[name];
    return !!(set && set.has(period));
}

function isFullyAbsentToday(name) {
    const set = getAbsencePeriodsForTeacher(name);
    return set.size > 0 && SCHOOL_DAY.teachingPeriods.every(p => set.has(p));
}

function getPeriodLabel(p) {
    const info = SCHOOL_DAY.periods.find(s => s.period === p);
    return info ? info.label : ('Period ' + p);
}

function formatAbsencePeriods(set, compact) {
    return SCHOOL_DAY.teachingPeriods
        .filter(p => set.has(p))
        .map(p => compact ? getPeriodLabel(p).replace('Period ', 'P') : getPeriodLabel(p))
        .join(', ');
}

function togglePeriodAbsence(name, period) {
    if (!name) return;
    if (!absentPeriods[name]) absentPeriods[name] = new Set();
    if (absentPeriods[name].has(period)) {
        absentPeriods[name].delete(period);
    } else {
        absentPeriods[name].add(period);
    }
    if (absentPeriods[name].size === 0) delete absentPeriods[name];
    saveAbsences();
    renderList();
    if (currentTeacher === name) showTimetable(name);
}

function setWholeDayAbsence(name, makeAbsent) {
    if (!name) return;
    if (makeAbsent) {
        absentPeriods[name] = new Set(SCHOOL_DAY.teachingPeriods);
    } else {
        delete absentPeriods[name];
    }
    saveAbsences();
    renderList();
    if (currentTeacher === name) showTimetable(name);
}

function toggleWholeDayAbsence(name) {
    setWholeDayAbsence(name, !isFullyAbsentToday(name));
}

// ============================================
// TIME & STATUS
// ============================================
function getCurrentPeriod() {
    const now = new Date();
    const weekDay = now.getDay();
    const timetableDay = getEffectiveTimetableDay();
    const isSchoolDay = [1, 2, 3, 4, 5].includes(weekDay);
    const time = now.toTimeString().slice(0, 5);
    let period = null;
    for (const slot of SCHOOL_DAY.periods) {
        if (time >= slot.start && time < slot.end) {
            period = slot.period;
            break;
        }
    }
    if (period === null) {
        const first = SCHOOL_DAY.periods[0];
        const last = SCHOOL_DAY.periods[SCHOOL_DAY.periods.length - 1];
        if (time < first.start) return { period: 'before_school', isSchoolDay, weekDay, timetableDay };
        if (time >= last.end) return { period: 'after_school', isSchoolDay, weekDay, timetableDay };
        return { period: null, isSchoolDay, weekDay, timetableDay };
    }
    return { period, isSchoolDay, weekDay, timetableDay };
}

function getTeacherStatus(name) {
    const cur = getCurrentPeriod();
    if (typeof cur.period === 'number' && isAbsentAtPeriod(name, cur.period)) {
        return { status: 'absent', message: 'ABSENT', colorClass: 'red' };
    }
    if (isFullyAbsentToday(name)) {
        return { status: 'absent', message: 'ABSENT', colorClass: 'red' };
    }
    if (!cur.isSchoolDay) return { status: 'weekend', message: 'Weekend', colorClass: 'neutral' };
    if (cur.period === 'before_school') return { status: 'before_school', message: 'Before school', colorClass: 'amber' };
    if (cur.period === 'after_school') return { status: 'after_school', message: 'After school', colorClass: 'amber' };
    if (cur.period === null) return { status: 'between_periods', message: 'Between periods', colorClass: 'amber' };
    if (SCHOOL_DAY.breakPeriods.includes(cur.period)) {
        const label = SCHOOL_DAY.breakLabels[cur.period] || 'Break';
        return { status: 'break', message: label, colorClass: 'amber' };
    }
    if (SCHOOL_DAY.teachingPeriods.includes(cur.period)) {
        const lessons = allLessons.filter(l =>
            l.teacher === name && l.day === cur.timetableDay && l.period === cur.period
        );
        if (lessons.length) {
            return { status: 'teaching', message: 'In class now', colorClass: 'green', lesson: lessons[0] };
        } else {
            return { status: 'free', message: 'Free', colorClass: 'neutral' };
        }
    }
    return { status: 'not_timetabled', message: 'Not timetabled', colorClass: 'neutral' };
}

function getTeacherLessons(name) {
    return allLessons.filter(l => l.teacher === name)
        .sort((a, b) => a.day - b.day || a.period - b.period);
}

// ============================================
// PERIOD PICKER EVENTS
// ============================================
function attachPeriodPickerEvents() {
    document.querySelectorAll('.period-chip').forEach(btn => {
        btn.onclick = function() {
            const tn = btn.getAttribute('data-teacher');
            const period = parseInt(btn.getAttribute('data-period'), 10);
            if (tn && !isNaN(period)) togglePeriodAbsence(tn, period);
        };
    });
    document.querySelectorAll('.period-picker-actions .link-btn').forEach(btn => {
        btn.onclick = function() {
            const tn = btn.getAttribute('data-teacher');
            const action = btn.getAttribute('data-action');
            if (!tn) return;
            if (action === 'whole-day') toggleWholeDayAbsence(tn);
            if (action === 'clear') setWholeDayAbsence(tn, false);
        };
    });
}

// ============================================
// RENDER TIMETABLE
// ============================================
function showTimetable(name) {
    if (!name) { updateUI(); return; }
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    document.getElementById('selectedTeacherName').innerText = name;

    if (isLoggedIn) {
        const absences = getAbsencePeriodsForTeacher(name);
        const periods = SCHOOL_DAY.teachingPeriods;
        const fullyAbsent = isFullyAbsentToday(name);
        const summary = absences.size === 0
            ? 'Not marked absent'
            : (fullyAbsent ? 'Absent all day' : absences.size + ' period' + (absences.size > 1 ? 's' : '') + ' marked absent');

        const chips = periods.map(p => {
            const isOff = absences.has(p);
            return `<button class="period-chip ${isOff ? 'absent' : ''}" data-teacher="${escapeHtml(name)}" data-period="${p}">
                <span class="chip-check">${isOff ? '✓' : ''}</span>${escapeHtml(getPeriodLabel(p))}
            </button>`;
        }).join('');

        document.getElementById('statusDisplay').innerHTML = `
            <div class="msg">${summary}</div>
        `;
        document.getElementById('timetableView').innerHTML = `
            <div class="period-picker">
                <div class="period-picker-label">Tick the periods ${escapeHtml(name)} is away for</div>
                <div class="period-grid">${chips}</div>
                <div class="period-picker-actions">
                    <button class="link-btn" data-action="whole-day" data-teacher="${escapeHtml(name)}">
                        ${fullyAbsent ? 'Mark present' : 'Mark whole day absent'}
                    </button>
                    ${absences.size && !fullyAbsent ? `<button class="link-btn" data-action="clear" data-teacher="${escapeHtml(name)}">Clear all</button>` : ''}
                </div>
            </div>
        `;
        attachPeriodPickerEvents();
        return;
    }

    const lessons = getTeacherLessons(name);
    const status = getTeacherStatus(name);
    const absentNow = status.status === 'absent';
    const cur = getCurrentPeriod();
    const today = cur.timetableDay;
    let todayLessons = lessons.filter(l => l.day === today);
    let currentLesson = null;
    if (todayLessons.length && cur.period !== null &&
        cur.period !== 'before_school' && cur.period !== 'after_school') {
        currentLesson = todayLessons.find(l => l.period === cur.period);
    }

    let statusHtml = '';
    if (absentNow) {
        statusHtml = `<div class="badge-lg pill-red">ABSENT</div>`;
    } else {
        let cls = '', room = '', show = false;
        if (status.status === 'teaching' && currentLesson) {
            cls = currentLesson.className || '';
            room = currentLesson.room || '';
            show = true;
        }
        let details = '';
        if (show) {
            details = `<div class="details">
                ${cls ? `<div class="item">
                    <span class="label">Class</span>
                    <span class="value class">${escapeHtml(cls)}</span>
                </div>` : ''}
                ${room ? `<div class="item">
                    <span class="label">Room</span>
                    <span class="value room">${escapeHtml(room)}</span>
                </div>` : ''}
            </div>`;
        } else {
            let msg = '';
            switch (status.status) {
                case 'free': msg = 'No class scheduled at this time'; break;
                case 'not_timetabled': msg = 'No timetable data available'; break;
                case 'before_school': msg = 'School day has not started yet'; break;
                case 'after_school': msg = 'School day has ended'; break;
                case 'between_periods': msg = 'Between periods'; break;
                case 'break': msg = 'Break time'; break;
                case 'weekend': msg = 'Weekend'; break;
            }
            if (msg) details = `<div class="msg">${msg}</div>`;
        }
        statusHtml = `
            <div class="badge-lg pill-${status.colorClass}">
                ${status.status === 'teaching' ? 'In class now' : status.message}
            </div>
            ${details}
        `;
    }
    document.getElementById('statusDisplay').innerHTML = statusHtml;

    if (!today) {
        document.getElementById('timetableView').innerHTML =
            '<div class="empty">No school today</div>';
        return;
    }
    const map = {};
    todayLessons.forEach(l => map[l.period] = l);
    let html = `<div class="day-header">Day ${today} schedule</div>`;
    SCHOOL_DAY.teachingPeriods.forEach(p => {
        const info = SCHOOL_DAY.periods.find(s => s.period === p);
        const label = info ? info.label : 'Period ' + p;
        const time = info ? info.start + '–' + info.end : '';
        const isBreak = SCHOOL_DAY.breakPeriods.includes(p);
        const lesson = map[p];
        const isCur = cur.isSchoolDay && cur.timetableDay === today && cur.period === p;
        const isRowAbsent = !isBreak && isAbsentAtPeriod(name, p);
        let cls = 'lesson';
        if (isCur) cls += ' current';
        if (isRowAbsent) cls += ' absent';
        let classDisplay = 'Free', roomDisplay = '', isFree = true;
        if (lesson) {
            classDisplay = lesson.className || 'Free';
            roomDisplay = lesson.room || '';
            isFree = false;
        }
        if (isBreak) {
            classDisplay = label;
            roomDisplay = '';
            isFree = false;
        }
        html += `<div class="${cls}">
            <span class="period">${label}</span>
            <span class="time">${time}</span>
            ${isBreak ? `<span class="class break">${label}</span>` :
            `<span class="class${isFree ? ' is-free' : ''}">${escapeHtml(classDisplay)}</span>`}
            ${roomDisplay ? `<span class="room">${escapeHtml(roomDisplay)}</span>` : '<span></span>'}
            ${isRowAbsent ? '<span class="away-badge">Away</span>' :
            (isCur && !isBreak ? '<span class="cur-badge">Now</span>' : '<span></span>')}
        </div>`;
    });
    document.getElementById('timetableView').innerHTML = html;
}

// ============================================
// RENDER TEACHER LIST
// ============================================
function renderList() {
    const search = document.getElementById('searchInput').value.toLowerCase().trim();
    let filtered = allTeachers;
    if (search) {
        filtered = allTeachers.filter(t => {
            if (t.toLowerCase().includes(search)) return true;
            return getTeacherLessons(t).some(l =>
                (l.className && l.className.toLowerCase().includes(search)) ||
                (l.tutorGroup && l.tutorGroup.toLowerCase().includes(search)) ||
                (l.room && l.room.toLowerCase().includes(search))
            );
        });
    }
    const container = document.getElementById('teacherListContainer');
    if (!filtered.length) {
        container.innerHTML = `<div class="no-results">No teachers match "${search}"</div>`;
        return;
    }
    document.getElementById('teacherCount').textContent =
        filtered.length + ' / ' + allTeachers.length;

    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    let html = '';
    filtered.forEach(t => {
        const active = currentTeacher === t ? 'active' : '';
        const status = getTeacherStatus(t);
        const absentNow = status.status === 'absent';
        const fullyAbsentToday = isFullyAbsentToday(t);
        const absences = getAbsencePeriodsForTeacher(t);
        const hasPartialAbsence = absences.size > 0 && !fullyAbsentToday;
        const config = {
            'teaching': { label: 'Teaching', cls: 'teaching' },
            'free': { label: 'Free', cls: 'free' },
            'break': { label: 'Break', cls: 'away' },
            'before_school': { label: 'Before', cls: 'away' },
            'after_school': { label: 'After', cls: 'away' },
            'weekend': { label: 'Weekend', cls: 'weekend' },
            'not_timetabled': { label: 'Not timetabled', cls: 'not-timetabled' },
            'between_periods': { label: 'Between', cls: 'away' },
            'absent': { label: 'ABSENT', cls: 'absent' }
        } [status.status] || { label: '', cls: '' };
        let dotCls = config.cls;
        let dotLabel = config.label;
        if (!absentNow && hasPartialAbsence) {
            dotCls = 'absent';
            dotLabel = 'Away during ' + formatAbsencePeriods(absences) + ' today';
        }
        const badge = `<span class="status-dot ${dotCls}" title="${escapeHtml(dotLabel)}" aria-label="${escapeHtml(dotLabel)}"></span>`;
        let toggle = '';
        if (isLoggedIn) {
            let toggleCls = '', toggleSymbol = '□', toggleTitle = 'Mark absent (whole day)';
            if (fullyAbsentToday) {
                toggleCls = 'absent';
                toggleSymbol = '✓';
                toggleTitle = 'Mark present (whole day)';
            } else if (hasPartialAbsence) {
                toggleCls = 'absent partial';
                toggleSymbol = '–';
                toggleTitle = 'Away ' + formatAbsencePeriods(absences, true) + ' — click to mark absent all day instead';
            }
            toggle =
                `<button class="toggle-sm ${toggleCls}" data-teacher="${escapeHtml(t)}" title="${escapeHtml(toggleTitle)}">${toggleSymbol}</button>`;
        }
        html += `<div class="teacher ${active} ${absentNow ? 'absent' : ''}" data-name="${escapeHtml(t)}" draggable="true">
            <span class="drag">⋮</span>
            <span class="name">${escapeHtml(t)}</span>
            ${badge}${toggle}
        </div>`;
    });
    container.innerHTML = html;
    attachEvents();
}

// ============================================
// EVENTS
// ============================================
function attachEvents() {
    const items = document.querySelectorAll('.teacher');

    items.forEach(el => {
        const name = el.getAttribute('data-name');

        el.onclick = function(e) {
            if (e.target.closest('.toggle-sm')) {
                const btn = e.target.closest('.toggle-sm');
                const tn = btn.getAttribute('data-teacher');
                if (tn) toggleWholeDayAbsence(tn);
                return;
            }
            if (name) selectTeacher(name);
        };

        el.ondragstart = function(e) {
            if (name) {
                draggedTeacherName = name;
                try { e.dataTransfer.setData('text/plain', name); } catch (e) {}
                e.dataTransfer.effectAllowed = 'move';
                this.classList.add('dragging');
            }
        };

        el.ondragend = function(e) {
            this.classList.remove('dragging');
        };
    });
}

function selectTeacher(name) {
    if (!name) return;
    currentTeacher = name;
    renderList();
    showTimetable(name);
}

// ============================================
// DRAG & DROP
// ============================================
function setupDragDrop() {
    const drop = document.getElementById('dropZonePanel');
    const timetable = document.getElementById('timetableView');

    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        drop.classList.remove('drop-highlight');

        let teacherName = null;
        teacherName = e.dataTransfer.getData('text/plain');

        if (teacherName && allTeachers.includes(teacherName)) {
            selectTeacher(teacherName);
        }
    }

    drop.ondragover = function(e) {
        e.preventDefault();
    };

    drop.ondrop = handleDrop;

    if (timetable) {
        timetable.ondragover = function(e) {
            e.preventDefault();
        };

        timetable.ondrop = handleDrop;
    }
}


// ============================================
// TOUCH SUPPORT FOR DRAG & DROP
// ============================================
function setupTouchDrag() {
    let touchStartTarget = null;
    let touchTeacherName = null;
    let touchClone = null;
    let touchOffsetX = 0;
    let touchOffsetY = 0;

    document.addEventListener('touchstart', function(e) {
        const teacherEl = e.target.closest('.teacher');
        if (!teacherEl) return;

        touchTeacherName = teacherEl.getAttribute('data-name');
        if (!touchTeacherName) return;

        touchStartTarget = teacherEl;
        const touch = e.touches[0];
        const rect = teacherEl.getBoundingClientRect();
        touchOffsetX = touch.clientX - rect.left;
        touchOffsetY = touch.clientY - rect.top;

        // Create visual clone for dragging
        touchClone = teacherEl.cloneNode(true);
        touchClone.style.position = 'fixed';
        touchClone.style.width = rect.width + 'px';
        touchClone.style.pointerEvents = 'none';
        touchClone.style.opacity = '0.7';
        touchClone.style.zIndex = '9999';
        touchClone.style.transform = 'scale(1.05)';
        document.body.appendChild(touchClone);

        // Position clone
        touchClone.style.left = (touch.clientX - touchOffsetX) + 'px';
        touchClone.style.top = (touch.clientY - touchOffsetY) + 'px';

        teacherEl.classList.add('dragging');
    }, { passive: true });

    document.addEventListener('touchmove', function(e) {
        if (!touchClone) return;
        e.preventDefault();

        const touch = e.touches[0];
        touchClone.style.left = (touch.clientX - touchOffsetX) + 'px';
        touchClone.style.top = (touch.clientY - touchOffsetY) + 'px';

        // Highlight drop zone
        const dropZone = document.getElementById('dropZonePanel');
        const rect = dropZone.getBoundingClientRect();
        if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
            touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
            dropZone.classList.add('drop-highlight');
        } else {
            dropZone.classList.remove('drop-highlight');
        }
    }, { passive: false });

    document.addEventListener('touchend', function(e) {
        if (!touchClone || !touchTeacherName) return;

        // Remove clone
        if (touchClone.parentNode) {
            touchClone.parentNode.removeChild(touchClone);
        }
        touchClone = null;

        // Remove highlight
        document.getElementById('dropZonePanel').classList.remove('drop-highlight');

        // Check if dropped on drop zone
        const touch = e.changedTouches[0];
        const dropZone = document.getElementById('dropZonePanel');
        const rect = dropZone.getBoundingClientRect();

        if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
            touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
            selectTeacher(touchTeacherName);
        }

        // Remove dragging class
        if (touchStartTarget) {
            touchStartTarget.classList.remove('dragging');
            touchStartTarget = null;
        }

        touchTeacherName = null;
    }, { passive: true });
}
// ============================================
// UI HELPERS
// ============================================
function updateUI() {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const container = document.getElementById('timetableView');
    const status = document.getElementById('statusDisplay');
    const title = document.getElementById('selectedTeacherName');

    if (!currentTeacher) {
        title.innerText = 'Select a teacher';
        if (isLoggedIn) {
            status.innerHTML = '';
            container.innerHTML = `
                <div class="drop-msg drop-msg-logged-in">
                    <div class="main">Drag or click a teacher to set their absence</div>
                    <div class="sub">Tick which periods they're away for</div>
                </div>`;
        } else {
            status.innerHTML = '<div class="empty">Select a teacher to view their status</div>';
            container.innerHTML = `
                <div class="drop-msg">
                    <div class="main">Click or drag a teacher to view timetable</div>
                </div>`;
        }
    } else {
        showTimetable(currentTeacher);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m] || m);
}

// ============================================
// CLOCK
// ============================================
function getGlobalStatusLabel() {
    const cur = getCurrentPeriod();
    if (!cur.isSchoolDay) return { label: 'Weekend', cls: 'neutral' };
    if (cur.period === 'before_school') return { label: 'Before school', cls: 'amber' };
    if (cur.period === 'after_school') return { label: 'After school', cls: 'amber' };
    if (cur.period === null) return { label: 'Between periods', cls: 'amber' };
    if (SCHOOL_DAY.breakPeriods.includes(cur.period)) {
        return { label: SCHOOL_DAY.breakLabels[cur.period] || 'Break', cls: 'amber' };
    }
    const info = SCHOOL_DAY.periods.find(s => s.period === cur.period);
    return { label: info ? info.label : 'Not timetabled', cls: 'neutral' };
}

function updateHeaderStatus() {
    const cur = getCurrentPeriod();
    const dayBadge = document.getElementById('headerDayBadge');
    const statusBadge = document.getElementById('headerStatusBadge');
    if (dayBadge) dayBadge.textContent = 'Day ' + cur.timetableDay;
    if (statusBadge) {
        const g = getGlobalStatusLabel();
        statusBadge.textContent = g.label;
        statusBadge.className = 'pill pill-' + g.cls;
    }
}

function updateClock() {
    const now = new Date();
    document.getElementById('liveClock').innerText = now.toLocaleTimeString();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    document.getElementById('dayDateDisplay').textContent =
        days[now.getDay()] + ' ' + now.getDate() + '/' + (now.getMonth() + 1) + '/' + now.getFullYear();
    updateHeaderStatus();
}
setInterval(updateClock, 1000);
updateClock();

// ============================================
// LOGIN
// ============================================
document.getElementById('loginBtn').onclick = function() {
    if (localStorage.getItem('isLoggedIn') === 'true') {
        localStorage.setItem('isLoggedIn', 'false');
        location.reload();
    } else {
        window.location.href = 'login.html';
    }
};
if (localStorage.getItem('isLoggedIn') === 'true') {
    document.getElementById('loginBtn').innerText = 'Sign out';
    updateUI();
} else {
    document.getElementById('loginBtn').innerText = 'Sign-in';
}

// ============================================
// SEARCH & CLEAR
// ============================================
document.getElementById('searchInput').oninput = function() {
    renderList();
    document.getElementById('clearSearchBtn').classList.toggle('visible', this.value.length > 0);
};
document.getElementById('clearSearchBtn').onclick = function() {
    document.getElementById('searchInput').value = '';
    renderList();
    this.classList.remove('visible');
};
document.getElementById('clearListBtn').onclick = function() {
    currentTeacher = null;
    updateUI();
    renderList();
};

// ============================================
// INIT
// ============================================
loadCSV().then(() => {
    if (allTeachers.length && !currentTeacher) {
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        if (isLoggedIn) {
            document.getElementById('timetableView').innerHTML = `
                <div class="drop-msg drop-msg-logged-in">
                    <div class="main">Drag or click a teacher to set their absence</div>
                    <div class="sub">${allTeachers.length} teachers loaded — tick which periods they're away for</div>
                </div>`;
            document.getElementById('statusDisplay').innerHTML = '';
        } else {
            document.getElementById('timetableView').innerHTML = `
                <div class="drop-msg">
                    <div class="main">${allTeachers.length} teachers loaded</div>
                    <div class="sub">Search, then click or drag name</div>
                </div>`;
        }
    }
});

// ============================================
// EXPOSE TO WINDOW
// ============================================
window.togglePeriodAbsence = togglePeriodAbsence;
window.toggleWholeDayAbsence = toggleWholeDayAbsence;
window.setWholeDayAbsence = setWholeDayAbsence;
window.selectTeacher = selectTeacher;