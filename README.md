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

## V3 워크플로 전환 안내

기존에 저장소가 추적하던 루트 `AGENTS.md`와 `CLAUDE.md`는 V3부터 의도적으로 제거된다. 내용이 폐기된 것은 아니며 다음 위치의 단일 정본으로 통합됐다.

- `AGENTS.md`에 있던 팀 업무 경계, 설계 고정, 이슈·공지 절차
- `CLAUDE.md`에 있던 프로젝트 구조, 공개 저장소 경계, 브랜치·디자인 시스템 규칙
- `docs/client-dev-workflow/references/`에 나뉘어 있던 설계 참조, 요청, 이슈, 검증, 병합 절차
- 통합 정본: `docs/client-dev-workflow/multi-agent-team-workflow-v3.md`

기존 개발자도 저장소를 갱신한 뒤 본인이 사용하는 AI 도구와 배정된 팀 번호로 개발환경을 다시 설정해야 한다. 삭제된 파일을 Git에서 복원하거나 강제로 추적하지 않는다.

```bash
pnpm workflow:bootstrap --tool <codex|claude|both> --team <팀번호>
pnpm workflow:check
```

이전 `.client-dev/state.json`에 `noticeIssue`가 있어 이주 안내가 나오면 설계팀이 발행한 공통 공지 참조를 확인한 뒤 다음을 실행한다. 과거 개발팀별 이슈 번호를 공통 공지로 바꾸어 추측하지 않는다.

```bash
pnpm workflow migrate-v3 --notice-ref <설계저장소-공통공지-URL|CREFLEINC/omf-mes#번호>
pnpm workflow:check
```

기존 루트 파일에 개인 메모를 추가해 두었다면 저장소 갱신 전에 별도로 백업하고, 부트스트랩 후 생성된 파일의 `개인별 AI 도구 설정` 구역으로 옮긴다. 생성된 루트 파일은 로컬 전용이며 Git에 커밋하지 않는다.

## 시작

```bash
pnpm install
pnpm workflow:bootstrap --tool <codex|claude|both> --team <팀번호>
gh repo clone CREFLEINC/omf-mes .client-dev/design/omf-mes -- --single-branch --branch main
pnpm workflow init --team <팀번호> --issue <이슈번호> --design-ref .client-dev/design/omf-mes
pnpm workflow:check
pnpm typecheck     # 전 패키지 타입 검사
pnpm mock          # 목 서버 (고정한 설계 참조본 사용 — tools/mock/README.md)
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

`main` 직접 push는 차단돼 있다 — 팀 전용 워크트리와 브랜치에서 작업하고 PR로 병합한다. 업무 규칙과 절차의 정본은 `docs/client-dev-workflow/multi-agent-team-workflow-v3.md`다. 루트의 `AGENTS.md`와 `CLAUDE.md`는 부트스트랩으로 만드는 개인별 로컬 파일이며 커밋하지 않는다.
