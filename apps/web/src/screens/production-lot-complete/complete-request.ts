import type { LotComplete } from './types';

/**
 * 완료 요청 본문을 짓는 자리. **화면이 아니라 여기서 짓는다** — 「완료」와 「미달 마감」이 같은
 * 오퍼레이션을 부르고 **사유 하나로만 갈리므로**, 두 곳에서 지으면 미달인데 사유가 빠진 본문이
 * 나갈 수 있다.
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
  /** 미달 마감인가. 참이면 사유가 반드시 실린다 */
  under: boolean;
  /** 고른 미달 사유. 완료 처리에서는 쓰이지 않는다 */
  reasonCode: string | null;
  /** 누른 순간 */
  at: Date;
}

/**
 * 본문을 만든다. **만들 수 없으면 `null`** — 미달인데 사유가 없으면 보내지 않는다.
 *
 * ⛔ **완료 처리에 사유를 싣지 않는다.** 목표를 채운 LOT 에 미달 사유가 붙으면 나중에 수율을
 * 분석할 때 달성분이 미달로 집계된다 — 서버는 값이 오면 그대로 기록한다.
 */
export const toCompleteRequest = (input: CompleteRequestInput): LotComplete | null => {
  const businessDate = toBusinessDate(input.at);
  const occurredAt = toOccurredAt(input.at);

  if (!input.under) return { businessDate, occurredAt };

  const reasonCode = input.reasonCode?.trim() ?? '';

  if (reasonCode === '') return null;

  return { businessDate, occurredAt, completionVarianceReasonCode: reasonCode };
};
