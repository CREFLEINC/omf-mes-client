import { messages } from '@omf-mes/i18n';

/**
 * 조회 기간 — 이 화면의 **필수** 조회 조건이다.
 *
 * 계약이 `occurredFrom`·`occurredTo`를 필수로 두고 `date-time`을 요구한다. 날짜만 보내거나
 * 초를 빼면 서버가 거부하므로(400), 화면은 날짜 두 칸으로 받고 여기서 RFC3339로 바꿔 보낸다.
 *
 * 순수 함수만 둔다 — `new Date()`도 `toISOString()`도 부르지 않는다.
 * 함수 안에서 부르면 실행 환경의 시각·시간대에 따라 결과가 달라져 테스트가 환경을 검사하게 된다.
 * 「오늘」과 「시간대 오프셋」은 호출부가 인자로 준다.
 *
 * 다른 화면 슬라이스에도 같은 형태의 파일이 있으나 가져다 쓰지 않는다 —
 * 화면 슬라이스끼리 참조하면 한쪽의 사정이 다른 쪽 화면을 바꾼다. 쿼리 이름부터 다르다.
 */

const t = messages.masterChange;

/**
 * 기본 조회 기간(일). 이슈·계약 어디에도 기본값이 없어 화면이 정한 시작 조건이다.
 * 다른 값이 맞다고 정해지면 **이 상수만** 고치면 된다.
 */
export const DEFAULT_PERIOD_DAYS = 7;

/** 화면이 받는 값. `<input type="date">`가 주는 `YYYY-MM-DD` 그대로다. */
export interface PeriodInput {
  from: string;
  to: string;
}

/** 서버로 보내는 값. 초와 시간대까지 갖춘 RFC3339다. */
export interface PeriodQuery {
  occurredFrom: string;
  occurredTo: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isDate = (value: string): boolean => DATE_PATTERN.test(value);

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

/**
 * 조회할 수 있는 기간인지 판정한다. `null`이면 조회할 수 있고, 아니면 그 사유가 곧 반환값이다.
 *
 * 형식이 깨진 값은 **비어 있는 것과 같이** 다룬다 — 그대로 보내면 서버가 400을 돌려주고
 * 사용자는 무엇이 잘못됐는지 알 수 없다.
 */
export const validatePeriod = (input: PeriodInput): string | null => {
  if (!isDate(input.from) || !isDate(input.to)) return t.reasons.searchNeedsPeriod;

  // 자릿수가 고정된 `YYYY-MM-DD`라 문자열 비교가 곧 날짜 비교다.
  if (input.to < input.from) return t.reasons.periodReversed;

  return null;
};

/**
 * 날짜 두 칸을 서버가 받는 형태로 바꾼다.
 *
 * **종료는 그날 23:59:59다.** 00:00:00으로 만들면 마지막 날에 생긴 이력이 전부 빠져
 * 사용자에게는 「오늘 바뀐 것이 안 보인다」로 나타난다.
 *
 * `offsetMinutes`는 UTC 기준 분(한국은 +540)이다. 화면이 `-new Date().getTimezoneOffset()`을
 * 한 번 계산해 넘기고, 테스트는 고정값을 넣는다.
 */
export const toPeriodQuery = (input: PeriodInput, offsetMinutes: number): PeriodQuery => {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const absolute = Math.abs(offsetMinutes);
  const zone = `${sign}${pad(Math.floor(absolute / 60), 2)}:${pad(absolute % 60, 2)}`;

  return {
    occurredFrom: `${input.from}T00:00:00${zone}`,
    occurredTo: `${input.to}T23:59:59${zone}`,
  };
};

/**
 * 오늘을 마지막 날로 두고 `DEFAULT_PERIOD_DAYS`일치를 고른다 — **오늘을 포함해** 센다.
 * 달·해의 경계는 `Date`가 넘겨 준다(0일·음수 일자를 정상 날짜로 되돌린다).
 */
export const defaultPeriod = (today: Date): PeriodInput => {
  const format = (date: Date): string =>
    `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;

  const from = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - (DEFAULT_PERIOD_DAYS - 1),
  );

  return { from: format(from), to: format(today) };
};
