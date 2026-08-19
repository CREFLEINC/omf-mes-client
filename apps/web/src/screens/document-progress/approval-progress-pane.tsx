import { Button, EmptyState, SkeletonText, Stepper, type StepperItem } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { RequestProgressView, StepProgressView } from './approval-progress';
import { describeLoadError } from './load-error-banner';
import { isApprovalForbidden, isApprovalNotFound } from './queries';
import { toApiError } from '../../patterns/request';

const t = messages.documentProgress;

/**
 * 줄바꿈 없는 공백(U+00A0).
 *
 * **escape로 적고 `export`한다**(사본 체크리스트 6번). 원시 글자로 두면 저장소의 「비가시 공백
 * 정리」 한 번이 **제품과 시험을 함께 지나** `toVisibleLine`을 무동작으로 만드는데, 기대값이 같은
 * 글자를 다시 쓰고 있으면 감지기가 아무 말도 하지 않는다(자기참조). `export`는 시험이 이 값을
 * **문자열 리터럴이 아니라 상수로** 참조하게 하려는 것이다.
 */
export const NO_BREAK_SPACE = '\u00a0';

/**
 * 사유 한 줄을 **보이는 글자**로 만든다.
 *
 * 빈 줄과 들여쓴 줄은 HTML에서 접힌다 — 둘 다 「보이지 않게 되는」 자리라 글자를 세워
 * 상자가 높이를 갖게 한다.
 *
 * **줄 가운데·끝 공백은 바꾸지 않는다.** 축약돼도 읽는 데 지장이 없고, 전부 바꾸면 사용자가
 * 복사해 간 사유에 보통 공백이 하나도 남지 않는다.
 */
export const toVisibleLine = (line: string): string => {
  if (line === '') return NO_BREAK_SPACE;

  const indentLength = line.length - line.trimStart().length;

  return indentLength === 0 ? line : NO_BREAK_SPACE.repeat(indentLength) + line.slice(indentLength);
};

/**
 * 이 구획이 설 수 있는 다섯 갈래.
 *
 * | 갈래 | 근거 | 이 구획이 내는 것 |
 * | :-: | --- | --- |
 * | `notSubmitted` | 문서에 취소 요청 값이 **없다** | 「아직 취소 요청이 없습니다」 |
 * | `unusable` | 값은 있으나 조회 조각으로 쓸 수 없다 | 그 사실만 밝힌다 |
 * | `loading` | 승인 요청 조회 진행 중 | 뼈대 |
 * | `ready` | 승인 요청 상세가 200 | 요청 정보 · 사유 전문 · 세로 단계 |
 * | `failed` | **403 · 404 · 그 밖** 셋으로 다시 갈린다 | 구획 안 안내(**403에만 다시 시도가 없다**) |
 *
 * ⭐ **어느 갈래에서도 화면 배너를 세우지 않는다**(완료 조건 C4-4). 승인 진행은 **판단을 돕는
 * 자료이지 실행의 전제가 아니다** — 못 읽었다고 화면 전체가 실패로 보이면 사용자는 진행현황과
 * 후속 목록까지 못 믿게 된다.
 */
export type ApprovalProgressState =
  | { kind: 'notSubmitted' }
  | { kind: 'unusable' }
  | { kind: 'loading' }
  | { kind: 'ready'; view: RequestProgressView }
  | { kind: 'failed'; error: unknown };

export interface ApprovalProgressPaneProps {
  state: ApprovalProgressState;
  /**
   * 승인 완료를 뜻하는 상태 코드가 **아직 확정되지 않았는가**(`approval-progress.ts`의 판정).
   *
   * **화면이 넘긴다** — 자리표시 상수를 부품이 직접 읽으면 「값이 채워지면 무엇이 달라지는가」를
   * 화면 수준에서 잴 수 없어 그 자리가 죽은 가지가 된다.
   */
  isJudgePending: boolean;
  onRetry: () => void;
}

/**
 * 단계 하나의 보조 라벨 — **보이는 글자가 결과를 말한다.**
 *
 * 디자인 시스템은 상태 낱말(「완료·진행 중·대기·반려」)을 **스크린리더 전용**으로만 내고
 * 시각적으로는 색과 아이콘뿐이다. 색으로만 말하면 색을 구분하지 못하는 사용자에게 이 구획은
 * 아무 말도 하지 않는다 — 그래서 결과 코드·시각·의견이 전부 이 자리에 선다.
 *
 * **결재 결과는 코드 그대로다.** 값 목록이 공통코드 소관이라 화면이 「승인」·「반려」로 옮기면
 * 그 뜻을 화면이 지어낸 것이 된다.
 *
 * **「내 단계」 표식이 없다** — 이 화면은 결재하지 않는다.
 */
const describeStep = (step: StepProgressView): ReactNode => (
  <>
    <span className="field-note">{step.decisionCode ?? step.waitingText}</span>
    {step.decisionAtText !== null && <span className="field-note">{step.decisionAtText}</span>}
    {step.decisionComment !== null && <span className="field-note">{step.decisionComment}</span>}
  </>
);

/**
 * 승인 진행 구획 — **어디까지 왔는가**를 말하는 자리.
 *
 * **읽기만 한다.** 승인·반려는 결재함(W-CO-09)이 소유하며 이 화면은 그 진행을 보기만 한다.
 *
 * **여기 있는 값은 전부 서버가 준 것이다.** 위치·단계 상태 어느 것도 배열을 훑어 다시 계산하지
 * 않는다(판정은 `approval-progress.ts` 하나가 갖는다).
 *
 * **노드를 언제나 서버가 매긴 단계 번호로 덮는다**(완료 조건 C4-5). 이유가 둘이다 — ① 디자인
 * 시스템의 기본 노드는 **배열 인덱스+1**이라 그것을 두면 화면이 단계 번호를 다시 매기는 것이
 * 된다 ② 결재된 단계의 체크 글리프는 「승인됨」을 함의하는데, 값 목록이 확정되기 전에는 화면이
 * 그것을 알 수 없다. 결과는 글자가 말하고 노드는 자리를 말한다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const ApprovalProgressPane = ({
  state,
  isJudgePending,
  onRetry,
}: ApprovalProgressPaneProps) => (
  <section className="pane" aria-label={t.approval.label}>
    {state.kind === 'notSubmitted' && (
      <EmptyState
        size="sm"
        live
        title={t.approval.notSubmittedTitle}
        description={t.approval.notSubmittedDescription}
      />
    )}

    {state.kind === 'unusable' && (
      <EmptyState
        size="sm"
        live
        title={t.approval.unusableTitle}
        description={t.approval.unusableDescription}
      />
    )}

    {state.kind === 'loading' && (
      <div role="status" aria-label={t.loading.approval}>
        <SkeletonText lines={3} />
      </div>
    )}

    {state.kind === 'failed' && <FailedProgress error={state.error} onRetry={onRetry} />}

    {state.kind === 'ready' && <ReadyProgress view={state.view} isJudgePending={isJudgePending} />}
  </section>
);

interface FailedProgressProps {
  error: unknown;
  onRetry: () => void;
}

/**
 * 못 읽었을 때 — **세 갈래다**(완료 조건 C4-3). 화면 배너를 세우지 않고 이 구획 안에서만 말한다.
 *
 * | 갈래 | 화면이 하는 말 | 「다시 시도」 |
 * | :-: | --- | :-: |
 * | **403** | 「이 취소 요청의 승인 진행을 볼 권한이 없습니다」 | **없다** |
 * | **404** | 「승인 진행을 찾을 수 없습니다」 | 있다 |
 * | 그 밖(네트워크·5xx) | 「승인 진행을 불러오지 못했습니다」 + 서버 문구 | 있다 |
 *
 * **셋 다 계약이 실제로 내는 갈래다** — 승인 요청 상세의 응답은 200·403·404다(생성물 실측).
 * 문구만 두고 갈래를 만들지 않으면 그 문구가 **닿을 수 없는 가지**가 된다.
 *
 * **403에만 「다시 시도」를 내지 않는다.** 계약이 「승인자도 상신자도 아니면 403」이라 적었고
 * 같은 권한으로 다시 불러도 같은 답이 온다 — 누를 수 있는 조치를 주면 사용자를 헛돌게 한다.
 * **404에는 남긴다**: 방금 올린 요청이 승인 축에 아직 안 보이는 순간이 실재한다 — 권한과 달리
 * **다시 부르면 달라질 수 있다.**
 */
const FailedProgress = ({ error, onRetry }: FailedProgressProps) => {
  const forbidden = isApprovalForbidden(error);
  const notFound = isApprovalNotFound(error);

  const title = ((): string => {
    if (forbidden) return t.approval.forbiddenTitle;

    return notFound ? t.approval.notFoundTitle : t.approval.loadFailedTitle;
  })();

  const description = ((): string => {
    if (forbidden) return t.approval.forbiddenDescription;

    return notFound ? t.approval.notFoundDescription : describeLoadError(toApiError(error));
  })();

  return (
    <>
      <EmptyState
        size="sm"
        live
        title={title}
        description={description}
        action={
          forbidden ? undefined : (
            <Button variant="outlined" onClick={onRetry}>
              {messages.common.retry}
            </Button>
          )
        }
      />
      {/*
       * ⭐ **못 읽어도 실행을 막지 않는다**(완료 조건 C4-8). 잠금의 정본은 서버이고 계약이
       * 「승인 전이면 400」이라 적었다 — 화면이 모르는 것을 「승인되지 않았다」로 접으면
       * 승인된 건까지 실행할 수 없어진다.
       */}
      <p className="field-note">{t.approval.loadFailedNote}</p>
    </>
  );
};

interface ReadyProgressProps {
  view: RequestProgressView;
  isJudgePending: boolean;
}

const ReadyProgress = ({ view, isJudgePending }: ReadyProgressProps) => {
  const items: StepperItem[] = view.steps.map((step) => ({
    /* 승인자 이름. 비어 오면 그 사실을 적은 글자가 오고 **번호가 오지 않는다**. */
    label: step.approverLabel,
    status: step.status,
    icon: step.stepNo,
    description: describeStep(step),
  }));

  return (
    <>
      <dl className="filter-bar">
        <div className="field-cell">
          <dt className="field-label">{t.approval.requestNo}</dt>
          {/* 업무 번호라 그대로 낸다 — 조회에만 쓰는 내부 식별자와 다른 값이다. */}
          <dd>{view.requestNo}</dd>
        </div>
        <div className="field-cell">
          <dt className="field-label">{t.approval.approvalType}</dt>
          <dd>{view.approvalTypeCode}</dd>
        </div>
        <div className="field-cell">
          <dt className="field-label">{t.approval.status}</dt>
          <dd>{view.statusCode}</dd>
        </div>
        <div className="field-cell">
          <dt className="field-label">{t.approval.requester}</dt>
          <dd>{view.requesterLabel}</dd>
        </div>
        <div className="field-cell">
          <dt className="field-label">{t.approval.requestedAt}</dt>
          <dd>{view.requestedAtText}</dd>
        </div>
      </dl>

      {/*
       * 사유 **전문**. ⭐ **이 화면에서는 이것이 곧 취소 이력이다** — 문서에 취소 사유를 담을
       * 컬럼이 없어(omf-mes#87) 여기 말고는 남는 자리가 없다. 줄바꿈이 뜻을 나르므로 한 덩어리로
       * 묶어 줄이 재배열되거나 사이에 끼어들지 않게 한다.
       */}
      <div className="field-cell">
        <span className="field-label">{t.approval.reason}</span>
        <div role="group" aria-label={t.approval.reasonPane}>
          {view.reasonLines.map((line, index) => (
            <p key={`${String(index)}:${line}`}>{toVisibleLine(line)}</p>
          ))}
        </div>
      </div>

      <p>{view.positionText}</p>

      {items.length === 0 ? (
        <p className="field-note">{t.approval.noSteps}</p>
      ) : (
        /*
         * **이름을 붙이지 않는다.** 감싼 구획이 이미 「승인 진행」으로 불리고 있어, 목록에도
         * 같은 이름을 주면 스크린리더가 두 번 읽는다.
         */
        <Stepper orientation="vertical" size="sm" steps={items} />
      )}

      {/*
       * **승인 뒤에 무엇이 남았는지 밝히는 자리.**
       *
       * 세 문장이 서는 조건이 서로 다르다 —
       * ① 「승인이 끝나도 저절로 취소되지 않는다」는 **계약이 못 박은 사실**이라 늘 선다.
       * ② 「승인이 끝났는지 판정하지 못한다」는 **자리표시가 비어 있는 동안**만 선다.
       * ③ 「승인이 끝났습니다」는 **자리표시가 채워졌고 그 요청이 승인일 때**만 선다.
       *
       * ⛔ **셋 중 어느 것도 실행 버튼을 잠그지 않는다**(완료 조건 C4-8) — 말하는 것과 막는 것은
       * 다른 일이고, 막는 것은 서버다.
       */}
      <p className="field-note">{t.approval.manualExecuteNote}</p>
      {isJudgePending && <p className="field-note">{t.approval.unjudgeableNote}</p>}
      {!isJudgePending && view.isApproved && (
        <p className="field-note">{t.approval.approvedNote}</p>
      )}
    </>
  );
};
