# 클라이언트 개발팀 워크플로

이 디렉터리는 저장소 밖의 협업 규칙을 실행 가능한 개발 절차로 옮긴 정본이다. 특정 팀 번호나 특정 에이전트 제품에 종속되지 않는다.

## 목표

- 설계 결과를 제품 요구사항의 기준으로 삼는다.
- 팀 간 의존성과 직접 소통을 최소화한다.
- 이슈 라벨로 담당과 진행 상태를 투명하게 공개한다.
- 작업 도중 설계 자료가 조용히 바뀌지 않도록 커밋으로 고정한다.

## 최초 1회: 팀 환경 초기화

팀별 전용 워크트리와 브랜치를 만든 뒤, 격리된 설계 참조 클론을 준비한다. 기존 로컬 설계 체크아웃을 공유하지 않는다.

```bash
git worktree add -b <도구접두>/team<N>-<작업> <전용-워크트리> origin/main
gh repo clone CREFLEINC/omf-mes .client-dev/design/omf-mes -- --single-branch --branch main
pnpm workflow init --team <N> --issue <이슈번호> --design-ref .client-dev/design/omf-mes
pnpm workflow:check
```

`init`은 그 시점의 설계 커밋을 최초 기준으로 고정한다. `.client-dev/`는 gitignore 대상이며 비공개 설계 클론과 로컬 업무 상태를 저장한다.

## 작업 흐름

### 1. 작업 선택과 공개

각 팀은 사용자 요청과 공개 이슈를 바탕으로 본인 업무를 스스로 선택한다. 다른 팀에 업무를 배정하거나 재배정하지 않는다.

작업을 시작할 때 이 저장소의 이슈에 아래를 표시한다.

- 담당: `Agent : T{번호}`
- 유형: `Agent : Client`
- 상태: `in progress`
- 담당자: 현재 GitHub 사용자

사용자 요청에 대응하는 이슈가 없으면 공개 가능한 범위의 짧은 이슈를 먼저 만든다. 상세 설계나 고객 정보는 적지 않는다. 자세한 명령은 [issue-lifecycle.md](references/issue-lifecycle.md)를 따른다.

### 2. 착수 점검

매 작업과 재개 시점에 실행한다.

```bash
pnpm workflow:check
git status --short --branch
```

검사는 팀 번호, 활성 이슈, 전용 브랜치, 설계 고정 커밋과 참조 클론 HEAD의 일치를 확인한다. 실패를 우회하지 말고 상태를 바로잡는다.

### 3. 고정된 설계 분석과 계획

[design-reference.md](references/design-reference.md)에 따라 현재 고정 커밋만 읽는다. 업무 목표·영향 범위·완료 조건·검증 수준을 [templates/plan.md](templates/plan.md)에 맞춰 정한다. 코드 수준 설계, 구현 순서, 테스트 방법은 개발팀이 결정한다.

설계 자료에 개선점이나 누락이 있어도 현재 고정 설계를 기준으로 가능한 작업은 계속한다. 요청 절차는 아래 5절을 따른다.

### 4. 구현과 검증

작업 전 기준 상태를 기록하고 논리적으로 독립된 단위로 구현한다. 위험에 맞는 검증은 [verification-levels.md](references/verification-levels.md)를 따른다. API 계약·인증·데이터 손실·공용 경계 변경은 높은 수준으로 검증한다.

### 5. 정보 요청·설계 개선

설계팀이나 다른 개발팀에 직접 연락하지 않는다.

1. 요청 종류를 `정보 요청` 또는 `설계 개선`으로 정한다.
2. [templates/design-request.md](templates/design-request.md)로 요청서를 작성한다.
3. 사용자에게 전달을 부탁한다.
4. 현재 고정 설계를 기준으로 가능한 업무는 계속한다.
5. 사용자가 **전달 완료 및 회신 대기**를 지시한 경우에만 이 저장소에 추적 이슈를 만든다.
6. 사용자가 답변서를 전달하면 반영하고 추적 이슈를 닫는다.

요청서 원문은 로컬 산출물이며 공개 저장소에 커밋하지 않는다. 공개 추적 이슈에는 요청 종류·대상 포인터·전달일·상태만 적는다. 자세한 내용은 [design-request.md](references/design-request.md)를 따른다.

### 6. 설계 변동 공지

설계팀의 직접 통지는 모든 개발팀을 대상으로 한 **설계 변동 공지**만 수신한다. 백엔드·클라이언트별로 나뉜 공지는 정본으로 채택하지 않으며, 공지 원본을 이 저장소에 다시 만들거나 복사하지 않는다. 공지는 아래 네 항목만 담는다.

1. 공지 발행일
2. 배포 버전(설계 저장소 커밋)
3. 설계 자료 목록(경로와 그 시점의 파일 버전)
4. 이전 버전과 달라진 지점 — 상세 내용이 아니라 위치만

공지를 받으면:

1. 지정 커밋을 격리 클론에 가져와 정확히 체크아웃한다.
2. `pnpm workflow accept-design-change --notice-ref <설계저장소-공통공지-URL|CREFLEINC/omf-mes#번호> --commit <전체커밋> --design-ref .client-dev/design/omf-mes`로 기준을 갱신한다. 클라이언트·백엔드 저장소의 팀별 이슈는 공지 정본으로 사용할 수 없다.
3. `pnpm workflow:check`를 실행한다.
4. 진행 중인 업무의 계획·코드 설계·검증 계획을 전면 재검토한다.
5. `.github/ISSUE_TEMPLATE/design-change-impact-review.yml`로 공통 공지 포인터, 영향받는 클라이언트 이슈, 재검토 결과만 기록한다. 이 이슈는 공지 원본이 아니라 클라이언트 영향 검토 기록이다.

공지 없이 설계 참조 클론을 fetch/pull/reset해 최신화하지 않는다.

### 7. PR과 완료

[merge-rules.md](references/merge-rules.md)에 따라 최신 `origin/main`을 반영하고 관련 검증을 통과시킨 뒤 PR을 연다. PR 리뷰에서 발견된 문제를 수정하고 재검증한다.

병합 후 [templates/completion-report.md](templates/completion-report.md) 형식으로 이슈에 결과를 남기고 `in progress`를 제거한 뒤 닫는다. 다음 작업을 선택했다면 로컬 활성 이슈를 갱신한다.

## 승인 없이 범위를 넓히지 않는 항목

신규 외부 의존성, 공개 API·계약, 인증·권한·개인정보, 배포 파이프라인, 대규모 삭제·마이그레이션처럼 사용자 요청 범위를 실질적으로 넓히는 변경은 별도 승인을 받는다.

## 공개 저장소 경계

비공개 설계 본문·이미지, 고객사 식별 정보, 실 운영 데이터, 인프라 정보는 코드·테스트·커밋·PR·이슈에 넣지 않는다. 공개 기록은 화면 ID·문서 경로·버전·이슈 번호 같은 포인터로 제한한다.
