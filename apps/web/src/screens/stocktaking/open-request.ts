import type { components } from '@omf-mes/api-client';

/**
 * 개시 요청 조립 — **되돌릴 수 없는 쓰기의 본문을 만드는 유일한 자리다.**
 *
 * 개시한 실사를 지우거나 취소하거나 다시 여는 오퍼레이션이 계약에 없다(실측 — 이 자원의
 * 경로는 넷뿐이다). 잘못 실린 값을 화면이 되돌릴 수 없으므로, 이 파일은 「무엇을 싣는가」만큼
 * **「무엇에서 끌어오는가」**를 분명히 한다.
 *
 * | 자리 | 값 | 근거 |
 * | --- | --- | --- |
 * | `countTypeCode` | 사용자가 고른 코드를 **다듬어** 싣는다 | 계약 필수. 값 목록이 확정되지 않아 지금은 고를 것이 없다(`code-options.ts` · 계획 결정 10) |
 * | `warehouseId` | 사용자가 고른 창고 | 계약 필수. 선택칸이 주는 문자열을 **여기 한 곳에서만** 정수로 옮긴다 |
 * | `plannedDate` | 사용자가 넣은 계획일 그대로 | 계약 필수(`format: date`). **실행 시각에서 파생하지 않는다** — 파생하면 자정을 넘기는 순간 같은 입력이 다른 날짜로 나간다 |
 * | `blindCount` | 확인칸 값을 **늘 명시한다** | 계약 `required`에는 없고 `default: false`인데 생성 타입은 필수로 나온다(실측). 기본값에 기대면 서버 기본이 바뀔 때 화면은 그대로인데 만들어지는 실사가 달라지고, 블라인드는 개시 뒤에 고칠 오퍼레이션이 없어 되돌릴 수 없다 |
 *
 * **`Idempotency-Key`는 공통 쓰기 훅이 만든다.** 이 오퍼레이션에는 `If-Match`가 없으므로
 * 잠금 토큰 경로는 `null`이다(`queries.ts`).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type InventoryCountCreate = components['schemas']['InventoryCountCreate'];

/**
 * 개시 초안 — **화면에서 친 값이고 아직 보내지 않은 것**이다.
 *
 * 계약 타입이 아니라 **입력칸의 모양**을 담는다. 창고가 문자열인 것은 선택칸의 값이
 * 문자열이기 때문이고, 계약이 요구하는 정수로 옮기는 일은 `toCountCreate` 한 곳이 한다 —
 * 초안 단계에서 옮기면 「아직 안 골랐다」를 나타낼 값이 없어진다.
 *
 * **주소에 싣지 않는다**(계획 결정 3) — 글자마다 뒤로가기 기록이 쌓이고, 화면이 조회 조건과
 * 입력을 같은 통로로 다루게 된다.
 */
export interface OpenDraft {
  countType: string;
  warehouse: string;
  /** `type="date"`가 주는 `YYYY-MM-DD`. 달력에 있는 날인지는 `validation.ts`가 잰다. */
  plannedDate: string;
  blindCount: boolean;
}

export const EMPTY_OPEN_DRAFT: OpenDraft = {
  countType: '',
  warehouse: '',
  plannedDate: '',
  /**
   * **거짓으로 시작한다.** 블라인드는 장부 수량을 감추는 방식이라 고르지 않은 상태의 기본이
   * 「감추지 않는다」여야 한다 — 반대로 두면 아무것도 고르지 않은 사용자가 되돌릴 수 없는
   * 블라인드 실사를 만든다.
   */
  blindCount: false,
};

/**
 * 버릴 것이 있는가. **모든 칸을 함께 본다** — 한쪽만 보면 나머지가 확인 없이 사라진다.
 *
 * 공백만 친 코드는 버릴 것이 아니다. 그 하나 때문에 파기 확인 창이 뜨면 사용자는 잃을 것이
 * 없는데도 확인을 받게 되고, 그런 확인이 되풀이되면 읽지 않고 누르게 된다.
 */
export const hasAnyOpenDraftValue = (draft: OpenDraft): boolean =>
  draft.countType.trim() !== '' ||
  draft.warehouse !== '' ||
  draft.plannedDate !== '' ||
  draft.blindCount;

/**
 * 코드는 **다듬어 싣는다.** 선택지에서 고른 값이라 공백이 붙을 일이 드물지만, 화면이 재는
 * 길이(`validation.ts`)와 보내는 값이 갈리면 「50자로 보내는데 화면은 51자라고 막는」
 * 어긋남이 생긴다.
 */
export const toCountCreate = (draft: OpenDraft): InventoryCountCreate => ({
  countTypeCode: draft.countType.trim(),
  warehouseId: Number(draft.warehouse),
  plannedDate: draft.plannedDate,
  blindCount: draft.blindCount,
});
