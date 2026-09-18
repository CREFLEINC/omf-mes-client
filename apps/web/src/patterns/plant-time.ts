/**
 * 관리웹 일시 표시의 기준 시간대 — **공장 시각(베트남, UTC+7)**.
 *
 * 서버는 시각을 UTC(`…Z`)로 보낸다(`toISOString()`). 글자를 잘라 보이면 공장 시각보다 7시간
 * 이르게 찍힌다(omf-all-around#20). 두 공장(PL11·PL13) 모두 이 시간대라 상수 하나로 둔다.
 */
export const PLANT_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** 날짜 + 시각(분까지). 뒤따르는 초·소수 초·offset 은 있어도 없어도 된다. */
const DATE_TIME_PATTERN =
  /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/;

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PLANT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export interface PlantDateTimeParts {
  /** `2026-09-18` */
  date: string;
  /** `21:07` */
  time: string;
}

/**
 * 시각이 있는 값을 공장 시각의 날짜·시각으로 나눈다. **표시 전용**이다.
 *
 * - `Z`·`+07:00`·`+09:00` 등 offset 이 붙은 값은 그 순간을 공장 시각으로 바꾼다 — 같은 순간이면
 *   어느 offset 으로 와도 같은 결과다.
 * - offset 이 없는 값(`2026-09-18T09:10`)은 이미 벽시계 시각으로 보고 글자를 그대로 쓴다.
 * - ⛔ **날짜만 있는 값(`YYYY-MM-DD` — 업무일자·유효일)은 다루지 않는다(`null`).** 시간대를
 *   적용하면 하루가 밀린다. 형식이 아니거나 읽을 수 없는 값도 `null` — 부르는 쪽이 기존처럼
 *   원문이나 「—」로 둔다.
 */
export const toPlantDateTimeParts = (
  value: string | null | undefined,
): PlantDateTimeParts | null => {
  if (value === null || value === undefined) return null;

  const matched = DATE_TIME_PATTERN.exec(value.trim());
  if (matched === null) return null;

  const [, date = '', time = '', offset] = matched;
  if (offset === undefined) return { date, time };

  const instant = new Date(value.trim());
  if (Number.isNaN(instant.getTime())) return null;

  const parts = formatter.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((entry) => entry.type === type)?.value ?? '';

  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
  };
};

/** `2026-09-18 21:07`(공장 시각). 시각이 있는 값이 아니면 `null`. */
export const formatPlantDateTime = (value: string | null | undefined): string | null => {
  const parts = toPlantDateTimeParts(value);

  return parts === null ? null : `${parts.date} ${parts.time}`;
};
