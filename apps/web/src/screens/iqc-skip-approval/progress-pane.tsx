import { Stepper, type StepperItem } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { RequestProgressView, StepProgressView } from './progress';

const t = messages.iqcSkipApproval;

/**
 * 단계 하나의 보조 라벨 — **보이는 글자가 결과를 말한다.**
 *
 * 디자인 시스템은 상태 낱말(「완료·진행 중·대기·반려」)을 **스크린리더 전용 텍스트**로만 내고
 * 시각적으로는 색과 아이콘뿐이다. 색으로만 말하면 색을 구분하지 못하는 사용자에게 이 구획은
 * 아무 말도 하지 않는다 — 그래서 결과 코드·시각·의견·내 단계 표식이 전부 이 자리에 선다.
 *
 * **결재 결과는 코드 그대로다.** 값 목록이 공통코드 소관이라 화면이 「승인」·「반려」로 옮기면
 * 그 뜻을 화면이 지어낸 것이 된다.
 */
const describeStep = (step: StepProgressView): ReactNode => (
  <>
    {step.decisionCode === null ? (
      <span className="field-note">{step.waitingText}</span>
    ) : (
      <span className="field-note">{step.decisionCode}</span>
    )}
    {step.decisionAtText !== null && <span className="field-note">{step.decisionAtText}</span>}
    {step.decisionComment !== null && <span className="field-note">{step.decisionComment}</span>}
    {step.isMine && <span className="field-note">{t.progress.mine}</span>}
  </>
);

export interface ProgressPaneProps {
  view: RequestProgressView;
}

/**
 * 결재 진행 구획 — **어디까지 왔는가**를 말하는 자리.
 *
 * **조회 하나로 완성된다.** 계약이 상세 응답에 `steps`를 함께 실어 주므로 단계 전용 조회를
 * 만들지 않는다.
 *
 * **여기 있는 값은 전부 서버가 준 것이다.** 위치·차례·단계 상태 어느 것도 배열을 훑어 다시
 * 계산하지 않는다(판정은 `progress.ts` 하나가 갖는다).
 *
 * **노드를 언제나 서버가 매긴 단계 번호로 덮는다.** 이유가 둘이다 —
 * ① 디자인 시스템의 기본 노드는 **배열 인덱스+1**이라 그것을 두면 화면이 단계 번호를 다시
 * 매기는 것이 된다(응답의 `stepNo`와 갈릴 수 있다) ② 결재된 단계의 체크 글리프는
 * 「승인됨」을 함의하는데, 값 목록이 확정되기 전에는 화면이 그것을 알 수 없다.
 * 결과는 글자가 말하고 노드는 자리를 말한다.
 *
 * **한도 구간 안내가 이 구획에 선다.** 화면 이름에는 「한도」가 있는데 화면 안에 그 값이 없다 —
 * 구간은 결재선의 값이고 요청에서 결재선으로 가는 길이 계약에 없다(`omf-mes#88`). 이 구획이
 * 「몇 단계 중 몇 번째인가」를 말하는 자리라, 승인 범위를 어디서 확인하는지도 여기서 말한다.
 * **구간을 지어내지 않고 없다는 사실만 적는다.**
 *
 * **승인자가 없어 멈춘 요청을 오류로 그리지 않는다.** 부재 시 대기가 정상이라 배너가 아니라
 * 안내다 — 이 구획은 어떤 갈래에서도 경보를 세우지 않는다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const ProgressPane = ({ view }: ProgressPaneProps) => {
  const items: StepperItem[] = view.steps.map((step) => ({
    /* 승인자 이름. 비어 오면 그 사실을 적은 글자가 오고 **번호가 오지 않는다**. */
    label: step.approverLabel,
    status: step.status,
    icon: step.stepNo,
    description: describeStep(step),
  }));

  return (
    <div role="group" aria-label={t.panes.progress}>
      <p>{view.positionText}</p>
      {/*
       * **왜 내 차례가 아닌지는 말하지 않는다.** 앞 단계가 안 끝난 것인지, 내가 승인자가
       * 아닌 것인지, 이미 끝난 요청인지 화면은 판정할 수 없다 — 아는 것만 말한다.
       */}
      <p>{view.turnText}</p>

      {items.length === 0 ? (
        <p className="field-note">{t.progress.noSteps}</p>
      ) : (
        /*
         * **이름을 붙이지 않는다.** 감싼 구획이 이미 「결재 진행」으로 불리고 있어, 목록에도
         * 같은 이름을 주면 스크린리더가 「결재 진행, 그룹 → 결재 진행, 목록」으로 두 번 읽는다.
         */
        <Stepper orientation="vertical" size="sm" steps={items} />
      )}

      {/* 단계가 오든 오지 않든 참인 사실이라 목록 밖에 선다. */}
      <p className="field-note">{t.progress.limitRangeNote}</p>
    </div>
  );
};
