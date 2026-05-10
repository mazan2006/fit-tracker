 let state = JSON.parse(localStorage.getItem('fittrack_v2') || 'null') || { workouts: [], history: [], selectedDay: 0 };
  let timerInterval = null, timerStart = null, activeWorkout = null;
  const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const TYPES = { strength:'tag-strength', cardio:'tag-cardio', hiit:'tag-hiit', flexibility:'tag-flexibility' };

  function save() { localStorage.setItem('fittrack_v2', JSON.stringify(state)); }

  // Greeting
  const h = new Date().getHours();
  document.getElementById('user-greeting').textContent = h < 12 ? 'Good morning!' : h < 17 ? 'Good afternoon!' : 'Good evening!';

  // Today's index (Mon=0 ... Sun=6)
  function todayIdx() { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; }

  // ── NAVIGATION ──
  const TITLES = { dashboard:'Dashboard', planner:'Weekly Planner', workouts:'Workout Library', history:'Session History' };
  function showView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('view-' + name).classList.add('active');
    const btn = document.querySelector(`.nav-item[onclick="showView('${name}')"]`);
    if (btn) btn.classList.add('active');
    document.getElementById('page-title').textContent = TITLES[name];
    if (name === 'dashboard') renderDashboard();
    if (name === 'planner') renderPlanner();
    if (name === 'workouts') renderLibrary();
    if (name === 'history') renderHistory();
  }

  // ── DASHBOARD ──
  function renderDashboard() {
    const now = new Date();
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1); weekStart.setHours(0,0,0,0);
    const weekSessions = state.history.filter(h => new Date(h.date) >= weekStart);
    document.getElementById('stat-week').textContent = weekSessions.length;
    document.getElementById('stat-total').textContent = state.history.length;
    document.getElementById('stat-plans').textContent = state.workouts.length;

    let streak = 0;
    const today = new Date(); today.setHours(0,0,0,0);
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      if (state.history.some(h => new Date(h.date).toDateString() === d.toDateString())) streak++;
      else if (i > 0) break;
    }
    document.getElementById('stat-streak').textContent = streak;

    // Chart
    const days = ['M','T','W','T','F','S','S'];
    const counts = days.map((_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return state.history.filter(h => new Date(h.date).toDateString() === d.toDateString()).length; });
    const max = Math.max(...counts, 1);
    document.getElementById('week-chart').innerHTML = days.map((d,i) => `<div class="bar-wrap"><div class="bar" style="height:${Math.max(Math.round((counts[i]/max)*100),4)}%"></div><div class="bar-label">${d}</div></div>`).join('');
    document.getElementById('week-label').textContent = weekSessions.length + ' this week';

    // Today's plan
    const todayWorkouts = state.workouts.filter(w => w.day == todayIdx());
    document.getElementById('today-count').textContent = todayWorkouts.length;
    const preview = document.getElementById('today-plan-preview');
    if (todayWorkouts.length) {
      preview.innerHTML = todayWorkouts.map(w => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">
          <div><span class="workout-tag ${TYPES[w.type]}">${w.type}</span><div style="font-weight:600;">${w.name}</div><div style="font-size:12px;color:var(--muted);"><i class="bi bi-clock me-1"></i>${w.duration} mins · ${w.exercises.length} exercises</div></div>
          <button class="btn-accent" style="font-size:12px;padding:6px 14px;" onclick="startWorkout('${w.id}')"><i class="bi bi-play-fill"></i> Start</button>
        </div>`).join('');
    } else {
      preview.innerHTML = `<p style="color:var(--muted);font-size:14px;">No workouts scheduled today.</p><button class="btn-accent mt-2" onclick="showView('planner')"><i class="bi bi-plus"></i> Plan Today</button>`;
    }

    // Recent history
    const recent = [...state.history].reverse().slice(0, 4);
    const histEl = document.getElementById('recent-history');
    histEl.innerHTML = recent.length ? recent.map(h => `
      <div class="history-item">
        <div><div class="history-name">${h.workoutName}</div>
          <div class="history-date"><i class="bi bi-calendar2 me-1"></i>${new Date(h.date).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})} &nbsp;·&nbsp; <i class="bi bi-clock me-1"></i>${h.duration} mins</div>
        </div>
        <span class="workout-tag ${TYPES[h.type]||'tag-strength'}">${h.type||'strength'}</span>
      </div>`).join('') : `<p style="color:var(--muted);font-size:14px;">No sessions logged yet.</p>`;
  }

  // ── PLANNER ──
  function renderPlanner() {
    const ti = todayIdx();
    document.getElementById('cal-strip').innerHTML = DAYS.map((d, i) => {
      const hasW = state.workouts.some(w => w.day == i);
      const date = new Date(); date.setDate(date.getDate() + (i - ti));
      return `<div class="cal-day ${i===ti?'today':''} ${i===state.selectedDay?'selected':''} ${hasW?'has-workout':'rest'}" onclick="selectDay(${i})">
        <div class="cal-dow">${d.slice(0,3)}</div>
        <div class="cal-num">${date.getDate()}</div>
      </div>`;
    }).join('');
    renderDayWorkouts();
  }

  function selectDay(i) { state.selectedDay = i; save(); renderPlanner(); }

  function renderDayWorkouts() {
    const ws = state.workouts.filter(w => w.day == state.selectedDay);
    const el = document.getElementById('day-workouts');
    if (!ws.length) {
      el.innerHTML = `<div style="text-align:center;padding:48px 0;"><i class="bi bi-calendar-x" style="font-size:36px;color:var(--border);"></i><p style="color:var(--muted);margin-top:12px;">No workouts for ${DAYS[state.selectedDay]}.</p><button class="btn-accent mt-2" onclick="openAddWorkout(${state.selectedDay})"><i class="bi bi-plus"></i> Add Workout</button></div>`;
      return;
    }
    el.innerHTML = `<div class="row g-3">${ws.map(w => wCardHTML(w)).join('')}</div>`;
  }

  // ── LIBRARY ──
  function renderLibrary() {
    const el = document.getElementById('workout-library');
    el.innerHTML = state.workouts.length ? state.workouts.map(w => `<div class="col-md-6 col-lg-4">${wCardHTML(w)}</div>`).join('')
      : `<div class="col-12 text-center py-5"><i class="bi bi-lightning-charge" style="font-size:36px;color:var(--border);"></i><p style="color:var(--muted);margin-top:12px;">No plans yet.</p><button class="btn-accent mt-2" onclick="openAddWorkout()"><i class="bi bi-plus"></i> Create First Plan</button></div>`;
  }

  function wCardHTML(w) {
    return `<div class="workout-card">
      <span class="workout-tag ${TYPES[w.type]}">${w.type}</span>
      <div class="workout-name">${w.name}</div>
      <div class="workout-meta mb-3">
        <span><i class="bi bi-calendar3"></i> ${DAYS[w.day]}</span>
        <span><i class="bi bi-clock"></i> ${w.duration} mins</span>
        <span><i class="bi bi-list-ol"></i> ${w.exercises.length} ex</span>
      </div>
      ${w.notes ? `<div style="font-size:12px;color:var(--muted);margin-bottom:12px;border-left:2px solid var(--border);padding-left:8px;">${w.notes}</div>` : ''}
      <div class="prog-bar-bg mb-3"><div class="prog-bar-fill" style="width:${Math.min(w.exercises.length*10,100)}%"></div></div>
      <div class="d-flex gap-2">
        <button class="btn-accent" style="flex:1;justify-content:center;" onclick="startWorkout('${w.id}')"><i class="bi bi-play-fill"></i> Start</button>
        <button class="btn-ghost" onclick="deleteWorkout('${w.id}')"><i class="bi bi-trash"></i></button>
      </div>
    </div>`;
  }

  // ── HISTORY ──
  function renderHistory() {
    document.getElementById('history-count').textContent = state.history.length + ' sessions';
    const list = document.getElementById('history-list');
    list.innerHTML = state.history.length ? [...state.history].reverse().map(h => `
      <div class="history-item">
        <div>
          <div class="history-name">${h.workoutName}</div>
          <div class="history-date"><i class="bi bi-calendar2 me-1"></i>${new Date(h.date).toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})} &nbsp;·&nbsp; <i class="bi bi-clock me-1"></i>${h.duration} mins</div>
          ${h.exercises ? `<div style="font-size:12px;color:var(--muted);margin-top:4px;">${h.exercises.map(e=>e.name).join(', ')}</div>` : ''}
        </div>
        <div class="text-end">
          <span class="workout-tag ${TYPES[h.type]||'tag-strength'}">${h.type||'strength'}</span>
          <button class="btn-danger-sm d-block mt-2" onclick="deleteHistory('${h.id}')"><i class="bi bi-trash"></i></button>
        </div>
      </div>`).join('') : `<p style="color:var(--muted);font-size:14px;">No sessions logged yet.</p>`;
  }

  // ── ADD/SAVE WORKOUT ──
  function openAddWorkout(dayOverride) {
    document.getElementById('wk-name').value = '';
    document.getElementById('wk-type').value = 'strength';
    document.getElementById('wk-duration').value = '45';
    document.getElementById('wk-notes').value = '';
    document.getElementById('wk-day').value = dayOverride !== undefined ? dayOverride : state.selectedDay;
    document.getElementById('exercise-rows').innerHTML = '';
    addExRow(); addExRow(); addExRow();
    new bootstrap.Modal(document.getElementById('workoutModal')).show();
  }

  let exCounter = 0;
  function addExRow() {
    const id = ++exCounter;
    const tbody = document.getElementById('exercise-rows');
    const tr = document.createElement('tr');
    tr.id = 'exr-' + id;
    tr.innerHTML = `
      <td><input type="text" class="set-input" style="width:140px;" placeholder="Exercise name"/></td>
      <td><input type="number" class="set-input" value="3" min="1" max="20"/></td>
      <td><input type="text" class="set-input" style="width:80px;" value="10"/></td>
      <td><input type="number" class="set-input" value="60" min="0"/></td>
      <td><button style="background:none;border:none;color:var(--muted);font-size:16px;cursor:pointer;" onclick="document.getElementById('exr-${id}').remove()"><i class="bi bi-x-lg"></i></button></td>`;
    tbody.appendChild(tr);
  }

  function saveWorkout() {
    const name = document.getElementById('wk-name').value.trim();
    if (!name) { alert('Please enter a workout name.'); return; }
    const exercises = [];
    document.querySelectorAll('#exercise-rows tr').forEach(row => {
      const inputs = row.querySelectorAll('input');
      const n = inputs[0].value.trim();
      if (n) exercises.push({ name: n, sets: inputs[1].value, reps: inputs[2].value, rest: inputs[3].value });
    });
    state.workouts.push({ id: 'w'+Date.now(), name, type: document.getElementById('wk-type').value, day: parseInt(document.getElementById('wk-day').value), duration: parseInt(document.getElementById('wk-duration').value)||45, notes: document.getElementById('wk-notes').value.trim(), exercises, created: new Date().toISOString() });
    save();
    bootstrap.Modal.getInstance(document.getElementById('workoutModal')).hide();
    renderLibrary(); renderPlanner(); renderDashboard();
  }

  function deleteWorkout(id) {
    if (!confirm('Delete this workout plan?')) return;
    state.workouts = state.workouts.filter(w => w.id !== id);
    save(); renderLibrary(); renderDashboard(); renderPlanner();
  }

  function deleteHistory(id) {
    state.history = state.history.filter(h => h.id !== id);
    save(); renderHistory(); renderDashboard();
  }

  // ── START WORKOUT ──
  function startWorkout(id) {
    activeWorkout = state.workouts.find(w => w.id === id);
    if (!activeWorkout) return;
    document.getElementById('start-title').textContent = activeWorkout.name;
    document.getElementById('start-meta').textContent = DAYS[activeWorkout.day] + ' · ' + activeWorkout.duration + ' mins · ' + activeWorkout.type;
    document.getElementById('active-exercise-rows').innerHTML = activeWorkout.exercises.map((e, i) => `
      <tr><td style="font-weight:500;">${e.name}</td><td>${e.sets}</td><td>${e.reps}</td><td>${e.rest}s</td>
      <td><input type="number" class="set-input" placeholder="0" min="0" step="2.5"/></td>
      <td><input type="checkbox" class="done-check" onchange="updateProgress()"/></td></tr>`).join('');
    updateProgress();
    startTimer();
    new bootstrap.Modal(document.getElementById('startModal')).show();
  }

  function updateProgress() {
    const checks = document.querySelectorAll('#active-exercise-rows .done-check');
    const done = [...checks].filter(c => c.checked).length;
    document.getElementById('progress-label').textContent = done + ' / ' + checks.length + ' done';
    document.getElementById('progress-bar').style.width = (checks.length ? Math.round((done/checks.length)*100) : 0) + '%';
  }

  function startTimer() {
    stopTimer(); timerStart = Date.now();
    timerInterval = setInterval(() => {
      const s = Math.floor((Date.now() - timerStart) / 1000);
      document.getElementById('timer-display').textContent = String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
    }, 1000);
  }
  function stopTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }

  function finishWorkout() {
    if (!activeWorkout) return;
    const mins = timerStart ? Math.max(Math.round((Date.now()-timerStart)/60000),1) : activeWorkout.duration;
    stopTimer();
    state.history.push({ id:'h'+Date.now(), workoutName:activeWorkout.name, type:activeWorkout.type, date:new Date().toISOString(), duration:mins, exercises:activeWorkout.exercises });
    save();
    activeWorkout = null;
    bootstrap.Modal.getInstance(document.getElementById('startModal')).hide();
    showView('dashboard');
    setTimeout(() => alert('Workout complete! Great job!'), 300);
  }

  // Init
  renderDashboard();
  renderPlanner();