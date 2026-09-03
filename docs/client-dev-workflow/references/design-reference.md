# 설계 자료 고정과 변경 수신

설계 결과물은 개발 목표의 정본이다. 동시에, 진행 중인 업무가 바라보는 설계 버전은 고정되어야 한다.

## 격리 클론

팀 전용 워크트리 아래 `.client-dev/design/omf-mes/`에 설계 저장소를 별도로 클론한다. 다른 팀이나 설계팀이 사용하는 로컬 체크아웃을 직접 읽지 않는다.

`.client-dev/` 전체는 gitignore 대상이다. 비공개 설계 파일이나 요청서 원문이 공개 저장소에 포함되지 않도록 커밋 전 `git status`를 확인한다.

## 최초 고정

팀 환경을 처음 만들 때만 기본 브랜치를 클론하고 현재 HEAD를 고정한다.

```bash
gh repo clone CREFLEINC/omf-mes .client-dev/design/omf-mes -- --single-branch --branch main
pnpm workflow init --team <N> --issue <이슈번호> --design-ref .client-dev/design/omf-mes
```

고정 정보는 `.client-dev/state.json`에 기록된다. 공개 이슈와 PR에는 전체 설계 내용을 옮기지 않고 필요한 경우 커밋이나 문서 경로만 포인터로 남긴다.

## 평상시 금지

- 작업 착수마다 `fetch`, `pull`, `reset`으로 최신화하지 않는다.
- 공지 없이 다른 브랜치나 커밋으로 이동하지 않는다.
- 설계 클론에 커밋·푸시하지 않는다.
- 설계 본문·와이어프레임·화면 캡처를 클라이언트 저장소로 복사하지 않는다.

`pnpm workflow:check`는 설계 클론 HEAD가 고정 커밋과 다르면 실패한다.

## 설계 변동 공지를 받았을 때만 갱신

공지가 지정한 커밋을 가져오고 정확히 체크아웃한다. 공지에 없는 최신 커밋까지 따라가지 않는다.

```bash
git -C .client-dev/design/omf-mes fetch origin <공지커밋>
git -C .client-dev/design/omf-mes checkout --detach <공지커밋>
pnpm workflow accept-design-change \
  --notice-ref <설계저장소-공통공지-URL|CREFLEINC/omf-mes#번호> \
  --commit <공지전체커밋> \
  --design-ref .client-dev/design/omf-mes
pnpm workflow:check
```

공통 공지는 백엔드·클라이언트를 구분하지 않아야 한다. 공지 원본을 개발팀 저장소에 재발행하지 않고 설계 저장소의 정본 참조만 로컬 상태에 기록한다. 클라이언트·백엔드 저장소의 팀별 이슈는 `--notice-ref`로 사용할 수 없다.

그 뒤 변경 지점을 직접 분석하고 현재 계획·구조 설계·코드·테스트 영향 범위를 전면 재검토한다. 결과는 `.github/ISSUE_TEMPLATE/design-change-impact-review.yml`을 이용해 별도 클라이언트 영향 검토로 기록한다. 공지 자체에는 변경 상세가 없어야 하며, 자세한 판단은 지정 버전의 자료에서 수행한다.

## 설계가 불완전하거나 개선이 필요할 때

현재 고정 버전을 임의 해석해 바꾸거나 설계팀에 직접 묻지 않는다. [design-request.md](design-request.md)에 따라 요청서를 사용자에게 전달하고, 고정된 설계를 기준으로 가능한 업무를 계속한다.
