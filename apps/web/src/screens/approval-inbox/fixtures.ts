import type { ApprovalRequest, RequestRow } from './types';
import { toRequestRow } from './types';

/**
 * 합성 테스트 자료.
 *
 * **실 운영 값을 쓰지 않는다.** 계약의 `@example` 값도 쓰지 않는다 — 그것은 예시이지
 * 확정이 아니고, 픽스처에 심으면 화면 코드보다 오래 남아 나중에 「이 값이 정본이었다」로 읽힌다.
 * 번호는 9000대 합성 대역, 코드는 `SAMPLE-`·요청번호는 `SYNTH-` 접두, 이름은 「합성…」으로 지어낸다.
 *
 * **놓치기 쉬운 입력을 처음부터 담는다** — 사유가 여러 줄인 요청과 한 줄인 요청, 빈 줄로
 * 시작하는 사유, 현재 단계가 **비어 있는**(종료) 요청, 현재 단계가 전체보다 **큰** 요청
 * (목 서버가 실제로 그런 응답을 준다), 상신자 이름과 대상 표시명이 **비어 온** 요청,
 * 그리고 지금 내 차례인 것과 아닌 것.
 */

/** 대상 하나를 만든다. 표시명·화면 ID·열 수 있는지 셋만 다르다. */
const target = (
  targetId: number,
  displayName: string,
  openable: boolean,
  screenId?: string,
): ApprovalRequest['target'] => ({
  targetTypeCode: 'SAMPLE-TARGET-A',
  targetId,
  displayName,
  ...(screenId === undefined ? {} : { screenId }),
  openable,
});

/**
 * 승인 요청 넷.
 *
 * **9001과 9004는 대상 표시명이 같다** — 같은 문서에 요청이 두 번 오를 수 있어야
 * 행 선택 버튼의 접근 이름이 요청번호를 함께 담는 이유가 화면에서 실제로 성립한다.
 */
export const requestFixtures: ApprovalRequest[] = [
  {
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
    target: target(9401, '합성 대상 문서 가', true, 'W-99-99'),
    currentStepNo: 2,
    totalStepNo: 3,
    isMyTurn: true,
  },
  {
    approvalRequestId: 9002,
    approvalRequestNo: 'SYNTH-REQ-002',
    approvalTypeCode: 'SAMPLE-TYPE-B',
    requestedBy: 9302,
    requestedByName: '합성 상신자2',
    requestedAt: '2026-08-05T09:05:00+09:00',
    statusCode: 'SAMPLE-STATUS-DONE',
    /** 한 줄뿐인 사유. */
    reason: '합성 사유 한 줄짜리',
    target: target(9402, '합성 대상 문서 나', false),
    /** 끝난 요청이라 기다리는 단계가 없다. **0으로 메우지 않는다.** */
    currentStepNo: null,
    totalStepNo: 2,
    isMyTurn: false,
  },
  {
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
    target: target(9403, '', true, 'W-99-98'),
    /**
     * **현재 단계가 전체보다 크다.** 목 서버가 실제로 이런 응답을 준다 —
     * 화면이 서버 값을 그대로 낸다는 것을 여기서 잰다(계획 결정 7).
     */
    currentStepNo: 2,
    totalStepNo: 1,
    isMyTurn: false,
  },
  {
    approvalRequestId: 9004,
    approvalRequestNo: 'SYNTH-REQ-004',
    approvalTypeCode: 'SAMPLE-TYPE-C',
    requestedBy: 9301,
    requestedByName: '합성 상신자1',
    requestedAt: '2026-08-03T11:00:00+09:00',
    statusCode: 'SAMPLE-STATUS-HOLD',
    /** **빈 줄로 시작하는 사유.** 첫 줄을 그대로 내면 요약 자리가 빈 칸이 된다. */
    reason: '\n   \n내용이 있는 첫 줄은 여기다',
    target: target(9401, '합성 대상 문서 가', true, 'W-99-99'),
    currentStepNo: 1,
    totalStepNo: 4,
    isMyTurn: true,
  },
];

export const requestRowFixtures: RequestRow[] = requestFixtures.map(toRequestRow);

/** 목록에 보여야 하는 사유 첫 줄. 픽스처에서 파생시킨다 — 손으로 적으면 조용히 어긋난다. */
export const FIRST_LINE_OF_MULTILINE_REASON = requestRowFixtures[0]?.reasonFirstLine ?? '';

/** 목록에 **오면 안 되는** 둘째 줄. */
export const SECOND_LINE_OF_MULTILINE_REASON =
  '둘째 줄은 훨씬 길게 이어지는 설명이고 목록의 요약 자리에는 오지 않아야 한다';
