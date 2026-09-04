import type { components } from '@omf-mes/api-client';

import { toInputQty, type QtyDraft } from './input-qty';
import type { ScannedPart } from './scan';

/**
 * 교체 등록 본문을 만드는 **유일한 자리**.
 *
 * 계약이 필수로 두는 것은 여섯이고 **전부 화면이 가진 값**이다.
 *
 * | 자리 | 어디서 | 근거 |
 * | --- | --- | --- |
 * | `workOrderId` | 주소 | 이 화면이 무엇을 교체하는지 |
 * | `workSessionId` | 열린 세션 | ⚠ **nullable** — 없어도 교체는 선다(§5-4 · §6) |
 * | `itemId` · `lotId` · `uomId` | **스캔한 신규 부품 LOT** | 스캔이 부품을 특정한다 |
 * | `inputQty` | 작업자가 친 값 | 유일한 「입력」 칸 |
 * | `occurredAt` | 보내는 순간 | ⚠ **기록 시각과 다르다** — 오프라인 복구 시 발생과 기록이 갈린다 |
 *
 * ⭐ **이 화면을 교체로 만드는 칸은 `replacedConsumptionId` 하나다**(§5-2). 그것이 없으면
 * 같은 오퍼레이션이 **평범한 투입**이 되어 이전 부품과 이어지지 않는다 — 그래서 이 값이
 * 없으면 본문을 만들지 않는다.
 *
 * ⛔ **`correctsConsumptionId`를 쓰지 않는다.** 정정은 「원래 투입이 없었던 셈」이고 교체는
 * 「이전 투입도 실재했다」다(§5-2). 둘을 섞으면 이력이 왜곡된다.
 *
 * ⛔ **보내지 않는 칸**
 *
 * - **투입 유형(`consumptionTypeCode`)** — 통지 #563. 상수를 박는 것도 하지 않는다. 값 목록이
 *   확정되면 다시 알린다고 했다
 * - **교체 사유(`changeReasonCode`)** — 값 목록이 아직 없다(검토 요청 omf-mes#397 ②). 계약이
 *   nullable 로 두었고 §6 이 「미선택은 권고」라 등록을 막지 않는다. 지어낸 값을 넣으면
 *   승인된 적 없는 코드가 지워지지 않는 기록에 남는다
 * - **작업자 · 단말** — 서버가 인증에서 이미 안다. 작업자는 귀속 헤더(`X-Worker-No`)에서,
 *   단말은 요청을 인증한 토큰에서 서버가 푼다
 * - **`bomComponentId` · `shopfloorReceiptLineId` · `actualUseProcessId`** — 계약이 「화면은
 *   이 값을 보내지 않는다」로 못박은 서버 파생 값이다
 * - **금형** — `material_consumption` 은 자재 축이다(요구서 §3-19)
 *
 * 이 파일은 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type MaterialConsumptionCreate = components['schemas']['MaterialConsumptionCreate'];

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

/** 실행 환경이 UTC 와 얼마나 떨어져 있는지. `+09:00` 꼴이다. */
const offsetText = (at: Date): string => {
  const minutes = -at.getTimezoneOffset();
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);

  return `${sign}${pad(Math.floor(absolute / 60), 2)}:${pad(absolute % 60, 2)}`;
};

/**
 * 계약이 요구하는 offset 있는 시각 문자열.
 *
 * ⛔ **offset 없이 보내지 않는다** — 같은 글자가 지역마다 다른 순간을 가리킨다. 현장 단말은
 * 공장 시간대에 있고 서버는 다를 수 있다.
 */
export const toOffsetDateTime = (at: Date): string =>
  `${at.getFullYear()}-${pad(at.getMonth() + 1, 2)}-${pad(at.getDate(), 2)}T` +
  `${pad(at.getHours(), 2)}:${pad(at.getMinutes(), 2)}:${pad(at.getSeconds(), 2)}` +
  offsetText(at);

export interface ReplacementDraft {
  workOrderId: number | null;
  part: ScannedPart | null;
  /** 교체 대상 — 《현재 투입》에서 고른 줄의 `materialConsumptionId`. */
  replacedConsumptionId: number | null;
  qty: QtyDraft;
  workSessionId: number | null;
  occurredAt: Date;
}

/**
 * 교체 투입 본문. **갖춰지지 않았으면 만들지 않는다**(`null`).
 *
 * 한 호출이 교체 한 건이다 — 계약의 쓰기가 자재 하나를 받는다.
 */
export const toReplacementConsumption = (
  draft: ReplacementDraft,
): MaterialConsumptionCreate | null => {
  const { workOrderId, part, replacedConsumptionId } = draft;
  if (workOrderId === null || part === null || replacedConsumptionId === null) return null;

  const inputQty = toInputQty(draft.qty);
  if (inputQty === null) return null;

  return {
    workOrderId,
    /*
     * 세션은 **있으면 붙이고 없으면 뺀다**(§5-4). 계약이 nullable 로 두었으므로 「모른다」를
     * 값으로 채우지 않는다 — 빈 자리와 지어낸 값은 나중에 계보를 볼 때 다른 뜻이 된다.
     */
    ...(draft.workSessionId === null ? {} : { workSessionId: draft.workSessionId }),
    itemId: part.itemId,
    lotId: part.lotId,
    /* ⭐ 이 한 칸이 「지우지 않고 잇는다」를 만든다(§5-2). */
    replacedConsumptionId,
    inputQty,
    uomId: part.uomId,
    occurredAt: toOffsetDateTime(draft.occurredAt),
  };
};
