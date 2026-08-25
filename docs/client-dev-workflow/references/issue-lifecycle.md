# 이슈 라이프사이클 — 라벨 상태기계와 `gh` 명령

운영 규칙 §2-1·§2-5의 실행 절차다. 이슈 라벨은 **누가**(어떤 개발팀이 담당하느냐) · **상태**가 어떤지를 나타낸다.

## 팀 식별 — 로컬 마커

- 경로: `.claude/team.local` (git 미추적)
- 내용 한 줄: `Agent : T4`
- **파일이 있으면** 그 값을 쓴다. 재질문하지 않는다.
- **파일이 없으면 추측하지 않는다.** `gh label list --repo CREFLEINC/omf-mes-client`로 기존 팀 라벨을 보여주고 사용자에게 묻는다. 답을 받으면 파일을 만든다.
- ⚠ 루트 저장소가 아니라 **각자의 워크트리/체크아웃**에만 둔다 — 워크트리 설정은 루트 → 하위 방향으로만 새므로, 루트에 두면 다른 팀 워크스페이스까지 오염된다.

## 라벨 두 종류 — 담당(Agent : T4) + 유형(Agent : Client)

운영 규칙 §2-1은 **담당 라벨**(어떤 팀)과 **유형 라벨**(어떤 개발 영역)을 함께 요구한다. 이 저장소는 클라이언트 전용이라 유형 라벨이 중복으로 보이지만, 규칙 문면을 그대로 따른다 — `Agent : T4` + `Agent : Client` 둘 다 붙인다. 라벨이 저장소에 없으면 만든다(승인 절차는 [라벨 신설](#라벨-신설-승인-필요) 참조).

## 상태기계

| 상태 | 라벨 | 전이 시점 |
| --- | --- | --- |
| 배정됨 | `Agent : T4` + `Agent : Client` | 설계팀 또는 사용자가 붙인다 — **우리가 임의로 배정하지 않는다**(규칙 §1-1) |
| 착수 | 위 + `in progress` + assignee `@me` | SKILL Phase 2 |
| 보류 | `in progress` **제거** → `help wanted` **추가** | 설계팀 확인이 필요해 멈출 때(SKILL Phase 6-B) |
| 재개 | `help wanted` 제거 → `in progress` 복원 | 검토 요청에 답이 왔을 때 |
| 완료 | `in progress` 제거 + 이슈 닫기 + 완료 보고 코멘트 | SKILL Phase 8 |

`ready`·`uiux→client`는 설계팀이 「착수 가능」 표시로 쓰는 전용 라벨이다 — 건드리지 않는다.

## 담당자(assignee) — 매번 동적으로 조회

고정 계정을 하드코딩하지 않는다. 착수 시점에 실제로 인증돼 있는 계정을 쓴다.

```bash
gh auth status --hostname github.com   # 미인증이면 중단하고 사용자에게 보고 — 담당자 없는 착수는 다른 팀과 혼선 위험
gh issue edit <이슈번호> --add-assignee @me --repo CREFLEINC/omf-mes-client
```

## 착수 절차 (요약)

```bash
# 1. 팀 라벨 확인 — 위 「팀 식별」
# 2. 라벨 부착 (이미 배정돼 있으면 생략)
gh issue edit <N> --add-label "Agent : T4" --add-label "Agent : Client" --repo CREFLEINC/omf-mes-client
# 3. 착수 표시
gh issue edit <N> --add-label "in progress" --add-assignee @me --repo CREFLEINC/omf-mes-client
# 4. 착수 코멘트 — 브랜치명과 착수일 (uiux→client 이슈는 docs/uiux-handoff.md §6 응답 규약)
gh issue comment <N> --repo CREFLEINC/omf-mes-client --body "착수: <브랜치명> (<날짜>)"
```

## 보류 절차

```bash
gh issue edit <N> --remove-label "in progress" --add-label "help wanted" --repo CREFLEINC/omf-mes-client
gh issue comment <N> --repo CREFLEINC/omf-mes-client --body "보류 — [검토 요청] omf-mes#<번호> 대기 중. <무엇을 왜 기다리는지 한 줄>"
```

## 완료 절차

```bash
gh issue edit <N> --remove-label "in progress" --repo CREFLEINC/omf-mes-client
gh issue comment <N> --repo CREFLEINC/omf-mes-client --body-file <완료 보고 본문 파일>   # templates/completion-report.md 양식
gh issue close <N> --repo CREFLEINC/omf-mes-client
```

## 라벨 신설 (승인 필요)

라벨 생성은 되돌리기 쉬운 저장소 메타데이터지만, 이 저장소를 쓰는 다른 팀 모두에게 보이는 공유 자원이라 **사용자 승인 후** 만든다.

```bash
gh label list --repo <저장소>   # 기존 색상과 겹치지 않는 hex 확인 후
gh label create "Agent : Client" --repo <저장소> --color <hex>
```

생성 권한이 없어 실패하면 추측으로 진행하지 않고 중단해 보고한다. 생성 직후 `gh label list`로 재확인한다 — 생성 실패를 완료로 넘기지 않는다.

## 착수 전 매번 확인할 것 (규칙 §2-5.5)

새 이슈를 착수하기 전에는 **항상**:

1. **배정 변동 사항** — `gh issue list --repo CREFLEINC/omf-mes-client --label "Agent : T4" --state open`
2. **검토 요청 처리 상황** — [review-request.md](review-request.md)의 추적 확인 절차
