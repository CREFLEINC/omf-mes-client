import type { components } from '@omf-mes/api-client';

/**
 * W-06-01 화면 슬라이스의 계약.
 * api-client는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 *
 * 이 파일은 이 화면이 소유한다. 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다 —
 * 리소스 이름이 박힌 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 */

export type Routing = components['schemas']['Routing'];
export type RoutingOperation = components['schemas']['RoutingOperation'];
export type Item = components['schemas']['Item'];
export type Process = components['schemas']['Process'];
export type ProcessDetailResponse = components['schemas']['ProcessDetailResponse'];

export interface ProcessFilters {
  q: string;
  includeInactive: boolean;
}

export interface ProcessFormValues {
  processCode: string;
  processName: string;
  processTypeCode: string;
}

/** 좌 페인의 조회 조건. URL이 소유하며 화면 상태로 복제하지 않는다. */
export interface ItemFilters {
  q: string;
  /** 켜면 `hasRouting=false`를 보낸다. 끄면 파라미터를 보내지 않는다 — true는 「보유한 것만」이 되어 뜻이 달라진다. */
  onlyWithoutRouting: boolean;
}

/** 폼 값이 전부 문자열인 이유: DS 입력·선택이 문자열을 다룬다. 계약 표현으로의 변환은 mappers.ts가 맡는다. */
export interface RoutingHeaderFormValues {
  routingCode: string;
  effectiveFrom: string;
  effectiveTo: string;
}

/**
 * 공정 라인 한 행의 로컬 초안.
 *
 * 순서 값(`operationSeq`)을 담지 않는다 — 순서는 이 초안 배열의 **위치**이고,
 * 저장할 때 1부터 연속으로 다시 매긴다(공유계약 A-5). 서버가 준 채번 값을 들고 다니면
 * 화면이 그것을 표시하거나 되돌려 보낼 여지가 생긴다.
 */
export interface OperationDraft {
  /**
   * 초안 안에서 행을 구분하는 안정된 키. 표의 행 식별자·React key로 쓴다.
   * 아직 저장되지 않은 행에도 있어야 하므로 서버 식별자와 별개로 둔다.
   */
  draftId: string;
  /**
   * 기존 행의 서버 식별자. 새 행이면 null.
   * 전체 치환은 「행 교체」가 아니다 — 이 값을 버리면 서버가 행을 새로 만들 수밖에 없고
   * 진행 중 작업지시가 참조하던 행이 사라진다.
   */
  routingOperationId: number | null;
  processId: string;
  operationName: string;
  mesManaged: boolean;
  materialInputManaged: boolean;
  productionResultManaged: boolean;
  inspectionManaged: boolean;
  outputLotRequired: boolean;
  equipmentRequired: boolean;
  moldRequired: boolean;
  /** 단위는 초. 빈 문자열은 「지정하지 않음」이며 계약의 널로 옮긴다. */
  standardCycleTimeSec: string;
  /** 0~1 비율. 퍼센트가 아니다. */
  standardYieldRate: string;
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
