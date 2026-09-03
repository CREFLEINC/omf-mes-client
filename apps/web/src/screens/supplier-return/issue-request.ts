import type { components } from '@omf-mes/api-client';

import type { ReturnLineRow } from './return-selection';
import type { ReceiptView, ReturnDraft } from './types';

/**
 * 요청 조립 — **되돌릴 수 없는 쓰기의 본문을 만드는 유일한 자리다.**
 *
 * 이 오퍼레이션 한 번에 **등록과 전기가 함께** 일어나고(계약 문면), 그 순간 재고가 차감된다.
 * 계약의 출고 취소는 승인을 타며 **이 화면 소관이 아니다** — 잘못 실린 값을 화면이 되돌릴 수
 * 없다. 그래서 이 파일은 「무엇을 싣는가」만큼 **「무엇을 싣지 않는가」**를 분명히 한다.
 *
 * | 자리 | 값 | 근거 |
 * | --- | --- | --- |
 * | **`postImmediately`** | **상수 `true`** | 화면이 「반품 처리」 한 버튼이라 등록과 전기가 같은 순간이다(착수 이슈 §6). 계약의 `required`에 없고 기본값이 거짓인데 **목은 생략해도 201**이라, 빠뜨리면 전기되지 않은 전표가 이 화면에서 손댈 수 없는 채 남는다 |
 * | `sendToErp` | **초안 값을 늘 명시** | 기본값이 참이지만 기대지 않는다 — 서버 기본이 바뀌면 조용히 달라진다 |
 * | `sourceDocumentId`·`sourceWarehouseId` | **고른 입고 전표** | 원천 문서가 이 반품의 근거이고, 자재가 놓인 창고가 그 전표의 창고다 |
 * | `destinationId` | **사용자가 고른 공급사** | 입고 전표에 공급사 필드가 없고(실측), 원천을 따라 올라가려면 원천 문서 유형 값 목록이 필요한데 그것이 없다(계획 결정 11) |
 * | **`destinationTypeCode`** | **계약이 정한 값 셋 중 하나** | 계약이 자유 문자열에서 유니온으로 좁혔다(#173). 값이 아니면 본문을 만들지 않는다(아래 `isDestinationTypeCode`) |
 * | `issuedAt` | **사용자가 적은 출고 일시** | 계약 설명이 「출고일」이다 |
 * | **`occurredAt`** | **제출 순간** | 계약 설명이 공유계약 C-1이다. `issuedAt`과 갈라 싣는다 — 어제 나간 것을 오늘 등록하면 두 값이 실제로 갈린다(계획 §5.4-8) |
 * | `businessDate` | **출고 일시의 날짜** | 산출 규칙(야간조 경계 등)이 정의돼 있지 않다. 실행 시각의 날짜를 쓰지 않는 이유는 어제 나간 자재를 오늘 등록하는 것이 흔하기 때문이다(계획 §5.4-9) |
 * | 줄의 다섯 값 | **표의 줄 그대로** | 계약이 요구하는 다섯을 입고 라인이 그대로 준다 — 적치 목적지가 곧 반품의 출발 위치다 |
 * | **보유 수량·상한 판정** | **싣지 않는다** | 화면 안의 판단이다. 최종 판정은 서버가 한다 |
 * | **`If-Match`** | **싣지 않는다** | 이 요청은 새 전표를 만든다 — 매길 버전이 없다(계획 결정 6 · 헤더는 `queries.ts`가 만든다) |
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type GoodsIssueCreate = components['schemas']['GoodsIssueCreate'];
type GoodsIssueLineUpsert = components['schemas']['GoodsIssueLineUpsert'];

/** 계약이 정한 도착지 유형. **생성물 타입에서 파생한다** — 손으로 적은 유니온을 두지 않는다. */
export type DestinationTypeCode = NonNullable<GoodsIssueCreate['destinationTypeCode']>;

/**
 * 계약이 아는 도착지 유형 셋 — **키가 곧 값이다.**
 *
 * 배열로 적으면 계약이 값을 늘리거나 이름을 바꿔도 아무것도 울지 않는다. `Record`로 못박아
 * **빠짐과 오타를 타입 검사가 잡게** 한다 — 하나를 지우면 「속성이 없다」로, 잘못 적으면
 * 「그런 속성이 없다」로 컴파일이 멈춘다(형제 슬라이스의 재고 상태 목록과 같은 형태).
 *
 * ⛔ 이 목록은 **계약이 아는 값**이지 화면이 고를 수 있는 값이 아니다. 선택지 자리표시
 * (`code-options.ts`의 `destinationType: []`)를 이 값으로 채우지 않는다 — 채우면 값 목록이
 * 확정되지 않은 W-01-05의 반품 처리가 열린다.
 */
export const DESTINATION_TYPE_CODES = {
  LOCATION: true,
  PARTNER: true,
  DISPOSAL_SITE: true,
} as const satisfies Record<DestinationTypeCode, true>;

/**
 * **계약이 실제로 좁혀 두었는가**를 타입으로 못박는다.
 *
 * 위 파생은 한 방향으로만 운다 — 계약이 값을 늘리거나 이름을 바꾸면 `Record`가 깨지지만,
 * 계약이 **다시 자유 문자열로 넓어지면** `Record<string, true>`가 세 키로도 충족돼 아무것도
 * 울지 않는다. 그때 아래 판정은 **계약에 없는 제약**이 되어, 서버가 아는 넷째 값이 와도
 * 화면이 말없이 아무것도 보내지 않는다.
 *
 * ⛔ **지우지 않는다.** 아무 데서도 읽지 않는 것이 이 상수의 형태다 — 하는 일이 대입 그
 * 자체이고, 대입이 성립하지 않으면 `tsc`가 멈춘다.
 */
type DestinationTypeIsNarrowed = string extends DestinationTypeCode ? never : true;

const DESTINATION_TYPE_IS_NARROWED: DestinationTypeIsNarrowed = true;

/** 계약이 아는 도착지 유형인가. 다듬은 뒤의 값을 그대로 받는다 — 「비슷하면 통과」가 없다. */
const isDestinationTypeCode = (value: string): value is DestinationTypeCode =>
  Object.hasOwn(DESTINATION_TYPE_CODES, value);

/**
 * **등록과 전기를 한 요청으로 보낸다.**
 *
 * 상수다 — 초안의 어떤 값으로도 갈리지 않는다. 조건부로 만들면 「전기되지 않은 전표」로 가는
 * 길이 생기는데, **이 화면에는 나중에 전기할 수단이 없다**(착수 이슈 §6이 2회 호출을 금지했고,
 * 계약의 전기 오퍼레이션을 이 화면은 부르지 않는다). 그 전표는 화면에서 손댈 수 없는 채 남는다.
 */
export const POST_IMMEDIATELY = true;

/**
 * 요청에 실릴 줄 하나.
 *
 * **계약 타입을 그대로 쓰지 않고 화면 타입을 둔다** — 계약의 치환 타입에는 `goodsIssueLineId`·
 * `pickingLineId`가 함께 있는데, 이 화면은 만들기만 하고 고치지 않으며 피킹과도 무관하다.
 * 자리를 두지 않으면 그 값이 요청으로 샐 경로도 없다.
 */
export interface ReturnLineInput {
  itemId: number;
  lotId: number;
  issueQty: number;
  uomId: number;
  sourceLocationId: number;
}

/**
 * 고른 줄을 요청 라인으로 옮긴다.
 *
 * **초안 키가 아니라 표의 줄에서 온다**(계획 결정 8). 받는 것이 `describeReturnSelection`이 낸
 * 「고른 줄」이라, 「다시 조회」로 사라진 줄의 초안이 남아 있어도 여기 나타나지 않는다.
 *
 * **읽을 수 없는 수량인 줄은 옮기지 않는다.** 고르지 못하게 막는 판정은 버튼이 이미 했지만
 * 타입은 그 사실을 모른다 — 여기서 값으로 한 번 더 좁힌다. 좁히지 않으면 non-null 단언을 쓰게
 * 되고, 그때는 판정이 바뀌어도 타입 검사가 알려 주지 않는다.
 */
export const toReturnLines = (rows: readonly ReturnLineRow[]): ReturnLineInput[] =>
  rows.flatMap((row) =>
    row.qty.kind === 'qty'
      ? [
          {
            itemId: row.line.itemId,
            lotId: row.line.lotId,
            issueQty: row.qty.value,
            uomId: row.line.uomId,
            /* 적치 목적지가 곧 반품의 출발 위치다(계획 결정 2). */
            sourceLocationId: row.line.destinationLocationId,
          },
        ]
      : [],
  );

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

/**
 * 실행 환경이 UTC와 얼마나 떨어져 있는지. `+09:00` 꼴이다.
 *
 * **제출 순간의 값을 쓴다.** 출고 일시를 파싱해 그 시점의 값을 쓰면 서머타임 경계에서 더
 * 정확해지지만 파싱이 실패할 수 있는 가지가 생긴다 — 이 제품이 도는 지역에는 서머타임이 없어
 * 두 값이 갈리지 않으므로 가지를 만들지 않는 쪽을 택했다.
 */
const offsetText = (at: Date): string => {
  const minutes = -at.getTimezoneOffset();
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);

  return `${sign}${pad(Math.floor(absolute / 60), 2)}:${pad(absolute % 60, 2)}`;
};

/** 실행 환경 시간대로 읽은 `YYYY-MM-DDTHH:mm:ss`. offset은 붙이지 않는다. */
const toLocalDateTime = (at: Date): string =>
  `${String(at.getFullYear())}-${pad(at.getMonth() + 1, 2)}-${pad(at.getDate(), 2)}T${pad(
    at.getHours(),
    2,
  )}:${pad(at.getMinutes(), 2)}:${pad(at.getSeconds(), 2)}`;

/**
 * 날짜 칸과 시각 칸을 한 값으로 잇는다.
 *
 * **확인 창도 이 함수를 쓴다** — 사용자가 확인하는 글자와 요청에 실리는 값이 같은 자리에서
 * 나와야 「확인한 것과 나가는 것」이 갈리지 않는다.
 */
export const toIssuedLocal = (draft: Pick<ReturnDraft, 'issuedDate' | 'issuedTime'>): string =>
  `${draft.issuedDate}T${draft.issuedTime}`;

/**
 * 이어 붙인 값에 초와 offset을 붙인다.
 *
 * 시각 칸은 분까지만 주는데(`HH:mm`) 계약은 초까지 있는 형식을 요구한다. offset이 없는
 * 문자열을 그대로 보내면 **같은 글자가 지역마다 다른 순간을 가리킨다.**
 */
export const toOffsetDateTime = (local: string, at: Date): string => {
  const withSeconds = local.length === 16 ? `${local}:00` : local;

  return `${withSeconds}${offsetText(at)}`;
};

/** 발생 시각 — **제출 순간**을 초와 offset까지 갖춰 싣는다(공유계약 C-1). */
export const toOccurredAt = (at: Date): string => `${toLocalDateTime(at)}${offsetText(at)}`;

/** 영업일 — **출고 일시의 날짜 조각이다.** 파생이라는 사실은 화면 안내와 확인 창이 밝힌다. */
export const toBusinessDate = (issuedLocal: string): string => issuedLocal.slice(0, 10);

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
 * 같은 규칙으로 잰다). 공백만인 코드를 막는 것도 같은 층의 일이다.
 */
const trimmed = (value: string): string => value.trim();

export interface ReturnRequestInput {
  /** 고른 입고 전표. 원천 번호와 창고가 여기서 온다 */
  receipt: ReceiptView;
  /** 보낼 줄. **`toReturnLines`가 표의 줄에서 만든 것**이다 */
  lines: readonly ReturnLineInput[];
  draft: ReturnDraft;
  /**
   * 제출 순간의 시각. **인자로 받는다** — 함수 안에서 `new Date()`를 부르면 순수하지 않아
   * offset이 붙는지와 발생 시각이 무엇인지를 고정 시각으로 검사할 수 없다.
   */
  now: Date;
}

/**
 * 본문을 만든다. **만들지 않는 갈래가 둘이다**(`null`).
 *
 * 1. **보낼 줄이 하나도 없다.** 계약 설명은 「최소 1행」인데 스키마에 `minItems`가 없고
 *    **목이 빈 배열을 201로 받는다**(실측) — 막는 곳이 화면뿐이라 이 자리가 **마지막 겹**이다.
 *    버튼 잠금과 보내는 자리의 재판정이 이미 닫아 둔 길이지만, 그 둘이 뚫려도 빈 반품 전표는
 *    만들어지지 않아야 한다.
 * 2. **도착지 유형이 계약 밖 값이다**(#173). 계약이 이 코드를 값 셋으로 좁혔고 어휘 밖 값은
 *    서버가 400으로 거절한다. 지금은 선택지 자리표시가 비어 있어 닿을 수 없지만, 그 배열이
 *    채워지는 순간 사용자가 고른 값이 곧장 여기로 온다 — 그때 걸러지는 자리가 여기다.
 *    「비슷하면 통과」를 두지 않는다(대소문자 보정·접두사 제거 없음).
 */
export const toGoodsIssueRequest = (input: ReturnRequestInput): GoodsIssueCreate | null => {
  if (input.lines.length === 0) return null;

  const { draft } = input;
  const destinationTypeCode = trimmed(draft.codes.destinationType);

  if (!isDestinationTypeCode(destinationTypeCode)) return null;

  const issuedLocal = toIssuedLocal(draft);

  return {
    issueTypeCode: trimmed(draft.codes.issueType),
    sourceDocumentTypeCode: trimmed(
      draft.codes.sourceDocumentType,
    ) as GoodsIssueCreate['sourceDocumentTypeCode'],
    sourceDocumentId: input.receipt.goodsReceiptId,
    sourceWarehouseId: input.receipt.warehouseId,
    destinationTypeCode,
    /* 공급사 선택칸의 값이 곧 도착지다 — 화면이 번호로 옮기는 유일한 자리다. */
    destinationId: Number(draft.supplier),
    issuedAt: toOffsetDateTime(issuedLocal, input.now),
    /*
     * 계약 스키마는 nullable이지만 설명이 「반품·기타 출고에서는 필수」다(계획 §5.4-4).
     * 화면이 필수로 걸었으므로 여기서는 늘 채워 보낸다 — 비었다면 버튼이 열리지 않았다.
     */
    reasonCode: trimmed(draft.codes.reason),
    replacementExpected: draft.replacementExpected,
    sendToErp: draft.sendToErp,
    postImmediately: POST_IMMEDIATELY,
    ...optionalText('remarks', draft.remarks),
    businessDate: toBusinessDate(issuedLocal),
    occurredAt: toOccurredAt(input.now),
    lines: input.lines.map(toLine),
  };
};

const toLine = (line: ReturnLineInput): GoodsIssueLineUpsert => ({
  itemId: line.itemId,
  lotId: line.lotId,
  issueQty: line.issueQty,
  uomId: line.uomId,
  sourceLocationId: line.sourceLocationId,
});
