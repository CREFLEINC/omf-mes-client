# 클라이언트 개발 4팀 워크플로

「Multi Development Agent Coding Teams 운영 규칙」의 **개발팀(§2) · 클라이언트 개발팀(§3)** 절을 이 저장소에서 실행 가능한 절차로 옮긴 것이다. 정책 정본은 저장소 밖에 있다 — 이 문서는 그 결정을 실행하는 자리이며, 정책 조항 자체를 바꾸지 않는다.

**우리는 클라이언트 개발 4팀(`Agent : T4`)이다.** 설계팀(`CREFLEINC/omf-mes`)의 자료는 **참고만** 한다 — 업무 배정·검토 요청 처리·설계 정합성 판정은 설계팀의 일이며 이 문서가 대신하지 않는다.

**코드 작성 규칙은 `crefle-agent-skills:coding-rules`가 정본이다.** 이 문서는 그 내용을 복제하지 않는다.

## 이 문서와 `.claude/`의 관계

**이 문서(`docs/client-dev-workflow/`)가 정본이다.** 이슈 착수부터 병합·완료 보고까지 지켜야 할 규칙은 여기 전부 적혀 있고, `main`에 커밋된다 — 사람이든 Agent든 이 저장소에서 개발 업무를 진행하는 누구나 같은 규칙을 본다.

**`.claude/`(스킬·에이전트·설정)는 개인 도구다.** 이 문서를 실제로 어떻게 따를지 — 어떤 Skill을 만들지, 어떤 Agent를 두는지, 아니면 그때그때 수동으로 절차를 읽어 가며 진행할지 — 는 각자 자유다. `.claude/`는 통째로 `.gitignore` 대상이라 이 저장소에 공유되지 않는다. 새로 합류하는 사람은 이 문서만 읽고 시작하면 되고, 자기 `.claude/`를 이 문서에 맞춰 구성하되 남과 똑같이 맞출 필요는 없다.

`.claude/team.local`(팀 식별 마커)·`.claude/_workspace/`(작업 산출물)·`.claude/_designref/`(설계 저장소 참조 클론) 같은 경로 이름이 아래에 나오는 것은 **참고 관례**이지 강제가 아니다 — 다른 이름·다른 위치를 써도 이 문서의 규칙(예: 설계 참조는 격리된 클론에서만 읽는다)만 지키면 된다.

## 절대 하지 않는 것 (운영 규칙 §2-4)

- **다른 개발팀(T1~T3)과 직접 소통하지 않는다.** 필요한 소통은 전부 설계팀과 한다. 순서·충돌 문제는 [merge-rules.md](references/merge-rules.md)로 자체 해소한다.
- **배정되지 않은 이슈에 손대지 않는다.** 라벨(`Agent : T4`)이 없는 이슈는 우리 일이 아니다.
- **설계 결정을 우리가 바꾸지 않는다.** 바뀌어야 한다고 판단되면 [review-request.md](references/review-request.md)로 설계팀에 검토를 요청한다.
- **설계 저장소 자료 본문을 이 저장소로 옮기지 않는다.** [design-reference.md](references/design-reference.md) 열람 경계.

## 우리가 정하는 것 (운영 규칙 §2-4.4)

코드 수준 설계 · 배정된 이슈의 처리 순서 · 검증 방법과 수준 · 작업 슬라이스 분할 · 브랜치·커밋 단위. 이 넷은 설계팀 승인 없이 우리가 정한다.

## 언제 이 절차를 따르는가

이슈 착수 · 코드 작성/변경/삭제 · 테스트 판정 — 규모와 상관없이. 신규 기능·화면·컴포넌트 개발, 기존 기능 변경, 버그·오류 수정, 리팩터링, 테스트 추가·수정이 전부 해당한다. "다음 이슈 진행", "재개", "검토 요청 답 왔는지 확인", "계획대로 실행", "이어서" 같은 후속 요청에도 그대로 적용한다.

해당하지 않는 것 — 코드 변경이 없는 질문형 요청(개념 설명·파일 위치 조회·실행 방법 안내·기술 선택 이유), 번호·URL로 지정된 GitHub PR 리뷰(`pr-review` 소관), 코딩 컨벤션·커밋 메시지 규칙 질의(`coding-rules` 소관).

## 실행 흐름

### Phase 0 — 착수 전 확인 (운영 규칙 §2-5.5, 새 이슈마다 매번)

1. **팀 식별** — 팀 식별 마커(예: `.claude/team.local`) 확인. 없으면 추측하지 않고 사용자에게 물어 만든다([issue-lifecycle.md](references/issue-lifecycle.md))
2. **저장소 상태** — 현재 워크트리·브랜치·`git status`(미커밋 변경). 미커밋 변경이 이번 작업과 분리 불가능하면 중단하고 보고한다
3. **배정 변동 확인** — `gh issue list --repo CREFLEINC/omf-mes-client --label "Agent : T4" --state open`
4. **검토 요청 처리 상황 확인** — [review-request.md](references/review-request.md) 「처리 상황 추적」
5. **설계 참조 최신화** — [design-reference.md](references/design-reference.md)의 클론을 `main` 최신으로 맞춘다

### Phase 1 — 우선순위 (운영 규칙 §2-5.1)

배정된 이슈들을 의존성·개발 복잡도로 정렬한다. ⛔ 변경 통지(`uiux→client` 라벨 + 제목 ⛔)가 있으면 최우선 — 이미 만든 것이 틀린다는 뜻이다. 공용 파일([merge-rules.md](references/merge-rules.md) 「접촉이 몰리는 파일」)을 크게 건드리는 이슈 여러 개를 동시에 진행하지 않는다.

배정된 이슈가 이 저장소에 없는 선행 인프라(예: 아직 없는 앱 셸)를 요구해 슬라이스로 진행할 수 없으면, 그 사실을 이슈에 남기고 다른 착수 가능 이슈로 우선순위를 재조정한다 — 설계 확인 대기와는 다른 사유이므로 검토 요청을 올릴 필요는 없다.

### Phase 2 — 착수 표시 (운영 규칙 §2-5.2)

[issue-lifecycle.md](references/issue-lifecycle.md) 「착수 절차」 — 라벨(`Agent : T4` + `Agent : Client` + `in progress`) + assignee + 워크트리·브랜치 + 착수 코멘트.

### Phase 3 — 설계 근거 확인

[design-reference.md](references/design-reference.md)의 참조 클론에서만 읽는다. 확인 시점(HEAD 커밋)을 계획에 남긴다. 스펙↔계약 어긋남이나 미결 처리 방법 미기재를 만나면 혼자 정하지 말고 Phase 6-B로 간다.

### Phase 4 — 검증 수준 판정 + 계획

[verification-levels.md](references/verification-levels.md)로 수준(중요/보통/낮음)을 판정한다. [templates/plan.md](templates/plan.md) 양식으로 계획을 작성한다.

- **중요**: 계획 전문을 사용자에게 보고하고 **승인을 받은 뒤** 진행한다
- **보통·낮음**: 계획을 보고하되 대기 없이 진행한다

요구사항이 둘 이상으로 해석되고 결과 차이가 크면 여기서 사용자에게 되묻는다 — 추측으로 진행하지 않는다.

### Phase 5 — 구현

1. **변경 전 기준 상태를 기록**한다([verification-levels.md](references/verification-levels.md))
2. `crefle-agent-skills:coding-rules`를 호출해 코드 작성 규칙을 따른다
3. 계획의 슬라이스 단위로 구현하고 자체 검증(해당 수준의 빠른 게이트)
4. 구현 초회 커밋 완료 시 전체 게이트 1회

### Phase 6-A — 독립 검증

[verification-levels.md](references/verification-levels.md) 수준별 배정에 따라 **작성자 본인이 아닌 독립된 검증**을 거친다(중요·보통) — 별도 세션·다른 사람·리뷰 전용 Agent 등 실제로 구현자와 분리된 시점·시각으로 보는 것이면 방식은 자유다. 문제가 반환되면 구현으로 돌아가 수정하고, 빠른 게이트(승격 조건 확인)로 재검증한다. 같은 문제가 두 회차 연속 해소되지 않으면 사용자에게 상황과 대안을 보고한다.

### Phase 6-B — 막혔을 때 (운영 규칙 §2-5.4)

설계 확인이 필요해 진행할 수 없으면:

1. [issue-lifecycle.md](references/issue-lifecycle.md) 「보류 절차」 — `in progress` 제거 → `help wanted` 추가
2. [review-request.md](references/review-request.md)로 설계 저장소에 `[검토 요청]` 등록
3. 클라이언트 이슈에 보류 사유 + 요청 번호 코멘트
4. [merge-rules.md](references/merge-rules.md) 「선착순」 절차로 워크트리를 분리해 다른 이슈로 전환(브랜치만 갈아타지 않는다)

### Phase 7 — PR·병합

[merge-rules.md](references/merge-rules.md) — 슬라이스 상한 · 등록 직전 rebase · 충돌 해소(생성물은 재생성만) · 선착순. 개발 완료 후 PR을 올리면 `crefle-agent-skills:pr-review`로 최종 검증한다. 그 결과 병합되지 못하고 개선 사항이 확인되면 개선 후 다시 PR을 올리고 재검증받는다.

### Phase 8 — 완료 (운영 규칙 §2-5.3)

[issue-lifecycle.md](references/issue-lifecycle.md) 「완료 절차」 — `in progress` 제거 + 이슈 닫기 + [templates/completion-report.md](templates/completion-report.md) 양식의 완료 보고 코멘트. `uiux→client` 착수 이슈였다면 미결 처리 결과·어긋남을 같은 코멘트에 포함한다(`docs/uiux-handoff.md` §6).

## 산출물

작업 계획·검증 기록 같은 개인 작업 산출물은 저장소에 커밋하지 않는다 — 설계 참조 내용이 섞일 수 있어 공개 저장소에 올리면 사고다. 어디에 어떻게 두는지는 자유이며, `.claude/_workspace/<작업슬러그>/`(플랫폼 컨벤션상 통째로 gitignore 대상인 `.claude/` 아래)에 두는 것을 예시로 든다.

## 에러 처리

| 상황 | 처리 |
| --- | --- |
| 미커밋 변경과 분리 불가 | 즉시 중단해 보고한다. 덮어쓰거나 stash하지 않는다 |
| 요구사항 해석이 갈림 | 중단하고 해석 후보와 결과 차이를 제시해 사용자에게 묻는다 |
| 독립 검증을 구할 수 없음 | 완료로 선언하지 않는다. 수행/미수행 검증을 구분해 보고한다 |
| 계획과 실제 변경이 어긋남 | 승인 없이 통과시키지 않는다. 차이와 판단 요청을 보고한다 |
| GitHub 인증 실패(`gh auth status`) | 담당자 지정 없이 착수하지 않는다. 중단하고 보고한다 |
| 라벨이 저장소에 없음 | 승인 후 생성한다([issue-lifecycle.md](references/issue-lifecycle.md) 「라벨 신설」). 생성 실패를 완료로 넘기지 않는다 |
| 배정된 이슈가 이 저장소에 없는 선행 인프라를 요구함 | Phase 1로 돌아가 우선순위를 재조정한다. 검토 요청 대상이 아니다(설계 확인이 아니라 클라이언트 쪽 순서 문제) |

## 승인 없이 하지 않는 것

신규 외부 의존성 추가 · 의존성 주요 버전 변경 · 공개 인터페이스·API 계약 변경 · 인증·권한·개인정보 변경 · 빌드·배포 파이프라인 변경 · 대규모 삭제·마이그레이션 · GitHub 라벨 신설.

**이 저장소는 공개 저장소다.** 비공개 설계 문서의 본문, 고객사 식별 정보, 실 운영 값, 인프라 정보가 코드·주석·커밋 메시지·PR 본문·이슈에 들어가려 하면 중단하고 대체 방법을 찾는다(`CLAUDE.md`).
