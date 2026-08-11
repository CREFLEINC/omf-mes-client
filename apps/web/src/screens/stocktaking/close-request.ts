import type { components } from '@omf-mes/api-client';

import { toBusinessDate } from './line-replace-request';

/**
 * 마감 요청 조립 — **이 화면에서 되돌릴 수 없는 둘째 쓰기의 본문이다.**
 *
 * 보내는 것은 영업일 **하나**뿐이다(계약의 `InventoryCountClose`에 다른 필드가 없다 — 실측).
 * 개시·치환과 달리 **사용자가 정하는 값이 하나도 없어** 확인 창이 보일 것은 「보낼 값」이
 * 아니라 **마감할 대상과 그 진행 요약**이 된다(`close-confirm-dialog.tsx`).
 *
 * **영업일 파생을 치환과 나눠 갖지 않는다**(`toBusinessDate`). 같은 규칙을 두 자리에서 만들면
 * 한쪽만 고쳐져, **같은 순간에 나가는 두 쓰기가 다른 영업일을 싣는** 어긋남이 생긴다 —
 * 마감은 그 위치 저장들과 같은 날의 일로 묶여야 한다(계획 §5.2 「읽는 자리 파생」).
 * 산출 규칙(야간조 경계 등)이 정해지면 고칠 자리도 하나로 남는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type InventoryCountClose = components['schemas']['InventoryCountClose'];

/**
 * 마감 본문.
 *
 * **제출 순간을 인자로 받는다** — 함수 안에서 `new Date()`를 부르면 순수하지 않아 자정 경계를
 * 고정 시각으로 검사할 수 없다(W-01-03·W-01-10이 세운 형태).
 *
 * **`null`을 돌려주는 갈래가 없다.** 치환은 「보낼 줄이 준비되지 않았다」를 본문 조립이
 * 마지막 겹으로 막지만(`toLineReplace`), 마감에는 사용자가 넣는 값이 없어 **본문이 잘못될
 * 길 자체가 없다** — 마감을 막는 판정은 전부 `close-guard.ts`에 있다.
 */
export const toCountClose = (now: Date): InventoryCountClose => ({
  businessDate: toBusinessDate(now),
});
