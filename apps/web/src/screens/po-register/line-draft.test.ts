import { describe, expect, it } from 'vitest';

import { sourceLineView } from './fixtures';
import {
  addLineDraft,
  createInheritedLineDraft,
  patchLineDraft,
  removeLineDraft,
} from './line-draft';

/**
 * 라인 초안 — **아직 보내지 않은 입력**이다.
 *
 * **키가 이 파일의 중심이다.** 줄마다 안정 키를 만들어 표의 `getRowId`가 쓰게 한다
 * (사본 체크리스트 2번). 인덱스가 키가 되면 앞 줄이 사라질 때 치고 있던 칸의 DOM 노드가
 * 대신 지워져 입력과 포커스가 말없이 다른 줄로 옮겨 붙는다.
 */

describe('createInheritedLineDraft', () => {
  it('품목·단위는 그대로 이어받고 발주수량 기본값이 입하수량이다(계획 결정 4)', () => {
    const draft = createInheritedLineDraft(sourceLineView());

    expect(draft.sourceLineId).toBe(9111);
    expect(draft.sourceQty).toBe(12);
    expect(draft.itemId).toBe('9501');
    expect(draft.uomId).toBe('9601');
    expect(draft.orderedQty).toBe('12');
  });

  it('허용치 기본은 0이다 — 보이는 값과 보낼 값이 같아야 한다', () => {
    const draft = createInheritedLineDraft(sourceLineView());

    expect(draft.toleranceOverQty).toBe('0');
    expect(draft.toleranceUnderQty).toBe('0');
  });

  it('승계 줄끼리도 키가 겹치지 않는다', () => {
    const first = createInheritedLineDraft(sourceLineView());
    const second = createInheritedLineDraft(sourceLineView());

    expect(first.key).not.toBe(second.key);
  });
});

describe('addLineDraft', () => {
  it('빈 줄을 뒤에 더한다. 더한 줄에는 승계 근거가 없다', () => {
    const rows = addLineDraft([createInheritedLineDraft(sourceLineView())]);
    const added = rows[1];

    expect(rows).toHaveLength(2);
    expect(added?.sourceLineId).toBeNull();
    expect(added?.sourceQty).toBeNull();
    expect(added?.itemId).toBe('');
    expect(added?.orderedQty).toBe('');
  });

  it('더할 때마다 키가 새로 생긴다', () => {
    const rows = addLineDraft(addLineDraft([createInheritedLineDraft(sourceLineView())]));

    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
  });
});

describe('removeLineDraft', () => {
  it('가운데 줄을 지워도 남은 줄의 키와 값이 그대로다', () => {
    const rows = addLineDraft(addLineDraft([createInheritedLineDraft(sourceLineView())]));
    const withValue = patchLineDraft(rows, rows[2]?.key ?? '', { orderedQty: '7' });

    const left = removeLineDraft(withValue, rows[1]?.key ?? '');

    expect(left).toHaveLength(2);
    expect(left[1]?.key).toBe(rows[2]?.key);
    expect(left[1]?.orderedQty).toBe('7');
  });
});

describe('patchLineDraft', () => {
  it('그 줄만 바꾸고 새 배열을 만든다 — 같은 참조를 고치면 화면이 다시 그려지지 않는다', () => {
    const rows = addLineDraft([createInheritedLineDraft(sourceLineView())]);
    const next = patchLineDraft(rows, rows[0]?.key ?? '', { orderedQty: '20' });

    expect(next).not.toBe(rows);
    expect(next[0]?.orderedQty).toBe('20');
    expect(next[1]?.orderedQty).toBe(rows[1]?.orderedQty);
  });

  it('없는 키에는 아무것도 하지 않는다', () => {
    const rows = [createInheritedLineDraft(sourceLineView())];

    expect(patchLineDraft(rows, 'no-such-key', { orderedQty: '20' })[0]?.orderedQty).toBe('12');
  });
});
