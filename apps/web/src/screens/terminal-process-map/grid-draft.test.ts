import { describe, expect, it } from 'vitest';

import { ALL_CLOSED, FLAG_KEYS } from './flags';
import {
  addProcess,
  hasProcess,
  isDirty,
  isRowOpen,
  removeProcess,
  setRow,
  toggleFlag,
  toReplaceBody,
  type GridDraft,
} from './grid-draft';
import type { ProcessRowView } from './types';

/**
 * 「틀려도 조용한 것」만 시험한다 — 화면은 정상으로 보이면서 서버에 다른 뜻이 전달되는 계산.
 *
 * ⭐ 이 저장은 **집합을 통째로 치환한다**(검증 수준 「중요」 3번 지점). 본문에 빠진 행은
 * 지워지므로, 표를 본문으로 옮기는 규칙이 틀리면 **아무도 지우라고 하지 않은 구성이 사라진다.**
 */

const row = (processId: number, patch: Partial<ProcessRowView> = {}): ProcessRowView => ({
  processId,
  processName: `공정 ${String(processId)}`,
  ...ALL_CLOSED,
  ...patch,
});

describe('addProcess', () => {
  it('새 줄은 전부 닫힘이다 — 더하는 것과 여는 것은 다른 일이다', () => {
    const [added] = addProcess([], 7, '사출');

    expect(added).toBeDefined();
    expect(FLAG_KEYS.every((key) => added?.[key] === false)).toBe(true);
  });

  it('이미 있는 공정은 두 줄로 두지 않는다', () => {
    const draft = [row(7)];

    expect(addProcess(draft, 7, '사출')).toBe(draft);
  });

  it('공정 이름을 함께 담는다 — 표가 번호만 보이면 고를 수 없다', () => {
    expect(addProcess([], 7, '사출')[0]?.processName).toBe('사출');
  });
});

describe('hasProcess · removeProcess', () => {
  it('있는 것과 없는 것을 가린다', () => {
    expect(hasProcess([row(7)], 7)).toBe(true);
    expect(hasProcess([row(7)], 8)).toBe(false);
  });

  it('뺀 줄만 사라진다', () => {
    expect(removeProcess([row(7), row(8)], 7).map((item) => item.processId)).toEqual([8]);
  });
});

describe('toggleFlag · setRow', () => {
  it('한 칸만 뒤집는다 — 옆 칸을 건드리지 않는다', () => {
    const next = toggleFlag([row(7)], 7, 'canStartWork');

    expect(next[0]?.canStartWork).toBe(true);
    expect(next[0]?.canCompleteWork).toBe(false);
  });

  it('다른 공정의 같은 칸은 그대로 둔다', () => {
    const next = toggleFlag([row(7), row(8)], 7, 'canStartWork');

    expect(next[1]?.canStartWork).toBe(false);
  });

  it('줄을 통째로 열고 닫는다', () => {
    const opened = setRow([row(7)], 7, true);
    const first = opened[0];

    expect(first).toBeDefined();
    expect(FLAG_KEYS.every((key) => first?.[key] === true)).toBe(true);
    expect(isRowOpen(first as ProcessRowView)).toBe(true);
    expect(isRowOpen(setRow(opened, 7, false)[0] as ProcessRowView)).toBe(false);
  });

  it('한 칸이라도 닫혀 있으면 「모두 열림」이 아니다', () => {
    const almost = setRow([row(7)], 7, true);
    const partial = toggleFlag(almost, 7, 'canPrintLabel');

    expect(isRowOpen(partial[0] as ProcessRowView)).toBe(false);
  });
});

describe('isDirty', () => {
  const original: GridDraft = [row(7, { canStartWork: true }), row(8)];

  it('그대로면 저장할 것이 없다', () => {
    expect(isDirty([row(7, { canStartWork: true }), row(8)], original)).toBe(false);
  });

  it('⭐ 줄 순서만 다른 것은 바뀐 것이 아니다', () => {
    expect(isDirty([row(8), row(7, { canStartWork: true })], original)).toBe(false);
  });

  it('칸 하나가 달라지면 바뀐 것이다', () => {
    expect(isDirty([row(7), row(8)], original)).toBe(true);
  });

  it('줄을 빼면 바뀐 것이다 — 뺀 줄은 저장할 때 지워진다', () => {
    expect(isDirty([row(7, { canStartWork: true })], original)).toBe(true);
  });

  it('같은 수의 다른 공정으로 바꿔치면 바뀐 것이다', () => {
    expect(isDirty([row(7, { canStartWork: true }), row(9)], original)).toBe(true);
  });
});

describe('toReplaceBody', () => {
  it('⭐ 표에 있는 줄만 담는다 — 담기지 않은 공정은 지워진다', () => {
    const body = toReplaceBody([row(7), row(8)]);

    expect(body.items.map((item) => item.processId)).toEqual([7, 8]);
  });

  it('⭐ 빈 표도 보낼 수 있는 값이다 — 창고 전용 단말은 0건이 정상이다', () => {
    expect(toReplaceBody([]).items).toEqual([]);
  });

  it('여덟 칸을 모두 싣는다 — 빠진 칸은 서버가 기본값으로 읽는다', () => {
    const line = toReplaceBody([row(7, { canPrintLabel: true })]).items[0];

    expect(line).toBeDefined();
    for (const key of FLAG_KEYS) expect(line?.[key]).toBe(key === 'canPrintLabel');
  });

  it('⛔ 공정 이름을 싣지 않는다 — 마스터가 가진 값이다', () => {
    expect('processName' in (toReplaceBody([row(7)]).items[0] ?? {})).toBe(false);
  });

  it('⛔ 승인 플래그를 만들지 않는다 — 계약에 없다', () => {
    expect('canApprove' in (toReplaceBody([row(7)]).items[0] ?? {})).toBe(false);
  });
});
