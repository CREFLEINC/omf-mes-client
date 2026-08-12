import type { ApprovalRoute, ApprovalRouteStep, RouteView, StepView } from './types';
import { toRouteView, toStepView } from './types';

/**
 * 합성 테스트 자료.
 *
 * **실 운영 값을 쓰지 않는다.** 계약의 `@example` 값도 쓰지 않는다 — 그것은 예시이지
 * 확정이 아니고, 픽스처에 심으면 화면 코드보다 오래 남아 나중에 「이 값이 정본이었다」로 읽힌다.
 * 번호는 9000대 합성 대역, 코드는 `SAMPLE-` 접두, 이름은 「합성…」으로 지어낸다.
 *
 * **놓치기 쉬운 입력을 처음부터 담는다** — 사업부를 비운 결재선과 지정한 결재선이 같은 유형으로
 * 함께 있고, 단계가 0인 결재선과 진행 중 건수가 0인 결재선이 있으며, 미사용 결재선이 있다.
 * 단계에는 이름이 오지 않은 것과 승인자가 사용 중지된 것이 있다.
 */

/** `/mdm/business-units` 응답의 항목. 하나는 미사용이라 표식이 붙는다. */
export const businessUnitFixtures = [
  {
    businessUnitId: 9101,
    businessUnitCode: 'SAMPLE-BU-01',
    businessUnitName: '합성사업부 가',
    isActive: true,
  },
  {
    businessUnitId: 9102,
    businessUnitCode: 'SAMPLE-BU-02',
    businessUnitName: '합성사업부 나',
    isActive: false,
  },
];

export const BUSINESS_UNIT_LABEL = 'SAMPLE-BU-01 · 합성사업부 가';

/**
 * 결재선 셋. **9001과 9002는 승인 유형이 같고 사업부만 다르다** —
 * 「사업부 지정본과 전 사업부 공통본은 다른 결재선이다」가 목록에서 읽혀야 한다.
 */
export const routeFixtures: ApprovalRoute[] = [
  {
    approvalRouteId: 9001,
    approvalTypeCode: 'SAMPLE-TYPE-A',
    businessUnitId: 9101,
    minValue: 100,
    maxValue: 500,
    isActive: true,
    stepCount: 2,
    inProgressCount: 3,
  },
  {
    approvalRouteId: 9002,
    approvalTypeCode: 'SAMPLE-TYPE-A',
    businessUnitId: null,
    minValue: null,
    maxValue: null,
    isActive: true,
    /** 단계가 0이다 — 이 유형의 상신이 거부된다. 목록에 표식이 선다. */
    stepCount: 0,
    inProgressCount: 0,
  },
  {
    approvalRouteId: 9003,
    approvalTypeCode: 'SAMPLE-TYPE-B',
    businessUnitId: 9102,
    /** 하한만 있는 값 구간. 「전 구간」·「양쪽 다」와 표기가 갈린다. */
    minValue: 0,
    maxValue: null,
    isActive: false,
    stepCount: 1,
    inProgressCount: 0,
  },
];

export const routeViewFixtures: RouteView[] = routeFixtures.map(toRouteView);

/** 결재선 9001의 단계 셋. 정상 · 승인자 사용 중지 · 이름 미도착. */
export const stepFixtures: ApprovalRouteStep[] = [
  {
    approvalRouteStepId: 9201,
    stepNo: 1,
    approverTypeCode: 'USER',
    approverUserId: 9301,
    approverName: '합성 승인자1',
    approverDepartmentName: '합성부서 가',
    approverIsActive: true,
  },
  {
    approvalRouteStepId: 9202,
    stepNo: 2,
    approverTypeCode: 'USER',
    approverUserId: 9302,
    approverName: '합성 승인자2',
    approverDepartmentName: '합성부서 나',
    /** 승인자가 사용 중지 상태다 — 그 단계에서 결재가 멈춘다. 경고하되 막지 않는다. */
    approverIsActive: false,
  },
  {
    approvalRouteStepId: 9203,
    stepNo: 3,
    approverTypeCode: 'USER',
    approverUserId: 9303,
    /** 계약이 표시 이름을 필수로 두지 않았다 — 번호를 대신 내지 않는다. */
    approverIsActive: true,
  },
];

export const stepViewFixtures: StepView[] = stepFixtures.map(toStepView);
