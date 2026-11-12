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
 * W-01-16 이 읽는 API 모양 — 생성 타입(`@omf-mes/api-client` · 설계 계약 §2 · §5)의 별칭이다.
 */
export type WorkRecordLot = InboundLot;
export type WorkRecordDetail = InboundLotDetail;
export type Candidate = InboundLotAllocationCandidate;
export type Allocation = InboundLotPoAllocation;
export type MaterialLot = InboundLotMaterialLot;
export type FinalizeBlocker = InboundLotFinalizeBlocker;
export type ErrorDetails = InboundLotWorkRecordErrorDetails;
