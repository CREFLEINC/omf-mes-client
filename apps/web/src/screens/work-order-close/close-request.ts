import type { components } from '@omf-mes/api-client';

import type { WorkOrderCloseRemainderDisposition } from './close-input-draft';

type WorkOrderClose = components['schemas']['WorkOrderClose'];
type WorkOrderCloseCompletionJudgment =
  components['schemas']['WorkOrderProgress']['completionJudgmentCode'];

/**
 * 마감 본문 — **되돌릴 수 없는 쓰기의 본문을 만드는 유일한 자리다.**
 *
 * | 자리 | 값 | 근거 |
 * | --- | --- | --- |
 * | `remainderDispositionCode` | 미달일 때만 이월/소멸 | 조건부 필수 — 정상·초과는 비운다(계약 설명) |
 * | `reasonCode` | 미달·초과일 때 변동 사유 | 조건부 필수(R80) |
 * | `remarks` | **소멸을 골랐을 때** 그 이유 | 계약이 「소멸을 고른 이유를 남기는 자리」로 둔 칸 — 소멸은 아무 자원도 만들지 않아 선택 사실이 이 칸과 처분 코드에만 남는다 |
 * | `erpSendItems` | **싣지 않는다** | 이 칸은 생산 실적 «부속 항목»(투입자재·공수·설비시간·비가동)의 목록이고 그 코드 표기는 아직 정해지지 않았다. 최상위 송신 항목 on/off(생산 실적·입고·출하·반품·실사 조정)는 전역 설정이라 이 칸에 싣지 않는다 — 계약이 ⛔로 못박았다. 코드가 정해지면 부속 항목 선택칸과 함께 연다 |
 *
 * 정상·초과 마감은 남아 있던 조건부 입력(처분·비고)을 버린다 — 뜻이 맞지 않는 값을 실어 보내지 않는다.
 */
export interface WorkOrderCloseRequestInput {
  completionJudgmentCode: WorkOrderCloseCompletionJudgment;
  remainderDispositionCode: WorkOrderCloseRemainderDisposition | null;
  reasonCode: string;
  remarks: string;
}

export const toWorkOrderCloseRequest = (
  input: WorkOrderCloseRequestInput,
): WorkOrderClose | null => {
  const reasonCode = input.reasonCode.trim();
  const remarks = input.remarks.trim();

  if (input.completionJudgmentCode === 'UNDER') {
    if (input.remainderDispositionCode === null || reasonCode === '') {
      return null;
    }

    return {
      remainderDispositionCode: input.remainderDispositionCode,
      reasonCode,
      ...(input.remainderDispositionCode === 'WRITE_OFF' && remarks !== '' ? { remarks } : {}),
    };
  }

  if (input.completionJudgmentCode === 'OVER') {
    return reasonCode === '' ? null : { reasonCode };
  }

  return {};
};
