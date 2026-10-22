/**
 * 납기 **지연 판정** — 서버의 `overdueOnly` 와 **같은 기준**이다(server #762).
 *
 * 「납기 지난 것만」으로 거른 결과와 표의 「지연」 표식이 서로 다른 줄을 가리키면 사용자는
 * 둘 중 하나를 믿지 못하게 된다. 그래서 서버의 두 조건을 그대로 옮긴다.
 *
 * 1. **다 들어오지 않았다** — 남은 라인이 있다(서버가 `openLineCount` 로 준다)
 * 2. **납기 < 공장 현지 오늘** — 당일은 지연이 아니다
 *
 * 「오늘」은 호출부가 **공장 달력의 날짜**(`plantToday()` — `patterns/plant-time.ts`)로 준다.
 * 브라우저 날짜를 쓰면 한국에서 자정~새벽 2시 사이에 베트남 공장보다 하루 앞서 지연이 일찍 붙는다.
 * 순수 함수만 둔다 — 함수 안에서 시각을 읽으면 테스트가 실행 환경의 시각을 검사하게 된다.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * P/O 묶음의 지연 — 납기가 공장 현지 오늘보다 앞인데 **남은 라인이 있다**(server #762 `overdueOnly` 와 같은 기준).
 * 취소된 발주는 남은 라인이 0 으로 온다.
 */
export const isOrderOverdue = (
  order: { expectedReceiptDate?: string | null; openLineCount: number },
  today: string,
): boolean => {
  const due = order.expectedReceiptDate ?? null;
  if (due === null || !DATE_PATTERN.test(due) || !DATE_PATTERN.test(today)) return false;

  return due < today && order.openLineCount > 0;
};
