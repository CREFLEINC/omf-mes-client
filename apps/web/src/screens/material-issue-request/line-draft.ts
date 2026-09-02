import type { MaterialIssueLineDraft, ShortageLineView } from './types';

/**
 * 요청 품목 초안의 파생 — 만들기·더하기·지우기·고치기.
 *
 * **줄마다 안정 키를 만든다.** 표의 `getRowId`가 이 키를 쓰므로, 가운데 줄을 지워도 남은 줄의
 * DOM 노드가 살아남아 치던 값과 포커스가 그 자리에 남는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

let draftSequence = 0;

const nextKey = (prefix: 'shortage' | 'manual'): string => {
  draftSequence += 1;

  return `${prefix}:${String(draftSequence)}`;
};

/**
 * 소요 목록을 초안으로 세운다.
 *
 * **부족 0 인 줄도 남긴다.** 그 줄은 「지금은 안 받는다」는 사실이지 「없는 품목」이 아니다 —
 * 요청 수량 0 으로 두고 본문 조립에서 자동으로 제외한다(스펙 §6).
 *
 * **요청 수량 기본값은 부족량이다.** 소요·기출고·부족 셋은 읽기 전용으로 승계한다.
 */
export const lineDraftsFromShortage = (
  lines: readonly ShortageLineView[],
): MaterialIssueLineDraft[] =>
  lines.map((line) => ({
    key: nextKey('shortage'),
    origin: 'shortage' as const,
    bomComponentId: line.bomComponentId,
    itemId: String(line.itemId),
    uomId: String(line.uomId),
    requiredQty: line.requiredQty,
    issuedQty: line.issuedQty,
    shortageQty: line.shortageQty,
    requestedQty: String(line.shortageQty),
  }));

/** 손으로 더하는 빈 줄. **값을 지어내지 않는다** — 고르지 않은 품목이 전표에 실리면 안 된다. */
export const emptyLineDraft = (): MaterialIssueLineDraft => ({
  key: nextKey('manual'),
  origin: 'manual',
  bomComponentId: null,
  itemId: '',
  uomId: '',
  requiredQty: null,
  issuedQty: null,
  shortageQty: null,
  requestedQty: '',
});

export const addLineDraft = (
  lines: readonly MaterialIssueLineDraft[],
): MaterialIssueLineDraft[] => [...lines, emptyLineDraft()];

/** 그 줄을 뺀 새 목록. 남은 줄의 키가 그대로라 표의 행이 자리를 옮기지 않는다. */
export const removeLineDraft = (
  lines: readonly MaterialIssueLineDraft[],
  key: string,
): MaterialIssueLineDraft[] => lines.filter((line) => line.key !== key);

/**
 * 한 줄의 값을 바꾼다. **앞 초안을 고치지 않는다** — 같은 참조를 고치면 화면이 다시 그려지지
 * 않는다. 없는 키는 그냥 지나간다.
 *
 * ⭐ **품목이 바뀌면 BOM 유래 판정을 비운다.** `resolveLineOrigins` 는 채우기만 하고 지우지
 * 않으므로, 여기서 비우지 않으면 BOM 안 품목을 BOM 밖 품목으로 바꿔도 앞 품목의
 * `bomComponentId` 가 그대로 실려 나간다 — 화면은 경고도 띄우지 않는다.
 */
export const patchLineDraft = (
  lines: readonly MaterialIssueLineDraft[],
  key: string,
  patch: Partial<Omit<MaterialIssueLineDraft, 'key'>>,
): MaterialIssueLineDraft[] =>
  lines.map((line) => {
    if (line.key !== key) return line;

    const changesItem = patch.itemId !== undefined && patch.itemId !== line.itemId;

    return changesItem ? { ...line, ...patch, bomComponentId: null } : { ...line, ...patch };
  });

/**
 * 「불러오기」를 다시 눌렀을 때 **BOM 유래 줄만 갈아 끼운다.**
 *
 * 손으로 더한 줄(`origin: 'manual'`)은 키까지 그대로 남긴다 — 지우면 사용자가 담은 품목이
 * 조용히 사라지고, 키가 바뀌면 치고 있던 칸의 포커스가 날아간다.
 *
 * 새 소요 줄을 **앞에** 둔다. 표의 위쪽이 시스템이 낸 값, 아래쪽이 사람이 더한 값이라는
 * 배치를 재실행 뒤에도 유지한다.
 */
export const replaceShortageDrafts = (
  lines: readonly MaterialIssueLineDraft[],
  shortage: readonly ShortageLineView[],
): MaterialIssueLineDraft[] => [
  ...lineDraftsFromShortage(shortage),
  ...lines.filter((line) => line.origin === 'manual'),
];
