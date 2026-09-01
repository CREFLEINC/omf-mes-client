import type { components } from '@omf-mes/api-client';

import { ALL_CLOSED, FLAG_KEYS, type FlagKey } from './flags';
import type { ProcessRowView } from './types';

/**
 * 기능 구성 표의 편집 상태.
 *
 * ⭐ **저장은 단말 단위 한 트랜잭션이다.** 보내는 것은 「이 단말의 구성 전체」이고,
 * ⛔ **표에서 뺀 공정은 지워진다.** 공정 행을 하나씩 보내는 경로가 없다 — 그래서 이 파일은
 * 「지금 표에 있는 것」을 그대로 본문으로 옮기며, 지워야 할 행을 따로 표시하지 않는다.
 *
 * ⭐ **0건도 보낼 수 있는 값이다.** 창고 전용 단말은 행이 없는 것이 정상이라, 빈 표를 저장하지
 * 못하게 막으면 「전부 지운다」를 표현할 길이 사라진다.
 *
 * **순수 함수만 둔다.** 「지금」을 읽지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type TerminalProcessReplace = components['schemas']['TerminalProcessReplace'];

export type GridDraft = ProcessRowView[];

/** 표에 이미 있는 공정인가 — 같은 공정을 두 줄로 둘 수 없다. */
export const hasProcess = (draft: GridDraft, processId: number): boolean =>
  draft.some((row) => row.processId === processId);

/** 공정 한 줄을 더한다. 새 줄은 **전부 닫힘**이다. */
export const addProcess = (draft: GridDraft, processId: number, processName: string): GridDraft => {
  if (hasProcess(draft, processId)) return draft;

  return [...draft, { processId, processName, ...ALL_CLOSED }];
};

export const removeProcess = (draft: GridDraft, processId: number): GridDraft =>
  draft.filter((row) => row.processId !== processId);

export const toggleFlag = (draft: GridDraft, processId: number, key: FlagKey): GridDraft =>
  draft.map((row) => (row.processId === processId ? { ...row, [key]: !row[key] } : row));

/** 한 줄을 통째로 열거나 닫는다 — 여덟 칸을 하나씩 누르지 않게 한다. */
export const setRow = (draft: GridDraft, processId: number, open: boolean): GridDraft =>
  draft.map((row) => {
    if (row.processId !== processId) return row;

    const next = { ...row };

    for (const key of FLAG_KEYS) next[key] = open;

    return next;
  });

/** 한 줄이 전부 열려 있는가 — 「모두 열기」 칸의 상태다. */
export const isRowOpen = (row: ProcessRowView): boolean => FLAG_KEYS.every((key) => row[key]);

/**
 * 저장할 것이 있는가.
 *
 * ⭐ **행 순서는 견주지 않는다.** 서버가 준 순서와 화면이 더한 순서가 달라도 뜻이 같다 —
 * 순서를 견주면 아무것도 고치지 않은 표가 「바뀌었다」로 보인다.
 */
export const isDirty = (draft: GridDraft, original: GridDraft): boolean => {
  if (draft.length !== original.length) return true;

  const byId = new Map(original.map((row) => [row.processId, row]));

  return draft.some((row) => {
    const before = byId.get(row.processId);

    if (before === undefined) return true;

    return FLAG_KEYS.some((key) => row[key] !== before[key]);
  });
};

/**
 * 표를 저장 본문으로 옮긴다.
 *
 * ⛔ **공정 이름을 싣지 않는다** — 마스터가 가진 값이고 여기서 보내면 두 곳에서 갈린다.
 */
export const toReplaceBody = (draft: GridDraft): TerminalProcessReplace => ({
  items: draft.map((row) => {
    const line: TerminalProcessReplace['items'][number] = { processId: row.processId };

    for (const key of FLAG_KEYS) line[key] = row[key];

    return line;
  }),
});
