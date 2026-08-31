import { Breadcrumb, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';

import { AlertPanel, NOTIFICATION_CENTER_PATH } from './alert-panel';
import { CARD_ROUTES } from './card-routes';
import { DashboardFilterBar } from './dashboard-filter-bar';
import {
  readFilters,
  toDrilldownParams,
  toFilterQuery,
  toSearchParams,
  type DashboardFilters,
} from './filters';
import { KpiCardGrid } from './kpi-card-grid';
import { LoadErrorBanner } from './load-error-banner';
import { plantNote, usePlantOptions } from './lookups';
import { useDashboardSummary } from './queries';
import { TrendPanel } from './trend-panel';
import type { DashboardAlertView, DashboardCardView, SelectOption } from './types';

const t = messages.dashboard;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_CARDS: DashboardCardView[] = [];
const EMPTY_ALERTS: DashboardAlertView[] = [];

/**
 * W-CO-05 컨테이너 — **로그인 직후 처음 보는 화면이다.**
 *
 * ⭐ **이 화면은 숫자를 모아 보이기만 한다.** 카드마다 소유 화면이 따로 있고, 값이 이상하면
 * 기준 축(기준 날짜 · 공장)을 들고 그 화면으로 간다. 여기서 상세를 그리지 않는다 — 그리기
 * 시작하면 도메인 화면들이 이 파일 안에 한 벌씩 다시 생긴다.
 *
 * ⛔ **자동 갱신이 없다.** 주기 재조회도 창 포커스 재조회도 걸지 않는다 — 사람이 「갱신」을
 * 누른다(조회 화면 공통 규약). 대신 **집계 기준 시각을 항상 적는다**: 집계 시점과 보는 시점이
 * 어긋나는 화면이라, 언제 것인지 말하지 않으면 사용자가 실시간으로 읽는다.
 *
 * ⛔ **위젯 편집·배치 저장을 만들지 않는다.** 근거가 없고, 만들면 이 화면에만 쓰이는 새 원시
 * 요소를 여럿 낳는다.
 *
 * **주소 키의 수명.** 조회 조건은 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 화면을
 * 낸다. 쪽 개념도 선택 개념도 없어 다른 화면들의 「조건이 바뀌면 쪽을 되돌린다」가 성립하지
 * 않는다. 조건이 바뀌면 주소가 통째로 다시 쓰인다.
 */
export const DashboardScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<DashboardFilters>(() => readFilters(searchParams), [searchParams]);
  const query = useMemo(() => toFilterQuery(filters), [filters]);

  const summary = useDashboardSummary(query);
  const plants = usePlantOptions();

  const view = summary.data;
  const cards = view?.cards ?? EMPTY_CARDS;
  const alerts = view?.alerts ?? EMPTY_ALERTS;

  /*
   * 카드를 눌러 갈 때 함께 넘길 축. 기준 날짜를 비워 둔 상태(서버가 오늘로 정한 상태)에서는
   * **응답이 알려 준 날짜**를 넘긴다 — 그래야 화면이 「오늘」을 스스로 계산하지 않고도 축이 이어진다.
   */
  const axes = useMemo(
    () => toDrilldownParams(filters, view?.baseDate ?? null),
    [filters, view?.baseDate],
  );

  const plantOptions: SelectOption[] = plants.entries.map((entry) => ({
    value: entry.value,
    label: entry.label,
  }));

  /*
   * ⭐ **갱신에 실패해도 직전 값을 지우지 않는다.** 회색 화면만 남기면 사용자는 방금까지 보던
   * 숫자마저 잃는다 — 대신 배너로 실패를 알리고 값 옆에 낡았다는 사실을 적는다.
   */
  const hasStaleData = summary.isError && view !== undefined;

  const asOfText = (() => {
    if (view === undefined) return null;
    if (view.asOfText === null) return t.asOf.unknown;

    return hasStaleData ? t.asOf.stale(view.asOfText) : t.asOf.label(view.asOfText);
  })();

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {summary.isError && (
        <LoadErrorBanner
          error={summary.error}
          onRetry={() => {
            void summary.refetch();
          }}
        />
      )}

      <section className="pane" aria-label={t.panes.filters}>
        <DashboardFilterBar
          filters={filters}
          plantOptions={plantOptions}
          plantNote={plantNote(plants)}
          isRefreshing={summary.isFetching}
          onChange={(next) => {
            setSearchParams(toSearchParams(next));
          }}
          onRefresh={() => {
            void summary.refetch();
            /* 공장 목록이 실패한 채로 남아 있으면 갱신이 그것도 함께 다시 묻는다. */
            if (plants.isError) plants.refetch();
          }}
        />
        {asOfText !== null && <p className="pane-lead">{asOfText}</p>}
      </section>

      <section className="pane" aria-label={t.panes.cards}>
        <KpiCardGrid views={cards} isLoading={summary.isPending} axes={axes} routes={CARD_ROUTES} />
      </section>

      <section className="pane" aria-label={t.panes.trend}>
        <h2>{t.panes.trend}</h2>
        <TrendPanel view={view?.trend ?? null} isLoading={summary.isPending} />
      </section>

      <section className="pane" aria-label={t.panes.alerts}>
        <h2>{t.panes.alerts}</h2>
        <AlertPanel views={alerts} isLoading={summary.isPending} />
        {/*
         * 알람 구획의 마무리 링크. 목록이 비어 있어도 남긴다 — 「지금 없다」를 확인한 사람이
         * 지난 알림을 보러 갈 자리가 여기다.
         */}
        <div className="form-actions form-actions-secondary">
          <Link to={NOTIFICATION_CENTER_PATH}>{t.alerts.openCenter}</Link>
        </div>
      </section>
    </>
  );
};
