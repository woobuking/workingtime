// ===== 상태 =====
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const STORAGE_KEY = 'workingtime_script_url';
let currentYear  = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let scriptUrl    = '';

// ===== 초기화 =====
document.addEventListener('DOMContentLoaded', () => {
  scriptUrl = localStorage.getItem(STORAGE_KEY) || '';

  if (!scriptUrl) {
    showSetup();
  } else {
    hideSetup();
    init();
  }

  setupSetupPanel();
  document.getElementById('btnSettings').addEventListener('click', showSetup);
});

function init() {
  setTodayDate();
  setupAutoCalculate();
  setupForm();
  setupMonthNav();
  loadRecords();
  loadStats();
}

// ===== 설정 패널 =====
function showSetup() {
  const overlay = document.getElementById('setupOverlay');
  overlay.classList.remove('hidden');
  if (scriptUrl) document.getElementById('scriptUrlInput').value = scriptUrl;
}

function hideSetup() {
  document.getElementById('setupOverlay').classList.add('hidden');
}

function setupSetupPanel() {
  document.getElementById('saveScriptUrl').addEventListener('click', () => {
    const url = document.getElementById('scriptUrlInput').value.trim();
    const errEl = document.getElementById('setupError');

    if (!url.startsWith('https://script.google.com/macros/s/')) {
      errEl.textContent = 'Apps Script 웹앱 URL 형식이 아닙니다.';
      return;
    }

    localStorage.setItem(STORAGE_KEY, url);
    scriptUrl = url;
    errEl.textContent = '';
    hideSetup();
    init();
    showToast('URL이 등록되었습니다!', 'success');
  });
}

// ===== 날짜 기본값 = 오늘 =====
function setTodayDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm   = String(today.getMonth() + 1).padStart(2, '0');
  const dd   = String(today.getDate()).padStart(2, '0');
  document.getElementById('date').value = `${yyyy}-${mm}-${dd}`;
}

// ===== 근무시간 자동 계산 =====
function setupAutoCalculate() {
  ['startTime', 'endTime', 'breakMinutes'].forEach(id => {
    document.getElementById(id).addEventListener('input', calcWorkHours);
  });
}

function calcWorkHours() {
  const start = document.getElementById('startTime').value;
  const end   = document.getElementById('endTime').value;
  const brk   = parseInt(document.getElementById('breakMinutes').value) || 0;
  const disp  = document.getElementById('calculatedHours');

  if (!start || !end) { disp.textContent = '--:--'; return; }

  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let totalMin = (eh * 60 + em) - (sh * 60 + sm) - brk;
  if (totalMin < 0) totalMin += 24 * 60;
  if (totalMin <= 0) { disp.textContent = '--:--'; return; }

  disp.textContent = `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
}

// ===== Apps Script 호출 헬퍼 =====
async function gsGet(params) {
  const url = new URL(scriptUrl);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { redirect: 'follow' });
  return res.json();
}

async function gsPost(data) {
  const res = await fetch(scriptUrl, {
    method: 'POST',
    // text/plain → preflight 없이 CORS 통과
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(data),
    redirect: 'follow',
  });
  return res.json();
}

// ===== 폼 제출 =====
function setupForm() {
  document.getElementById('workForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const workHours = document.getElementById('calculatedHours').textContent;
    if (workHours === '--:--') { showToast('근무 시간을 확인해주세요.', 'error'); return; }

    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = '저장 중...';

    try {
      const json = await gsPost({
        action: 'add',
        date:         document.getElementById('date').value,
        startTime:    document.getElementById('startTime').value,
        endTime:      document.getElementById('endTime').value,
        breakMinutes: document.getElementById('breakMinutes').value,
        workHours,
        note:         document.getElementById('note').value,
      });

      if (json.success) {
        showToast('저장되었습니다!', 'success');
        document.getElementById('note').value = '';
        loadRecords();
        loadStats();
      } else {
        showToast(json.message || '오류가 발생했습니다.', 'error');
      }
    } catch {
      showToast('서버 연결 오류', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span class="btn-icon">+</span> 기록 저장';
    }
  });
}

// ===== 월 이동 =====
function setupMonthNav() {
  updateMonthLabel();
  document.getElementById('prevMonth').addEventListener('click', () => {
    if (--currentMonth < 1) { currentMonth = 12; currentYear--; }
    updateMonthLabel(); loadRecords(); loadStats();
  });
  document.getElementById('nextMonth').addEventListener('click', () => {
    if (++currentMonth > 12) { currentMonth = 1; currentYear++; }
    updateMonthLabel(); loadRecords(); loadStats();
  });
}

function updateMonthLabel() {
  document.getElementById('monthLabel').textContent =
    `${currentYear}.${String(currentMonth).padStart(2, '0')}`;
}

// ===== 기록 목록 불러오기 =====
async function loadRecords() {
  const list = document.getElementById('recordsList');
  list.innerHTML = '<div class="loading">불러오는 중...</div>';
  try {
    const json = await gsGet({ action: 'records' });
    if (!json.success) { list.innerHTML = `<div class="empty">${json.message}</div>`; return; }

    const prefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const records = json.records.filter(r => r.date && r.date.startsWith(prefix));

    if (!records.length) { list.innerHTML = '<div class="empty">이번 달 기록이 없습니다.</div>'; return; }

    list.innerHTML = records.map(renderRecord).join('');
    list.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('이 기록을 삭제하시겠습니까?')) return;
        await deleteRecord(btn.dataset.row);
      });
    });
  } catch {
    list.innerHTML = '<div class="empty">불러오기 실패. URL 설정을 확인해주세요.</div>';
  }
}

function renderRecord(r) {
  const d = new Date(r.date + 'T00:00:00');
  const day = d.getDate();
  const wd  = WEEKDAYS[d.getDay()];
  const sun = d.getDay() === 0;
  const sat = d.getDay() === 6;
  const col = sun ? '#EF4444' : sat ? '#3B82F6' : 'var(--primary)';
  const bg  = sun ? '#FEF2F2' : sat ? '#EFF6FF' : 'var(--primary-light)';

  return `
  <div class="record-item">
    <div class="record-date-box" style="background:${bg}">
      <span class="record-day" style="color:${col}">${String(day).padStart(2,'0')}</span>
      <span class="record-weekday" style="color:${col}">${wd}</span>
    </div>
    <div class="record-info">
      <div class="record-times">${r.startTime} ~ ${r.endTime}</div>
      ${r.note ? `<div class="record-note">${escHtml(r.note)}</div>` : ''}
    </div>
    <div>
      <div class="record-hours">${r.workHours}</div>
      <div class="record-hours-label">근무시간</div>
    </div>
    <button class="btn-delete" data-row="${r.id}" title="삭제">&#x2715;</button>
  </div>`;
}

// ===== 기록 삭제 =====
async function deleteRecord(rowIndex) {
  try {
    const json = await gsPost({ action: 'delete', rowIndex });
    if (json.success) {
      showToast('삭제되었습니다.', 'success');
      loadRecords(); loadStats();
    } else {
      showToast(json.message || '삭제 실패', 'error');
    }
  } catch {
    showToast('서버 연결 오류', 'error');
  }
}

// ===== 월별 통계 =====
async function loadStats() {
  try {
    const json = await gsGet({ action: 'stats', year: currentYear, month: currentMonth });
    if (json.success) {
      document.getElementById('statDays').textContent  = `${json.workDays}일`;
      document.getElementById('statHours').textContent = `${json.totalWorkHours}h`;
    }
  } catch {}
}

// ===== 유틸 =====
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 2800);
}
