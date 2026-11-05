import { AlertBanner, Breadcrumb, Button, EmptyState, PageHeader, Skeleton } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { plantToday } from '../../patterns/plant-time';
import { Select } from '../../patterns/select';
import { ArrivalView } from './arrival-view';
import {
  EMPTY_ARRIVAL,
  EMPTY_ITEMS,
  EMPTY_PROGRESS,
  readArrival,
  readItems,
  readPage,
  readPlant,
  readProgress,
  readSelectedId,
  readView,
  toSearchParams,
  type ReplenishmentView,
  type ScreenState,
} from './filters';
import { ItemsView } from './items-view';
import { ProgressView } from './progress-view';
import { useHeaderCounts, usePlants, useSettings } from './queries';
import { RequestView } from './request-view';
import { formatDay } from './types';

const t = messages.productionWarehouseReplenishment;

/** 조직 관리(부서 생산 창고 연결) — W-06-06. */
export const ORGANIZATION_PATH = '/master-data/common-code';

/**
 * W-02-12 생산 창고 보충(004, omf-all-around#230). 「구매 / 자재 관리 › 출고 관리」의 탭, W-02-11 다음.
 * 보기(`view`) · 공장 · 조건 · 쪽 · 고른 요청(`id`)은 주소가 갖는다(screens/W-02-12.md 「진입·이동」).
 */
export const ProductionWarehouseReplenishmentScreen = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const state: ScreenState = {
    view: readView(searchParams),
    plant: readPlant(searchParams),
    progress: readProgress(searchParams),
    arrival: readArrival(searchParams),
    items: readItems(searchParams),
    page: readPage(searchParams),
    id: readSelectedId(searchParams),
  };

  const plants = usePlants();
  const plantId =
    plants.data?.find((plant) => String(plant.plantId) === state.plant)?.plantId ??
    plants.data?.[0]?.plantId ??
    null;
  const settings = useSettings(plantId);
  const counts = useHeaderCounts(plantId);
  const productionWarehouses = settings.data?.warehouses ?? [];

  const go = (next: Partial<ScreenState>): void => {
    setSearchParams(toSearchParams({ ...state, page: 1, id: null, ...next }));
  };
  const showView = (view: ReplenishmentView, id: number | null = null): void => go({ view, id });

  const viewButton = (view: ReplenishmentView, label: string): ReactNode => (
    <Button
      variant={state.view === view ? 'filled' : 'outlined'}
      size="sm"
      aria-pressed={state.view === view}
      onClick={() => showView(view)}
    >
      {label}
    </Button>
  );

  const active = counts.data?.active ?? 0;
  const below = counts.data?.below ?? 0;
  const arrivals = counts.data?.arrivals ?? 0;

  const body = (): ReactNode => {
    if (plants.isError || settings.isError) {
      const retry = plants.isError ? plants.refetch : settings.refetch;
      return (
        <AlertBanner
          variant="error"
          title={messages.httpError.loadTitle}
          action={
            <Button variant="outlined" size="sm" onClick={() => void retry()}>
              {messages.common.retry}
            </Button>
          }
        >
          {messages.httpError.description}
        </AlertBanner>
      );
    }
    if (plants.isPending) return <Skeleton variant="rect" height="16rem" />;
    if (plantId === null) return <EmptyState size="sm" title={t.noPlant} />;
    if (settings.isPending) return <Skeleton variant="rect" height="16rem" />;
    if (productionWarehouses.length === 0) {
      return (
        <EmptyState
          size="sm"
          title={t.noProductionWarehouse.title}
          description={t.noProductionWarehouse.description}
          action={
            <Button variant="outlined" onClick={() => void navigate(ORGANIZATION_PATH)}>
              {t.noProductionWarehouse.action}
            </Button>
          }
        />
      );
    }

    switch (state.view) {
      case 'progress':
        return (
          <ProgressView
            plantId={plantId}
            productionWarehouses={productionWarehouses}
            filters={state.progress}
            page={state.page}
            selectedId={state.id}
            onSearch={(progress) => go({ view: 'progress', progress })}
            onReset={() => go({ view: 'progress', progress: EMPTY_PROGRESS })}
            onPage={(page) => go({ view: 'progress', page })}
            onSelect={(id) => setSearchParams(toSearchParams({ ...state, view: 'progress', id }))}
          />
        );
      case 'arrival':
        return (
          <ArrivalView
            plantId={plantId}
            productionWarehouses={productionWarehouses}
            filters={state.arrival}
            page={state.page}
            onSearch={(arrival) => go({ view: 'arrival', arrival })}
            onReset={() => go({ view: 'arrival', arrival: EMPTY_ARRIVAL })}
            onPage={(page) => go({ view: 'arrival', page })}
          />
        );
      case 'items':
        return (
          <ItemsView
            plantId={plantId}
            settings={settings.data}
            filters={state.items}
            page={state.page}
            onSearch={(items) => go({ view: 'items', items })}
            onReset={() => go({ view: 'items', items: EMPTY_ITEMS })}
            onPage={(page) => go({ view: 'items', page })}
          />
        );
      default:
        return (
          <RequestView
            plantId={plantId}
            productionWarehouses={productionWarehouses}
            onShowProgress={(id) => showView('progress', id)}
          />
        );
    }
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={
          <Breadcrumb
            items={[
              { label: t.breadcrumb.root },
              { label: t.breadcrumb.parent },
              { label: t.title },
            ]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
      />
      <div className="replenishment-views">
        <div role="group" aria-label={t.views.label}>
          {viewButton('request', t.views.request)}
          {viewButton('progress', active > 0 ? t.views.progressCount(active) : t.views.progress)}
          {viewButton('arrival', arrivals > 0 ? t.views.arrivalCount(arrivals) : t.views.arrival)}
          {viewButton('items', below > 0 ? t.views.itemsBelow(below) : t.views.items)}
        </div>
        <div className="replenishment-plant">
          {(plants.data?.length ?? 0) > 1 && (
            <Select
              size="sm"
              aria-label={t.plant}
              value={plantId === null ? '' : String(plantId)}
              options={(plants.data ?? []).map((plant) => ({
                value: String(plant.plantId),
                label: plant.plantName,
              }))}
              onChange={(value) =>
                go({
                  plant: value,
                  progress: EMPTY_PROGRESS,
                  arrival: EMPTY_ARRIVAL,
                  items: EMPTY_ITEMS,
                })
              }
            />
          )}
          {(plants.data?.length ?? 0) === 1 && (
            <span className="field-note">{plants.data?.[0]?.plantName}</span>
          )}
          <span className="field-note">{t.today(formatDay(plantToday()))}</span>
        </div>
      </div>
      {body()}
    </>
  );
};
