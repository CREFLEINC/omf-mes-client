import type { MaterialIssueLineDraft, ShortageLineView } from './types';

/**
 * BOM 유래 판정을 **한 자리에** 모은다.
 *
 * ⭐ **본문의 FK 와 화면의 경고가 같은 함수에서 나와야 한다.** 갈라 두면 「경고는 안 뜨는데
 * `bomComponentId` 만 비어 나가는」 상태가 생기고, 그 어긋남은 화면 어디에도 보이지 않는다 —
 * 되돌릴 수 없는 전표에 실린 뒤 투입 단계에서야 드러난다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/**
 * 이 품목이 소요 목록에 있으면 그 구성요소 번호를 승계한다.
 *
 * **손으로 더한 줄도 승계한다** — 사용자가 「+ 품목 추가」로 담은 품목이 마침 BOM 안이면
 * BOM 밖이 아니다. 소요 목록을 아직 부르지 않았으면(빈 배열) 전부 `null` 이다 — **모르는 것을
 * 「BOM 안」으로 단언하지 않는다.**
 */
export const resolveBomComponentId = (
  itemId: number,
  shortage: readonly ShortageLineView[],
): number | null => shortage.find((line) => line.itemId === itemId)?.bomComponentId ?? null;

/**
 * 초안 줄들의 BOM 유래를 소요 목록으로 채운다. **채우기만 하고 지우지 않는다.**
 *
 * ⛔ 이미 값이 있는 줄을 다시 `null` 로 되돌리지 않는다. 소요 조회가 잠시 비거나 실패해
 * 목록이 빈 배열이 되는 순간이 있는데, 그때 지우면 BOM 유래 줄이 통째로 「BOM 밖」이 되어
 * FK 없이 나간다. 품목이 바뀔 때 값을 비우는 것은 `patchLineDraft` 의 몫이다.
 */
export const resolveLineOrigins = (
  lines: readonly MaterialIssueLineDraft[],
  shortage: readonly ShortageLineView[],
): MaterialIssueLineDraft[] =>
  lines.map((line) => {
    if (line.bomComponentId !== null) return line;

    const itemId = Number(line.itemId);

    if (!Number.isInteger(itemId) || itemId <= 0) return line;

    const bomComponentId = resolveBomComponentId(itemId, shortage);

    return bomComponentId === null ? line : { ...line, bomComponentId };
  });

/** BOM 밖 줄인가. 경고 표식과 배너가 함께 쓴다 — **막지 않는다**(스펙 §5-3). */
export const isOutsideBom = (draft: MaterialIssueLineDraft): boolean =>
  draft.bomComponentId === null;

/**
 * BOM 밖 줄이 몇 건인가. **품목을 아직 고르지 않은 줄은 세지 않는다** — 고르지 않은 것을
 * 「BOM 밖」이라 말하면 사용자는 자기가 고른 품목이 거부당한 것으로 읽는다.
 */
export const countOutsideBomLines = (lines: readonly MaterialIssueLineDraft[]): number =>
  lines.filter((line) => line.itemId !== '' && isOutsideBom(line)).length;
