---
name: agent-development-orchestrator
description: 이 저장소에서 코드·테스트·개발 문서를 작성·수정·삭제하거나, 직전 개발 결과를 수정·보완·재실행·재검증할 때 사용하는 Codex 개발 파이프라인이다. 신규 기능, 버그 수정, 리팩터링, 테스트 변경, 개발 문서 변경에 사용한다. 코드 변경 없는 개념 설명, 위치·개수·브랜치·상태 조회, 실행 방법 안내 같은 읽기 전용 질문에는 사용하지 않는다.
---

# Codex 개발 오케스트레이터

이 파일은 Codex 도구와 역할을 기존 Claude 하네스에 연결하는 얇은 어댑터다. 정책 정본은 다음 파일이며, 절차나 판정 기준을 이 파일에 복제하지 않는다.

- `CLAUDE.md`: 공개 저장소 경계와 저장소 규칙
- `.claude/skills/agent-development-orchestrator/SKILL.md`: 실행 흐름과 산출물 규약
- `.claude/skills/agent-development-orchestrator/references/`: 운영·위험·분할·검증 정책
- `.claude/agents/development-{planner,implementer,verifier}.md`: 역할별 책임
- `crefle-agent-skills:coding-rules`: 작성 규칙
- `crefle-agent-skills:pr-review`: 독립 리뷰 기준

## 시작과 계획 추적

1. 위 정본과 현재 `AGENTS.md`를 읽고 `git status`, 브랜치, 기존 변경을 확인한다. 현재 worktree 밖은 수정하지 않는다.
2. GitHub 이슈 착수 작업이면 `.claude/team.local`과 `docs/multi-team-workflow.md`를 먼저 적용한다.
3. 요청마다 kebab-case 작업 슬러그를 정하고 산출물을 `.claude/_workspace/<slug>/`에 둔다. 기존 회차가 있으면 정본의 회차 규약을 따른다.
4. 작업이 둘 이상의 단계라면 `update_plan`으로 상태를 추적한다. 서브 Agent에게 메인 세션의 계획 상태 갱신을 맡기지 않는다.
5. 위험도·승인·기준 상태·검증 범위는 정본에서 판정한다. 필요한 사용자 승인을 받기 전에는 구현하지 않는다.

## Codex 역할 선택과 권한 가드

부모 세션이 전체 흐름과 외부 권한을 소유한다. 런타임의 `spawn_agent`에 custom Agent selector가 실제로 노출되면 `.codex/agents/*.toml`의 정확한 `name`(`development-planner` 등)으로 역할을 선택한다. `task_name`은 협업 작업의 식별자일 뿐 custom role selector로 간주하지 않는다.

selector가 없거나 custom 역할 적용 여부를 확인할 수 없으면 generic Agent의 프롬프트 첫머리에 역할 정의를 읽고 채택하게 한다.

- planner·implementer·verifier: `.codex/agents/<role>.toml`과 `.claude/agents/<role>.md`
- reviewer: `.codex/agents/development-reviewer.toml`, 기존 오케스트레이터의 「독립 리뷰」 절, `crefle-agent-skills:pr-review`

fallback을 썼다는 사실과 TOML의 권한 제한이 강제되지 않았을 수 있다는 사실을 해당 회차 보고서에 남긴다. `sandbox_mode`는 custom Agent의 기본값일 뿐이며, subagent에는 부모 세션의 live sandbox·approval override가 다시 적용되어 더 넓어질 수 있다. 부모는 호출 직전에 active permission을 확인한다. custom/fallback 여부와 무관하게 planner와 reviewer 같은 read-only 역할은 권한이 더 넓거나 확인 불가하면 부모가 만든 격리 detached worktree, 시작·종료 `git status`와 HEAD 대조로 보완한다. 특히 fallback은 이 가드 없이는 금지한다. 정확한 격리를 만들거나 확인할 수 없으면 Agent를 spawn하지 말고 사용자에게 보고한다.

## Codex 역할 파이프라인

각 반환은 `wait_agent`로 수집한다.

1. **계획**: 중간·높은 위험이면 `development-planner`를 호출한다. planner는 파일을 수정하지 않고 계획 전문을 부모에게 반환하며, 부모가 `.claude/_workspace/<slug>/01_plan.md`에 기록해 사용자에게 승인받는다. read-only 기본값과 active permission은 위 가드로 별도 확인한다.
2. **실행**: 승인되거나 보고된 계획과 변경 전 기준 상태를 `development-implementer`에게 전달한다. implementer는 `coding-rules`를 적용하고 구현·자체 검증·`02_execution*.md`를 완료한다.
3. **독립 검증과 리뷰 준비**: 부모가 검토할 `target-commit`을 고정한다. verifier가 쓰는 트리와 공유하지 않는 `<review-path>`에 `git worktree add --detach <review-path> <target-commit>`을 실행한다. 생성 실패 시 병렬 리뷰를 시작하지 않는다.
4. **격리 확인과 병렬 실행**: 부모가 `<review-path>`에서 `git status --short --branch`와 `git rev-parse HEAD`로 clean detached 상태와 정확한 commit을 먼저 확인한다. 확인이 실패하면 reviewer를 spawn하지 않는다. reviewer에게 절대경로와 `target-commit`을 전달한 뒤 verifier와 reviewer를 기다림 없이 각각 `spawn_agent`하여 독립 병렬 실행한다. reviewer도 첫 검사로 같은 status·HEAD를 다시 확인하며, 실패하면 리뷰를 진행하지 않는다. 정본의 분담·포트 규칙을 지키고 서로의 보고서를 선행 입력으로 주지 않는다.
5. **리뷰 격리 해제**: reviewer는 끝날 때 같은 status·HEAD 검사를 반복한다. clean과 commit 불변을 확인한 뒤 부모가 `git worktree remove <review-path>`를 실행한다. 종료 검사나 제거가 실패하면 병렬 리뷰를 완료로 처리하지 않고 사용자에게 보고한다.
6. **수정**: 두 결과를 모아 중복을 합치고 출처와 재현 방법을 보존한다. 새 implementer를 만들지 말고 `followup_task`로 기존 implementer에게 수정과 자체 검증을 요청한다.
7. **재검증**: 제품 파일이 바뀌었으면 기존 verifier와 reviewer에 각각 `followup_task`를 보내 재확인한다. 매 reviewer 재개 전에 부모가 새 `target-commit`을 고정하고 이전 경로와 다른 새 detached `<review-path>`를 생성·사전 확인한다. 이전 review-path는 제거된 것으로 간주하며 절대 재사용하거나 추론하지 않는다. reviewer에게 보내는 매 `followup_task` 메시지에는 그 회차의 새 review-path **절대경로**와 새 target commit을 필수 입력으로 명시한다. 둘 중 하나라도 누락됐거나 reviewer의 첫 `git status --short --branch`·`git rev-parse HEAD` 결과가 dirty·commit 불일치면 재리뷰를 시작하지 않고 부모에게 즉시 반환한다. 종료 때도 같은 status·HEAD로 clean과 commit 불변을 확인하고, 부모가 그 회차 경로를 제거한다. 가능하면 verifier와 병렬로 재개하고, 전체 완료 조건과 Blocker/Major 0을 충족할 때까지 반복한다.
8. **통신**: 실행 중인 Agent에게 새 작업을 시작시키지 않는 질문·상태 전달은 `send_message`를 사용한다. 작업을 실제로 재개해야 할 때만 `followup_task`를 사용한다.

planner와 reviewer는 행동 규칙상 파일을 수정하지 않는다. 두 역할이 반환한 보고서 전문은 부모가 각각 `01_plan*.md`, `05_review*.md`에 기록한다. TOML의 read-only sandbox만으로 이를 절대 강제한다고 가정하지 않는다. verifier는 보고서를 직접 기록할 수 있지만 제품 소스를 영구 수정해서는 안 된다.

## 산출물과 완료

- 산출물 이름과 회차 규약은 `.claude/skills/agent-development-orchestrator/SKILL.md`의 「산출물 배치」를 그대로 따른다.
- Agent 호출·반환과 각 보고서의 시작·종료 시각을 기록한다.
- 검증·리뷰 지적에는 재현 방법, 기대 결과, 파일 위치를 포함한다.
- 오류나 응답 없음은 정본의 재시도·냉각·중단 규칙으로 처리한다. 단계를 생략한 채 완료로 선언하지 않는다.
- 외부 상태 변경, 파괴적 작업, 신규 의존성, 범위 확대는 기존 승인 경계를 넘지 않는다.

## 동작 시나리오

**정상 흐름**: 중간 위험 변경 접수 → `update_plan` → planner 계획 전문 반환 → 부모가 `01_plan.md` 기록·승인 → implementer 구현과 `02_execution.md` → target commit 고정과 reviewer detached worktree 격리 → verifier와 reviewer 병렬 실행 → verifier가 배정 검증을 모두 수행하고 신규 실패가 없는 허용 판정(`통과` 또는 근거가 있는 `작업 결과 통과, 기존 실패 존재`) → reviewer Blocker/Major 0 → reviewer worktree clean·제거 확인 → 최종 게이트 통과 → 완료 조건 보고.

**오류 흐름**: verifier가 실패를 재현하고 reviewer가 Major를 발견 → 부모가 두 지적을 통합 → `followup_task`로 기존 implementer 수정 → 같은 verifier와 reviewer를 재개해 병렬 재확인 → 미해소면 반복하거나 정본의 중단 조건에 따라 사용자에게 보고. Agent 호출 실패는 정본의 재시도 한도를 적용하며 검증을 건너뛰지 않는다.
