import type {
  DashboardLotCounts,
  DashboardQuality,
  DashboardQualityTypeBlock,
  DashboardRecentLot,
} from '@omf-mes/api-client';

/**
 * 품질 현황(omf-all-around#113)이 다루는 계산.
 *
 * ⭐ **합격률은 서버가 낸다**(최종 판정 기준 · 보류 제외 · 모수 0이면 `null`). 화면은 LOT 건수로
 * 합격률을 다시 계산하지 않는다 — 회차 · 재검사 규칙을 두 벌 두게 된다.
 */

export type QualityKind = 'IQC' | 'PQC' | 'OQC';

export const QUALITY_KINDS: readonly QualityKind[] = ['IQC', 'PQC', 'OQC'];

export const blockOf = (quality: DashboardQuality, kind: QualityKind): DashboardQualityTypeBlock =>
  kind === 'IQC' ? quality.iqc : kind === 'PQC' ? quality.pqc : quality.oqc;

/** 세 유형의 LOT 건수를 더한다 — 「금일 검사 LOT」은 유형을 가리지 않는 한 칸이다. */
export const sumLots = (counts: readonly DashboardLotCounts[]): DashboardLotCounts =>
  counts.reduce(
    (sum, entry) => ({
      accepted: sum.accepted + entry.accepted,
      rejected: sum.rejected + entry.rejected,
      held: sum.held + entry.held,
    }),
    { accepted: 0, rejected: 0, held: 0 },
  );

export const lotTotal = (counts: DashboardLotCounts): number =>
  counts.accepted + counts.rejected + counts.held;

/** `2026-10-16` → `10-16`. 축 글자는 짧아야 아홉 날이 한 줄에 선다. 모양이 다르면 그대로. */
export const shortDate = (date: string): string =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(5) : date;

/**
 * 단일 유형 일별 합격률 그래프의 점. **합격률이 없는 날은 뺀다** — 차트가 빈 값을 받지 못하고,
 * 0으로 채우면 그날 합격률이 0%로 떨어진 것으로 읽힌다.
 */
export const toDailyPoints = (
  block: DashboardQualityTypeBlock,
): { label: string; value: number }[] =>
  block.dailyPassRates.flatMap((entry) =>
    entry.passRate === null ? [] : [{ label: shortDate(entry.date), value: entry.passRate }],
  );

export interface DailyRateRow {
  date: string;
  rates: Record<QualityKind, number | null>;
}

/**
 * 품질 종합의 일별 합격률 — 세 유형을 날짜 한 줄에 놓는다. 날짜는 IQC → PQC → OQC 순으로 처음
 * 나온 차례를 따른다(규격상 셋 다 같은 아홉 날이다). 어느 유형에 그 날이 없으면 그 칸은 `null`이다.
 */
export const toDailyRateRows = (quality: DashboardQuality): DailyRateRow[] => {
  const rows = new Map<string, DailyRateRow>();

  for (const kind of QUALITY_KINDS) {
    for (const entry of blockOf(quality, kind).dailyPassRates) {
      const row = rows.get(entry.date) ?? {
        date: entry.date,
        rates: { IQC: null, PQC: null, OQC: null },
      };
      row.rates[kind] = entry.passRate;
      rows.set(entry.date, row);
    }
  }

  return [...rows.values()];
};

export interface RecentLotRow extends DashboardRecentLot {
  kind: QualityKind;
}

/** 품질 종합의 최근 판정 — 세 유형을 합쳐 **최근 것부터** 다섯 건. */
export const toRecentLotRows = (quality: DashboardQuality, limit = 5): RecentLotRow[] =>
  QUALITY_KINDS.flatMap((kind) =>
    blockOf(quality, kind).recentLots.map((lot) => ({ ...lot, kind })),
  )
    .sort((a, b) => Date.parse(b.inspectedAt) - Date.parse(a.inspectedAt))
    .slice(0, limit);
