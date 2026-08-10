import { messages } from '@omf-mes/i18n';

import type { PoLineView } from './types';

/**
 * 라인 초안 — **아직 보내지 않은 입력**이다.
 *
 * 이 화면에서 사용자가 라인에 넣는 것은 「이번 도착 수량」 하나뿐이다(계획 결정 5).
 * 품목·단위·발주 라인 번호는 발주 라인에서 오며 사용자가 고르지 않는다.
 *
 * **친 글자를 그대로 들고 있는다.** 숫자로 강제해 들고 있으면 지우는 도중(`1` → `` → `2`)에
 * 값이 튀고, 「0.」처럼 아직 완성되지 않은 입력이 사라진다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.overReceiptSplit;

/**
 * 라인 초안 한 벌. **발주 라인 번호가 키다** — 초안이 어느 라인에 묶여 있는지를 자료 구조가 밝힌다.
 *
 * 대상 발주가 바뀌면 키 집합이 통째로 바뀐다. 그것이 「대상이 바뀌면 수량이 뜻을 잃는다」의 구현이다.
 */
export type LineDrafts = Readonly<Record<number, string>>;

/**
 * 친 글자의 해석 결과. **세 갈래를 타입으로 가른다** —
 * 미입력 · 형식 오류 · 수량. 미입력을 오류와 뭉개면 「받지 않는 줄」이 전부 오류가 된다.
 */
export type QtyParse =
  | { kind: 'empty' }
  | { kind: 'invalid'; message: string }
  | { kind: 'qty'; value: number };

/**
 * 친 글자를 수량으로 읽는다.
 *
 * **빈 칸은 오류가 아니다** — 「이 라인은 이번에 받지 않는다」는 뜻이다.
 * 0과 음수는 계약이 `exclusiveMinimum: 0`으로 막으므로 화면도 막고, **사유를 갈라** 낸다.
 *
 * `Number()`는 빈 문자열과 공백을 `0`으로 읽고 `Infinity`를 숫자로 읽는다 —
 * 둘 다 여기서 걸러 낸다. 걸러 내지 않으면 요청 본문에 `null`이나 `0`이 실린다.
 */
export const parseQty = (raw: string): QtyParse => {
  const text = raw.trim();

  if (text === '') return { kind: 'empty' };

  const value = Number(text);

  if (!Number.isFinite(value)) return { kind: 'invalid', message: t.errors.qtyNotNumber };
  if (value <= 0) return { kind: 'invalid', message: t.errors.qtyNotPositive };

  return { kind: 'qty', value };
};

/**
 * 라인 응답으로 초안을 새로 만든다. **줄마다 빈 칸 하나씩**이다.
 *
 * 앞 발주에서 친 수량이 남지 않는 것이 요점이다 — 초안은 특정 발주의 라인에 묶여 있어
 * 대상이 바뀌면 그 수량은 뜻을 잃는다.
 */
export const createDrafts = (lines: readonly PoLineView[]): LineDrafts =>
  Object.fromEntries(lines.map((line) => [line.purchaseOrderLineId, '']));

/** 한 줄의 수량을 바꾼다. 앞 초안을 고치지 않는다 — 같은 참조를 고치면 화면이 다시 그려지지 않는다. */
export const setDraftQty = (
  drafts: LineDrafts,
  purchaseOrderLineId: number,
  text: string,
): LineDrafts => ({ ...drafts, [purchaseOrderLineId]: text });

/**
 * 한 줄에 친 글자.
 *
 * **초안에 없는 줄은 빈 칸으로 읽는다.** 라인 응답이 도착한 렌더와 초안을 새로 만드는 effect
 * 사이에 그 줄이 초안에 없는 순간이 실제로 있고, 그때 `undefined`가 입력칸의 `value`로 들어가면
 * 제어 입력칸이 비제어로 바뀐다.
 */
export const readDraftQty = (drafts: LineDrafts, purchaseOrderLineId: number): string =>
  drafts[purchaseOrderLineId] ?? '';

/**
 * 버릴 것이 있는가. 대상을 바꾸거나 취소할 때 확인을 받을지 정한다(계획 결정 10 · PR ②).
 *
 * **잘못 친 값도 채운 것으로 본다** — 사용자가 친 값이라는 사실은 같다.
 * 공백만 친 칸은 버릴 값이 아니다.
 */
export const hasAnyQty = (drafts: LineDrafts): boolean =>
  Object.values(drafts).some((text) => text.trim() !== '');
