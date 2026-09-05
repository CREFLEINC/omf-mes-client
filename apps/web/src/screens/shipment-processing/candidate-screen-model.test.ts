import { describe, expect, it } from 'vitest';

import {
  createShipmentProcessingCandidateScreenState,
  EMPTY_SHIPMENT_PROCESSING_FILTERS,
  reduceShipmentProcessingCandidateScreen,
  toShipmentProcessingCandidateFilters,
  type ShipmentProcessingCandidateScreenState,
} from './candidate-screen-model';

describe('createShipmentProcessingCandidateScreenState', () => {
  it('피킹완료만을 기본으로 켠 채 시작한다', () => {
    const state = createShipmentProcessingCandidateScreenState();

    expect(state).toEqual({
      appliedFilters: EMPTY_SHIPMENT_PROCESSING_FILTERS,
      page: 1,
      selectedShipmentRequestId: null,
    });
    expect(state.appliedFilters.pickingCompleteOnly).toBe(true);
  });
});

describe('reduceShipmentProcessingCandidateScreen', () => {
  const selected: ShipmentProcessingCandidateScreenState = {
    appliedFilters: { shipDateFrom: '2026-08-24', shipDateTo: '', pickingCompleteOnly: false },
    page: 2,
    selectedShipmentRequestId: 501,
  };

  it('SEARCH는 필터를 적용하고 쪽·선택을 되돌린다', () => {
    const next = reduceShipmentProcessingCandidateScreen(selected, {
      type: 'SEARCH',
      filters: { shipDateFrom: '2026-08-25', shipDateTo: '2026-08-31', pickingCompleteOnly: true },
    });

    expect(next.appliedFilters).toEqual({
      shipDateFrom: '2026-08-25',
      shipDateTo: '2026-08-31',
      pickingCompleteOnly: true,
    });
    expect(next.page).toBe(1);
    expect(next.selectedShipmentRequestId).toBeNull();
  });

  it('RESET은 기본값으로 되돌린다', () => {
    const next = reduceShipmentProcessingCandidateScreen(selected, { type: 'RESET' });

    expect(next).toEqual(createShipmentProcessingCandidateScreenState());
  });

  it('CHANGE_PAGE는 쪽을 바꾸고 선택을 비운다', () => {
    const next = reduceShipmentProcessingCandidateScreen(selected, {
      type: 'CHANGE_PAGE',
      page: 3,
    });

    expect(next.page).toBe(3);
    expect(next.selectedShipmentRequestId).toBeNull();
  });

  it('SELECT는 선택을 세운다', () => {
    const next = reduceShipmentProcessingCandidateScreen(selected, {
      type: 'SELECT',
      shipmentRequestId: 999,
    });

    expect(next.selectedShipmentRequestId).toBe(999);
  });

  it('CLEAR_SELECTION은 선택만 비우고, 이미 비어 있으면 같은 참조를 낸다', () => {
    const next = reduceShipmentProcessingCandidateScreen(selected, { type: 'CLEAR_SELECTION' });
    expect(next.selectedShipmentRequestId).toBeNull();

    const already = { ...selected, selectedShipmentRequestId: null };
    expect(reduceShipmentProcessingCandidateScreen(already, { type: 'CLEAR_SELECTION' })).toBe(
      already,
    );
  });

  describe('CLEAR_MISSING_SELECTION', () => {
    it('SETTLED가 아니면 그대로 둔다', () => {
      const next = reduceShipmentProcessingCandidateScreen(selected, {
        type: 'CLEAR_MISSING_SELECTION',
        snapshot: { kind: 'PENDING' },
      });

      expect(next).toBe(selected);
    });

    it('선택이 후보 목록에 있으면 그대로 둔다', () => {
      const next = reduceShipmentProcessingCandidateScreen(selected, {
        type: 'CLEAR_MISSING_SELECTION',
        snapshot: { kind: 'SETTLED', candidateIds: [501, 502] },
      });

      expect(next).toBe(selected);
    });

    it('선택이 후보 목록에 없으면 비운다', () => {
      const next = reduceShipmentProcessingCandidateScreen(selected, {
        type: 'CLEAR_MISSING_SELECTION',
        snapshot: { kind: 'SETTLED', candidateIds: [502] },
      });

      expect(next.selectedShipmentRequestId).toBeNull();
    });
  });
});

describe('toShipmentProcessingCandidateFilters', () => {
  const state = (
    appliedFilters: ShipmentProcessingCandidateScreenState['appliedFilters'],
    page = 1,
  ): ShipmentProcessingCandidateScreenState => ({
    appliedFilters,
    page,
    selectedShipmentRequestId: null,
  });

  it('shipDateFrom이 비어 있으면 조회 조건을 null로 낸다(L-3)', () => {
    const filters = toShipmentProcessingCandidateFilters(
      state({ shipDateFrom: '', shipDateTo: '', pickingCompleteOnly: true }),
    );

    expect(filters.shipDateFrom).toBeNull();
    expect(filters.shipDateTo).toBeNull();
  });

  it('종료일이 시작일보다 앞서면 조회 조건을 null로 낸다', () => {
    const filters = toShipmentProcessingCandidateFilters(
      state({ shipDateFrom: '2026-08-31', shipDateTo: '2026-08-01', pickingCompleteOnly: true }),
    );

    expect(filters.shipDateFrom).toBeNull();
  });

  it('유효하면 그대로 옮긴다', () => {
    const filters = toShipmentProcessingCandidateFilters(
      state({ shipDateFrom: '2026-08-01', shipDateTo: '2026-08-31', pickingCompleteOnly: true }, 3),
    );

    expect(filters).toEqual({
      shipDateFrom: '2026-08-01',
      shipDateTo: '2026-08-31',
      pickingCompleteOnly: true,
      page: 3,
    });
  });

  it('종료일이 없어도 유효하다', () => {
    const filters = toShipmentProcessingCandidateFilters(
      state({ shipDateFrom: '2026-08-01', shipDateTo: '', pickingCompleteOnly: false }),
    );

    expect(filters.shipDateFrom).toBe('2026-08-01');
    expect(filters.shipDateTo).toBeNull();
    expect(filters.pickingCompleteOnly).toBe(false);
  });
});
