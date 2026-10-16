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
import { InfoTip, KpiTile } from './viz';

const t = messages.dashboard;
const k = messages.dashboard.kpi;

/** KPI 띠 본 칸에 자리가 정해진 카드. 나머지(양품률 · OEE · 미확인 알림 · 앞으로 늘 카드)는 보조 열로 간다. */
const MAIN_CARDS = ['AVAILABILITY_RATE', 'PRODUCTION_QTY'] as const;
/** 보조 열의 차례 — 시안의 「평균 C/T 달성」 자리에 성능률(표준 C/T 기준)이 먼저 선다. */
const AUX_ORDER = ['PERFORMANCE_RATE', 'YIELD_RATE', 'OEE', 'UNHANDLED_ALARM'];
/** 표준 C/T 로 계산한 추정값 — 이름 옆에 「추정」을 단다(툴팁 문구와 같은 뜻). */
const ESTIMATED_CARDS = ['PERFORMANCE_RATE', 'OEE'];

/** 카드 값의 표기. ⛔ 값을 낼 수 없는 카드를 0으로 그리지 않는다 — 0은 「가동하지 않았다」로 읽힌다. */
export const cardValueText = (card: DashboardCardView | undefined): string => {
  if (card === undefined) return k.none;
  if (card.valueStatusCode === 'NOT_YET') return t.cards.notYet;

  return formatFigure(card.value);
};

/** 서버 설명 원문. 비어 있으면 `undefined`. */
export const serverNoteOf = (card: DashboardCardView | undefined): string | undefined =>
  card?.note === null || card?.note === undefined || card.note.trim() === ''
    ? undefined
    : card.note;

/**
 * 칸에 늘 보이는 짧은 줄 — 전일 대비 증감 · 제외 건수. ⭐ 서버 설명 원문은 여기 두지 않고 설명 단추의
 * 툴팁으로 옮긴다(사용자 지시 2026-10-16 · KPI 띠 한정) — 칸 높이가 설명 때문에 늘지 않게.
 * 분모가 온전하지 않다는 사실(제외 건수)은 짧으므로 칸에 그대로 남긴다.
 */
/** 전일 대비 증감 — 값을 낼 수 없는 카드에는 무엇 대비인지가 성립하지 않아 두지 않는다. */
const cardDeltaOf = (card: DashboardCardView | undefined) =>
  card === undefined || card.valueStatusCode === 'NOT_YET' ? undefined : toDelta(card.deltaRatio);

export const cardNoteLines = (
  card: DashboardCardView | undefined,
  { withDelta = true }: { withDelta?: boolean } = {},
): string[] => {
  if (card === undefined) return [];
  const lines: string[] = [];
  const delta = withDelta ? cardDeltaOf(card) : undefined;
  if (delta?.label !== undefined) lines.push(delta.label);
  if (card.valueStatusCode === 'PARTIAL' && card.excludedCount !== null) {
    lines.push(t.cards.excluded(card.excludedCount));
  }

  return lines;
};

/**
 * 시간가동률 칸의 짧은 기준 줄 — 「계획 가동시간 기준 · 작업 설비 N대」. 설비 수는 서버 설명 원문에서 읽는다
 * (「… N대」). 설명이 없으면 기준을 지어내지 않고 줄을 두지 않는다. 대수를 못 읽으면 기준만.
 */
export const availabilityBasis = (card: DashboardCardView | undefined): string | undefined => {
  const note = serverNoteOf(card);
  if (note === undefined) return undefined;
  const count = /(\d[\d,]*)\s*대/.exec(note)?.[1];

  return count === undefined
    ? k.availabilityBasis
    : `${k.availabilityBasis} · ${k.workedEquipment(count)}`;
};

/** 보조 열 이름 — 서버 카드 이름을 쓰되, 뜻을 밝혀야 하는 카드만 화면 이름으로 바꾼다(사용자 지시 2026-10-16). */
export const auxLabelOf = (card: DashboardCardView): string => {
  switch (card.cardCode) {
    case 'PERFORMANCE_RATE':
      return k.performance;
    case 'OEE':
      return k.oee;
    /* 실제 의미는 로그인 사용자의 안 읽은 알림 수다 — 「미처리 알람」으로 두면 공장 전체 알람으로 읽힌다. */
    case 'UNHANDLED_ALARM':
      return k.myUnreadAlerts;
    default:
      return card.label;
  }
};

/**
 * 보조 열 설명 단추 내용. ⭐ 성능률 · OEE · 미확인 알림은 사용자가 정한 문구를 그대로 쓴다(사용자 지시
 * 2026-10-16 — 서버 설명 원문 대신). 그 밖의 카드는 서버 설명 원문. 분모에서 뺀 건수(PARTIAL)는 툴팁이 아니라
 * 칸 아래 줄에 따로 늘 보이므로(`cardNoteLines`) 문구를 바꿔도 사라지지 않는다.
 */
export const auxInfoOf = (card: DashboardCardView): string | undefined => {
  switch (card.cardCode) {
    case 'PERFORMANCE_RATE':
      return k.performanceTip;
    case 'OEE':
      return k.oeeTip;
    case 'UNHANDLED_ALARM':
      return k.myUnreadAlertsTip;
    default:
      return serverNoteOf(card);
  }
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

/** 불량 수 표기 — 음수도 그대로 적는다(재작업 합격분이 많은 날 · 깎지 않는다). */
const qtyOrNone = (value: number | null | undefined): string =>
  value === null || value === undefined ? k.none : formatFigure(value);

export interface OverviewKpisProps {
  cards: DashboardCardView[];
  equipment: EquipmentView | null;
  production: DashboardProduction | null;
  isLoading: boolean;
  axes: URLSearchParams;
  routes: CardRouteTable;
}

/**
 * 대시보드 탭의 KPI 띠(⭐ 사용자 지시 2026-10-16, 시안 v1.3 기준 재구성 · 같은 날 문구 · 밀도 개선).
 *
 * 가동 설비(+ 정지 · 대기 · 교체 · 비가동 태그) · 시간가동률 · 생산 수량(아래 불량) · 종합 불량률, 그리고
 * 오른쪽 보조 목록에 성능률 · 양품률 · OEE · 미확인 알림 · 총 불량. 「최근 갱신」은 조건 줄의 「마지막
 * 갱신」과 같은 정보라 두지 않는다. 이 띠에서는 「NG」라는 말을 쓰지 않는다(「불량」).
 *
 * ⭐ 종합 불량률 · 총 불량은 **summary 의 `production` 섹션**(공장 단위)이다 — 설비 합계로 계산하지 않는다
 * (설비 미지정 실적이 빠진다 · 2026-10-16 결정). 섹션이 없으면(서버 배포 전) 그 칸만 「—」.
 *
 * 카드는 여전히 **서버가 준 것만** 그린다 — 자리가 정해지지 않은 새 카드는 보조 열 끝에 붙는다.
 */
export const OverviewKpis = ({
  cards,
  equipment,
  production,
  isLoading,
  axes,
  routes,
}: OverviewKpisProps) => {
  if (isLoading) return <Skeleton variant="rect" height="7rem" />;

  const byCode = new Map(cards.map((card) => [card.cardCode, card]));
  const availability = byCode.get('AVAILABILITY_RATE');
  const productionQty = byCode.get('PRODUCTION_QTY');
  const productionDelta = cardDeltaOf(productionQty);
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
            info={k.availabilityTip}
            tag={k.tagToday}
            value={cardValueText(availability)}
            unit={unitOf(availability)}
          >
            {[availabilityBasis(availability), ...cardNoteLines(availability)].map(
              (line) => line !== undefined && <span key={line}>{line}</span>,
            )}
          </KpiTile>
        </Linked>

        <Linked path={pathOf(productionQty)} label={productionQty?.label ?? k.productionQty}>
          <KpiTile
            label={productionQty?.label ?? k.productionQty}
            info={serverNoteOf(productionQty)}
            tag={k.tagToday}
            value={cardValueText(productionQty)}
            unit={unitOf(productionQty)}
          >
            <span>{k.defectLine(qtyOrNone(production?.ngQty))}</span>
            {productionDelta !== undefined && (
              /*
               * ⭐ 생산 수량 칸 한정(사용자 지정 2026-10-16) — 「전일 대비」는 보조 색 그대로, 기호 · 수치에만 색:
               * 상승 초록 · 하락 주황 · 동일 회색(`.dash-delta-*`). 기호를 함께 둬 색만으로 말하지 않는다.
               */
              <span>
                {t.cards.deltaBase}{' '}
                <span className={`dash-delta dash-delta-${productionDelta.direction}`}>
                  {productionDelta.mark}
                </span>
              </span>
            )}
            {cardNoteLines(productionQty, { withDelta: false }).map((line) => (
              <span key={line}>{line}</span>
            ))}
          </KpiTile>
        </Linked>

        <KpiTile
          label={k.defectRate}
          info={k.defectRateTip}
          tag={k.tagToday}
          value={qtyOrNone(production?.defectRate)}
          unit={production?.defectRate === null || production === null ? undefined : '%'}
        >
          <span>{k.defectRateNote}</span>
        </KpiTile>
      </div>

      {/*
       * 보조 목록 — 줄마다 「이름(+추정 · 설명 단추) … 값」 한 줄. 긴 설명은 설명 단추의 툴팁으로 두고(원문
       * 그대로), 칸에는 짧은 보조 한 줄만 남긴다 — 제외 건수 · 「전체 공장」.
       */}
      <dl className="dash-kpi-aux">
        {auxCards.map((card) => {
          const label = auxLabelOf(card);
          const info = auxInfoOf(card);
          const subLines = [
            ...(card.cardCode === 'UNHANDLED_ALARM' ? [k.allPlants] : []),
            ...cardNoteLines(card),
          ];

          return (
            <div key={card.cardCode} className="dash-kpi-aux-row">
              <dt>
                {label}
                {ESTIMATED_CARDS.includes(card.cardCode) && (
                  <span className="dash-kpi-aux-tag">{k.estimated}</span>
                )}
                {info !== undefined && <InfoTip label={t.viz.infoLabel(label)} content={info} />}
              </dt>
              <dd>
                <Linked path={pathOf(card)} label={label}>
                  {cardValueText(card)}
                  {unitOf(card) !== undefined && (
                    <span className="dash-kpi-unit">{unitOf(card)}</span>
                  )}
                </Linked>
              </dd>
              {subLines.map((line) => (
                <dd key={line} className="dash-kpi-aux-note">
                  {line}
                </dd>
              ))}
            </div>
          );
        })}
        <div className="dash-kpi-aux-row">
          <dt>{k.totalDefect}</dt>
          <dd className={(production?.ngQty ?? 0) > 0 ? 'dash-tone-error' : undefined}>
            {qtyOrNone(production?.ngQty)}
            {production !== null && <span className="dash-kpi-unit">EA</span>}
          </dd>
        </div>
      </dl>
    </div>
  );
};
