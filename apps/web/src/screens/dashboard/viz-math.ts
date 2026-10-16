/**
 * 대시보드 그림 부품의 계산(⭐ 사용자 지시 2026-10-16, 시안 v1.3 기준 재구성).
 *
 * 디자인 시스템 차트에 없는 표현 — 순위 막대 · 100% 누적 막대 · 파레토 · 빈 날을 끊는 여러 계열
 * 꺾은선 — 을 이 화면 안에서 그린다. 그리는 부품(`viz.tsx`)과 계산을 나눠 계산만 따로 시험한다.
 */

export interface NamedQty {
  key: string;
  label: string;
  value: number;
}

export interface ShareRow extends NamedQty {
  /** 전체 중 비율(0~100). 합이 0이면 0. */
  share: number;
  /** 가장 큰 값 대비 길이(0~100) — 순위 막대의 길이. */
  length: number;
}

/**
 * 순위 막대 · 누적 막대의 줄. **받은 순서를 지킨다** — 서버가 이미 많은 순으로 준다. 화면이 다시
 * 정렬하면 같은 값일 때 서버와 다른 차례가 선다.
 */
export const toShareRows = (entries: readonly NamedQty[]): ShareRow[] => {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.value), 0);
  const max = entries.reduce((top, entry) => Math.max(top, entry.value), 0);

  return entries.map((entry) => ({
    ...entry,
    share: total === 0 ? 0 : (Math.max(0, entry.value) / total) * 100,
    length: max <= 0 ? 0 : (Math.max(0, entry.value) / max) * 100,
  }));
};

export interface ParetoRow extends ShareRow {
  /** 이 줄까지의 누적 비율(0~100). */
  cumulative: number;
  /** 누적 80%에 닿기까지의 줄(80%를 넘기는 첫 줄 포함) — 진하게 칠한다. */
  vital: boolean;
}

/** 파레토 기준선. */
export const PARETO_THRESHOLD = 80;

/**
 * 파레토 줄 — 많은 순으로 받는다고 가정한다(서버 규격 「많은 순 전부」). 80%에 닿는 줄까지가
 * 「핵심 소수」다: 앞 줄들의 누적이 아직 80% 미만이면 그 줄도 핵심에 든다.
 */
export const toParetoRows = (entries: readonly NamedQty[]): ParetoRow[] => {
  const rows = toShareRows(entries);
  let running = 0;

  return rows.map((row) => {
    const before = running;
    running += row.share;

    return { ...row, cumulative: running, vital: row.share > 0 && before < PARETO_THRESHOLD };
  });
};

export interface SeriesPoint {
  label: string;
  value: number | null;
}

/**
 * 꺾은선을 그릴 구간들. **값이 없는 날에서 선을 끊는다** — 이어 그리면 검사가 없던 날을 건너뛴
 * 기울기가 실제 추세처럼 읽힌다. 각 구간은 x 위치(인덱스)와 값의 쌍이다.
 */
export const toLineSegments = (
  points: readonly SeriesPoint[],
): { index: number; value: number }[][] => {
  const segments: { index: number; value: number }[][] = [];
  let current: { index: number; value: number }[] = [];

  points.forEach((point, index) => {
    if (point.value === null) {
      if (current.length > 0) segments.push(current);
      current = [];
      return;
    }
    current.push({ index, value: point.value });
  });
  if (current.length > 0) segments.push(current);

  return segments;
};

/**
 * 합격률 꺾은선의 y 범위. 값이 몰린 띠를 넓혀 보이도록 **최소값 아래로 내려 잡되 0~100을 넘지 않는다.**
 * 값이 하나도 없으면 0~100.
 */
export const toRateDomain = (values: readonly (number | null)[]): { min: number; max: number } => {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return { min: 0, max: 100 };

  const low = Math.min(...present);
  const high = Math.max(...present);
  const pad = Math.max(1, (high - low) * 0.2);

  return {
    min: Math.max(0, Math.floor(low - pad)),
    max: Math.min(100, Math.ceil(high + pad)),
  };
};
