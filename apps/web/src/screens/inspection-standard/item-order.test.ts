import { describe, expect, it } from 'vitest';

import { inspectionItemSpecFixtures } from './fixtures';
import {
  createItemDraft,
  isSameItemDrafts,
  moveItemDraft,
  removeItemDraft,
  toItemDrafts,
  toItemsPayload,
  upsertItemDraft,
} from './item-order';
import type { ItemDraft } from './types';

const drafts = (): ItemDraft[] => toItemDrafts(inspectionItemSpecFixtures);

describe('toItemDrafts', () => {
  it('서버 응답을 초안으로 옮기고 식별자를 보존한다', () => {
    const [first] = drafts();

    expect(first?.inspectionItemSpecId).toBe(5101);
    expect(first?.inspectionItemCode).toBe('SYN-ITEM-CODE-01');
    expect(first?.measurementCount).toBe('3');
  });

  /* 순서는 배열의 위치다 — 서버 채번 값을 초안에 담으면 화면이 그것을 표시하거나 되돌려 보낸다. */
  it('서버 채번 순서 값을 초안에 담지 않는다', () => {
    const [first] = drafts();

    expect(Object.keys(first ?? {})).not.toContain('sequenceNo');
  });

  it('널인 선택 값은 빈 문자열이 된다', () => {
    const second = drafts()[1];

    expect(second?.uomId).toBe('');
    expect(second?.targetValue).toBe('');
    expect(second?.inspectionMethodCode).toBe('');
  });

  it('초안 키가 행마다 다르다', () => {
    const keys = drafts().map((draft) => draft.draftId);

    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('createItemDraft', () => {
  it('새 행은 서버 식별자가 없다', () => {
    expect(createItemDraft().inspectionItemSpecId).toBeNull();
  });

  /* 계약이 기본값을 정했다 — 화면이 다른 값을 정하지 않는다. */
  it('계약의 기본값을 그대로 쓴다', () => {
    const draft = createItemDraft();

    expect(draft.measurementCount).toBe('1');
    expect(draft.requiredFlag).toBe(true);
    expect(draft.automaticJudgment).toBe(true);
  });

  it('초안 키가 저장된 행과 겹치지 않는다', () => {
    const keys = drafts().map((draft) => draft.draftId);

    expect(keys).not.toContain(createItemDraft().draftId);
  });
});

describe('moveItemDraft', () => {
  it('행을 옮긴 새 목록을 낸다', () => {
    const moved = moveItemDraft(drafts(), 0, 1);

    expect(moved.map((draft) => draft.inspectionItemCode)).toEqual([
      'SYN-ITEM-CODE-02',
      'SYN-ITEM-CODE-01',
    ]);
  });

  it('목록 밖으로 나가는 이동은 받은 목록을 그대로 돌려준다', () => {
    const original = drafts();

    expect(moveItemDraft(original, 0, -1)).toBe(original);
    expect(moveItemDraft(original, 0, 5)).toBe(original);
    expect(moveItemDraft(original, 0, 0)).toBe(original);
  });
});

describe('removeItemDraft · upsertItemDraft', () => {
  it('초안 키로 한 행을 지운다', () => {
    const original = drafts();
    const removed = removeItemDraft(original, original[0]!.draftId);

    expect(removed).toHaveLength(1);
    expect(removed[0]?.inspectionItemCode).toBe('SYN-ITEM-CODE-02');
  });

  it('없는 키는 목록 끝에 더한다', () => {
    const added = upsertItemDraft(drafts(), createItemDraft());

    expect(added).toHaveLength(3);
  });

  /* 수정이 순서를 흔들면 사용자가 다시 정렬해야 한다. */
  it('있는 키는 자리를 지킨 채 값만 바꾼다', () => {
    const original = drafts();
    const edited = upsertItemDraft(original, {
      ...original[0]!,
      inspectionItemName: '고친 이름',
    });

    expect(edited).toHaveLength(2);
    expect(edited[0]?.inspectionItemName).toBe('고친 이름');
  });
});

describe('toItemsPayload', () => {
  it('순서를 1부터 연속으로 다시 매긴다 — 서버 채번 값을 되돌려 보내지 않는다', () => {
    const payload = toItemsPayload(4002, drafts());

    expect(payload.map((item) => item.sequenceNo)).toEqual([1, 2]);
  });

  /*
   * 전체 치환은 「행 교체」가 아니다 — 식별자를 버리면 서버가 행을 새로 만들 수밖에 없고
   * 측정 기록이 참조하던 행이 무너진다.
   */
  it('기존 행은 식별자를 싣는다', () => {
    expect(toItemsPayload(4002, drafts())[0]?.inspectionItemSpecId).toBe(5101);
  });

  /* 계약: id를 생략하면 신규다 — undefined로 두면 키가 본문에 실려 뜻이 흐려진다. */
  it('새 행은 식별자 키 자체를 넣지 않는다', () => {
    const payload = toItemsPayload(4002, [createItemDraft()]);

    expect('inspectionItemSpecId' in (payload[0] ?? {})).toBe(false);
  });

  it('모든 행에 버전 번호를 싣는다', () => {
    const payload = toItemsPayload(4002, [...drafts(), createItemDraft()]);

    expect(payload.every((item) => item.inspectionPlanVersionId === 4002)).toBe(true);
  });

  it('앞뒤 공백을 떼고 선택 값을 계약 표현으로 옮긴다', () => {
    const payload = toItemsPayload(4002, [
      { ...drafts()[0]!, inspectionItemCode: '  SYN-X  ', inspectionItemName: ' 이름 ', uomId: '' },
    ]);

    expect(payload[0]?.inspectionItemCode).toBe('SYN-X');
    expect(payload[0]?.inspectionItemName).toBe('이름');
    expect(payload[0]?.uomId).toBeNull();
  });

  it('측정 횟수를 숫자로 보낸다', () => {
    expect(toItemsPayload(4002, drafts())[0]?.measurementCount).toBe(3);
  });
});

describe('isSameItemDrafts', () => {
  it('같은 목록이면 같다고 본다', () => {
    expect(isSameItemDrafts(drafts(), drafts())).toBe(true);
  });

  /* 이 화면에서 순서는 보기 방식이 아니라 저장되는 자료다. */
  it('순서만 달라도 다르다고 본다', () => {
    expect(isSameItemDrafts(drafts(), moveItemDraft(drafts(), 0, 1))).toBe(false);
  });

  it('값이 달라도 다르다고 본다', () => {
    const changed = drafts();
    changed[0] = { ...changed[0]!, measurementCount: '5' };

    expect(isSameItemDrafts(drafts(), changed)).toBe(false);
  });

  it('건수가 다르면 다르다고 본다', () => {
    expect(isSameItemDrafts(drafts(), [drafts()[0]!])).toBe(false);
  });
});
