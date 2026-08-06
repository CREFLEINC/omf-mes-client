import type { InspectionPlan } from './types';

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
