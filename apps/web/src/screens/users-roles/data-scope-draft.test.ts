import { describe, expect, it } from 'vitest';

import {
  createDataScopeDraft,
  duplicateKeyOf,
  isSameDataScopeDrafts,
  removeDataScopeDraft,
  toDataScopeDrafts,
  toDataScopesPayload,
  upsertDataScopeDraft,
  type DataScopeDraft,
} from './data-scope-draft';
import type { UserDataScope } from './types';

const saved = (
  userDataScopeId: number,
  businessUnitId: number | null,
  plantId: number | null,
): UserDataScope => ({ userDataScopeId, appUserId: 1001, businessUnitId, plantId });

const draftOf = (overrides: Partial<DataScopeDraft> = {}): DataScopeDraft => ({
  draftId: 'new:1',
  businessUnitId: '',
  plantId: '',
  ...overrides,
});

describe('toDataScopeDrafts', () => {
  it('서버가 준 줄을 초안으로 옮긴다', () => {
    expect(toDataScopeDrafts([saved(9001, 2001, 4001)])).toEqual([
      { draftId: 'saved:9001', businessUnitId: '2001', plantId: '4001' },
    ]);
  });

  /** 계약이 널로 「(전체)」를 표현한다 — 화면에서는 빈 문자열 하나로 모은다. */
  it('널과 키 부재를 모두 빈 축으로 모은다', () => {
    expect(toDataScopeDrafts([saved(9002, null, 4001)])[0]?.businessUnitId).toBe('');
    expect(
      toDataScopeDrafts([{ userDataScopeId: 9003, appUserId: 1001, plantId: 4001 }])[0]
        ?.businessUnitId,
    ).toBe('');
  });

  it('빈 목록은 빈 초안이다', () => {
    expect(toDataScopeDrafts([])).toEqual([]);
  });
});

describe('createDataScopeDraft', () => {
  it('두 축이 모두 빈 새 줄을 만든다', () => {
    const draft = createDataScopeDraft();

    expect(draft.businessUnitId).toBe('');
    expect(draft.plantId).toBe('');
  });

  /** 저장된 줄과 겹치면 수정이 엉뚱한 줄을 갈아 끼운다. */
  it('초안 키가 저장된 줄과 겹치지 않고 부를 때마다 다르다', () => {
    const first = createDataScopeDraft();
    const second = createDataScopeDraft();

    expect(first.draftId).not.toBe(second.draftId);
    expect(first.draftId.startsWith('saved:')).toBe(false);
  });
});

describe('upsertDataScopeDraft', () => {
  it('없는 키는 뒤에 더한다', () => {
    const drafts = [draftOf({ draftId: 'saved:9001', businessUnitId: '2001' })];

    expect(upsertDataScopeDraft(drafts, draftOf({ draftId: 'new:2' })).map((d) => d.draftId)).toEqual(
      ['saved:9001', 'new:2'],
    );
  });

  /** 수정이 순서를 흔들면 사용자가 고친 줄을 다시 찾아야 한다. */
  it('있는 키는 자리를 지킨 채 값만 바꾼다', () => {
    const drafts = [
      draftOf({ draftId: 'saved:9001', businessUnitId: '2001' }),
      draftOf({ draftId: 'saved:9002', businessUnitId: '2002' }),
    ];

    const next = upsertDataScopeDraft(
      drafts,
      draftOf({ draftId: 'saved:9001', businessUnitId: '2009' }),
    );

    expect(next.map((d) => d.draftId)).toEqual(['saved:9001', 'saved:9002']);
    expect(next[0]?.businessUnitId).toBe('2009');
  });
});

describe('removeDataScopeDraft', () => {
  it('그 줄만 지운다', () => {
    const drafts = [draftOf({ draftId: 'a' }), draftOf({ draftId: 'b' })];

    expect(removeDataScopeDraft(drafts, 'a').map((d) => d.draftId)).toEqual(['b']);
  });
});

describe('duplicateKeyOf', () => {
  /**
   * 계약의 유일 제약이 `COALESCE(…,0)`으로 빈 축을 접는다 —
   * 사업부만 고른 두 줄은 서버에게 **같은 짝**이다.
   */
  it('빈 축을 0으로 접는다', () => {
    expect(duplicateKeyOf(draftOf({ businessUnitId: '2001' }))).toBe(
      duplicateKeyOf(draftOf({ draftId: 'new:2', businessUnitId: '2001' })),
    );
  });

  it('두 축이 모두 비면 같은 키다', () => {
    expect(duplicateKeyOf(draftOf())).toBe(duplicateKeyOf(draftOf({ draftId: 'new:2' })));
  });

  it('축이 다르면 다른 키다', () => {
    expect(duplicateKeyOf(draftOf({ businessUnitId: '2001' }))).not.toBe(
      duplicateKeyOf(draftOf({ plantId: '2001' })),
    );
  });

  it('사업부만 고른 줄과 두 축을 다 고른 줄은 다른 키다', () => {
    expect(duplicateKeyOf(draftOf({ businessUnitId: '2001' }))).not.toBe(
      duplicateKeyOf(draftOf({ businessUnitId: '2001', plantId: '4001' })),
    );
  });
});

describe('toDataScopesPayload', () => {
  /** 계약의 요청 항목은 두 축뿐이다 — 다른 화면의 치환을 베끼면 식별자가 함께 나간다. */
  it('식별자를 싣지 않는다', () => {
    const payload = toDataScopesPayload(
      toDataScopeDrafts([saved(9001, 2001, 4001)]),
    );

    expect(Object.keys(payload[0] ?? {})).toEqual(['businessUnitId', 'plantId']);
  });

  it('번호를 계약 표현(숫자)으로 옮긴다', () => {
    expect(toDataScopesPayload([draftOf({ businessUnitId: '2001', plantId: '4001' })])).toEqual([
      { businessUnitId: 2001, plantId: 4001 },
    ]);
  });

  /**
   * **키를 빼지 않는다.** 여기서 빈 축은 사용자가 고른 「(전체)」다 —
   * 키를 빼면 「정하지 않았다」가 되어 서버가 이전 값을 남길 수 있다.
   */
  it('빈 축은 키를 빼지 않고 널로 명시해 싣는다', () => {
    const payload = toDataScopesPayload([draftOf({ businessUnitId: '2001' })]);

    expect(payload[0]).toEqual({ businessUnitId: 2001, plantId: null });
    expect(Object.keys(payload[0] ?? {})).toContain('plantId');
  });

  it('순서는 표의 줄 순서 그대로다', () => {
    const payload = toDataScopesPayload([
      draftOf({ draftId: 'a', businessUnitId: '2002' }),
      draftOf({ draftId: 'b', businessUnitId: '2001' }),
    ]);

    expect(payload.map((item) => item.businessUnitId)).toEqual([2002, 2001]);
  });

  it('줄이 없으면 빈 배열이다 — 전체 회수도 정상 조작이다', () => {
    expect(toDataScopesPayload([])).toEqual([]);
  });
});

describe('isSameDataScopeDrafts', () => {
  it('같은 값이면 같다', () => {
    expect(
      isSameDataScopeDrafts(
        [draftOf({ businessUnitId: '2001' })],
        [draftOf({ businessUnitId: '2001' })],
      ),
    ).toBe(true);
  });

  it('축 하나만 달라도 다르다', () => {
    expect(
      isSameDataScopeDrafts(
        [draftOf({ businessUnitId: '2001' })],
        [draftOf({ businessUnitId: '2002' })],
      ),
    ).toBe(false);
  });

  it('건수가 다르면 다르다', () => {
    expect(isSameDataScopeDrafts([draftOf()], [])).toBe(false);
  });

  /** 줄 순서가 곧 저장 본문의 순서라 순서도 자료의 일부다. */
  it('순서가 다르면 다르다', () => {
    const a = draftOf({ draftId: 'a', businessUnitId: '2001' });
    const b = draftOf({ draftId: 'b', businessUnitId: '2002' });

    expect(isSameDataScopeDrafts([a, b], [b, a])).toBe(false);
  });
});
