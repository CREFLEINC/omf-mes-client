import type { AdjustLineDraft, CountVarianceLineView } from './types';

/**
 * 조정 라인 초안 — **아직 보내지 않은 입력**이다.
 *
 * **친 글자를 그대로 들고 있는다.** 숫자로 강제해 들고 있으면 지우는 도중(`-1` → `-` → `-2`)에
 * 값이 튀고, 「-」처럼 아직 완성되지 않은 입력이 사라진다. 음수가 정상 경로인 이 화면에서
 * 그 자리는 특히 자주 지난다.
 *
 * **줄마다 안정 키를 만든다**(사본 체크리스트 2번). 표의 `getRowId`가 이 키를 쓰므로,
 * 가운데 줄을 지워도 남은 줄의 DOM 노드가 살아남아 치던 값과 포커스가 그 자리에 남는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/**
 * 초안 키의 일련번호. **서버로 나가지 않는 값**이라 한 세션 안에서 유일하기만 하면 된다.
 *
 * 승계 줄에도 실사 라인 번호가 아니라 이 일련번호를 쓴다 — 같은 실사를 두 번 불러오는 경로
 * (원천을 바꿨다 되돌리는 것 · 다시 불러오기)가 있어, 실사 라인 번호를 키로 삼으면 옛 줄과
 * 새 줄이 같은 키를 갖는 순간이 생긴다.
 */
let draftSequence = 0;

/**
 * 키에 **초안 세션**을 함께 담는다(D-15).
 *
 * 등록에는 아직 자원 번호가 없어 나가는 중인 쓰기를 가르는 축이 초안 세션 하나다. 키가 그
 * 세션을 들고 있으면 어느 초안의 줄인지 키만 보고도 갈리고, 세션이 바뀐 뒤 남은 줄이
 * 새 초안의 줄로 오인되는 길이 닫힌다.
 */
const nextKey = (session: number, prefix: string): string => {
  draftSequence += 1;

  return `s${String(session)}:${prefix}:${String(draftSequence)}`;
};

/**
 * 실사 차이 줄을 조정 라인으로 승계한다(C2·C3).
 *
 * 위치·품목·LOT·단위를 그대로 이어받고 **차이 기본값이 실사가 계산한 차이**다 —
 * 화면이 실물에서 장부를 다시 빼지 않는다(그 계산은 서버 것이다).
 *
 * **장부를 줄이 함께 들고 온다.** 이 갈래에는 잔액 조회가 없으므로(D-6) 실사가 준 값이 곧
 * 장부이고, 그것이 없으면 실물을 파생할 근거도 사라진다.
 */
const inheritedFields = (line: CountVarianceLineView): Omit<AdjustLineDraft, 'key'> => ({
  countLineId: line.inventoryCountLineId,
  countSystemQty: line.systemQty,
  countReasonCode: line.varianceReasonCode,
  locationId: String(line.locationId),
  itemId: String(line.itemId),
  /* LOT이 없는 것이 정상이다 — 「고르지 않음」이 빈 글자 하나여야 값이 없는 상태가 한 가지다. */
  lotId: line.lotId === null ? '' : String(line.lotId),
  uomId: String(line.uomId),
  adjustmentQtyText: String(line.varianceQty),
});

export const createInheritedLineDrafts = (
  lines: readonly CountVarianceLineView[],
  session: number,
): AdjustLineDraft[] =>
  lines.map((line) => ({ key: nextKey(session, 'count'), ...inheritedFields(line) }));

/**
 * 사용자가 더한 빈 줄. **값을 지어내지 않는다.**
 *
 * 앞 줄의 위치·품목을 물려주면 사용자가 고르지 않은 대상이 되돌릴 수 없는 전표에 실린다.
 * 차이도 비운 채로 둔다 — `0`을 채우면 그 줄이 곧바로 「제외」가 되어, 더한 줄이 왜 사라지는지
 * 알 수 없게 된다.
 */
export const addLineDraft = (
  lines: readonly AdjustLineDraft[],
  session: number,
): AdjustLineDraft[] => [
  ...lines,
  {
    key: nextKey(session, 'new'),
    countLineId: null,
    countSystemQty: null,
    countReasonCode: null,
    locationId: '',
    itemId: '',
    lotId: '',
    uomId: '',
    adjustmentQtyText: '',
  },
];

/** 그 줄을 뺀 새 목록. 남은 줄의 키가 그대로라 표의 행이 자리를 옮기지 않는다. */
export const removeLineDraft = (
  lines: readonly AdjustLineDraft[],
  key: string,
): AdjustLineDraft[] => lines.filter((line) => line.key !== key);

/**
 * 한 줄의 값을 바꾼다. **앞 초안을 고치지 않는다** — 같은 참조를 고치면 화면이 다시 그려지지 않는다.
 *
 * 없는 키는 그냥 지나간다. 지운 줄의 입력이 뒤늦게 도착하는 경로가 있고, 그때 없는 줄을
 * 되살리면 방금 지운 줄이 화면에 다시 나타난다.
 */
export const patchLineDraft = (
  lines: readonly AdjustLineDraft[],
  key: string,
  patch: Partial<Omit<AdjustLineDraft, 'key'>>,
): AdjustLineDraft[] => lines.map((line) => (line.key === key ? { ...line, ...patch } : line));
