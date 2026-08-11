import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import {
  parseCountedQty,
  parseVarianceReason,
  readDraftQty,
  readDraftReason,
  type LineDrafts,
  type QtyParse,
  type ReasonParse,
} from './line-draft';
import type { CountLineView, PageMeta } from './types';
import { isReasonRequired, isVarianceStale } from './variance-rule';

/**
 * 치환 요청 조립 — **이 화면에서 가장 위험한 쓰기의 본문을 만드는 유일한 자리다.**
 *
 * 계약이 이렇게 적었다: 「이 위치의 라인 전체. **여기 없는 기존 라인은 미실사로 되돌린다**」
 * (`InventoryCountLineReplace.lines`). 즉 **치환은 파괴적이다** — 좁혀 받은 목록으로 보내면
 * 보이지 않던 줄이 조용히 미실사가 된다. 앞 화면들의 쓰기는 더하기였고 이것만 덮어쓰기다.
 *
 * 그래서 이 파일은 「무엇을 싣는가」보다 **「언제 본문을 만들지 않는가」**를 먼저 정한다.
 *
 * | 막는 것 | 어떻게 |
 * | --- | --- |
 * | 좁혀 받은 목록으로 저장 | **좁히는 조건을 만들지 않는다**(`queries.ts` — `uncountedOnly`·`varianceOnly`·`itemId`가 코드에 없다) |
 * | 못 받은 줄이 미실사가 됨 | **잘리면 저장 차단**(`isLinesTruncated` → `replaceBlockReason`) |
 * | 친 줄만 나감 | **전 줄 필수** — 한 줄이라도 준비되지 않으면 `toLineReplace`가 `null`을 돌려준다 |
 * | 빈 배열로 위치를 통째로 비움 | 줄이 없으면 본문을 만들지 않는다(목 서버는 빈 배열을 200으로 받는다 — 실측) |
 * | 표에서 사라진 줄이 실림 | **표에 있는 줄만** 싣는다 — 초안 키를 훑지 않는다 |
 *
 * **판정은 한 번만 한다.** 줄 하나의 사정(`LineRowView`)을 여기서 만들고, 표와 저장 버튼과
 * 본문 조립이 **같은 값을 읽는다** — 자리마다 다시 계산하면 「사유가 필수라고 표시했는데
 * 저장은 열려 있는」 어긋남이 생긴다(계획 §5.2 「읽는 자리 파생」).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type InventoryCountLineReplace = components['schemas']['InventoryCountLineReplace'];
type InventoryCountLineUpsert = components['schemas']['InventoryCountLineUpsert'];

const t = messages.stocktaking;

/**
 * 한 위치의 라인을 한 번에 받으려는 쪽 크기.
 *
 * **화면이 정한 잘림 완화값이며 보장이 아니다.** 계약의 `size`는 전 오퍼레이션 `default: 50`이고
 * **`maximum`이 없다**(실측) — 어떤 값도 계약 근거가 없다. 한 위치의 라인이 몇 건인지 화면이
 * 알 수 없으므로 어떤 값을 넣어도 잘릴 수 있다.
 *
 * **보장은 잘림 판정이 한다**(`isLinesTruncated`). 이 값은 그 일이 **덜 일어나게** 할 뿐이다.
 * 서버가 상한을 두고 400을 돌려주면 이 상수부터 의심한다 — 고칠 자리가 여기 하나다.
 */
export const LOCATION_LINE_PAGE_SIZE = 200;

/**
 * 전건을 받았는가 — **잘림 판정의 유일한 자리**(감지기 M50).
 *
 * 서버가 말한 전체 건수가 받은 건수보다 많으면 못 받은 줄이 있다. 그 줄은 치환에 실리지 않아
 * **미실사로 되돌아가므로** 이 판정의 결과는 경고가 아니라 **차단**이다(계획 결정 8).
 */
export const isLinesTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

/**
 * 표의 한 줄이 지금 어떤 상태인가. **표가 그리는 값과 보낼 값이 같은 재료에서 나온다** —
 * 갈리면 사용자가 확인한 것과 다른 전표가 만들어진다(W-01-03 `split-calc.ts`가 세운 형태).
 */
export interface LineRowView {
  line: CountLineView;
  /** 친 글자 그대로. 입력칸의 `value`가 된다. */
  qtyText: string;
  qty: QtyParse;
  reasonCode: string;
  reason: ReasonParse;
  /** 차이 사유가 지금 필요한가. 판정은 `variance-rule.ts`가 한다 — 여기서 다시 만들지 않는다. */
  isReasonRequired: boolean;
  /** 차이 칸에 보이는 값이 낡았는가(완료 조건 C41). */
  isVarianceStale: boolean;
  /** 이 줄을 보낼 수 있는가. **저장 버튼과 본문 조립이 이 값을 함께 읽는다.** */
  isReady: boolean;
}

/**
 * 응답의 줄들과 초안을 합쳐 표의 줄로 옮긴다.
 *
 * **초안이 성기다**(`line-draft.ts`) — 치지 않은 줄은 초안에 키가 없고 빈 칸으로 읽힌다.
 * 그래서 이 함수는 라인 응답이 도착해도 초안을 만들지 않으며, 되돌림 축이 **고른 위치 하나**로
 * 남는다(#43 · 감지기 M35).
 */
export const toLineRows = (
  lines: readonly CountLineView[],
  drafts: LineDrafts,
): LineRowView[] =>
  lines.map((line) => {
    const qtyText = readDraftQty(drafts, line);
    const reasonCode = readDraftReason(drafts, line);
    const qty = parseCountedQty(qtyText);
    const reason = parseVarianceReason(reasonCode);
    const reasonRequired = isReasonRequired({ systemQty: line.systemQty, qty });

    return {
      line,
      qtyText,
      qty,
      reasonCode,
      reason,
      isReasonRequired: reasonRequired,
      isVarianceStale: isVarianceStale({ savedQty: line.countedQty, qty }),
      /*
       * **전 줄 필수의 한 줄짜리 정의.** 수량을 읽을 수 있어야 하고, 사유가 잘못되지 않아야
       * 하며, 사유가 필수인 줄에는 사유가 있어야 한다.
       */
      isReady:
        qty.kind === 'qty' &&
        reason.kind !== 'invalid' &&
        (!reasonRequired || reason.kind === 'code'),
    };
  });

export interface ReplaceGateInput {
  rows: readonly LineRowView[];
  /** 이 위치의 라인을 전부 받지 못했는가(`isLinesTruncated`). */
  isTruncated: boolean;
  /** 차이 사유의 **값 목록 자체가 없는가**(`code-options.ts` · 승인 G1). */
  isReasonListPending: boolean;
}

/**
 * 저장이 왜 막혔는가. 보낼 수 있으면 `null`이다.
 *
 * **차례가 뜻을 정한다** — 못 받았다 → 보낼 것이 없다 → 아직 안 쳤다 → 잘못 쳤다 →
 * 고를 값이 없다 → 안 골랐다 → 고른 값이 잘못됐다. 앞선 사유가 참인 동안 뒤의 사유를 내면
 * 사용자가 **할 수 없는 조치**를 가리킨다(잘린 목록에서 「사유를 고르세요」를 내는 식).
 *
 * **값 목록 미확정은 차이가 있는 위치만 막는다**(승인 G1 · 완료 조건 C38 · 감지기 M40).
 * 차이가 없는 위치는 사유가 필요 없으므로 그대로 저장된다 — 개시가 통째로 막히는 것
 * (`countTypeCode`는 요청 필수)과 갈리는 자리이며, 그 갈림이 필수도로 갈라 적용한다는 승인의
 * 요점이다.
 */
export const replaceBlockReason = (input: ReplaceGateInput): string | null => {
  if (input.isTruncated) return t.actionReasons.saveTruncated;
  if (input.rows.length === 0) return t.actionReasons.saveNoLines;

  const emptyQty = input.rows.filter((row) => row.qty.kind === 'empty').length;

  if (emptyQty > 0) return t.actionReasons.saveIncompleteQty(emptyQty);

  const invalidQty = input.rows.filter((row) => row.qty.kind === 'invalid').length;

  if (invalidQty > 0) return t.actionReasons.saveInvalidQty(invalidQty);

  const needsReason = input.rows.filter(
    (row) => row.isReasonRequired && row.reason.kind !== 'code',
  ).length;

  if (needsReason > 0) {
    return input.isReasonListPending
      ? t.actionReasons.saveReasonListPending
      : t.actionReasons.saveNeedsReason(needsReason);
  }

  if (input.rows.some((row) => row.reason.kind === 'invalid')) {
    return t.actionReasons.saveInvalidReason;
  }

  return null;
};

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

/**
 * 실행 환경이 UTC와 얼마나 떨어져 있는지. `+09:00` 꼴이다.
 *
 * offset이 없는 문자열을 그대로 보내면 같은 글자가 지역마다 다른 순간을 가리킨다(공유계약 C-1).
 */
const offsetText = (at: Date): string => {
  const minutes = -at.getTimezoneOffset();
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);

  return `${sign}${pad(Math.floor(absolute / 60), 2)}:${pad(absolute % 60, 2)}`;
};

/**
 * 영업일 — **실행 시각의 날짜로 파생한다**(계획 §6.4).
 *
 * 계약이 필수로 요구하는데 산출 규칙(야간조 경계 등)이 어디에도 정의돼 있지 않다. 별도 입력칸을
 * 두는 대안은 **사용자가 무엇을 넣어야 하는지 화면이 설명할 수 없어** 택하지 않았다.
 * 실사 결과는 세는 그 자리에서 넣는 값이라 실행 시각과 갈릴 이유도 적다(입하 일시가 따로 있는
 * W-01-03과 다른 점이다).
 *
 * **`toISOString`을 쓰지 않는다** — UTC로 옮겨 버려 자정 경계에서 날짜가 하루 어긋난다.
 */
export const toBusinessDate = (at: Date): string =>
  `${pad(at.getFullYear(), 4)}-${pad(at.getMonth() + 1, 2)}-${pad(at.getDate(), 2)}`;

/** 발생 시각 — 제출 순간이다. 사용자가 정할 값이 아니라 입력칸을 두지 않는다(공유계약 C-1). */
export const toOccurredAt = (at: Date): string =>
  `${toBusinessDate(at)}T${pad(at.getHours(), 2)}:${pad(at.getMinutes(), 2)}:` +
  `${pad(at.getSeconds(), 2)}${offsetText(at)}`;

export interface LineReplaceInput {
  /** 치환하는 위치. 주소의 `loc`가 정본이다. */
  locationId: number;
  /** **표에 있는 줄 전부.** 초안 키를 훑지 않는 것이 사라진 줄을 거르는 형태다(감지기 M46). */
  rows: readonly LineRowView[];
  /**
   * 제출 순간의 시각. **인자로 받는다** — 함수 안에서 `new Date()`를 부르면 순수하지 않아
   * 자정 경계를 고정 시각으로 검사할 수 없다.
   */
  now: Date;
}

/**
 * 치환 본문. **전 줄이 준비되지 않았거나 보낼 줄이 없으면 `null`이다.**
 *
 * 「보낼 수 없다」를 타입으로 돌려주는 것이 **전 줄 필수의 마지막 겹**이다(계획 결정 3의 구현
 * 규칙 4 — 보내는 자리가 스스로 한 번 더 본다). 버튼의 사유 판정이 뚫려도 **친 줄만 나가는**
 * 경로가 코드에 남지 않는다 — 그 경로가 이 화면에서 가장 큰 사고 경로다.
 *
 * **카운트 시각은 제출 순간이다.** 계약이 줄마다 필수로 요구하는데 화면에 그 입력칸이 없고
 * 표에도 두지 않았다(계획 결정 9 — 착수 이슈 §4가 그 값으로는 미실사를 판정할 수 없다고 밝혔다).
 * 「지금 세어 넣는다」가 이 화면의 뜻이라 발생 시각과 같은 값을 싣는다.
 */
export const toLineReplace = (input: LineReplaceInput): InventoryCountLineReplace | null => {
  const countedAt = toOccurredAt(input.now);
  const lines: InventoryCountLineUpsert[] = [];

  for (const row of input.rows) {
    /* 전 줄 필수 — 하나라도 빠지면 **아무것도 보내지 않는다.** */
    if (!row.isReady || row.qty.kind !== 'qty') return null;

    lines.push({
      /*
       * **기존 줄을 고친다는 뜻이 이 값에 있다.** 없으면 계약이 신규 행으로 읽고, 그러면
       * 같은 재고가 두 줄이 된다. 신규 행 추가는 이번 범위 밖이라(계획 §4.2) 늘 싣지만,
       * 선택 필드로 다루는 구조를 그대로 두어 나중에 붙여도 이 자리를 다시 쓰지 않는다.
       */
      inventoryCountLineId: row.line.inventoryCountLineId,
      locationId: row.line.locationId,
      itemId: row.line.itemId,
      /* `null`은 **빈 값이지 참조 실패가 아니다** — 그대로 실어 「LOT이 없다」를 보존한다. */
      lotId: row.line.lotId,
      countedQty: row.qty.value,
      uomId: row.line.uomId,
      countedAt,
      /* 고르지 않은 사유는 **키 자체를 싣지 않는다** — 빈 문자열은 「빈 값을 넣었다」로 남는다. */
      ...(row.reason.kind === 'code' ? { varianceReasonCode: row.reason.value } : {}),
    });
  }

  /*
   * **빈 배열을 보내지 않는다**(감지기 M37). 그 위치를 통째로 미실사로 되돌리는 요청이며
   * 목 서버는 그것을 200으로 받는다(실측 — `minItems`가 없다). 막는 곳이 화면뿐이다.
   */
  if (lines.length === 0) return null;

  return {
    locationId: input.locationId,
    businessDate: toBusinessDate(input.now),
    occurredAt: toOccurredAt(input.now),
    lines,
  };
};
