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

### 개발 백엔드에 붙여 실행

개발 백엔드는 서버가 등록한 오리진에만 CORS를 연다. 이 저장소는 워크트리마다 dev 포트가
밀려 오리진이 고정되지 않으므로, 브라우저가 백엔드를 직접 부르면 preflight에서 막히기 쉽다.
그래서 **dev 서버가 `/api` 요청을 대신 넘긴다** — 같은 출처가 되어 preflight 자체가 없다.

**인증이 쿠키(`omf_session`, HttpOnly)라 이 편이 맞기도 하다.** 같은 출처면 쿠키가 그대로
실려 화면 코드를 고치지 않아도 로그인 세션이 유지된다.

`apps/web/.env.example`을 `apps/web/.env.local`로 복사하고 두 값을 채운다.

```bash
cp apps/web/.env.example apps/web/.env.local   # 주소를 채운다 — .local 은 커밋되지 않는다
pnpm --filter @omf-mes/web dev                 # 관리웹
pnpm --filter @omf-mes/web dev:pop             # POP
```

붙었는지 확인 — dev 서버 주소로 부른 응답이 백엔드에서 와야 한다.

```bash
curl -s http://localhost:5173/api/health       # POP 은 5174
```

⚠ **프록시는 개발 서버 전용이다.** 빌드 산출물에는 이 경로가 없으므로, 설치본·배포본은
백엔드가 CORS를 열어 주거나 화면과 같은 출처로 서비스돼야 한다.

⚠ **계약 경로는 로그인을 요구한다.** 로그인하지 않으면 모든 조회가 `401`로 답한다.
로그인은 `POST /api/app/sessions`이며 성공하면 서버가 세션 쿠키를 내린다 — 프록시를 거치면
브라우저가 그 쿠키를 이후 요청에 자동으로 싣는다. 계정·초기 자료 준비 절차는 서버 저장소의
`docs/client-local-api.md`에 있다.

## 배포 — 최소 구성 (관리웹 단일 서버)

관리웹 정적 번들과 동일 출처 `/api` 프록시를 Nginx 컨테이너 하나로 띄운다. 파일:
`Dockerfile` · `.github/workflows/front-image.yml` · `deploy/install-deploy.sh`.
운영 절차의 정본은 [`deploy/README.md`](deploy/README.md)다.

모바일 Android 앱과 Windows POP 설치본은 관리웹 이미지에 포함하지 않고 별도 릴리스로 관리한다.

클라이언트 릴리스 태그는 `[platform]-vMAJOR.MINOR.PATCH` 형식으로 분류한다. 플랫폼은
`mobile`, `web`, `desktop`이며 예시는 `mobile-v1.2.0`, `web-v1.2.0`, `desktop-v1.2.0`이다.

`main`에 포함된 커밋에 정식 웹 release tag(`web-v1.2.3` 형식)를 만들면 GitHub Actions가 관리웹을
검증·빌드하고 `hub.crefle.com/mes/front`에 버전, `stable`, `sha-xxxxxxx` 태그를 게시한다.
`mobile-v*`와 `desktop-v*` 태그에는 이 Action이 반응하지 않는다.
이미지 push용 Robot Account는 `REGISTRY_USERNAME`과 `REGISTRY_PASSWORD` Actions secret에만 둔다.
현장 서버는 공개 이미지를 pull하므로 Registry 로그인이 필요하지 않다.

### 현장 서버 최초 설치

현장 서버에 Docker Engine, Docker Compose v2와 `curl` 또는 `wget`이 설치되어 있어야 한다.
배포 디렉터리에 `install-deploy.sh` 하나만 복사하고 실행한다.

```bash
chmod +x install-deploy.sh
./install-deploy.sh
```

스크립트가 다음 값을 입력받는다.

- 배포할 웹 릴리스 이미지 tag (`web-v1.2.3` 형식)
- 관리웹을 바인딩할 LAN IPv4
- 외부 관리웹 포트 (기본 8080)
- 경로를 제외한 백엔드 API 원점 (예: `http://<백엔드 LAN IP>:3100`)
- 전체 이미지 저장소 (`hub.crefle.com/mes/front`)

입력값과 Compose 구성을 검증한 뒤 이미지를 pull하고 `.env`와 `compose.yaml`을 권한 600으로
생성해 서비스를 기동한다. 설치 완료 후 `http://<서버 LAN IP>:<관리웹 포트>`로 접속한다.
브라우저의 `/api` 요청은 컨테이너가 입력한 백엔드 원점으로 전달하므로 별도 CORS 설정이 필요 없다.

### 현장 서버 수동 재배포

새 릴리스는 먼저 release tag로 빌드·push되어 있어야 한다. 이후 배포 디렉터리에서 설치
스크립트를 다시 실행하고 새 버전을 입력한다. 기존 환경값은 입력 기본값으로 재사용된다.

```bash
cd /opt/services/omf-mes-front
./install-deploy.sh
```

자동화에서 비대화식으로 실행해야 한다면 모든 값을 옵션으로 전달한다.

```bash
./install-deploy.sh \
  --non-interactive \
  --version web-v1.2.3 \
  --bind-ip <LAN-IP> \
  --port <관리웹-포트> \
  --api-upstream <백엔드-원점> \
  --image-repository hub.crefle.com/mes/front
```

롤백도 같은 스크립트를 다시 실행하고 이전 정식 버전을 입력한다. `stable`은 이동하는 태그라
설치·롤백 버전으로 받지 않는다. 이미지 pull에 실패하면 현재 설정을 바꾸지 않는다. 기동 또는
헬스 체크 실패 시에는 자동 롤백하지 않으므로 `.previous` 설정을 확인하고 이전 버전으로 다시 실행한다.

### 구성 의도

| 결정                              | 이유                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **정적 번들·Nginx가 같은 이미지** | 별도 웹 서버 설치 없이 이미지 하나로 SPA, 정적 자산 캐시와 healthcheck를 제공한다                            |
| **동일 출처 `/api` 프록시**       | 백엔드 주소를 브라우저에 노출하지 않고 세션 쿠키와 CORS 문제를 피한다                                        |
| **정식 웹 버전 tag만 배포**       | 재현 가능한 설치·롤백을 위해 `web-vMAJOR.MINOR.PATCH`만 받고, 추적용 불변 `sha-xxxxxxx` 태그도 함께 게시한다 |
| **고객 서버는 공개 pull**         | 이미지 push 자격증명은 GitHub Actions에만 두고 현장 서버에는 Registry 비밀을 저장하지 않는다                 |
| **Compose 파일을 설치 시 생성**   | 고객사별 LAN IP, 포트와 백엔드 원점을 저장소에 고정하지 않는다                                               |

### 아직 안 된 것 (인프라 확정 후)

- **오프라인 설치 패키지** — Registry에 접근할 수 없는 현장은 `docker save` 이미지 반입 절차가 필요하다
- **리버스 프록시·TLS** — 현재는 LAN IP와 HTTP 포트로 직접 접속한다
- **자동 롤백·이중화** — 헬스 체크 실패 진단과 수동 재실행만 제공하며 고가용성 구성은 포함하지 않는다

## 작업 규칙

`main` 직접 push는 차단돼 있다 — 팀 전용 워크트리와 브랜치에서 작업하고 PR로 병합한다. 업무 규칙과 절차의 정본은 `docs/client-dev-workflow/multi-agent-team-workflow-v3.md`다. 루트의 `AGENTS.md`와 `CLAUDE.md`는 부트스트랩으로 만드는 개인별 로컬 파일이며 커밋하지 않는다.
