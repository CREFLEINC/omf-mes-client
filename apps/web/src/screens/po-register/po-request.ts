import type { components } from '@omf-mes/api-client';

import type { HeaderDraft, LineDraft } from './types';
import { readQty } from './validation';

/**
 * 등록 요청의 본문을 만드는 **유일한 자리** — 이 화면에서 되돌릴 수 없는 쓰기의 내용이 여기서 정해진다.
 *
 * | 자리 | 값 | 근거 |
 * | --- | --- | --- |
 * | `supplierId`·`businessUnitId`·`plantId`·`orderDate` | **사용자가 정한 값** | 계약 필수 넷 |
 * | `expectedReceiptDate` | **비우면 키를 싣지 않는다** | 계약 선택 — 빈 글자를 보내면 「빈 값을 넣었다」로 전표에 남는다 |
 * | **`sourceInboundReceiptLineId`** | **고른 입하 라인** | 승계 근거가 전표에 남는 자리다. 계약이 **헤더에 한 개** 두었다(계획 결정 4) |
 * | `lines` | **표의 줄 전체를 한 본문에** | 한 트랜잭션이 계약의 약속이다(착수 이슈 §6 ⑤) — 줄마다 요청을 나누지 않는다 |
 * | `lineNo`·`purchaseOrderLineId` | **싣지 않는다** | 줄번호는 배열 순서로 서버가 부여하고(공유계약 A-5) 신규 행에는 치환 키가 없다 |
 * | **`purchaseOrderNo`·`statusCode`** | **싣지 않는다** | 서버가 정한다(계약 스키마 설명 · 계획 결정 7) |
 * | **`erpPurchaseOrderNo`** | **자리가 없다** | 계약의 등록·수정 스키마 어디에도 없다(계획 결정 6) — 칸도 검사도 만들지 않는다 |
 * | **`If-Match`** | **싣지 않는다** | 새 전표라 견줄 판이 없다. 계약 parameters에 그 헤더가 없고 응답에 409가 없다(계획 §5.2.1 ③) |
 * | **멱등 키** | **공통 쓰기 훅이 만든다** | 헤더 규약은 `patterns/master`가 한 곳에서 진다 |
 * | **승계 수량 하한** | **보지 않는다** | 판정은 `validation.ts`가 소유하고 마지막 겹은 데이터 제약이다 — 조립에서 또 막으면 사유 없는 침묵 실패가 된다 |
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type PurchaseOrderCreate = components['schemas']['PurchaseOrderCreate'];
type PurchaseOrderLineUpsert = components['schemas']['PurchaseOrderLineUpsert'];

/** 선택칸의 값 글자를 내부 번호로 읽는다. **양의 정수만 번호다.** */
const POSITIVE_INTEGER = /^\d+$/;

/**
 * 고르지 않은 값과 못 알아들을 값을 **함께 `null`로** 본다.
 *
 * `Number('')`은 0이고 `Number('9301x')`는 `NaN`이라, 그대로 옮기면 **0번 거래처**나
 * `null`(직렬화한 `NaN`)이 되돌릴 수 없는 전표에 실린다.
 */
const readId = (raw: string): number | null => {
  const text = raw.trim();

  return POSITIVE_INTEGER.test(text) && Number(text) >= 1 ? Number(text) : null;
};

/** 비운 칸은 키 자체를 싣지 않는다 — 빈 글자는 「빈 값을 넣었다」로 전표에 남는다. */
const optionalText = <TKey extends string>(
  key: TKey,
  raw: string,
): Partial<Record<TKey, string>> => {
  const text = raw.trim();

  return text === '' ? {} : ({ [key]: text } as Record<TKey, string>);
};

/**
 * 허용치 한 칸. **빈 칸은 0이다** — 화면 검증이 빈 칸을 0으로 판정하므로(오류가 아니다)
 * 같은 판정을 본문에도 싣는다. 키를 빼고 서버 기본값에 기대면 화면이 확인한 값과 저장된 값이
 * 조용히 갈릴 수 있다.
 *
 * 읽을 수 없거나 음수면 **줄을 만들지 않는다**(`null`).
 */
const readTolerance = (raw: string): number | null => {
  const read = readQty(raw);

  if (read.kind === 'empty') return 0;
  if (read.kind === 'invalid') return null;

  return read.value < 0 ? null : read.value;
};

export interface PoRequestInput {
  /** 넘어온 초과분. **맥락이 없으면 `null`** — 그때는 본문을 만들지 않는다(완료 조건 C18) */
  source: { inboundReceiptLineId: number } | null;
  header: HeaderDraft;
  lines: readonly LineDraft[];
}

/** 한 줄을 계약의 치환 항목으로 옮긴다. 읽을 수 없는 값이 하나라도 있으면 `null`이다. */
const toLine = (line: LineDraft): PurchaseOrderLineUpsert | null => {
  const itemId = readId(line.itemId);
  const uomId = readId(line.uomId);
  const qty = readQty(line.orderedQty);
  const toleranceOverQty = readTolerance(line.toleranceOverQty);
  const toleranceUnderQty = readTolerance(line.toleranceUnderQty);

  if (itemId === null || uomId === null) return null;
  if (qty.kind !== 'qty' || qty.value <= 0) return null;
  if (toleranceOverQty === null || toleranceUnderQty === null) return null;

  return { itemId, orderedQty: qty.value, uomId, toleranceOverQty, toleranceUnderQty };
};

/**
 * 본문을 만든다. **채워지지 않은 자리가 하나라도 있으면 만들지 않는다**(`null`).
 *
 * **여기가 마지막 겹이다.** 등록 버튼의 잠금이 이미 닫아 둔 길이지만, 그것이 뚫려도 반쪽짜리
 * 발주가 만들어지지 않아야 한다 — 계약 설명이 「최소 1행」인데 스키마에 `minItems`가 없고
 * 승계 근거(`sourceInboundReceiptLineId`)는 **선택**이라 서버가 막지 않는다(계획 §5.2.2).
 *
 * **한 줄만 잘못돼도 통째로 만들지 않는다.** 잘못된 줄을 빼고 보내면 사용자가 확인한 것보다
 * 적은 줄이 한 트랜잭션으로 저장되고, 그 전표를 이 화면에서 고칠 길은 없다.
 */
export const toPurchaseOrderCreate = (input: PoRequestInput): PurchaseOrderCreate | null => {
  if (input.source === null) return null;
  if (input.lines.length === 0) return null;

  const supplierId = readId(input.header.supplierId);
  const businessUnitId = readId(input.header.businessUnitId);
  const plantId = readId(input.header.plantId);
  const orderDate = input.header.orderDate.trim();

  if (supplierId === null || businessUnitId === null || plantId === null) return null;
  if (orderDate === '') return null;

  const lines: PurchaseOrderLineUpsert[] = [];

  for (const line of input.lines) {
    const upsert = toLine(line);

    if (upsert === null) return null;

    lines.push(upsert);
  }

  return {
    supplierId,
    businessUnitId,
    plantId,
    orderDate,
    ...optionalText('expectedReceiptDate', input.header.expectedReceiptDate),
    sourceInboundReceiptLineId: input.source.inboundReceiptLineId,
    lines,
  };
};

/**
 * 확인 창이 보이는 합계 — **본문을 만드는 자리와 같은 파일에 둔다**(전례 규율).
 *
 * 창이 따로 셈하면 「사용자가 확인한 수량」과 「요청에 실리는 수량」이 갈린다.
 */
export interface OrderedQtySummary {
  /** 읽을 수 없는 줄이 있으면 `null` — **0으로 접지 않는다.** 합계 0과 뜻이 다르다 */
  total: number | null;
  /** 줄마다 단위가 갈리는가. 합계를 내되 **한 단위의 수량이 아니라는 사실**을 창이 밝힌다 */
  hasMixedUom: boolean;
}

export const summarizeOrderedQty = (lines: readonly LineDraft[]): OrderedQtySummary => {
  const uomIds = new Set(lines.map((line) => line.uomId.trim()));
  const hasMixedUom = uomIds.size > 1;

  if (lines.length === 0) return { total: null, hasMixedUom };

  let total = 0;

  for (const line of lines) {
    const read = readQty(line.orderedQty);

    if (read.kind !== 'qty') return { total: null, hasMixedUom };

    total += read.value;
  }

  return { total, hasMixedUom };
};
