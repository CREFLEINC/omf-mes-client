import type { StepperItem, StepStatus } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

/**
 * 결재선이 **어디까지 왔는가.**
 *
 * ⛔ **이 화면은 결재하지 않는다**(J-10). 승인·반려는 결재함(`W-CO-09`) 몫이다 — 결재함이 쓰는
 * 「내 차례」 표기를 여기로 나르지 않는다. 나르면 이 화면이 결재함처럼 읽히고, 사용자는 있지도
 * 않은 승인 버튼을 찾는다. 여기서 말하는 것은 **진행**뿐이다.
 *
 * ---
 *
 * ⛔ **규율 하나: 상태 코드로 「끝났는가」를 판정하지 않는다.**
 *
 * | 화면이 말하는 것 | 근거로 쓰는 값 | **쓰지 않는 것** |
 * | --- | --- | --- |
 * | 이 전표가 상신됐는가 | `goodsIssue.approvalRequestId` 가 **있는가** | `statusCode` 문자열 비교 |
 * | 지금 몇 단계인가 | `request.currentStepNo` | `steps` 에서 인덱스+1 |
 * | 전체가 몇 단계인가 | `request.totalStepNo` | `steps.length` |
 * | 이 단계가 끝났는가 | `step.decisionCode` 가 **있는가** | 앞 단계들의 결과로 파생 |
 * | 승인이 끝났는가 | ⛔ **판정하지 않는다** | `currentStepNo === null` |
 *
 * **왜 마지막 줄을 비워 두는가.** `ApprovalRequest.statusCode` 가 계약에서 아직 열린 문자열이라
 * (`5b3d773` 실측) 「승인」과 「반려」를 값으로 가를 수 없다. 그런데 **반려로 끝난 요청도
 * `currentStepNo` 가 빈다** — 그것으로 승인을 판정하면 **반려된 요청이 처리할 수 있는 것처럼
 * 보인다.** 통지 `#674` 가 「모든 단계가 결재됨으로 파생하지 마십시오」로 같은 것을 막았다.
 *
 * ⇒ 출고 버튼은 이 파일의 판정을 기다리지 않는다. **버튼을 열고 서버의 400 이 말한다**(J-8).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type ApprovalRequest = components['schemas']['ApprovalRequest'];
type ApprovalStep = components['schemas']['ApprovalStep'];

const t = messages.productDisposalRequest.approval;

/**
 * 한 단계의 상태.
 *
 * ⭐ **결재한 단계는 판정으로 가른다** — 승인과 반려를 같은 「완료」로 접으면 **반려가 승인처럼
 * 보인다.** 되돌릴 수 없는 폐기 앞에서 그 오독은 비싸다.
 *
 * ⚠ **판정이 비었으면 「아직」이다** — 계약이 「대기」를 값으로 두지 않고 **부재로 판정한다**고
 * 적었다. 그중 지금 차례인 것만 진행 중으로 세운다.
 */
const statusOf = (step: ApprovalStep, currentStepNo: number | null): StepStatus => {
  /* ⭐ DS 가 「반려」를 제 상태로 갖는다 — 승인과 같은 「완료」로 접지 않아도 된다. */
  if (step.decisionCode === 'REJECTED') return 'rejected';
  if (step.decisionCode === 'APPROVED') return 'complete';

  return step.stepNo === currentStepNo ? 'current' : 'pending';
};

const describe = (step: ApprovalStep): string => {
  if (step.decisionCode === 'REJECTED') return t.rejected;
  if (step.decisionCode === 'APPROVED') return t.approved;

  return t.waiting;
};

/**
 * 결재선 진행을 `Stepper` 칸으로 접는다.
 *
 * ⚠ **`steps` 를 단계 번호로 세운다** — 응답 차례를 믿지 않는다. 목이 자기모순인 상세를
 * 내려준 전례가 있어(`W-01-06` 이 적어 두었다) 화면이 차례를 스스로 정한다.
 */
export const toProgressSteps = (detail: {
  request: ApprovalRequest;
  steps: readonly ApprovalStep[];
}): StepperItem[] =>
  [...detail.steps]
    .sort((left, right) => left.stepNo - right.stepNo)
    .map((step) => ({
      /* ⚠ 이름이 비어 오면 그 사실을 적는다 — 번호를 이름 자리에 넣지 않는다(G-9). */
      label: step.approverName.trim() === '' ? t.unknownApprover : step.approverName,
      status: statusOf(step, detail.request.currentStepNo),
      icon: step.stepNo,
      description: describe(step),
    }));

/**
 * 진행 요약 한 줄 — 「2단계 중 1단계」.
 *
 * ⚠ **단계 수를 `steps.length` 로 세지 않는다** — 응답이 일부만 실어 줄 수 있고, 그러면 화면이
 * 결재선을 실제보다 짧게 말한다. 계약이 `totalStepNo` 를 따로 준 이유가 그것이다.
 */
export const progressSummary = (request: ApprovalRequest): string =>
  request.currentStepNo === null
    ? t.finished(request.totalStepNo)
    : t.inProgress(request.currentStepNo, request.totalStepNo);
