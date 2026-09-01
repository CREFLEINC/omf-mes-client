import type { components } from '@omf-mes/api-client';

import { toInputQty, type QtyDrafts, readQty } from './input-qty';
import type { ScannedMaterial } from './scan';

/**
 * 투입 확정 본문을 만드는 **유일한 자리**.
 *
 * 계약이 필수로 두는 것은 여섯이고 **전부 화면이 가진 값**이다.
 *
 * | 자리 | 어디서 | 근거 |
 * | --- | --- | --- |
 * | `workOrderId` | 주소 | 이 화면이 무엇을 투입하는지 |
 * | `workSessionId` | 열린 세션 | ⚠ **nullable** — 없어도 투입은 선다(§5-5) |
 * | `itemId` · `lotId` · `uomId` | **스캔한 LOT** | 스캔이 자재를 특정한다 |
 * | `inputQty` | 작업자가 친 값 | 스펙 §4-B의 유일한 「입력」 칸 |
 * | `occurredAt` | 보내는 순간 | ⚠ **기록 시각과 다르다** — 오프라인 복구 시 발생과 기록이 갈린다(§5-7) |
 *
 * ⛔ **보내지 않는 세 칸이 있다**(스펙 §5-8).
 *
 * - **투입 유형** — 값 목록이 축을 정합화하지 못했다. 상수를 박으면 승인된 적 없는 값이
 *   원장에 남고, 투입은 정정이 아니라 새 기록으로만 고칠 수 있어 되돌릴 수 없다(B-3)
 * - **작업자 · 단말** — 서버가 인증에서 이미 안다. 같은 것을 두 경로가 말하면 어긋날 자리만
 *   생긴다. 작업자는 귀속 헤더에서, 단말은 요청을 인증한 토큰에서 서버가 푼다
 *
 * ⛔ **계보 정확도(`traceAccuracyCode`)·배분 방법도 보내지 않는다**(§5-4 정합주) — 계약에
 * 그 필드가 없고, 판정 주체는 서버다.
 *
 * 이 파일은 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type MaterialConsumptionCreate = components['schemas']['MaterialConsumptionCreate'];

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

/** 실행 환경이 UTC와 얼마나 떨어져 있는지. `+09:00` 꼴이다. */
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

/**
 * 담긴 자재 하나의 투입 본문. **갖춰지지 않았으면 만들지 않는다**(`null`).
 *
 * 자재마다 한 건씩 보낸다 — 계약의 쓰기가 자재 하나를 받는다.
 */
export const toMaterialConsumption = (
  workOrderId: number,
  material: ScannedMaterial,
  drafts: QtyDrafts,
  occurredAt: Date,
  workSessionId: number | null,
): MaterialConsumptionCreate | null => {
  const inputQty = toInputQty(readQty(drafts, material.lotId));
  if (inputQty === null) return null;

  return {
    workOrderId,
    /*
     * 세션은 **있으면 붙이고 없으면 뺀다**(§5-5). 계약이 nullable로 두었으므로 「모른다」를
     * 값으로 채우지 않는다 — 빈 자리와 지어낸 값은 나중에 계보를 볼 때 다른 뜻이 된다.
     */
    ...(workSessionId === null ? {} : { workSessionId }),
    itemId: material.itemId,
    lotId: material.lotId,
    inputQty,
    uomId: material.uomId,
    occurredAt: toOffsetDateTime(occurredAt),
  };
};

/**
 * 담긴 자재 전부의 본문. **하나라도 만들 수 없으면 통째로 만들지 않는다.**
 *
 * 일부만 실어 보내면 나머지 자재가 투입되지 않은 채 「확정」이 끝난 것으로 보인다 — 계보에
 * 구멍이 남고, 그 구멍은 투입 기록을 보고는 알 수 없다.
 */
export const toMaterialConsumptions = (
  workOrderId: number,
  materials: readonly ScannedMaterial[],
  drafts: QtyDrafts,
  occurredAt: Date,
  workSessionId: number | null,
): MaterialConsumptionCreate[] | null => {
  if (materials.length === 0) return null;

  const bodies = materials.map((material) =>
    toMaterialConsumption(workOrderId, material, drafts, occurredAt, workSessionId),
  );

  return bodies.every((body): body is MaterialConsumptionCreate => body !== null) ? bodies : null;
};
