import { messages } from '@omf-mes/i18n';

/**
 * 도착 예정일 기간 — 이 화면의 **선택** 조회 조건이다.
 *
 * 계약이 `expectedArrivalDateFrom`·`expectedArrivalDateTo`를 둘 다 선택으로 두고 자료형이
 * `date`(`YYYY-MM-DD`)라, 화면이 받은 값을 시각으로 늘리지 않고 그대로 보낸다.
 * **시간대 변환이 없다** — 날짜형 조건에 시각을 붙이면 서버가 경계에서 다르게 자른다.
 *
 * 순수 함수만 둔다 — `new Date()`도 `toISOString()`도 부르지 않는다.
 * 함수 안에서 부르면 실행 환경의 시각·시간대에 따라 결과가 달라져 테스트가 환경을 검사하게 된다.
 *
 * 다른 화면 슬라이스에도 같은 이름의 파일이 있으나 가져다 쓰지 않는다 —
 * 화면 슬라이스끼리 참조하면 한쪽의 사정이 다른 쪽 화면을 바꾼다. 그 화면은 기간이 **필수**이고
 * 쿼리 이름도 자료형도 다르다.
 */

const t = messages.inboundSchedule;

/** 화면이 받는 값. `<input type="date">`가 주는 `YYYY-MM-DD` 그대로다. */
export interface PeriodInput {
  from: string;
  to: string;
}

/** 서버로 보내는 값. **채운 쪽만 키가 생긴다.** */
export interface PeriodQuery {
  expectedArrivalDateFrom?: string;
  expectedArrivalDateTo?: string;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * 자릿수가 맞고 **실제로 있는 날짜**인가.
 *
 * 자릿수만 보면 `2026-13-45`·`2026-02-31`이 통과해 그대로 요청에 실리고, 서버가 400을 돌려주면
 * 사용자에게는 「조회가 늘 실패한다」로만 보인다.
 *
 * 실존 판정은 **되짚기**로 한다 — 만든 날짜의 해·달·일이 넣은 값과 같으면 그 날짜가 있는 것이다.
 * `Date`가 넘치는 값을 다음 달로 굴리므로(2월 31일 → 3월 3일) 되짚으면 달라진다.
 * 인자를 모두 주므로 실행 환경의 시각을 읽지 않는다 — 이 파일의 순수성은 그대로다.
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
  from: params.get('from') ?? '',
  to: params.get('to') ?? '',
});

/**
 * 조회할 수 있는 기간인지 판정한다. `null`이면 조회할 수 있고, 아니면 그 사유가 곧 반환값이다.
 *
 * **비어 있는 것은 잘못이 아니다.** 이 경로는 파티션 테이블이 아니라 기간 없이도 조회된다
 * (이슈 #20 §6). 한쪽만 채운 것도 허용한다 — 계약이 두 날짜를 각각 독립으로 둔다.
 *
 * 막는 것은 **보내면 반드시 400이 되는 값** 둘뿐이다 — 없는 날짜와 뒤집힌 기간.
 * 형식 사유를 앞에 둔다: 지금 고칠 수 있는 것을 먼저 알려야 한다.
 */
export const validatePeriod = (input: PeriodInput): string | null => {
  const hasFrom = input.from !== '';
  const hasTo = input.to !== '';

  if (hasFrom && !isDate(input.from)) return t.reasons.periodInvalid;
  if (hasTo && !isDate(input.to)) return t.reasons.periodInvalid;

  // 자릿수가 고정된 `YYYY-MM-DD`라 문자열 비교가 곧 날짜 비교다.
  if (hasFrom && hasTo && input.to < input.from) return t.reasons.periodReversed;

  return null;
};

/**
 * 날짜 두 칸을 계약이 받는 쿼리로 바꾼다.
 *
 * **빈 쪽은 키 자체를 만들지 않는다.** 빈 문자열을 실으면 요청 URL에 `…From=`이 남아
 * 요청을 읽는 사람에게 조건이 걸린 것처럼 보이고, 서버가 그 값을 어떻게 다룰지도 계약에 없다.
 */
export const toPeriodQuery = (input: PeriodInput): PeriodQuery => ({
  ...(input.from === '' ? {} : { expectedArrivalDateFrom: input.from }),
  ...(input.to === '' ? {} : { expectedArrivalDateTo: input.to }),
});
