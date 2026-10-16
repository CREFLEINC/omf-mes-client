import { Chip, Skeleton } from '@crefle/web-ui';
import type { DashboardProduction } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { cardPathOf, type CardRouteTable } from './card-routes';
import { toDelta } from './delta';
import type { EquipmentView } from './equipment';
import { EQUIPMENT_STATUS_TONE } from './equipment-panel';
import { formatFigure, type DashboardCardView } from './types';
import { KpiTile } from './viz';

const t = messages.dashboard;
const k = messages.dashboard.kpi;

/** KPI 띠 본 칸에 자리가 정해진 카드. 나머지(양품률 · OEE · 미처리 알람 · 앞으로 늘 카드)는 보조 열로 간다. */
const MAIN_CARDS = ['AVAILABILITY_RATE', 'PRODUCTION_QTY'] as const;
/** 보조 열의 차례 — 시안의 「평균 C/T 달성」 자리에 성능률(표준 C/T 기준)이 먼저 선다. */
const AUX_ORDER = ['PERFORMANCE_RATE', 'YIELD_RATE', 'OEE', 'UNHANDLED_ALARM'];

/** 카드 값의 표기. ⛔ 값을 낼 수 없는 카드를 0으로 그리지 않는다 — 0은 「가동하지 않았다」로 읽힌다. */
export const cardValueText = (card: DashboardCardView | undefined): string => {
  if (card === undefined) return k.none;
  if (card.valueStatusCode === 'NOT_YET') return t.cards.notYet;

  return formatFigure(card.value);
};

/** 카드 아래 본문 — 직전 기준일 대비 · 서버 사유 · 제외 건수. ⛔ 툴팁이 아니다(분모가 온전하지 않으면 늘 보인다). */
export const cardNoteLines = (card: DashboardCardView | undefined): string[] => {
  if (card === undefined) return [];
  const lines: string[] = [];
  /* 직전 기준일 대비 증감 — 값을 낼 수 없는 카드에는 무엇 대비인지가 성립하지 않아 두지 않는다. */
  const delta = card.valueStatusCode === 'NOT_YET' ? undefined : toDelta(card.deltaRatio);
  if (delta?.label !== undefined) lines.push(delta.label);
  if (card.note !== null && card.note.trim() !== '') lines.push(card.note);
  if (card.valueStatusCode === 'PARTIAL' && card.excludedCount !== null) {
    lines.push(t.cards.excluded(card.excludedCount));
  }

  return lines;
};

/**
 * 보조 열 설명. 성능률의 화면 쪽 기준 문구(「표준 C/T 기준」)는 **서버 설명이 없을 때만** 붙인다 — 서버가
 * 「표준 C/T 기준 근사값입니다.」를 주면 같은 말이 두 번 섰다(사용자 지적 2026-10-16).
 */
export const auxNoteLines = (card: DashboardCardView): string[] => {
  const lines = cardNoteLines(card);
  const hasServerNote = card.note !== null && card.note.trim() !== '';

  return card.cardCode === 'PERFORMANCE_RATE' && !hasServerNote
    ? [k.performanceNote, ...lines]
    : lines;
};

const unitOf = (card: DashboardCardView | undefined): string | undefined =>
  card === undefined || card.valueStatusCode === 'NOT_YET' ? undefined : (card.unit ?? undefined);

/** 카드에 소유 화면이 있으면 링크로 감싼다(지금은 표가 비어 있어 감싸지 않는다 — `card-routes.ts`). */
const Linked = ({
  path,
  label,
  children,
}: {
  path: string | null;
  label: string;
  children: ReactNode;
}) =>
  path === null ? (
    children
  ) : (
    <Link className="kpi-card-link" to={path} aria-label={t.cards.openHint(label)}>
      {children}
    </Link>
  );

/** NG · 불량률 표기 — 음수 NG 도 그대로 적는다(재작업 합격분이 많은 날 · 깎지 않는다). */
const qtyOrNone = (value: number | null | undefined): string =>
  value === null || value === undefined ? k.none : formatFigure(value);

export interface OverviewKpisProps {
  cards: DashboardCardView[];
  equipment: EquipmentView | null;
  production: DashboardProduction | null;
  asOfTime: string | null;
  isLoading: boolean;
  axes: URLSearchParams;
  routes: CardRouteTable;
}

/**
 * 대시보드 탭의 KPI 띠(⭐ 사용자 지시 2026-10-16, 시안 v1.3 기준 재구성).
 *
 * 가동/전체(+ 정지 · 대기 · 교체 · 비가동 태그) · 종합 가동률 · 금일 총생산(아래 NG) · 종합 불량률, 그리고
 * 오른쪽 보조 열에 성능률(표준 C/T 기준) · 양품률 · OEE · 미처리 알람 · 총 NG · 최근 갱신.
 *
 * ⭐ 종합 불량률 · 총 NG 는 **summary 의 `production` 섹션**(공장 단위)이다 — 설비 합계로 계산하지 않는다
 * (설비 미지정 실적이 빠진다 · 2026-10-16 결정). 섹션이 없으면(서버 배포 전) 그 칸만 「—」.
 *
 * 카드는 여전히 **서버가 준 것만** 그린다 — 자리가 정해지지 않은 새 카드는 보조 열 끝에 붙는다.
 */
export const OverviewKpis = ({
  cards,
  equipment,
  production,
  asOfTime,
  isLoading,
  axes,
  routes,
}: OverviewKpisProps) => {
  if (isLoading) return <Skeleton variant="rect" height="7rem" />;

  const byCode = new Map(cards.map((card) => [card.cardCode, card]));
  const availability = byCode.get('AVAILABILITY_RATE');
  const productionQty = byCode.get('PRODUCTION_QTY');
  const auxCards = [
    ...AUX_ORDER.flatMap((code) => {
      const card = byCode.get(code);
      return card === undefined ? [] : [card];
    }),
    ...cards.filter(
      (card) =>
        !AUX_ORDER.includes(card.cardCode) &&
        !(MAIN_CARDS as readonly string[]).includes(card.cardCode),
    ),
  ];
  const running = equipment?.statusCounts.find((entry) => entry.statusCode === 'RUNNING')?.count;
  const pathOf = (card: DashboardCardView | undefined): string | null =>
    card === undefined ? null : cardPathOf(card.cardCode, axes, routes);

  /*
   * ⭐ 본 칸 넷을 한 묶음(`.dash-kpi-main`)으로 둔다 — 넓은 폭에선 한 줄, 좁은 폭에선 2×2 로 왼쪽 절반,
   * 보조 열은 오른쪽 절반(사용자 지시 2026-10-16). 묶음 안 칸은 띠 높이까지 늘어나고 구분선도 끝까지
   * 이어져, 보조 열이 더 길어도 「빈 칸」처럼 보이지 않는다(`app.css` `.dash-kpis-overview`).
   */
  return (
    <div className="dash-kpis dash-kpis-overview">
      <div className="dash-kpi-main">
        <KpiTile
          label={k.runningOfTotal}
          tag={k.tagLive}
          value={
            equipment === null || running === undefined
              ? k.none
              : `${formatFigure(running)} / ${formatFigure(equipment.totalCount)}`
          }
          unit={equipment === null ? undefined : t.equipment.countUnit}
        >
          {equipment !== null && (
            <span className="dash-tag-row">
              {equipment.statusCounts
                .filter((entry) => entry.statusCode !== 'RUNNING')
                .map((entry) => (
                  <Chip
                    key={entry.statusCode}
                    size="sm"
                    status={entry.count === 0 ? 'idle' : EQUIPMENT_STATUS_TONE[entry.statusCode]}
                  >
                    {`${t.equipment.status[entry.statusCode]} ${formatFigure(entry.count)}`}
                  </Chip>
                ))}
            </span>
          )}
        </KpiTile>

        <Linked path={pathOf(availability)} label={availability?.label ?? k.availability}>
          <KpiTile
            label={availability?.label ?? k.availability}
            tag={k.tagToday}
            value={cardValueText(availability)}
            unit={unitOf(availability)}
          >
            {[k.availabilityNote, ...cardNoteLines(availability)].map((line) => (
              <span key={line}>{line}</span>
            ))}
          </KpiTile>
        </Linked>

        <Linked path={pathOf(productionQty)} label={productionQty?.label ?? k.productionQty}>
          <KpiTile
            label={productionQty?.label ?? k.productionQty}
            tag={k.tagToday}
            value={cardValueText(productionQty)}
            unit={unitOf(productionQty)}
          >
            {[k.ngLine(qtyOrNone(production?.ngQty)), ...cardNoteLines(productionQty)].map(
              (line) => (
                <span key={line}>{line}</span>
              ),
            )}
          </KpiTile>
        </Linked>

        <KpiTile
          label={k.defectRate}
          tag={k.tagToday}
          value={qtyOrNone(production?.defectRate)}
          unit={production?.defectRate === null || production === null ? undefined : '%'}
        >
          <span>{k.defectRateNote}</span>
        </KpiTile>
      </div>

      {/*
       * 보조 열 — 줄마다 「이름 … 값」 한 줄, 그 아래 설명을 보조 열 전체 폭으로 편다. 이름 칸 폭에 설명을
       * 가두면 줄이 서너 번 꺾여 띠 전체가 그만큼 높아졌다(실데이터 확인 · 328px).
       */}
      <dl className="dash-kpi-aux">
        {auxCards.map((card) => (
          <div key={card.cardCode} className="dash-kpi-aux-row">
            <dt>{card.cardCode === 'PERFORMANCE_RATE' ? k.performance : card.label}</dt>
            <dd>
              <Linked path={pathOf(card)} label={card.label}>
                {cardValueText(card)}
                {unitOf(card) !== undefined && (
                  <span className="dash-kpi-unit">{unitOf(card)}</span>
                )}
              </Linked>
            </dd>
            {auxNoteLines(card).map((line) => (
              <dd key={line} className="dash-kpi-aux-note">
                {line}
              </dd>
            ))}
          </div>
        ))}
        <div className="dash-kpi-aux-row">
          <dt>{k.totalNg}</dt>
          <dd className={(production?.ngQty ?? 0) > 0 ? 'dash-tone-error' : undefined}>
            {qtyOrNone(production?.ngQty)}
            {production !== null && <span className="dash-kpi-unit">EA</span>}
          </dd>
        </div>
        <div className="dash-kpi-aux-row">
          <dt>{k.lastUpdated}</dt>
          <dd>{asOfTime ?? k.none}</dd>
        </div>
      </dl>
    </div>
  );
};
