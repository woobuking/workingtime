// ===== Apps Script URL (하드코딩) =====
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxjEjM2_m9j0aK9HHcJiOzin4NuAyPqzSh02RcIE2wBg2cNO6abpA8aKaqihStUacXk/exec';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
let currentYear  = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let selectedEndTime = '';

// ===== 초기화 =====
document.addEventListener('DOMContentLoaded', () => {
  setTodayDate();
  setupTimeBtns();
  setupStartTimeWatch();
  setupForm();
  setupMonthNav();
  loadRecords();
  loadStats();
});

// ===== 오늘 날짜 기본값 =====
function setTodayDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm   = String(today.getMonth() + 1).padStart(2, '0');
  const dd   = String(today.getDate()).padStart(2, '0');
  document.getElementById('date').value = `${yyyy}-${mm}-${dd}`;
}

// ===== 퇴근 시간 버튼 =====
function setupTimeBtns() {
  document.querySelectorAll('.time-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedEndTime = btn.dataset.time;
      calcWorkHours();
      document.getElementById('submitBtn').disabled = false;
    });
  });
}

// 출근 시간 바뀌어도 재계산
function setupStartTimeWatch() {
  document.getElementById('startTime').addEventListener('change', calcWorkHours);
}

// ===== 근무시간 계산 =====
function calcWorkHours() {
  const start = document.getElementById('startTime').value;
  const end   = selectedEndTime;
  const disp  = document.getElementById('calculatedHours');

  if (!start || !end) { disp.textContent = '--:--'; return; }

  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const totalMin = (eh * 60 + em) - (sh * 60 + sm);

  if (totalMin <= 0) { disp.textContent = '--:--'; return; }
  disp.textContent = `${String(Math.floor(totalMin / 60)).padStart(2,'0')}:${String(totalMin % 60).padStart(2,'0')}`;
}

// ===== Apps Script 호출 (GET만 사용) =====
async function gsCall(params) {
  const url = new URL(SCRIPT_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { redirect: 'follow' });
  return res.json();
}

// ===== 폼 제출 =====
function setupForm() {
  document.getElementById('workForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const workHours = document.getElementById('calculatedHours').textContent;
    if (workHours === '--:--' || !selectedEndTime) {
      showToast('퇴근 시간을 선택해주세요.', 'err');
      return;
    }

    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = '저장 중…';

    try {
      const json = await gsCall({
        action:       'add',
        date:         document.getElementById('date').value,
        startTime:    document.getElementById('startTime').value,
        endTime:      selectedEndTime,
        breakMinutes: '0',
        workHours,
        note:         '',
      });

      if (json.success) {
        showToast('저장되었습니다!', 'ok');
        // 퇴근 버튼 초기화
        document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('selected'));
        selectedEndTime = '';
        document.getElementById('calculatedHours').textContent = '--:--';
        loadRecords();
        loadStats();
      } else {
        showToast(json.message || '오류가 발생했습니다.', 'err');
      }
    } catch {
      showToast('서버 연결 오류', 'err');
    } finally {
      btn.textContent = '저장하기';
      btn.disabled = !selectedEndTime;
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

// ===== 기록 불러오기 =====
async function loadRecords() {
  const list = document.getElementById('recordsList');
  list.innerHTML = '<div class="state-empty">불러오는 중…</div>';
  try {
    const json = await gsCall({ action: 'records' });
    if (!json.success) { list.innerHTML = `<div class="state-empty">${json.message}</div>`; return; }

    const prefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const records = json.records.filter(r => r.date && r.date.startsWith(prefix));

    if (!records.length) { list.innerHTML = '<div class="state-empty">이번 달 기록이 없습니다.</div>'; return; }

    list.innerHTML = records.map(renderRec).join('');
    list.querySelectorAll('.btn-del').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('삭제하시겠습니까?')) deleteRecord(btn.dataset.row);
      });
    });
  } catch {
    list.innerHTML = '<div class="state-empty">불러오기 실패. 연결을 확인해주세요.</div>';
  }
}

function renderRec(r) {
  const d   = new Date(r.date + 'T00:00:00');
  const day = d.getDate();
  const wd  = d.getDay();
  const cls = wd === 0 ? 'sun' : wd === 6 ? 'sat' : '';

  return `
  <div class="rec">
    <div class="rec-badge ${cls}">
      <span class="rec-day">${String(day).padStart(2,'0')}</span>
      <span class="rec-wd">${WEEKDAYS[wd]}</span>
    </div>
    <div class="rec-info">
      <div class="rec-times">${r.startTime} ~ ${r.endTime}</div>
      ${r.note ? `<div class="rec-note">${esc(r.note)}</div>` : ''}
    </div>
    <div class="rec-hours-wrap">
      <div class="rec-hours">${r.workHours}</div>
      <div class="rec-hl">근무시간</div>
    </div>
    <button class="btn-del" data-row="${r.id}" title="삭제">✕</button>
  </div>`;
}

// ===== 삭제 =====
async function deleteRecord(rowIndex) {
  try {
    const json = await gsCall({ action: 'delete', rowIndex });
    if (json.success) { showToast('삭제되었습니다.', 'ok'); loadRecords(); loadStats(); }
    else showToast(json.message || '삭제 실패', 'err');
  } catch {
    showToast('서버 연결 오류', 'err');
  }
}

// ===== 통계 =====
async function loadStats() {
  try {
    const json = await gsCall({ action: 'stats', year: currentYear, month: currentMonth });
    if (!json.success) return;
    document.getElementById('statDays').textContent  = json.workDays;
    document.getElementById('statHours').textContent = json.totalWorkHours;

    // 평균 계산
    if (json.workDays > 0) {
      const [h, m] = json.totalWorkHours.split(':').map(Number);
      const avgMin = Math.round((h * 60 + m) / json.workDays);
      document.getElementById('statAvg').textContent =
        `${String(Math.floor(avgMin / 60)).padStart(2,'0')}:${String(avgMin % 60).padStart(2,'0')}`;
    } else {
      document.getElementById('statAvg').textContent = '--:--';
    }
  } catch {}
}

// ===== 유틸 =====
function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 2600);
}
