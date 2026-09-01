import type { components } from '@omf-mes/api-client';

/**
 * W-CO-05가 다루는 모양들.
 *
 * **계약이 준 것을 그대로 나른다.** 이 화면은 카드 목록을 스스로 정하지 않는다 — 어떤 지표를
 * 보일지는 서버가 정하고 화면은 받은 카드를 순서대로 그린다. 그래서 여기에 「지표 이름 목록」
 * 상수가 없다. 카드가 늘어도 이 파일은 바뀌지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type DashboardSummary = components['schemas']['DashboardSummary'];
type DashboardCard = components['schemas']['DashboardCard'];
type Notification = components['schemas']['Notification'];

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

/** 값을 낼 수 있는가. 계약의 세 갈래를 그대로 쓴다 — 화면이 갈래를 새로 만들지 않는다. */
export type CardValueStatus = DashboardCard['valueStatusCode'];

export interface DashboardCardView {
  cardCode: string;
  label: string;
  value: number;
  unit: string | null;
  /** 직전 기준일 대비 비율. 비교 대상이 없으면 `null`이다 — 0과 다르다. */
  deltaRatio: number | null;
  /** 카드 아래 본문 한 줄. ⛔ 툴팁이 아니다 — 분모가 온전하지 않으면 그 사실이 여기 온다. */
  note: string | null;
  valueStatusCode: CardValueStatus;
  /** 분모에서 뺀 건수. `PARTIAL`일 때 함께 보인다. */
  excludedCount: number | null;
}

export interface DashboardTrendPointView {
  label: string;
  value: number;
}

export interface DashboardTrendView {
  seriesName: string | null;
  unit: string | null;
  /** 목표선. 없으면 `null`이라 선을 긋지 않는다 — 0으로 채우면 바닥에 선이 그어진다. */
  targetValue: number | null;
  points: DashboardTrendPointView[];
  asOfText: string | null;
}

export interface DashboardAlertView {
  notificationId: number;
  eventCode: string;
  message: string;
  occurredAt: string;
  occurredAtText: string;
  read: boolean;
  /** 알람 위치는 **계층 텍스트**다(예: 「공장 > 라인 > 설비」). 평면 배치·도면 구획을 쓰지 않는다. */
  locationPath: string | null;
}

export interface DashboardView {
  baseDate: string;
  plantId: number | null;
  cards: DashboardCardView[];
  alerts: DashboardAlertView[];
  /** 계약이 추이를 선택으로 두어 아예 오지 않을 수 있다 — 「없음」을 값으로 낸다. */
  trend: DashboardTrendView | null;
  asOfText: string | null;
}

/**
 * 서버가 준 집계 기준 시각을 「YYYY-MM-DD HH:mm」으로 자른다.
 *
 * ⭐ **옮기지 않고 자른다.** 이 값은 *서버가 언제까지 세었는가*라 보내는 쪽의 벽시계가 정본이다 —
 * 보는 사람의 시간대로 옮기면 같은 집계가 사람마다 다른 시각으로 보인다. `notification-center`의
 * 발생 시각과 같은 규율이고, 「내가 언제 받았는가」(그쪽 `as-of.ts`)와는 반대다.
 *
 * 모양이 다르면 `null`이다 — 알아볼 수 없는 값을 그럴듯하게 잘라 내면 틀린 시각이 조용히 선다.
 */
const RFC3339_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

export const formatAsOf = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) return null;

  const matched = RFC3339_PATTERN.exec(value);

  if (matched === null) return null;

  return `${matched[1] ?? ''} ${matched[2] ?? ''}`;
};

/** 천 단위 자리 구분. 정수부에만 건다. */
const groupThousands = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * 지표 값의 표기. **소수 첫째 자리까지만 낸다.**
 *
 * 카드는 자릿수를 늘려 읽는 자리가 아니다 — 「97.234%」는 「97.2%」보다 정확하지만 나란히 선
 * 카드 다섯을 견주기는 더 어렵다. 자리를 늘려야 하면 소유 화면으로 간다.
 *
 * 끝자리가 0이면 소수점을 떼고 정수로 낸다 — 「12,480.0 EA」는 생산량을 잰 정밀도를 잘못 말한다.
 */
export const formatFigure = (value: number): string => {
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
 * 추이 그래프의 y축 상한.
 *
 * ⭐ **목표가 실적보다 높으면 그 목표까지 눈금을 넓힌다.** 디자인 시스템 차트는 상한을 주지
 * 않으면 **데이터 최대값**을 상한으로 잡는데, 그러면 목표선이 그림 밖으로 나가 **그어지지
 * 않는다** — 브라우저 확인에서 실제로 그랬다(실적 2,850 · 목표 3,000이었는데 눈금이 2,850에서
 * 끝났다). 사용자에게는 「목표선이 없는 그래프」로 보이고, 목표를 못 채운 날일수록 그렇게 된다.
 *
 * 목표가 실적 안쪽이면 `undefined`를 낸다 — 그때는 차트의 자동 계산이 더 좋은 눈금을 잡는다.
 */
export const toChartMax = (
  points: readonly DashboardTrendPointView[],
  targetValue: number | null,
): number | undefined => {
  if (targetValue === null || points.length === 0) return undefined;

  const dataMax = points.reduce((max, point) => Math.max(max, point.value), points[0]?.value ?? 0);

  return targetValue > dataMax ? targetValue : undefined;
};

const toCardView = (source: DashboardCard): DashboardCardView => ({
  cardCode: source.cardCode,
  label: source.label,
  value: source.value,
  unit: source.unit ?? null,
  deltaRatio: source.deltaRatio ?? null,
  note: source.note ?? null,
  valueStatusCode: source.valueStatusCode,
  excludedCount: source.excludedCount ?? null,
});

const toAlertView = (source: Notification): DashboardAlertView => ({
  notificationId: source.notificationId,
  eventCode: source.eventCode,
  message: source.message,
  occurredAt: source.occurredAt,
  occurredAtText: formatAsOf(source.occurredAt) ?? source.occurredAt,
  read: source.read,
  locationPath: source.locationPath ?? null,
});

/**
 * 집계 응답 하나를 화면이 쓰는 모양으로 옮긴다.
 *
 * **없는 것을 지어내지 않는다** — 추이가 오지 않으면 `null`이고, 목표선이 없으면 `null`이다.
 * 빈 배열과 「오지 않았다」를 같은 모양으로 그리면 사용자가 「추이가 0이다」로 읽는다.
 */
export const toDashboardView = (source: DashboardSummary): DashboardView => ({
  baseDate: source.baseDate,
  plantId: source.plantId ?? null,
  cards: source.cards.map(toCardView),
  alerts: (source.alerts ?? []).map(toAlertView),
  trend:
    source.trend === undefined
      ? null
      : {
          seriesName: source.trend.seriesName ?? null,
          unit: source.trend.unit ?? null,
          targetValue: source.trend.targetValue ?? null,
          points: source.trend.points.map((point) => ({
            label: point.label,
            value: point.value,
          })),
          asOfText: formatAsOf(source.trend.asOf),
        },
  asOfText: formatAsOf(source.asOf),
});
