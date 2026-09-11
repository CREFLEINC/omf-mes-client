import type { ProductionResultCreate, ResultDraft } from './types';

/**
 * 저장 요청 본문을 만드는 **유일한 자리.**
 *
 * 조립을 화면에 흩어 두면 「무엇을 보내지 않기로 했는가」를 셀 수 없다 — 이 화면에서 가장
 * 조용히 깨지는 것이 그쪽이다. 빼야 할 값을 실어 보내도 화면은 정상으로 보인다.
 */

export interface SaveInput {
  workOrderId: number;
  lotId: number;
  uomId: number;
  draft: ResultDraft;
  goodQty: number;
  /** 입력 시점. **서버 수신 시각과 다르다** — 오프라인 지연이 실적 시각을 왜곡하지 않는다. */
  occurredAt: string;
}

/**
 * ⛔ **여기에 없는 것이 이 함수의 본론이다.**
 *
 * | 빼는 것 | 왜 |
 * | --- | --- |
 * | 작업자(`workerId`) | 서버가 귀속 헤더 `X-Worker-No` 에서 푼다 — 계약에 칸 자체가 없다 |
 * | 입력 단말(`terminalId`) | 서버가 요청을 인증한 단말 토큰에서 푼다 — 화면이 토큰을 열지 않는다(F-2) |
 * | 교대(`shiftId`) | 이 화면은 교대를 받지 않는다 — 고르는 칸도 시각으로 계산하는 코드도 두지 않는다 |
 * | 타발수 | `P-05-01` 소관이다. 두 화면이 같은 증분을 보내면 이중 가산이 검출되지 않는다(B-18) |
 * | 불량·보류·스크랩·재작업 수량 | 정본이 「양품만 입력」(R50)이다. 서버가 기본 0 으로 둔다 |
 * | 사후입력 사유(`lateEntryReasonCode`) | 임계값을 읽을 경로가 계약에 없다 — 만들지 않는다(스펙 §8 #4) |
 * | 실적 순번(`result_sequence`) | 서버가 채번한다. 클라이언트 임의 채번 금지(스펙 §6) |
 *
 * ⛔⛔ **`resultSourceCode` 는 다시 필수다**(2026-09-11 전달본). 설계 변동 공지
 * `CREFLEINC/omf-mes#507` 은 이 칸을 계약 `required` 에서 빼고 「화면이 보내지 않는다」로
 * 정리했었는데, 지금 생성 타입은 다시 `resultSourceCode: "MANUAL" | "IOT"` 를 필수로 요구한다
 * — 그런데 계약 설명은 그대로 「⭐ 서버가 안다 — 화면이 고르는 값이 아니다」다. **required 인데
 * 화면이 고르지 말라는 값**이라는 모순이 새로 생겼다(발견한 차이 — 보고 대상, 임의로 결론
 * 내리지 않는다). 두 값 중 이 화면은 사람이 입력하는 POP 단말이라 `IOT` 일 수 없어, 남는
 * `MANUAL` 을 싣는다 — 지어낸 값이 아니라 계약의 두 갈래 중 이 화면에 해당하는 유일한 값이다.
 */
export const buildSaveBody = (input: SaveInput): ProductionResultCreate => {
  const remarks = input.draft.remarks.trim();

  return {
    workOrderId: input.workOrderId,
    goodQty: input.goodQty,
    uomId: input.uomId,
    occurredAt: input.occurredAt,
    /* 실적↔LOT 배분은 본문에 싣는다 — 독립 경로를 두지 않는다(계약 명시). */
    lotAllocations: [{ lotId: input.lotId, allocatedQty: input.goodQty }],
    /* 빈 비고는 «안 적은 것»이다. 빈 문자열을 보내면 「빈 값을 적었다」가 된다. */
    ...(remarks === '' ? {} : { remarks }),
    resultSourceCode: 'MANUAL',
  };
};
