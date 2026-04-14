// ===== 상태 =====
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;

// ===== 초기화 =====
document.addEventListener('DOMContentLoaded', () => {
  setTodayDate();
  setupAutoCalculate();
  setupForm();
  setupMonthNav();
  loadRecords();
  loadStats();
});

// 날짜 기본값 = 오늘
function setTodayDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  document.getElementById('date').value = `${yyyy}-${mm}-${dd}`;
}

// ===== 근무시간 자동 계산 =====
function setupAutoCalculate() {
  const startEl = document.getElementById('startTime');
  const endEl = document.getElementById('endTime');
  const breakEl = document.getElementById('breakMinutes');

  [startEl, endEl, breakEl].forEach(el => {
    el.addEventListener('input', calcWorkHours);
  });
}

function calcWorkHours() {
  const start = document.getElementById('startTime').value;
  const end = document.getElementById('endTime').value;
  const brk = parseInt(document.getElementById('breakMinutes').value) || 0;
  const display = document.getElementById('calculatedHours');

  if (!start || !end) { display.textContent = '--:--'; return; }

  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let totalMin = (eh * 60 + em) - (sh * 60 + sm) - brk;

  if (totalMin < 0) totalMin += 24 * 60;
  if (totalMin <= 0) { display.textContent = '--:--'; return; }

  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  display.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getCalculatedHours() {
  return document.getElementById('calculatedHours').textContent;
}

// ===== 폼 제출 =====
function setupForm() {
  document.getElementById('workForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const workHours = getCalculatedHours();

    if (workHours === '--:--') {
      showToast('근무 시간을 확인해주세요.', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = '저장 중...';

    const data = {
      date: document.getElementById('date').value,
      startTime: document.getElementById('startTime').value,
      endTime: document.getElementById('endTime').value,
      breakMinutes: document.getElementById('breakMinutes').value,
      workHours,
      note: document.getElementById('note').value,
    };

    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (json.success) {
        showToast('저장되었습니다!', 'success');
        document.getElementById('note').value = '';
        loadRecords();
        loadStats();
      } else {
        showToast(json.message || '오류가 발생했습니다.', 'error');
      }
    } catch (err) {
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
    currentMonth--;
    if (currentMonth < 1) { currentMonth = 12; currentYear--; }
    updateMonthLabel();
    loadRecords();
    loadStats();
  });
  document.getElementById('nextMonth').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 12) { currentMonth = 1; currentYear++; }
    updateMonthLabel();
    loadRecords();
    loadStats();
  });
}

function updateMonthLabel() {
  document.getElementById('monthLabel').textContent = `${currentYear}.${String(currentMonth).padStart(2, '0')}`;
}

// ===== 기록 목록 불러오기 =====
async function loadRecords() {
  const list = document.getElementById('recordsList');
  list.innerHTML = '<div class="loading">불러오는 중...</div>';

  try {
    const res = await fetch('/api/records');
    const json = await res.json();

    if (!json.success) { list.innerHTML = `<div class="empty">${json.message}</div>`; return; }

    const prefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const records = json.records.filter(r => r.date && r.date.startsWith(prefix));

    if (records.length === 0) {
      list.innerHTML = '<div class="empty">이번 달 기록이 없습니다.</div>';
      return;
    }

    list.innerHTML = records.map(r => renderRecord(r)).join('');

    // 삭제 버튼 이벤트 등록
    list.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const rowIndex = btn.dataset.row;
        if (!confirm('이 기록을 삭제하시겠습니까?')) return;
        await deleteRecord(rowIndex);
      });
    });

  } catch (err) {
    list.innerHTML = '<div class="empty">불러오기 실패: 서버를 확인해주세요.</div>';
  }
}

function renderRecord(r) {
  const dateObj = new Date(r.date + 'T00:00:00');
  const day = dateObj.getDate();
  const weekday = WEEKDAYS[dateObj.getDay()];
  const isSun = dateObj.getDay() === 0;
  const isSat = dateObj.getDay() === 6;
  const dayColor = isSun ? 'color:#EF4444' : isSat ? 'color:#3B82F6' : '';

  return `
  <div class="record-item">
    <div class="record-date-box" style="${isSun ? 'background:#FEF2F2;' : isSat ? 'background:#EFF6FF;' : ''}">
      <span class="record-day" style="${dayColor || 'color:var(--primary)'}">${String(day).padStart(2, '0')}</span>
      <span class="record-weekday" style="${dayColor || 'color:var(--primary)'}">${weekday}</span>
    </div>
    <div class="record-info">
      <div class="record-times">${r.startTime} ~ ${r.endTime}</div>
      ${r.note ? `<div class="record-note">${escapeHtml(r.note)}</div>` : ''}
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
    const res = await fetch(`/api/records/${rowIndex}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast('삭제되었습니다.', 'success');
      loadRecords();
      loadStats();
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
    const res = await fetch(`/api/stats?year=${currentYear}&month=${currentMonth}`);
    const json = await res.json();
    if (json.success) {
      document.getElementById('statDays').textContent = `${json.workDays}일`;
      document.getElementById('statHours').textContent = `${json.totalWorkHours}h`;
    }
  } catch {}
}

// ===== 유틸 =====
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

let toastTimer;
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 2800);
}
