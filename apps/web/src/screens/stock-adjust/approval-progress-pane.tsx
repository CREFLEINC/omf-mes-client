import { Button, EmptyState, SkeletonText, Stepper, type StepperItem } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { toApiError } from '../../patterns/request';
import type { RequestProgressView, StepProgressView } from './approval-progress';
import { describeLoadError } from './load-error-banner';
import { isApprovalForbidden, isApprovalNotFound } from './queries';
import { toVisibleLine } from './reason-draft';

const t = messages.stockAdjust;

/**
 * 이 구획이 설 수 있는 **네 갈래**.
 *
 * | 갈래 | 근거 | 이 구획이 내는 것 |
 * | :-: | --- | --- |
 * | `unusable` | 상신 응답의 값이 조회 조각으로 **쓸 수 없다**(0·음수·소수) | 그 사실만 밝힌다 |
 * | `loading` | 승인 요청 조회 진행 중 | 뼈대 |
 * | `ready` | 승인 요청 상세가 200 | 요청 정보 · 사유 전문 · 세로 단계 |
 * | `failed` | **403 · 404 · 그 밖** 셋으로 다시 갈린다 | 구획 안 안내(**403에만 다시 시도가 없다**) |
 *
 * ⚠ **「아직 상신되지 않았다」 갈래를 두지 않는다.** 이 구획은 화면이 **202를 받은 뒤에만**
 * 서므로 그 갈래는 도달할 수 없다 — 만들면 보일 일이 없는 자리표시가 남는다. 상신 전 판정은
 * `readSubmission`의 `notSubmitted`가 하고, 그 결과는 **구획을 세우지 않는 것**으로 나타난다
 * (그 자리가 살아 있는 소비처다 · C36).
 *
 * **어느 갈래에서도 화면 배너를 세우지 않는다.** 결재 진행은 **읽고 나서 아는 사실이지 상신의
 * 전제가 아니다** — 못 읽었다고 화면 전체가 실패로 보이면 사용자는 방금 받은 202까지 못 믿게 된다.
 */
export type ApprovalProgressState =
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
 * 그 뜻을 화면이 지어낸 것이 된다(공유계약 G-2).
 *
 * ⛔ **「내 단계」 표식이 없다** — 이 화면은 결재하지 않는다(C36).
 */
const describeStep = (step: StepProgressView): ReactNode => (
  <>
    <span className="field-note">{step.decisionCode ?? step.waitingText}</span>
    {step.decisionAtText !== null && <span className="field-note">{step.decisionAtText}</span>}
    {step.decisionComment !== null && <span className="field-note">{step.decisionComment}</span>}
  </>
);

/**
 * 결재 진행 구획 — **어디까지 왔는가**를 말하는 자리.
 *
 * **읽기만 한다.** 승인·반려는 결재함(W-CO-09)이 소유하며 이 화면은 그 진행을 보기만 한다 —
 * 화면 상단의 안내가 그 사실을 밝힌다(⛔ 조심 ① · D-3).
 *
 * **여기 있는 값은 전부 서버가 준 것이다.** 위치·단계 상태 어느 것도 배열을 훑어 다시 계산하지
 * 않는다(판정은 `approval-progress.ts` 하나가 갖는다).
 *
 * **노드를 언제나 서버가 매긴 단계 번호로 덮는다.** 이유가 둘이다 — ① 디자인 시스템의 기본
 * 노드는 **배열 인덱스+1**이라 그것을 두면 화면이 단계 번호를 다시 매기는 것이 된다(응답의
 * 번호와 갈릴 수 있다) ② 결재된 단계의 체크 글리프는 「승인됨」을 함의하는데, 값 목록이
 * 확정되기 전에는 화면이 그것을 알 수 없다. 결과는 글자가 말하고 노드는 자리를 말한다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의
 * 같은 이름 부품을 참조하지 않는다.
 */
export const ApprovalProgressPane = ({
  state,
  isJudgePending,
  onRetry,
}: ApprovalProgressPaneProps) => (
  <div role="group" aria-label={t.progress.label}>
    {state.kind === 'unusable' && (
      <EmptyState
        size="sm"
        live
        title={t.progress.unusableTitle}
        description={t.progress.unusableDescription}
      />
    )}

    {state.kind === 'loading' && (
      <div role="status" aria-label={t.loading.approvalRequest}>
        <SkeletonText lines={3} />
      </div>
    )}

    {state.kind === 'failed' && <FailedProgress error={state.error} onRetry={onRetry} />}

    {state.kind === 'ready' && <ReadyProgress view={state.view} isJudgePending={isJudgePending} />}
  </div>
);

interface FailedProgressProps {
  error: unknown;
  onRetry: () => void;
}

/**
 * 못 읽었을 때 — **세 갈래다.**
 *
 * | 갈래 | 화면이 하는 말 | 「다시 시도」 |
 * | :-: | --- | :-: |
 * | **403** | 「이 요청의 결재 진행을 볼 권한이 없습니다」 | **없다** |
 * | **404** | 「결재 진행을 찾을 수 없습니다」 | 있다 |
 * | 그 밖(네트워크·5xx) | 「결재 진행을 불러오지 못했습니다」 + 서버 문구 | 있다 |
 *
 * **셋 다 계약이 실제로 내는 갈래다** — 승인 요청 상세의 응답은 200·403·404다(생성물 실측).
 * 문구만 두고 갈래를 만들지 않으면 그 문구가 **닿을 수 없는 가지**가 된다.
 *
 * **403에만 「다시 시도」를 내지 않는다.** 계약이 「승인자도 상신자도 아니면 403」이라 적었고
 * 같은 권한으로 다시 불러도 같은 답이 온다 — 누를 수 있는 조치를 주면 사용자를 헛돌게 한다.
 * **404에는 남긴다**: 여기 404는 「전표가 가리키는 요청이 지금 보이지 않는다」이고, **방금
 * 상신한 건이 승인 축에 아직 안 보이는 순간이 실재한다** — 권한과 달리 다시 부르면 달라질 수 있다.
 */
const FailedProgress = ({ error, onRetry }: FailedProgressProps) => {
  const forbidden = isApprovalForbidden(error);
  const notFound = isApprovalNotFound(error);

  const title = ((): string => {
    if (forbidden) return t.progress.forbiddenTitle;

    return notFound ? t.progress.notFoundTitle : t.progress.loadFailedTitle;
  })();

  const description = ((): string => {
    if (forbidden) return t.progress.forbiddenDescription;

    return notFound ? t.progress.notFoundDescription : describeLoadError(toApiError(error));
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
      {/* 못 읽어도 상신은 이미 접수됐다 — 이 구획의 실패가 그 사실을 바꾸지 않는다. */}
      <p className="field-note">{t.progress.loadFailedNote}</p>
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
          <dt className="field-label">{t.progress.requestNo}</dt>
          {/* 업무 번호라 그대로 낸다 — 조회에만 쓰는 내부 식별자와 다른 값이다. */}
          <dd>{view.requestNo}</dd>
        </div>
        <div className="field-cell">
          <dt className="field-label">{t.progress.approvalType}</dt>
          <dd>{view.approvalTypeCode}</dd>
        </div>
        <div className="field-cell">
          {/* 값으로 분기하지 않고 그대로 낸다 — 무슨 뜻인지는 화면이 판정하지 않는다(G-2). */}
          <dt className="field-label">{t.progress.status}</dt>
          <dd>{view.statusCode}</dd>
        </div>
        <div className="field-cell">
          <dt className="field-label">{t.progress.requester}</dt>
          <dd>{view.requesterLabel}</dd>
        </div>
        <div className="field-cell">
          <dt className="field-label">{t.progress.requestedAt}</dt>
          <dd>{view.requestedAtText}</dd>
        </div>
      </dl>

      {/*
       * 사유 **전문**. 줄바꿈이 뜻을 나른다 — 승인 요청의 업무 값이 사유 하나뿐이라 상신자가
       * 여러 줄로 근거를 적는다(A-12). 한 덩어리로 묶어 줄이 재배열되거나 사이에 끼어들지 않게 한다.
       */}
      <div className="field-cell">
        <span className="field-label">{t.progress.reason}</span>
        <div role="group" aria-label={t.progress.reasonPane}>
          {view.reasonLines.map((line, index) => (
            <p key={`${String(index)}:${line}`}>{toVisibleLine(line)}</p>
          ))}
        </div>
      </div>

      <p>{view.positionText}</p>

      {items.length === 0 ? (
        <p className="field-note">{t.progress.noSteps}</p>
      ) : (
        /*
         * **이름을 붙이지 않는다.** 감싼 구획이 이미 「결재 진행」으로 불리고 있어, 목록에도
         * 같은 이름을 주면 스크린리더가 두 번 읽는다.
         */
        <Stepper orientation="vertical" size="sm" steps={items} />
      )}

      {/*
       * **승인 뒤에 무엇이 남았는지 밝히는 자리.**
       *
       * 두 문장이 서는 조건이 서로 다르다 —
       * ① 「승인은 재고를 움직이지 않는다」는 **계약이 못 박은 사실**이라 늘 선다.
       * ② 「판정하지 못한다」와 「승인되었습니다」는 **자리표시가 가른다**(D-13) — 비어 있으면
       *    앞쪽, 채워졌고 그 요청이 승인일 때만 뒤쪽이다. 짐작해 채우면 승인되지 않은 조정이
       *    승인된 것으로 보인다.
       */}
      <p className="field-note">{t.progress.postSeparateNote}</p>
      {isJudgePending && <p className="field-note">{t.progress.unjudgeableNote}</p>}
      {!isJudgePending && view.isApproved && (
        <p className="field-note">{t.progress.approvedNote}</p>
      )}
    </>
  );
};
