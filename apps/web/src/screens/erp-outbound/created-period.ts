import type { PeriodInput } from '../integration-sync/period';

/**
 * 송신 예정의 생성일 조건(사용자 지시 2026-10-28 — 「일주일 · 한 달을 바로 고르는 단추와 임의 범위」).
 *
 * 순수 함수만 둔다 — 「오늘」은 부르는 쪽이 준다. 기간 검증과 서버 형식(RFC3339 · 공장 시각)은 연동 현황·이력과 같은
 * `integration-sync/period.ts` 를 쓴다.
 */

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

/** `YYYY-MM-DD` — 화면의 날짜 칸이 주고받는 모양. */
export const formatDate = (date: Date): string =>
  `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;

/** 바로 고르는 범위 — 오늘을 포함해 센다. */
export type CreatedPreset = 'week' | 'month';

export const presetPeriod = (preset: CreatedPreset, today: Date): PeriodInput => {
  const from =
    preset === 'week'
      ? /* 오늘 포함 7일 — 10-28 이면 10-22 부터. */
        new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)
      : /*
         * 오늘 포함 한 달 — 지난달 같은 날의 다음 날부터(10-28 이면 09-29). 지난달에 그날이 없으면 그 달 말일로
         * 맞춘다 — 03-31 이면 02-28 의 다음 날인 03-01 부터(`Date` 에 맡기면 03-04 로 밀린다).
         */
        new Date(
          today.getFullYear(),
          today.getMonth() - 1,
          Math.min(today.getDate(), new Date(today.getFullYear(), today.getMonth(), 0).getDate()) +
            1,
        );

  return { from: formatDate(from), to: formatDate(today) };
};

/** 걸린 기간이 바로 고르는 범위 중 하나와 같으면 그 이름 — 그 단추를 눌린 채로 보인다. */
export const presetOf = (period: PeriodInput | null, today: Date): CreatedPreset | null => {
  if (period === null) return null;
  const same = (preset: CreatedPreset) => {
    const candidate = presetPeriod(preset, today);
    return candidate.from === period.from && candidate.to === period.to;
  };

  return same('week') ? 'week' : same('month') ? 'month' : null;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 주소의 기간 — 둘 다 날짜일 때만 건다. 하나라도 없거나 깨졌으면 기간 없이(전체) 본다. */
export const readCreatedPeriod = (params: URLSearchParams): PeriodInput | null => {
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';

  return DATE_PATTERN.test(from) && DATE_PATTERN.test(to) && from <= to ? { from, to } : null;
};
