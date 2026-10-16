import { Breadcrumb, PageHeader, Tabs } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { AlertPanel, NOTIFICATION_CENTER_PATH } from './alert-panel';
import { CARD_ROUTES } from './card-routes';
import { DashboardFilterBar } from './dashboard-filter-bar';
import { EquipmentBoard, StoppedPanel } from './equipment-panel';
import {
  readFilters,
  toDrilldownParams,
  toFilterQuery,
  toSearchParams,
  type DashboardFilters,
} from './filters';
import { formatLastUpdated } from './last-updated';
import { LoadErrorBanner } from './load-error-banner';
import { OverviewKpis } from './overview-kpis';
import { ShipmentPanel } from './shipment-panel';
import { plantNote, usePlantOptions } from './lookups';
import {
  IqcTab,
  NonconformanceTab,
  OqcTab,
  PqcTab,
  QualityGate,
  QualityOverviewTab,
} from './quality-panels';
import { useDashboardSummary } from './queries';
import { useFitsScrollport } from './use-fits-scrollport';
import { TrendPanel } from './trend-panel';
import type { DashboardAlertView, DashboardCardView, SelectOption } from './types';
import { Panel } from './viz';

const t = messages.dashboard;

type DashboardTab = 'overview' | 'quality' | 'iqc' | 'pqc' | 'oqc' | 'nonconformance';

/** 품질 탭 다섯(omf-all-around#113) — 화면 구성안의 차례. */
const QUALITY_TABS = [
  { value: 'quality', label: t.tabs.quality, TabBody: QualityOverviewTab },
  { value: 'iqc', label: t.tabs.iqc, TabBody: IqcTab },
  { value: 'pqc', label: t.tabs.pqc, TabBody: PqcTab },
  { value: 'oqc', label: t.tabs.oqc, TabBody: OqcTab },
  { value: 'nonconformance', label: t.tabs.nonconformance, TabBody: NonconformanceTab },
] as const;

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
 * ⭐ 대시보드만 주기 자동 갱신(사용자 결정 2026-10-16, omf-all-around#115) — 설비 상태를
 * 실시간으로 보이기 위함. 조회 화면 공통 규약(자동 갱신 없음)의 이 화면 한정 예외이며, 주기와
 * 조건은 `queries.ts`가 정한다. 「갱신」은 그대로 즉시 다시 부른다. 창 포커스 재조회는 걸지
 * 않는다. **마지막 갱신 시각을 늘 적는다**(조회가 성공한 시각 · 사용자 지시 2026-10-16): 주기 사이에는
 * 보는 값과 지금이 어긋나고, 자동 갱신이 실패하면 값이 그 자리에 머문다 — 언제 것인지 말해야 한다.
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
  const [tab, setTab] = useState<DashboardTab>('overview');
  /* 오른쪽 열(멈춘 설비 · 출하 현황)은 화면 안에 들어갈 때만 위에 붙인다(`use-fits-scrollport.ts`). */
  const sideRef = useRef<HTMLDivElement>(null);
  const sideFits = useFitsScrollport(sideRef);
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
  /* 첫 조회가 실패해 보일 값이 없다 — 패널마다 「섹션이 오지 않았다」와 가른다. */
  const isFailed = summary.isError && view === undefined;

  /*
   * ⭐ 「마지막 갱신」 = 조회가 **성공한** 시각(`dataUpdatedAt` · 사용자 지시 2026-10-16). 서버 집계 시각이
   * 아니다. 실패하면 이 값이 바뀌지 않아 마지막 성공 시각이 남는다. KPI 띠 「최근 갱신」도 같은 값이다.
   */
  const lastUpdatedText = formatLastUpdated(summary.dataUpdatedAt, Date.now());

  /*
   * ⭐ 대시보드 안의 탭(omf-all-around#113). 탭은 **같은 응답을 나눠 보인다** — 품질은 summary 의
   * `quality` 섹션이라 탭을 열 때 따로 부르지 않는다. 조건 줄 · 오류 배너는 탭 밖에 두어 모든 탭에 걸린다.
   * 고른 탭은 주소에 넣지 않는다 — 조회 조건이 아니다.
   *
   * ⭐ 배치는 시안 v1.3 을 따른다(사용자 지시 2026-10-16, 시안 v1.3 기준 재구성) — KPI 띠 → 설비 가동 현황
   * (왼쪽 넓게) + 오른쪽 세로 열(멈춘 설비 → 출하 현황). 기존 생산 추이 · 미처리 알람은 지우지 않고 아래로 내렸다.
   */
  const overview = (
    <div className="dash-tab">
      <OverviewKpis
        cards={cards}
        equipment={view?.equipment ?? null}
        production={view?.production ?? null}
        asOfTime={lastUpdatedText}
        isLoading={summary.isPending}
        axes={axes}
        routes={CARD_ROUTES}
      />

      <div className="dash-row2">
        <EquipmentBoard
          view={view?.equipment ?? null}
          isLoading={summary.isPending}
          isFailed={isFailed}
        />
        <div ref={sideRef} className={sideFits ? 'dash-side dash-side-sticky' : 'dash-side'}>
          <StoppedPanel
            view={view?.equipment ?? null}
            isLoading={summary.isPending}
            isFailed={isFailed}
          />
          <ShipmentPanel
            view={view?.shipment ?? null}
            isLoading={summary.isPending}
            isFailed={isFailed}
          />
        </div>
      </div>

      <div className="dash-row2">
        <Panel title={t.panes.trend} className="dash-span-wide">
          <TrendPanel view={view?.trend ?? null} isLoading={summary.isPending} />
        </Panel>
        <Panel title={t.panes.alerts}>
          <AlertPanel views={alerts} isLoading={summary.isPending} />
          {/*
           * 알람 구획의 마무리 링크. 목록이 비어 있어도 남긴다 — 「지금 없다」를 확인한 사람이
           * 지난 알림을 보러 갈 자리가 여기다.
           */}
          <div className="form-actions form-actions-secondary">
            <Link to={NOTIFICATION_CENTER_PATH}>{t.alerts.openCenter}</Link>
          </div>
        </Panel>
      </div>
    </div>
  );

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={
          <Breadcrumb
            items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
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
          lastUpdatedText={lastUpdatedText}
          isStale={hasStaleData}
          onChange={(next) => {
            setSearchParams(toSearchParams(next));
          }}
          onRefresh={() => {
            void summary.refetch();
            /* 공장 목록이 실패한 채로 남아 있으면 갱신이 그것도 함께 다시 묻는다. */
            if (plants.isError) plants.refetch();
          }}
        />
      </section>

      <Tabs
        aria-label={t.tabs.label}
        value={tab}
        onChange={(next) => {
          setTab(next as DashboardTab);
        }}
        items={[
          { value: 'overview', label: t.tabs.overview, content: overview },
          ...QUALITY_TABS.map(({ value, label, TabBody }) => ({
            value,
            label,
            content: (
              <QualityGate
                quality={view?.quality ?? null}
                isLoading={summary.isPending}
                isFailed={isFailed}
              >
                {(quality) => <TabBody quality={quality} />}
              </QualityGate>
            ),
          })),
        ]}
      />
    </>
  );
};
