import type { components } from '@omf-mes/api-client';

import type { AdjustHeaderDraft, AdjustLineDraft } from './types';
import { isExcludedLine, readQty } from './validation';

/**
 * 등록 요청의 본문을 만드는 **유일한 자리** — 이 화면에서 되돌릴 수 없는 쓰기의 내용이 여기서
 * 정해진다.
 *
 * | 자리 | 값 | 근거 |
 * | --- | --- | --- |
 * | `reasonCode` | **사용자가 고른 헤더 사유** | 계약 필수. 값 목록은 아직 비어 있다(D-9) |
 * | `sendToErp` | **토글 상태 그대로** | 계약 필수(기본 참) — 「화면의 송신 토글이 이 값이다」(D-11) |
 * | `inventoryCountId` | **불러온 실사** · 없으면 **키를 싣지 않는다** | 선택 필드. 직접 등록에 비어 있는 것이 정상이다(조심 ⑤) |
 * | `lines` | **차이가 0이 아닌 줄 전부를 한 본문에** | 계약이 최소 1행을 요구하고 한 트랜잭션이 약속이다(D-10) |
 * | 라인 `adjustmentQty` | **친 수 그대로 — 음수도** | 계약에 `minimum`이 없고 예시값이 음수다(조심 ② · D-4) |
 * | 라인 `inventoryCountLineId` | **승계 줄에만** | 승계 근거가 전표에 남는 자리다 |
 * | 라인 **`reasonCode`** | **싣지 않는다** | 라인 사유를 만들지 않는다(D-7 · 미결 #87) — 값을 `null`로 실으면 「비웠다」는 뜻이 된다 |
 * | 라인 `lotId` | 고른 값만. **비면 키를 싣지 않는다** | LOT 관리를 하지 않는 품목이 실재한다 |
 * | `lineNo`·`inventoryAdjustmentLineId` | **싣지 않는다** | 줄번호는 배열 순서로 서버가 부여한다(공유계약 A-5) · 신규 행에는 치환 키가 없다 |
 * | `inventoryAdjustmentNo`·`statusCode`·`adjustedAt` | **싣지 않는다** | 서버가 정한다(계약 스키마 설명) |
 * | **`If-Match`** | **싣지 않는다** | 새 전표라 견줄 판이 없다 — 계약 parameters에 그 헤더가 없고 응답에 409가 없다(D-14) |
 * | **멱등 키** | **공통 쓰기 훅이 만든다** | 헤더 규약은 `patterns/master`가 한 곳에서 진다 |
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type InventoryAdjustmentCreate = components['schemas']['InventoryAdjustmentCreate'];
type InventoryAdjustmentLineUpsert = components['schemas']['InventoryAdjustmentLineUpsert'];

/**
 * 서버가 필드 오류를 붙일 수 있는 **화면이 소유한 칸**.
 *
 * **본문을 만드는 파일이 함께 든다** — 이 목록이 본문의 키와 갈리면, 서버가 준 오류가 있는데도
 * 어느 칸에도 붙지 않고 배너로 밀려난다. 라인 오류는 여기 없다: 서버가 줄을 가리키는 이름
 * (`lines[0].adjustmentQty` 등)을 화면의 칸 이름으로 되읽을 규약이 계약에 없어, 인라인으로
 * 붙일 자리를 지어내는 대신 **배너로 그대로 낸다**.
 */
export const ADJUST_FORM_FIELDS: readonly string[] = ['reasonCode', 'sendToErp'];

/** 선택칸의 값 글자를 내부 번호로 읽는다. **양의 정수만 번호다.** */
const POSITIVE_INTEGER = /^\d+$/;

/**
 * 고르지 않은 값과 못 알아들을 값을 **함께 `null`로** 본다.
 *
 * `Number('')`는 0이고 `Number('9401x')`는 `NaN`이라, 그대로 옮기면 **0번 위치**나
 * `null`(직렬화한 `NaN`)이 되돌릴 수 없는 전표에 실린다.
 */
const readId = (raw: string): number | null => {
  const text = raw.trim();

  return POSITIVE_INTEGER.test(text) && Number(text) >= 1 ? Number(text) : null;
};

export interface AdjustRequestInput {
  /**
   * 실사 차이를 **불러온** 실사. 직접 등록 갈래는 `null`이다.
   *
   * 「고른 실사」가 아니라 「불러온 실사」다 — 고르기만 하고 불러오지 않은 실사를 실으면
   * 그 실사에서 온 줄이 하나도 없는 전표에 원천이 적힌다.
   */
  inventoryCountId: number | null;
  header: AdjustHeaderDraft;
  lines: readonly AdjustLineDraft[];
}

/**
 * 한 줄을 계약의 치환 항목으로 옮긴다. 읽을 수 없는 값이 하나라도 있으면 `null`이다.
 *
 * ⭐ **수량에 손을 대지 않는다**(조심 ② · D-4). 절댓값·하한·반올림 어느 것도 걸지 않는다 —
 * 줄이는 조정이 이 화면의 정상 경로이고, 계약이 음수를 예시값으로 들었다.
 */
const toLine = (line: AdjustLineDraft): InventoryAdjustmentLineUpsert | null => {
  const locationId = readId(line.locationId);
  const itemId = readId(line.itemId);
  const uomId = readId(line.uomId);
  const qty = readQty(line.adjustmentQtyText);

  if (locationId === null || itemId === null || uomId === null) return null;
  if (qty.kind !== 'qty') return null;

  /* 비어 있는 것이 정상이고, 값이 있는데 못 읽으면 지어내지 않는다. */
  const lotId = line.lotId.trim() === '' ? null : readId(line.lotId);

  if (line.lotId.trim() !== '' && lotId === null) return null;

  return {
    locationId,
    itemId,
    uomId,
    adjustmentQty: qty.value,
    ...(lotId === null ? {} : { lotId }),
    ...(line.countLineId === null ? {} : { inventoryCountLineId: line.countLineId }),
  };
};

/**
 * 본문을 만든다. **채워지지 않은 자리가 하나라도 있으면 만들지 않는다**(`null`).
 *
 * **여기가 마지막 겹이다.** 등록 버튼의 잠금이 이미 닫아 둔 길이지만, 그것이 뚫려도 반쪽짜리
 * 조정이 만들어지지 않아야 한다 — 계약 설명이 「최소 1행」인데 스키마에 `minItems`가 없어
 * 서버가 막는다는 보장이 없다.
 *
 * **한 줄만 잘못돼도 통째로 만들지 않는다.** 잘못된 줄을 빼고 보내면 사용자가 확인한 것보다
 * 적은 줄이 한 트랜잭션으로 저장되고, 그 전표를 이 화면에서 고칠 길은 없다.
 *
 * ⚠ **차이 0인 줄이 빠지는 것은 이와 다르다**(스펙 §6 · C19). 그것은 잘못이 아니라 **제외**라
 * 조용히 빼되, 확인 창이 그 수를 밝힌다 — 사용자가 확인한 것과 나가는 것이 갈리지 않는다.
 */
export const toInventoryAdjustmentCreate = (
  input: AdjustRequestInput,
): InventoryAdjustmentCreate | null => {
  const reasonCode = input.header.reasonCode.trim();

  if (reasonCode === '') return null;

  const lines: InventoryAdjustmentLineUpsert[] = [];

  for (const line of input.lines) {
    if (isExcludedLine(line)) continue;

    const upsert = toLine(line);

    if (upsert === null) return null;

    lines.push(upsert);
  }

  if (lines.length === 0) return null;

  return {
    reasonCode,
    sendToErp: input.header.sendToErp,
    ...(input.inventoryCountId === null ? {} : { inventoryCountId: input.inventoryCountId }),
    lines,
  };
};

/**
 * 확인 창이 보이는 줄 수 — **본문을 만드는 자리와 같은 파일에 둔다**(전례 규율).
 *
 * 창이 따로 세면 「사용자가 확인한 줄 수」와 「요청에 실리는 줄 수」가 갈린다.
 */
export interface AdjustLineSummary {
  /** 본문에 실릴 줄 수 */
  includedCount: number;
  /** 차이가 0이라 빠지는 줄 수. **오류가 아니다** */
  excludedCount: number;
}

export const summarizeAdjustLines = (lines: readonly AdjustLineDraft[]): AdjustLineSummary => {
  const excludedCount = lines.filter(isExcludedLine).length;

  return { includedCount: lines.length - excludedCount, excludedCount };
};
