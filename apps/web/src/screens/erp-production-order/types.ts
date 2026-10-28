import type { components, paths } from '@omf-mes/api-client';

/**
 * 이 화면이 다루는 계약 타입의 별칭. 화면 슬라이스끼리 타입을 나눠 쓰지 않는다 —
 * 다른 화면(특히 MES 작업 화면 `production-order`)의 같은 이름 타입을 가져다 쓰면 그쪽 사정이 이 화면을 바꾼다.
 */

type ContractProductionOrder = components['schemas']['ProductionOrder'];

/**
 * ERP W/O 한 건. 계약 `ProductionOrder` 에 서버가 더한 계약 밖 칸 넷을 얹는다
 * (omf-mes-server#737 · 장부 P-66 `plannedStartDate` · P-67 나머지 셋). **값이 없으면 키가 빠진다.**
 * 계약에 실려 오면(장부 「사본을 당길 때 ⓐ」) 이 얹기를 걷는다. 최근 ERP 변경(`lastChange`)은 목록이 `withLastChange` 를
 * 켜지 않아 오지 않으므로 뺀다.
 */
export type ErpProductionOrder = Omit<ContractProductionOrder, 'lastChange'> & {
  /** ERP `PLAN_START_DT`(YYYY-MM-DD). ERP W/O 의 날짜는 이것 하나다 — 납기는 비어 온다(P-66). */
  plannedStartDate?: string;
  /** ERP `OPR_NO` — 공정번호(최대 3자). */
  erpOperationNo?: string;
  /** ERP `SL_CD` — 창고 코드. 이름은 공통코드 `SL_TYPE` 에서 찾는다(P-67). */
  erpStorageLocationCode?: string;
  /** ERP `RE_WORK_FLG` — 재작업 표지 문자열(최대 2자, 받은 값 그대로. 보통 `Y`·`N`). */
  erpReworkFlag?: string;
};

type ContractListQuery = NonNullable<
  paths['/planning/production-orders']['get']['parameters']['query']
>;

/**
 * 목록 질의. 계약 질의에 서버가 더한 계획 시작일 범위를 얹는다(omf-mes-server#737 · 장부 P-66 —
 * `YYYY-MM-DD`, 양끝 포함, 형식을 어기면 400 `INVALID`). 계약 검증이 보지 않는 질의라 생성 타입에 없다.
 */
export type ErpProductionOrderListQuery = Pick<
  ContractListQuery,
  'q' | 'itemId' | 'statusCode' | 'page' | 'size'
> & {
  plannedStartDateFrom?: string;
  plannedStartDateTo?: string;
};

export interface PageMeta {
  page: number;
  size: number;
  total: number;
}

export interface ErpProductionOrderListResult {
  items: ErpProductionOrder[];
  page: PageMeta;
}

export interface SelectOption {
  value: string;
  label: string;
}
