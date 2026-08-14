import type { components } from '@omf-mes/api-client';

import type { DisposalLineRow } from './disposal-selection';
import type { DisposalDraft, ReceiptView } from './types';

/**
 * 전표 생성 요청의 본문을 만드는 **유일한 자리**.
 *
 * 이 화면의 「승인 요청」 한 번이 요청 둘을 잇는다(승인 기록 정정 1-1) — 여기서 만드는 것은
 * **첫째 요청**(전표 생성)이고, 둘째 요청(승인 요청)의 본문은 `reason-draft.ts`가 만든다.
 * 두 본문을 한 파일에 두지 않는 이유는 **실패 지점이 둘**이라 각자 무엇을 실었는지 따로
 * 읽혀야 하기 때문이다.
 *
 * | 자리 | 값 | 근거 |
 * | --- | --- | --- |
 * | **`postImmediately`** | **상수 `false`** | 승인을 먼저 받는 기타 출고다. 계약의 `required`에 없고 기본이 거짓이지만 **목은 생략해도 201**이라(실측) 기대지 않는다 — 참으로 새면 **승인 없이 재고가 빠진다** |
 * | `sendToErp` | **계약 기본과 같은 상수** | 계획은 「싣지 않는다」였으나 **생성물 타입이 이 필드를 필수로 요구한다**(실측 — 기본값이 선언된 필드를 선택으로 내리지 않는다). 화면이 정하는 값이 아니므로 **토글을 두지 않고** 계약 기본과 같은 값을 그대로 싣는다 — 보내는 것과 생략하는 것의 서버 동작이 같다. 폐기 출고의 송신 여부가 정해지면 **이 상수 하나만** 고친다(질문 게시) |
 * | `replacementExpected` | **싣지 않는다** | 반품 축의 값이다 |
 * | `sourceDocumentId`·`sourceWarehouseId` | **고른 입고 전표** | 폐기의 근거 문서가 그 전표이고, 자재가 놓인 창고가 그 전표의 창고다 |
 * | **`destinationTypeCode`·`destinationId`** | **싣지 않는다 — 짝 통째로** | 폐기 계정이 없어져 도착지 식별자를 공급할 자리가 사라졌다(#124). 한쪽만 실으면 서버가 400을 낸다(#128 ⛔) — **짝은 함께 있거나 함께 없다.** 지금 이 화면이 만드는 본문은 계약이 말하는 **자체 폐기** 형태다 |
 * | `issuedAt` | **사용자가 적은 출고 일시** | 계약 설명이 「출고일」이다 |
 * | **`occurredAt`** | **제출 순간** | 공유계약 C-1. `issuedAt`과 갈라 싣는다 — 어제 폐기한 것을 오늘 올리면 두 값이 실제로 갈린다 |
 * | `businessDate` | **출고 일시의 날짜** | 산출 규칙(야간조 경계 등)이 정의돼 있지 않다. 실행 시각의 날짜를 쓰지 않는 이유가 위와 같다 |
 * | 줄의 다섯 값 | **표의 줄 그대로** | 계약이 요구하는 다섯을 입고 라인이 그대로 준다 — 적치 목적지가 곧 폐기 출고의 출발 위치다 |
 * | **요청 사유** | **싣지 않는다** | 둘째 요청의 값이다. 전표에 남지 않을 글이 전표 본문에 섞이면 안 된다 |
 * | **보유 수량·상한 판정** | **싣지 않는다** | 화면 안의 판단이다. 최종 판정은 서버가 한다 |
 * | **`If-Match`** | **싣지 않는다** | 새 전표라 매길 버전이 없다(계획 결정 13 · 헤더는 `queries.ts`가 만든다) |
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type GoodsIssueCreate = components['schemas']['GoodsIssueCreate'];
type GoodsIssueLineUpsert = components['schemas']['GoodsIssueLineUpsert'];

/**
 * **전기하지 않고 만들기만 한다.**
 *
 * 상수다 — 초안의 어떤 값으로도 갈리지 않는다(감지기 M52). 조건부로 만들면 「승인 전에 전기되는」
 * 길이 열리는데, 이 화면의 업무는 **승인을 먼저 받는 것**이고 계약이 그 순서를 명시했다.
 * 값이 참으로 바뀌면 사용자가 「승인 요청」을 눌렀는데 **재고가 그 자리에서 빠진다** — 이 화면에서
 * 되돌리는 수단은 승인을 타는 출고 취소뿐이고 그것은 다른 화면 소관이다.
 */
export const POST_IMMEDIATELY = false;

/**
 * ERP 송신 여부 — **화면이 정하는 값이 아니다.**
 *
 * 착수 이슈가 폐기 출고의 송신 여부를 말하지 않아 계획은 「싣지 않는다」로 두었으나,
 * **생성물 타입이 이 필드를 필수로 요구한다**(실측 — 기본값이 선언된 필드를 선택으로 내리지
 * 않는다). 그래서 **계약 기본과 같은 값**을 상수로 싣는다 — 보내는 것과 생략하는 것의 서버
 * 동작이 같아 화면이 새 결정을 하지 않는 값이다.
 *
 * **화면에 토글을 두지 않는다**(계획 결정 5 · 승인 기록 13-9). 사용자가 고를 값이 아니라는
 * 판단은 그대로이며, 답이 오면 **이 상수 하나만** 고친다.
 */
export const SEND_TO_ERP = true;

/**
 * 요청에 실릴 줄 하나.
 *
 * **계약의 치환 타입을 그대로 쓰지 않는다** — 거기에는 `goodsIssueLineId`·`pickingLineId`가
 * 함께 있는데, 이 화면은 만들기만 하고 고치지 않으며 피킹과도 무관하다. 자리를 두지 않으면
 * 그 값이 요청으로 샐 경로도 없다.
 */
export interface DisposalLineInput {
  itemId: number;
  lotId: number;
  issueQty: number;
  uomId: number;
  sourceLocationId: number;
}

/**
 * 고른 줄을 요청 라인으로 옮긴다.
 *
 * **초안 키가 아니라 표의 줄에서 온다.** 받는 것이 `describeDisposalSelection`이 낸 「고른 줄」이라,
 * 「다시 조회」로 사라진 줄의 초안이 남아 있어도 여기 나타나지 않는다(수명 표 14행).
 *
 * **읽을 수 없는 수량인 줄은 옮기지 않는다.** 버튼이 이미 막았지만 타입은 그 사실을 모른다 —
 * 여기서 값으로 한 번 더 좁힌다. 좁히지 않으면 non-null 단언을 쓰게 되고, 그때는 판정이 바뀌어도
 * 타입 검사가 알려 주지 않는다.
 */
export const toDisposalLines = (rows: readonly DisposalLineRow[]): DisposalLineInput[] =>
  rows.flatMap((row) =>
    row.qty.kind === 'qty'
      ? [
          {
            itemId: row.line.itemId,
            lotId: row.line.lotId,
            issueQty: row.qty.value,
            uomId: row.line.uomId,
            /* 적치 목적지가 곧 폐기 출고의 출발 위치다(계획 결정 2). */
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
export const toIssuedLocal = (draft: Pick<DisposalDraft, 'issuedDate' | 'issuedTime'>): string =>
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

/** 영업일 — **출고 일시의 날짜 조각이다.** 파생이라는 사실은 폼 안내와 확인 창이 밝힌다. */
export const toBusinessDate = (issuedLocal: string): string => issuedLocal.slice(0, 10);

/** 비운 칸은 키 자체를 싣지 않는다 — 빈 문자열은 「빈 값을 넣었다」로 전표에 남는다. */
const optionalText = <TKey extends string>(
  key: TKey,
  raw: string,
): Partial<Record<TKey, string>> => {
  const text = raw.trim();

  return text === '' ? {} : ({ [key]: text } as Record<TKey, string>);
};

export interface DisposalRequestInput {
  /** 고른 입고 전표. 원천 번호와 창고가 여기서 온다 */
  receipt: ReceiptView;
  /** 보낼 줄. **`toDisposalLines`가 표의 줄에서 만든 것**이다 */
  lines: readonly DisposalLineInput[];
  draft: DisposalDraft;
  /**
   * 제출 순간의 시각. **인자로 받는다** — 함수 안에서 `new Date()`를 부르면 순수하지 않아
   * offset이 붙는지와 발생 시각이 무엇인지를 고정 시각으로 검사할 수 없다.
   */
  now: Date;
}

const trimmed = (value: string): string => value.trim();

/**
 * 본문을 만든다. **채워지지 않은 자리가 하나라도 있으면 만들지 않는다**(`null`).
 *
 * **여기가 마지막 겹이다.** 버튼 잠금과 보내는 자리의 재판정이 이미 닫아 둔 길이지만, 그 둘이
 * 뚫려도 반쪽짜리 폐기 전표는 만들어지지 않아야 한다 — 계약 설명이 「최소 1행」인데 스키마에
 * `minItems`가 없고 **목이 빈 배열도 사유 코드 생략도 201로 받는다**(실측). 막는 곳이 화면뿐인
 * 자리에서 마지막으로 서는 것이 이 함수다(감지기 M50·M51).
 */
export const toGoodsIssueRequest = (input: DisposalRequestInput): GoodsIssueCreate | null => {
  const { draft } = input;

  if (input.lines.length === 0) return null;

  const issueTypeCode = trimmed(draft.codes.issueType);
  const sourceDocumentTypeCode = trimmed(draft.codes.sourceDocumentType);
  /*
   * 계약 스키마는 nullable이지만 설명이 「반품·기타 출고에서는 필수」다(계획 §5.4-17).
   * 화면이 필수로 걸었으므로 비었으면 **보내지 않는다** — 목은 생략을 201로 받는다.
   */
  const reasonCode = trimmed(draft.codes.reason);

  if (issueTypeCode === '' || sourceDocumentTypeCode === '') return null;

  if (reasonCode === '') return null;
  if (draft.issuedDate === '' || draft.issuedTime === '') return null;

  const issuedLocal = toIssuedLocal(draft);

  /*
   * **도착지 짝을 여기서 얹지 않는다**(#124·#128). `null`을 싣지도 않는다 — 이 슬라이스의
   * 규율은 「비운 칸은 키 자체를 싣지 않는다」이고, 짝의 한쪽만 실린 본문은 서버가 400으로
   * 되돌린다. 짝을 다시 붙이는 것은 자체 폐기·폐기 거래처를 함께 다루는 뒤 회차의 일이다.
   */
  return {
    issueTypeCode,
    sourceDocumentTypeCode,
    sourceDocumentId: input.receipt.goodsReceiptId,
    sourceWarehouseId: input.receipt.warehouseId,
    issuedAt: toOffsetDateTime(issuedLocal, input.now),
    reasonCode,
    sendToErp: SEND_TO_ERP,
    postImmediately: POST_IMMEDIATELY,
    ...optionalText('remarks', draft.remarks),
    businessDate: toBusinessDate(issuedLocal),
    occurredAt: toOccurredAt(input.now),
    lines: input.lines.map(toLine),
  };
};

const toLine = (line: DisposalLineInput): GoodsIssueLineUpsert => ({
  itemId: line.itemId,
  lotId: line.lotId,
  issueQty: line.issueQty,
  uomId: line.uomId,
  sourceLocationId: line.sourceLocationId,
});
