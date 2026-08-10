import { messages } from '@omf-mes/i18n';

import type { SplitLineView } from './split-calc';
import type { HeaderDraft, SplitMode } from './types';

/**
 * 보내기 전에 화면이 잡는 것.
 *
 * **계약의 조건부 필수를 막는 곳은 화면뿐이다.** 계약은 「`mode`가 `EXCESS_ONLY`가 아니면
 * `normal` 필수」를 설명으로만 적었고 `oneOf`로 표현하지 않았다 — 목 서버도 어긋난 조합을
 * 201로 통과시킨다(실측). 되돌릴 수 없는 쓰기라 「보내 보고 서버가 막아 주기」를 기대할 수 없다.
 *
 * 검증은 **세 층**에 나눠 심고 층마다 맡는 것을 겹치지 않게 둔다.
 *
 * | 갈래 | 어디가 막나 |
 * | --- | --- |
 * | 필수 값(`mode`·`businessDate`·`occurredAt`·part의 값) | 계약 타입 + `toSplitRequest`가 늘 채운다 |
 * | **조건부 필수**(모드↔part · 라인 최소 1행) | 이 파일의 `canSubmit` — 버튼 활성/비활성 |
 * | **짝 제약·길이**(예외 유형↔사유 · 거래명세서번호 100자) | 이 파일의 `validateHeader` — 인라인 오류 |
 * | 형식(수량 > 0인 수) | `parseQty` — 라인 인라인 오류. 남아 있으면 `qtyErrorReason`이 등록을 막는다 |
 *
 * **화면이 막지 않는 것은 서버가 막는다.** 그 실패는 저장 실패 배너로 보인다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.overReceiptSplit;

/**
 * 계약이 정한 거래명세서번호의 길이 상한.
 *
 * **입력칸에 `maxLength`를 두지 않고 이 검증이 오류로 잡는다.** `maxLength`는 붙여넣기를
 * 조용히 잘라 내는데, 그러면 사용자가 넣으려던 것과 **다른 번호**가 되돌릴 수 없는 전표에
 * 실린다 — 길이 문제는 감추지 말고 보이는 오류로 돌려주는 것이 맞다.
 * 상한을 넘겼다는 사실은 이 상수를 읽는 오류 문구가 밝힌다.
 */
export const DELIVERY_NOTE_NO_MAX = 100;

/**
 * 이 화면이 소유한 입력칸 이름. 서버가 준 필드 오류를 **인라인으로 낼지 배너로 올릴지** 가른다.
 *
 * **머리 입력칸만 담는다.** 라인 오류는 계약이 어느 행인지 알려 주지 않아 인라인으로 낼 자리를
 * 고를 수 없다 — 여기에 라인 필드를 넣으면 3번 줄의 오류가 1번 줄에 붙는다.
 */
export const RECEIPT_FORM_FIELDS: readonly string[] = [
  'receiptDatetime',
  'deliveryNoteNo',
  'remarks',
  'exceptionTypeCode',
  'exceptionReason',
];

/** 실제로 요청에 실릴 라인이 각 갈래에 몇 줄인가. 세는 자리는 요청 조립과 같다. */
export interface SplitCounts {
  normalLines: number;
  excessLines: number;
}

/**
 * 이 갈래로 보낼 수 있는가.
 *
 * 계약이 요구하는 것은 둘이다 — ① 그 갈래에 필요한 part가 있을 것 ② part의 `lines`가 최소 1행일 것.
 * 라인 수가 0이면 part를 만들 수 없으므로 두 조건이 여기서 하나로 합쳐진다.
 */
export const canSubmit = (mode: SplitMode, counts: SplitCounts): boolean => {
  switch (mode) {
    case 'BOTH':
      return counts.normalLines > 0 && counts.excessLines > 0;
    case 'NORMAL_ONLY':
      return counts.normalLines > 0;
    case 'EXCESS_ONLY':
      return counts.excessLines > 0;
  }
};

/**
 * 왜 막혔는지. 보낼 수 있으면 `null`이다.
 *
 * **아직 아무 수량도 넣지 않은 상태는 세 버튼이 함께 잠긴다** — 그때 버튼마다 자기 몫이
 * 없다고 따로 말하면 같은 사정이 세 번 되풀이돼 무엇을 해야 하는지 오히려 흐려진다.
 * 수량을 넣은 뒤부터는 버튼마다 사정이 갈리므로 각자 말한다.
 */
export const modeBlockReason = (mode: SplitMode, counts: SplitCounts): string | null => {
  if (canSubmit(mode, counts)) return null;

  if (counts.normalLines === 0 && counts.excessLines === 0) return t.actionReasons.noQty;

  switch (mode) {
    case 'BOTH':
      /* 나눌 수 없는 이유가 둘이고 **사용자가 할 조치가 다르다** — 각기 다른 버튼을 가리킨다. */
      return counts.excessLines === 0
        ? t.actionReasons.bothNeedsExcess
        : t.actionReasons.bothNeedsNormal;
    case 'NORMAL_ONLY':
      return t.actionReasons.normalOnlyNeedsNormal;
    case 'EXCESS_ONLY':
      return t.actionReasons.excessOnlyNeedsExcess;
  }
};

/**
 * 머리 입력의 오류.
 *
 * **등록을 누른 뒤에 세운다.** 치는 도중에 붉은 글씨를 띄우면 아직 넣지도 않은 칸이 잘못된
 * 것처럼 보인다(저장소 전례). 그래서 여기서는 판정만 하고 언제 보일지는 화면이 정한다.
 */
export const validateHeader = (header: HeaderDraft): Record<string, string> => {
  const errors: Record<string, string> = {};

  /* 계약 필수인데 입력칸이 있는 유일한 값이다. 비면 두 part의 `receiptDatetime`을 만들 수 없다. */
  if (header.receiptDatetime === '') {
    errors.receiptDatetime = t.errors.receiptDatetimeRequired;
  }

  /*
   * **보낼 값의 길이를 잰다.** 요청 조립이 앞뒤 공백을 떼고 보내므로 여기서도 뗀 값을 재야
   * 「100자로 보내는데 화면은 101자라고 막는」 어긋남이 생기지 않는다.
   */
  if (header.deliveryNoteNo.trim().length > DELIVERY_NOTE_NO_MAX) {
    errors.deliveryNoteNo = t.errors.deliveryNoteNoTooLong(DELIVERY_NOTE_NO_MAX);
  }

  /*
   * 짝 제약 — 계약이 「`exceptionTypeCode`가 있으면 `exceptionReason` 필수」로 정했다.
   *
   * **지금은 이 가지에 닿을 수 없다.** 예외 유형 선택지가 비어 있어(계획 결정 14) 유형을
   * 고를 방법이 없기 때문이다. 그래도 규칙을 지금 심어 두는 이유는, 값 목록이 확정돼
   * `code-options.ts`의 배열을 채우는 순간 이 제약이 **함께 살아나야** 하기 때문이다 —
   * 그때 이 규칙을 새로 발견해야 한다면 코드 목록만 채우고 검증은 빠뜨리게 된다.
   */
  if (header.exceptionTypeCode !== '' && header.exceptionReason.trim() === '') {
    errors.exceptionReason = t.errors.exceptionReasonRequired;
  }

  return errors;
};

/**
 * 고치지 않은 수량이 남아 있으면 등록을 막을 사유. 없으면 `null`이다.
 *
 * **잘못 친 줄은 계산에서 빠진다.** 그대로 등록하면 그 줄만 빠진 전표가 만들어지는데,
 * 되돌리려면 승인을 거쳐야 해서 화면이 고칠 수 없다 — 사용자가 빠뜨린 것을 알아채기도 어렵다.
 * 빈 칸은 「이번에 받지 않는다」이므로 여기서 세지 않는다.
 */
export const qtyErrorReason = (rows: readonly SplitLineView[]): string | null =>
  rows.some((row) => row.qtyError !== null) ? t.errors.qtyInvalidBlocked : null;
