require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Google Sheets 인증 설정
function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || '근무기록';

// 근무 기록 목록 조회
app.get('/api/records', async (req, res) => {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:F`,
    });

    const rows = response.data.values || [];
    const records = rows.map((row, index) => ({
      id: index + 2,
      date: row[0] || '',
      startTime: row[1] || '',
      endTime: row[2] || '',
      breakMinutes: row[3] || '0',
      workHours: row[4] || '',
      note: row[5] || '',
    }));

    res.json({ success: true, records: records.reverse() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 근무 기록 추가
app.post('/api/records', async (req, res) => {
  try {
    const { date, startTime, endTime, breakMinutes, workHours, note } = req.body;
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: '날짜, 출근시간, 퇴근시간은 필수입니다.' });
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 헤더 행이 없으면 생성
    const headerCheck = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:F1`,
    });

    if (!headerCheck.data.values || headerCheck.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1:F1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['날짜', '출근시간', '퇴근시간', '휴게시간(분)', '근무시간', '메모']],
        },
      });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:F`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[date, startTime, endTime, breakMinutes || '0', workHours, note || '']],
      },
    });

    res.json({ success: true, message: '근무 기록이 저장되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 근무 기록 삭제
app.delete('/api/records/:rowIndex', async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.rowIndex);
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 시트 ID 조회
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheet = spreadsheet.data.sheets.find(s => s.properties.title === SHEET_NAME);
    if (!sheet) return res.status(404).json({ success: false, message: '시트를 찾을 수 없습니다.' });

    const sheetId = sheet.properties.sheetId;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        }],
      },
    });

    res.json({ success: true, message: '기록이 삭제되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 월별 통계 조회
app.get('/api/stats', async (req, res) => {
  try {
    const { year, month } = req.query;
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:F`,
    });

    const rows = response.data.values || [];
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const filtered = rows.filter(row => row[0] && row[0].startsWith(prefix));

    const totalMinutes = filtered.reduce((sum, row) => {
      const wh = row[4] || '0';
      const [h, m] = wh.split(':').map(Number);
      return sum + (h || 0) * 60 + (m || 0);
    }, 0);

    const totalHours = Math.floor(totalMinutes / 60);
    const totalMins = totalMinutes % 60;

    res.json({
      success: true,
      workDays: filtered.length,
      totalWorkHours: `${totalHours}:${String(totalMins).padStart(2, '0')}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
