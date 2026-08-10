import { messages } from '@omf-mes/i18n';

/**
 * 수불 이력의 **영업일 범위** — 이 화면에서 유일하게 「없으면 조회 자체가 불가능한」 조건이다.
 *
 * 계약이 `businessDateFrom`·`businessDateTo`를 **필수**로 둔다(실측: 타입에서 선택이 아니고,
 * 목 서버는 기간 없이 부르면 400을 준다). 수불 원장이 영업일로 나뉘어 저장되기 때문이며,
 * **성능이 아니라 가능·불가능의 문제**다.
 *
 * **판정과 요청 만들기를 한 함수에 둔다**(`resolveBusinessPeriod`). 「막을지」와 「무엇을 보낼지」를
 * 따로 두면 한쪽만 고쳐져, 막지 않은 값이 요청에 실리거나 막았는데 사유가 없는 상태가 생긴다.
 *
 * **순수 함수만 둔다.** 함수 안에서 `new Date()`를 부르면 테스트가 실행 환경의 시각을 검사하게
 * 된다. 「오늘」은 호출부가 인자로 준다(`expiry.ts`·`as-of.ts`와 같은 갈래).
 *
 * 다른 화면 슬라이스에도 기간을 다루는 같은 형태의 파일이 있으나 가져다 쓰지 않는다 —
 * 쿼리 이름부터 다르고, 한쪽의 사정이 다른 화면을 끌고 가지 않아야 한다.
 */

const t = messages.stockStatus;

/**
 * 기본 조회 기간(개월). 화면 스펙 §5-4가 「최근 1개월」로 정했다.
 *
 * **기간을 적는 자리는 여기 하나뿐이다.** 다른 값이 맞다고 정해지면 이 상수만 고친다.
 */
export const DEFAULT_HISTORY_MONTHS = 1;

/** 화면이 받는 값. `<input type="date">`가 주는 `YYYY-MM-DD` 그대로다. */
export interface BusinessPeriod {
  from: string;
  to: string;
}

/** 주소에 기간이 없을 때의 값. 「아직 조회하지 않았다」로 읽히는 자리다. */
export const EMPTY_PERIOD: BusinessPeriod = { from: '', to: '' };

/** 계약이 쓰는 쿼리 이름. 날짜를 그대로 보낸다 — 계약이 `date`(YYYY-MM-DD)를 요구한다. */
export interface BusinessPeriodQuery {
  businessDateFrom: string;
  businessDateTo: string;
}

/**
 * 기간 판정의 결과. **두 갈래뿐이고 둘 다 무엇을 해야 할지 말한다** —
 * 조회할 수 있으면 보낼 쿼리를, 없으면 사용자가 고칠 사유를 담는다.
 */
export type BusinessPeriodState =
  { kind: 'ready'; query: BusinessPeriodQuery } | { kind: 'blocked'; reason: string };

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

const formatDate = (at: Date): string =>
  `${pad(at.getFullYear(), 4)}-${pad(at.getMonth() + 1, 2)}-${pad(at.getDate(), 2)}`;

/**
 * 자릿수가 맞고 **실제로 있는 날짜**인가.
 *
 * 자릿수만 보면 `2026-02-31`·`2026-13-01`이 통과해 그대로 요청에 실리고, 서버가 400을
 * 돌려주면 사용자에게는 「조회가 늘 실패한다」로만 보인다. 실존 판정까지 해야 화면이
 * 보내기 전에 막는다.
 *
 * 실존 판정은 **되짚기**로 한다 — 만든 날짜의 해·달·일이 넣은 값과 같으면 그 날짜가 있는
 * 것이다. `Date`가 넘치는 값을 다음 달로 굴리므로(2월 31일 → 3월 3일) 되짚으면 달라진다.
 * 인자를 전부 주므로 실행 환경의 시각을 읽지 않는다.
 *
 * **현지 날짜로 만든다**(`new Date('2026-08-06')`을 쓰지 않는다) — 그 형태는 UTC 자정으로
 * 읽혀 한국 시간대에서 하루 앞의 날짜가 된다(`expiry.ts`와 같은 이유).
 */
export const isBusinessDate = (value: string): boolean => {
  const matched = DATE_PATTERN.exec(value);

  if (matched === null) return false;

  const [year, month, day] = [Number(matched[1]), Number(matched[2]), Number(matched[3])];
  const made = new Date(year, month - 1, day);

  return made.getFullYear() === year && made.getMonth() === month - 1 && made.getDate() === day;
};

/**
 * 조회할 수 있는 기간인지 판정하고, 할 수 있으면 보낼 쿼리를 함께 돌려준다.
 *
 * 순서가 뜻을 정한다 — **깨진 날짜가 뒤집힘보다 앞선다.** 없는 날짜를 「순서를 바꾸세요」로
 * 말하면 사용자가 순서를 바꿔도 여전히 조회되지 않는다.
 *
 * 형식이 깨진 값은 **비어 있는 것과 같이** 다룬다. 두 갈래를 가르면 사용자가 할 조치는
 * 같은데(다시 고르세요) 문구만 둘이 된다 — `<input type="date">`는 깨진 값을 만들지 못하고,
 * 그 값이 오는 경로는 주소를 손으로 고친 경우뿐이다.
 */
export const resolveBusinessPeriod = (period: BusinessPeriod): BusinessPeriodState => {
  if (!isBusinessDate(period.from) || !isBusinessDate(period.to)) {
    return { kind: 'blocked', reason: t.reasons.historyNeedsPeriod };
  }

  /* 자릿수가 고정된 `YYYY-MM-DD`라 문자열 비교가 곧 날짜 비교다. */
  if (period.to < period.from) {
    return { kind: 'blocked', reason: t.reasons.historyPeriodReversed };
  }

  return { kind: 'ready', query: { businessDateFrom: period.from, businessDateTo: period.to } };
};

/**
 * 오늘을 마지막 날로 둔 최근 `DEFAULT_HISTORY_MONTHS`개월.
 *
 * **달의 마지막 날을 넘기지 않는다.** 3월 31일에서 달만 하나 빼면 2월 31일이 되고 `Date`가
 * 그것을 3월 3일로 굴려, 「최근 1개월」이 28일짜리 기간이 된다. 목표 달의 마지막 날로 눌러
 * 실제로 한 달이 되게 한다.
 */
export const defaultBusinessPeriod = (today: Date): BusinessPeriod => {
  const year = today.getFullYear();
  const month = today.getMonth() - DEFAULT_HISTORY_MONTHS;

  /* 그 달의 마지막 날 — 다음 달 0일이 곧 이번 달 마지막 날이다. `Date`가 해 경계도 넘겨 준다. */
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const from = new Date(year, month, Math.min(today.getDate(), lastDayOfMonth));

  return { from: formatDate(from), to: formatDate(today) };
};
