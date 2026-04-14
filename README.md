# 근무 시간 기록 앱

Google Apps Script를 백엔드로 사용하는 근무 시간 기록 웹 앱입니다.
별도의 서버 설정이나 API 키 없이, Apps Script URL 하나만 등록하면 바로 사용 가능합니다.

## 기능
- 날짜 / 출퇴근 시간 / 휴게시간 입력
- 실 근무시간 자동 계산
- 월별 근무일수 및 총 근무시간 통계
- 기록 삭제

---

## 설정 방법

### 1. Google Sheets에 Apps Script 등록

1. Google Sheets에서 새 스프레드시트를 만듭니다
2. 상단 메뉴 **확장 프로그램 > Apps Script** 클릭
3. `Code.gs` 파일의 내용을 전체 복사해서 붙여넣기
4. 저장 (Ctrl+S)

### 2. 웹앱으로 배포

1. Apps Script 화면에서 **배포 > 새 배포** 클릭
2. 유형: **웹 앱** 선택
3. 설정:
   - 실행 계정: **나 (Me)**
   - 액세스 권한: **모든 사람 (Anyone)**
4. **배포** 클릭 → 권한 승인
5. **웹 앱 URL** 복사

### 3. 앱 실행 후 URL 등록

```bash
npm install
npm start
```

브라우저에서 `http://localhost:3000` 접속 후 복사한 URL을 붙여넣어 등록합니다.

> **참고:** `public/` 폴더를 GitHub Pages나 Netlify 등에 올려도 동일하게 동작합니다.

---

## 파일 구조

```
workingtime/
├── Code.gs          ← Google Apps Script에 붙여넣는 코드
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── server.js        ← 정적 파일 서버 (선택사항)
└── package.json
```
