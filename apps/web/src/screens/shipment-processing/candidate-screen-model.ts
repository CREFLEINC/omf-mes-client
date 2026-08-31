import type { ShipmentProcessingCandidateFilters } from './queries';

/**
 * 후보 화면의 상태 기계 — `work-order-close/candidate-screen-model.ts`를 구조 원형으로 삼는다
 * (계획서 결정). 그 화면과 달리 필터 초기화에 비동기 조회가 필요 없다(공통코드 상태값이
 * 아니라 사용자가 직접 채우는 출하일 범위라서) — 그래서 `initializationKind` 단계가 없다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface ShipmentProcessingFilterValues {
  shipDateFrom: string;
  shipDateTo: string;
  pickingCompleteOnly: boolean;
}

export interface ShipmentProcessingCandidateScreenState {
  appliedFilters: ShipmentProcessingFilterValues;
  page: number;
  selectedShipmentRequestId: number | null;
}

export type ShipmentProcessingCandidateSnapshot =
  | { kind: 'PENDING' }
  | { kind: 'FAILED' }
  | { kind: 'ABSENT' }
  | { kind: 'SETTLED'; candidateIds: readonly number[] };

export type ShipmentProcessingCandidateScreenAction =
  | { type: 'SEARCH'; filters: ShipmentProcessingFilterValues }
  | { type: 'RESET' }
  | { type: 'CHANGE_PAGE'; page: number }
  | { type: 'SELECT'; shipmentRequestId: number }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'CLEAR_MISSING_SELECTION'; snapshot: ShipmentProcessingCandidateSnapshot };

/*
 * 「피킹완료만」을 기본으로 켠다 — 이 화면의 목적 자체가 처리 대기 후보를 다루는 것이라,
 * 꺼진 채 처음 열리면 대부분의 행이 아직 손댈 수 없는 상태로 보인다.
 */
export const EMPTY_SHIPMENT_PROCESSING_FILTERS: ShipmentProcessingFilterValues = {
  shipDateFrom: '',
  shipDateTo: '',
  pickingCompleteOnly: true,
};

export const createShipmentProcessingCandidateScreenState =
  (): ShipmentProcessingCandidateScreenState => ({
    appliedFilters: { ...EMPTY_SHIPMENT_PROCESSING_FILTERS },
    page: 1,
    selectedShipmentRequestId: null,
  });

export const reduceShipmentProcessingCandidateScreen = (
  state: ShipmentProcessingCandidateScreenState,
  action: ShipmentProcessingCandidateScreenAction,
): ShipmentProcessingCandidateScreenState => {
  switch (action.type) {
    case 'SEARCH':
      return { appliedFilters: { ...action.filters }, page: 1, selectedShipmentRequestId: null };
    case 'RESET':
      return {
        appliedFilters: { ...EMPTY_SHIPMENT_PROCESSING_FILTERS },
        page: 1,
        selectedShipmentRequestId: null,
      };
    case 'CHANGE_PAGE':
      return { ...state, page: action.page, selectedShipmentRequestId: null };
    case 'SELECT':
      return { ...state, selectedShipmentRequestId: action.shipmentRequestId };
    case 'CLEAR_SELECTION':
      return state.selectedShipmentRequestId === null
        ? state
        : { ...state, selectedShipmentRequestId: null };
    case 'CLEAR_MISSING_SELECTION':
      if (
        action.snapshot.kind !== 'SETTLED' ||
        state.selectedShipmentRequestId === null ||
        action.snapshot.candidateIds.includes(state.selectedShipmentRequestId)
      ) {
        return state;
      }
      return { ...state, selectedShipmentRequestId: null };
  }
};

const optionalFilter = (value: string): string | null => (value === '' ? null : value);

export const toShipmentProcessingCandidateFilters = (
  state: ShipmentProcessingCandidateScreenState,
): ShipmentProcessingCandidateFilters => {
  const shipDateFrom = state.appliedFilters.shipDateFrom.trim();
  const shipDateTo = optionalFilter(state.appliedFilters.shipDateTo);
  const isValidRange = shipDateFrom === '' || shipDateTo === null || shipDateFrom <= shipDateTo;
  const canLoad = shipDateFrom !== '' && isValidRange;

  return {
    shipDateFrom: canLoad ? shipDateFrom : null,
    shipDateTo: canLoad ? shipDateTo : null,
    page: state.page,
  };
};
