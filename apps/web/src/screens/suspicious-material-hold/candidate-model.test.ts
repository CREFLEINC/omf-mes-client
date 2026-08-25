import type { components } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_SUSPICIOUS_MATERIAL_FILTERS,
  reconcileSuspiciousMaterialSelection,
  toSelectedLotSnapshot,
  toSuspiciousMaterialQuery,
  type SuspiciousMaterialCandidateResponse,
} from './candidate-model';

type Lot = components['schemas']['LotQualityStatus'];

const lot = (overrides: Partial<Lot> = {}): Lot => ({
  lotId: 701,
  lotNo: 'SYN-LOT-701',
  itemId: 801,
  lotStatusCode: 'INSPECTION_PENDING',
  versionNo: 7,
  warehouseId: 31,
  locationId: 41,
  onHandQty: 25,
  heldQty: 0,
  availableQty: 25,
  uomId: 51,
  fullyHeld: false,
  latestTransitionAt: '2026-08-25T09:00:00+09:00',
  ...overrides,
});

const success = (items: Lot[]): SuspiciousMaterialCandidateResponse => ({
  kind: 'SUCCESS',
  items,
});

describe('의심자재 후보 상태 모델', () => {
  it('입력된 필터와 2쪽만 계약 query로 만들고 fullyHeld 제외를 추론하지 않는다', () => {
    expect(
      toSuspiciousMaterialQuery(
        { q: 'SYN-LOT', itemId: '801', warehouseId: '31', lotStatusCode: 'NORMAL' },
        2,
      ),
    ).toEqual({
      q: 'SYN-LOT',
      itemId: 801,
      warehouseId: 31,
      lotStatusCode: 'NORMAL',
      page: 2,
    });
    expect(toSuspiciousMaterialQuery(EMPTY_SUSPICIOUS_MATERIAL_FILTERS, 1)).toEqual({});
  });

  it.each([
    ['fullyHeld', { fullyHeld: true }],
    ['version missing', { versionNo: undefined }],
    ['version zero', { versionNo: 0 }],
    ['version fractional', { versionNo: 1.5 }],
  ])('%s 후보는 write-ready 선택으로 바꾸지 않는다', (_case, override) => {
    expect(toSelectedLotSnapshot(lot(override))).toBeNull();
  });

  it('선택 가능한 후보는 쓰기 토큰과 표시 자료를 숫자 경계 그대로 보존한다', () => {
    const selected = toSelectedLotSnapshot(lot());

    expect(selected).toEqual({
      lotId: 701,
      lotNo: 'SYN-LOT-701',
      itemId: 801,
      versionNo: 7,
      warehouseId: 31,
      locationId: 41,
      onHandQty: 25,
      uomId: 51,
      lotStatusCode: 'INSPECTION_PENDING',
      latestTransitionAt: '2026-08-25T09:00:00+09:00',
    });
    expect(Object.values(selected ?? {})).not.toContain('701');
    expect(Object.values(selected ?? {})).not.toContain('7');
  });

  it('성공한 최신 응답만 선택 owner를 갱신하고 사라지거나 전량 보류된 owner를 제거한다', () => {
    const first = toSelectedLotSnapshot(lot());
    expect(first).not.toBeNull();
    const updated = lot({ versionNo: 8, onHandQty: 20 });

    expect(reconcileSuspiciousMaterialSelection([first!], success([updated]))).toEqual([
      expect.objectContaining({ lotId: 701, versionNo: 8, onHandQty: 20 }),
    ]);
    expect(reconcileSuspiciousMaterialSelection([first!], success([]))).toEqual([]);
    expect(
      reconcileSuspiciousMaterialSelection([first!], success([lot({ fullyHeld: true })])),
    ).toEqual([]);
  });

  it('background 오류의 cached row는 write-ready 선택을 반환하지 않는다', () => {
    const selected = toSelectedLotSnapshot(lot());

    expect(
      reconcileSuspiciousMaterialSelection([selected!], {
        kind: 'UNAVAILABLE',
        reason: 'ERROR',
      }),
    ).toEqual([]);
  });

  it('사라진 선택은 같은 LOT이 나중에 재등장해도 자동 부활하지 않는다', () => {
    const selected = toSelectedLotSnapshot(lot());
    const cleared = reconcileSuspiciousMaterialSelection([selected!], success([]));

    expect(reconcileSuspiciousMaterialSelection(cleared, success([lot()]))).toEqual([]);
  });
});
