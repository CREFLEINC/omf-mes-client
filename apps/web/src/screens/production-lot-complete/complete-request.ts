import type { LotComplete } from './types';

/**
 * 완료 요청 본문을 짓는 자리. **화면이 아니라 여기서 짓는다.**
 *
 * ⛔ **202 분기를 만들지 않는다.** 착수 통지의 「즉시 처리 201 · 큐 접수 202」 줄은 2026-08-12 에
 * 무효화됐다 — 오프라인이면 HTTP 요청 자체가 일어나지 않아 서버가 202 를 보낼 수 없다. 계약의
 * 성공 응답은 **200** 하나다.
 */

const pad = (value: number, width: number): string => String(value).padStart(width, '0');

/**
 * 시간대 오프셋(`+09:00`). **붙이지 않으면 서버가 다른 날로 읽는다** — 야간조가 자정을 넘길 때
 * 하루가 밀린다(공유계약 C-8).
 */
const offsetText = (at: Date): string => {
  const minutes = -at.getTimezoneOffset();
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);

  return `${sign}${pad(Math.floor(absolute / 60), 2)}:${pad(absolute % 60, 2)}`;
};

/**
 * 업무 일자 — **단말이 선 날짜**다(C-8).
 *
 * ⚠ 야간조 경계 같은 산출 규칙이 아직 정의돼 있지 않아 실행 시각의 날짜를 그대로 쓴다. 규칙이
 * 정해지면 이 함수 하나가 바뀐다.
 */
export const toBusinessDate = (at: Date): string =>
  `${String(at.getFullYear())}-${pad(at.getMonth() + 1, 2)}-${pad(at.getDate(), 2)}`;

/** 발생 시각 — **누른 순간**을 초와 오프셋까지 갖춰 싣는다(C-8). */
export const toOccurredAt = (at: Date): string =>
  `${toBusinessDate(at)}T${pad(at.getHours(), 2)}:${pad(at.getMinutes(), 2)}:${pad(
    at.getSeconds(),
    2,
  )}${offsetText(at)}`;

export interface CompleteRequestInput {
  /** 통합 화면 전환 전 구 화면에서 누른 완료 분기. 최신 계약 본문에는 싣지 않는다. */
  under: boolean;
  /** 고른 미달 사유. 완료 처리에서는 쓰이지 않는다 */
  reasonCode: string | null;
  /** 누른 순간 */
  at: Date;
}

/**
 * 최신 계약 본문을 만든다. 구 화면의 미달 마감은 최신 계약으로 표현할 수 없으므로 `null`을
 * 돌려 요청을 막는다. 버튼과 화면 흐름의 통합은 별도 P-02-04 화면 작업에서 정리한다.
 */
export const toCompleteRequest = (input: CompleteRequestInput): LotComplete | null => {
  const businessDate = toBusinessDate(input.at);
  const occurredAt = toOccurredAt(input.at);

  if (input.under) return null;

  return { businessDate, occurredAt };
};
