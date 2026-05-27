(function () {
  const D = window.StaffLocatorData;

  const facultyList = document.getElementById('faculty-list');
  const absentList  = document.getElementById('absent-list');
  const absentCount = document.getElementById('absent-count');
  const dropZone    = document.getElementById('drop-zone');
  const dropEmpty   = document.getElementById('drop-empty');
  const detailCard  = document.getElementById('detail-card');
  const searchInput = document.getElementById('faculty-search');
  const clockEl     = document.getElementById('clock');
  const periodEl    = document.getElementById('period-status');
  const updatedEl   = document.getElementById('updated-time');

  let query = '';

  function dotState(s) { return s.state === 'in-class' ? 'in' : s.state; }

  function renderFaculty() {
    const q = query.trim().toLowerCase();
    const list = D.getTeachers().filter(t =>
      !q || t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)
    );
    facultyList.innerHTML = '';
    if (list.length === 0) {
      facultyList.innerHTML = '<li class="empty-hint">No teachers match your search.</li>';
      return;
    }
    for (const t of list) {
      const status = D.teacherStatus(t.id);
      const ds = dotState(status);
      const li = document.createElement('li');
      li.className = 'faculty-card' + (detailCard.dataset.openId === t.id ? ' selected' : '');
      li.dataset.id = t.id;
      li.tabIndex = 0;
      li.setAttribute('role', 'button');
      li.setAttribute('aria-label', `${t.name}, ${t.subject} — ${status.label}`);
      li.innerHTML = `
        <div class="fc-text">
          <p class="fc-name">${t.name}</p>
          <p class="fc-subject">${t.subject}</p>
        </div>
        <span class="fc-dot" data-state="${ds}" title="${status.label}"></span>
      `;
      li.addEventListener('click', () => {
        if (!li.dataset.justDragged) showDetail(t.id);
        delete li.dataset.justDragged;
      });
      li.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showDetail(t.id); }
      });
      D.makeDraggable(li, () => showDetail(t.id), () => dropZone);
      facultyList.appendChild(li);
    }
  }

  function renderAbsent() {
    const absent = D.getTeachers().filter(t => D.isAbsent(t.id));
    absentCount.textContent = absent.length;
    absentList.innerHTML = '';
    if (absent.length === 0) {
      absentList.innerHTML = '<li class="absent-empty">None today.</li>';
      return;
    }
    for (const t of absent) {
      const li = document.createElement('li');
      li.className = 'absent-card';
      li.innerHTML = `
        <div class="fc-text">
          <p class="fc-name">${t.name}</p>
          <p class="fc-subject">${t.subject}</p>
        </div>
        <span class="absent-tag">Absent</span>
      `;
      absentList.appendChild(li);
    }
  }

  function showDetail(id) {
    const t = D.getTeachers().find(x => x.id === id);
    if (!t) return;
    const status = D.teacherStatus(id);
    const ds = dotState(status);

    let bodyHtml = '';
    if (status.state === 'in-class') {
      bodyHtml = `
        <div class="detail-grid">
          <div class="detail-tile"><p class="label">Class</p><p class="value">${status.class}</p></div>
          <div class="detail-tile"><p class="label">Room</p><p class="value">${status.room}</p></div>
        </div>
      `;
    } else if (status.state !== 'absent') {
      bodyHtml = `<p class="detail-away">${status.label}</p>`;
    }

    detailCard.innerHTML = `
      <h2 class="detail-name">${t.name}</h2>
      <p class="detail-subject">${t.subject}</p>
      <div class="detail-status-row">
        <span class="detail-pill" data-state="${ds}">${status.label}</span>
      </div>
      ${bodyHtml}
      <div class="detail-actions">
        <button class="btn-clear" type="button" id="clear-btn">Clear</button>
      </div>
    `;
    detailCard.dataset.openId = id;
    detailCard.hidden = false;
    dropEmpty.hidden = true;
    document.getElementById('clear-btn').addEventListener('click', clearDetail);
    renderFaculty();
  }

  function clearDetail() {
    detailCard.hidden = true;
    detailCard.innerHTML = '';
    delete detailCard.dataset.openId;
    dropEmpty.hidden = false;
    renderFaculty();
  }

  function tick() {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    clockEl.textContent = hhmm;
    if (updatedEl) updatedEl.textContent = hhmm;
    const p = D.currentPeriodInfo(now);
    periodEl.textContent = p.label;
    periodEl.dataset.state = p.state;
  }

  searchInput.addEventListener('input', e => { query = e.target.value; renderFaculty(); });

  renderFaculty();
  renderAbsent();
  tick();
  setInterval(tick, 30000);
  setInterval(() => { renderFaculty(); renderAbsent(); }, 60000);

  window.addEventListener('storage', e => {
    if (e.key === D.ABSENT_KEY || e.key === D.CUSTOM_KEY || e.key === null) {
      renderAbsent();
      renderFaculty();
      if (detailCard.dataset.openId) showDetail(detailCard.dataset.openId);
    }
  });
})();
