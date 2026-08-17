import type { components } from '@omf-mes/api-client';

import type { SplitLineView } from './split-calc';
import type { HeaderDraft, PoView, SplitMode } from './types';

/**
 * 요청 조립 — **되돌릴 수 없는 쓰기의 본문을 만드는 유일한 자리다.**
 *
 * 계약의 취소는 승인을 타므로(실측) 잘못 실린 값은 화면이 되돌릴 수 없다. 그래서 이 파일은
 * 「무엇을 싣는가」만큼 **「무엇을 싣지 않는가」**를 분명히 한다 — 초과분의 발주 라인 번호 ·
 * 입하장 · 입하 예정 라인 · 빈 문자열이 그것이다.
 *
 * **정량/초과를 여기서 다시 계산하지 않는다.** 표가 그린 값과 보내는 값이 갈리면 사용자가
 * 확인한 것과 다른 전표가 만들어진다 — `split-calc.ts`의 결과(`SplitLineView`)를 받아 옮기기만 한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type SplitRequest = components['schemas']['InboundReceiptSplitRequest'];
type SplitPart = components['schemas']['InboundReceiptSplitPart'];
type LineUpsert = components['schemas']['InboundReceiptLineUpsert'];

export interface SplitInput {
  /** 고른 발주. 공급사·공장은 **사용자가 고르지 않고** 여기서 온다 */
  purchaseOrder: PoView;
  /** 화면이 그린 그대로. 잔량·한도·가르기가 이미 끝난 값이다 */
  rows: readonly SplitLineView[];
  header: HeaderDraft;
  /**
   * 제출 순간의 시각. **인자로 받는다** — 함수 안에서 `new Date()`를 부르면 순수하지 않아
   * 「영업일이 입하 일시에서 나온다」를 고정 시각으로 검사할 수 없다.
   */
  now: Date;
}

/** 두 갈래에 실릴 라인. 어느 쪽도 없을 수 있고, 그때는 그 갈래로 보낼 수 없다. */
export interface SplitParts {
  normal: LineUpsert[];
  excess: LineUpsert[];
}

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

/**
 * 실행 환경이 UTC와 얼마나 떨어져 있는지. `+09:00` 꼴이다.
 *
 * **제출 순간의 값을 쓴다.** 입하 일시를 파싱해 그 시점의 값을 쓰면 서머타임 경계에서
 * 더 정확해지지만, 파싱이 실패할 수 있는 가지가 생긴다 — 이 제품이 도는 지역에는
 * 서머타임이 없어 두 값이 갈리지 않으므로 가지를 만들지 않는 쪽을 택했다.
 */
const offsetText = (at: Date): string => {
  const minutes = -at.getTimezoneOffset();
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);

  return `${sign}${pad(Math.floor(absolute / 60), 2)}:${pad(absolute % 60, 2)}`;
};

/** `Date`를 로컬 시각 문자열로 적는다. `toISOString`은 UTC로 옮겨 버려 쓰지 않는다. */
const localText = (at: Date): string =>
  `${pad(at.getFullYear(), 4)}-${pad(at.getMonth() + 1, 2)}-${pad(at.getDate(), 2)}T` +
  `${pad(at.getHours(), 2)}:${pad(at.getMinutes(), 2)}:${pad(at.getSeconds(), 2)}`;

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

/** 발생 시각 — 제출 순간이다. 사용자가 정할 값이 아니라 입력칸을 두지 않는다(공유계약 C-1). */
export const toOccurredAt = (at: Date): string => `${localText(at)}${offsetText(at)}`;

/**
 * 영업일 — **입하 일시의 날짜로 파생한다**(공유계약 C-8 · 계획 결정 8).
 *
 * 계약이 필수로 요구하는데 산출 규칙(야간조 경계 등)이 어디에도 정의돼 있지 않다.
 * 별도 입력칸을 두는 대안은 **사용자가 무엇을 넣어야 하는지 화면이 설명할 수 없어** 택하지 않았다.
 * 실행 시각의 날짜를 쓰지 않는 이유는, 어제 받은 자재를 오늘 등록하는 것이 흔한 일이기 때문이다.
 *
 * 파생이라는 사실은 화면 안내로도 밝힌다 — 밝히지 않으면 영업일이 무엇으로 정해졌는지
 * 사용자가 화면 어디에서도 읽을 수 없다.
 */
export const toBusinessDate = (receiptDatetimeLocal: string): string =>
  receiptDatetimeLocal.slice(0, 10);

/**
 * 어느 라인이 어느 쪽에 실리는가.
 *
 * **0인 쪽은 넣지 않는다** — 0짜리 라인을 실으면 받지도 않은 줄이 전표에 남는다.
 * 미입력·형식 오류인 줄(`split === null`)은 갈릴 것이 없어 어느 쪽에도 실리지 않는다.
 */
export const toSplitParts = (rows: readonly SplitLineView[]): SplitParts => {
  const normal: LineUpsert[] = [];
  const excess: LineUpsert[] = [];

  for (const row of rows) {
    if (row.split === null) continue;

    if (row.split.normalQty > 0) {
      normal.push({
        /* **정량분이 원 발주의 어느 줄을 채우는지 밝히는 것**이 정량분의 정의다. */
        purchaseOrderLineId: row.line.purchaseOrderLineId,
        itemId: row.line.itemId,
        receivedQty: row.split.normalQty,
        uomId: row.line.uomId,
        /* LOT 입력을 열지 않는다 — 참으로 보내면 계약이 대체 사유 코드를 필수로 요구한다. */
        supplierLotMissing: false,
      });
    }

    if (row.split.excessQty > 0) {
      excess.push({
        /*
         * **발주 라인 번호를 싣지 않는다**(이슈 §6). 붙이면 초과분이 원 발주에 더해져
         * 「발주보다 많이 받았다」는 사실 자체가 사라진다. 편의를 위해서라도 붙이지 않는다.
         */
        itemId: row.line.itemId,
        receivedQty: row.split.excessQty,
        uomId: row.line.uomId,
        supplierLotMissing: false,
      });
    }
  }

  return { normal, excess };
};

/** 비운 칸은 키 자체를 싣지 않는다 — 빈 문자열은 「빈 값을 넣었다」로 전표에 남는다. */
const optionalText = <TKey extends string>(
  key: TKey,
  raw: string,
): Partial<Record<TKey, string>> => {
  const text = raw.trim();

  return text === '' ? {} : ({ [key]: text } as Record<TKey, string>);
};

/** 두 갈래가 함께 갖는 값. **같은 도착을 나눈 것이라 머리 값이 갈리면 안 된다.** */
const toSharedPart = (input: SplitInput, lines: LineUpsert[]): SplitPart => ({
  supplierId: input.purchaseOrder.supplierId,
  plantId: input.purchaseOrder.plantId,
  receiptDatetime: toOffsetDateTime(input.header.receiptDatetime, input.now),
  ...optionalText('deliveryNoteNo', input.header.deliveryNoteNo),
  ...optionalText('remarks', input.header.remarks),
  lines,
});

/**
 * 초과분 part. **예외 유형과 사유는 여기에만 붙는다** —
 * 계약이 「초과분 쪽에서 쓰는 예외 유형」으로 정의했고, 정량분에 붙이면 정상 입하 전표에
 * 예외 사유가 남아 뒤에 읽는 사람이 오해한다.
 */
const toExcessPart = (input: SplitInput, lines: LineUpsert[]): SplitPart => ({
  ...toSharedPart(input, lines),
  ...optionalText('exceptionTypeCode', input.header.exceptionTypeCode),
  ...optionalText('exceptionReason', input.header.exceptionReason),
});

/**
 * 이 갈래가 **초과분을 싣는가.**
 *
 * 요청 조립의 `excess` 조건과 **같은 자리에서 온다** — 두 곳에서 따로 판정하면 한쪽만 고쳐진 채
 * 남는다. 이 값은 요청 본문뿐 아니라 **등록 뒤에도 쓰인다**: 초과분을 싣지 않은 갈래로 만들어진
 * 전표는 정의상 정량분이므로 그 전표에 신규 P/O 등록 진입로를 세우지 않는다(계획 D-14 ② 개정).
 *
 * **「어느 전표가 초과분인가」를 판정하는 것이 아니다.** 그것은 응답이 알려 주지 않아 화면이
 * 지어내면 안 되는 값이고(계획 결정 3), 여기서 아는 것은 **사용자가 방금 누른 버튼**뿐이다 —
 * 초과분이 실린 갈래(`BOTH`)에서는 전표별 구분을 여전히 하지 않는다.
 */
export const includesExcess = (mode: SplitMode): boolean => mode !== 'NORMAL_ONLY';

/**
 * 세 갈래 중 하나의 요청 본문.
 *
 * **`mode`를 인자로만 받는다** — 기본값을 두면 화면이 갈래를 넘기지 않아도 요청이 만들어져,
 * 아무도 고르지 않은 갈래로 저장된 전표가 남는다(이슈 §6).
 *
 * 필요 없는 part는 **키 자체를 싣지 않는다.** 빈 part를 실으면 라인 0행이 나가고,
 * 목 서버는 그것을 201로 통과시킨다(실측).
 */
export const toSplitRequest = (mode: SplitMode, input: SplitInput): SplitRequest => {
  const parts = toSplitParts(input.rows);

  return {
    mode,
    ...(mode === 'EXCESS_ONLY' ? {} : { normal: toSharedPart(input, parts.normal) }),
    ...(includesExcess(mode) ? { excess: toExcessPart(input, parts.excess) } : {}),
    /* 계약이 「영업일과 발생 시각은 바깥에서 한 번만 받는다」고 적었다 — part에 넣지 않는다. */
    businessDate: toBusinessDate(input.header.receiptDatetime),
    occurredAt: toOccurredAt(input.now),
  };
};
