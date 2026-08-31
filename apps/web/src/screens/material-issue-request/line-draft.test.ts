import { describe, expect, it } from 'vitest';

import {
  addLineDraft,
  emptyLineDraft,
  lineDraftsFromShortage,
  patchLineDraft,
  removeLineDraft,
  replaceShortageDrafts,
} from './line-draft';
import { shortageFixtures } from './fixtures';
import { toShortageLineView } from './types';

/**
 * 집중 갈래 — **「불러오기」 재실행이 손으로 더한 줄을 지우지 않는가**(D-6).
 *
 * 지우면 사용자는 「내가 지웠나」로 착각하고, 키가 바뀌면 치고 있던 칸의 포커스가 날아간다.
 */

const shortage = shortageFixtures.map(toShortageLineView);

describe('lineDraftsFromShortage', () => {
  it('요청 수량 기본값이 부족량이다', () => {
    const drafts = lineDraftsFromShortage(shortage);

    expect(drafts.map((draft) => draft.requestedQty)).toEqual(['80', '0', '10']);
  });

  it('부족 0 인 줄도 표에 남긴다 — 요청 수량 0 으로 두고 본문에서 뺀다', () => {
    expect(lineDraftsFromShortage(shortage)).toHaveLength(shortage.length);
  });

  it('소요·기출고·부족 셋을 그대로 승계한다 — 화면이 다시 세지 않는다', () => {
    const [first] = lineDraftsFromShortage(shortage);

    expect(first?.requiredQty).toBe(200);
    expect(first?.issuedQty).toBe(120);
    expect(first?.shortageQty).toBe(80);
  });

  it('구성요소가 빈 소요 줄은 BOM 밖으로 승계한다', () => {
    const drafts = lineDraftsFromShortage(shortage);

    expect(drafts[2]?.bomComponentId).toBeNull();
  });

  it('줄마다 다른 키를 준다', () => {
    const drafts = lineDraftsFromShortage(shortage);

    expect(new Set(drafts.map((draft) => draft.key)).size).toBe(drafts.length);
  });
});

describe('replaceShortageDrafts (D-6)', () => {
  it('손으로 더한 줄을 키까지 그대로 남긴다', () => {
    const manual = { ...emptyLineDraft(), itemId: '7409', requestedQty: '5' };
    const before = [...lineDraftsFromShortage(shortage), manual];

    const after = replaceShortageDrafts(before, shortage);
    const survivor = after.find((line) => line.origin === 'manual');

    expect(survivor).toBeDefined();
    expect(survivor?.key).toBe(manual.key);
    expect(survivor?.itemId).toBe('7409');
    expect(survivor?.requestedQty).toBe('5');
  });

  it('BOM 유래 줄만 갈아 끼운다 — 고쳐 둔 요청 수량이 새 부족량으로 되돌아간다', () => {
    const before = lineDraftsFromShortage(shortage).map((line) => ({
      ...line,
      requestedQty: '999',
    }));

    const after = replaceShortageDrafts(before, shortage);

    expect(after.map((line) => line.requestedQty)).toEqual(['80', '0', '10']);
  });

  it('소요가 빈 목록으로 오면 BOM 유래 줄이 사라지고 손으로 더한 줄만 남는다', () => {
    const manual = emptyLineDraft();
    const after = replaceShortageDrafts([...lineDraftsFromShortage(shortage), manual], []);

    expect(after).toHaveLength(1);
    expect(after[0]?.key).toBe(manual.key);
  });
});

describe('addLineDraft · removeLineDraft · patchLineDraft', () => {
  it('빈 줄은 값을 지어내지 않는다', () => {
    const draft = emptyLineDraft();

    expect(draft.itemId).toBe('');
    expect(draft.uomId).toBe('');
    expect(draft.requestedQty).toBe('');
    expect(draft.bomComponentId).toBeNull();
  });

  it('줄을 지워도 남은 줄의 키가 그대로다', () => {
    const rows = [emptyLineDraft(), emptyLineDraft(), emptyLineDraft()];
    const target = rows[1];
    const after = removeLineDraft(rows, target?.key ?? '');

    expect(after.map((line) => line.key)).toEqual([rows[0]?.key, rows[2]?.key]);
  });

  it('앞 초안을 고치지 않는다', () => {
    const rows = [emptyLineDraft()];
    const after = patchLineDraft(rows, rows[0]?.key ?? '', { requestedQty: '5' });

    expect(rows[0]?.requestedQty).toBe('');
    expect(after[0]?.requestedQty).toBe('5');
  });

  it('품목이 바뀌면 BOM 유래 판정을 비운다 — 앞 품목의 FK 가 남지 않는다', () => {
    const rows = [{ ...emptyLineDraft(), itemId: '7401', bomComponentId: 7601 }];
    const after = patchLineDraft(rows, rows[0]?.key ?? '', { itemId: '7409' });

    expect(after[0]?.bomComponentId).toBeNull();
  });

  it('품목이 그대로면 BOM 유래 판정을 건드리지 않는다', () => {
    const rows = [{ ...emptyLineDraft(), itemId: '7401', bomComponentId: 7601 }];
    const after = patchLineDraft(rows, rows[0]?.key ?? '', { requestedQty: '5' });

    expect(after[0]?.bomComponentId).toBe(7601);
  });

  it('없는 키는 그냥 지나간다', () => {
    const rows = [emptyLineDraft()];

    expect(patchLineDraft(rows, 'no-such-key', { requestedQty: '5' })).toEqual(rows);
  });

  it('줄을 더하면 끝에 붙는다', () => {
    const rows = [emptyLineDraft()];
    const after = addLineDraft(rows);

    expect(after).toHaveLength(2);
    expect(after[0]?.key).toBe(rows[0]?.key);
  });
});
