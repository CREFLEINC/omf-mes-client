import { describe, expect, it } from 'vitest';

import type { UomConversionDraft } from './uom-conversion-draft';
import { duplicateDraftIds, validateUomConversionDraft } from './uom-conversion-validation';

const draftOf = (overrides: Partial<UomConversionDraft> = {}): UomConversionDraft => ({
  draftId: 'new:1',
  fromUomId: '7001',
  toUomId: '7002',
  conversionRate: '2.5',
  effectiveFrom: '2026-01-01',
  effectiveTo: '',
  ...overrides,
});

describe('validateUomConversionDraft — 필수', () => {
  it('제대로 채운 줄은 통과한다', () => {
    expect(validateUomConversionDraft(draftOf(), [])).toEqual({});
  });

  it.each([
    ['fromUomId', { fromUomId: '' }],
    ['toUomId', { toUomId: '' }],
    ['conversionRate', { conversionRate: '' }],
    ['effectiveFrom', { effectiveFrom: '' }],
  ] as [string, Partial<UomConversionDraft>][])('%s 를 비우면 필수 오류다', (field, patch) => {
    expect(validateUomConversionDraft(draftOf(patch), [])[field]).toBe('필수 입력 항목입니다.');
  });

  it('유효 종료는 비워도 된다', () => {
    expect(validateUomConversionDraft(draftOf({ effectiveTo: '' }), [])).toEqual({});
  });
});

/**
 * 계약 `exclusiveMinimum: 0` — **0은 허용값이 아니다.**
 * 확장 속성의 유효기한(일)(`minimum: 0`)과 규칙이 갈리는 자리라 한 곳에 모아 둔다.
 */
describe('validateUomConversionDraft — 환산 비율', () => {
  it('0을 거부한다 — 「비었다」와 다른 오류다', () => {
    const errors = validateUomConversionDraft(draftOf({ conversionRate: '0' }), []);

    expect(errors.conversionRate).toBe('환산 비율은 0보다 큰 수로 입력하세요.');
  });

  it('음수를 거부한다', () => {
    expect(validateUomConversionDraft(draftOf({ conversionRate: '-1' }), []).conversionRate).toBe(
      '환산 비율은 0보다 큰 수로 입력하세요.',
    );
  });

  it('숫자가 아니면 거부한다', () => {
    expect(validateUomConversionDraft(draftOf({ conversionRate: 'abc' }), []).conversionRate).toBe(
      '환산 비율은 0보다 큰 수로 입력하세요.',
    );
  });

  /* `numeric(18,8)` — 여덟 자리가 실제로 오간다. */
  it('소수점 여덟 자리를 허용한다', () => {
    expect(validateUomConversionDraft(draftOf({ conversionRate: '0.00012345' }), [])).toEqual({});
  });

  /*
   * **자릿수를 막지 않는다.** 스키마에 자릿수 제약이 없고,
   * 화면이 없는 제약을 흉내 내면 서버가 받는 값을 막는다(결정 7).
   */
  it('아홉 자리도 화면이 막지 않는다 — 판정은 서버 몫이다', () => {
    expect(validateUomConversionDraft(draftOf({ conversionRate: '0.000123456' }), [])).toEqual({});
  });

  it('아주 작은 양수는 통과한다', () => {
    expect(validateUomConversionDraft(draftOf({ conversionRate: '0.00000001' }), [])).toEqual({});
  });
});

/** `ck_item_uom_distinct` */
describe('validateUomConversionDraft — 변환 전 ≠ 변환 후', () => {
  it('같은 단위를 고르면 막는다', () => {
    expect(validateUomConversionDraft(draftOf({ toUomId: '7001' }), []).toUomId).toBe(
      '변환 전 단위와 변환 후 단위는 서로 달라야 합니다.',
    );
  });

  it('둘 다 비었을 때는 필수 문구만 낸다', () => {
    expect(validateUomConversionDraft(draftOf({ fromUomId: '', toUomId: '' }), []).toUomId).toBe(
      '필수 입력 항목입니다.',
    );
  });
});

/** `ck_item_uom_dates` */
describe('validateUomConversionDraft — 유효기간', () => {
  it('종료가 시작보다 앞서면 두 칸에 함께 오류가 붙는다', () => {
    const errors = validateUomConversionDraft(
      draftOf({ effectiveFrom: '2026-03-01', effectiveTo: '2026-02-01' }),
      [],
    );

    expect(errors.effectiveFrom).toBe('유효 종료는 유효 시작과 같거나 뒤여야 합니다.');
    expect(errors.effectiveTo).toBe(errors.effectiveFrom);
  });

  it('같은 날은 허용한다', () => {
    expect(
      validateUomConversionDraft(
        draftOf({ effectiveFrom: '2026-03-01', effectiveTo: '2026-03-01' }),
        [],
      ),
    ).toEqual({});
  });
});

/**
 * M29(단위 환산 몫) — `uq_item_uom_conversion`.
 * **유효 종료·환산 비율은 키가 아니다** — 그것만 다른 두 줄은 서버에게 같은 짝이다.
 */
describe('validateUomConversionDraft — 중복 (M29)', () => {
  const existing = draftOf({ draftId: 'saved:4001' });

  it('세 값이 같은 줄이 이미 있으면 막는다', () => {
    const errors = validateUomConversionDraft(draftOf({ draftId: 'new:2' }), [existing]);

    expect(errors.fromUomId).toBe('변환 전·변환 후·유효 시작이 같은 줄이 이미 있습니다.');
  });

  it('유효 종료만 다른 줄도 중복으로 본다', () => {
    const errors = validateUomConversionDraft(
      draftOf({ draftId: 'new:2', effectiveTo: '2026-12-31' }),
      [existing],
    );

    expect(errors.fromUomId).toBe('변환 전·변환 후·유효 시작이 같은 줄이 이미 있습니다.');
  });

  /* 수정할 때 세 값을 그대로 두는 것이 정상이다 — 자기 자신을 중복으로 세면 고칠 수 없다. */
  it('자기 자신은 중복으로 세지 않는다', () => {
    expect(validateUomConversionDraft(existing, [existing])).toEqual({});
  });

  it('유효 시작이 다르면 중복이 아니다', () => {
    expect(
      validateUomConversionDraft(draftOf({ draftId: 'new:2', effectiveFrom: '2026-02-01' }), [
        existing,
      ]),
    ).toEqual({});
  });
});

/**
 * 서버가 준 목록에 이미 중복이 있을 수 있다(옛 자료).
 * 저장을 눌러야 알게 하지 않고 어느 줄이 문제인지 표에서 짚는다.
 */
describe('duplicateDraftIds', () => {
  it('겹친 줄을 전부 짚는다', () => {
    const ids = duplicateDraftIds([
      draftOf({ draftId: 'a' }),
      draftOf({ draftId: 'b' }),
      draftOf({ draftId: 'c', effectiveFrom: '2026-05-01' }),
    ]);

    expect(ids).toEqual(new Set(['a', 'b']));
  });

  it('겹친 줄이 없으면 빈 집합이다', () => {
    expect(
      duplicateDraftIds([draftOf({ draftId: 'a' }), draftOf({ draftId: 'b', toUomId: '7003' })]),
    ).toEqual(new Set());
  });
});
