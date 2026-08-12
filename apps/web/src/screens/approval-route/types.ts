import type { components } from '@omf-mes/api-client';

/**
 * W-06-15 화면 슬라이스의 계약과 화면 타입.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 *
 * 이 파일은 이 화면이 소유한다. **다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다** —
 * 형태가 같아도 리소스 이름이 박힌 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 */

export type ApprovalRoute = components['schemas']['ApprovalRoute'];
export type ApprovalRouteStep = components['schemas']['ApprovalRouteStep'];
export type PageMeta = components['schemas']['PageMeta'];

/** 선택 목록의 원본 항목. 사용 여부를 함께 들고 있어야 미사용 값에 표식을 붙일 수 있다. */
export interface LookupEntry {
  value: string;
  label: string;
  isActive: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
  /** 디자인 시스템 `Select`가 옵션별 잠금을 지원한다. 고를 수 없는 선택지를 감추지 않고 잠근다. */
  disabled?: boolean;
}

/**
 * 좌 칸의 조회 조건. **주소가 소유하며 화면 상태로 복제하지 않는다.**
 *
 * `businessUnitId`가 문자열인 이유는 디자인 시스템 선택칸이 문자열을 다루기 때문이다.
 * 계약 표현(숫자)으로의 변환은 `filters.ts`가 맡는다.
 *
 * **`includeInactive`가 계약 파라미터와 방향이 반대다.** 계약은 `activeOnly`이고 기본값이 없다 —
 * 화면 어휘를 다른 화면과 맞추고(「미사용 포함」) 뒤집는 자리를 `filters.ts` 한 곳에 둔다.
 */
export interface RouteFilters {
  /** 승인 유형 코드. 값 목록이 확정되지 않아 지금은 고를 선택지가 없다(`code-options.ts`). */
  approvalTypeCode: string;
  /** 비면 「전체 사업부」다 — 결재선의 「전 사업부 공통」과 다른 뜻이다. */
  businessUnitId: string;
  includeInactive: boolean;
  q: string;
}

/**
 * 목록 행과 상세가 함께 쓰는 결재선 표시 값.
 *
 * **계약의 세 상태를 화면의 두 상태로 줄이는 것이 이 타입의 일이다.** 계약의 선택 필드는
 * `undefined`(응답에 없음)·`null`(비움)·값 셋을 갖는데 화면에서 그 앞 둘은 같은 뜻이다.
 * 줄이지 않으면 읽는 자리마다 `?? null`이 흩어지고, 한 자리라도 빠뜨리면 그 자리에서만
 * 「비었다」와 「안 왔다」가 갈린다.
 */
export interface RouteView {
  approvalRouteId: number;
  approvalTypeCode: string;
  /** `null`이면 「전 사업부 공통」이다. 값이 없는 것이지 잘못된 것이 아니다. */
  businessUnitId: number | null;
  minValue: number | null;
  maxValue: number | null;
  isActive: boolean;
  /** 파생값. 0이면 그 유형의 상신이 거부된다 — 화면이 표식을 낸다. */
  stepCount: number;
  /** 파생값. 결재선을 고쳐도 이 요청들은 지금의 결재선으로 끝난다. */
  inProgressCount: number;
}

/** `??`는 0을 통과시킨다. `||`로 줄이면 값 구간 하한 0이 「없음」이 되어 뜻이 바뀐다. */
const toNullable = (value: number | null | undefined): number | null => value ?? null;

export const toRouteView = (route: ApprovalRoute): RouteView => ({
  approvalRouteId: route.approvalRouteId,
  approvalTypeCode: route.approvalTypeCode,
  businessUnitId: toNullable(route.businessUnitId),
  minValue: toNullable(route.minValue),
  maxValue: toNullable(route.maxValue),
  isActive: route.isActive,
  stepCount: route.stepCount,
  inProgressCount: route.inProgressCount,
});

/**
 * 단계 표시 값.
 *
 * **승인자 번호를 담지 않는다.** 계약이 표시용 이름을 함께 내려 주므로 화면이 사용자 목록을
 * 다시 부를 일이 없고, 이름을 못 풀었을 때 번호를 대신 낼 이유도 없다 —
 * 담을 자리가 없으면 화면으로 샐 경로도 없다. 단계를 편집하는 회차가 그 번호를 쓰지만,
 * 그때는 계약 타입에서 직접 초안을 만든다.
 */
export interface StepView {
  approvalRouteStepId: number;
  stepNo: number;
  /** 없으면 `null`. 번호로 대신하지 않고 「확인할 수 없습니다」로 적는다. */
  approverName: string | null;
  approverDepartmentName: string | null;
  /** 거짓이면 그 단계에서 결재가 멈춘다. 화면이 경고하되 막지 않는다. */
  approverIsActive: boolean;
}

/**
 * 서버가 빈 문구를 주는 일이 실제로 있다. `??`는 빈 문자열을 통과시켜
 * 승인자 칸을 이유 없이 비운다 — 없는 것과 같이 다룬다.
 */
const toDisplayName = (value: string | undefined): string | null =>
  value === undefined || value === '' ? null : value;

export const toStepView = (step: ApprovalRouteStep): StepView => ({
  approvalRouteStepId: step.approvalRouteStepId,
  stepNo: step.stepNo,
  approverName: toDisplayName(step.approverName),
  approverDepartmentName: toDisplayName(step.approverDepartmentName),
  approverIsActive: step.approverIsActive,
});
