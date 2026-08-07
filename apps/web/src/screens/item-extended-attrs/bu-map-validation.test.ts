import { describe, expect, it } from 'vitest';

import type { BuMapDraft } from './bu-map-draft';
import { validateBuMapDraft } from './bu-map-validation';

const draftOf = (overrides: Partial<BuMapDraft> = {}): BuMapDraft => ({
  draftId: 'new:1',
  fromBusinessUnitId: '5001',
  toBusinessUnitId: '5002',
  toItemId: '1002',
  effectiveFrom: '2026-01-01',
  effectiveTo: '',
  ...overrides,
});

describe('validateBuMapDraft — 필수', () => {
  it('제대로 채운 줄은 통과한다', () => {
    expect(validateBuMapDraft(draftOf())).toEqual({});
  });

  it.each([
    ['fromBusinessUnitId', { fromBusinessUnitId: '' }],
    ['toBusinessUnitId', { toBusinessUnitId: '' }],
    ['toItemId', { toItemId: '' }],
    ['effectiveFrom', { effectiveFrom: '' }],
  ] as [string, Partial<BuMapDraft>][])('%s 를 비우면 필수 오류다', (field, patch) => {
    expect(validateBuMapDraft(draftOf(patch))[field]).toBe('필수 입력 항목입니다.');
  });

  /* 비우는 것이 정상 값이다 — 계약이 널을 허용한다(무기한). */
  it('유효 종료는 비워도 된다', () => {
    expect(validateBuMapDraft(draftOf({ effectiveTo: '' }))).toEqual({});
  });
});

/** `ck_item_bu_map_distinct` — 계약이 이름으로 밝힌 제약이다. */
describe('validateBuMapDraft — 보내는 사업부 ≠ 받는 사업부', () => {
  it('같은 사업부를 고르면 막는다', () => {
    const errors = validateBuMapDraft(draftOf({ toBusinessUnitId: '5001' }));

    expect(errors.toBusinessUnitId).toBe('보내는 사업부와 받는 사업부는 서로 달라야 합니다.');
  });

  /* 「비었다」와 「같으면 안 된다」가 겹치면 무엇을 고쳐야 하는지 흐려진다. */
  it('둘 다 비었을 때는 필수 문구만 낸다', () => {
    const errors = validateBuMapDraft(draftOf({ fromBusinessUnitId: '', toBusinessUnitId: '' }));

    expect(errors.toBusinessUnitId).toBe('필수 입력 항목입니다.');
  });

  it('다른 사업부면 통과한다', () => {
    expect(validateBuMapDraft(draftOf({ toBusinessUnitId: '5003' }))).toEqual({});
  });
});

/** `ck_item_bu_map_dates` — 짝 제약이다. */
describe('validateBuMapDraft — 유효기간', () => {
  it('종료가 시작보다 앞서면 막는다', () => {
    const errors = validateBuMapDraft(
      draftOf({ effectiveFrom: '2026-03-01', effectiveTo: '2026-02-01' }),
    );

    expect(errors.effectiveFrom).toBe('유효 종료는 유효 시작과 같거나 뒤여야 합니다.');
  });

  /* 한쪽만 짚으면 다른 칸이 옳다는 뜻이 된다 — 짝 오류는 두 칸에 낸다. */
  it('짝 오류는 두 칸에 함께 붙는다', () => {
    const errors = validateBuMapDraft(
      draftOf({ effectiveFrom: '2026-03-01', effectiveTo: '2026-02-01' }),
    );

    expect(errors.effectiveTo).toBe(errors.effectiveFrom);
  });

  it('같은 날은 허용한다 — 계약이 「이상」이라 적었다', () => {
    expect(
      validateBuMapDraft(draftOf({ effectiveFrom: '2026-03-01', effectiveTo: '2026-03-01' })),
    ).toEqual({});
  });
});

/**
 * M29(사업부 매핑 몫) — **계약에 없는 중복 검사를 만들지 않는다.**
 *
 * 계약이 이 표에 유일 제약을 적지 않았다(구별 제약·짝 제약만 있다).
 * 화면이 없는 제약을 흉내 내면 서버가 허용하는 값을 막는다.
 */
describe('validateBuMapDraft — 중복을 막지 않는다 (M29)', () => {
  it('같은 짝을 두 줄 만들어도 창이 막지 않는다', () => {
    const first = draftOf({ draftId: 'saved:3001' });
    const second = draftOf({ draftId: 'new:1' });

    expect(validateBuMapDraft(first)).toEqual({});
    expect(validateBuMapDraft(second)).toEqual({});
  });

  /* 검증 함수가 다른 줄을 아예 보지 않는다는 사실 자체를 고정한다. */
  it('검증에 다른 줄을 넘기는 통로가 없다', () => {
    expect(validateBuMapDraft).toHaveLength(1);
  });
});
