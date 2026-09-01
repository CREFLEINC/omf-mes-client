import type { components } from '@omf-mes/api-client';

import type { GroupBy } from './filters';

/**
 * W-05-08이 다루는 모양들.
 *
 * ⭐ **탭 셋이 같은 응답의 서로 다른 배열을 읽는다.** 서버는 요청한 묶음 축의 배열 **하나만**
 * 채우므로, 화면은 「지금 탭에 해당하는 배열」을 골라 같은 표로 그린다. 세 표를 따로 만들면
 * 같은 열(건수·합계·평균·비중)을 세 벌 유지하게 된다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type DowntimeSummary = components['schemas']['DowntimeSummary'];
type Downtime = components['schemas']['Downtime'];

export interface PageMeta {
  page: number;
  size: number;
  total: number;
}

export interface LookupEntry {
  value: string;
  label: string;
  isActive: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * 분포 표의 한 줄. **세 탭이 같은 모양을 쓴다.**
 *
 * `label`은 사람이 읽는 이름이고 `code`는 그 줄을 가리키는 값이다. 추이 탭에는 코드가 따로
 * 없어 구간 시작일이 둘 다를 겸한다 — 없는 칸을 만들어 비워 두지 않는다.
 */
export interface DistributionRow {
  key: string;
  label: string;
  count: number;
  totalMinutes: number;
  /** 서버가 내지 않으면 `null`이다 — ⛔ 0으로 채우지 않는다. */
  averageMinutes: number | null;
  sharePercent: number | null;
}

export interface DowntimeSummaryView {
  operatingMinutes: number;
  /** 작업 캘린더가 정한다 — 이 조회가 만드는 값이 아니다. */
  plannedDowntimeMinutes: number | null;
  actualDowntimeMinutes: number;
  /** 조업 시간이 0이면 분모가 없어 `null`이다. ⛔ 0%로 그리면 「하루 종일 섰다」로 읽힌다. */
  availabilityPercent: number | null;
  openIntervalCount: number;
  overlappingIntervalCount: number;
  minorStopCount: number | null;
  minorStopMinutes: number | null;
  /** 경미 정지 판정에 쓴 임계. 화면이 정하지 않고 응답이 준 값을 문구에 그대로 쓴다. */
  minorStopThresholdMinutes: number | null;
  sessionsWithoutEquipmentCount: number | null;
  correctiveMaintenanceCount: number | null;
  preventiveMaintenanceCount: number | null;
  breakdownsClosedWithoutOrderCount: number | null;
  rows: DistributionRow[];
}

export interface DowntimeIntervalView {
  downtimeId: number;
  equipmentCode: string | null;
  reasonCode: string;
  reasonName: string | null;
  startedAt: string;
  /** 비어 있으면 아직 진행 중이다. */
  endedAt: string | null;
  durationMinutes: number | null;
}

/** 천 단위 자리 구분. 분·건수처럼 정수로 세는 값에 쓴다. */
const groupThousands = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * 정수 표기. 분과 건수가 함께 쓴다.
 *
 * 서버가 소수를 줄 수 있는 칸(평균·비중)은 이 함수를 쓰지 않는다 — 여기서 잘라 내면 「74.8분」이
 * 「75분」이 되어 원래보다 정확해 보이는 값이 된다.
 */
export const formatCount = (value: number): string => groupThousands(String(Math.round(value)));

/**
 * 소수 첫째 자리까지의 표기. 평균 분·비중·가동률이 함께 쓴다.
 *
 * 끝자리가 0이면 소수점을 떼고 정수로 낸다 — 「40.0%」는 잰 정밀도를 잘못 말한다.
 */
export const formatDecimal = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  const whole = Math.trunc(abs);
  const fraction = Math.round((abs - whole) * 10);

  return fraction === 0
    ? `${sign}${groupThousands(String(whole))}`
    : `${sign}${groupThousands(String(whole))}.${String(fraction)}`;
};

/**
 * 분을 「H시간 M분」으로 읽어 준다. 합계가 수천 분이 되면 분 하나로는 크기가 안 잡힌다.
 *
 * ⛔ **분 표기를 대체하지 않고 곁들인다** — 원래 값이 분이므로 그 수는 그대로 두고 읽기를 돕는다.
 * 60분 미만이면 시간 부분을 만들지 않는다(「0시간 32분」은 시간 칸이 있다는 오해를 준다).
 */
export const formatDuration = (minutes: number): string => {
  const total = Math.round(minutes);
  const hours = Math.trunc(total / 60);
  const rest = total % 60;

  if (hours === 0) return `${formatCount(rest)}분`;
  if (rest === 0) return `${formatCount(hours)}시간`;

  return `${formatCount(hours)}시간 ${String(rest)}분`;
};

const nullable = (value: number | null | undefined): number | null => value ?? null;

/**
 * 지금 탭에 해당하는 배열 하나를 표의 줄로 옮긴다.
 *
 * ⭐ **묶음 축이 채우지 않은 배열은 아예 읽지 않는다.** 서버가 하나만 채우므로 셋을 합치면
 * 직전 탭의 줄이 남아 새 탭에 섞인다.
 */
export const toDistributionRows = (
  source: DowntimeSummary,
  groupBy: GroupBy,
): DistributionRow[] => {
  switch (groupBy) {
    case 'REASON':
      return (source.byReason ?? []).map((row) => ({
        key: row.reasonCode,
        /* 이름이 오지 않으면 코드를 그대로 보인다 — 「이름 없음」으로 바꾸면 담당자에게 전할 단서가 사라진다. */
        label:
          row.reasonName === undefined || row.reasonName === '' ? row.reasonCode : row.reasonName,
        count: row.count,
        totalMinutes: row.totalMinutes,
        averageMinutes: nullable(row.averageMinutes),
        sharePercent: nullable(row.sharePercent),
      }));
    case 'EQUIPMENT':
      return (source.byEquipment ?? []).map((row) => ({
        key: String(row.equipmentId),
        label:
          row.equipmentName === undefined || row.equipmentName === null || row.equipmentName === ''
            ? row.equipmentCode
            : `${row.equipmentCode} · ${row.equipmentName}`,
        count: row.count,
        totalMinutes: row.totalMinutes,
        averageMinutes: nullable(row.averageMinutes),
        sharePercent: nullable(row.sharePercent),
      }));
    case 'PERIOD':
      return (source.byPeriod ?? []).map((row) => ({
        key: row.periodStart,
        label: row.periodStart,
        count: row.count,
        totalMinutes: row.totalMinutes,
        /* 추이 칸에는 평균·비중이 없다. 만들어 내지 않는다. */
        averageMinutes: null,
        sharePercent: null,
      }));
  }
};

export const toSummaryView = (source: DowntimeSummary, groupBy: GroupBy): DowntimeSummaryView => ({
  operatingMinutes: source.operatingMinutes,
  plannedDowntimeMinutes: nullable(source.plannedDowntimeMinutes),
  actualDowntimeMinutes: source.actualDowntimeMinutes,
  availabilityPercent: nullable(source.availabilityPercent),
  openIntervalCount: source.openIntervalCount,
  overlappingIntervalCount: source.overlappingIntervalCount,
  minorStopCount: nullable(source.minorStopCount),
  minorStopMinutes: nullable(source.minorStopMinutes),
  minorStopThresholdMinutes: nullable(source.minorStopThresholdMinutes),
  sessionsWithoutEquipmentCount: nullable(source.sessionsWithoutEquipmentCount),
  correctiveMaintenanceCount: nullable(source.correctiveMaintenanceCount),
  preventiveMaintenanceCount: nullable(source.preventiveMaintenanceCount),
  breakdownsClosedWithoutOrderCount: nullable(source.breakdownsClosedWithoutOrderCount),
  rows: toDistributionRows(source, groupBy),
});

const RFC3339_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

/**
 * 서버가 준 시각을 「YYYY-MM-DD HH:mm」으로 자른다.
 *
 * ⭐ **옮기지 않고 자른다.** 이 값은 현장에서 설비가 선 시각이라 기록한 쪽의 벽시계가 정본이다 —
 * 보는 사람의 시간대로 옮기면 같은 구간이 사람마다 다른 시각으로 보인다.
 * 알아볼 수 없으면 원문을 그대로 낸다 — 잘라 내지 못한 값을 감추면 되짚을 단서가 사라진다.
 */
export const formatMoment = (value: string): string => {
  const matched = RFC3339_PATTERN.exec(value);

  if (matched === null) return value;

  return `${matched[1] ?? ''} ${matched[2] ?? ''}`;
};

export const toIntervalView = (source: Downtime): DowntimeIntervalView => ({
  downtimeId: source.downtimeId,
  equipmentCode: source.equipmentCode ?? null,
  reasonCode: source.reasonCode,
  reasonName: source.reasonName ?? null,
  startedAt: source.startedAt,
  endedAt: source.endedAt ?? null,
  durationMinutes: nullable(source.durationMinutes),
});
