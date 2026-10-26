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

  // Form
  const syncTime = () => {
    const late = $('sLate').checked;
    $('timeWrap').hidden = !late;
    if (!late) $('fTime').value = '';
  };
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
      reason: $('fReason').value.trim()
    });
    write(KEY, records);
    $('fName').value = '';
    $('fReason').value = '';
    $('fTime').value = '';
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
      <td>${esc(r.reason)}</td>${delBtn(r)}</tr>`).join('');

    $('emptyLate').hidden = late.length > 0;
    $('emptyAbsent').hidden = absent.length > 0;
    $('cLate').textContent = `(${late.length})`;
    $('cAbsent').textContent = `(${absent.length})`;
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
      .concat(list.map((r) => [r.date, r.name, r.group, r.status, r.time, r.reason]));
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