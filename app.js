// ── 1. Helpers & LocalStorage Persistence ───────────────────────────────────
const STORAGE_KEY = 'taau_ai_static_v2';
const ACTIVE_SUB_KEY = 'taau_active_subject';

const clamp = (v, min, max, float = false) => Number.isNaN(Number(v)) ? min : (float ? Math.min(Math.max(Number(v), min), max) : Math.round(Math.min(Math.max(Number(v), min), max)));
const txt = (v, max, fb = '') => { const s = String(v ?? '').trim(); return !s ? fb : s.slice(0, max); };
const uidId = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const daysLeft = (d) => Math.max(0, Math.ceil((new Date(`${d}T00:00:00`) - new Date().setHours(0, 0, 0, 0)) / 86400000) || 0);
const shortDate = (d) => Number.isNaN(Date.parse(`${d}T00:00:00`)) ? (d || '') : new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const plusDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const banner = (id, msg) => { const el = $(id); if (!el) return; el.textContent = msg || ''; el.hidden = !msg; };

// ── 2. Local Syllabus, Summary & Quiz Synthesizer ───────────────────────────
function parseSyllabusLocally({ subjectTitle, examDate, currentDate, dailyHours, syllabusText }) {
  const raw = (syllabusText || '').trim();
  const cleanLines = raw
    .split(/\r?\n|;|•/)
    .map((l) => l.replace(/^\s*(unit|mod|module|chapter|week|topic|part)\s*\d*\s*[:.-]?\s*/i, '').replace(/^\s*[-*\d.)]+\s*/, '').trim())
    .filter((l) => l.length >= 2);

  const extracted = [];
  for (const line of cleanLines) {
    if (line.includes(',') && line.length > 42) {
      line.split(',').map((p) => p.trim()).filter((p) => p.length >= 2).forEach((p) => extracted.push(p));
    } else {
      extracted.push(line);
    }
  }

  const seen = new Set();
  const topics = [];
  for (const item of extracted) {
    const clean = txt(item, 140);
    const key = clean.toLowerCase();
    if (clean && !seen.has(key)) { seen.add(key); topics.push(clean); }
    if (topics.length >= 14) break;
  }

  if (!topics.length) topics.push(txt(subjectTitle, 140, 'Core Revision'));

  const totalDays = Math.max(1, daysLeft(examDate) || 1);
  const minsPerSession = clamp(Math.round(dailyHours * 22), 25, 90);
  const startMs = Date.parse(`${currentDate}T00:00:00`) || Date.now();
  const endMs = Math.max(startMs, Date.parse(`${examDate}T00:00:00`) || startMs + totalDays * 86400000);
  const spanDays = Math.max(0, Math.round((endMs - startMs) / 86400000));

  const tasks = [];
  const totalSlots = Math.min(16, Math.max(topics.length + 2, 4));
  for (let i = 0; i < totalSlots; i++) {
    const dayOffset = spanDays === 0 ? 0 : Math.min(spanDays, Math.floor((i / Math.max(1, totalSlots - 1)) * spanDays));
    const scheduledDate = new Date(startMs + dayOffset * 86400000).toISOString().slice(0, 10);
    const isFinalStretch = i >= totalSlots - 2;
    const topic = isFinalStretch
      ? (i === totalSlots - 1 ? `Full Mock: ${subjectTitle}` : `Weak-Topic Drill (${topics[0]})`)
      : topics[i % topics.length];
    const priority = i < Math.ceil(totalSlots * 0.35) || isFinalStretch ? 'high' : (i < Math.ceil(totalSlots * 0.75) ? 'medium' : 'normal');
    const description = isFinalStretch
      ? (i === totalSlots - 1 ? 'Complete a timed comprehensive quiz under exam conditions and audit every mistake.' : 'Re-drill missed questions and double-check key formulas against lecture notes.')
      : `Review core definitions, summarize key rules, and solve practice problems on ${topic}.`;
    tasks.push({
      topicTitle: txt(topic, 150, 'Revision Milestone'),
      description: txt(description, 380),
      scheduledDate,
      durationMinutes: clamp(isFinalStretch ? minsPerSession + 15 : minsPerSession, 20, 120),
      priority,
    });
  }

  const overview = txt(
    `${subjectTitle} exam plan across ${totalDays} day${totalDays === 1 ? '' : 's'} at ${dailyHours}h/day. Covers ${topics.length} syllabus topic${topics.length === 1 ? '' : 's'}: ${topics.slice(0, 6).join(', ')}${topics.length > 6 ? ', and more' : ''}.`,
    980,
  );

  return { syllabusOverview: overview, topics, tasks };
}

function generateSummaryLocally({ subjectTitle, topicTitle }) {
  const cleanTopic = txt(topicTitle, 140, 'Topic');
  return {
    overview: `Focused exam revision sheet for "${cleanTopic}" in ${subjectTitle}. Organized for quick definitions, core rule verification, edge-case checks, and timed recall before exam day.`,
    coreConcepts: [
      `State the exact formal definition and preconditions behind ${cleanTopic} before applying any shortcut.`,
      `Break ${cleanTopic} problems into inputs, core steps/invariants, and expected boundary outputs.`,
      `Trace one concrete worked example by hand from start to finish to verify intermediate states.`,
      `Compare ${cleanTopic} against neighboring units in ${subjectTitle} to identify when each method applies.`,
      `Solve 3 exam-style questions without notes, then audit every missed step.`,
    ],
    formulaSheet: [
      { label: `${cleanTopic} · Core Rule`, expression: 'Preconditions -> Transform / Invariant -> Verified Result', note: 'Verify every assumption before applying' },
      { label: `${cleanTopic} · Edge Check`, expression: 'Test base cases (n = 0, n = 1) & degenerate bounds', note: 'Prevents partial-credit deductions' },
    ],
    examPitfalls: [
      `Applying a rule for ${cleanTopic} without checking whether its preconditions hold.`,
      'Skipping intermediate steps or unit/sign checks under time pressure.',
      'Assuming textbook notation matches your course rubric without double-checking.',
    ],
    memoryAnchor: `For ${cleanTopic}: verify assumptions first, test a minimal boundary case, then solve.`,
  };
}

function generateQuizLocally({ subjectTitle, topicTitle, difficulty, questionCount, topics = [], focusWeaknesses = [] }) {
  const count = clamp(questionCount || 5, 3, 15);
  const activeTopics = focusWeaknesses.length ? focusWeaknesses : (topics.length ? topics : [topicTitle]);
  const questions = [];

  for (let i = 0; i < count; i++) {
    const t = topicTitle === 'Comprehensive Mock' || focusWeaknesses.length
      ? activeTopics[i % activeTopics.length]
      : topicTitle;
    const alt = activeTopics[(i + 1) % activeTopics.length];
    const levelTag = difficulty === 'intensive' ? 'Intensive' : 'Standard';
    const variant = i % 5;

    if (variant === 0) {
      questions.push({
        prompt: `[${levelTag} #${i + 1}] When solving a question on "${t}" in ${subjectTitle}, what is the safest first verification step?`,
        options: [
          'Check preconditions, constraints, and boundary inputs first',
          'Skip directly to the final closed-form substitution',
          'Assume uniform average-case behavior for all inputs',
          'Ignore degenerate cases such as empty or size-1 inputs',
        ],
        correctIndex: 0,
        explanation: `Validating constraints and boundary cases prevents silent mistakes in ${t} problems.`,
      });
    } else if (variant === 1) {
      questions.push({
        prompt: `[${levelTag} #${i + 1}] Which practice habit builds the strongest exam recall for "${t}"?`,
        options: [
          'Passive re-reading of notes without self-testing',
          'Deriving key rules from scratch and solving timed problems',
          'Memorizing one numeric example without checking steps',
          'Skipping error explanations after grading',
        ],
        correctIndex: 1,
        explanation: `Active derivation plus timed solving exposes gaps in ${t} before exam day.`,
      });
    } else if (variant === 2) {
      questions.push({
        prompt: `[${levelTag} #${i + 1}] In a mixed paper combining "${t}" and "${alt}", why verify notation against your class rubric?`,
        options: [
          'Different references may use different indexing, signs, or edge conventions',
          'Notation never affects proof or numerical grading',
          'Rubrics only apply to short-answer questions',
          'All sources use identical symbols and base definitions',
        ],
        correctIndex: 0,
        explanation: 'Checking indexing, inclusive bounds, and base definitions avoids preventable deductions.',
      });
    } else if (variant === 3) {
      questions.push({
        prompt: `[${levelTag} #${i + 1}] If your solution on "${t}" looks off by a factor or sign under time pressure, what catches the error fastest?`,
        options: [
          'Testing a small concrete sanity case (n=1 or n=2) by hand',
          'Erasing the entire derivation immediately',
          'Guessing a larger exponent without checking units',
          'Leaving boundary verification until after submission',
        ],
        correctIndex: 0,
        explanation: 'Evaluating a tiny concrete test case reveals off-by-one and sign errors quickly.',
      });
    } else {
      questions.push({
        prompt: `[${levelTag} #${i + 1}] Before finalizing an answer on "${t}", what should your final 30-second check confirm?`,
        options: [
          'Every step satisfies stated assumptions and matches the asked unit or form',
          'Only the final number is underlined regardless of intermediate logic',
          'All alternative methods were skipped to save space',
          'Assumptions were modified to fit a memorized template',
        ],
        correctIndex: 0,
        explanation: `Confirming assumptions and final units/form locks in full credit on ${t} questions.`,
      });
    }
  }

  return { questions };
}

// ── 3. Local Store (Starts Empty With Zero Subjects) ────────────────────────
function loadStore() {
  localStorage.removeItem('taau_ai_static_v1');
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.subjects)) return parsed;
    }
  } catch { /* fall through to empty store */ }
  const empty = { subjects: [], tasks: [], summaries: [], quizzes: [] };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(empty));
  return empty;
}

function saveStore() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

const store = loadStore();
const PAGE = document.body.dataset.page || 'index';

const state = {
  subId: new URLSearchParams(window.location.search).get('subject') || localStorage.getItem(ACTIVE_SUB_KEY) || store.subjects[0]?.id || null,
  filter: 'all',
  sumId: null,
  quizId: null,
  draft: [],
};

const curSub = () => store.subjects.find((s) => s.id === state.subId) || store.subjects[0] || null;
const subTasks = (id) => store.tasks.filter((t) => t.subjectId === id).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.orderIndex - b.orderIndex);
const subSummaries = (id) => store.summaries.filter((s) => s.subjectId === id);
const subQuizzes = (id) => store.quizzes.filter((q) => q.subjectId === id);

function pageUrl(file, params = {}) {
  const qs = new URLSearchParams();
  if (state.subId) qs.set('subject', state.subId);
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, String(v)); });
  const str = qs.toString();
  return str ? `${file}?${str}` : file;
}

function syncLinksWithSubject() {
  if (state.subId) localStorage.setItem(ACTIVE_SUB_KEY, state.subId);
  else localStorage.removeItem(ACTIVE_SUB_KEY);
  const map = { index: 'index.html', plan: 'plan.html', summaries: 'summaries.html', quizzes: 'quizzes.html' };
  document.querySelectorAll('.nav-tab[data-nav]').forEach((a) => {
    const file = map[a.dataset.nav];
    if (file) a.href = pageUrl(file);
  });
  const jump = $('jump-full-schedule-btn');
  if (jump) jump.href = pageUrl('plan.html');
}

// ── 4. Local Mutations ──────────────────────────────────────────────────────
function createSubject(title, examDate, hours, parsed) {
  const id = uidId('sub');
  const tasks = (parsed.tasks || []).slice(0, 30).map((t, i) => ({
    id: uidId('tsk'),
    subjectId: id,
    topicTitle: txt(t.topicTitle, 160, 'Revision'),
    description: txt(t.description, 400, 'Review and solve problems.'),
    scheduledDate: txt(t.scheduledDate, 40, examDate),
    durationMinutes: clamp(t.durationMinutes, 10, 480),
    priority: ['high', 'medium', 'normal'].includes(t.priority) ? t.priority : 'medium',
    status: 'pending',
    orderIndex: i,
  }));

  store.subjects.push({
    id,
    title: txt(title, 120, 'Subject'),
    examDate: txt(examDate, 40),
    dailyHours: clamp(hours, 0.5, 16, true),
    syllabusOverview: txt(parsed.syllabusOverview, 1500, 'Exam syllabus'),
    topics: (parsed.topics || []).slice(0, 35).map((t) => txt(t, 150, 'Topic')),
    totalTasks: tasks.length,
    completedTasks: 0,
    averageQuizScore: -1,
  });
  store.tasks.push(...tasks);
  saveStore();
  return id;
}

function toggleTask(taskId) {
  const task = store.tasks.find((t) => t.id === taskId);
  if (!task) return;
  task.status = task.status === 'completed' ? 'pending' : 'completed';
  const tasks = subTasks(task.subjectId);
  const sub = store.subjects.find((s) => s.id === task.subjectId);
  if (sub) {
    sub.completedTasks = tasks.filter((t) => t.status === 'completed').length;
    sub.totalTasks = tasks.length;
  }
  saveStore();
  renderWorkspace();
}

function addTask(subId, p) {
  const tasks = subTasks(subId);
  store.tasks.push({
    id: uidId('tsk'),
    subjectId: subId,
    topicTitle: txt(p.topic, 160, 'Milestone'),
    description: txt(p.desc, 400, 'Focused practice'),
    scheduledDate: txt(p.date, 40),
    durationMinutes: clamp(p.mins, 10, 480),
    priority: ['high', 'medium', 'normal'].includes(p.pri) ? p.pri : 'medium',
    status: 'pending',
    orderIndex: tasks.length,
  });
  const sub = store.subjects.find((s) => s.id === subId);
  if (sub) sub.totalTasks = tasks.length + 1;
  saveStore();
  renderWorkspace();
}

function saveSummary(subId, topic, d) {
  const id = uidId('sum');
  store.summaries.unshift({
    id,
    subjectId: subId,
    topicTitle: txt(topic, 160, 'Summary'),
    overview: txt(d.overview, 2000, 'Summary generated.'),
    coreConcepts: (d.coreConcepts || []).slice(0, 15).map((c) => txt(c, 500, 'Point')),
    formulaSheet: (d.formulaSheet || []).slice(0, 15).map((f) => ({
      label: txt(f.label, 160, 'Rule'),
      expression: txt(f.expression, 300, '—'),
      note: txt(f.note, 400, ''),
    })),
    examPitfalls: (d.examPitfalls || []).slice(0, 12).map((p) => txt(p, 400, 'Check edge cases')),
    memoryAnchor: txt(d.memoryAnchor, 600, ''),
  });
  saveStore();
  return id;
}

function saveQuiz(subId, topic, difficulty, qs) {
  const id = uidId('quz');
  const clean = qs.slice(0, 15).map((q) => {
    const opts = (q.options || []).slice(0, 4).map((o) => txt(o, 300, 'Option'));
    while (opts.length < 4) opts.push('None of the above');
    return {
      prompt: txt(q.prompt, 600, 'Question'),
      options: opts,
      correctIndex: clamp(q.correctIndex, 0, 3),
      explanation: txt(q.explanation, 800, 'Review notes.'),
    };
  });
  store.quizzes.unshift({
    id,
    subjectId: subId,
    topicTitle: txt(topic, 160, 'Quiz'),
    difficulty,
    questions: clean,
    userAnswers: clean.map(() => -1),
    scorePercent: -1,
    status: 'in_progress',
  });
  saveStore();
  return id;
}

function gradeQuiz(quizId, ans) {
  const quiz = store.quizzes.find((q) => q.id === quizId);
  if (!quiz || quiz.status === 'completed') return;
  const score = Math.round((quiz.questions.filter((q, i) => ans[i] === q.correctIndex).length / Math.max(quiz.questions.length, 1)) * 100);
  quiz.userAnswers = ans.slice(0, 15).map((a) => clamp(a, -1, 3));
  quiz.scorePercent = clamp(score, 0, 100);
  quiz.status = 'completed';

  const completed = subQuizzes(quiz.subjectId).filter((q) => q.status === 'completed' && q.scorePercent >= 0);
  const sub = store.subjects.find((s) => s.id === quiz.subjectId);
  if (sub && completed.length) {
    sub.averageQuizScore = clamp(completed.reduce((a, q) => a + q.scorePercent, 0) / completed.length, 0, 100, true);
  }
  saveStore();
  renderWorkspace();
}

function removeSubject(subId) {
  store.subjects = store.subjects.filter((s) => s.id !== subId);
  store.tasks = store.tasks.filter((t) => t.subjectId !== subId);
  store.summaries = store.summaries.filter((s) => s.subjectId !== subId);
  store.quizzes = store.quizzes.filter((q) => q.subjectId !== subId);
  if (state.subId === subId) state.subId = store.subjects[0]?.id || null;
  state.sumId = null;
  state.quizId = null;
  saveStore();
  renderWorkspace();
}

// ── 5. Renderers & Deep-Link Handling ───────────────────────────────────────
function renderWorkspace() {
  const sortedSubs = [...store.subjects].sort((a, b) => a.examDate.localeCompare(b.examDate));
  const sub = curSub();
  state.subId = sub?.id || null;

  if ($('subject-count')) $('subject-count').textContent = String(sortedSubs.length);
  if ($('subject-list')) {
    $('subject-list').innerHTML = sortedSubs.map((s) => {
      const pct = s.totalTasks ? Math.round((s.completedTasks / s.totalTasks) * 100) : 0;
      return `<button type="button" class="subject-item ${sub?.id === s.id ? 'is-selected' : ''}" data-select-subject="${esc(s.id)}">
        <div class="row between"><span class="small-strong truncate">${esc(s.title)}</span><span class="mono ${daysLeft(s.examDate) <= 3 ? 'amber' : 'lime'}">${daysLeft(s.examDate)}d</span></div>
        <div class="track"><div class="fill" style="width:${pct}%"></div></div>
        <div class="row between meta mono"><span>${s.completedTasks}/${s.totalTasks}</span><span>${s.averageQuizScore >= 0 ? `${Math.round(s.averageQuizScore)}%` : 'no quiz'}</span></div>
      </button>`;
    }).join('') || `<p class="meta">No subjects yet.</p>`;
  }

  syncLinksWithSubject();

  if ($('empty-subjects-state')) $('empty-subjects-state').hidden = Boolean(sub);
  if ($('subject-workspace')) $('subject-workspace').hidden = !sub;
  if (!sub) return;

  const tasks = subTasks(sub.id);
  const summaries = subSummaries(sub.id);
  const quizzes = subQuizzes(sub.id);
  const done = tasks.filter((t) => t.status === 'completed').length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const graded = quizzes.filter((q) => q.status === 'completed' && q.scorePercent >= 0);

  $('subject-title-heading').textContent = sub.title;
  $('subject-meta-line').textContent = `Exam ${shortDate(sub.examDate)} · ${sub.dailyHours}h/day · ${sub.topics.length} topics`;
  $('readiness-percent').textContent = `${pct}%`;
  $('readiness-bar-fill').style.width = `${pct}%`;
  $('kpi-days').textContent = `${daysLeft(sub.examDate)}d`;
  $('kpi-milestones').textContent = `${done}/${tasks.length}`;
  $('kpi-quiz-avg').textContent = graded.length ? `${Math.round(graded.reduce((a, q) => a + q.scorePercent, 0) / graded.length)}%` : '—';

  if (PAGE === 'index') {
    $('overview-syllabus-text').textContent = sub.syllabusOverview || 'No overview.';
    $('overview-sheets-count').textContent = `${summaries.length} sheets`;
    $('overview-topics-list').innerHTML = sub.topics.map((t, i) => `
      <div class="list-row">
        <span class="truncate small-strong"><span class="mono muted">${String(i + 1).padStart(2, '0')}</span> ${esc(t)}</span>
        <div class="row">
          <a href="${esc(pageUrl('summaries.html', { topic: t, autogen: '1' }))}" class="link-btn">Sheet</a>
          <span class="meta">·</span>
          <a href="${esc(pageUrl('quizzes.html', { topic: t, autogen: '1' }))}" class="link-btn amber">Quiz</a>
        </div>
      </div>`).join('') || `<p class="muted card-pad">No topics.</p>`;

    $('overview-next-tasks').innerHTML = tasks.filter((t) => t.status === 'pending').slice(0, 5).map((t) => `
      <div class="list-row">
        <div class="row">
          <button type="button" class="check-btn" data-toggle-task="${esc(t.id)}" aria-label="Mark milestone complete"></button>
          <div><p class="small-strong">${esc(t.topicTitle)}</p><p class="meta">${shortDate(t.scheduledDate)} · ${t.durationMinutes}m</p></div>
        </div>
      </div>`).join('') || `<p class="muted card-pad">All milestones done.</p>`;
  } else if (PAGE === 'plan') {
    document.querySelectorAll('#plan-filter-group .seg').forEach((b) => b.classList.toggle('is-active', b.dataset.filter === state.filter));
    const rows = tasks.filter((t) => state.filter === 'all' || t.status === state.filter);
    $('plan-tasks-list').innerHTML = rows.map((t) => {
      const d = t.status === 'completed';
      return `<div class="list-row">
        <div class="row" style="align-items:flex-start">
          <button type="button" class="check-btn ${d ? 'is-done' : ''}" data-toggle-task="${esc(t.id)}" aria-label="Toggle milestone">${d ? '&#10003;' : ''}</button>
          <div>
            <p class="small-strong ${d ? 'is-done-text' : ''}">${esc(t.topicTitle)}</p>
            <p class="muted">${esc(t.description)}</p>
          </div>
        </div>
        <span class="meta mono">${esc(t.priority)} · ${shortDate(t.scheduledDate)} · ${t.durationMinutes}m</span>
      </div>`;
    }).join('') || `<p class="muted card-pad">No milestones match.</p>`;
  } else if (PAGE === 'summaries') {
    fillSelect('summary-topic-select', sub, false);
    $('summary-custom-topic').hidden = $('summary-topic-select').value !== '__custom__';
    if (!summaries.some((s) => s.id === state.sumId)) state.sumId = summaries[0]?.id || null;
    const cur = summaries.find((s) => s.id === state.sumId) || summaries[0];
    $('summaries-container').innerHTML = !cur
      ? `<div class="card"><p class="muted">Pick a topic above and click Make Study Sheet.</p></div>`
      : `<div class="split">
        <div class="card flush">${summaries.map((s) => `<button type="button" class="history-item ${s.id === cur.id ? 'is-selected' : ''}" data-sel-sum="${esc(s.id)}"><span class="small-strong">${esc(s.topicTitle)}</span><span class="meta">${s.formulaSheet.length} formulas</span></button>`).join('')}</div>
        <article class="card">
          <h3 class="h2">${esc(cur.topicTitle)}</h3>
          <p class="body-copy">${esc(cur.overview)}</p>
          <div class="stack-sm"><span class="small-strong">Core Concepts</span>${cur.coreConcepts.map((c, i) => `<p class="muted"><span class="mono lime">${i + 1}.</span> ${esc(c)}</p>`).join('')}</div>
          ${cur.formulaSheet.length ? `<div class="grid-2">${cur.formulaSheet.map((f) => `<div class="formula-card"><span class="small-strong">${esc(f.label)}</span><div class="formula-expr">${esc(f.expression)}</div><span class="meta">${esc(f.note)}</span></div>`).join('')}</div>` : ''}
          <div class="grid-2 divider-top">
            <div class="stack-sm"><span class="small-strong amber">Exam Pitfalls</span>${cur.examPitfalls.map((p) => `<p class="muted">- ${esc(p)}</p>`).join('')}</div>
            <div class="formula-card"><span class="small-strong lime">Memory Hook</span><p class="muted">${esc(cur.memoryAnchor || 'Review derivations.')}</p></div>
          </div>
        </article>
      </div>`;
  } else if (PAGE === 'quizzes') {
    fillSelect('quiz-topic-select', sub, true);
    const weak = quizzes.filter((q) => q.status === 'completed' && q.questions.some((qs, i) => q.userAnswers[i] !== qs.correctIndex)).map((q) => q.topicTitle);
    $('drill-weak-btn').hidden = !weak.length;
    const cur = quizzes.find((q) => q.id === state.quizId) || quizzes[0] || null;
    if (!cur) {
      state.quizId = null;
      state.draft = [];
      $('quizzes-container').innerHTML = `<div class="card"><p class="muted">Pick a topic and click Start Quiz.</p></div>`;
      return;
    }
    if (cur.id !== state.quizId) { state.quizId = cur.id; state.draft = cur.userAnswers.slice(); }
    const done = cur.status === 'completed';
    const ready = cur.questions.every((_, i) => state.draft[i] >= 0);
    $('quizzes-container').innerHTML = `<div class="split">
      <div class="card flush">${quizzes.map((q) => `<button type="button" class="history-item ${q.id === cur.id ? 'is-selected' : ''}" data-sel-quiz="${esc(q.id)}"><span class="small-strong">${esc(q.topicTitle)}</span><span class="meta">${q.status === 'completed' ? `${q.scorePercent}%` : 'In progress'} · ${q.questions.length} Qs</span></button>`).join('')}</div>
      <div class="card">
        <div class="row between"><div><h3 class="h2">${esc(cur.topicTitle)}</h3><p class="meta">${esc(cur.difficulty)} · ${cur.questions.length} Qs</p></div>${done ? `<span class="kpi ${cur.scorePercent >= 70 ? 'lime' : 'amber'}">${cur.scorePercent}%</span>` : ''}</div>
        ${cur.questions.map((q, qi) => {
          const p = done ? cur.userAnswers[qi] : state.draft[qi];
          return `<div class="stack-sm divider-top">
            <p class="small-strong"><span class="mono">Q${qi + 1}.</span> ${esc(q.prompt)}</p>
            ${q.options.map((o, oi) => `<button type="button" class="quiz-opt ${done ? (oi === q.correctIndex ? 'is-correct' : oi === p ? 'is-wrong' : '') : (p === oi ? 'is-selected' : '')}" ${done ? 'disabled' : `data-qq="${qi}" data-qo="${oi}"`}><span class="mono">${String.fromCharCode(65 + oi)}.</span><span>${esc(o)}</span></button>`).join('')}
            ${done ? `<p class="meta">${esc(q.explanation)}</p>` : ''}
          </div>`;
        }).join('')}
        ${done ? '' : `<div class="row end"><button type="button" id="submit-quiz-btn" class="btn primary" ${ready ? '' : 'disabled'}>Grade Quiz</button></div>`}
      </div>
    </div>`;
  }
}

function fillSelect(id, sub, all) {
  const el = $(id);
  if (!el) return;
  const prev = el.value;
  el.innerHTML = (all ? ['<option value="Comprehensive Mock">All Topics (Mock)</option>'] : [])
    .concat(sub.topics.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`))
    .concat(all ? [] : ['<option value="__custom__">Custom Topic...</option>']).join('');
  if (prev && [...el.options].some((o) => o.value === prev)) el.value = prev;
}

// ── 6. Actions, Events & Boot ───────────────────────────────────────────────
function openModal(show) {
  const modal = $('add-subject-modal');
  if (!modal) return;
  modal.hidden = !show;
  if (show) {
    banner('modal-error', '');
    $('new-subject-title').focus();
  } else {
    $('add-subject-form').reset();
  }
}

function runSummary(topic) {
  const sub = curSub();
  if (!sub || !topic) return;
  banner('summary-error', '');
  const generated = generateSummaryLocally({ subjectTitle: sub.title, topicTitle: topic });
  state.sumId = saveSummary(sub.id, topic, generated);
  renderWorkspace();
}

function runQuiz(topic, weak = []) {
  const sub = curSub();
  if (!sub || !topic) return;
  const difficulty = $('quiz-difficulty-select')?.value || 'standard';
  const questionCount = Number($('quiz-count-select')?.value || 5);
  banner('quiz-error', '');
  const res = generateQuizLocally({
    subjectTitle: sub.title,
    topicTitle: topic,
    difficulty,
    questionCount,
    topics: sub.topics,
    focusWeaknesses: weak,
  });
  state.quizId = saveQuiz(sub.id, topic, difficulty, res.questions);
  state.draft = res.questions.map(() => -1);
  renderWorkspace();
}

function handleQueryAutoAction() {
  const sub = curSub();
  if (!sub) return;
  const qs = new URLSearchParams(window.location.search);
  const topic = qs.get('topic');
  const autogen = qs.get('autogen');
  if (!topic) return;

  if (PAGE === 'summaries' && $('summary-topic-select')) {
    const sel = $('summary-topic-select');
    if ([...sel.options].some((o) => o.value === topic)) sel.value = topic;
    else { sel.value = '__custom__'; $('summary-custom-topic').hidden = false; $('summary-custom-topic').value = topic; }
    if (autogen === '1') {
      qs.delete('autogen');
      history.replaceState(null, '', `${window.location.pathname}?${qs.toString()}`);
      runSummary(topic);
    }
  } else if (PAGE === 'quizzes' && $('quiz-topic-select')) {
    const sel = $('quiz-topic-select');
    if ([...sel.options].some((o) => o.value === topic)) sel.value = topic;
    if (autogen === '1') {
      qs.delete('autogen');
      history.replaceState(null, '', `${window.location.pathname}?${qs.toString()}`);
      runQuiz(topic);
    }
  }
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;

  if (t.id === 'primary-action-btn' || t.id === 'sidebar-add-btn' || t.id === 'empty-add-subject-btn') return openModal(true);
  if (t.id === 'close-modal-btn' || t.id === 'cancel-modal-btn') return openModal(false);

  if (t.dataset.selectSubject) {
    state.subId = t.dataset.selectSubject;
    state.sumId = null;
    state.quizId = null;
    return renderWorkspace();
  }

  if (t.id === 'ask-delete-subject-btn') { $('delete-prompt-default').hidden = true; $('delete-prompt-confirm').hidden = false; }
  if (t.id === 'cancel-delete-subject-btn') { $('delete-prompt-default').hidden = false; $('delete-prompt-confirm').hidden = true; }
  if (t.id === 'confirm-delete-subject-btn' && curSub()) {
    removeSubject(curSub().id);
    $('delete-prompt-default').hidden = false;
    $('delete-prompt-confirm').hidden = true;
    return;
  }

  if (t.dataset.filter) { state.filter = t.dataset.filter; return renderWorkspace(); }
  if (t.id === 'toggle-add-task-btn' || t.id === 'cancel-add-task-btn') {
    const f = $('add-milestone-form');
    f.hidden = !f.hidden;
    if (!f.hidden) $('milestone-topic').focus();
  }
  if (t.dataset.toggleTask) return toggleTask(t.dataset.toggleTask);

  if (t.id === 'generate-summary-btn') {
    const v = $('summary-topic-select').value;
    return runSummary(v === '__custom__' ? $('summary-custom-topic').value.trim() : v);
  }
  if (t.dataset.selSum) { state.sumId = t.dataset.selSum; return renderWorkspace(); }

  if (t.id === 'start-quiz-btn') return runQuiz($('quiz-topic-select').value);
  if (t.id === 'drill-weak-btn') {
    const sub = curSub();
    if (!sub) return;
    const missed = [...new Set(subQuizzes(sub.id).filter((q) => q.status === 'completed' && q.questions.some((qs, i) => q.userAnswers[i] !== qs.correctIndex)).map((q) => q.topicTitle))];
    if (missed.length) return runQuiz(`Weak Drill: ${missed[0]}`, missed);
  }
  if (t.dataset.selQuiz) {
    const q = store.quizzes.find((x) => x.id === t.dataset.selQuiz);
    if (q) { state.quizId = q.id; state.draft = q.userAnswers.slice(); return renderWorkspace(); }
  }
  if (t.dataset.qq !== undefined) { state.draft[Number(t.dataset.qq)] = Number(t.dataset.qo); return renderWorkspace(); }
  if (t.id === 'submit-quiz-btn' && state.quizId) return gradeQuiz(state.quizId, state.draft);
});

$('summary-topic-select')?.addEventListener('change', (e) => {
  $('summary-custom-topic').hidden = e.target.value !== '__custom__';
});

$('add-milestone-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!curSub()) return;
  addTask(curSub().id, {
    topic: $('milestone-topic').value,
    date: $('milestone-date').value,
    mins: $('milestone-duration').value,
    pri: $('milestone-priority').value,
    desc: $('milestone-desc').value,
  });
  e.target.reset();
  e.target.hidden = true;
});

$('add-subject-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = $('new-subject-title').value.trim();
  const examDate = $('new-subject-date').value;
  const hours = Number($('new-subject-hours').value);
  const syllabusText = $('new-subject-syllabus').value.trim();
  if (!title || !examDate || Number.isNaN(hours) || hours <= 0 || !syllabusText) {
    return banner('modal-error', 'Please fill in subject name, exam date, study hours, and syllabus units.');
  }
  banner('modal-error', '');
  const parsed = parseSyllabusLocally({
    subjectTitle: title,
    examDate,
    dailyHours: hours,
    currentDate: plusDays(0),
    syllabusText,
  });
  state.subId = createSubject(title, examDate, hours, parsed);
  state.sumId = null;
  state.quizId = null;
  openModal(false);
  renderWorkspace();
});

renderWorkspace();
handleQueryAutoAction();
