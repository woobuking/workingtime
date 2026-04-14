// =====================================================
// 근무 시간 기록 - Google Apps Script 웹앱
// =====================================================
// 사용법:
//   1. Google Sheets에서 확장 프로그램 > Apps Script 열기
//   2. 이 코드 전체를 붙여넣기
//   3. 배포 > 배포 관리 > 수정 > 새 버전으로 배포
//      - 실행 계정: 나 (Me)
//      - 액세스 권한: 모든 사람 (Anyone)
// =====================================================

const SHEET_NAME = '근무기록';

// JSONP 지원 응답 (callback 파라미터가 있으면 JSONP, 없으면 JSON)
function jsonOut(data, callback) {
  const json = JSON.stringify(data);
  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${json})`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function ensureHeader(sheet) {
  if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() !== '날짜') {
    sheet.insertRowBefore(1);
    const h = sheet.getRange(1, 1, 1, 6);
    h.setValues([['날짜', '출근시간', '퇴근시간', '휴게시간(분)', '근무시간', '메모']]);
    h.setBackground('#2D6A4F');
    h.setFontColor('#FFFFFF');
    h.setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

function formatDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(val);
}

// ===== 백데이터 1회 임포트 (Apps Script 에디터에서 직접 실행) =====
function importBackData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  ensureHeader(sheet);

  const data = [
    ['2026-02-24', '10:30', '16:00', '0', '05:30', ''],
    ['2026-02-26', '10:30', '16:00', '0', '05:30', ''],
    ['2026-02-27', '10:30', '16:00', '0', '05:30', ''],
    ['2026-03-03', '10:30', '16:00', '0', '05:30', ''],
    ['2026-03-04', '10:30', '16:00', '0', '05:30', ''],
    ['2026-03-05', '10:30', '16:00', '0', '05:30', ''],
    ['2026-03-06', '10:30', '16:00', '0', '05:30', ''],
    ['2026-03-10', '10:30', '16:00', '0', '05:30', ''],
    ['2026-03-11', '10:30', '14:30', '0', '04:00', ''],
    ['2026-03-12', '10:30', '16:00', '0', '05:30', ''],
    ['2026-03-13', '10:30', '14:30', '0', '04:00', ''],
    ['2026-03-17', '10:30', '16:00', '0', '05:30', ''],
    ['2026-03-18', '10:30', '14:30', '0', '04:00', ''],
    ['2026-03-20', '10:30', '14:30', '0', '04:00', ''],
    ['2026-03-24', '10:30', '16:00', '0', '05:30', ''],
    ['2026-03-26', '10:30', '16:00', '0', '05:30', ''],
    ['2026-04-01', '10:30', '16:00', '0', '05:30', ''],
    ['2026-04-02', '10:30', '17:00', '0', '06:30', ''],
    ['2026-04-07', '10:30', '17:30', '0', '07:00', ''],
    ['2026-04-09', '10:30', '17:00', '0', '06:30', ''],
    ['2026-04-13', '10:30', '14:30', '0', '04:00', ''],
  ];

  const existing = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().map(r => String(r[0]))
    : [];

  let added = 0;
  data.forEach(row => {
    if (!existing.includes(row[0])) {
      sheet.appendRow(row);
      added++;
    }
  });

  if (sheet.getLastRow() > 2) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).sort(1);
  }

  SpreadsheetApp.getUi().alert(`✅ 백데이터 임포트 완료!\n${added}건 추가됨 (중복 제외)`);
}

// ===== 모든 요청을 doGet + JSONP로 처리 =====
function doGet(e) {
  const cb = e.parameter.callback || null;
  try {
    const action = e.parameter.action || 'records';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
    ensureHeader(sheet);

    // --- 기록 목록 조회 ---
    if (action === 'records') {
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return jsonOut({ success: true, records: [] }, cb);

      const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
      const records = data
        .map((row, i) => ({
          id: i + 2,
          date: formatDate(row[0]),
          startTime: row[1] || '',
          endTime: row[2] || '',
          breakMinutes: String(row[3] || '0'),
          workHours: row[4] || '',
          note: row[5] || '',
        }))
        .filter(r => r.date)
        .reverse();

      return jsonOut({ success: true, records }, cb);
    }

    // --- 월별 통계 ---
    if (action === 'stats') {
      const year = e.parameter.year;
      const month = String(e.parameter.month).padStart(2, '0');
      const prefix = `${year}-${month}`;
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return jsonOut({ success: true, workDays: 0, totalWorkHours: '00:00' }, cb);

      const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
      const filtered = data.filter(row => formatDate(row[0]).startsWith(prefix));
      const totalMinutes = filtered.reduce((sum, row) => {
        const parts = String(row[4] || '0:0').split(':').map(Number);
        return sum + (parts[0] || 0) * 60 + (parts[1] || 0);
      }, 0);

      return jsonOut({
        success: true,
        workDays: filtered.length,
        totalWorkHours: `${String(Math.floor(totalMinutes / 60)).padStart(2,'0')}:${String(totalMinutes % 60).padStart(2,'0')}`,
      }, cb);
    }

    // --- 기록 추가 ---
    if (action === 'add') {
      const { date, startTime, endTime, breakMinutes, workHours, note } = e.parameter;
      if (!date || !startTime || !endTime) {
        return jsonOut({ success: false, message: '날짜, 출근시간, 퇴근시간은 필수입니다.' }, cb);
      }
      sheet.appendRow([date, startTime, endTime, breakMinutes || '0', workHours, note || '']);
      if (sheet.getLastRow() > 2) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).sort(1);
      }
      return jsonOut({ success: true, message: '저장되었습니다.' }, cb);
    }

    // --- 기록 삭제 ---
    if (action === 'delete') {
      const rowIndex = parseInt(e.parameter.rowIndex);
      if (isNaN(rowIndex) || rowIndex < 2) {
        return jsonOut({ success: false, message: '잘못된 행 번호입니다.' }, cb);
      }
      sheet.deleteRow(rowIndex);
      return jsonOut({ success: true, message: '삭제되었습니다.' }, cb);
    }

    return jsonOut({ success: false, message: '알 수 없는 action' }, cb);

  } catch (err) {
    return jsonOut({ success: false, message: err.toString() }, cb);
  }
}
