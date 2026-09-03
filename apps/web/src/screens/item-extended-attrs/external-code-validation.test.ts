import { describe, expect, it } from 'vitest';

import type { ExternalCodeDraft } from './external-code-draft';
import { duplicateDraftIds, validateExternalCodeDraft } from './external-code-validation';

const draftOf = (overrides: Partial<ExternalCodeDraft> = {}): ExternalCodeDraft => ({
  draftId: 'new:1',
  externalSystemCode: 'UNIERP',
  partnerId: '6001',
  externalItemCode: 'SYN-EXT-ITEM-01',
  ...overrides,
});

describe('validateExternalCodeDraft — 필수', () => {
  it('제대로 채운 줄은 통과한다', () => {
    expect(validateExternalCodeDraft(draftOf(), [])).toEqual({});
  });

  it.each([
    ['externalSystemCode', { externalSystemCode: '' }],
    ['externalItemCode', { externalItemCode: '' }],
  ] as [string, Partial<ExternalCodeDraft>][])('%s 를 비우면 필수 오류다', (field, patch) => {
    expect(validateExternalCodeDraft(draftOf(patch), [])[field]).toBe('필수 입력 항목입니다.');
  });

  /* 계약이 널을 허용한다 — 비우면 「(전체)」라는 정상 값이다(A-7). */
  it('거래처는 비워도 된다', () => {
    expect(validateExternalCodeDraft(draftOf({ partnerId: '' }), [])).toEqual({});
  });
});

/** 계약 `maxLength` — 외부 품목코드의 상한 자체는 허용값이다. */
describe('validateExternalCodeDraft — 길이', () => {
  it('외부 품목코드가 100자를 넘으면 막는다', () => {
    expect(
      validateExternalCodeDraft(draftOf({ externalItemCode: 'A'.repeat(101) }), [])
        .externalItemCode,
    ).toBe('외부 품목코드는 100자를 넘을 수 없습니다.');
  });

  it('외부 품목코드 100자는 허용한다', () => {
    expect(validateExternalCodeDraft(draftOf({ externalItemCode: 'A'.repeat(100) }), [])).toEqual(
      {},
    );
  });
});

/**
 * M29(외부 코드 몫) — **이 화면 최대의 중복 함정.**
 * `uq_item_external_code`가 `COALESCE(partner_id,0)`으로 접는다(A-7).
 */
describe('validateExternalCodeDraft — 중복 (M29)', () => {
  it('거래처를 비운 두 줄을 중복으로 판정한다', () => {
    const existing = draftOf({ draftId: 'saved:5502', partnerId: '' });

    const errors = validateExternalCodeDraft(draftOf({ draftId: 'new:2', partnerId: '' }), [
      existing,
    ]);

    expect(errors.externalSystemCode).toBe(
      '외부 시스템과 거래처가 같은 줄이 이미 있습니다. 거래처를 비운 줄끼리도 같은 줄로 봅니다.',
    );
  });

  /* 거래처가 다르면 같은 외부 시스템·같은 코드여도 중복이 아니다. */
  it('거래처가 다른 두 줄은 중복이 아니다', () => {
    const existing = draftOf({ draftId: 'saved:5501', partnerId: '6001' });

    expect(
      validateExternalCodeDraft(draftOf({ draftId: 'new:2', partnerId: '6002' }), [existing]),
    ).toEqual({});
  });

  /* 외부 품목코드는 유일 제약의 컬럼이 아니다 — 코드만 고쳐도 서버가 거부한다. */
  it('외부 품목코드만 다른 줄도 중복으로 막는다', () => {
    const existing = draftOf({ draftId: 'saved:5501' });

    expect(
      validateExternalCodeDraft(
        draftOf({ draftId: 'new:2', externalItemCode: 'SYN-EXT-ITEM-09' }),
        [existing],
      ).externalSystemCode,
    ).not.toBeUndefined();
  });

  it('자기 자신은 중복으로 세지 않는다', () => {
    const existing = draftOf({ draftId: 'saved:5501' });

    expect(validateExternalCodeDraft(existing, [existing])).toEqual({});
  });

  /* 「비었다」와 「겹친다」가 겹치면 무엇을 고쳐야 하는지 흐려진다. */
  it('외부 시스템이 비었을 때는 필수 문구만 낸다', () => {
    const existing = draftOf({ draftId: 'saved:5501', externalSystemCode: '' });

    expect(
      validateExternalCodeDraft(draftOf({ draftId: 'new:2', externalSystemCode: '' }), [existing])
        .externalSystemCode,
    ).toBe('필수 입력 항목입니다.');
  });
});

describe('duplicateDraftIds', () => {
  it('거래처를 비운 겹친 줄을 전부 짚는다', () => {
    const ids = duplicateDraftIds([
      draftOf({ draftId: 'a', partnerId: '' }),
      draftOf({ draftId: 'b', partnerId: '' }),
      draftOf({ draftId: 'c', partnerId: '6001' }),
    ]);

    expect(ids).toEqual(new Set(['a', 'b']));
  });

  it('겹친 줄이 없으면 빈 집합이다', () => {
    expect(
      duplicateDraftIds([
        draftOf({ draftId: 'a', partnerId: '6001' }),
        draftOf({ draftId: 'b', partnerId: '6002' }),
      ]),
    ).toEqual(new Set());
  });
});
