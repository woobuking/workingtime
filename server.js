// 정적 파일 서버 (선택사항)
// Apps Script URL은 브라우저에서 직접 등록합니다.
// 사용: node server.js  또는  npx serve public

const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`앱 실행 중: http://localhost:${PORT}`);
});
