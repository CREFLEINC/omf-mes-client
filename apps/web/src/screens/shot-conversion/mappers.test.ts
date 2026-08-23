import { describe, expect, it } from 'vitest';

import { makeRatio } from './fixtures';
import { formValuesFrom, scopeFrom, toRatioCreate, toRatioUpdate } from './mappers';
import { emptyRatioForm } from './options';
import type { RatioFormValues } from './types';

const form = (overrides: Partial<RatioFormValues> = {}): RatioFormValues => ({
  ...emptyRatioForm(),
  ratio: '0.25',
  effectiveFrom: '2026-01-01',
  ...overrides,
});

describe('폼 채우기', () => {
  it('지정한 축만 값을 갖는다', () => {
    expect(scopeFrom(makeRatio(1, 1, { itemId: 21 }))).toEqual({
      itemId: '21',
      processId: '',
      plantId: '',
      businessUnitId: '',
    });
  });

  it('아무 축도 없으면 넷 다 빈다 — 그것이 전체다', () => {
    expect(scopeFrom(makeRatio(1, 1))).toEqual({
      itemId: '',
      processId: '',
      plantId: '',
      businessUnitId: '',
    });
  });

  /** ⭐ 수를 문자열로 옮긴다 — 지우는 도중의 「0.」이 숫자로 억지로 바뀌지 않게. */
  it('비율을 문자열로 든다', () => {
    expect(formValuesFrom(makeRatio(1, 0.25)).ratio).toBe('0.25');
  });

  it('값이 없으면 빈 칸이다', () => {
    expect(formValuesFrom(makeRatio(1, 0, { valueNumeric: null })).ratio).toBe('');
  });

  it('끝이 없으면 종료일 칸이 빈다', () => {
    expect(formValuesFrom(makeRatio(1, 1)).effectiveTo).toBe('');
  });
});

describe('등록 본문', () => {
  /** ⛔ 정책 코드를 화면이 붙인다 — 사용자에게 묻지 않는다. */
  it('비율 코드를 화면이 붙인다', () => {
    expect(toRatioCreate(form()).policyCode).toBe('SHOT_CONVERSION_RATIO');
  });

  /**
   * ⛔ **값 칸 셋 중 하나만 채운다.** 물리 제약이 「하나 이상」이라 셋 다 채워도 통과하지만,
   * 쓰지 않는 칸을 채우면 읽는 쪽이 헷갈린다.
   */
  it('쓰지 않는 값 칸을 싣지 않는다', () => {
    const body = toRatioCreate(form());

    expect(body.valueNumeric).toBe(0.25);
    expect('valueText' in body).toBe(false);
    expect('valueBoolean' in body).toBe(false);
  });

  it('고른 축은 식별자가 된다', () => {
    const body = toRatioCreate(
      form({ scope: { itemId: '21', processId: '', plantId: '11', businessUnitId: '' } }),
    );

    expect(body.itemId).toBe(21);
    expect(body.plantId).toBe(11);
  });

  /** ⭐ 고르지 않은 축은 `null` 이고 그것이 「전체」다 — 빼지 않고 값으로 말한다. */
  it('고르지 않은 축은 없음으로 싣는다', () => {
    const body = toRatioCreate(form());

    expect(body.itemId).toBeNull();
    expect(body.processId).toBeNull();
    expect(body.plantId).toBeNull();
    expect(body.businessUnitId).toBeNull();
  });

  /** ⛔ 읽을 수 없는 값을 조건으로 내보내지 않는다 — 서버가 400으로 되받고 원인이 감춰진다. */
  it('읽을 수 없는 축은 고르지 않은 것으로 다룬다', () => {
    const body = toRatioCreate(
      form({ scope: { itemId: '전체', processId: '0', plantId: '-3', businessUnitId: '1.5' } }),
    );

    expect(body.itemId).toBeNull();
    expect(body.processId).toBeNull();
    expect(body.plantId).toBeNull();
    expect(body.businessUnitId).toBeNull();
  });

  it('종료일이 비면 끝이 없는 것으로 싣는다', () => {
    expect(toRatioCreate(form({ effectiveTo: '' })).effectiveTo).toBeNull();
  });

  it('종료일이 있으면 그대로 싣는다', () => {
    expect(toRatioCreate(form({ effectiveTo: '2026-12-31' })).effectiveTo).toBe('2026-12-31');
  });
});

describe('수정 본문', () => {
  /** ⛔ 계약의 수정 본문에 코드와 축이 없다 — 바꾸면 다른 정책이 된다. */
  it('정책 코드와 범위 축을 싣지 않는다', () => {
    const body = toRatioUpdate(
      form({ scope: { itemId: '21', processId: '', plantId: '', businessUnitId: '' } }),
    );

    expect('policyCode' in body).toBe(false);
    expect('itemId' in body).toBe(false);
    expect('plantId' in body).toBe(false);
  });

  /**
   * ⭐ **쓰지 않는 값 칸을 `null` 로 못박는다.** 수정은 이미 있는 행을 덮으므로, 다른 화면이
   * 실수로 채워 둔 칸이 남아 있으면 이 화면이 그것을 그대로 두게 된다.
   */
  it('쓰지 않는 값 칸을 비우도록 못박는다', () => {
    const body = toRatioUpdate(form());

    expect(body.valueNumeric).toBe(0.25);
    expect(body.valueText).toBeNull();
    expect(body.valueBoolean).toBeNull();
  });

  it('유효기간을 함께 싣는다', () => {
    const body = toRatioUpdate(form({ effectiveFrom: '2026-02-01', effectiveTo: '2026-12-31' }));

    expect(body.effectiveFrom).toBe('2026-02-01');
    expect(body.effectiveTo).toBe('2026-12-31');
  });
});
