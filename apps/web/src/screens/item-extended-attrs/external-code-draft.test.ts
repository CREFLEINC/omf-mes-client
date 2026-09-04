import { describe, expect, it } from 'vitest';

import {
  createExternalCodeDraft,
  duplicateKeyOf,
  isSameExternalCodeDrafts,
  removeExternalCodeDraft,
  toExternalCodeDrafts,
  toExternalCodesPayload,
  upsertExternalCodeDraft,
  type ExternalCodeDraft,
} from './external-code-draft';
import { externalCodeFixtures } from './fixtures';

const draftOf = (overrides: Partial<ExternalCodeDraft> = {}): ExternalCodeDraft => ({
  draftId: 'new:1',
  externalSystemCode: 'UNIERP',
  partnerId: '6001',
  externalItemCode: 'SYN-EXT-ITEM-01',
  ...overrides,
});

describe('toExternalCodeDrafts', () => {
  it('서버 목록을 초안으로 옮긴다', () => {
    expect(toExternalCodeDrafts(externalCodeFixtures)[0]).toEqual({
      draftId: 'saved:5501',
      externalSystemCode: 'UNIERP',
      partnerId: '6001',
      externalItemCode: 'SYN-EXT-ITEM-01',
    });
  });

  /* 널과 빈 문자열이 섞이면 선택칸이 「지정하지 않음」을 두 가지로 표현하게 된다. */
  it('널 거래처를 빈 문자열로 모은다', () => {
    expect(toExternalCodeDrafts(externalCodeFixtures)[1]?.partnerId).toBe('');
  });

  it('서버 식별자와 itemId를 초안에 담지 않는다', () => {
    for (const draft of toExternalCodeDrafts(externalCodeFixtures)) {
      expect(draft).not.toHaveProperty('itemExternalCodeId');
      expect(draft).not.toHaveProperty('itemId');
    }
  });

  /* 이 표에는 기간 컬럼 자체가 없다 — 셋을 한 부품으로 묶지 않은 이유가 여기서 드러난다. */
  it('유효기간을 만들어 붙이지 않는다', () => {
    for (const draft of toExternalCodeDrafts(externalCodeFixtures)) {
      expect(draft).not.toHaveProperty('effectiveFrom');
      expect(draft).not.toHaveProperty('effectiveTo');
    }
  });
});

describe('createExternalCodeDraft', () => {
  it('빈 줄을 만든다', () => {
    const draft = createExternalCodeDraft();

    expect(draft.externalSystemCode).toBe('');
    expect(draft.partnerId).toBe('');
    expect(draft.externalItemCode).toBe('');
  });

  it('새 줄의 키가 저장된 줄과 겹치지 않고 서로 다르다', () => {
    const first = createExternalCodeDraft();
    const second = createExternalCodeDraft();

    expect(first.draftId).toMatch(/^new:/);
    expect(first.draftId).not.toBe(second.draftId);
  });
});

describe('upsertExternalCodeDraft · removeExternalCodeDraft', () => {
  it('없는 키는 끝에 더한다', () => {
    expect(upsertExternalCodeDraft([], draftOf())).toHaveLength(1);
  });

  it('있는 키는 자리를 지킨 채 값만 바꾼다', () => {
    const drafts = [
      draftOf({ draftId: 'a' }),
      draftOf({ draftId: 'b' }),
      draftOf({ draftId: 'c' }),
    ];

    const next = upsertExternalCodeDraft(
      drafts,
      draftOf({ draftId: 'b', externalItemCode: 'SYN-EXT-ITEM-09' }),
    );

    expect(next.map((draft) => draft.draftId)).toEqual(['a', 'b', 'c']);
    expect(next[1]?.externalItemCode).toBe('SYN-EXT-ITEM-09');
  });

  it('키로 한 줄만 지운다', () => {
    const drafts = [draftOf({ draftId: 'a' }), draftOf({ draftId: 'b' })];

    expect(removeExternalCodeDraft(drafts, 'a').map((draft) => draft.draftId)).toEqual(['b']);
  });
});

/** 치환 본문 규칙 — M15·M16·M28. */
describe('toExternalCodesPayload (M15·M16·M28)', () => {
  it('계약의 세 키만 실린다', () => {
    const [payload] = toExternalCodesPayload([draftOf()]);

    expect(Object.keys(payload ?? {}).sort()).toEqual([
      'externalItemCode',
      'externalSystemCode',
      'partnerId',
    ]);
  });

  it('초안 키와 서버 식별자를 싣지 않는다 (M15)', () => {
    const [payload] = toExternalCodesPayload([draftOf({ draftId: 'saved:5501' })]);

    expect(payload).not.toHaveProperty('draftId');
    expect(payload).not.toHaveProperty('itemExternalCodeId');
  });

  it('itemId를 싣지 않는다 (M16)', () => {
    expect(toExternalCodesPayload([draftOf()])[0]).not.toHaveProperty('itemId');
  });

  it('순서 필드를 싣지 않는다 (M28)', () => {
    const [payload] = toExternalCodesPayload([draftOf()]);

    expect(payload).not.toHaveProperty('displayOrder');
    expect(payload).not.toHaveProperty('sequenceNo');
  });

  /* 계약이 「비우면 (전체)」를 널로 표현한다(A-7). */
  it('비운 거래처는 널로 옮긴다', () => {
    expect(toExternalCodesPayload([draftOf({ partnerId: '' })])[0]?.partnerId).toBeNull();
  });

  it('고른 거래처는 숫자로 옮긴다', () => {
    expect(toExternalCodesPayload([draftOf({ partnerId: '6001' })])[0]?.partnerId).toBe(6001);
  });

  it('외부 품목코드의 앞뒤 공백을 뗀다', () => {
    const [payload] = toExternalCodesPayload([draftOf({ externalItemCode: ' SYN-EXT-ITEM-01  ' })]);

    expect(payload?.externalSystemCode).toBe('UNIERP');
    expect(payload?.externalItemCode).toBe('SYN-EXT-ITEM-01');
  });

  it('행이 0개면 빈 배열이다', () => {
    expect(toExternalCodesPayload([])).toEqual([]);
  });
});

/**
 * M29(외부 코드 몫) — **이 화면 최대의 중복 함정.**
 *
 * `uq_item_external_code`가 `COALESCE(partner_id,0)`으로 접는다(A-7) —
 * 거래처를 비운 두 줄은 서버에게 같은 짝이다.
 */
describe('duplicateKeyOf — COALESCE 접기 (M29)', () => {
  it('거래처를 비운 두 줄은 같은 키다', () => {
    expect(duplicateKeyOf(draftOf({ draftId: 'a', partnerId: '' }))).toBe(
      duplicateKeyOf(draftOf({ draftId: 'b', partnerId: '' })),
    );
  });

  /* 거래처가 다르면 같은 외부 시스템·같은 코드여도 다른 짝이다. */
  it('거래처가 다르면 다른 키다', () => {
    expect(duplicateKeyOf(draftOf({ partnerId: '6001' }))).not.toBe(
      duplicateKeyOf(draftOf({ partnerId: '6002' })),
    );
  });

  /* 외부 품목코드는 키가 아니다 — 코드만 다른 두 줄도 서버에게는 같은 짝이다. */
  it('외부 품목코드만 달라도 같은 키다', () => {
    expect(duplicateKeyOf(draftOf({ externalItemCode: 'A' }))).toBe(
      duplicateKeyOf(draftOf({ externalItemCode: 'B' })),
    );
  });

  it('외부 시스템이 다르면 다른 키다', () => {
    expect(duplicateKeyOf(draftOf({ externalSystemCode: 'TRACKING_SYSTEM' }))).not.toBe(
      duplicateKeyOf(draftOf()),
    );
  });

  /* 거래처 `0`은 어떤 자원도 가리키지 않는다 — 비운 것과 같은 자리로 접힌다. */
  it('거래처를 비운 것과 0은 같은 키다', () => {
    expect(duplicateKeyOf(draftOf({ partnerId: '' }))).toBe(
      duplicateKeyOf(draftOf({ partnerId: '0' })),
    );
  });
});

describe('isSameExternalCodeDrafts', () => {
  it('같은 목록은 같다고 본다', () => {
    expect(isSameExternalCodeDrafts([draftOf()], [draftOf()])).toBe(true);
  });

  it('길이가 다르면 다르다', () => {
    expect(isSameExternalCodeDrafts([draftOf()], [])).toBe(false);
  });

  it.each([
    ['externalSystemCode', { externalSystemCode: 'TRACKING_SYSTEM' }],
    ['partnerId', { partnerId: '6002' }],
    ['externalItemCode', { externalItemCode: 'SYN-EXT-ITEM-09' }],
  ] as [string, Partial<ExternalCodeDraft>][])('%s 하나만 달라도 다르다', (_field, patch) => {
    expect(isSameExternalCodeDrafts([draftOf()], [draftOf(patch)])).toBe(false);
  });
});
