import type {
  ApprovalRequest,
  ApprovalRequestDetail,
  ApprovalStep,
  ApprovalTarget,
  RequestRow,
} from './types';
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
 * 대상 **네 갈래**. 「열기」의 판정이 갈리는 자리 전부다 —
 * 열림 하나와 잠김 셋(계약이 못 연다고 했다 / 화면 ID가 없다 / 이 앱에 그 화면이 없다).
 *
 * **화면 ID는 합성 대역**(`W-99-99`·`W-99-98`)이다. 실재하는 화면 ID를 심으면 매핑표에 줄이
 * 생기는 날 이 픽스처가 뜻하지 않게 「열림」으로 넘어간다.
 */
export const targetFixtures = {
  /** 열 수 있고 갈 곳도 안다 — **매핑표에 그 줄이 있을 때만** 열린다. */
  mapped: { ...target(9401, '합성 대상 문서 가', 'SAMPLE-TARGET-A'), screenId: 'W-99-99' },
  /** 열 수 있다는데 어느 화면인지 오지 않았다(스키마상 가능한 조합). */
  noScreenId: target(9402, '합성 대상 문서 나', 'SAMPLE-TARGET-B'),
  /** 계약이 열 수 없다고 내려 줬다. **화면 ID가 실려 와도 이 말이 이긴다.** */
  notOpenable: {
    ...target(9403, '합성 대상 문서 다', 'SAMPLE-TARGET-C', false),
    screenId: 'W-99-99',
  },
  /** 화면은 아는데 이 앱에 그 화면이 없다. */
  unmapped: { ...target(9404, '합성 대상 문서 라', 'SAMPLE-TARGET-D'), screenId: 'W-99-98' },
  /** 표시명이 비어 왔다 — **번호도 유형 코드도 대신 내지 않는다**(`omf-mes#44`). */
  nameless: target(9405, '', 'SAMPLE-TARGET-A'),
} as const;

/** 매핑표를 채우는 시험이 쓰는 열쇠와 값. **어느 화면 ID가 열리는지를 한 곳에 둔다.** */
export const MAPPED_SCREEN_ID = 'W-99-99';
export const MAPPED_SCREEN_PATH = '/synthetic/mapped-screen';

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

/* ---------------------------------------------------------------------- *
 * 상세 — 요청 몸통 + 결재 단계 배열.
 * ---------------------------------------------------------------------- */

/**
 * 결재 결과 코드 **합성값**. 어느 코드가 승인이고 어느 코드가 반려인지 **화면은 모른다**
 * (`omf-mes#64`) — 픽스처도 그 뜻을 담지 않는다. 이름이 `A`·`B`인 것이 그 사실이다.
 */
export const SAMPLE_DECISION_CODE_A = 'SAMPLE-DECISION-A';
export const SAMPLE_DECISION_CODE_B = 'SAMPLE-DECISION-B';

const step = (
  stepNo: number,
  approverId: number,
  approverName: string,
  overrides: Partial<ApprovalStep> = {},
): ApprovalStep => ({
  stepNo,
  approverId,
  approverName,
  isMine: false,
  isCurrent: false,
  ...overrides,
});

/**
 * **자기모순 픽스처 ①** — 서버 값과 배열 재계산이 어긋난다.
 *
 * | 서버가 말하는 것 | 배열을 훑으면 |
 * | --- | --- |
 * | `currentStepNo`가 **2** | 단계가 하나뿐이라 인덱스+1은 **1** |
 * | `totalStepNo`가 **3** | `steps.length`는 **1** |
 * | `isMyTurn`이 **참** | 미결 단계가 없어 **거짓** |
 *
 * 목 서버가 실제로 이런 상세를 내려 준다(계획 §6.3 실측). 재계산하는 구현은 이 픽스처에서
 * 곧바로 어긋나고, 서버 값을 그대로 쓰는 구현만 통과한다(M19·M20).
 *
 * **결재 기록이 있는데 `isCurrent`가 참**인 것도 같은 갈래다 — 그때 「진행 중」으로 그리면
 * 사용자가 이미 끝난 단계를 기다린다.
 */
export const contradictoryDetail: ApprovalRequestDetail = {
  request: { ...multilineReasonRequest, target: targetFixtures.noScreenId },
  steps: [
    step(1, 9501, '합성 승인자1', {
      decisionCode: SAMPLE_DECISION_CODE_A,
      decisionAt: '2026-08-06T15:02:00+09:00',
      decisionComment: '합성 결재 의견 하나',
      isMine: true,
      isCurrent: true,
    }),
  ],
};

/**
 * **자기모순 픽스처 ②** — 어긋남의 **반대 방향**이다.
 *
 * 서버는 `isMyTurn`이 **거짓**이라는데, 배열로는 「앞 단계가 결재됐고 지금 단계가 미결이며
 * 내 것」이라 **참**으로 읽힌다. 한 방향만 두면 「늘 서버 값을 낸다」와 「늘 거짓을 낸다」가
 * 구분되지 않는다.
 *
 * `currentStepNo`가 **`null`**(결재 종료)인 갈래도 여기서 함께 선다 — **`?? 0`으로 메우면
 * 「0 / 2 단계」라는 없는 말이 나온다**(§5.4-18).
 */
export const finishedDetail: ApprovalRequestDetail = {
  request: { ...singleLineReasonRequest, target: targetFixtures.notOpenable },
  steps: [
    step(1, 9501, '합성 승인자1', {
      decisionCode: SAMPLE_DECISION_CODE_B,
      decisionAt: '2026-08-05T10:00:00+09:00',
      isMine: false,
      isCurrent: false,
    }),
    /** 미결이고 지금 차례이며 내 단계인데, **서버는 내 차례가 아니라고 말한다.** */
    step(2, 9502, '합성 승인자2', { isMine: true, isCurrent: true }),
  ],
};

/**
 * 승인자 이름이 **비어 온** 상세. 그때 화면은 `approverId`를 대신 내지 않는다(`omf-mes#44`).
 *
 * 결재 의견이 없는 단계와 결재 전 단계도 함께 담는다 — 선택 필드가 비어 있을 때
 * 보조 라벨이 빈 칸을 그리지 않는지 재는 자리다.
 */
export const namelessApproverDetail: ApprovalRequestDetail = {
  request: { ...namelessRequest, target: targetFixtures.nameless },
  steps: [
    step(1, 9503, '', {
      decisionCode: SAMPLE_DECISION_CODE_A,
      decisionAt: '2026-08-04T19:00:00+09:00',
    }),
    step(2, 9504, '합성 승인자3', { isCurrent: true }),
  ],
};

/** 단계 배열이 **비어 온** 상세. 계약이 배열을 필수로 두었으나 빈 배열은 스키마를 통과한다. */
export const noStepsDetail: ApprovalRequestDetail = {
  request: { ...blankLeadingReasonRequest, target: targetFixtures.unmapped },
  steps: [],
};

/**
 * 요청번호로 상세를 찾는다. **화면 시험의 스텁이 이것으로 답한다** —
 * 어느 요청을 골라도 그에 맞는 상세가 오게 해야 「고른 것과 다른 상세가 왔다」를 잴 수 있다.
 */
export const detailFixtures: ApprovalRequestDetail[] = [
  contradictoryDetail,
  finishedDetail,
  namelessApproverDetail,
  noStepsDetail,
];

export const detailOf = (approvalRequestId: number): ApprovalRequestDetail | undefined =>
  detailFixtures.find((detail) => detail.request.approvalRequestId === approvalRequestId);
