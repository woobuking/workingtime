# 근무 시간 기록 앱

Google Sheets를 DB로 사용하는 근무 시간 기록 웹 앱입니다.

## 기능
- 날짜 / 출퇴근 시간 / 휴게시간 입력
- 실 근무시간 자동 계산
- 월별 근무일수 및 총 근무시간 통계
- 기록 삭제

## 설치 및 실행

### 1. 패키지 설치
```bash
npm install
```

### 2. Google Sheets API 설정

1. [GCP 콘솔](https://console.cloud.google.com)에서 새 프로젝트 생성
2. **Google Sheets API** 활성화
3. **IAM > 서비스 계정** 생성 후 JSON 키 다운로드
4. Google 스프레드시트를 하나 만들고, 서비스 계정 이메일을 **편집자**로 공유

### 3. 환경변수 설정
```bash
cp .env.example .env
```

`.env` 파일을 열어 아래 값 입력:
- `SPREADSHEET_ID`: 스프레드시트 URL의 ID 부분
- `SHEET_NAME`: 사용할 시트 이름 (기본값: 근무기록)
- `GOOGLE_CREDENTIALS`: 서비스 계정 JSON을 한 줄로 변환한 값

```bash
# JSON을 한 줄로 변환하는 방법
cat credentials.json | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)))"
```

### 4. 실행
```bash
# 일반 실행
npm start

# 개발 모드 (파일 변경 시 자동 재시작)
npm run dev
```

브라우저에서 `http://localhost:3000` 접속
