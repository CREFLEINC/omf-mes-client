import type { InspectionItemSpec, InspectionPlan, InspectionPlanVersion } from './types';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다(`SYN-` 계열). 실제 사번·품목코드·LOT 번호·
 * 거래처 코드·고객사명·공장 위치를 넣지 않는다(공개 저장소 경계).
 */

/**
 * 기준 3건. 검사 유형 셋을 한 벌씩 담아 유형 표시를 볼 수 있게 했다.
 * 1003은 **품목이 널**(전 품목 공통 기준)이고 **미사용**이며 **이미 승인된** 건이다 —
 * 라우팅 선택 잠금·미사용 표시·승인 비활성 사유를 한 픽스처에서 볼 수 있다.
 */
export const inspectionPlanFixtures: InspectionPlan[] = [
  {
    inspectionPlanId: 3001,
    inspectionPlanCode: 'SYN-PLAN-01',
    inspectionPlanName: '합성 검사기준 A',
    itemId: 5001,
    processId: null,
    routingId: null,
    inspectionTypeCode: 'IQC',
    approvedBy: null,
    approvedAt: null,
    isActive: true,
  },
  {
    inspectionPlanId: 3002,
    inspectionPlanCode: 'SYN-PLAN-02',
    inspectionPlanName: '합성 검사기준 B',
    itemId: 5001,
    processId: 9001,
    routingId: 7003,
    inspectionTypeCode: 'PQC',
    approvedBy: null,
    approvedAt: null,
    isActive: true,
  },
  {
    inspectionPlanId: 3003,
    inspectionPlanCode: 'SYN-PLAN-03',
    inspectionPlanName: '합성 검사기준 C',
    itemId: null,
    processId: null,
    routingId: null,
    inspectionTypeCode: 'OQC',
    approvedBy: 4001,
    approvedAt: '2026-08-04T09:12:00+09:00',
    isActive: false,
  },
];

/**
 * 한 기준의 버전 2판. 계약이 판 번호 내림차순(최신이 위)으로 준다고 정했으므로
 * 픽스처도 그 순서로 둔다 — 화면은 받은 순서를 그대로 그린다.
 *
 * 4002는 **작성중**, 4001은 **확정**이다 — 편집 잠금 대비를 한 픽스처에서 볼 수 있다.
 * `acceptanceNumber`를 일부러 **0**으로 둔다: 계약이 합격판정개수에만 0을 허용하므로
 * 0이 「지정하지 않음」으로 뭉개지지 않는지 확인하는 것이 이 값의 목적이다.
 */
export const inspectionPlanVersionFixtures: InspectionPlanVersion[] = [
  {
    inspectionPlanVersionId: 4002,
    inspectionPlanId: 3001,
    planVersion: 2,
    effectiveFrom: '2026-08-01',
    effectiveTo: null,
    samplingMethodCode: 'PENDING',
    samplingQty: 30,
    aqlValue: null,
    acceptanceNumber: 0,
    rejectionNumber: 2,
    inspectionFrequencyCode: 'PENDING',
    frequencyIntervalValue: null,
    frequencyIntervalUomCode: null,
    statusCode: 'DRAFT',
  },
  {
    inspectionPlanVersionId: 4001,
    inspectionPlanId: 3001,
    planVersion: 1,
    effectiveFrom: '2026-07-01',
    effectiveTo: '2026-07-31',
    samplingMethodCode: 'PENDING',
    samplingQty: 20,
    aqlValue: 1,
    acceptanceNumber: 1,
    rejectionNumber: 3,
    inspectionFrequencyCode: 'PENDING',
    frequencyIntervalValue: 4,
    frequencyIntervalUomCode: 'PENDING',
    statusCode: 'CONFIRMED',
  },
];

/**
 * 한 버전의 검사 항목 2건.
 *
 * **순서 값을 일부러 10·20으로 둔다.** 서버 채번은 서버 재량이고 화면은 그 값을 보이지 않는다 —
 * 표시 번호가 1·2로 나오는지 확인하는 것이 이 픽스처의 목적이다.
 * 5102는 선택 값을 전부 비워 「지정하지 않음」 표기를 함께 볼 수 있게 했다.
 */
export const inspectionItemSpecFixtures: InspectionItemSpec[] = [
  {
    inspectionItemSpecId: 5101,
    inspectionPlanVersionId: 4002,
    sequenceNo: 10,
    inspectionItemCode: 'SYN-ITEM-CODE-01',
    inspectionItemName: '합성 항목 A',
    dataTypeCode: 'PENDING',
    uomId: 41,
    targetValue: 10,
    lowerLimit: 9,
    upperLimit: 11,
    measurementCount: 3,
    inspectionMethodCode: 'PENDING',
    defaultInspectionEquipmentId: 6001,
    requiredFlag: true,
    automaticJudgment: true,
  },
  {
    inspectionItemSpecId: 5102,
    inspectionPlanVersionId: 4002,
    sequenceNo: 20,
    inspectionItemCode: 'SYN-ITEM-CODE-02',
    inspectionItemName: '합성 항목 B',
    dataTypeCode: 'PENDING',
    uomId: null,
    targetValue: null,
    lowerLimit: null,
    upperLimit: null,
    measurementCount: 1,
    inspectionMethodCode: null,
    defaultInspectionEquipmentId: null,
    requiredFlag: false,
    automaticJudgment: false,
  },
];
