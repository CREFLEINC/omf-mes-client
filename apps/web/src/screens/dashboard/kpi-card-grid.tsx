import { EmptyState, Skeleton, StatCard, type StatCardStatus } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Link } from 'react-router';

import { cardPathOf, type CardRouteTable } from './card-routes';
import { toDelta } from './delta';
import { formatFigure, type DashboardCardView } from './types';

const t = messages.dashboard;

/**
 * 값을 낼 수 있는가를 상태 점으로 보인다. **점만으로 말하지 않는다** — 라벨을 함께 준다.
 * `AVAILABLE`에는 점을 두지 않는다: 정상이 정상임을 표시하면 표시가 배경이 된다.
 */
const toStatus = (view: DashboardCardView): { status?: StatCardStatus; statusLabel?: string } => {
  switch (view.valueStatusCode) {
    case 'PARTIAL':
      return { status: 'warning', statusLabel: t.cards.statusPartial };
    case 'NOT_YET':
      return { status: 'idle', statusLabel: t.cards.statusNotYet };
    case 'AVAILABLE':
    case undefined:
      return {};
  }
};

/**
 * 카드 아래 본문 한 줄.
 *
 * ⭐ **툴팁이 아니다.** 분모가 온전하지 않은 지표는 그 사실이 화면에 상시로 서 있어야 한다 —
 * 가려 두면 사용자는 온전한 값으로 읽고 그대로 판단한다.
 *
 * 서버가 준 사유(`note`)와 제외 건수는 **둘 다 올 수 있다.** 하나만 고르면 남은 하나가 사라진다.
 */
const toNoteLines = (view: DashboardCardView): string[] => {
  const lines: string[] = [];

  if (view.note !== null && view.note.trim() !== '') lines.push(view.note);
  if (view.valueStatusCode === 'PARTIAL' && view.excludedCount !== null) {
    lines.push(t.cards.excluded(view.excludedCount));
  }

  return lines;
};

interface KpiCardProps {
  view: DashboardCardView;
  path: string | null;
}

const KpiCard = ({ view, path }: KpiCardProps) => {
  /*
   * ⛔ **값을 낼 수 없으면 0을 그리지 않는다.** 0은 「가동하지 않았다」로 읽히고, 그것은
   * 「아직 집계되지 않았다」와 완전히 다른 사실이다.
   */
  const notYet = view.valueStatusCode === 'NOT_YET';
  const noteLines = toNoteLines(view);

  const card = (
    <StatCard
      label={view.label}
      value={notYet ? t.cards.notYet : formatFigure(view.value)}
      unit={notYet ? undefined : (view.unit ?? undefined)}
      /* 값이 없는 카드에는 증감도 없다 — 무엇 대비 증감인지가 성립하지 않는다. */
      delta={notYet ? undefined : toDelta(view.deltaRatio)}
      bordered
      {...toStatus(view)}
    >
      {noteLines.length === 0 ? null : (
        <span className="kpi-card-note">
          {noteLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </span>
      )}
    </StatCard>
  );

  if (path === null) return card;

  return (
    <Link className="kpi-card-link" to={path} aria-label={t.cards.openHint(view.label)}>
      {card}
    </Link>
  );
};

export interface KpiCardGridProps {
  views: DashboardCardView[];
  isLoading: boolean;
  /** 카드를 눌러 갈 때 함께 넘길 기준 축(기준 날짜 · 공장). */
  axes: URLSearchParams;
  routes: CardRouteTable;
}

/**
 * 지표 카드 줄.
 *
 * ⭐ **서버가 준 카드를 순서대로 그린다.** 화면이 「어느 지표를 보일지」를 정하지 않는다 —
 * 카드가 늘거나 줄어도 이 부품은 바뀌지 않는다.
 *
 * ⛔ **게이지를 쓰지 않는다.** 지표가 여럿이라 나란히 견줘야 하는데, 각자 다른 원을 눈으로
 * 견주는 것은 숫자를 나란히 읽는 것보다 언제나 어렵다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const KpiCardGrid = ({ views, isLoading, axes, routes }: KpiCardGridProps) => {
  if (isLoading) {
    return (
      <div className="kpi-grid" aria-hidden="true">
        {[0, 1, 2, 3].map((slot) => (
          <Skeleton key={slot} variant="rect" height="6.5rem" />
        ))}
      </div>
    );
  }

  if (views.length === 0) {
    return <EmptyState size="sm" live title={t.cards.emptyTitle} description={t.cards.empty} />;
  }

  const anyOpenable = views.some((view) => cardPathOf(view.cardCode, axes, routes) !== null);

  return (
    <>
      <div className="kpi-grid">
        {views.map((view) => (
          <KpiCard key={view.cardCode} view={view} path={cardPathOf(view.cardCode, axes, routes)} />
        ))}
      </div>
      {/*
       * 아직 어느 카드도 상세로 못 갈 때만, **구획에 한 번** 적는다. 카드마다 붙이면 같은
       * 문장이 여러 번 서서 정작 숫자가 안 읽힌다.
       */}
      {!anyOpenable && <p className="pane-lead">{t.cards.drilldownClosed}</p>}
    </>
  );
};
