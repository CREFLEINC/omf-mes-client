# omf-mes-client

OMF-MES 사용자 프로그램의 클라이언트 모노레포. React + TypeScript 코드 1벌에서 셸 3종 — 브라우저(관리웹) · Electron(POP) · Capacitor(모바일) — 을 빌드한다.

## 구조

```
apps/
  web/            # 관리웹 셸 (routes → screens → patterns → packages)
  mobile/         # 모바일 셸 (Capacitor Android) — 같은 내부 의존 방향
packages/
  domain/         # 업무 개념·상태 전이·검증 — 내부 의존 0
  api-client/     # OpenAPI 계약 클라이언트·횡단 규약 — domain만 의존
  ui/             # 표현 전용 부품 (ds-candidates 포함) — domain·api-client 무의존
  i18n/           # 한/베 리소스
tools/
  mock/           # Prism 목 서버 (계약 검증·초기 개발용)
```

패키지 간 허용 의존과 책임 경계는 구조 설계 검토 보고서 v0.2가 정본이다. 각 패키지 README에 요약돼 있다.

## 시작

```bash
pnpm install
pnpm typecheck     # 전 패키지 타입 검사
pnpm mock          # 목 서버 (형제 경로의 omf-mes 클론 필요 — tools/mock/README.md)
pnpm mock:smoke    # 목 서버 smoke 테스트
pnpm --filter @omf-mes/web dev      # 관리웹 개발 서버
pnpm --filter @omf-mes/mobile dev   # 모바일 셸 개발 서버 (브라우저)
```

요구 사항: Node ≥ 20.19, pnpm 11.

모바일 셸을 **단말에서** 돌리려면 JDK 21과 Android SDK가 더 필요하다 — 준비 절차와 빌드·동기화·APK 명령은 `apps/mobile/README.md`에 있다.

### 관리웹을 목 서버에 붙여 실행

`pnpm mock`과 `pnpm --filter @omf-mes/web dev`를 각각 띄우면 화면이 목 서버 응답으로 그려진다.
관리웹의 기본 기준 URL은 목 서버 주소(`http://127.0.0.1:4010`)이며, 다른 서버에 붙이려면
`VITE_API_BASE_URL`로 덮는다(예: `VITE_API_BASE_URL=http://127.0.0.1:4011 pnpm --filter @omf-mes/web dev`).

## 작업 규칙

`main` 직접 push는 차단돼 있다 — 브랜치에서 작업하고 PR로 병합한다. 공개 저장소 경계 규칙은 `CLAUDE.md`를 따른다.
