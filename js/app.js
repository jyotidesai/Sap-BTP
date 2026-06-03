/**
 * ============================================================
 * SAP BTP MASTERY PORTAL — APP LOGIC (full-screen layout)
 * ============================================================
 */

/* ── STATE ───────────────────────────────────────────────────── */
let progress   = {};
let doChecks   = {};
let practicedQ = {};

let curUnitIdx   = 0;
let curLessonIdx = 0;
let curLesson    = null;
let curTab       = 'learn';
let curQFilter   = 'all';
let sidebarOpen  = true;

function loadState() {
  try { progress   = JSON.parse(localStorage.getItem('btp_progress')  || '{}'); } catch(e) { progress = {}; }
  try { doChecks   = JSON.parse(localStorage.getItem('btp_dochecks')  || '{}'); } catch(e) { doChecks = {}; }
  try { practicedQ = JSON.parse(localStorage.getItem('btp_practiced') || '{}'); } catch(e) { practicedQ = {}; }
  if (progress['u2l2'] === undefined) progress['u2l2'] = true;
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = localStorage.getItem('btp_theme') === 'light' ? '☀️' : '🌙';
}
function saveProgress()  {
  localStorage.setItem('btp_progress', JSON.stringify(progress));
  syncProgressToServer();
}
function saveDoChecks()  {
  localStorage.setItem('btp_dochecks', JSON.stringify(doChecks));
  syncProgressToServer();
}
function savePracticed() {
  localStorage.setItem('btp_practiced', JSON.stringify(practicedQ));
  syncProgressToServer();
}

function getApiUrl() {
  return (typeof CONFIG !== 'undefined' && CONFIG.apiUrl) ? CONFIG.apiUrl : 'http://localhost:3001';
}

function syncProgressToServer() {
  const token = typeof Auth !== 'undefined' ? Auth.getToken() : null;
  if (!token) return;
  fetch(`${getApiUrl()}/api/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ progress, doChecks, practicedQ })
  }).catch(() => {});
}

async function loadProgressFromServer() {
  const token = typeof Auth !== 'undefined' ? Auth.getToken() : null;
  if (!token) return;
  try {
    const res = await fetch(`${getApiUrl()}/api/progress`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.progress)   { progress   = data.progress;   localStorage.setItem('btp_progress',  JSON.stringify(progress)); }
    if (data.doChecks)   { doChecks   = data.doChecks;   localStorage.setItem('btp_dochecks',  JSON.stringify(doChecks)); }
    if (data.practicedQ) { practicedQ = data.practicedQ; localStorage.setItem('btp_practiced', JSON.stringify(practicedQ)); }
    render();
    renderInterviewSection();
  } catch(e) {}
}

function resetAll() {
  if (!confirm('Reset all progress?')) return;
  progress = {}; doChecks = {}; practicedQ = {};
  saveProgress(); saveDoChecks(); savePracticed();
  localStorage.removeItem('btp_last_lesson');
  showDashboard();
  render();
  renderInterviewSection();
}

/* ── DATA ────────────────────────────────────────────────────── */
const ALL_UNITS = [UNIT1, UNIT2, UNIT3, UNIT4, UNIT5, UNIT6, UNIT7, UNIT8];

function allLessons() {
  return ALL_UNITS.flatMap((u, ui) =>
    u.lessons.map((l, li) => ({ ...l, unitIdx: ui, lessonIdx: li }))
  );
}

/* ── PROGRESS HELPERS ────────────────────────────────────────── */
function unitProgress(unit) {
  const done  = unit.lessons.filter(l => progress[l.id]).length;
  const total = unit.lessons.length;
  return { done, total, pct: Math.round((done / total) * 100) };
}
function totalProgress() {
  const ls    = allLessons();
  const done  = ls.filter(l => progress[l.id]).length;
  const total = ls.length;
  return { done, total, pct: Math.round((done / total) * 100) };
}
function unitsWithAnyProgress() {
  return new Set(ALL_UNITS.filter(u => u.lessons.some(l => progress[l.id])).map(u => u.id));
}

/* ── SIDEBAR TOGGLE ──────────────────────────────────────────── */
function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  document.body.classList.toggle('sidebar-collapsed', !sidebarOpen);
}

/* ── THEME TOGGLE ────────────────────────────────────────────── */
function toggleTheme() {
  const isLight = document.body.classList.toggle('light-mode');
  localStorage.setItem('btp_theme', isLight ? 'light' : 'dark');
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = isLight ? '☀️' : '🌙';
}

/* ── VIEW SWITCHING ──────────────────────────────────────────── */
function showDashboard() {
  const dash   = document.getElementById('viewDashboard');
  const lesson = document.getElementById('viewLesson');
  lesson.style.display = 'none';
  dash.style.display   = 'block';
  dash.classList.remove('view-enter');
  void dash.offsetWidth; // reflow to restart animation
  dash.classList.add('view-enter');
  document.getElementById('headerBreadcrumb').style.display = 'none';
  renderSidebar();
}

function showLesson() {
  const dash   = document.getElementById('viewDashboard');
  const lesson = document.getElementById('viewLesson');
  dash.style.display   = 'none';
  lesson.style.display = 'block';
  lesson.classList.remove('view-enter');
  void lesson.offsetWidth;
  lesson.classList.add('view-enter');
  document.getElementById('mainContent').scrollTop = 0;
}

function scrollToInterview() {
  const el = document.getElementById('interviewSection');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── RENDER ──────────────────────────────────────────────────── */
function render() {
  renderHeader();
  renderProgressBar();
  renderTracker();
  renderSidebar();
  renderUnits();
  const heroSub = document.getElementById('heroSub');
  if (heroSub) heroSub.textContent = CONFIG.heroSub;
}

function renderHeader() {
  const { done, total } = totalProgress();
  const el = document.getElementById('headerProgress');
  if (el) el.textContent = `${done} / ${total}`;
}

function renderProgressBar() {
  const { pct, done, total } = totalProgress();
  const fill  = document.getElementById('progFill');
  const label = document.getElementById('progPct');
  const sbFill  = document.getElementById('sbProgFill');
  const sbLabel = document.getElementById('sbProgText');
  if (fill)    fill.style.width    = pct + '%';
  if (label)   label.textContent   = pct + '%';
  if (sbFill)  sbFill.style.width  = pct + '%';
  if (sbLabel) sbLabel.textContent = `${done} / ${total} lessons`;
}

function renderTracker() {
  const el = document.getElementById('trackerGrid');
  if (!el) return;
  const doneUnits = unitsWithAnyProgress();
  el.innerHTML = PROJECT_TRACKER.map(b => {
    const unlocked = doneUnits.has(b.unlockUnit);
    return `<div class="tracker-card ${unlocked ? 'unlocked' : 'locked'}">
      <div class="tc-unit">Unit ${b.unlockUnit}</div>
      <div class="tc-title">${b.title}</div>
      ${unlocked ? `<span class="tc-tag">${b.tag} ✓</span>` : '<span class="tc-lock">🔒</span>'}
    </div>`;
  }).join('');
}

function renderSidebar() {
  const el = document.getElementById('sidebarNav');
  if (!el) return;
  el.innerHTML = ALL_UNITS.map((unit, ui) => {
    const p = unitProgress(unit);
    const isExpanded = unit.lessons.some((l, li) => ui === curUnitIdx);

    const lessonsHtml = unit.lessons.map((l, li) => {
      const done   = !!progress[l.id];
      const active = (ui === curUnitIdx && li === curLessonIdx && document.getElementById('viewLesson').style.display !== 'none');
      return `<div class="sb-lesson-item ${done ? 'done' : ''} ${active ? 'active' : ''}"
                   onclick="openLesson(${ui}, ${li})">
        <div class="sb-lesson-dot"></div>
        <span style="overflow:hidden;text-overflow:ellipsis">${l.title}</span>
      </div>`;
    }).join('');

    return `
      <div class="sb-item" onclick="toggleSbUnit(${ui})" id="sb-unit-${ui}">
        <div class="sb-dot" style="background:${unit.color}"></div>
        <div class="sb-text">Unit ${unit.id}: ${unit.title}</div>
        <div class="sb-count">${p.done}/${p.total}</div>
      </div>
      <div class="sb-lessons" id="sb-lessons-${ui}" style="display:${isExpanded ? 'block' : 'none'}">
        ${lessonsHtml}
      </div>`;
  }).join('');
}

function toggleSbUnit(ui) {
  const lessonsEl = document.getElementById('sb-lessons-' + ui);
  if (!lessonsEl) return;
  const isOpen = lessonsEl.style.display !== 'none';
  // close all
  ALL_UNITS.forEach((_, i) => {
    const el = document.getElementById('sb-lessons-' + i);
    if (el) el.style.display = 'none';
  });
  // open clicked if it was closed
  if (!isOpen) lessonsEl.style.display = 'block';
}

function renderUnits() {
  const container = document.getElementById('unitsContainer');
  if (!container) return;

  container.innerHTML = ALL_UNITS.map((unit, ui) => {
    const p = unitProgress(unit);
    const open = (ui < 2);

    let statusClass = 'status-todo', statusText = 'Not Started';
    if (p.done === p.total) { statusClass = 'status-done'; statusText = 'Complete'; }
    else if (p.done > 0)   { statusClass = 'status-prog'; statusText = 'In Progress'; }

    const lessonsHtml = unit.lessons.map((lesson, li) => {
      const done = !!progress[lesson.id];
      return `
        <div class="lesson-row ${done ? 'done' : ''}" onclick="openLesson(${ui}, ${li})">
          <div class="lesson-check">${done ? '✓' : ''}</div>
          <div class="lesson-title">${lesson.title}</div>
          <div class="lesson-action">${done ? 'Review' : 'Learn →'}</div>
          ${CONFIG.features.mindmapPreviews
            ? `<button class="mm-toggle" onclick="event.stopPropagation();toggleMindMap('${lesson.id}',this)" title="Mind map">⬡</button>`
            : ''}
        </div>
        <div class="mm-preview" id="mmp-${lesson.id}" style="display:none">
          <div class="mm-preview-inner" id="mmc-${lesson.id}"></div>
        </div>`;
    }).join('');

    return `
      <div class="unit-card ${open ? 'open' : ''}" id="unit-${ui}">
        <div class="unit-prog-bar">
          <div class="unit-prog-fill" style="width:${p.pct}%;background:${unit.color}"></div>
        </div>
        <div class="unit-header" onclick="toggleUnit(${ui})">
          <div class="unit-badge" style="background:${unit.color}22;color:${unit.color}">Unit ${unit.id}</div>
          <div class="unit-header-text">
            <h3>${unit.title}</h3>
            <p>${unit.subtitle} · ${p.done}/${p.total} lessons</p>
          </div>
          <div class="unit-status ${statusClass}">${statusText}</div>
          <div class="unit-chevron">▼</div>
        </div>
        <div class="unit-body">${lessonsHtml}</div>
      </div>`;
  }).join('');
}

function toggleUnit(i) {
  document.getElementById('unit-' + i)?.classList.toggle('open');
}

function toggleMindMap(lessonId, btn) {
  const preview = document.getElementById('mmp-' + lessonId);
  if (!preview) return;
  const isOpen = preview.style.display !== 'none';
  if (isOpen) { preview.style.display = 'none'; btn.classList.remove('active'); return; }
  preview.style.display = 'block';
  btn.classList.add('active');
  const content = document.getElementById('mmc-' + lessonId);
  if (!content) return;
  const lesson = allLessons().find(l => l.id === lessonId);
  if (!lesson?.recap) return;
  const temp = document.createElement('div');
  temp.innerHTML = lesson.recap;
  const mm = temp.querySelector('.recap-mm');
  if (mm) content.innerHTML = mm.innerHTML;
}

/* ── LESSON OPEN / CLOSE / NAV ───────────────────────────────── */
function openLesson(unitIdx, lessonIdx) {
  curUnitIdx   = unitIdx;
  curLessonIdx = lessonIdx;
  localStorage.setItem('btp_last_lesson', JSON.stringify({ unitIdx, lessonIdx }));
  const unit   = ALL_UNITS[unitIdx];
  curLesson    = unit.lessons[lessonIdx];

  // Update lesson top bar
  document.getElementById('lessonTopTitle').textContent =
    `Unit ${unit.id} — ${curLesson.title}`;

  // Update header breadcrumb
  const bc = document.getElementById('headerBreadcrumb');
  if (bc) {
    bc.style.display = 'block';
    bc.textContent   = `Unit ${unit.id}: ${unit.title}  ›  ${curLesson.title}`;
  }

  // Nav label
  const lessons = allLessons();
  const curIdx  = lessons.findIndex(l => l.unitIdx === unitIdx && l.lessonIdx === lessonIdx);
  const navLabel = document.getElementById('lessonNavLabel');
  if (navLabel) navLabel.textContent = `Lesson ${curIdx + 1} of ${lessons.length}`;

  showLesson();
  updateMarkButton();
  updateNavButtons();
  switchTab('learn');
  renderSidebar();

  // Expand this unit in sidebar
  ALL_UNITS.forEach((_, i) => {
    const el = document.getElementById('sb-lessons-' + i);
    if (el) el.style.display = (i === unitIdx ? 'block' : 'none');
  });
}

function updateMarkButton() {
  const btn  = document.getElementById('markBtn');
  const done = !!progress[curLesson?.id];
  if (!btn) return;
  btn.textContent = done ? '✓ Completed' : 'Mark as Complete';
  btn.classList.toggle('marked', done);
}

function updateNavButtons() {
  const lessons = allLessons();
  const curIdx  = lessons.findIndex(l => l.unitIdx === curUnitIdx && l.lessonIdx === curLessonIdx);
  document.getElementById('prevBtn').disabled = (curIdx <= 0);
  document.getElementById('nextBtn').disabled = (curIdx >= lessons.length - 1);
}

function navLesson(dir) {
  const lessons = allLessons();
  const curIdx  = lessons.findIndex(l => l.unitIdx === curUnitIdx && l.lessonIdx === curLessonIdx);
  const next    = lessons[curIdx + dir];
  if (next) openLesson(next.unitIdx, next.lessonIdx);
}

function toggleLessonDone() {
  if (!curLesson) return;
  const wasMarked = !!progress[curLesson.id];
  progress[curLesson.id] = !wasMarked;
  saveProgress();
  updateMarkButton();
  render();
  if (!wasMarked) {
    const btn = document.getElementById('markBtn');
    if (btn) {
      btn.classList.remove('celebrate');
      void btn.offsetWidth;
      btn.classList.add('celebrate');
    }
  }
}

/* ── TAB SWITCHING ───────────────────────────────────────────── */
function switchTab(tabName) {
  curTab = tabName;
  ['learn','seeit','doit','recap'].forEach(t => {
    document.getElementById('tab-' + t).classList.toggle('active', t === tabName);
    document.getElementById('tp-'  + t).classList.toggle('active', t === tabName);
  });
  if (tabName === 'learn')  renderLearnTab();
  if (tabName === 'seeit')  renderSeeItTab();
  if (tabName === 'doit')   renderDoItTab();
  if (tabName === 'recap')  renderRecapTab();
}

/* ── TAB RENDERERS ───────────────────────────────────────────── */
function renderLearnTab() {
  const el = document.getElementById('learnContent');
  if (!el || !curLesson) return;
  el.innerHTML = curLesson.learn || '<p style="color:var(--text3)">Content coming soon.</p>';
  const askSec = document.getElementById('askSection');
  if (askSec) askSec.style.display = CONFIG.features.askFollowup ? 'block' : 'none';
}

function renderSeeItTab() {
  const el = document.getElementById('seeContent');
  if (!el || !curLesson) return;
  el.innerHTML = curLesson.seeit || '<p style="color:var(--text3)">Content coming soon.</p>';
}

function renderDoItTab() {
  const el = document.getElementById('doContent');
  if (!el || !curLesson) return;
  const d = curLesson.doit;
  if (!d) { el.innerHTML = '<p style="color:var(--text3)">Exercise coming soon.</p>'; return; }
  const lid    = curLesson.id;
  const checks = doChecks[lid] || {};

  el.innerHTML = `
    <div class="exercise-header">
      <div class="exercise-label">Hands-on Exercise</div>
      <h3>${d.goal || curLesson.title}</h3>
      <p>${curLesson.title}</p>
      <span class="exercise-time">⏱ ${d.time || '~20 min'}</span>
    </div>
    <div class="do-steps">
      ${(d.steps || []).map((step, i) => {
        const checked = !!checks[i];
        const txt = step.replace(/\[([^\]]+)\]/g, '<code>$1</code>');
        return `<div class="do-step ${checked ? 'checked' : ''}" onclick="toggleDoStep('${lid}',${i})">
          <div class="do-check">${checked ? '✓' : ''}</div>
          <div class="do-step-text">${txt}</div>
        </div>`;
      }).join('')}
    </div>
    <div class="verify-box">
      <strong>✅ Done when:</strong>
      <ul>${(d.verify || []).map(v => `<li>${v}</li>`).join('')}</ul>
    </div>
    <div class="project-note">
      <div class="project-note-label">🔨 Project Tracker</div>
      <p>${d.projectNote || 'This builds a piece of your Project Tracker app.'}</p>
    </div>`;
}

function toggleDoStep(lid, idx) {
  if (!doChecks[lid]) doChecks[lid] = {};
  doChecks[lid][idx] = !doChecks[lid][idx];
  saveDoChecks();
  renderDoItTab();
}

function renderRecapTab() {
  const el = document.getElementById('recapContent');
  if (!el || !curLesson) return;
  el.innerHTML = curLesson.recap || '<p style="color:var(--text3)">Recap coming soon.</p>';
}

/* ── INTERVIEW PREP ──────────────────────────────────────────── */
function renderInterviewSection() {
  renderIVStats();
  renderQuestions();
}

function renderIVStats() {
  const total     = INTERVIEW_QUESTIONS.length;
  const practiced = INTERVIEW_QUESTIONS.filter(q => practicedQ[q.id]).length;
  const el_t = document.getElementById('ivTotal');
  const el_p = document.getElementById('ivPracticed');
  const el_r = document.getElementById('ivRemaining');
  if (el_t) el_t.textContent = total;
  if (el_p) el_p.textContent = practiced;
  if (el_r) el_r.textContent = total - practiced;
}

function filterQuestions(filter, btn) {
  curQFilter = filter;
  document.querySelectorAll('.iv-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderQuestions();
}

function renderQuestions() {
  const el = document.getElementById('questionsGrid');
  if (!el) return;
  let qs = INTERVIEW_QUESTIONS;
  if (curQFilter === 'unprac') qs = qs.filter(q => !practicedQ[q.id]);
  else if (curQFilter !== 'all') qs = qs.filter(q => q.category === curQFilter);

  const catLabel = { theory:'📘 Theory', scenario:'🎭 Scenario', arch:'🏗 Architecture', client:'🤝 Client' };
  const lvlClass = { junior:'level-junior', senior:'level-senior', architect:'level-architect' };
  const lvlLabel = { junior:'Junior', senior:'Senior', architect:'Architect' };

  el.innerHTML = qs.map(q => {
    const prac = !!practicedQ[q.id];
    return `
      <div class="question-card cat-${q.category} ${prac ? 'practiced' : ''}">
        <div class="qcard-top">
          <div class="qcard-meta">
            <span class="qcat-badge">${catLabel[q.category]}</span>
            <span class="qlevel ${lvlClass[q.level]}">${lvlLabel[q.level]}</span>
            ${prac ? '<span class="qpracticed-badge">✓ Practiced</span>' : ''}
          </div>
          <div class="qcard-question">${q.question}</div>
          <div class="qcard-hint" onclick="toggleHint('${q.id}',this)">
            <span class="hint-label">💡 Hint (click to reveal)</span>
            <span id="hint-${q.id}" style="display:none">${q.hint}</span>
          </div>
        </div>
        <div class="qcard-answer" id="qa-${q.id}">
          <div class="answer-content">${q.answer}</div>
        </div>
        <div class="qcard-footer">
          <button class="reveal-btn" id="rb-${q.id}" onclick="toggleAnswer('${q.id}')">Show Answer</button>
          <button class="practiced-btn" onclick="togglePracticed('${q.id}')">${prac ? '✓ Practiced' : 'Mark Practiced'}</button>
        </div>
      </div>`;
  }).join('');
}

function toggleHint(qid, el) {
  const h = document.getElementById('hint-' + qid);
  const l = el.querySelector('.hint-label');
  if (!h) return;
  const showing = h.style.display !== 'none';
  h.style.display = showing ? 'none' : 'block';
  l.textContent   = showing ? '💡 Hint (click to reveal)' : '💡 Hint';
}

function toggleAnswer(qid) {
  const a = document.getElementById('qa-' + qid);
  const b = document.getElementById('rb-' + qid);
  if (!a || !b) return;
  const open = a.classList.contains('open');
  a.classList.toggle('open', !open);
  b.classList.toggle('open', !open);
  b.textContent = open ? 'Show Answer' : 'Hide Answer';
}

function togglePracticed(qid) {
  practicedQ[qid] = !practicedQ[qid];
  savePracticed();
  renderInterviewSection();
}

/* ── GUIDE ───────────────────────────────────────────────────── */
const GUIDE_STEPS = [
  {
    icon: '👋',
    title: 'Welcome to SAP BTP Mastery',
    body: `<p>This portal takes you from zero to BTP Technical Architect through <strong>8 units</strong> and <strong>25 lessons</strong> — each with four learning layers so you don't just read theory, you actually build things.</p>
           <p>This quick guide walks you through every part of the portal. It takes about 2 minutes.</p>
           <div class="guide-tip">💡 You can reopen this guide any time by clicking <strong>? Guide</strong> in the top bar.</div>`
  },
  {
    icon: '🗂️',
    title: 'Dashboard — Your Home Base',
    body: `<p>The dashboard is your central overview. From here you can see everything at a glance:</p>
           <ul class="guide-list">
             <li><span class="guide-badge" style="background:rgba(79,142,247,0.15);color:#4F8EF7">Overall Progress</span> — the bar at the top shows your completion % across all 25 lessons.</li>
             <li><span class="guide-badge" style="background:rgba(0,212,170,0.12);color:#00D4AA">Project Tracker</span> — 12 building blocks that unlock as you complete units. Each block is a real feature of your Project Tracker app.</li>
             <li><span class="guide-badge" style="background:rgba(123,92,240,0.12);color:#7B5CF0">Unit Cards</span> — 8 expandable cards, one per unit. Click a card header to expand it and see the lessons inside.</li>
             <li><span class="guide-badge" style="background:rgba(245,166,35,0.12);color:#F5A623">Interview Prep</span> — 30 curated questions at the bottom. Filter by category or difficulty.</li>
           </ul>`
  },
  {
    icon: '📚',
    title: 'Opening a Lesson',
    body: `<p>Click any <strong>lesson row</strong> inside a unit card to open it full-screen. You can also navigate from the <strong>sidebar</strong> on the left.</p>
           <div class="guide-img-row">
             <div class="guide-step-box"><div class="guide-step-num">1</div><div>Click a unit card to expand it</div></div>
             <div class="guide-arrow">→</div>
             <div class="guide-step-box"><div class="guide-step-num">2</div><div>Click a lesson row to open it</div></div>
             <div class="guide-arrow">→</div>
             <div class="guide-step-box"><div class="guide-step-num">3</div><div>Use ← → buttons at the bottom to move between lessons</div></div>
           </div>
           <div class="guide-tip">💡 Press <kbd>Esc</kbd> at any time to return to the dashboard.</div>`
  },
  {
    icon: '🔖',
    title: 'The 4 Learning Tabs',
    body: `<p>Every lesson has four tabs. Work through them in order for the best results:</p>
           <div class="guide-tabs-demo">
             <div class="guide-tab-item">
               <div class="guide-tab-label" style="color:#4F8EF7">📖 Learn</div>
               <div class="guide-tab-desc">Concepts, diagrams, and .NET/Azure analogies. Understand the <em>why</em> before the <em>how</em>.</div>
             </div>
             <div class="guide-tab-item">
               <div class="guide-tab-label" style="color:#00D4AA">👁 See It</div>
               <div class="guide-tab-desc">Step-by-step walkthrough in the BTP Cockpit or tools. Follow along in your browser.</div>
             </div>
             <div class="guide-tab-item">
               <div class="guide-tab-label" style="color:#F5A623">🛠 Do It</div>
               <div class="guide-tab-desc">Hands-on exercise. Check off each step as you complete it. Builds your Project Tracker app.</div>
             </div>
             <div class="guide-tab-item">
               <div class="guide-tab-label" style="color:#7B5CF0">🧠 Recap</div>
               <div class="guide-tab-desc">Mind map, key takeaways, and test-yourself questions. Solidifies what you learned.</div>
             </div>
           </div>`
  },
  {
    icon: '✅',
    title: 'Tracking Your Progress',
    body: `<p>Progress is saved automatically in your browser. Here's how the tracking works:</p>
           <ul class="guide-list">
             <li><strong>Mark as Complete</strong> — click the green button (top-right of any lesson) once you've finished all four tabs. Your progress bar updates instantly.</li>
             <li><strong>Do It checklist</strong> — check off each exercise step as you complete it. Steps are saved independently from lesson completion.</li>
             <li><strong>Sidebar</strong> — the left panel shows a green dot next to completed lessons and a progress bar per unit.</li>
             <li><strong>Project Tracker</strong> — building blocks unlock automatically as you mark lessons done in the relevant unit.</li>
           </ul>
           <div class="guide-tip">💡 Your progress is stored locally in your browser. Use the <strong>Reset</strong> button in the top bar only if you want to start fresh.</div>`
  },
  {
    icon: '🎯',
    title: 'Interview Prep Section',
    body: `<p>Scroll to the bottom of the dashboard to find <strong>30 interview questions</strong> across four categories:</p>
           <ul class="guide-list">
             <li><span class="guide-badge" style="background:rgba(79,142,247,0.12);color:#4F8EF7">📘 Theory</span> — conceptual questions a recruiter or lead architect will ask</li>
             <li><span class="guide-badge" style="background:rgba(123,92,240,0.12);color:#7B5CF0">🎭 Scenarios</span> — real-world problem-solving ("your app fails in prod, what do you check?")</li>
             <li><span class="guide-badge" style="background:rgba(231,76,60,0.12);color:#E74C3C">🏗 Architecture</span> — design questions requiring full system thinking</li>
             <li><span class="guide-badge" style="background:rgba(0,212,170,0.12);color:#00D4AA">🤝 Client</span> — how to answer tough client questions confidently</li>
           </ul>
           <p style="margin-top:12px">Click <strong>💡 Hint</strong> to get a nudge, then <strong>Show Answer</strong> to reveal the model answer. Click <strong>Mark Practiced</strong> once you can answer confidently without reading it.</p>`
  },
  {
    icon: '⌨️',
    title: 'Keyboard Shortcuts & Tips',
    body: `<div class="guide-shortcuts">
             <div class="guide-shortcut-row"><kbd>Esc</kbd><span>Return to dashboard from any lesson</span></div>
             <div class="guide-shortcut-row"><kbd>← Prev</kbd><span>Go to the previous lesson (bottom nav)</span></div>
             <div class="guide-shortcut-row"><kbd>Next →</kbd><span>Go to the next lesson (bottom nav)</span></div>
             <div class="guide-shortcut-row"><kbd>☰</kbd><span>Toggle the sidebar open/closed</span></div>
             <div class="guide-shortcut-row"><kbd>🌙</kbd><span>Switch between dark and light mode</span></div>
             <div class="guide-shortcut-row"><kbd>? Guide</kbd><span>Reopen this guide at any time</span></div>
           </div>
           <div class="guide-tip" style="margin-top:16px">💡 <strong>Recommended path:</strong> Work through units 1 → 8 in order. Each unit builds on the previous. Don't skip the Do It exercises — they build your Project Tracker app step by step.</div>`
  }
];

let guideStep = 0;

function showGuide(autoShow) {
  if (document.getElementById('guide-overlay')) return;

  guideStep = 0;
  const overlay = document.createElement('div');
  overlay.id = 'guide-overlay';
  overlay.innerHTML = `
    <div class="guide-modal">
      <button class="guide-close" onclick="hideGuide()" title="Close guide">✕</button>
      <div class="guide-progress-dots" id="guideDots"></div>
      <div class="guide-body" id="guideBody"></div>
      <div class="guide-footer">
        <button class="guide-nav-btn" id="guidePrev" onclick="guideNav(-1)">← Back</button>
        <span class="guide-step-label" id="guideStepLabel"></span>
        <button class="guide-nav-btn primary" id="guideNext" onclick="guideNav(1)">Next →</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  renderGuideStep();

  // Close on backdrop click
  overlay.addEventListener('click', e => { if (e.target === overlay) hideGuide(); });
}

function hideGuide() {
  const el = document.getElementById('guide-overlay');
  if (el) { el.classList.add('guide-fade-out'); setTimeout(() => el.remove(), 250); }
  localStorage.setItem('btp_guide_seen', '1');
}

function guideNav(dir) {
  const next = guideStep + dir;
  if (next < 0) return;
  if (next >= GUIDE_STEPS.length) { hideGuide(); return; }
  guideStep = next;
  renderGuideStep();
}

function renderGuideStep() {
  const step  = GUIDE_STEPS[guideStep];
  const total = GUIDE_STEPS.length;

  // Dots
  const dots = document.getElementById('guideDots');
  if (dots) {
    dots.innerHTML = GUIDE_STEPS.map((_, i) =>
      `<span class="guide-dot ${i === guideStep ? 'active' : ''}" onclick="guideStep=${i};renderGuideStep()"></span>`
    ).join('');
  }

  // Body
  const body = document.getElementById('guideBody');
  if (body) {
    body.innerHTML = `
      <div class="guide-icon">${step.icon}</div>
      <h2 class="guide-title">${step.title}</h2>
      <div class="guide-content">${step.body}</div>`;
    body.classList.remove('guide-slide-in');
    void body.offsetWidth;
    body.classList.add('guide-slide-in');
  }

  // Footer
  const prev  = document.getElementById('guidePrev');
  const nxt   = document.getElementById('guideNext');
  const label = document.getElementById('guideStepLabel');
  if (prev)  prev.style.visibility  = guideStep === 0 ? 'hidden' : 'visible';
  if (label) label.textContent = `${guideStep + 1} of ${total}`;
  if (nxt)   nxt.textContent   = guideStep === total - 1 ? '✓ Done' : 'Next →';
}

/* ── KEYBOARD ────────────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (document.getElementById('guide-overlay')) { hideGuide(); return; }
    showDashboard();
  }
});

/* ── INIT ────────────────────────────────────────────────────── */
// Called by auth.js after successful login/token verification
window.initApp = function(userName) {
  loadState();
  render();
  renderInterviewSection();
  loadProgressFromServer();
  if (!localStorage.getItem('btp_guide_seen')) {
    setTimeout(() => showGuide(true), 800);
  } else {
    // Reopen last visited lesson if there was one
    try {
      const last = JSON.parse(localStorage.getItem('btp_last_lesson'));
      if (last && ALL_UNITS[last.unitIdx] && ALL_UNITS[last.unitIdx].lessons[last.lessonIdx]) {
        setTimeout(() => openLesson(last.unitIdx, last.lessonIdx), 200);
      }
    } catch(e) {}
  }
};
