/**
 * PDA 시각 표시의 기준 시간대 — **공장 시각(베트남, UTC+7)**. 관리웹 `apps/web/src/patterns/plant-time.ts` 와 같은 값이다.
 *
 * 서버는 시각을 UTC(`…Z`)로 보낸다. 기기 시간대로 그리면 기기 설정에 따라 시각이 달라진다(G1 — PDA 「앞서 등록」 ·
 * M-01-03 시각이 브라우저 현지 시각이었다). 두 공장(PL11·PL13) 모두 이 시간대라 상수 하나로 둔다.
 */
export const PLANT_TIME_ZONE = 'Asia/Ho_Chi_Minh';

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
  /** `2026-11-11` */
  date: string;
  /** `08:05` */
  time: string;
}

/** 시각이 있는 값을 공장 시각의 날짜 · 시각으로 — 읽지 못하면 null. */
export const toPlantParts = (
  value: string | Date | null | undefined,
): PlantDateTimeParts | null => {
  if (value === null || value === undefined) return null;

  const at = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(at.getTime())) return null;

  const parts = formatter.formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((entry) => entry.type === type)?.value ?? '';

  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
  };
};

/** 「08:05」(공장 시각). 읽지 못하면 빈 글. */
export const plantClock = (value: string | null | undefined): string =>
  toPlantParts(value)?.time ?? '';

/** 「11-11 08:05」(공장 시각). 읽지 못하면 받은 그대로. */
export const plantShortDateTime = (value: string | null | undefined): string => {
  const parts = toPlantParts(value);

  return parts === null ? (value ?? '') : `${parts.date.slice(5)} ${parts.time}`;
};

/** 「2026-11-11 08:05」(공장 시각). 읽지 못하면 받은 그대로. */
export const plantDateTime = (value: string | null | undefined): string => {
  const parts = toPlantParts(value);

  return parts === null ? (value ?? '') : `${parts.date} ${parts.time}`;
};

/** 공장 달력의 오늘(`YYYY-MM-DD`) — 업무일자는 기기가 아니라 공장 날짜다. */
export const plantToday = (now: Date = new Date()): string =>
  toPlantParts(now)?.date ?? now.toISOString().slice(0, 10);
