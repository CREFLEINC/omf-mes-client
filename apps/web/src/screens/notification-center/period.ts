import { messages } from '@omf-mes/i18n';

/**
 * 알림 발생 기간 — 이 화면에서 **없으면 조회 자체가 불가능한** 조건이다.
 *
 * 계약이 `occurredFrom`·`occurredTo`를 **필수**로 두었고(실측: 생성 타입의 query에 `?`가 없다)
 * 자료형이 **`date-time`**이다. 이 둘이 다른 화면의 기간과 이 파일을 가르는 자리이며,
 * 전례를 그대로 베끼면 두 자리 모두 어긋난다. 무엇이 어떻게 다른지 적어 둔다.
 *
 * | 전례 | 그 화면에서 참인 이유 | 여기서 |
 * | --- | --- | --- |
 * | 「기본 기간을 심지 않는다」(`inbound-schedule/period.ts`) | 그 계약이 기간을 **선택**으로 두어 기간 없이도 조회된다 | ⛔ **거짓.** 심지 않으면 첫 진입에 조회할 수 없다 |
 * | 「시간대 변환이 없다」(`inbound-schedule/period.ts` · `stock-status/business-period.ts`) | 그 계약들이 **`date`**를 받는다 — 시각을 붙이면 서버가 경계를 다르게 자른다 | ⛔ **거짓.** `date-time`이라 날짜만 보내면 형식이 맞지 않는다 |
 * | 「깨진 기간은 조회하지 않고 사유를 보인다」(`stock-status/business-period.ts`) | 보내면 반드시 400이 되고, 조용히 고치면 무엇이 왜 달라졌는지 화면 어디에도 없다 | ✅ **참.** `blocked` 갈래를 그대로 쓴다 |
 *
 * 형태는 `integration-sync/period.ts`가 가장 가깝다 — 그쪽도 기간이 필수이고 `date-time`이며
 * 기본값을 주소에 심는다. **다만 그 파일의 날짜 검사는 자릿수만 본다**(`/^\d{4}-\d{2}-\d{2}$/`).
 * 그대로 가져오면 `2026-02-31`이 통과해 요청에 실리므로, 실존 판정은 `inbound-schedule/period.ts`
 * 쪽(되짚기)을 쓴다. **두 전례에서 한 조각씩 가져온 자리다.**
 *
 * **판정과 요청 만들기를 한 함수에 둔다**(`resolvePeriod`). 「막을지」와 「무엇을 보낼지」를
 * 따로 두면 한쪽만 고쳐져, 막지 않은 값이 요청에 실리거나 막았는데 사유가 없는 상태가 생긴다.
 *
 * **순수 함수만 둔다.** 함수 안에서 `new Date()`를 부르지 않는다 — 부르면 실행 환경의 시각·
 * 시간대에 따라 결과가 달라져 테스트가 환경을 검사하게 된다. 「오늘」과 「지금」은 호출부가 준다.
 *
 * 다른 화면 슬라이스에도 기간을 다루는 같은 이름의 파일이 있으나 가져다 쓰지 않는다 —
 * 쿼리 이름부터 다르고, 한쪽의 사정이 다른 화면을 끌고 가지 않아야 한다.
 */

const t = messages.notificationCenter;

/**
 * 기본 조회 기간(일). 화면 스펙이 「기본 최근 1주」로 정했다.
 *
 * **기간을 적는 자리는 여기 하나뿐이다.** 다른 값이 맞다고 정해지면 이 상수만 고친다.
 */
export const DEFAULT_PERIOD_DAYS = 7;

/**
 * 기간이 사는 주소 키. **다른 조건 키와 갈라 여기 둔다** — 기간은 이 화면에서 유일하게
 * 「풀 수 없는」 조건이라 수명이 다르다(비울 수 없고 늘 실린다).
 */
export const PERIOD_URL_KEYS = { from: 'from', to: 'to' } as const;

/** 화면이 받는 값. 날짜 컨트롤이 주는 `YYYY-MM-DD` 그대로다. */
export interface NotificationPeriod {
  from: string;
  to: string;
}

/** 서버로 보내는 값. **초와 시간대까지 갖춘 RFC3339다** — 계약이 `date-time`을 받는다. */
export interface PeriodQuery {
  occurredFrom: string;
  occurredTo: string;
}

/**
 * 기간 판정의 결과. **세 갈래이고 셋 다 화면이 무엇을 해야 할지 말한다.**
 *
 * `empty`가 `blocked`와 갈리는 것이 이 화면의 요점이다 — 주소에 기간이 아예 없는 것은
 * 사용자가 잘못한 것이 아니라 **아직 아무 말도 하지 않은 상태**이므로 기본값을 채운다.
 * 반대로 손으로 고쳐 깨진 값은 조용히 덮지 않는다. 덮으면 무엇이 왜 달라졌는지 화면
 * 어디에도 남지 않는다(공유계약 G-9 — 「없는 값」과 「틀린 값」을 같은 모양으로 두지 않는다).
 */
export type PeriodState =
  { kind: 'ready'; query: PeriodQuery } | { kind: 'empty' } | { kind: 'blocked'; reason: string };

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
 * 읽혀 UTC 동쪽 시간대에서 하루 앞의 날짜가 된다.
 */
const isCalendarDate = (value: string): boolean => {
  const matched = DATE_PATTERN.exec(value);

  if (matched === null) return false;

  const [year, month, day] = [Number(matched[1]), Number(matched[2]), Number(matched[3])];
  const made = new Date(year, month - 1, day);

  return made.getFullYear() === year && made.getMonth() === month - 1 && made.getDate() === day;
};

/** 주소가 담은 기간. **깨진 값도 그대로 읽는다** — 사용자가 무엇을 넣었는지 판정이 알아야 한다. */
export const readPeriod = (params: URLSearchParams): NotificationPeriod => ({
  from: params.get(PERIOD_URL_KEYS.from) ?? '',
  to: params.get(PERIOD_URL_KEYS.to) ?? '',
});

/**
 * 오늘을 마지막 날로 두고 `DEFAULT_PERIOD_DAYS`일치를 고른다 — **오늘을 포함해** 센다.
 * 달·해의 경계는 `Date`가 넘겨 준다(0일·음수 일자를 정상 날짜로 되돌린다).
 */
export const defaultPeriod = (today: Date): NotificationPeriod => {
  const from = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - (DEFAULT_PERIOD_DAYS - 1),
  );

  return { from: formatDate(from), to: formatDate(today) };
};

/**
 * 실행 환경이 UTC와 얼마나 떨어져 있는지. `+09:00` 꼴이다.
 *
 * 인자는 **UTC 기준 분**이다(한국은 +540). `Date.getTimezoneOffset()`은 부호가 반대라
 * 호출부에서 뒤집는다 — 그 뒤집기를 한 자리에만 두려고 이 함수는 이미 뒤집힌 값을 받는다.
 */
const offsetText = (offsetMinutes: number): string => {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const absolute = Math.abs(offsetMinutes);

  return `${sign}${pad(Math.floor(absolute / 60), 2)}:${pad(absolute % 60, 2)}`;
};

/**
 * 조회할 수 있는 기간인지 판정하고, 할 수 있으면 보낼 쿼리를 함께 돌려준다.
 *
 * 순서가 뜻을 정한다 — **빈 값이 가장 앞이고, 깨진 날짜가 뒤집힘보다 앞선다.**
 * 없는 날짜를 「순서를 바꾸세요」로 말하면 사용자가 순서를 바꿔도 여전히 조회되지 않는다.
 *
 * **한쪽만 채운 값은 깨진 것으로 다룬다.** 계약이 두 값을 함께 요구하므로 한쪽만으로는
 * 요청이 서지 않고, 빈 쪽을 화면이 지어 채우면 사용자가 넣은 쪽의 뜻까지 바뀐다.
 *
 * ⚠ **끝 경계는 계약이 말하지 않는다** — `occurredTo`가 이상인지 미만인지 적혀 있지 않다.
 * `23:59:59`로 두므로 서버가 「미만」으로 자르면 그날 마지막 1초의 알림이 빠질 수 있다.
 * 설계 저장소에 질문으로 올려 두었고, 답이 오면 이 함수 한 곳만 고친다.
 *
 * `now`는 **시간대를 읽기 위해서만** 쓴다 — 값 자체는 쿼리에 실리지 않는다. 인자로 받는
 * 이유는 이 함수가 실행 환경의 시각을 스스로 읽지 않기 위해서다(파일 머리의 순수성 규율).
 */
export const resolvePeriod = (period: NotificationPeriod, now: Date): PeriodState => {
  if (period.from === '' && period.to === '') return { kind: 'empty' };

  if (!isCalendarDate(period.from) || !isCalendarDate(period.to)) {
    return { kind: 'blocked', reason: t.reasons.periodInvalid };
  }

  /* 자릿수가 고정된 `YYYY-MM-DD`라 문자열 비교가 곧 날짜 비교다. */
  if (period.to < period.from) {
    return { kind: 'blocked', reason: t.reasons.periodReversed };
  }

  const zone = offsetText(-now.getTimezoneOffset());

  /*
   * **종료는 그날 23:59:59다.** 00:00:00으로 만들면 마지막 날에 온 알림이 통째로 빠져
   * 사용자에게는 「오늘 온 알림이 안 보인다」로 나타난다.
   */
  return {
    kind: 'ready',
    query: {
      occurredFrom: `${period.from}T00:00:00${zone}`,
      occurredTo: `${period.to}T23:59:59${zone}`,
    },
  };
};
