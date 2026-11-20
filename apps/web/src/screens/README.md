# screens

화면 수직 슬라이스 — 화면 1장 = 폴더 1개 = 작업 1단위 (예: `warehouse-location/` = W-06-07).

화면 슬라이스가 소유하는 것: 화면별 필드 · 테이블 컬럼 · 입력 검증 · 레이아웃 · 리소스 고유 업무 규칙 · 권한과 문구 · 화면 고유 예외 처리. 공통 workflow는 `../patterns`에서 조립해 온다.

## `load-error-banner.tsx`를 복제할 때 — 잇기 전에 항목별로 거른다

서버 오류 문구를 이어 붙일 때 `errors.map(i => i.message).join(' ')` **후** `=== ''` 검사 형태를
쓰지 않는다. 공백만 있는 문구나 빈 문구 여럿에서 공백만 그린 배너가 된다(client#192). 잇기
**전에** `filter((m) => m.trim() !== '')`로 거른다 — `disposal-issue/load-error-banner.tsx`가
전례다.
