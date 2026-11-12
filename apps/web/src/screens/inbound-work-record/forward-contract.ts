import type {
  InboundLot,
  InboundLotAllocationCandidate,
  InboundLotDetail,
  InboundLotFinalizeBlocker,
  InboundLotMaterialLot,
  InboundLotPoAllocation,
  InboundLotWorkRecordErrorDetails,
} from '@omf-mes/api-client';

/**
 * W-01-16 이 읽는 API 모양 — 선행 계약(`packages/api-client/src/forward-005-work-record.ts` · `forward-contract.ts`,
 * 설계 계약 §2 · §5)의 별칭이다. 서버 S12 병합 뒤 `gen:api` 로 다시 만들면(T111) 이 별칭이 생성 타입을 가리키게 된다.
 * 계약에 이름이 없어 화면이 정한 칸은 api-client 쪽 주석에 「(C6 정함)」으로 적었다.
 */
export type WorkRecordLot = InboundLot;
export type WorkRecordDetail = InboundLotDetail;
export type Candidate = InboundLotAllocationCandidate;
export type Allocation = InboundLotPoAllocation;
export type MaterialLot = InboundLotMaterialLot;
export type FinalizeBlocker = InboundLotFinalizeBlocker;
export type ErrorDetails = InboundLotWorkRecordErrorDetails;
