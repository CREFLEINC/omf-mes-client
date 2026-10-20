import { Breadcrumb, PageHeader, Tabs } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { AlertCenterButton, AlertPanel } from './alert-panel';
import { CARD_ROUTES } from './card-routes';
import { DashboardFilterBar } from './dashboard-filter-bar';
import { EquipmentBoard, StoppedPanel } from './equipment-panel';
import {
  isLivePeriod,
  isSingleDay,
  plantToday,
  readFilters,
  toDrilldownParams,
  toFilterQuery,
  toSearchParams,
  type DashboardFilters,
} from './filters';
import { formatLastUpdated } from './last-updated';
import { LoadErrorBanner, periodErrorOf } from './load-error-banner';
import { OverviewKpis } from './overview-kpis';
import { FilterQueryContext, PeriodRangeContext, SingleDayContext } from './period';
import { ShipmentPanel } from './shipment-panel';
import { plantNote, usePlantOptions, type DataScope } from './lookups';
import {
  IqcTab,
  NonconformanceTab,
  OqcTab,
  PqcTab,
  QualityGate,
  QualityOverviewTab,
} from './quality-panels';
import { useSession } from '../../patterns/session';
import { useNotificationEventOptions } from '../notification-center/lookups';
import { toWebAccess } from '../../patterns/web-access';
import { useDashboardSummary } from './queries';
import { TrendPanel } from './trend-panel';
import { useFillHeight } from './use-fill-height';
import { useTipInside } from './use-tip-inside';
import type { DashboardAlertView, DashboardCardView, SelectOption } from './types';
import { Panel } from './viz';

const t = messages.dashboard;

type DashboardTab = 'overview' | 'quality' | 'iqc' | 'pqc' | 'oqc' | 'nonconformance';

const DASHBOARD_TABS: readonly DashboardTab[] = [
  'overview',
  'quality',
  'iqc',
  'pqc',
  'oqc',
  'nonconformance',
];

/**
 * 고른 탭은 주소(`tab`)에 둔다 — 다른 화면으로 갔다가 뒤로 오면 보던 탭으로 돌아온다(⭐ 사용자 지시
 * 2026-10-19 「뒤로 가기를 누르면 무조건 대시보드 탭으로 간다」). 첫 탭은 주소에 적지 않는다. 모르는 값은 첫 탭.
 */
export const TAB_PARAM = 'tab';
export const readTab = (params: URLSearchParams): DashboardTab => {
  const raw = params.get(TAB_PARAM);
  return DASHBOARD_TABS.find((tab) => tab === raw) ?? 'overview';
};
const withTab = (params: URLSearchParams, tab: DashboardTab): URLSearchParams => {
  const next = new URLSearchParams(params);
  if (tab === 'overview') next.delete(TAB_PARAM);
  else next.set(TAB_PARAM, tab);
  return next;
};

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
const NO_SCOPES: readonly DataScope[] = [];

export const DashboardScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<DashboardFilters>(() => readFilters(searchParams), [searchParams]);
  const query = useMemo(() => toFilterQuery(filters), [filters]);

  /* 공장 시각의 오늘 — 빠른 선택 · 미래 막기 · 자동 갱신 판단에만 쓴다(조회 기본값은 서버가 정한다). */
  const today = plantToday();
  const isLive = isLivePeriod(filters, today);
  const summary = useDashboardSummary(query, { live: isLive });
  /* 2 · 3행이 화면 아래까지 남은 높이를 나눠 갖는다(3행 생산 추이가 먼저 · `.dash-overview`). */
  const [overviewEl, setOverviewEl] = useState<HTMLDivElement | null>(null);
  const fillHeight = useFillHeight(overviewEl);
  useTipInside();
  /* 서버가 기간을 거절한 이유(400 field dateFrom · dateTo) — 배너 대신 날짜 칸 옆에 둔다. */
  const periodError = periodErrorOf(summary.error);
  /* 알림 이름 풀이 — 알림센터와 같은 유형 목록을 쓴다(코드 원문을 보이지 않는다). */
  const alertEvents = useNotificationEventOptions();
  /* 출하 현황 칸을 눌러 갈 화면 — 사이드바와 같은 권한 판정(세션 권한)으로 링크 여부를 정한다. */
  const { session } = useSession();
  const access = toWebAccess(session?.permissions);
  const tab = readTab(searchParams);
  const scopes = session?.scopes ?? NO_SCOPES;
  const plants = usePlantOptions(scopes);
  /* 데이터 범위가 공장 하나뿐이면 그 공장을 기본으로 고른다(omf-all-around#120) — 주소에 적어 조회·공유가 같은 공장을 본다. */
  const onlyPlant =
    scopes.length > 0 && plants.entries.length === 1 ? plants.entries[0]?.value : undefined;
  useEffect(() => {
    if (onlyPlant !== undefined && filters.plant === '') {
      setSearchParams(withTab(toSearchParams({ ...filters, plant: onlyPlant }), tab), {
        replace: true,
      });
    }
  }, [onlyPlant, filters, tab, setSearchParams]);

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
  const lastUpdatedText = formatLastUpdated(summary.dataUpdatedAt);

  /*
   * ⭐ 대시보드 안의 탭(omf-all-around#113). 탭은 **같은 응답을 나눠 보인다** — 품질은 summary 의
   * `quality` 섹션이라 탭을 열 때 따로 부르지 않는다. 조건 줄 · 오류 배너는 탭 밖에 두어 모든 탭에 걸린다.
   * 고른 탭은 주소에 넣지 않는다 — 조회 조건이 아니다.
   *
   * ⭐ 배치는 시안 v1.3 을 따른다(사용자 지시 2026-10-16, 시안 v1.3 기준 재구성) — KPI 띠 → 설비 가동 현황
   * (왼쪽 넓게) + 오른쪽 세로 열(멈춘 설비 → 출하 현황). 기존 생산 추이 · 미확인 알림은 지우지 않고 아래로 내렸다.
   */
  const overview = (
    <div className="dash-tab">
      <OverviewKpis
        cards={cards}
        equipment={view?.equipment ?? null}
        production={view?.production ?? null}
        isLoading={summary.isPending}
        axes={axes}
        routes={CARD_ROUTES}
      />

      {/*
       * ⭐ 행 단위 격자(사용자 지정 2026-10-16) — 2행: 설비 가동 현황 | 가동 외 설비 현황, 3행: 일일 생산실적 추이 |
       * 출하 현황 / 미확인 알림(세로). 두 행 모두 같은 좌우 비율이고 행 안 카드는 위 · 아래 끝을 맞춘다. 행 높이는
       * 왼쪽 설비 카드(2행) · 오른쪽 출하 + 알림(3행)이 정하고, 가동 외 설비는 그 높이에 맞춰 줄 수를, 추이는 그래프
       * 높이를 맞춘다(`.dash-fit`). 좁으면 1열로 쌓는다.
       */}
      <div
        className="dash-overview"
        ref={setOverviewEl}
        style={fillHeight === null ? undefined : { minHeight: fillHeight }}
      >
        <EquipmentBoard
          view={view?.equipment ?? null}
          isLoading={summary.isPending}
          isFailed={isFailed}
        />
        <StoppedPanel
          view={view?.equipment ?? null}
          isLoading={summary.isPending}
          isFailed={isFailed}
        />
        {/*
         * ⭐ 「단위 EA」는 제목 아래 부제로, 오른쪽 위는 기간 이름표 「최근 9일」(기간 조회면 「선택 기간」 ·
         * 사용자 지시 2026-10-19 — 다른 카드와 같은 머리 구성).
         */}
        <Panel
          title={t.panes.trend}
          className="dash-fit"
          sub={
            view?.trend?.unit === null || view?.trend?.unit === undefined
              ? undefined
              : t.trend.unitSuffix(view.trend.unit)
          }
          tag={
            isSingleDay(filters)
              ? messages.dashboard.quality.dailyRecent
              : messages.dashboard.quality.tagPeriod
          }
        >
          <TrendPanel
            view={view?.trend ?? null}
            baseDate={view?.baseDate ?? null}
            isLoading={summary.isPending}
          />
        </Panel>
        <div className="dash-overview-stack">
          <ShipmentPanel
            view={view?.shipment ?? null}
            baseDate={view?.baseDate ?? null}
            isLoading={summary.isPending}
            isFailed={isFailed}
            allows={access.allows}
          />
          <Panel title={t.panes.alerts} action={<AlertCenterButton />}>
            <AlertPanel views={alerts} events={alertEvents.entries} isLoading={summary.isPending} />
          </Panel>
        </div>
      </div>
    </div>
  );

  return (
    <SingleDayContext.Provider value={isSingleDay(filters)}>
      <FilterQueryContext.Provider value={query}>
        <PageHeader
          title={t.title}
          breadcrumb={
            <Breadcrumb
              items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
              aria-label={messages.common.shell.breadcrumb}
            />
          }
        />

        {summary.isError && periodError === undefined && (
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
            allowAllPlants={onlyPlant === undefined}
            plantNote={plantNote(plants)}
            isRefreshing={summary.isFetching}
            lastUpdatedText={lastUpdatedText}
            isStale={hasStaleData}
            today={today}
            isLive={isLive}
            periodError={periodError}
            onChange={(next) => {
              /* 조건을 바꿔도 보던 탭은 그대로. */
              setSearchParams(withTab(toSearchParams(next), tab));
            }}
            onRefresh={() => {
              void summary.refetch();
              /* 공장 목록이 실패한 채로 남아 있으면 갱신이 그것도 함께 다시 묻는다. */
              if (plants.isError) plants.refetch();
            }}
          />
        </section>

        <Tabs
          className="dash-tabs"
          aria-label={t.tabs.label}
          value={tab}
          onChange={(next) => {
            /* 탭 전환은 기록을 쌓지 않는다(replace) — 뒤로 가기가 탭을 하나씩 되짚지 않고 이전 화면으로 간다. */
            setSearchParams((current) => withTab(current, next as DashboardTab), {
              replace: true,
            });
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
                  {(quality) =>
                    value === 'quality' ? (
                      /* 품질 종합만 — 기간 이름표에 실제 날짜 범위(사용자 지시 2026-10-19). */
                      <PeriodRangeContext.Provider
                        value={
                          view === undefined || view === null
                            ? null
                            : {
                                baseDate: view.baseDate,
                                dateFrom: query.dateFrom ?? null,
                                dateTo: query.dateTo ?? null,
                              }
                        }
                      >
                        <TabBody quality={quality} allows={access.allows} />
                      </PeriodRangeContext.Provider>
                    ) : value === 'iqc' ? (
                      /* 최근 IQC 판정 줄 → 검사결과 상세(사용자 지시 2026-10-19) — 그 화면 권한을 본다. */
                      <IqcTab quality={quality} allows={access.allows} />
                    ) : value === 'pqc' ? (
                      /* PQC · OQC 도 IQC 와 같이 최근 판정 줄 → 검사결과 상세(사용자 지시 2026-10-19). */
                      <PqcTab quality={quality} allows={access.allows} />
                    ) : value === 'oqc' ? (
                      <OqcTab quality={quality} allows={access.allows} />
                    ) : (
                      /* 부적합 — 미종결 부적합 줄 → 처분 판정 처리(사용자 지시 2026-10-19) · 그 화면 권한을 본다. */
                      <NonconformanceTab quality={quality} allows={access.allows} />
                    )
                  }
                </QualityGate>
              ),
            })),
          ]}
        />
      </FilterQueryContext.Provider>
    </SingleDayContext.Provider>
  );
};
