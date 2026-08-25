import { messages } from '@omf-mes/i18n';

/**
 * 출하일 범위 — 이 화면의 **필수** 조회 조건이다(공유계약 L-3).
 *
 * 계약은 `shipDateFrom`만 필수로 표시하고 `shipDateTo`는 선택이다(실측 — 계약 파라미터 설명).
 * 화면은 그 비대칭을 그대로 따른다 — 시작일이 없으면 조회 자체가 열리지 않고, 종료일은 비워도 된다.
 *
 * **W-01-09(`inbound-schedule`)의 기간과 반대다.** 그 화면은 기간이 선택이라 비어 있는 것이
 * 정상이지만, 이 화면은 시작일이 없으면 조회할 수 없다. 베끼면 틀린다.
 *
 * 순수 함수만 둔다 — `new Date()`도 `toISOString()`도 부르지 않는다. 함수 안에서 부르면
 * 실행 환경의 시각·시간대에 따라 결과가 달라져 테스트가 환경을 검사하게 된다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.shipmentSchedule;

/** 화면이 받는 값. `<input type="date">`가 주는 `YYYY-MM-DD` 그대로다. */
export interface PeriodInput {
  from: string;
  to: string;
}

/** 서버로 보내는 값. `shipDateFrom`은 항상 채워진다 — 비어 있으면 애초에 조회하지 않는다. */
export interface PeriodQuery {
  shipDateFrom: string;
  shipDateTo?: string;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * 자릿수가 맞고 **실제로 있는 날짜**인가.
 *
 * 실존 판정은 되짚기로 한다 — 만든 날짜의 해·달·일이 넣은 값과 같으면 그 날짜가 있는 것이다.
 * `Date`가 넘치는 값을 다음 달로 굴리므로(2월 31일 → 3월 3일) 되짚으면 달라진다.
 */
const isDate = (value: string): boolean => {
  const matched = DATE_PATTERN.exec(value);
  if (matched === null) return false;

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  const made = new Date(year, month - 1, day);

  return made.getFullYear() === year && made.getMonth() === month - 1 && made.getDate() === day;
};

/** 주소가 담은 기간. **깨진 값도 그대로 읽는다** — 조건 줄이 고칠 수 있어야 한다. */
export const readPeriod = (params: URLSearchParams): PeriodInput => ({
  from: params.get('shipDateFrom') ?? '',
  to: params.get('shipDateTo') ?? '',
});

/**
 * 조회할 수 있는 기간인지 판정한다. `null`이면 조회할 수 있고, 아니면 그 사유가 반환값이다.
 *
 * 사유 우선순위: **시작일 없음**(L-3 필수) → 형식 오류 → 뒤집힌 기간. 지금 고칠 수 있는 것을
 * 먼저 알려야 한다.
 */
export const validatePeriod = (input: PeriodInput): string | null => {
  if (input.from === '') return t.reasons.periodRequired;
  if (!isDate(input.from)) return t.reasons.periodInvalid;
  if (input.to !== '' && !isDate(input.to)) return t.reasons.periodInvalid;

  // 자릿수가 고정된 `YYYY-MM-DD`라 문자열 비교가 곧 날짜 비교다.
  if (input.to !== '' && input.to < input.from) return t.reasons.periodReversed;

  return null;
};

/**
 * 기간을 계약이 받는 쿼리로 바꾼다. **호출부가 먼저 `validatePeriod`로 보낼 수 있는지 확인한다**
 * — 이 함수는 그 확인을 되풀이하지 않고 유효한 입력을 전제로 한다(inbound-schedule의
 * `toPeriodQuery`와 같은 분업).
 */
export const toPeriodQuery = (input: PeriodInput): PeriodQuery => ({
  shipDateFrom: input.from,
  ...(input.to === '' ? {} : { shipDateTo: input.to }),
});
