import type { components } from '@omf-mes/api-client';

import type { IrLineView, IrView, ReceiptDraft } from './types';

/**
 * 요청 조립 — **되돌릴 수 없는 쓰기의 본문을 만드는 유일한 자리다.**
 *
 * 이 오퍼레이션 한 번에 다섯 가지가 함께 움직이고(입고 전표 생성·전기 · 자재 LOT 상태 전이 ·
 * 수불 원장 · 잔액 · ERP 송신 적재) 계약의 입고 취소는 승인을 탄다(실측) — 잘못 실린 값을
 * 화면이 되돌릴 수 없다. 그래서 이 파일은 「무엇을 싣는가」만큼 **「무엇을 싣지 않는가」**를
 * 분명히 한다.
 *
 * | 자리 | 값 | 근거 |
 * | --- | --- | --- |
 * | `plantId` | **고른 입하 전표의 값** | 원천 문서가 이 입고의 근거다. 창고에도 `plantId`가 있어 두 값이 다를 수 있는데, 창고에서 끌어오면 사용자가 모르는 채 공장이 바뀐다(계획 결정 8) |
 * | 라인의 `inventoryStatusCode` | **계약이 정한 값 넷 중 하나** | 계약이 자유 문자열에서 유니온으로 좁혔다. 값이 아니면 본문을 만들지 않는다(아래 `isInventoryStatusCode`) |
 * | `sourceDocumentId` | 고른 입하 전표 번호 | 원천이 그것이다 |
 * | `businessDate` | **입고 일시의 날짜** | 계약이 필수로 요구하는데 산출 규칙(야간조 경계 등)이 정의돼 있지 않다. 실행 시각의 날짜를 쓰지 않는 이유는 어제 받은 자재를 오늘 등록하는 것이 흔하기 때문이다 |
 * | **`occurredAt`** | **싣지 않는다** | **이 요청 스키마에 그 필드가 없다**(실측 — `InboundReceiptCreate`에는 있다). 계약에 없는 키를 보내지 않는다 |
 * | 라인의 수량·품목·단위·LOT | **입하 라인의 값 그대로** | 전량 입고라 수량 입력칸이 없다(계획 결정 4) |
 * | 라인의 `inboundReceiptLineId` | **싣는다** | 계약상 선택이지만 만들어진 입고 라인을 원천 입하 라인에 잇는 유일한 값이다 |
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type GoodsReceiptCreate = components['schemas']['GoodsReceiptCreate'];
type GoodsReceiptLineCreate = components['schemas']['GoodsReceiptLineCreate'];

/** 계약이 정한 재고 상태 코드. **생성물 타입에서 파생한다** — 손으로 적은 이름을 쓰지 않는다. */
export type InventoryStatusCode = NonNullable<GoodsReceiptLineCreate['inventoryStatusCode']>;

/**
 * 계약이 정한 값 넷 — **키가 곧 값이다.**
 *
 * 배열로 적으면 계약이 값을 늘리거나 이름을 바꿔도 아무것도 울지 않는다. `Record`로 못박아
 * **빠짐과 오타를 타입 검사가 잡게** 한다 — 하나를 지우면 「속성이 없다」로, 잘못 적으면
 * 「그런 속성이 없다」로 컴파일이 멈춘다.
 *
 * ⛔ 이 목록은 **계약이 아는 값**이지 화면이 고를 수 있는 값이 아니다. 선택지 자리표시
 * (`code-options.ts`의 `inventoryStatus: []`)를 이 값으로 채우지 않는다 — 채우면 값 목록이
 * 확정되지 않은 W-01-10의 등록이 열린다. 그 사실은 `code-options.test.ts`가 잰다.
 */
export const INVENTORY_STATUS_CODES = {
  AVAILABLE: true,
  IN_TRANSIT: true,
  ON_HOLD: true,
  BLOCKED: true,
} as const satisfies Record<InventoryStatusCode, true>;

/** 계약이 아는 재고 상태 코드인가. 다듬은 뒤의 값을 그대로 받는다 — 「비슷하면 통과」가 없다. */
const isInventoryStatusCode = (value: string): value is InventoryStatusCode =>
  Object.hasOwn(INVENTORY_STATUS_CODES, value);

/**
 * 요청에 실릴 라인 한 줄. **`lotId`가 `number`다** — 없을 수 있는 값을 여기까지 들이지 않는다.
 *
 * 코드와 위치는 담지 않는다. 라인마다 다를 수 있는 값이지만 이번 화면은 한 줄만 확정하므로
 * 머리에서 한 벌을 받아 모든 줄에 같게 싣는다 — 라인별 지정을 나중에 붙일 때 여기가 늘어난다.
 */
export interface ReceiptLineInput {
  inboundReceiptLineId: number;
  itemId: number;
  lotId: number;
  receiptQty: number;
  uomId: number;
}

export interface GoodsReceiptInput {
  /** 고른 입하 전표. 공장과 원천 번호가 여기서 온다 */
  inboundReceipt: IrView;
  /** 확정할 라인. **배열이다**(계획 결정 3) — 이번엔 길이 1이다 */
  lines: readonly ReceiptLineInput[];
  draft: ReceiptDraft;
  /**
   * 제출 순간의 시각. **인자로 받는다** — 함수 안에서 `new Date()`를 부르면 순수하지 않아
   * offset이 붙는지를 고정 시각으로 검사할 수 없다.
   */
  now: Date;
}

/**
 * 고른 입하 라인을 요청 라인으로 옮긴다.
 *
 * **자재 LOT이 없는 줄은 옮기지 않는다.** 고를 수 없게 막는 판정은 `line-select.ts`가 이미
 * 했지만 타입은 그 사실을 모른다 — 여기서 값으로 한 번 더 좁힌다. 좁히지 않으면 non-null
 * 단언을 쓰게 되고, 그때는 판정이 바뀌어도 타입 검사가 알려 주지 않는다.
 */
export const toReceiptLines = (lines: readonly IrLineView[]): ReceiptLineInput[] =>
  lines.flatMap((line) =>
    line.lotId === null
      ? []
      : [
          {
            inboundReceiptLineId: line.inboundReceiptLineId,
            itemId: line.itemId,
            lotId: line.lotId,
            receiptQty: line.receivedQty,
            uomId: line.uomId,
          },
        ],
  );

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

/**
 * 실행 환경이 UTC와 얼마나 떨어져 있는지. `+09:00` 꼴이다.
 *
 * **제출 순간의 값을 쓴다.** 입고 일시를 파싱해 그 시점의 값을 쓰면 서머타임 경계에서
 * 더 정확해지지만 파싱이 실패할 수 있는 가지가 생긴다 — 이 제품이 도는 지역에는 서머타임이
 * 없어 두 값이 갈리지 않으므로 가지를 만들지 않는 쪽을 택했다.
 */
const offsetText = (at: Date): string => {
  const minutes = -at.getTimezoneOffset();
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);

  return `${sign}${pad(Math.floor(absolute / 60), 2)}:${pad(absolute % 60, 2)}`;
};

/**
 * `datetime-local` 값에 초와 offset을 붙인다.
 *
 * 입력칸은 분까지만 주는데(`YYYY-MM-DDTHH:mm`) 계약은 초까지 있는 형식을 요구한다.
 * offset이 없는 문자열을 그대로 보내면 같은 글자가 지역마다 다른 순간을 가리킨다.
 */
export const toOffsetDateTime = (local: string, at: Date): string => {
  const withSeconds = local.length === 16 ? `${local}:00` : local;

  return `${withSeconds}${offsetText(at)}`;
};

/** 영업일 — **입고 일시의 날짜로 파생한다.** 파생이라는 사실은 화면 안내가 함께 밝힌다. */
export const toBusinessDate = (receiptDatetimeLocal: string): string =>
  receiptDatetimeLocal.slice(0, 10);

/** 비운 칸은 키 자체를 싣지 않는다 — 빈 문자열은 「빈 값을 넣었다」로 전표에 남는다. */
const optionalText = <TKey extends string>(
  key: TKey,
  raw: string,
): Partial<Record<TKey, string>> => {
  const text = raw.trim();

  return text === '' ? {} : ({ [key]: text } as Record<TKey, string>);
};

/**
 * 코드는 **다듬어 싣는다.** 선택지에서 고른 값이라 공백이 붙을 일이 드물지만, 화면이 재는 길이와
 * 보내는 값이 갈리면 「50자로 보내는데 화면은 51자라고 막는」 어긋남이 생긴다(`validation.ts`가
 * 같은 규칙으로 잰다).
 */
const trimmed = (value: string): string => value.trim();

const toLine = (
  line: ReceiptLineInput,
  draft: ReceiptDraft,
  inventoryStatusCode: InventoryStatusCode,
): GoodsReceiptLineCreate => ({
  inboundReceiptLineId: line.inboundReceiptLineId,
  itemId: line.itemId,
  lotId: line.lotId,
  receiptQty: line.receiptQty,
  uomId: line.uomId,
  qualityStatusCode: trimmed(draft.codes.qualityStatus),
  /* 값 넷 중 하나임이 **호출부에서 이미 확인됐다** — 여기서 다시 좁히면 판정이 두 자리가 된다. */
  inventoryStatusCode,
  destinationLocationId: Number(draft.location),
});

/**
 * 본문을 만든다. **계약이 모르는 재고 상태 코드면 만들지 않는다**(`null`).
 *
 * 계약이 값을 넷으로 좁혔고(`INVENTORY_STATUS_CODES`) 이 오퍼레이션은 되돌릴 수 없다.
 * 자리표시가 비어 있는 동안은 화면이 이 갈래에 닿지 못하지만, 값 목록이 차면 바로 닿는다 —
 * **막는 곳이 화면뿐인 자리에서 마지막으로 서는 것이 이 함수다**(형제 슬라이스
 * `disposal-issue/issue-request.ts`가 같은 이유로 같은 겹을 둔다).
 */
export const toGoodsReceiptRequest = (input: GoodsReceiptInput): GoodsReceiptCreate | null => {
  const { draft } = input;
  const inventoryStatusCode = trimmed(draft.codes.inventoryStatus);

  if (!isInventoryStatusCode(inventoryStatusCode)) return null;

  return {
    receiptTypeCode: trimmed(draft.codes.receiptType),
    plantId: input.inboundReceipt.plantId,
    warehouseId: Number(draft.warehouse),
    receiptDatetime: toOffsetDateTime(draft.receiptDatetime, input.now),
    sourceDocumentTypeCode: trimmed(draft.codes.sourceDocumentType),
    sourceDocumentId: input.inboundReceipt.inboundReceiptId,
    ...optionalText('reasonCode', draft.codes.reason),
    ...optionalText('remarks', draft.remarks),
    businessDate: toBusinessDate(draft.receiptDatetime),
    lines: input.lines.map((line) => toLine(line, draft, inventoryStatusCode)),
  };
};
