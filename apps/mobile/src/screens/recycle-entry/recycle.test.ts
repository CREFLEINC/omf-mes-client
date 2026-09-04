import { describe, expect, it } from 'vitest';

import type { Location } from '../../patterns/locations';
import {
  RECYCLED,
  canSubmit,
  qtyProblem,
  recycledRowOf,
  toOutboxDraft,
  type ItemRow,
  type RecycleDraft,
} from './recycle';

const NOW = new Date('2026-08-11T09:12:00+09:00');

const item = (overrides: Partial<ItemRow> = {}): ItemRow => ({
  itemId: 31,
  itemCode: 'ABC-123',
  itemName: '원자재',
  mesCategoryCode: RECYCLED,
  baseUomId: 9,
  ...overrides,
});

const place = { locationId: 5, warehouseId: 2, locationCode: 'A-01-03' } as Location;

const draft = (overrides: Partial<RecycleDraft> = {}): RecycleDraft => ({
  itemCode: 'ABC-123',
  warehouseId: 2,
  location: place,
  quantity: '12.5',
  remarks: '',
  ...overrides,
});

describe('같은 품목코드로 온 행 가르기', () => {
  /*
   * 품목코드 하나에 행이 둘 온다. 한 건으로 가정하고 첫 행을 잡으면 신재로 재고가 늘고,
   * 그 수량은 되돌릴 자리가 없다.
   */
  it('신재가 먼저 와도 재생재 행을 고른다', () => {
    const rows = [item({ itemId: 30, mesCategoryCode: 'NEW' }), item({ itemId: 31 })];

    expect(recycledRowOf(rows)?.itemId).toBe(31);
  });

  it('재생재 행이 없으면 고르지 않는다', () => {
    expect(recycledRowOf([item({ itemId: 30, mesCategoryCode: 'NEW' })])).toBeNull();
  });

  /* 구분이 비어 있는 행을 재생재로 보면 신재로 재고가 는다. */
  it('구분이 없는 행을 재생재로 보지 않는다', () => {
    expect(recycledRowOf([item({ mesCategoryCode: undefined })])).toBeNull();
  });
});

describe('수량 검증', () => {
  it('0 이하는 막는다', () => {
    expect(qtyProblem('0')).toBe('notPositive');
    expect(qtyProblem('-1')).toBe('notPositive');
  });

  it('비었거나 숫자가 아니면 막는다', () => {
    expect(qtyProblem('   ')).toBe('empty');
    expect(qtyProblem('abc')).toBe('notNumber');
  });

  it('소수는 받는다', () => {
    expect(qtyProblem('12.5')).toBeNull();
  });
});

describe('등록 조건', () => {
  it('품목과 창고와 위치와 수량이 있으면 등록할 수 있다', () => {
    expect(canSubmit(draft(), item(), true)).toBe(true);
  });

  it('품목을 고르지 않으면 등록할 수 없다', () => {
    expect(canSubmit(draft(), null, true)).toBe(false);
  });

  /* 위치는 비울 수 없다. 서버도 400 으로 막지만 보내기 전에 알아야 한다. */
  it('위치를 고르지 않으면 등록할 수 없다', () => {
    expect(canSubmit(draft({ location: null }), item(), true)).toBe(false);
  });

  it('창고를 고르지 않으면 등록할 수 없다', () => {
    expect(canSubmit(draft({ warehouseId: null }), item(), true)).toBe(false);
  });

  it('수량이 0 이하면 등록할 수 없다', () => {
    expect(canSubmit(draft({ quantity: '0' }), item(), true)).toBe(false);
  });

  /* 누가 한 일인지 없이 재고를 늘릴 수 없다. */
  it('사번이 없으면 등록할 수 없다', () => {
    expect(canSubmit(draft(), item(), false)).toBe(false);
  });
});

describe('등록 본문', () => {
  const bodyOf = (over: Partial<RecycleDraft> = {}) =>
    toOutboxDraft(draft(over), 31, 2, 5, NOW, '900028').body as Record<string, unknown>;

  it('품목 번호 하나만 싣고 구분은 싣지 않는다', () => {
    const body = bodyOf();

    expect(body.itemId).toBe(31);
    expect(body).not.toHaveProperty('mesCategoryCode');
    expect(body).not.toHaveProperty('itemCode');
  });

  /* 품목의 기본 단위를 서버가 쓴다. 화면이 보내면 서버 값과 갈릴 수 있다. */
  it('단위를 싣지 않는다', () => {
    expect(bodyOf()).not.toHaveProperty('uomId');
  });

  it('업무 기준일과 발생 시각을 단말이 정한다', () => {
    const body = bodyOf();

    expect(body.businessDate).toBe('2026-08-11');
    expect(body.occurredAt).toBe(NOW.toISOString());
  });

  /* 비운 비고를 빈 문자로 실으면 서버가 적힌 값으로 받는다. */
  it('비고를 비우면 아예 싣지 않는다', () => {
    expect(bodyOf({ remarks: '   ' })).not.toHaveProperty('remarks');
    expect(bodyOf({ remarks: ' 파쇄분 ' }).remarks).toBe('파쇄분');
  });

  it('스캔한 값이 그대로 번호가 되는 경로를 쓰지 않는다', () => {
    expect(toOutboxDraft(draft(), 31, 2, 5, NOW, '900028').path).toBe('/logistics/recycle-entries');
  });
});
