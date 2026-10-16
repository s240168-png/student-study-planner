(() => {
'use strict';
const KEY = 'studyPlannerData.v1';
const PRI = ['Low', 'Medium', 'High'], STAT = ['Pending', 'Completed'];

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const today = () => ymd(new Date());
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const offset = n => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const validDate = s => { if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d = parse(s); return ymd(d) === s && d.getFullYear() >= 2000 && d.getFullYear() <= 2100; };
const daysFrom = s => Math.round((parse(s) - parse(today())) / 864e5);
const fmtDur = m => { m = Math.round(m); const h = Math.floor(m / 60), r = m % 60; return h ? (r ? h + 'h ' + r + 'm' : h + 'h') : r + 'm'; };
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const byId = (arr, id) => arr.find(x => x.id === id);

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [a, v] of Object.entries(attrs)) {
    if (a === 'class') e.className = v;
    else if (a === 'text') e.textContent = v;
    else if (a.startsWith('on')) e.addEventListener(a.slice(2), v);
    else e.setAttribute(a, v);
  }
  kids.flat().forEach(k => { if (k != null) e.append(k); });
  return e;
}
const btn = (text, fn, cls, label) => el('button', { type: 'button', class: cls || '', onclick: fn, text, ...(label ? { 'aria-label': label } : {}) });
const badge = (text, cls) => el('span', { class: 'badge ' + (cls || ''), text });
const empty = text => el('div', { class: 'empty', text });
const clear = n => { n.replaceChildren(); return n; };

/* ---------- storage ---------- */
const blank = () => ({ subjects: [], topics: [], sessions: [], exams: [], sampleLoaded: false });
function load() {
  const out = blank();
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (!d || typeof d !== 'object') return out;
    const arr = k => Array.isArray(d[k]) ? d[k].filter(x => x && typeof x === 'object' && typeof x.id === 'string') : [];
    out.subjects = arr('subjects').filter(s => typeof s.name === 'string' && s.name);
    out.topics = arr('topics').filter(t => typeof t.name === 'string' && byId(out.subjects, t.subjectId)).map(t => ({ ...t, completed: !!t.completed }));
    out.sessions = arr('sessions').filter(s => typeof s.title === 'string' && byId(out.subjects, s.subjectId) && validDate(s.date) && Number(s.duration) > 0)
      .map(s => ({ ...s, duration: Number(s.duration), priority: PRI.includes(s.priority) ? s.priority : 'Medium', status: STAT.includes(s.status) ? s.status : 'Pending', topicId: byId(out.topics, s.topicId) ? s.topicId : '', notes: typeof s.notes === 'string' ? s.notes : '' }));
    out.exams = arr('exams').filter(x => typeof x.name === 'string' && byId(out.subjects, x.subjectId) && validDate(x.date));
    out.sampleLoaded = !!d.sampleLoaded;
  } catch (e) { /* malformed data: start empty */ }
  return out;
}
let S = load();
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); return true; }
  catch (e) { toast('Could not save: browser storage is unavailable.', 'error'); return false; }
}
function commit(msg) { persist(); renderAll(); if (msg) toast(msg, 'success'); }

/* ---------- UI utilities ---------- */
let toastTimer;
function toast(msg, type) {
  const t = $('#toast'); t.textContent = msg; t.className = type || 'success';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = ''; t.textContent = ''; }, 3500);
}
function fail(sel, errs) { $(sel).textContent = errs.join(' '); toast(errs[0], 'error'); }
function confirmBox(msg) {
  return new Promise(res => {
    const d = $('#confirmDlg'); $('#confirmMsg').textContent = msg; d.returnValue = '';
    d.addEventListener('close', () => res(d.returnValue === 'ok'), { once: true });
    d.showModal();
  });
}
function show(view) {
  document.querySelectorAll('.view').forEach(v => v.hidden = v.id !== 'view-' + view);
  document.querySelectorAll('nav [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $('#nav').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded', 'false');
  window.scrollTo(0, 0);
}
function bar(label, pct, cls, right) {
  const f = el('div', { class: 'fill ' + (cls || '') }); f.style.width = Math.max(0, Math.min(100, pct)) + '%';
  return el('div', { class: 'barwrap' }, el('div', { class: 'barlbl' }, el('span', { text: label }), el('span', { text: right || Math.round(pct) + '%' })), el('div', { class: 'bar', role: 'img', 'aria-label': label + ' ' + Math.round(pct) + '%' }, f));
}
const subjName = id => (byId(S.subjects, id) || {}).name || 'Unknown subject';
const topicName = id => id ? ((byId(S.topics, id) || {}).name || 'Unknown topic') : 'No specific topic';
const isOver = s => s.status === 'Pending' && s.date < today();
const sortDate = (a, b, dir = 'asc') => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) * (dir === 'asc' ? 1 : -1);
function fillSelect(sel, items, first, keep = true) {
  const old = sel.value; clear(sel);
  if (first != null) sel.append(el('option', { value: '', text: first }));
  items.forEach(i => sel.append(el('option', { value: i.id, text: i.name })));
  if (keep && [...sel.options].some(o => o.value === old)) sel.value = old;
}

/* ---------- renderers ---------- */
function sessionCard(s, full) {
  const over = isOver(s);
  const head = el('div', { class: 'row' }, el('strong', { text: s.title }), badge(s.priority, 'p-' + s.priority.toLowerCase()), badge(s.status, s.status === 'Completed' ? 'ok' : 'warn'));
  if (over) head.append(badge('Overdue', 'bad'));
  if (s.sample) head.append(badge('Sample', 'sample'));
  const c = el('div', { class: 'item' + (over ? ' overdue' : '') + (s.status === 'Completed' ? ' done' : '') }, head,
    el('div', { class: 'meta', text: subjName(s.subjectId) + ' • ' + topicName(s.topicId) + ' • ' + s.date + ' • ' + fmtDur(s.duration) }));
  if (full) {
    if (s.notes) c.append(el('p', { class: 'notes', text: s.notes }));
    c.append(el('div', { class: 'actions' },
      btn(s.status === 'Completed' ? 'Mark Pending' : 'Mark Completed', () => { s.status = s.status === 'Completed' ? 'Pending' : 'Completed'; commit('Session marked ' + s.status.toLowerCase() + '.'); }),
      btn('Edit', () => editSession(s.id), '', 'Edit session ' + s.title),
      btn('Delete', async () => { if (await confirmBox('Delete session "' + s.title + '"?')) { S.sessions = S.sessions.filter(x => x.id !== s.id); commit('Session deleted.'); } }, 'danger', 'Delete session ' + s.title)));
  }
  return c;
}
function examCard(x, actions) {
  const d = daysFrom(x.date), soon = d >= 0 && d <= 7;
  const txt = d < 0 ? 'Exam passed' : d === 0 ? 'Today!' : d === 1 ? 'Tomorrow' : d + ' days remaining';
  const head = el('div', { class: 'row' }, el('strong', { text: x.name }), badge(txt, d < 0 ? '' : soon ? 'bad' : 'ok'));
  if (x.sample) head.append(badge('Sample', 'sample'));
  const c = el('div', { class: 'item' + (soon ? ' soon' : '') }, head, el('div', { class: 'meta', text: subjName(x.subjectId) + ' • ' + x.date }));
  if (actions) c.append(el('div', { class: 'actions' }, btn('Edit', () => editExam(x.id), '', 'Edit exam ' + x.name),
    btn('Delete', async () => { if (await confirmBox('Delete exam "' + x.name + '"?')) { S.exams = S.exams.filter(e => e.id !== x.id); commit('Exam deleted.'); } }, 'danger', 'Delete exam ' + x.name)));
  return c;
}
const stats = () => {
  const total = S.sessions.length, done = S.sessions.filter(s => s.status === 'Completed').length;
  const planned = S.sessions.reduce((a, s) => a + s.duration, 0);
  const doneMin = S.sessions.filter(s => s.status === 'Completed').reduce((a, s) => a + s.duration, 0);
  return { total, done, pending: total - done, overdue: S.sessions.filter(isOver).length, pct: total ? Math.round(done / total * 100) : 0, planned, doneMin };
};
function renderDashboard() {
  const st = stats();
  $('#emptyBanner').hidden = !!(S.subjects.length || S.sessions.length || S.exams.length);
  const cards = [['Total Study Sessions', st.total], ['Completed Sessions', st.done], ['Pending Sessions', st.pending], ['Overdue Sessions', st.overdue, 'bad'], ['Overall Completion', st.pct + '%'], ['Total Planned Study Time', fmtDur(st.planned)]];
  clear($('#cards')).append(...cards.map(([l, n, c]) => el('div', { class: 'card ' + (c || '') }, el('div', { class: 'num', text: String(n) }), el('div', { class: 'lbl', text: l }))));
  const tod = S.sessions.filter(s => s.date === today());
  clear($('#dashToday')).append(...(tod.length ? tod.map(s => sessionCard(s)) : [empty('No sessions planned for today.')]));
  const ex = S.exams.filter(x => daysFrom(x.date) >= 0).sort(sortDate).slice(0, 5);
  clear($('#dashExams')).append(...(ex.length ? ex.map(x => examCard(x)) : [empty('No upcoming examinations.')]));
  const rec = [...S.sessions].sort((a, b) => sortDate(a, b, 'desc')).slice(0, 5);
  clear($('#dashRecent')).append(...(rec.length ? rec.map(s => sessionCard(s)) : [empty('No study sessions yet.')]));
  clear($('#dashSubjects')).append(...(S.subjects.length ? S.subjects.map(s => { const t = S.topics.filter(x => x.subjectId === s.id), d = t.filter(x => x.completed).length; return bar(s.name, t.length ? d / t.length * 100 : 0, '', d + '/' + t.length + ' topics'); }) : [empty('Add subjects to track preparation.')]));
}
function renderSubjects() {
  const list = clear($('#subjectList'));
  if (!S.subjects.length) list.append(empty('No subjects yet. Add your first subject above.'));
  S.subjects.forEach(s => {
    const head = el('div', { class: 'row' }, el('strong', { text: s.name }));
    if (s.sample) head.append(badge('Sample', 'sample'));
    const nt = S.topics.filter(t => t.subjectId === s.id).length, ns = S.sessions.filter(x => x.subjectId === s.id).length;
    list.append(el('div', { class: 'item' }, head, s.description ? el('p', { class: 'notes', text: s.description }) : null,
      el('div', { class: 'meta', text: nt + ' topic(s) • ' + ns + ' study session(s)' }),
      el('div', { class: 'actions' }, btn('Edit', () => editSubject(s.id), '', 'Edit subject ' + s.name),
        btn('Delete', () => deleteSubject(s.id), 'danger', 'Delete subject ' + s.name))));
  });
  const tl = clear($('#topicList'));
  if (!S.topics.length) tl.append(empty('No topics yet. Add a topic under a subject.'));
  S.subjects.forEach(s => {
    const ts = S.topics.filter(t => t.subjectId === s.id); if (!ts.length) return;
    tl.append(el('div', { class: 'panel' }, el('h3', { text: s.name }), ...ts.map(t => el('div', { class: 'item' + (t.completed ? ' done' : '') },
      el('div', { class: 'row' }, el('strong', { text: t.name }), badge(t.completed ? 'Completed' : 'Pending', t.completed ? 'ok' : 'warn'), t.sample ? badge('Sample', 'sample') : null),
      el('div', { class: 'actions' },
        btn(t.completed ? 'Mark Pending' : 'Mark Completed', () => { t.completed = !t.completed; commit('Topic marked ' + (t.completed ? 'completed' : 'pending') + '.'); }),
        btn('Edit', () => editTopic(t.id), '', 'Edit topic ' + t.name),
        btn('Delete', () => deleteTopic(t.id), 'danger', 'Delete topic ' + t.name))))));
  });
}
function renderPlanner() {
  const sub = $('#fSubject').value, st = $('#fStatus').value, pr = $('#fPri').value, dir = $('#fSort').value;
  const rows = S.sessions.filter(s => (!sub || s.subjectId === sub) && (!st || s.status === st) && (!pr || s.priority === pr)).sort((a, b) => sortDate(a, b, dir));
  clear($('#sessionList')).append(...(rows.length ? rows.map(s => sessionCard(s, true)) : [empty(S.sessions.length ? 'No sessions match the selected filters.' : 'No study sessions yet. Use the form above to plan your first session.')]));
}
function renderExams() {
  const rows = [...S.exams].sort(sortDate);
  clear($('#examList')).append(...(rows.length ? rows.map(x => examCard(x, true)) : [empty('No examinations added yet.')]));
}
function renderAnalytics() {
  const st = stats();
  clear($('#anOverall')).append(el('div', { class: 'big', text: st.pct + '%' }), bar('Sessions completed', st.pct, 'navy', st.done + ' of ' + st.total));
  const sp = $('#anSplit'); clear(sp);
  if (!st.total) sp.append(empty('No sessions to chart yet.'));
  else sp.append(bar('Completed', st.done / st.total * 100, 'navy', String(st.done)), bar('Pending (not overdue)', (st.pending - st.overdue) / st.total * 100, 'amber', String(st.pending - st.overdue)), bar('Overdue', st.overdue / st.total * 100, '', String(st.overdue)));
  clear($('#anTopics')).append(...(S.subjects.length ? S.subjects.map(s => { const t = S.topics.filter(x => x.subjectId === s.id), d = t.filter(x => x.completed).length; return bar(s.name, t.length ? d / t.length * 100 : 0, '', d + '/' + t.length + ' topics'); }) : [empty('No subjects yet.')]));
  const tm = clear($('#anTime'));
  if (!st.total) { tm.append(empty('No study time planned yet.')); return; }
  tm.append(bar('Overall completed', st.planned ? st.doneMin / st.planned * 100 : 0, 'navy', fmtDur(st.doneMin) + ' of ' + fmtDur(st.planned) + ' planned'));
  S.subjects.forEach(s => {
    const ss = S.sessions.filter(x => x.subjectId === s.id); if (!ss.length) return;
    const p = ss.reduce((a, x) => a + x.duration, 0), c = ss.filter(x => x.status === 'Completed').reduce((a, x) => a + x.duration, 0);
    tm.append(bar(s.name, p ? c / p * 100 : 0, '', fmtDur(c) + ' / ' + fmtDur(p)));
  });
}
function refreshSelects() {
  fillSelect($('#topSubject'), S.subjects, null);
  fillSelect($('#sSubject'), S.subjects, S.subjects.length ? 'Select subject' : 'Add a subject first');
  fillSelect($('#eSubject'), S.subjects, S.subjects.length ? 'Select subject' : 'Add a subject first');
  fillSelect($('#fSubject'), S.subjects, 'All');
  updateTopicOptions($('#sTopic').value);
}
function renderAll() { refreshSelects(); renderDashboard(); renderSubjects(); renderPlanner(); renderExams(); renderAnalytics(); }

/* ---------- subjects ---------- */
function resetSubjectForm() { $('#subjectForm').reset(); $('#subId').value = ''; $('#subErr').textContent = ''; $('#subSubmit').textContent = 'Add Subject'; $('#subCancel').hidden = true; $('#subjFormTitle').textContent = 'Add Subject'; }
function editSubject(id) { const s = byId(S.subjects, id); if (!s) return; $('#subId').value = id; $('#subName').value = s.name; $('#subDesc').value = s.description || ''; $('#subSubmit').textContent = 'Update Subject'; $('#subCancel').hidden = false; $('#subjFormTitle').textContent = 'Edit Subject'; $('#subName').focus(); }
$('#subjectForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#subName').value.trim(), desc = $('#subDesc').value.trim(), id = $('#subId').value;
  if (!name) return fail('#subErr', ['Subject name is required.']);
  if (S.subjects.some(s => s.id !== id && s.name.toLowerCase() === name.toLowerCase())) return fail('#subErr', ['A subject with this name already exists.']);
  if (id) { const s = byId(S.subjects, id); s.name = name; s.description = desc; }
  else S.subjects.push({ id: uid('sub_'), name, description: desc });
  resetSubjectForm(); commit(id ? 'Subject updated.' : 'Subject added.');
});
$('#subCancel').addEventListener('click', resetSubjectForm);
async function deleteSubject(id) {
  const s = byId(S.subjects, id); if (!s) return;
  const nt = S.topics.filter(t => t.subjectId === id).length, ns = S.sessions.filter(x => x.subjectId === id).length, ne = S.exams.filter(x => x.subjectId === id).length;
  const msg = (nt || ns || ne) ? 'Deleting "' + s.name + '" will also permanently delete its ' + nt + ' topic(s), ' + ns + ' study session(s) and ' + ne + ' exam(s). Continue?' : 'Delete subject "' + s.name + '"?';
  if (!(await confirmBox(msg))) return;
  S.subjects = S.subjects.filter(x => x.id !== id); S.topics = S.topics.filter(x => x.subjectId !== id);
  S.sessions = S.sessions.filter(x => x.subjectId !== id); S.exams = S.exams.filter(x => x.subjectId !== id);
  if ($('#subId').value === id) resetSubjectForm();
  commit('Subject deleted.');
}

/* ---------- topics ---------- */
function resetTopicForm() { $('#topicForm').reset(); $('#topId').value = ''; $('#topErr').textContent = ''; $('#topSubmit').textContent = 'Add Topic'; $('#topCancel').hidden = true; $('#topSubject').disabled = false; $('#topFormTitle').textContent = 'Add Topic'; }
function editTopic(id) { const t = byId(S.topics, id); if (!t) return; $('#topId').value = id; $('#topSubject').value = t.subjectId; $('#topSubject').disabled = true; $('#topName').value = t.name; $('#topSubmit').textContent = 'Update Topic'; $('#topCancel').hidden = false; $('#topFormTitle').textContent = 'Edit Topic (subject cannot be changed)'; $('#topName').focus(); }
$('#topicForm').addEventListener('submit', e => {
  e.preventDefault();
  const id = $('#topId').value, name = $('#topName').value.trim(), sub = $('#topSubject').value;
  if (!sub || !byId(S.subjects, sub)) return fail('#topErr', ['Add and select a subject first.']);
  if (!name) return fail('#topErr', ['Topic name is required.']);
  if (S.topics.some(t => t.id !== id && t.subjectId === sub && t.name.toLowerCase() === name.toLowerCase())) return fail('#topErr', ['This subject already has a topic with that name.']);
  if (id) byId(S.topics, id).name = name; else S.topics.push({ id: uid('top_'), subjectId: sub, name, completed: false });
  resetTopicForm(); commit(id ? 'Topic updated.' : 'Topic added.');
});
$('#topCancel').addEventListener('click', resetTopicForm);
async function deleteTopic(id) {
  const t = byId(S.topics, id); if (!t) return;
  const n = S.sessions.filter(s => s.topicId === id).length;
  if (!(await confirmBox('Delete topic "' + t.name + '"?' + (n ? ' ' + n + ' study session(s) will be kept but shown as having no specific topic.' : '')))) return;
  S.topics = S.topics.filter(x => x.id !== id); S.sessions.forEach(s => { if (s.topicId === id) s.topicId = ''; });
  if ($('#topId').value === id) resetTopicForm();
  commit('Topic deleted.');
}

/* ---------- sessions ---------- */
function updateTopicOptions(selected) {
  const sub = $('#sSubject').value, sel = $('#sTopic'); clear(sel);
  sel.append(el('option', { value: '', text: sub ? 'No specific topic' : 'Select a subject first' }));
  S.topics.filter(t => t.subjectId === sub).forEach(t => sel.append(el('option', { value: t.id, text: t.name })));
  sel.value = [...sel.options].some(o => o.value === selected) ? selected : '';
}
$('#sSubject').addEventListener('change', () => updateTopicOptions(''));
function resetSessionForm() { $('#sessionForm').reset(); $('#sId').value = ''; $('#sErr').textContent = ''; $('#sDate').value = today(); updateTopicOptions(''); $('#sSubmit').textContent = 'Add Session'; $('#sCancel').hidden = true; $('#sFormTitle').textContent = 'Add Study Session'; }
function editSession(id) {
  const s = byId(S.sessions, id); if (!s) return;
  show('planner'); $('#sId').value = id; $('#sTitle').value = s.title; $('#sSubject').value = s.subjectId; updateTopicOptions(s.topicId);
  $('#sDate').value = s.date; $('#sUnit').value = '1'; $('#sDur').value = s.duration; $('#sPri').value = s.priority; $('#sStatus').value = s.status; $('#sNotes').value = s.notes || '';
  $('#sSubmit').textContent = 'Update Session'; $('#sCancel').hidden = false; $('#sFormTitle').textContent = 'Edit Study Session'; $('#sErr').textContent = ''; $('#sTitle').focus();
}
$('#sessionForm').addEventListener('submit', e => {
  e.preventDefault();
  const errs = [], id = $('#sId').value, title = $('#sTitle').value.trim(), sub = $('#sSubject').value, top = $('#sTopic').value, date = $('#sDate').value, raw = $('#sDur').value.trim();
  const dur = Number(raw) * Number($('#sUnit').value);
  if (!title) errs.push('Session title is required.');
  if (!sub || !byId(S.subjects, sub)) errs.push('Please select a subject.');
  if (!validDate(date)) errs.push('Please enter a valid study date.');
  if (raw === '' || !isFinite(dur) || dur <= 0) errs.push('Duration must be a positive number.');
  else if (dur > 1440) errs.push('Duration cannot exceed 24 hours.');
  if (top) { const t = byId(S.topics, top); if (!t || t.subjectId !== sub) errs.push('Topic must belong to the selected subject.'); }
  if (errs.length) return fail('#sErr', errs);
  const rec = { title, subjectId: sub, topicId: top, date, duration: Math.round(dur * 100) / 100, priority: $('#sPri').value, status: $('#sStatus').value, notes: $('#sNotes').value.trim() };
  if (id) Object.assign(byId(S.sessions, id), rec); else S.sessions.push({ id: uid('ses_'), ...rec });
  resetSessionForm(); commit(id ? 'Session updated.' : 'Session added.');
});
$('#sCancel').addEventListener('click', resetSessionForm);
['#fSubject', '#fStatus', '#fPri', '#fSort'].forEach(s => $(s).addEventListener('change', renderPlanner));

/* ---------- exams ---------- */
function resetExamForm() { $('#examForm').reset(); $('#eId').value = ''; $('#eErr').textContent = ''; $('#eSubmit').textContent = 'Add Exam'; $('#eCancel').hidden = true; $('#eFormTitle').textContent = 'Add Examination'; }
function editExam(id) { const x = byId(S.exams, id); if (!x) return; $('#eId').value = id; $('#eName').value = x.name; $('#eSubject').value = x.subjectId; $('#eDate').value = x.date; $('#eSubmit').textContent = 'Update Exam'; $('#eCancel').hidden = false; $('#eFormTitle').textContent = 'Edit Examination'; $('#eName').focus(); }
$('#examForm').addEventListener('submit', e => {
  e.preventDefault();
  const errs = [], id = $('#eId').value, name = $('#eName').value.trim(), sub = $('#eSubject').value, date = $('#eDate').value;
  if (!name) errs.push('Examination name is required.');
  if (!sub || !byId(S.subjects, sub)) errs.push('Please select a subject.');
  if (!validDate(date)) errs.push('Please enter a valid exam date.');
  if (errs.length) return fail('#eErr', errs);
  if (id) Object.assign(byId(S.exams, id), { name, subjectId: sub, date }); else S.exams.push({ id: uid('exm_'), name, subjectId: sub, date });
  resetExamForm(); commit(id ? 'Exam updated.' : 'Exam added.');
});
$('#eCancel').addEventListener('click', resetExamForm);

/* ---------- sample data / reset ---------- */
function loadSample() {
  if (S.sampleLoaded && (S.subjects.some(s => s.sample))) { toast('Sample data is already loaded.', 'error'); return; }
  const sub = (name, description) => { const o = { id: uid('sub_'), name, description, sample: true }; S.subjects.push(o); return o; };
  const top = (s, name, completed) => { const o = { id: uid('top_'), subjectId: s.id, name, completed, sample: true }; S.topics.push(o); return o; };
  const ses = (title, s, t, off, duration, priority, status, notes) => S.sessions.push({ id: uid('ses_'), title, subjectId: s.id, topicId: t.id, date: offset(off), duration, priority, status, notes, sample: true });
  const exm = (name, s, off) => S.exams.push({ id: uid('exm_'), name, subjectId: s.id, date: offset(off), sample: true });
  const se = sub('Software Engineering', 'SDLC models, Agile and Scrum practices, testing.');
  const cn = sub('Computer Networks', 'OSI and TCP/IP models, routing and transport protocols.');
  const ws = sub('Web Application Security', 'OWASP Top 10, injection attacks, secure coding.');
  const da = sub('Data Analytics', 'Data cleaning, SQL queries and visualization.');
  const t1 = top(se, 'Agile methodology', true), t2 = top(se, 'Scrum roles and ceremonies', false), t3 = top(se, 'Software testing levels', false);
  const t4 = top(cn, 'TCP/IP model', true), t5 = top(cn, 'Subnetting', false), t6 = top(cn, 'Routing protocols', false);
  const t7 = top(ws, 'SQL injection prevention', true), t8 = top(ws, 'Cross-site scripting (XSS)', false), t9 = top(ws, 'Authentication and sessions', false);
  const t10 = top(da, 'Data visualization', false), t11 = top(da, 'SQL aggregation', true);
  ses('Revise Agile manifesto', se, t1, -2, 45, 'Medium', 'Completed', 'Four values and twelve principles.');
  ses('Sprint planning practice', se, t2, -3, 60, 'High', 'Pending', 'Overdue: redo with a sample backlog.');
  ses('TCP three-way handshake notes', cn, t4, -1, 90, 'High', 'Completed', '');
  ses('Subnetting problems set', cn, t5, 0, 60, 'High', 'Pending', 'Solve 15 CIDR questions.');
  ses('Prepared statements lab', ws, t7, 0, 75, 'Medium', 'Completed', 'Parameterized queries in practice.');
  ses('XSS payloads and output encoding', ws, t8, 2, 120, 'High', 'Pending', '');
  ses('Build charts from sample dataset', da, t10, 3, 90, 'Low', 'Pending', '');
  ses('Unit vs integration testing', se, t3, 5, 50, 'Medium', 'Pending', '');
  ses('GROUP BY and HAVING drills', da, t11, -4, 40, 'Low', 'Completed', '');
  ses('OSPF vs BGP comparison', cn, t6, 6, 80, 'Medium', 'Pending', '');
  exm('Computer Networks Mid-Semester Exam', cn, 3); exm('Software Engineering and Agile Practices Exam', se, 10);
  exm('Web Application Security Internal Test', ws, 21); exm('Data Analytics End-Semester Exam', da, 35);
  S.sampleLoaded = true; commit('Sample data added. Your existing records were kept.');
}
$('#loadSample').addEventListener('click', loadSample);
$('#resetData').addEventListener('click', async () => {
  if (!(await confirmBox('Reset Demo Data will permanently delete ALL subjects, topics, study sessions and exams (sample and your own). This cannot be undone. Continue?'))) return;
  S = blank(); [resetSubjectForm, resetTopicForm, resetSessionForm, resetExamForm].forEach(f => f()); commit('All data has been reset.');
});

/* ---------- navigation / init ---------- */
document.querySelectorAll('nav [data-view]').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));
$('#menuBtn').addEventListener('click', () => { const o = $('#nav').classList.toggle('open'); $('#menuBtn').setAttribute('aria-expanded', String(o)); });
$('#sDate').value = today();
renderAll();
})();
