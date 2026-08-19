import { messages } from '@omf-mes/i18n';

import type { DocumentProgressView } from './types';

/**
 * 「이 문서를 취소 요청할 수 있는가」와 「왜 안 되는가」를 한 곳에서 읽는다.
 *
 * ⭐ **판정을 화면이 다시 하지 않는다.** 후속 유무·전기 여부·진행 중 취소 요청 셋을 **서버가
 * 함께 보고** `cancellable`로 내려준다. 화면이 후속 건수나 상태 코드로 다시 판정하면, 원천
 * 참조가 다형이라 유형이 늘 때마다 조용히 틀린다(공유계약 A-10 보강 · 착수 이슈 §6의 첫째 금지).
 *
 * 이 모듈이 하는 일은 **읽는 것과 옮기는 것**뿐이다 — 서버가 준 두 값을 표시 갈래로 옮긴다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.documentProgress;

/**
 * 계약이 **설명문에 열거한** 취소 불가 사유 넷.
 *
 * 코드값에 분기를 걸지 않는 것이 원칙인데(공유계약 G-2) 이 넷은 예외다 — 계약 자신이 값을
 * 열거했기 때문이다. **그래도 열거를 잠금에 쓰지 않는다**: 버튼을 잠그는 것은 `cancellable`이고
 * 이 목록은 **문면을 고르는 데만** 쓰인다. 그래서 모르는 코드가 와도 화면이 막히지 않는다.
 */
export const KNOWN_BLOCK_REASON_CODES: readonly string[] = [
  'SUCCESSOR_EXISTS',
  'ALREADY_CANCELLED',
  'CANCEL_IN_PROGRESS',
  'STATE_LOCKED',
];

/**
 * 취소 가능 여부의 표시 갈래.
 *
 * `known`을 담는 이유는 **읽는 쪽이 문면과 코드를 가르는 근거**가 필요하기 때문이다 —
 * 아는 코드는 우리말 문면으로, 모르는 코드는 **코드 문자열 그대로** 낸다. 모르는 값에 이름을
 * 붙이면 그 뜻도 화면이 지어낸 것이 된다.
 */
export type CancelAvailability =
  { kind: 'available' } | { kind: 'blocked'; reasonCode: string; known: boolean };

/**
 * 서버가 준 두 값을 표시 갈래로 옮긴다.
 *
 * **사유가 없이 오는 갈래가 실재한다** — 계약이 `cancelBlockedReasonCode`를 선택으로 두었다.
 * 그때 코드를 지어내지 않고 빈 문자열로 두며, 읽는 쪽이 「사유를 받지 못했습니다」로 낸다.
 */
export const readCancelAvailability = (
  progress: Pick<DocumentProgressView, 'cancellable' | 'cancelBlockedReasonCode'>,
): CancelAvailability => {
  if (progress.cancellable) return { kind: 'available' };

  const reasonCode = progress.cancelBlockedReasonCode ?? '';

  return { kind: 'blocked', reasonCode, known: KNOWN_BLOCK_REASON_CODES.includes(reasonCode) };
};

/** 아는 네 코드의 문면 표. 여기 없는 코드에는 문구를 만들지 않는다. */
const BLOCK_REASON_TEXTS: Readonly<Record<string, string>> = {
  SUCCESSOR_EXISTS: t.blockReasons.SUCCESSOR_EXISTS,
  ALREADY_CANCELLED: t.blockReasons.ALREADY_CANCELLED,
  CANCEL_IN_PROGRESS: t.blockReasons.CANCEL_IN_PROGRESS,
  STATE_LOCKED: t.blockReasons.STATE_LOCKED,
};

/**
 * 취소가 막힌 이유를 사람이 읽는 글자로 옮긴다 — **세 갈래다.**
 *
 * | 갈래 | 무엇을 내나 | 왜 |
 * | --- | --- | --- |
 * | 아는 코드 | 우리말 문면 | 계약이 값을 열거했다 |
 * | 모르는 코드 | **코드 문자열 그대로** | 뜻을 지어내지 않는다. 사용자가 담당자에게 그대로 전할 수 있다 |
 * | 코드 없음 | 「사유를 받지 못했습니다」 | 빈 칸으로 두면 사유가 없는 것인지 화면이 못 그린 것인지 구분되지 않는다 |
 */
export const describeCancelBlockReason = (availability: CancelAvailability): string => {
  if (availability.kind === 'available') return '';

  if (availability.known) return BLOCK_REASON_TEXTS[availability.reasonCode] ?? '';

  return availability.reasonCode === '' ? t.values.noBlockReason : availability.reasonCode;
};
