import type { InboundScheduleLine } from './types';

/**
 * 납기 **지연 판정** — 서버의 `overdueOnly` 와 **같은 기준**이다(server #749 · 장부 P-78).
 *
 * 「납기 지난 것만」으로 거른 결과와 표의 「지연」 표식이 서로 다른 줄을 가리키면 사용자는
 * 둘 중 하나를 믿지 못하게 된다. 그래서 서버의 두 조건을 그대로 옮긴다.
 *
 * 1. **다 들어오지 않았다** — 남은 수량 > 0 · 라인 취소 아님 · 헤더가 종료·취소 아님
 * 2. **납기 < 공장 현지 오늘** — 당일은 지연이 아니다
 *
 * 「오늘」은 호출부가 **공장 달력의 날짜**(`plantToday()` — `patterns/plant-time.ts`)로 준다.
 * 브라우저 날짜를 쓰면 한국에서 자정~새벽 2시 사이에 베트남 공장보다 하루 앞서 지연이 일찍 붙는다.
 * 순수 함수만 둔다 — 함수 안에서 시각을 읽으면 테스트가 실행 환경의 시각을 검사하게 된다.
 */

/** 다 들어오지 않았어도 더 받지 않는 헤더 상태 — 서버의 미완료 조건과 같은 둘이다. */
const CLOSED_HEADER_STATUSES: readonly string[] = ['CLOSED', 'CANCELLED'];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 아직 받을 것이 남은 라인인가. 서버의 `openOnly` 조건과 같다. */
export const isOpenLine = (
  line: Pick<InboundScheduleLine, 'remainingQty' | 'cancelledAt' | 'purchaseOrderStatusCode'>,
): boolean =>
  line.remainingQty > 0 &&
  line.cancelledAt === null &&
  !CLOSED_HEADER_STATUSES.includes(line.purchaseOrderStatusCode);

/**
 * 지연인가. 납기가 없거나 형식이 깨진 값에는 붙이지 않는다 — 문자열 비교는 `''`이나
 * `2026-8-9` 같은 값도 「작다」로 판정하므로, 형식을 먼저 보지 않으면 지어낸 판정을 화면에 낸다.
 */
export const isOverdue = (
  line: Pick<
    InboundScheduleLine,
    'expectedReceiptDate' | 'remainingQty' | 'cancelledAt' | 'purchaseOrderStatusCode'
  >,
  today: string,
): boolean => {
  const due = line.expectedReceiptDate;
  if (due === null || !DATE_PATTERN.test(due) || !DATE_PATTERN.test(today)) return false;

  // 자릿수가 고정된 `YYYY-MM-DD`라 문자열 비교가 곧 날짜 비교다.
  return due < today && isOpenLine(line);
};
