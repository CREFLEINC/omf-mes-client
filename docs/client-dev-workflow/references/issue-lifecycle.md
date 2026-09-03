# 이슈 라이프사이클

이슈는 팀 간 직접 조율을 대신하는 공개 업무판이다. 담당 팀과 현재 상태를 누구나 확인할 수 있어야 한다.

## 팀 식별

팀 번호는 추적 문서에 하드코딩하지 않고 `.client-dev/state.json`에서 읽는다.

```bash
pnpm workflow:check
```

상태 파일이 없으면 사용자에게 배정받은 팀 번호를 확인한 뒤 `pnpm workflow init`으로 만든다. 팀 번호를 추측하지 않는다.

## 작업 선택

각 팀은 자신의 업무를 스스로 선택한다. 설계팀이나 다른 개발팀이 업무를 배정하거나, 개발팀이 다른 팀의 담당을 임의로 바꾸지 않는다.

사용자가 직접 요청한 작업에 이슈가 없으면 공개 가능한 제목과 요약으로 클라이언트 저장소에 이슈를 만든다. 비공개 설계 내용은 적지 않는다.

## 상태

| 상태                       | 표시                                       |
| -------------------------- | ------------------------------------------ |
| 선택                       | `Agent : T{번호}` + `Agent : Client`       |
| 진행                       | 위 라벨 + `in progress` + 담당자           |
| 외부 회신 때문에 실제 중단 | `in progress` 제거 + `help wanted`         |
| 완료                       | 완료 보고 + `in progress` 제거 + 이슈 닫기 |

착수 예:

```bash
gh issue edit <번호> \
  --repo CREFLEINC/omf-mes-client \
  --add-label "Agent : T<번호>" \
  --add-label "Agent : Client" \
  --add-label "in progress" \
  --add-assignee @me
pnpm workflow set-issue --issue <번호>
pnpm workflow:check
```

팀 라벨이 없으면 현재 라벨 목록을 확인하고 사용자 요청으로 확정된 팀 번호만 생성한다.

## 정보 요청·설계 개선 추적

요청서를 사용자에게 전달한 시점에는 이슈를 자동 생성하지 않는다. 사용자가 **전달 완료 및 회신 대기**를 지시한 뒤에만 `.github/ISSUE_TEMPLATE/design-request-tracking.yml`로 추적 이슈를 만든다.

추적 이슈는 공개 저장소에 있으므로 요청서 본문을 복사하지 않는다. 요청 종류, 대상 포인터, 전달일, 관련 작업 이슈만 기록한다. 사용자가 답변서를 돌려주면 반영 결과를 기록하고 추적 이슈를 닫는다.

## 설계 변동 영향 검토

설계 변동 공지 원본은 백엔드·클라이언트를 구분하지 않는 공통 채널에 있어야 하며, 형식·작성·발행은 설계팀이 담당한다. 클라이언트 저장소에는 공지나 영향 검토 이슈 템플릿을 만들지 않는다. 공통 공지 포인터와 클라이언트 영향 검토 결과는 현재 작업 이슈에 남기고, 비공개 분석은 로컬 계획에 기록한다.

과거 `uiux→client`, `ready` 라벨은 신규 업무의 착수·승인·공지 채널로 사용하지 않는다. 기존 이력에 붙은 라벨은 기록 보존 대상으로만 취급한다.

## 완료

PR 병합과 검증이 끝나면:

```bash
gh issue comment <번호> --repo CREFLEINC/omf-mes-client --body-file <완료보고파일>
gh issue edit <번호> --repo CREFLEINC/omf-mes-client --remove-label "in progress"
gh issue close <번호> --repo CREFLEINC/omf-mes-client
pnpm workflow clear-issue
```

다음 업무를 즉시 시작한다면 `clear-issue` 대신 `set-issue`로 새 번호를 기록한다.
