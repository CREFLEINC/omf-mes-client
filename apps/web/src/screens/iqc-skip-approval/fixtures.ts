import type { ApprovalRequest, ApprovalTarget, RequestRow } from './types';
import { toRequestRow } from './types';

/**
 * 합성 테스트 자료.
 *
 * **실 운영 값을 쓰지 않는다.** 계약의 `@example` 값도 쓰지 않는다 — 그것은 예시이지
 * 확정이 아니고, 픽스처에 심으면 화면 코드보다 오래 남아 나중에 「이 값이 정본이었다」로 읽힌다.
 * 번호는 9000대 합성 대역, 코드는 `SAMPLE-`·요청번호는 `SYNTH-` 접두, 이름은 「합성…」으로 지어낸다.
 *
 * **놓치기 쉬운 입력을 처음부터 담는다** — 사유가 여러 줄인 요청과 한 줄인 요청, 빈 줄로
 * 시작하는 사유, 상신자 이름과 대상 표시명이 **비어 온** 요청, 그리고 **승인 유형이 서로
 * 다른** 요청들(유형 코드가 확정되기 전이라 이 화면에 여러 유형이 섞여 들어오는 것이
 * 지금의 사실이다 — `omf-mes#64`).
 */

/**
 * 대상 하나를 만든다.
 *
 * **유형 코드가 자리마다 다르다.** 이 화면은 대상 유형을 **읽고 판단하지 않으므로**
 * 값이 갈려도 화면의 어느 판정도 달라지지 않아야 한다 — 달라지면 그 자리가 곧 매핑표다.
 */
const target = (
  targetId: number,
  displayName: string,
  targetTypeCode: string,
  openable = true,
): ApprovalTarget => ({
  targetTypeCode,
  targetId,
  displayName,
  openable,
});

/**
 * 승인 요청 넷.
 *
 * 하나씩 이름을 갖는 이유: 시험이 **이 몸통을 이름으로 집는다**. 배열 자리로 꺼내면
 * 자리가 밀릴 때 시험이 조용히 다른 요청을 가리키게 된다.
 */
const multilineReasonRequest: ApprovalRequest = {
  approvalRequestId: 9001,
  approvalRequestNo: 'SYNTH-REQ-001',
  approvalTypeCode: 'SAMPLE-TYPE-A',
  requestedBy: 9301,
  requestedByName: '합성 상신자1',
  requestedAt: '2026-08-06T14:20:00+09:00',
  statusCode: 'SAMPLE-STATUS-OPEN',
  /** 여러 줄 사유. **첫 줄이 짧고 둘째 줄이 길다** — 목록에 전문이 새면 곧바로 드러난다. */
  reason:
    '합성 사유 첫 줄\n둘째 줄은 훨씬 길게 이어지는 설명이고 목록의 요약 자리에는 오지 않아야 한다',
  target: target(9401, '합성 대상 문서 가', 'SAMPLE-TARGET-A'),
  currentStepNo: 2,
  totalStepNo: 3,
  isMyTurn: true,
};

const singleLineReasonRequest: ApprovalRequest = {
  approvalRequestId: 9002,
  approvalRequestNo: 'SYNTH-REQ-002',
  /** **다른 유형이다.** 유형 코드가 확정되기 전에는 이런 건이 섞여 온다. */
  approvalTypeCode: 'SAMPLE-TYPE-B',
  requestedBy: 9302,
  requestedByName: '합성 상신자2',
  requestedAt: '2026-08-05T09:05:00+09:00',
  statusCode: 'SAMPLE-STATUS-DONE',
  /** 한 줄뿐인 사유. */
  reason: '합성 사유 한 줄짜리',
  target: target(9402, '합성 대상 문서 나', 'SAMPLE-TARGET-B', false),
  currentStepNo: null,
  totalStepNo: 2,
  isMyTurn: false,
};

const namelessRequest: ApprovalRequest = {
  approvalRequestId: 9003,
  approvalRequestNo: 'SYNTH-REQ-003',
  approvalTypeCode: 'SAMPLE-TYPE-A',
  requestedBy: 9303,
  /** 이름이 비어 왔다 — **번호를 대신 내지 않는다**(`omf-mes#44`). */
  requestedByName: '',
  requestedAt: '2026-08-04T18:40:00+09:00',
  statusCode: 'SAMPLE-STATUS-OPEN',
  reason: '합성 사유 셋',
  /** 표시명도 비어 왔다. 같은 규율이 대상 칸에도 걸린다. */
  target: target(9403, '', 'SAMPLE-TARGET-A'),
  currentStepNo: 2,
  totalStepNo: 1,
  isMyTurn: false,
};

const blankLeadingReasonRequest: ApprovalRequest = {
  approvalRequestId: 9004,
  approvalRequestNo: 'SYNTH-REQ-004',
  approvalTypeCode: 'SAMPLE-TYPE-C',
  requestedBy: 9301,
  requestedByName: '합성 상신자1',
  requestedAt: '2026-08-03T11:00:00+09:00',
  statusCode: 'SAMPLE-STATUS-HOLD',
  /** **빈 줄로 시작하는 사유.** 첫 줄을 그대로 내면 요약 자리가 빈 칸이 된다. */
  reason: '\n   \n내용이 있는 첫 줄은 여기다',
  /**
   * **9001과 같은 대상**이다 — 한 문서에 요청이 두 번 오를 수 있어, 대상 이름만으로는
   * 행을 가릴 수 없다. 행 선택 버튼의 접근 이름이 **요청번호**를 담는 이유가 여기서 선다.
   */
  target: target(9401, '합성 대상 문서 가', 'SAMPLE-TARGET-A'),
  currentStepNo: 1,
  totalStepNo: 4,
  isMyTurn: false,
};

export const requestFixtures: ApprovalRequest[] = [
  multilineReasonRequest,
  singleLineReasonRequest,
  namelessRequest,
  blankLeadingReasonRequest,
];

export const requestRowFixtures: RequestRow[] = requestFixtures.map(toRequestRow);

/** 목록에 **와서는 안 되는** 둘째 줄. 「첫 줄만 낸다」의 짝 단언이 이 값을 쓴다. */
export const SECOND_LINE_OF_MULTILINE_REASON =
  '둘째 줄은 훨씬 길게 이어지는 설명이고 목록의 요약 자리에는 오지 않아야 한다';

/** 목록에 **와야 하는** 첫 줄. 위 단언의 선행 짝이다. */
export const FIRST_LINE_OF_MULTILINE_REASON = '합성 사유 첫 줄';
