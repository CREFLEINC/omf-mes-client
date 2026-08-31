import { messages } from '@omf-mes/i18n';

/**
 * 이 화면의 조회 기간. **비울 수 없다**(공유계약 L-3 · 계약이 두 칸을 필수로 표시한다).
 * 무제한 조회를 열어 두면 비가동 기록이 쌓인 뒤 집계가 멎는다.
 *
 * ⭐ **끝 경계를 익일로 밀지 않는다.** 형제 화면들(`disposition-decision` 등)은 계약이
 * `date-time`을 받아 반열림 경계로 보내는데, **이 화면의 두 칸은 `date`다**(실측). 날짜만
 * 보내는 자리에 시각 규약을 옮겨 오면 하루가 통째로 밀린다.
 *
 * **순수 함수만 둔다.** 함수 안에서 `new Date()`로 「지금」을 읽지 않는다 — 읽으면 실행 환경의
 * 날짜에 따라 결과가 달라져 감지기가 환경을 검사하게 된다. 「오늘」은 호출부가 준다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.downtimeSummary;

/** 기본 기간의 길이. 착수 이슈가 「기본으로 최근 한 달」로 정했다. */
export const DEFAULT_PERIOD_DAYS = 30;

export interface PeriodInput {
  from: string;
  to: string;
}

/** 서버로 보내는 값. 계약이 `date`라 화면이 고른 `YYYY-MM-DD` 그대로다. */
export interface PeriodQuery {
  startedFrom: string;
  startedTo: string;
}

/**
 * 기간 판정의 결과. **두 갈래뿐이고 둘 다 화면이 무엇을 해야 할지 말한다.**
 *
 * 갈래를 나눈 덕에 **판정을 건너뛰고 요청만 만드는 것이 타입으로 불가능하다** — 두 모양이
 * 구조적으로 달라 컴파일러가 그 실수를 잡는다.
 */
export type PeriodState =
  { kind: 'ready'; query: PeriodQuery } | { kind: 'blocked'; reason: string };

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number, width: number): string => String(value).padStart(width, '0');

const formatDate = (date: Date): string =>
  `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;

/** 달력에 실재하는 날만 통과시킨다 — `2026-02-31`은 형태만 맞고 날이 아니다. */
export const isPeriodDate = (value: string): boolean => {
  const match = DATE_PATTERN.exec(value);
  if (match === null) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

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
 * 기간을 판정하고, 통과하면 요청 질의로 바꾼다.
 *
 * ⭐ **막는 사유를 세 갈래로 가른다** — 셋의 해법이 서로 다르다. 순서에도 뜻이 있다: 달력에 없는
 * 날을 「두 날짜를 바꾸세요」로 안내하면 바꿔도 풀리지 않는다.
 */
export const resolvePeriod = (input: PeriodInput): PeriodState => {
  if (input.from === '' || input.to === '') {
    return { kind: 'blocked', reason: t.filters.periodRequired };
  }

  if (!isPeriodDate(input.from) || !isPeriodDate(input.to)) {
    return { kind: 'blocked', reason: t.filters.periodInvalid };
  }

  /* 자릿수가 고정된 `YYYY-MM-DD`라 문자열 비교가 곧 날짜 비교다. */
  if (input.to < input.from) {
    return { kind: 'blocked', reason: t.filters.periodReversed };
  }

  return { kind: 'ready', query: { startedFrom: input.from, startedTo: input.to } };
};

/** 조회를 막는 사유만 필요할 때. 없으면 `null`. */
export const periodLockReason = (input: PeriodInput): string | null => {
  const state = resolvePeriod(input);

  return state.kind === 'blocked' ? state.reason : null;
};
