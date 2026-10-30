(() => {
  const KEY = 'lateAbsentLog.records.v1';
  const TITLE_KEY = 'lateAbsentLog.title.v1';
  const $ = (id) => document.getElementById(id);

  let records = read(KEY, []);

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
  }
  const toISO = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parse = (iso) => new Date(iso + 'T00:00:00');
  const longDate = (iso) => parse(iso).toLocaleDateString(undefined,
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const halfLabel = (r) => `Half-day${r.session ? ' (' + r.session + ')' : ''}`;
  const reasonText = (r) => (r.half ? `[${halfLabel(r)}] ` : '') + r.reason;
  const fmtTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  };

  let day = toISO(new Date());

  // Title
  $('logTitle').value = read(TITLE_KEY, 'Late & Absent Log');
  $('logTitle').addEventListener('input', (e) => write(TITLE_KEY, e.target.value));

  // Day navigation
  function setDay(iso) {
    if (!iso) return;
    day = iso;
    $('reportDate').value = day;
    render();
  }
  const shift = (n) => { const d = parse(day); d.setDate(d.getDate() + n); setDay(toISO(d)); };
  $('reportDate').addEventListener('change', (e) => setDay(e.target.value));
  $('prevDay').addEventListener('click', () => shift(-1));
  $('nextDay').addEventListener('click', () => shift(1));
  $('todayBtn').addEventListener('click', () => setDay(toISO(new Date())));

  // Time arrived: type it, or press the clock icon and scroll the wheels
  const ITEM = 36;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad = (n) => String(n).padStart(2, '0');
  const tt = $('fTimeText'), pop = $('timePop'), clockBtn = $('clockBtn');
  const wheels = [
    { el: $('wHour'), items: Array.from({ length: 12 }, (_, i) => String(i + 1)) },
    { el: $('wMin'), items: Array.from({ length: 60 }, (_, i) => pad(i)) },
    { el: $('wAp'), items: ['AM', 'PM'] }
  ];
  const apBtn = $('apBtn');
  let ap = 'AM', apManual = false;   // apManual: the person chose AM/PM themselves
  let userMoved = false;   // true only when the person touched the wheels
  const idx = (w) => Math.max(0, Math.min(w.items.length - 1, Math.round(w.el.scrollTop / ITEM)));

  function paint(w) {
    const pos = w.el.scrollTop / ITEM;
    w.opts.forEach((o, i) => {
      const d = Math.min(Math.abs(i - pos), 3);
      o.style.transform = `scale(${1 - 0.11 * d})`;
      o.style.opacity = String(1 - 0.3 * d);
    });
  }
  function go(w, i, smooth) {
    i = Math.max(0, Math.min(w.items.length - 1, i));
    w.el.scrollTo({ top: i * ITEM, behavior: smooth && !reduce ? 'smooth' : 'auto' });
  }
  function placeWheels(h24, m, smooth) {
    go(wheels[0], (h24 + 11) % 12, smooth);
    go(wheels[1], m, smooth);
    go(wheels[2], h24 >= 12 ? 1 : 0, smooth);
    if (!smooth) wheels.forEach(paint);
  }
  function setAp(v) {
    ap = v;
    apBtn.textContent = v;
    apBtn.setAttribute('aria-label', `${v}. Press to switch between AM and PM`);
  }
  function refreshValidity() {
    const d = tt.value.replace(/\D/g, '');
    const bad = !$('timeWrap').hidden && d && !parseDigits(d);
    tt.setCustomValidity(bad ? 'Enter a valid time, for example 815 for 8:15.' : '');
  }
  function writeField(h24, m) {
    $('fTime').value = `${pad(h24)}:${pad(m)}`;
    tt.value = `${((h24 + 11) % 12) + 1}:${pad(m)}`;
    setAp(h24 >= 12 ? 'PM' : 'AM');
    tt.removeAttribute('aria-invalid');
    tt.setCustomValidity('');
  }
  function clearField() {
    $('fTime').value = '';
    tt.value = '';
    apManual = false;
    setAp('AM');
    tt.removeAttribute('aria-invalid');
    tt.setCustomValidity('');
  }
  function fromWheels() {
    const h = idx(wheels[0]) + 1, m = idx(wheels[1]), pm = idx(wheels[2]);
    apManual = true;
    writeField((h % 12) + (pm ? 12 : 0), m);
  }

  function openPop() {
    const cur = $('fTime').value;
    const n = new Date();
    const [h, m] = cur ? cur.split(':').map(Number) : [n.getHours(), n.getMinutes()];
    pop.hidden = false;                       // must be visible before the wheels can scroll
    clockBtn.setAttribute('aria-expanded', 'true');
    userMoved = false;
    placeWheels(h, m, false);
  }
  function closePop() {
    if (pop.hidden) return;
    if (userMoved) fromWheels();              // keep what they scrolled to, even if they only tapped
    pop.hidden = true;
    clockBtn.setAttribute('aria-expanded', 'false');
    userMoved = false;
  }
  clockBtn.addEventListener('click', () => (pop.hidden ? openPop() : closePop()));
  $('tDone').addEventListener('click', () => { closePop(); clockBtn.focus(); });
  $('tClear').addEventListener('click', () => { userMoved = false; clearField(); });
  $('tNow').addEventListener('click', () => {
    const n = new Date();
    userMoved = false;
    apManual = false;
    writeField(n.getHours(), n.getMinutes());
    placeWheels(n.getHours(), n.getMinutes(), true);
  });
  document.addEventListener('pointerdown', (e) => {
    if (!pop.hidden && !e.target.closest('.timefield')) closePop();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !pop.hidden) { closePop(); clockBtn.focus(); }
  });

  wheels.forEach((w) => {
    w.el.innerHTML = w.items.map((t) => `<div class="opt" role="option">${t}</div>`).join('');
    w.opts = Array.from(w.el.children);
    let raf = 0, drag = null, dragged = false;

    w.el.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; paint(w); if (userMoved) fromWheels(); });
    }, { passive: true });

    // Mouse drag (touch and trackpad already scroll natively)
    w.el.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      drag = { y: e.clientY, top: w.el.scrollTop };
      dragged = false;
      w.el.setPointerCapture(e.pointerId);
      w.el.style.scrollSnapType = 'none';
      w.el.style.cursor = 'grabbing';
    });
    w.el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dy = e.clientY - drag.y;
      if (Math.abs(dy) > 3) dragged = true;
      w.el.scrollTop = drag.top - dy;
    });
    const endDrag = () => {
      if (!drag) return;
      drag = null;
      w.el.style.scrollSnapType = '';
      w.el.style.cursor = '';
      go(w, idx(w), true);
      setTimeout(() => { dragged = false; }, 0);
    };
    w.el.addEventListener('pointerup', endDrag);
    w.el.addEventListener('pointercancel', endDrag);

    // Click an item to jump to it
    w.el.addEventListener('click', (e) => {
      if (dragged) return;
      const y = e.clientY - w.el.getBoundingClientRect().top + w.el.scrollTop;
      go(w, Math.floor((y - ITEM) / ITEM), true);
    });

    // Keyboard
    w.el.addEventListener('keydown', (e) => {
      const step = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 }[e.key];
      if (!step) return;
      e.preventDefault();
      go(w, idx(w) + step, true);
    });
  });
  ['pointerdown', 'wheel', 'keydown', 'touchstart'].forEach((t) =>
    $('wheels').addEventListener(t, () => { userMoved = true; }, { passive: true }));

  // Typing: numbers only. 8 = 8:00, 815 = 8:15, 1215 = 12:15. AM/PM has its own button.
  // Until someone presses AM/PM we guess a school day: 7-11 = morning, 12 and 1-6 = afternoon.
  const formatDigits = (d) => (d.length <= 2 ? d : d.length === 3 ? `${d[0]}:${d.slice(1)}` : `${d.slice(0, 2)}:${d.slice(2)}`);
  function parseDigits(d) {
    let h, m = 0;
    if (d.length <= 2) h = +d;
    else if (d.length === 3) { h = +d[0]; m = +d.slice(1); }
    else if (d.length === 4) { h = +d.slice(0, 2); m = +d.slice(2); }
    else return null;
    return h >= 1 && h <= 12 && m <= 59 ? { h, m } : null;
  }
  function applyTyped(t) {
    if (!apManual) setAp(t.h >= 7 && t.h <= 11 ? 'AM' : 'PM');
    const h24 = (t.h % 12) + (ap === 'PM' ? 12 : 0);
    $('fTime').value = `${pad(h24)}:${pad(t.m)}`;
    if (!pop.hidden) placeWheels(h24, t.m, false);       // wheels follow while typing
  }
  function commitTyped() {
    const d = tt.value.replace(/\D/g, '');
    if (!d) { clearField(); return true; }
    const t = parseDigits(d);
    if (!t) {
      $('fTime').value = '';
      tt.setAttribute('aria-invalid', 'true');
      refreshValidity();
      return false;
    }
    applyTyped(t);
    tt.value = `${t.h}:${pad(t.m)}`;
    tt.removeAttribute('aria-invalid');
    refreshValidity();
    return true;
  }
  tt.addEventListener('beforeinput', (e) => {           // letters and symbols never get in
    if (e.inputType && e.inputType.startsWith('insert') && e.data && /\D/.test(e.data)) e.preventDefault();
  });
  tt.addEventListener('input', () => {
    userMoved = false;
    tt.removeAttribute('aria-invalid');
    const d = tt.value.replace(/\D/g, '').slice(0, 4);  // also cleans pasted text
    const f = formatDigits(d);
    if (tt.value !== f) tt.value = f;
    const t = parseDigits(d);
    if (t) applyTyped(t);
    else { $('fTime').value = ''; if (!d) apManual = false; }
    refreshValidity();
  });
  tt.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();               // Enter confirms the time, it does not add the record
    commitTyped();
  });
  tt.addEventListener('blur', commitTyped);
  apBtn.addEventListener('click', () => {
    apManual = true;
    setAp(ap === 'AM' ? 'PM' : 'AM');
    const cur = $('fTime').value;
    if (!cur) return;
    const [h, m] = cur.split(':').map(Number), h24 = (h + 12) % 24;
    $('fTime').value = `${pad(h24)}:${pad(m)}`;
    if (!pop.hidden) placeWheels(h24, m, false);
  });

  // Form
  const syncTime = () => {
    const late = $('sLate').checked;
    $('timeWrap').hidden = !late;
    $('halfWrap').hidden = late;
    if (!late) closePop();
    refreshValidity();
  };
  $('fHalf').addEventListener('change', (e) => { $('fSession').disabled = !e.target.checked; });
  document.querySelectorAll('input[name="status"]').forEach((r) => r.addEventListener('change', syncTime));
  syncTime();

  $('entryForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const status = document.querySelector('input[name="status"]:checked').value;
    records.push({
      id: Date.now() + Math.random().toString(16).slice(2),
      name: $('fName').value.trim(),
      group: $('fGroup').value.trim(),
      date: day,
      status,
      time: status === 'Late' ? $('fTime').value : '',
      half: status === 'Absent' && $('fHalf').checked,
      session: status === 'Absent' && $('fHalf').checked ? $('fSession').value : '',
      reason: $('fReason').value.trim()
    });
    write(KEY, records);
    $('fName').value = '';
    $('fReason').value = '';
    $('fHalf').checked = false;
    $('fSession').disabled = true;
    clearField();
    closePop();
    syncTime();
    $('fName').focus();
    render();
  });

  // Render the chosen day
  const delBtn = (r) =>
    `<td class="no-print"><button type="button" class="del" data-id="${r.id}" aria-label="Remove ${esc(r.name)}">Remove</button></td>`;

  function render() {
    const today = records.filter((r) => r.date === day);
    const byName = (a, b) => a.name.localeCompare(b.name);
    const late = today.filter((r) => r.status === 'Late')
      .sort((a, b) => (a.time || '99').localeCompare(b.time || '99') || byName(a, b));
    const absent = today.filter((r) => r.status === 'Absent').sort(byName);

    $('rowsLate').innerHTML = late.map((r, i) => `
      <tr><td class="num">${i + 1}</td><td>${esc(r.name)}</td><td>${esc(r.group)}</td>
      <td>${fmtTime(r.time)}</td><td>${esc(r.reason)}</td>${delBtn(r)}</tr>`).join('');
    $('rowsAbsent').innerHTML = absent.map((r, i) => `
      <tr><td class="num">${i + 1}</td><td>${esc(r.name)}</td><td>${esc(r.group)}</td>
      <td>${r.half ? `<span class="tag half">${esc(halfLabel(r))}</span>` : ''}${esc(r.reason)}</td>${delBtn(r)}</tr>`).join('');

    $('emptyLate').hidden = late.length > 0;
    $('emptyAbsent').hidden = absent.length > 0;
    $('cLate').textContent = `(${late.length})`;
    const halves = absent.filter((r) => r.half).length;
    $('cAbsent').textContent = `(${absent.length}${halves ? `, including ${halves} half-day` : ''})`;
    $('nLate').textContent = late.length;
    $('nAbsent').textContent = absent.length;
    $('nTotal').textContent = today.length;
    $('subLine').textContent = longDate(day);
    $('addDate').textContent = longDate(day);
    document.title = `${$('logTitle').value} - ${day}`;
  }

  document.querySelectorAll('tbody').forEach((tb) => tb.addEventListener('click', (e) => {
    const btn = e.target.closest('.del');
    if (!btn) return;
    records = records.filter((r) => r.id !== btn.dataset.id);
    write(KEY, records);
    render();
  }));

  // Actions
  $('btnPrint').addEventListener('click', () => window.print());

  function downloadCsv(list, filename) {
    if (!list.length) { alert('There are no records to download.'); return; }
    const cell = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [['Date', 'Name', 'Class/Department', 'Status', 'Time arrived', 'Reason/remarks']]
      .concat(list.map((r) => [r.date, r.name, r.group, r.status, r.time, reasonText(r)]));
    const csv = '\ufeff' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }
  const sortList = (l) => l.slice().sort((a, b) =>
    a.date.localeCompare(b.date) || a.status.localeCompare(b.status) || a.name.localeCompare(b.name));

  $('btnCsv').addEventListener('click', () =>
    downloadCsv(sortList(records.filter((r) => r.date === day)), `late-absent-${day}.csv`));
  $('btnAll').addEventListener('click', () =>
    downloadCsv(sortList(records), `late-absent-all-days-${toISO(new Date())}.csv`));

  $('btnClear').addEventListener('click', () => {
    if (!records.some((r) => r.date === day)) return;
    if (confirm(`Delete all records for ${longDate(day)}? Download this day first if you need a copy.`)) {
      records = records.filter((r) => r.date !== day);
      write(KEY, records);
      render();
    }
  });

  setDay(day);
})();
