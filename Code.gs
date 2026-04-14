// =====================================================
// 근무 시간 기록 - Google Apps Script 웹앱
// =====================================================
// 사용법:
//   1. Google Sheets에서 확장 프로그램 > Apps Script 열기
//   2. 이 코드 전체를 붙여넣기
//   3. 배포 > 새 배포 > 웹 앱
//      - 실행 계정: 나 (Me)
//      - 액세스 권한: 모든 사람 (Anyone)
//   4. 배포 후 웹 앱 URL을 복사해서 앱에 등록
// =====================================================

const SHEET_NAME = '근무기록';

// ===== CORS 헤더 =====
function setCorsHeaders(output) {
  return output;
}

function jsonOut(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== 헤더 행 보장 =====
function ensureHeader(sheet) {
  if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() !== '날짜') {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, 6).setValues([
      ['날짜', '출근시간', '퇴근시간', '휴게시간(분)', '근무시간', '메모']
    ]);
    // 헤더 스타일
    const headerRange = sheet.getRange(1, 1, 1, 6);
    headerRange.setBackground('#4F6AF5');
    headerRange.setFontColor('#FFFFFF');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

// ===== 날짜 포맷 변환 =====
function formatDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(val);
}

// ===== GET 요청 처리 (조회) =====
function doGet(e) {
  try {
    const action = e.parameter.action || 'records';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
    ensureHeader(sheet);

    // --- 기록 목록 ---
    if (action === 'records') {
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return jsonOut({ success: true, records: [] });

      const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
      const records = data
        .map((row, i) => ({
          id: i + 2,             // 실제 시트 행 번호
          date: formatDate(row[0]),
          startTime: row[1] || '',
          endTime: row[2] || '',
          breakMinutes: String(row[3] || '0'),
          workHours: row[4] || '',
          note: row[5] || '',
        }))
        .filter(r => r.date)    // 빈 행 제외
        .reverse();             // 최신순 정렬

      return jsonOut({ success: true, records });
    }

    // --- 월별 통계 ---
    if (action === 'stats') {
      const year = e.parameter.year;
      const month = String(e.parameter.month).padStart(2, '0');
      const prefix = `${year}-${month}`;
      const lastRow = sheet.getLastRow();

      if (lastRow < 2) return jsonOut({ success: true, workDays: 0, totalWorkHours: '00:00' });

      const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
      const filtered = data.filter(row => formatDate(row[0]).startsWith(prefix));

      const totalMinutes = filtered.reduce((sum, row) => {
        const wh = String(row[4] || '0:0');
        const parts = wh.split(':').map(Number);
        return sum + (parts[0] || 0) * 60 + (parts[1] || 0);
      }, 0);

      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;

      return jsonOut({
        success: true,
        workDays: filtered.length,
        totalWorkHours: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      });
    }

    return jsonOut({ success: false, message: '알 수 없는 action' });

  } catch (err) {
    return jsonOut({ success: false, message: err.toString() });
  }
}

// ===== POST 요청 처리 (저장 / 삭제) =====
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
    ensureHeader(sheet);

    // --- 기록 추가 ---
    if (action === 'add') {
      const { date, startTime, endTime, breakMinutes, workHours, note } = data;
      if (!date || !startTime || !endTime) {
        return jsonOut({ success: false, message: '날짜, 출근시간, 퇴근시간은 필수입니다.' });
      }
      sheet.appendRow([date, startTime, endTime, breakMinutes || '0', workHours, note || '']);
      // 날짜 열 오름차순 정렬 (헤더 제외)
      if (sheet.getLastRow() > 2) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).sort(1);
      }
      return jsonOut({ success: true, message: '저장되었습니다.' });
    }

    // --- 기록 삭제 ---
    if (action === 'delete') {
      const rowIndex = parseInt(data.rowIndex);
      if (isNaN(rowIndex) || rowIndex < 2) {
        return jsonOut({ success: false, message: '잘못된 행 번호입니다.' });
      }
      sheet.deleteRow(rowIndex);
      return jsonOut({ success: true, message: '삭제되었습니다.' });
    }

    return jsonOut({ success: false, message: '알 수 없는 action' });

  } catch (err) {
    return jsonOut({ success: false, message: err.toString() });
  }
}
