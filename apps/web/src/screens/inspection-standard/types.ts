import type { components } from '@omf-mes/api-client';

/**
 * W-06-02 화면 슬라이스의 계약.
 * api-client는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 *
 * 이 파일은 이 화면이 소유한다. 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다 —
 * 리소스 이름이 박힌 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 */

export type InspectionPlan = components['schemas']['InspectionPlan'];
export type InspectionPlanVersion = components['schemas']['InspectionPlanVersion'];
export type InspectionItemSpec = components['schemas']['InspectionItemSpec'];
export type PageMeta = components['schemas']['PageMeta'];

/**
 * 좌 페인의 조회 조건. URL이 소유하며 화면 상태로 복제하지 않는다.
 *
 * `includeInactive`는 **켜졌을 때만** 서버로 보낸다. 계약의 기본값이 false라
 * 끈 상태를 값으로 실어 보내면 「보내지 않음」과 「false를 보냄」 두 상태가 생겨 캐시 키가 갈린다.
 */
export interface PlanFilters {
  q: string;
  inspectionTypeCode: string;
  includeInactive: boolean;
}

/**
 * 기준 헤더 폼 값. 전부 문자열인 이유는 DS 입력·선택이 문자열을 다루기 때문이다.
 * 계약 표현(숫자·널)으로의 변환은 `plan-mappers.ts`가 맡는다.
 */
export interface PlanFormValues {
  inspectionPlanCode: string;
  inspectionPlanName: string;
  inspectionTypeCode: string;
  /** 비우면 「전 품목 공통 기준」이다 — 계약이 널을 허용한다. */
  itemId: string;
  /** IQC에는 공정이 없다 — 계약이 널을 허용한다. */
  processId: string;
  /** 품목을 고른 뒤에만 고를 수 있다 — 계약의 라우팅 조회가 품목을 필수로 둔다. */
  routingId: string;
}

/** 버전 헤더 폼 값. 마찬가지로 전부 문자열이며 변환은 `version-mappers.ts`가 맡는다. */
export interface VersionFormValues {
  effectiveFrom: string;
  effectiveTo: string;
  samplingMethodCode: string;
  /** **비율(%)**이다. 수량이 아니다 — 0 초과 100 이하이며 소수를 받는다(#201). */
  samplingRatio: string;
  aqlValue: string;
  acceptanceNumber: string;
  rejectionNumber: string;
  inspectionFrequencyCode: string;
  frequencyIntervalValue: string;
  frequencyIntervalUomCode: string;
}

/**
 * 검사 항목 한 행의 로컬 초안.
 *
 * 순서 값(`sequenceNo`)을 담지 않는다 — 순서는 이 초안 배열의 **위치**이고,
 * 저장할 때 1부터 연속으로 다시 매긴다(공유계약 A-5). 서버가 준 채번 값을 들고 다니면
 * 화면이 그것을 표시하거나 되돌려 보낼 여지가 생긴다.
 */
export interface ItemDraft {
  /**
   * 초안 안에서 행을 구분하는 안정된 키. 표의 행 식별자·React key로 쓴다.
   * 아직 저장되지 않은 행에도 있어야 하므로 서버 식별자와 별개로 둔다.
   */
  draftId: string;
  /**
   * 기존 행의 서버 식별자. 새 행이면 null.
   * 전체 치환은 「행 교체」가 아니다 — 이 값을 버리면 서버가 행을 새로 만들 수밖에 없고
   * 측정 기록이 참조하던 행이 무너진다.
   */
  inspectionItemSpecId: number | null;
  inspectionItemCode: string;
  inspectionItemName: string;
  dataTypeCode: string;
  uomId: string;
  targetValue: string;
  lowerLimit: string;
  upperLimit: string;
  measurementCount: string;
  inspectionMethodCode: string;
  defaultInspectionEquipmentId: string;
  requiredFlag: boolean;
  automaticJudgment: boolean;
}

/**
 * 선택 목록의 원본 항목. 사용 여부를 함께 들고 있어야
 * 「사용 중인 것 + 지금 선택된 값」만 선택지로 낼 수 있다.
 */
export interface LookupEntry {
  value: string;
  label: string;
  isActive: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}
