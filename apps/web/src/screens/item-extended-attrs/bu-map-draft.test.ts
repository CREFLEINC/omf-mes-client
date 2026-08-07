import { describe, expect, it } from 'vitest';

import {
  createBuMapDraft,
  isSameBuMapDrafts,
  removeBuMapDraft,
  toBuMapDrafts,
  toBuMapsPayload,
  upsertBuMapDraft,
  type BuMapDraft,
} from './bu-map-draft';
import { buMapFixtures } from './fixtures';

const draftOf = (overrides: Partial<BuMapDraft> = {}): BuMapDraft => ({
  draftId: 'new:1',
  fromBusinessUnitId: '5001',
  toBusinessUnitId: '5002',
  toItemId: '1002',
  effectiveFrom: '2026-01-01',
  effectiveTo: '',
  ...overrides,
});

describe('toBuMapDrafts', () => {
  it('서버 목록을 초안으로 옮긴다', () => {
    const drafts = toBuMapDrafts(buMapFixtures);

    expect(drafts[0]).toEqual({
      draftId: 'saved:3001',
      fromBusinessUnitId: '5001',
      toBusinessUnitId: '5002',
      toItemId: '1002',
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-12-31',
    });
  });

  /* 널과 빈 문자열이 섞이면 입력칸이 「지정하지 않음」을 두 가지로 표현하게 된다. */
  it('널 유효 종료를 빈 문자열로 모은다', () => {
    expect(toBuMapDrafts(buMapFixtures)[1]?.effectiveTo).toBe('');
  });

  /*
   * **초안이 서버 식별자와 `fromItemId`를 들고 다니지 않는다.**
   * 들고 다니면 본문에 실릴 여지가 생긴다 — 계약의 요청 항목에 둘 다 없다.
   */
  it('서버 식별자와 fromItemId를 초안에 담지 않는다', () => {
    for (const draft of toBuMapDrafts(buMapFixtures)) {
      expect(draft).not.toHaveProperty('itemBuItemMapId');
      expect(draft).not.toHaveProperty('fromItemId');
      expect(draft).not.toHaveProperty('itemId');
    }
  });
});

describe('createBuMapDraft', () => {
  it('빈 줄을 만든다', () => {
    const draft = createBuMapDraft();

    expect(draft.fromBusinessUnitId).toBe('');
    expect(draft.toBusinessUnitId).toBe('');
    expect(draft.toItemId).toBe('');
    expect(draft.effectiveFrom).toBe('');
    expect(draft.effectiveTo).toBe('');
  });

  /* 저장된 줄(`saved:<id>`)과 겹치면 표의 행 식별자가 흔들린다. */
  it('새 줄의 키가 저장된 줄과 겹치지 않고 서로 다르다', () => {
    const first = createBuMapDraft();
    const second = createBuMapDraft();

    expect(first.draftId).toMatch(/^new:/);
    expect(first.draftId).not.toBe(second.draftId);
  });
});

describe('upsertBuMapDraft · removeBuMapDraft', () => {
  it('없는 키는 끝에 더한다', () => {
    const added = upsertBuMapDraft([], draftOf());

    expect(added).toHaveLength(1);
  });

  /* 수정이 순서를 흔들면 사용자가 고친 줄을 다시 찾아야 한다. */
  it('있는 키는 자리를 지킨 채 값만 바꾼다', () => {
    const drafts = [
      draftOf({ draftId: 'a' }),
      draftOf({ draftId: 'b' }),
      draftOf({ draftId: 'c' }),
    ];

    const next = upsertBuMapDraft(drafts, draftOf({ draftId: 'b', toItemId: '9001' }));

    expect(next.map((draft) => draft.draftId)).toEqual(['a', 'b', 'c']);
    expect(next[1]?.toItemId).toBe('9001');
  });

  it('키로 한 줄만 지운다', () => {
    const drafts = [draftOf({ draftId: 'a' }), draftOf({ draftId: 'b' })];

    expect(removeBuMapDraft(drafts, 'a').map((draft) => draft.draftId)).toEqual(['b']);
  });
});

/**
 * 치환 본문 규칙 — M15·M16·M28.
 *
 * 서버가 남는 키를 막지 않으므로(계약 실측 P와 같은 성질) 이 단위 테스트와 화면 테스트가
 * 경계를 지키는 유일한 수단이다.
 */
describe('toBuMapsPayload (M15·M16·M28)', () => {
  it('계약의 다섯 키만 실린다', () => {
    const [payload] = toBuMapsPayload([draftOf({ effectiveTo: '2026-12-31' })]);

    expect(Object.keys(payload ?? {}).sort()).toEqual([
      'effectiveFrom',
      'effectiveTo',
      'fromBusinessUnitId',
      'toBusinessUnitId',
      'toItemId',
    ]);
  });

  /* M15 — 초안 키·서버 식별자가 본문에 실리면 안 된다. */
  it('초안 키와 서버 식별자를 싣지 않는다', () => {
    const [payload] = toBuMapsPayload([draftOf({ draftId: 'saved:3001' })]);

    expect(payload).not.toHaveProperty('draftId');
    expect(payload).not.toHaveProperty('itemBuItemMapId');
  });

  /* M16 — 계약: 「fromItemId 는 경로의 itemId 로 고정한다」. */
  it('itemId·fromItemId를 싣지 않는다', () => {
    const [payload] = toBuMapsPayload([draftOf()]);

    expect(payload).not.toHaveProperty('itemId');
    expect(payload).not.toHaveProperty('fromItemId');
  });

  /* M28 — 이 표에 순서 컬럼이 없다. 화면이 순서를 만들면 새로고침에 사라진다. */
  it('순서 필드를 싣지 않는다', () => {
    const [payload] = toBuMapsPayload([draftOf()]);

    expect(payload).not.toHaveProperty('displayOrder');
    expect(payload).not.toHaveProperty('sequenceNo');
    expect(payload).not.toHaveProperty('sortOrder');
  });

  it('번호는 숫자로 옮긴다 — 문자열을 그대로 보내면 계약과 어긋난다', () => {
    const [payload] = toBuMapsPayload([draftOf()]);

    expect(payload?.fromBusinessUnitId).toBe(5001);
    expect(payload?.toBusinessUnitId).toBe(5002);
    expect(payload?.toItemId).toBe(1002);
  });

  /* 비우는 것이 정상 값이다(무기한) — 빈 문자열을 그대로 보내면 날짜 형식 위반이다. */
  it('비운 유효 종료는 널로 옮긴다', () => {
    expect(toBuMapsPayload([draftOf({ effectiveTo: '' })])[0]?.effectiveTo).toBeNull();
    expect(toBuMapsPayload([draftOf({ effectiveTo: '  ' })])[0]?.effectiveTo).toBeNull();
  });

  /* 요청을 생략하면 「지우려 했는데 그대로 남는」 상태가 된다(M18의 단위 근거). */
  it('행이 0개면 빈 배열이다', () => {
    expect(toBuMapsPayload([])).toEqual([]);
  });
});

describe('isSameBuMapDrafts', () => {
  it('같은 목록은 같다고 본다', () => {
    expect(isSameBuMapDrafts([draftOf()], [draftOf()])).toBe(true);
  });

  it('길이가 다르면 다르다', () => {
    expect(isSameBuMapDrafts([draftOf()], [])).toBe(false);
  });

  /* 한 칸만 고쳐도 「고친 것이 있다」로 잡혀야 저장 버튼이 열린다. */
  it.each([
    ['fromBusinessUnitId', { fromBusinessUnitId: '5003' }],
    ['toBusinessUnitId', { toBusinessUnitId: '5003' }],
    ['toItemId', { toItemId: '9001' }],
    ['effectiveFrom', { effectiveFrom: '2026-02-01' }],
    ['effectiveTo', { effectiveTo: '2026-12-31' }],
  ] as [string, Partial<BuMapDraft>][])('%s 하나만 달라도 다르다', (_field, patch) => {
    expect(isSameBuMapDrafts([draftOf()], [draftOf(patch)])).toBe(false);
  });
});
