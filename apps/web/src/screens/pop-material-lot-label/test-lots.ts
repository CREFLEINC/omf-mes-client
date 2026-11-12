/**
 * 이 화면의 시험 전용 합성 값 — 런타임 코드는 이 모듈을 참조하지 않는다. 값은 **전부 지어낸 것이다**(공개 저장소 경계).
 */
import type { LabelLot } from './types';

export const labelLot = (lotId: number, over: Partial<LabelLot> = {}): LabelLot => ({
  lotId,
  lotNo: `SYN-ITEM-01|1000|261111|SYN-P-01|${String(lotId).padStart(4, '0')}`,
  supplierId: 8201,
  supplierCode: 'SYN-P-01',
  supplierName: '합성 공급사 가',
  itemId: 8601,
  itemCode: 'SYN-ITEM-01',
  itemName: '합성 품목 가',
  uomCode: 'EA',
  lotQty: 1000,
  package: { uomId: 8402, uomCode: '봉지', uomName: '봉지', count: 10, qtyPerPackage: 100 },
  supplierLotNo: null,
  lifecycleStatusCode: 'WAITING',
  statusCode: 'INSPECTION_PENDING',
  inboundLotNo: null,
  inspectionRequired: false,
  lastIssue: null,
  ...over,
});
