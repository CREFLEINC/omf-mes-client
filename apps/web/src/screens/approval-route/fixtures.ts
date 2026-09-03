import { routeToFormValues } from './route-request';
import { toStepDrafts, type StepDraft } from './step-draft';
import type {
  AppUser,
  ApprovalRoute,
  ApprovalRouteStep,
  RouteFormValues,
  RouteView,
} from './types';
import { toRouteView } from './types';

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
 * 미사용 사업부의 이름. **표기에는 미사용 표식이 붙지 않는다** — 표식은 고르는 자리
 * (선택지)에만 붙고, 이미 그 사업부를 가리키는 결재선의 이름은 그대로 읽혀야 한다.
 */
export const INACTIVE_BUSINESS_UNIT_LABEL = 'SAMPLE-BU-02 · 합성사업부 나';

/**
 * 결재선 셋. **9001과 9002는 승인 유형이 같고 사업부만 다르다** —
 * 「사업부 지정본과 전 사업부 공통본은 다른 결재선이다」가 목록에서 읽혀야 한다.
 */
const routeWithUnit: ApprovalRoute = {
  approvalRouteId: 9001,
  approvalTypeCode: 'PURCHASE_ORDER',
  businessUnitId: 9101,
  minValue: 100,
  maxValue: 500,
  isActive: true,
  stepCount: 2,
  inProgressCount: 3,
};

export const routeFixtures: ApprovalRoute[] = [
  routeWithUnit,
  {
    approvalRouteId: 9002,
    approvalTypeCode: 'PURCHASE_ORDER',
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
    approvalTypeCode: 'INVENTORY_ADJUSTMENT',
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

/**
 * 9001을 폼에 세운 값. 「고친 것이 없다」의 기준이 되는 자리다.
 * **응답 픽스처에서 파생시킨다** — 손으로 적으면 둘이 조용히 어긋난다.
 */
export const routeFormValuesFixture: RouteFormValues = routeToFormValues(
  toRouteView(routeWithUnit),
);

/**
 * 등록이 만들어 내는 결재선. **단계가 0이고 사용 중이다** — 계약이 등록 본문에 단계를 받지
 * 않고 신규는 항상 사용 중이라, 만든 그 순간 「사용 중인데 단계가 0인 결재선」이 생긴다.
 */
export const createdRouteFixture: ApprovalRoute = {
  approvalRouteId: 9004,
  approvalTypeCode: 'GOODS_ISSUE_DISPOSAL',
  businessUnitId: null,
  minValue: null,
  maxValue: null,
  isActive: true,
  stepCount: 0,
  inProgressCount: 0,
};

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

export const stepDraftFixtures: StepDraft[] = toStepDrafts(stepFixtures);

/**
 * 승인자 후보 셋. **9301은 이미 결재선 9001의 1단계에 있다** — 같은 승인자를 두 단계에 두는
 * 길(경고하되 막지 않는다)을 화면에서 실제로 걸을 수 있어야 한다.
 *
 * 계약의 사용자 목록은 **부서 번호만** 준다 — 단계 응답이 주는 표시용 부서 이름에 해당하는
 * 값이 없어 픽스처에도 그 자리가 없다.
 */
export const userFixtures: AppUser[] = [
  {
    appUserId: 9301,
    loginId: 'sample.user1',
    userName: '합성 승인자1',
    departmentId: 9401,
    statusCode: 'SAMPLE-STATUS',
    isActive: true,
  },
  {
    appUserId: 9304,
    loginId: 'sample.user4',
    userName: '합성 승인자4',
    departmentId: null,
    statusCode: 'SAMPLE-STATUS',
    isActive: true,
  },
  {
    appUserId: 9305,
    loginId: 'sample.user5',
    userName: '합성 승인자5',
    departmentId: 9401,
    statusCode: 'SAMPLE-STATUS',
    isActive: true,
  },
];

export const APPROVER_OPTION_LABEL = '합성 승인자4 · sample.user4';
