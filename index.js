// ============================================================
// CONFIGURATION - School day settings
// ============================================================

// The first day of our 7-day timetable cycle (YYYY-MM-DD format)
// This is the "Day 1" of the cycle
const ANCHOR_DATE = '2026-01-15';

// School day structure: all periods from morning to afternoon
// Each period has: period number, start time, end time, and display label
const SCHOOL_DAY = {
    periods: [
        { period: 0, start: '08:40', end: '08:50', label: 'Roll call' },
        { period: 1, start: '08:50', end: '09:40', label: 'Period 1' },
        { period: 2, start: '09:40', end: '10:30', label: 'Period 2' },
        { period: 3, start: '10:50', end: '11:40', label: 'Period 3' },
        { period: 4, start: '11:40', end: '12:30', label: 'Period 4' },
        { period: 5, start: '13:50', end: '14:40', label: 'Period 5' },
        { period: 6, start: '14:40', end: '15:30', label: 'Period 6' }
    ],
};

// ============================================================
// GLOBAL STATE VARIABLES - Keep track of everything
// ============================================================

let allLessons = [];           // Array of all lessons from the CSV file
let allTeachers = [];          // Array of unique teacher names (sorted A-Z)
let currentTeacher = null;     // Which teacher is currently selected (clicked)
let absentPeriods = {};        // Object: { teacherName: Set(periodNumbers) }

// ============================================================
// ABSENCE STORAGE - Save to browser's localStorage
// ============================================================

/**
 * Saves the absence data to your browser's local storage
 * This way, absences are remembered even after refreshing the page
 */
function saveAbsences() {
    // Create an object with today's date and all absent periods
    const data = { date: getTodayDate() };
    for (const [name, periods] of Object.entries(absentPeriods)) {
        data[name] = Array.from(periods);  // Convert Set to Array for storage
    }
    localStorage.setItem('absences', JSON.stringify(data));
}

/**
 * Gets today's date in YYYY-MM-DD format
 * Example: 2026-06-23
 */
function getTodayDate() {
    const now = new Date();
    return now.getFullYear() + '-' +
           String(now.getMonth() + 1).padStart(2, '0') + '-' +
           String(now.getDate()).padStart(2, '0');
}

/**
 * Loads absence data from browser storage
 * If the data is from a different day, it automatically clears it
 */
function loadAbsences() {
    const saved = localStorage.getItem('absences');
    if (!saved) return;  // Nothing saved yet

    const data = JSON.parse(saved);

    // If saved data is from yesterday or older, clear it
    if (data.date !== getTodayDate()) {
        absentPeriods = {};
        localStorage.removeItem('absences');
        return;
    }

    // Restore each teacher's absent periods
    for (const [name, periods] of Object.entries(data)) {
        if (name !== 'date') {
            absentPeriods[name] = new Set(periods);  // Convert Array back to Set
        }
    }
}

// ============================================================
// CSV LOADING & PARSING - Read the timetable file
// ============================================================

/**
 * Converts CSV text into a structured array of lesson objects
 * CSV format: teacher,day,period,class,room,etc.
 */
function parseCSV(text) {
    const lines = text.split('\n');  // Split by new lines
    if (lines.length < 2) return []; // Need at least header + 1 row

    const headers = lines[0].trim().split(',');  // First line is column names
    const data = [];

    // Process each row (starting from row 1, skipping header)
    for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',');
        if (!vals.length) continue;  // Skip empty lines

        // Build an object using headers as keys
        const entry = {};
        headers.forEach((h, idx) => {
            let v = vals[idx] || '';
            // Convert day and period to numbers (not text)
            if (h === 'day' || h === 'period') v = parseInt(v, 10);
            entry[h] = v;
        });

        // Create a clean lesson object
        data.push({
            teacher: entry.teacher || '',
            tutorGroup: entry.tutor_group || '',
            day: entry.day,
            period: entry.period,
            className: entry.class || '',
            room: entry.room || ''
        });
    }

    // Only keep entries that have a teacher name
    return data.filter(d => d.teacher);
}

/**
 * Load the timetable CSV file and initialize the application
 */
async function loadCSV() {
    const resp = await fetch('timetable.csv');   // Get the file
    const text = await resp.text();              // Read it as text
    allLessons = parseCSV(text);                 // Parse into lesson objects

    // Get all unique teacher names
    const set = new Set(allLessons.map(l => l.teacher));
    allTeachers = Array.from(set).sort();        // Sort alphabetically

    loadAbsences();    // Load any saved absences
    renderList();      // Show the teacher list
    setupDragDrop();   // Enable drag and drop
    setupTouchDrag();  // Enable touch drag for phones
    updateUI();        // Update the display
}

// ============================================================
// ABSENCE PERIODS - Core functions
// ============================================================

/**
 * Get the set of absent periods for a teacher
 * Returns a Set of period numbers (or empty Set if none)
 */
function getAbsencePeriodsForTeacher(name) {
    return absentPeriods[name] || new Set();
}

/**
 * Check if a teacher is absent at a specific period
 * Returns true if they are marked absent for that period
 */
function isAbsentAtPeriod(name, period) {
    const set = absentPeriods[name];
    return !!(set && set.has(period));
}

/**
 * Check if a teacher is absent for the entire day
 * Returns true if ALL their periods are marked absent
 */
function isFullyAbsentToday(name) {
    const set = getAbsencePeriodsForTeacher(name);
    const teacherLessons = getTeacherLessons(name);
    const allPeriods = new Set(teacherLessons.map(l => l.period));
    return set.size > 0 && allPeriods.size > 0 &&
           Array.from(allPeriods).every(p => set.has(p));
}

/**
 * Format absence periods as a comma-separated string
 * Example: "Period 1, Period 3, Period 5" or "P1, P3, P5" (compact)
 */
function formatAbsencePeriods(set, compact) {
    return Array.from(set)
        .sort((a, b) => a - b)  // Sort in order
        .map(p => {
            const info = SCHOOL_DAY.periods.find(s => s.period === p);
            const label = info ? info.label : 'Period ' + p;
            return compact ? label.replace('Period ', 'P') : label;
        })
        .join(', ');
}

/**
 * Toggle absence for a specific period
 * If absent, mark as present. If present, mark as absent.
 */
function togglePeriodAbsence(name, period) {
    if (!name) return;
    if (!absentPeriods[name]) absentPeriods[name] = new Set();

    // Toggle: add if not present, remove if present
    if (absentPeriods[name].has(period)) {
        absentPeriods[name].delete(period);
    } else {
        absentPeriods[name].add(period);
    }

    // Clean up empty entries
    if (absentPeriods[name].size === 0) delete absentPeriods[name];
    saveAbsences();          // Save to storage
    renderList();            // Update the list
    if (currentTeacher === name) showTimetable(name);  // Update the view
}

/**
 * Set entire day as absent or present for a teacher
 */
function setWholeDayAbsence(name, makeAbsent) {
    if (!name) return;
    if (makeAbsent) {
        // Mark all periods as absent
        const teacherLessons = getTeacherLessons(name);
        const allPeriods = teacherLessons.map(l => l.period);
        absentPeriods[name] = new Set(allPeriods);
    } else {
        // Remove all absences
        delete absentPeriods[name];
    }
    saveAbsences();
    renderList();
    if (currentTeacher === name) showTimetable(name);
}

/**
 * Toggle whole day absence status
 * If already absent all day, mark present. Otherwise, mark absent all day.
 */
function toggleWholeDayAbsence(name) {
    setWholeDayAbsence(name, !isFullyAbsentToday(name));
}

// ============================================================
// TIME & STATUS CALCULATIONS
// ============================================================

/**
 * Calculate which day of the 7-day cycle we're on
 * Returns a number from 1 to 7
 */
function getEffectiveTimetableDay() {
    const from = new Date(ANCHOR_DATE + 'T00:00:00');
    const to = new Date();
    to.setHours(0, 0, 0, 0);
    const elapsed = Math.floor((to - from) / (1000 * 60 * 60 * 24));
    return elapsed % 7 + 1;
}

/**
 * Determine the current school period based on system time
 * Returns: { period, isSchoolDay, weekDay, timetableDay }
 */
function getCurrentPeriod() {
    const now = new Date();
    const weekDay = now.getDay();           // 0=Sunday, 1=Monday, etc.
    const timetableDay = getEffectiveTimetableDay();
    const isSchoolDay = [1, 2, 3, 4, 5].includes(weekDay);  // Monday to Friday
    const time = now.toTimeString().slice(0, 5);            // Current time in HH:MM

    let period = null;
    // Find which period the current time falls into
    for (const slot of SCHOOL_DAY.periods) {
        if (time >= slot.start && time < slot.end) {
            period = slot.period;
            break;
        }
    }

    return { period, isSchoolDay, weekDay, timetableDay };
}

/**
 * Get the status of a teacher at the current time
 * Status can be: 'teaching', 'free', 'away', 'absent'
 */
function getTeacherStatus(name) {
    const cur = getCurrentPeriod();

    // Check if teacher is marked absent for this period
    if (isAbsentAtPeriod(name, cur.period)) {
        return { status: 'absent', message: 'Absent', colorClass: 'red' };
    }

    // Check if teacher has a lesson at this period
    const lessons = allLessons.filter(l =>
        l.teacher === name && l.day === cur.timetableDay && l.period === cur.period
    );

    if (lessons.length) {
        const lesson = lessons[0];
        // If it has a class name and it's not "Free", they are teaching
        if (lesson.className && lesson.className !== 'Free') {
            return { status: 'teaching', message: 'In class now', colorClass: 'green', lesson };
        }
        // Otherwise they are free
        return { status: 'free', message: 'Free', colorClass: 'neutral' };
    }

    return { status: 'away', message: 'Not available', colorClass: 'neutral' };
}

/**
 * Get all lessons for a teacher, sorted by day and period
 */
function getTeacherLessons(name) {
    return allLessons
        .filter(l => l.teacher === name)
        .sort((a, b) => a.day - b.day || a.period - b.period);
}

// ============================================================
// RENDER TEACHER LIST - Show all teachers on the left side
// ============================================================

/**
 * Renders the teacher list with search filtering
 * Each teacher shows: name, status dot, and absence toggle (if logged in)
 */
function renderList() {
    const search = document.getElementById('searchInput').value.toLowerCase().trim();
    let filtered = allTeachers;

    // Filter teachers by search term
    if (search) {
        filtered = allTeachers.filter(t => {
            // Search by teacher name
            if (t.toLowerCase().includes(search)) return true;
            // Search by class name, tutor group, or room
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

    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    let html = '';

    // Build HTML for each teacher
    filtered.forEach(t => {
        const active = currentTeacher === t ? 'active' : '';
        const status = getTeacherStatus(t);
        const fullyAbsentToday = isFullyAbsentToday(t);
        const absences = getAbsencePeriodsForTeacher(t);
        const hasPartialAbsence = absences.size > 0;

        // Map status to display configuration
        const config = {
            'teaching': { label: 'Teaching', cls: 'teaching' },
            'free': { label: 'Free', cls: 'free' },
            'away': { label: 'Away', cls: 'away' },
            'absent': { label: 'Absent', cls: 'absent' }
        }[status.status] || { label: '', cls: '' };

        let dotCls = config.cls;
        let dotLabel = config.label;


        // If absent, show a special dot
        if (hasPartialAbsence) {
            dotCls = 'absent';
            dotLabel = 'Away during ' + formatAbsencePeriods(absences) + ' today';
        }

        const badge = `<span class="status-dot ${dotCls}" aria-label="${dotLabel}"></span>`;

        // Build absence toggle button (only for logged-in users)
        let toggle = '';
        if (isLoggedIn) {
            let toggleCls = '', toggleTitle = 'Mark absent (whole day)';
            if (fullyAbsentToday) {
                toggleCls = 'absent';
                toggleTitle = 'Mark present (whole day)';
            } else if (hasPartialAbsence) {
                toggleCls = 'absent partial';
                toggleTitle = 'Away ' + formatAbsencePeriods(absences, true) + ' — click to mark absent all day instead';
            }

        }

        const isAbsent = fullyAbsentToday;
        html += `<div class="teacher ${active} ${isAbsent ? 'absent' : ''}" data-name="${t}" draggable="true">
            <span class="name">${t}</span>
            ${badge}${toggle}
        </div>`;
    });

    container.innerHTML = html;
    attachEvents();  // Add click and drag events to each teacher
}


// ============================================================
// RENDER TIMETABLE - Show the selected teacher's schedule
// ============================================================

/**
 * Display the timetable and status for a selected teacher
 */
function showTimetable(name) {
    if (!name) { updateUI(); return; }

    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    document.getElementById('selectedTeacherName').innerText = name;

    const lessons = getTeacherLessons(name);
    const cur = getCurrentPeriod();
    const today = cur.timetableDay;
    const todayLessons = lessons.filter(l => l.day === today);
    const status = getTeacherStatus(name);
    const absentNow = status.status === 'absent';

    // --- ADMIN VIEW ---
    if (isLoggedIn) {
        const absences = getAbsencePeriodsForTeacher(name);
        const fullyAbsent = isFullyAbsentToday(name);

        const summary = absences.size === 0
            ? 'Not marked absent'
            : (fullyAbsent ? 'Absent all day' : absences.size + ' period' + (absences.size > 1 ? 's' : '') + ' marked absent');

        const periods = todayLessons.map(l => l.period).sort((a, b) => a - b);
        const chips = periods.map(p => {
            const isOff = absences.has(p);
            const info = SCHOOL_DAY.periods.find(s => s.period === p);
            const label = info ? info.label : 'Period ' + p;
            return `<button class="period-chip ${isOff ? 'absent' : ''}" data-teacher="${escapeHtml(name)}" data-period="${p}">
                <span class="chip-check"></span>${escapeHtml(label)}
            </button>`;
        }).join('');

        document.getElementById('statusDisplay').innerHTML = `<div class="msg">${summary}</div>`;
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

    // --- PUBLIC VIEW ---

    // Find the current lesson
    const currentLesson = todayLessons.find(l => l.period === cur.period);

    // Get class name and room
    let className = '';
    let roomDisplay = '';

    if (currentLesson) {
        className = currentLesson.className || 'Free';
        roomDisplay = currentLesson.room || '';
    }

    // Build the status display
    let statusHtml = '';

    if (absentNow) {
        // Teacher is absent
        statusHtml = `
            <div class="badge-lg pill-red">ABSENT</div>
        `;
    } else if (status.status === 'teaching') {
        // Teacher is teaching
        let details = `<div class="details">
            <div class="item">
                <span class="label">Class</span>
                <span class="value class">${escapeHtml(className)}</span>
            </div>`;

        if (roomDisplay) {
            details += `<div class="item">
                <span class="label">Room</span>
                <span class="value room">${escapeHtml(roomDisplay)}</span>
            </div>`;
        }
        details += `</div>`;

        statusHtml = `
            <div class="badge-lg pill-green">${status.message}</div>
            ${details}
        `;
    } else if (status.status === 'free') {
        // Teacher is free
        let details = `<div class="details">
            <div class="item">
                <span class="label">Class</span>
                <span class="value class">${'Free'}</span>
            </div>`;

        if (roomDisplay) {
            details += `<div class="item">
                <span class="label">Room</span>
                <span class="value room">${escapeHtml(roomDisplay)}</span>
            </div>`;
        }
        details += `</div>`;

        statusHtml = `
            ${details}
        `;
    } else {
        // Teacher is away
        let msg = 'Away';
        if (!cur.isSchoolDay) msg = 'Weekend';
        else if (cur.period === null) msg = 'Between periods';

        statusHtml = `
            <div class="badge-lg pill-neutral">${msg}</div>
        `;
    }

    // Set the status display
    document.getElementById('statusDisplay').innerHTML = statusHtml;

    // --- TIMETABLE DISPLAY ---
    let html = `<div class="day-header">Day ${today} schedule</div>`;

    // Loop through ALL periods
    SCHOOL_DAY.periods.forEach(periodInfo => {
        const p = periodInfo.period;
        const label = periodInfo.label;
        const time = periodInfo.start + '–' + periodInfo.end;

        // Find the lesson for this period
        const lesson = todayLessons.find(l => l.period === p);
        const isCur = cur.isSchoolDay && cur.timetableDay === today && cur.period === p;
        const isRowAbsent = isAbsentAtPeriod(name, p);

        let cls = 'lesson';
        if (isCur) cls += ' current';
        if (isRowAbsent) cls += ' absent';

        // Get class name and room
        let classDisplay = 'Free';
        let roomDisplay = '';

        if (lesson) {
            classDisplay = lesson.className || 'Free';
            roomDisplay = lesson.room || '';
        }

        const isFree = (classDisplay === 'Free');

        html += `<div class="${cls}">
            <span class="period">${label}</span>
            <span class="time">${time}</span>
            <span class="class${isFree ? ' is-free' : ''}">${escapeHtml(classDisplay)}</span>
            ${roomDisplay ? `<span class="room">${escapeHtml(roomDisplay)}</span>` : '<span></span>'}
            ${isRowAbsent ? '<span class="away-badge">Away</span>' :
            (isCur ? '<span class="cur-badge">Now</span>' : '<span></span>')}
        </div>`;
    });

    document.getElementById('timetableView').innerHTML = html;
}


// ============================================================
// PERIOD PICKER EVENTS - Handle clicks on the admin panel
// ============================================================

/**
 * Attach click handlers to period picker buttons
 * Handles individual period toggles and bulk actions
 */
function attachPeriodPickerEvents() {
    // Individual period toggle buttons
    document.querySelectorAll('.period-chip').forEach(btn => {
        btn.onclick = function() {
            const tn = btn.getAttribute('data-teacher');
            const period = parseInt(btn.getAttribute('data-period'), 10);
            if (tn && !isNaN(period)) togglePeriodAbsence(tn, period);
        };
    });

    // Action buttons (whole day / clear)
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

// ============================================================
// UI HELPERS - Small helper functions
// ============================================================

/**
 * Escape HTML special characters to prevent XSS attacks
 * Converts &, <, > to their HTML entity equivalents
 */
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m] || m);
}

/**
 * Update the UI based on current state
 * Shows appropriate message when no teacher is selected
 */
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
                </div>`;
        } else {
            container.innerHTML = `
                <div class="drop-msg">
                    <div class="main">Click or drag a teacher to view timetable</div>
                </div>`;
        }
    } else {
        showTimetable(currentTeacher);
    }
}

/**
 * Select a teacher and update the UI
 */
function selectTeacher(name) {
    if (!name) return;
    currentTeacher = name;
    renderList();
    showTimetable(name);
}

// ============================================================
// DRAG & DROP (Desktop) - Drag teachers from list to timetable
// ============================================================

/**
 * Set up drag and drop functionality for desktop
 * Allows dragging teachers from list to timetable panel
 */
function setupDragDrop() {
    const drop = document.getElementById('dropZonePanel');
    const timetable = document.getElementById('timetableView');

    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        drop.classList.remove('drop-highlight');
        const teacherName = e.dataTransfer.getData('text/plain');
        if (teacherName && allTeachers.includes(teacherName)) {
            selectTeacher(teacherName);
        }
    }

    drop.ondragover = (e) => e.preventDefault();
    drop.ondrop = handleDrop;

    if (timetable) {
        timetable.ondragover = (e) => e.preventDefault();
        timetable.ondrop = handleDrop;
    }
}

// ============================================================
// TOUCH SUPPORT (Mobile) - Drag on phones and tablets
// ============================================================

/**
 * Set up touch-based drag and drop for mobile devices
 * Creates a visual clone that follows your finger
 */
function setupTouchDrag() {
    let touchStartTarget = null;
    let touchTeacherName = null;
    let touchClone = null;
    let touchOffsetX = 0;
    let touchOffsetY = 0;

    // Touch start - begin drag when you touch a teacher
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

        // Create a visual clone that follows your finger
        touchClone = teacherEl.cloneNode(true);
        Object.assign(touchClone.style, {
            position: 'fixed',
            width: rect.width + 'px',
            pointerEvents: 'none',
            opacity: '0.7',
            zIndex: '9999',
            transform: 'scale(1.05)',
            left: (touch.clientX - touchOffsetX) + 'px',
            top: (touch.clientY - touchOffsetY) + 'px'
        });
        document.body.appendChild(touchClone);
        teacherEl.classList.add('dragging');
    }, { passive: true });

    // Touch move - drag the clone as you move your finger
    document.addEventListener('touchmove', function(e) {
        if (!touchClone) return;
        e.preventDefault();

        const touch = e.touches[0];
        touchClone.style.left = (touch.clientX - touchOffsetX) + 'px';
        touchClone.style.top = (touch.clientY - touchOffsetY) + 'px';

        // Highlight the drop zone when you drag over it
        const dropZone = document.getElementById('dropZonePanel');
        const rect = dropZone.getBoundingClientRect();
        dropZone.classList.toggle('drop-highlight',
            touch.clientX >= rect.left && touch.clientX <= rect.right &&
            touch.clientY >= rect.top && touch.clientY <= rect.bottom
        );
    }, { passive: false });

    // Touch end - drop or cancel when you lift your finger
    document.addEventListener('touchend', function(e) {
        if (!touchClone || !touchTeacherName) return;

        // Remove the clone
        if (touchClone.parentNode) touchClone.parentNode.removeChild(touchClone);
        touchClone = null;
        document.getElementById('dropZonePanel').classList.remove('drop-highlight');

        // Check if you dropped on the drop zone
        const touch = e.changedTouches[0];
        const dropZone = document.getElementById('dropZonePanel');
        const rect = dropZone.getBoundingClientRect();

        if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
            touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
            selectTeacher(touchTeacherName);
        }

        // Clean up
        if (touchStartTarget) {
            touchStartTarget.classList.remove('dragging');
            touchStartTarget = null;
        }
        touchTeacherName = null;
    }, { passive: true });
}

// ============================================================
// EVENTS - Click and drag handlers for teacher items
// ============================================================

/**
 * Attach click and drag events to teacher list items
 */
function attachEvents() {
    document.querySelectorAll('.teacher').forEach(el => {
        const name = el.getAttribute('data-name');

        // Click handler - select teacher or toggle absence
        el.onclick = function(e) {
            // If clicked on the toggle button, toggle absence
            if (name) selectTeacher(name);
        };

        // Drag start handler
        el.ondragstart = function(e) {
            if (name) {
                try { e.dataTransfer.setData('text/plain', name); } catch (e) {}
                e.dataTransfer.effectAllowed = 'move';
                this.classList.add('dragging');
            }
        };

        // Drag end handler
        el.ondragend = function(e) {
            this.classList.remove('dragging');
        };
    });
}

// ============================================================
// CLOCK & HEADER STATUS - Live clock and day display
// ============================================================

/**
 * Get the global status label for the header
 * Shows what period it currently is
 */
function getGlobalStatusLabel() {
    const cur = getCurrentPeriod();
    if (!cur.isSchoolDay || cur.period === null) {
        return { label: 'Away', cls: 'neutral' };
    }
    const info = SCHOOL_DAY.periods.find(s => s.period === cur.period);
    return { label: info ? info.label : 'Away', cls: 'neutral' };
}

/**
 * Update the header badges (day number and current period)
 */
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

/**
 * Update the live clock and date display
 * Called every second by setInterval
 */
function updateClock() {
    const now = new Date();
    document.getElementById('liveClock').innerText = now.toLocaleTimeString();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    document.getElementById('dayDateDisplay').textContent =
        days[now.getDay()] + ' ' + now.getDate() + '/' + (now.getMonth() + 1) + '/' + now.getFullYear();
    updateHeaderStatus();
}

// ============================================================
// SEARCH & CLEAR CONTROLS - Search bar and clear buttons
// ============================================================

/**
 * Set up search input and clear button functionality
 */
function setupSearchControls() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    const clearListBtn = document.getElementById('clearListBtn');

    // Live search as user types
    searchInput.oninput = function() {
        renderList();
        clearBtn.classList.toggle('visible', this.value.length > 0);
    };

    // Clear search button
    clearBtn.onclick = function() {
        searchInput.value = '';
        renderList();
        this.classList.remove('visible');
    };

    // Clear selected teacher button
    clearListBtn.onclick = function() {
        currentTeacher = null;
        updateUI();
        renderList();
    };
}

// ============================================================
// LOGIN / LOGOUT CONTROL - Sign in and sign out
// ============================================================

/**
 * Set up login/logout button functionality
 * Redirects to login page or logs out
 */
function setupLogin() {
    const loginBtn = document.getElementById('loginBtn');
    loginBtn.onclick = function() {
        if (localStorage.getItem('isLoggedIn') === 'true') {
            localStorage.setItem('isLoggedIn', 'false');
            location.reload();
        } else {
            window.location.href = 'login.html';
        }
    };
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    loginBtn.innerText = isLoggedIn ? 'Sign out' : 'Sign-in';
    if (isLoggedIn) updateUI();
}

// ============================================================
// INITIALIZATION - Start the application
// ============================================================
/**
 * Initialize the application
 * Loads data, sets up event listeners, and starts the clock
 */
function initializeApp() {
    loadAbsences();
    loadCSV().then(() => {
        if (allTeachers.length && !currentTeacher) {
            const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
            document.getElementById('timetableView').innerHTML = isLoggedIn
                ? `<div class="drop-msg drop-msg-logged-in"><div class="main">Drag or click a teacher to set their absence</div></div>`
                : `<div class="drop-msg"><div class="main">Click or drag a teacher to view timetable</div></div>`;
            if (isLoggedIn) document.getElementById('statusDisplay').innerHTML = '';
        }
    });

    // Start the live clock (updates every second)
    setInterval(updateClock, 1000);
    updateClock();

    // Setup controls
    setupSearchControls();
    setupLogin();
}

// ============================================================
// EXPOSE FUNCTIONS TO WINDOW (for debugging in browser console)
// ============================================================

window.togglePeriodAbsence = togglePeriodAbsence;
window.toggleWholeDayAbsence = toggleWholeDayAbsence;
window.setWholeDayAbsence = setWholeDayAbsence;
window.selectTeacher = selectTeacher;

// ============================================================
// START THE APPLICATION
// ============================================================

initializeApp();