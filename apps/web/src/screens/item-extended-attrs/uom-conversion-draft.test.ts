import { describe, expect, it } from 'vitest';

import { uomConversionFixtures } from './fixtures';
import {
  createUomConversionDraft,
  duplicateKeyOf,
  isSameUomConversionDrafts,
  removeUomConversionDraft,
  toUomConversionDrafts,
  toUomConversionsPayload,
  upsertUomConversionDraft,
  type UomConversionDraft,
} from './uom-conversion-draft';

const draftOf = (overrides: Partial<UomConversionDraft> = {}): UomConversionDraft => ({
  draftId: 'new:1',
  fromUomId: '7001',
  toUomId: '7002',
  conversionRate: '2.5',
  effectiveFrom: '2026-01-01',
  effectiveTo: '',
  ...overrides,
});

describe('toUomConversionDrafts', () => {
  it('서버 목록을 초안으로 옮긴다', () => {
    expect(toUomConversionDrafts(uomConversionFixtures)[0]).toEqual({
      draftId: 'saved:4001',
      fromUomId: '7001',
      toUomId: '7002',
      conversionRate: '2.5',
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-12-31',
    });
  });

  it('널 유효 종료를 빈 문자열로 모은다', () => {
    expect(toUomConversionDrafts(uomConversionFixtures)[1]?.effectiveTo).toBe('');
  });

  /*
   * 자릿수를 맞추거나 반올림하면 사용자가 고치지 않은 줄이 저장할 때 다른 값이 된다.
   * 계약이 `numeric(18,8)`이라 여덟 자리가 실제로 오간다.
   */
  it('환산 비율의 소수 자릿수를 손대지 않는다', () => {
    expect(toUomConversionDrafts(uomConversionFixtures)[1]?.conversionRate).toBe('0.00012345');
  });

  it('서버 식별자와 itemId를 초안에 담지 않는다', () => {
    for (const draft of toUomConversionDrafts(uomConversionFixtures)) {
      expect(draft).not.toHaveProperty('itemUomConversionId');
      expect(draft).not.toHaveProperty('itemId');
    }
  });
});

describe('createUomConversionDraft', () => {
  it('빈 줄을 만든다', () => {
    const draft = createUomConversionDraft();

    expect(draft.fromUomId).toBe('');
    expect(draft.toUomId).toBe('');
    expect(draft.conversionRate).toBe('');
  });

  /* 환산 비율의 기본값을 지어내지 않는다 — `1`을 넣으면 사용자가 확인하지 않은 값이 저장된다. */
  it('환산 비율에 기본값을 지어내지 않는다', () => {
    expect(createUomConversionDraft().conversionRate).toBe('');
  });

  it('새 줄의 키가 저장된 줄과 겹치지 않고 서로 다르다', () => {
    const first = createUomConversionDraft();
    const second = createUomConversionDraft();

    expect(first.draftId).toMatch(/^new:/);
    expect(first.draftId).not.toBe(second.draftId);
  });
});

describe('upsertUomConversionDraft · removeUomConversionDraft', () => {
  it('없는 키는 끝에 더한다', () => {
    expect(upsertUomConversionDraft([], draftOf())).toHaveLength(1);
  });

  it('있는 키는 자리를 지킨 채 값만 바꾼다', () => {
    const drafts = [
      draftOf({ draftId: 'a' }),
      draftOf({ draftId: 'b' }),
      draftOf({ draftId: 'c' }),
    ];

    const next = upsertUomConversionDraft(drafts, draftOf({ draftId: 'b', conversionRate: '9' }));

    expect(next.map((draft) => draft.draftId)).toEqual(['a', 'b', 'c']);
    expect(next[1]?.conversionRate).toBe('9');
  });

  it('키로 한 줄만 지운다', () => {
    const drafts = [draftOf({ draftId: 'a' }), draftOf({ draftId: 'b' })];

    expect(removeUomConversionDraft(drafts, 'a').map((draft) => draft.draftId)).toEqual(['b']);
  });
});

/** 치환 본문 규칙 — M15·M16·M28. */
describe('toUomConversionsPayload (M15·M16·M28)', () => {
  it('계약의 다섯 키만 실린다', () => {
    const [payload] = toUomConversionsPayload([draftOf({ effectiveTo: '2026-12-31' })]);

    expect(Object.keys(payload ?? {}).sort()).toEqual([
      'conversionRate',
      'effectiveFrom',
      'effectiveTo',
      'fromUomId',
      'toUomId',
    ]);
  });

  it('초안 키와 서버 식별자를 싣지 않는다 (M15)', () => {
    const [payload] = toUomConversionsPayload([draftOf({ draftId: 'saved:4001' })]);

    expect(payload).not.toHaveProperty('draftId');
    expect(payload).not.toHaveProperty('itemUomConversionId');
  });

  it('itemId를 싣지 않는다 (M16)', () => {
    expect(toUomConversionsPayload([draftOf()])[0]).not.toHaveProperty('itemId');
  });

  it('순서 필드를 싣지 않는다 (M28)', () => {
    const [payload] = toUomConversionsPayload([draftOf()]);

    expect(payload).not.toHaveProperty('displayOrder');
    expect(payload).not.toHaveProperty('sequenceNo');
  });

  /* 계약이 숫자를 요구한다 — 문자열을 그대로 보내면 형식 위반이다. */
  it('환산 비율을 숫자로 옮긴다', () => {
    expect(toUomConversionsPayload([draftOf({ conversionRate: '2.5' })])[0]?.conversionRate).toBe(
      2.5,
    );
  });

  /* `numeric(18,8)` — 여덟 자리가 값의 일부다. 옮기다 잃으면 안 된다. */
  it('소수점 여덟 자리를 잃지 않는다', () => {
    expect(
      toUomConversionsPayload([draftOf({ conversionRate: '0.00012345' })])[0]?.conversionRate,
    ).toBe(0.00012345);
  });

  it('비운 유효 종료는 널로 옮긴다', () => {
    expect(toUomConversionsPayload([draftOf({ effectiveTo: '' })])[0]?.effectiveTo).toBeNull();
  });

  it('행이 0개면 빈 배열이다', () => {
    expect(toUomConversionsPayload([])).toEqual([]);
  });
});

/**
 * M29(단위 환산 몫) — 유일 제약은 **네 컬럼**이고 품목은 경로로 고정된다.
 * 유효 **종료**는 키가 아니다 — 종료만 다른 두 줄은 서버에게 같은 짝이다.
 */
describe('duplicateKeyOf (M29)', () => {
  it('변환 전·변환 후·유효 시작이 같으면 같은 키다', () => {
    expect(duplicateKeyOf(draftOf({ draftId: 'a' }))).toBe(
      duplicateKeyOf(draftOf({ draftId: 'b' })),
    );
  });

  it('유효 종료만 달라도 같은 키다 — 종료는 유일 제약의 컬럼이 아니다', () => {
    expect(duplicateKeyOf(draftOf({ effectiveTo: '' }))).toBe(
      duplicateKeyOf(draftOf({ effectiveTo: '2026-12-31' })),
    );
  });

  /* 환산 비율도 키가 아니다 — 비율만 고친 두 줄은 서버가 거부한다. */
  it('환산 비율만 달라도 같은 키다', () => {
    expect(duplicateKeyOf(draftOf({ conversionRate: '2' }))).toBe(
      duplicateKeyOf(draftOf({ conversionRate: '3' })),
    );
  });

  it.each([
    ['fromUomId', { fromUomId: '7003' }],
    ['toUomId', { toUomId: '7003' }],
    ['effectiveFrom', { effectiveFrom: '2026-02-01' }],
  ] as [string, Partial<UomConversionDraft>][])('%s 가 다르면 다른 키다', (_field, patch) => {
    expect(duplicateKeyOf(draftOf())).not.toBe(duplicateKeyOf(draftOf(patch)));
  });
});

describe('isSameUomConversionDrafts', () => {
  it('같은 목록은 같다고 본다', () => {
    expect(isSameUomConversionDrafts([draftOf()], [draftOf()])).toBe(true);
  });

  it('길이가 다르면 다르다', () => {
    expect(isSameUomConversionDrafts([draftOf()], [])).toBe(false);
  });

  it.each([
    ['fromUomId', { fromUomId: '7003' }],
    ['toUomId', { toUomId: '7003' }],
    ['conversionRate', { conversionRate: '3' }],
    ['effectiveFrom', { effectiveFrom: '2026-02-01' }],
    ['effectiveTo', { effectiveTo: '2026-12-31' }],
  ] as [string, Partial<UomConversionDraft>][])('%s 하나만 달라도 다르다', (_field, patch) => {
    expect(isSameUomConversionDrafts([draftOf()], [draftOf(patch)])).toBe(false);
  });
});
