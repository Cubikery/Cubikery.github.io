(function () {
  const D = window.StaffLocatorData;

  const loginOverlay = document.getElementById('login-overlay');
  const loginForm    = document.getElementById('login-form');
  const loginUser    = document.getElementById('login-user');
  const loginPass    = document.getElementById('login-pass');
  const loginError   = document.getElementById('login-error');
  const adminBar     = document.getElementById('admin-bar');
  const adminMain    = document.getElementById('admin-main');
  const logoutBtn    = document.getElementById('logout-btn');
  const teacherList  = document.getElementById('teacher-list');
  const dropZone     = document.getElementById('absent-drop');
  const addForm      = document.getElementById('add-teacher-form');
  const newName      = document.getElementById('new-name');
  const newSubject   = document.getElementById('new-subject');

  function showAdmin() {
    loginOverlay.style.display = 'none';
    document.body.classList.add('logged-in');
    adminBar.hidden = false;
    adminMain.hidden = false;
    render();
  }

  if (sessionStorage.getItem('admin-auth') === '1') showAdmin();

  loginForm.addEventListener('submit', e => {
    e.preventDefault();
    if (loginUser.value.trim().toLowerCase() === 'admin' && loginPass.value === 'jpc') {
      sessionStorage.setItem('admin-auth', '1');
      showAdmin();
    } else {
      loginError.hidden = false;
      loginPass.value = '';
      loginPass.focus();
    }
  });

  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('admin-auth');
    window.location.href = 'public.html';
  });

  addForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = newName.value.trim();
    const subject = newSubject.value.trim();
    if (!name || !subject) return;
    D.addTeacher(name, subject);
    D.showToast(`${name} added`);
    addForm.reset();
    newName.focus();
    render();
  });

  function doMarkAbsent(id) {
    D.markAbsent(id);
    const t = D.getTeachers().find(x => x.id === id);
    D.showToast(`${t ? t.name : 'Teacher'} marked absent`, () => { D.markPresent(id); render(); });
    render();
  }

  function doRemove(id) {
    const t = D.getTeachers().find(x => x.id === id);
    D.removeTeacher(id);
    D.showToast(`${t ? t.name : 'Teacher'} removed`);
    render();
  }

  function render() {
    teacherList.innerHTML = '';

    const all     = D.getTeachers();
    const present = all.filter(t => !D.isAbsent(t.id));
    const absent  = all.filter(t =>  D.isAbsent(t.id));

    for (const t of present) {
      const li = document.createElement('li');
      li.className = 'faculty-card';
      li.dataset.id = t.id;
      const isCustom = D.isCustomTeacher(t.id);
      li.innerHTML = `
        <div class="fc-text">
          <p class="fc-name">${t.name}</p>
          <p class="fc-subject">${t.subject}</p>
        </div>
        <div class="fc-actions">
          <button class="btn btn-sm js-absent" type="button">Mark absent</button>
          ${isCustom ? `<button class="btn btn-sm btn-remove js-remove" type="button" title="Remove teacher">×</button>` : ''}
        </div>
      `;
      li.querySelector('.js-absent').addEventListener('click', () => doMarkAbsent(t.id));
      if (isCustom) li.querySelector('.js-remove').addEventListener('click', () => doRemove(t.id));
      D.makeDraggable(li, () => doMarkAbsent(t.id), () => dropZone);
      teacherList.appendChild(li);
    }

    if (absent.length > 0) {
      const divider = document.createElement('li');
      divider.className = 'list-divider';
      divider.textContent = 'Absent today';
      teacherList.appendChild(divider);

      for (const t of absent) {
        const isCustom = D.isCustomTeacher(t.id);
        const li = document.createElement('li');
        li.className = 'faculty-card faculty-card-absent';
        li.innerHTML = `
          <div class="fc-text">
            <p class="fc-name">${t.name}</p>
            <p class="fc-subject">${t.subject}</p>
          </div>
          <div class="fc-actions">
            <button class="btn btn-sm js-present" type="button">Mark present</button>
            ${isCustom ? `<button class="btn btn-sm btn-remove js-remove" type="button" title="Remove teacher">×</button>` : ''}
          </div>
        `;
        li.querySelector('.js-present').addEventListener('click', () => { D.markPresent(t.id); render(); });
        if (isCustom) li.querySelector('.js-remove').addEventListener('click', () => doRemove(t.id));
        teacherList.appendChild(li);
      }
    }
  }
})();
