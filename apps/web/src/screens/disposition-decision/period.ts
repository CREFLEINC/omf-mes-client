import { messages } from '@omf-mes/i18n';

/**
 * 처분 판정 화면의 조회 기간. **판정 대기(접수일)와 처리 이력(판정일) 두 조회가 함께 쓴다.**
 *
 * 이 화면이 거는 네 파라미터(`openedFrom`·`openedTo`·`decidedFrom`·`decidedTo`)는 계약에서
 * 전부 **`date-time`**이다(실측). 그래서 아래 두 규약이 함께 걸린다.
 *
 * - **L-3** — 기간을 비울 수 없게 하고 기본값을 최근 한 달로 둔다. 무제한 조회를 허용하면
 *   원장이 쌓인 뒤 목록이 멎는다.
 * - **L-3-1** — 끝 경계는 **반열림**이다. 「그날까지」를 **익일 00:00:00**으로 보낸다.
 *   `23:59:59`로 닫으면 그 초의 소수점 이하(`23:59:59.5`)가 어느 경계로 잘라도 빠진다.
 *
 * ⚠ 이 저장소에는 `23:59:59`를 보내는 기간 모듈이 다섯 있다. **그 코드가 규약보다 앞선 것이
 * 넷이고, 하나는 뒤다** — 규약이 선 뒤에도 옛 모양이 한 번 더 들어갔다는 뜻이다. 새 조회는
 * 규약을 따르고, 앞선 자리의 이관은 각자의 슬라이스가 맡는다.
 *
 * ⭐ **판정과 요청 만들기를 한 함수에 둔다**(`resolvePeriod`). 「막을지」와 「무엇을 보낼지」를
 * 따로 두면 한쪽만 고쳐져, 막지 않은 값이 요청에 실리거나 막았는데 사유가 없는 상태가 생긴다.
 *
 * **순수 함수만 둔다.** 함수 안에서 `new Date()`로 «지금»을 읽지 않는다 — 읽으면 실행 환경의
 * 날짜·시간대에 따라 결과가 달라져 감지기가 환경을 검사하게 된다. 「오늘」과 오프셋은 호출부가 준다.
 */

const t = messages.dispositionDecision;

export const DEFAULT_PERIOD_DAYS = 30;

/** 화면이 받는 값. 날짜 컨트롤이 주는 `YYYY-MM-DD` 그대로다. */
export interface PeriodInput {
  from: string;
  to: string;
}

/** 서버로 보내는 값. 초와 시간대까지 갖춘 RFC 3339다 — 계약이 `date-time`을 받는다. */
export interface PeriodBounds {
  from: string;
  to: string;
}

/**
 * 기간 판정의 결과. **두 갈래뿐이고 둘 다 화면이 무엇을 해야 할지 말한다.**
 *
 * 갈래를 나눈 덕에 **검증을 건너뛰고 변환만 부르는 것이 타입으로 불가능하다** — `PeriodInput`과
 * `PeriodBounds`가 구조적으로 같아서, 두 함수를 따로 내보내면 컴파일러가 그 실수를 못 잡는다.
 */
export type PeriodState =
  { kind: 'ready'; bounds: PeriodBounds } | { kind: 'blocked'; reason: string };

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

/**
 * 달력에 실재하는 날만 통과시킨다 — `2026-02-31`은 형태만 맞고 날이 아니다.
 * 통과한 값은 숫자로 돌려주어 뒤에서 문자열을 다시 뜯지 않게 한다.
 */
const parseCalendarDate = (value: string): CalendarDate | null => {
  const match = DATE_PATTERN.exec(value);
  if (match === null) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? { year, month, day }
    : null;
};

export const isPeriodDate = (value: string): boolean => parseCalendarDate(value) !== null;

const pad = (value: number, width: number): string => String(value).padStart(width, '0');

const formatDate = (date: Date): string =>
  `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;

/** 오늘을 마지막 날로 두고 `DEFAULT_PERIOD_DAYS`일치를 고른다 — **오늘을 포함해** 센다. */
export const defaultPeriod = (today: Date): PeriodInput => {
  const from = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - (DEFAULT_PERIOD_DAYS - 1),
  );

  return { from: formatDate(from), to: formatDate(today) };
};

/**
 * ⚠ **DST가 없는 시간대를 전제로 고정 오프셋 하나를 기간의 두 끝에 함께 찍는다.**
 * 대상 지역(한국 UTC+9 · 베트남 UTC+7)에 서머타임이 없어 성립한다. DST가 있는 지역을 담게
 * 되면 두 끝의 오프셋이 갈리므로 이 함수부터 고쳐야 한다.
 */
const zoneOf = (offsetMinutes: number): string => {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const absolute = Math.abs(offsetMinutes);

  return `${sign}${pad(Math.floor(absolute / 60), 2)}:${pad(absolute % 60, 2)}`;
};

/** 하루 뒤. 검증을 통과한 값만 받으므로 실패할 자리가 없다 — `Date`가 달·해 경계를 넘겨 준다. */
const nextDay = (date: CalendarDate): string =>
  formatDate(new Date(date.year, date.month - 1, date.day + 1));

/**
 * 기간을 판정하고, 통과하면 서버가 받는 형태로 바꾼다.
 *
 * ⭐ **막는 사유를 세 갈래로 가른다** — 셋의 해법이 서로 다르기 때문이다(공유계약 G-3:
 * 비활성 사유는 「왜」가 아니라 「어떻게 풀 것인가」를 담는다). 순서도 뜻이 있다: 달력에 없는
 * 날을 「두 날짜를 바꾸세요」로 안내하면 바꿔도 풀리지 않는다.
 */
export const resolvePeriod = (input: PeriodInput, offsetMinutes: number): PeriodState => {
  if (input.from === '' || input.to === '') {
    return { kind: 'blocked', reason: t.values.periodRequired };
  }

  const from = parseCalendarDate(input.from);
  const to = parseCalendarDate(input.to);

  if (from === null || to === null) {
    return { kind: 'blocked', reason: t.values.periodInvalid };
  }

  // 자릿수가 고정된 `YYYY-MM-DD`라 문자열 비교가 곧 날짜 비교다.
  if (input.to < input.from) {
    return { kind: 'blocked', reason: t.values.periodReversed };
  }

  const zone = zoneOf(offsetMinutes);

  return {
    kind: 'ready',
    bounds: {
      from: `${input.from}T00:00:00${zone}`,
      to: `${nextDay(to)}T00:00:00${zone}`,
    },
  };
};

/**
 * 조회를 막는 사유만 필요할 때. 없으면 `null`.
 *
 * 오프셋은 판정에 쓰이지 않으므로 아무 값이나 넣어도 결과가 같다 — 판정과 변환을 한 함수에 둔
 * 대가이며, 이 함수를 거쳐야 두 자리의 판정이 갈리지 않는다.
 */
export const periodLockReason = (input: PeriodInput): string | null => {
  const state = resolvePeriod(input, 0);
  return state.kind === 'blocked' ? state.reason : null;
};
