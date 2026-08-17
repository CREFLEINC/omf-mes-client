import type { LineDraft, SourceLineView } from './types';

/**
 * 발주 라인 초안 — **아직 보내지 않은 입력**이다.
 *
 * **친 글자를 그대로 들고 있는다.** 숫자로 강제해 들고 있으면 지우는 도중(`1` → `` → `2`)에
 * 값이 튀고, 「0.」처럼 아직 완성되지 않은 입력이 사라진다.
 *
 * **줄마다 안정 키를 만든다**(사본 체크리스트 2번). 표의 `getRowId`가 이 키를 쓰므로,
 * 가운데 줄을 지워도 남은 줄의 DOM 노드가 살아남아 치던 값과 포커스가 그 자리에 남는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/**
 * 초안 키의 일련번호. **서버로 나가지 않는 값**이라 한 세션 안에서 유일하기만 하면 된다.
 *
 * 승계 줄에도 입하 라인 번호가 아니라 이 일련번호를 쓴다 — 같은 줄을 두 번 승계하는 경로
 * (대상을 바꿨다가 되돌리는 것)가 있어, 입하 라인 번호를 키로 삼으면 옛 줄과 새 줄이
 * 같은 키를 갖는 순간이 생긴다.
 */
let draftSequence = 0;

const nextKey = (prefix: string): string => {
  draftSequence += 1;

  return `${prefix}:${String(draftSequence)}`;
};

/**
 * 고른 입하 라인을 발주 라인 1행으로 승계한다(계획 결정 4).
 *
 * 품목·단위는 그대로 이어받고 **발주수량 기본값이 입하수량**이다. 그 값이 곧 하한이라
 * 기본값 그대로 두면 언제나 유효하다 — 사용자가 늘려서 발주하는 것이 이 화면의 정상 경로다.
 *
 * 허용치 기본은 **0을 글자로** 채운다. 비워 두면 보이는 값(빈 칸)과 보내는 값(0)이 갈린다.
 */
export const createInheritedLineDraft = (line: SourceLineView): LineDraft => ({
  key: nextKey('source'),
  sourceLineId: line.inboundReceiptLineId,
  sourceQty: line.receivedQty,
  itemId: String(line.itemId),
  orderedQty: String(line.receivedQty),
  uomId: String(line.uomId),
  toleranceOverQty: '0',
  toleranceUnderQty: '0',
});

/**
 * 사용자가 더한 빈 줄. **승계 근거가 없다** — 그래서 하한도 없다(계획 결정 5).
 *
 * 품목·단위를 지어내지 않는다. 승계 줄의 값을 물려주면 사용자가 고르지 않은 품목이
 * 되돌릴 수 없는 전표에 실린다.
 */
export const addLineDraft = (lines: readonly LineDraft[]): LineDraft[] => [
  ...lines,
  {
    key: nextKey('new'),
    sourceLineId: null,
    sourceQty: null,
    itemId: '',
    orderedQty: '',
    uomId: '',
    toleranceOverQty: '0',
    toleranceUnderQty: '0',
  },
];

/** 그 줄을 뺀 새 목록. 남은 줄의 키가 그대로라 표의 행이 자리를 옮기지 않는다. */
export const removeLineDraft = (lines: readonly LineDraft[], key: string): LineDraft[] =>
  lines.filter((line) => line.key !== key);

/**
 * 한 줄의 값을 바꾼다. **앞 초안을 고치지 않는다** — 같은 참조를 고치면 화면이 다시 그려지지 않는다.
 *
 * 없는 키는 그냥 지나간다. 지운 줄의 입력이 뒤늦게 도착하는 경로가 있고, 그때 없는 줄을
 * 되살리면 방금 지운 줄이 화면에 다시 나타난다.
 */
export const patchLineDraft = (
  lines: readonly LineDraft[],
  key: string,
  patch: Partial<Omit<LineDraft, 'key'>>,
): LineDraft[] => lines.map((line) => (line.key === key ? { ...line, ...patch } : line));
