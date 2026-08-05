import {
  AlertBanner,
  Breadcrumb,
  Button,
  EmptyState,
  PageHeader,
  SkeletonText,
  Tabs,
  useToast,
} from '@crefle/web-ui';
import type { ApiError, components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { codeLockMessage } from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import { selectableOptions } from './code-options';
import { LocationFormDialog } from './location-form-dialog';
import { LocationPane } from './location-pane';
import { buildLocationRows } from './location-tree';
import {
  emptyLocationFormValues,
  emptyWarehouseFormValues,
  isSameWarehouseValues,
  locationToFormValues,
  warehouseToFormValues,
} from './mappers';
import {
  isTruncated,
  useLocationList,
  useLookupOptions,
  useWarehouseDetail,
  useWarehouseList,
} from './queries';
import type {
  Location,
  LocationFormValues,
  LookupOptions,
  WarehouseFilters,
  WarehouseFormValues,
} from './types';
import { WarehouseFormPane } from './warehouse-form-pane';
import { WarehouseListPane } from './warehouse-list-pane';

const t = messages.warehouseLocation;

type WarehouseDetailResponse = components['schemas']['WarehouseDetailResponse'];

/** 폼의 현재 값과 그것이 어느 응답에서 나왔는지. 「고친 것이 있는가」는 둘의 비교로 판정한다. */
interface WarehouseFormState {
  source: WarehouseDetailResponse;
  baseline: WarehouseFormValues;
  values: WarehouseFormValues;
}

const NO_EXPANDED_IDS: ReadonlySet<number> = new Set();

/**
 * 조회 실패의 원인을 한 줄 안내로 옮긴다.
 * 저장 실패와 달리 사용자가 할 수 있는 조치가 재시도뿐이라 액션도 하나다.
 */
const describeLoadError = (error: ApiError): string => {
  switch (error.kind) {
    case 'network':
      return messages.httpError.offline;
    case 'http':
      if (error.status === 403) return messages.httpError.forbidden;
      return error.message ?? messages.httpError.description;
    case 'conflict':
      return error.message === '' ? messages.httpError.description : error.message;
    case 'stateLocked':
    case 'validation': {
      const lines = error.errors.map((item) => item.message).join(' ');
      return lines === '' ? messages.httpError.description : lines;
    }
  }
};

interface LoadErrorBannerProps {
  error: unknown;
  onRetry: () => void;
}

/** 조회 실패 배너. 규범 6에 따라 화면이 직접 배치하는 배너는 화면이 이음매를 붙인다. */
const LoadErrorBanner = ({ error, onRetry }: LoadErrorBannerProps) => (
  <div className="banner-slot">
    <AlertBanner
      variant="error"
      title={messages.httpError.loadTitle}
      action={
        <Button variant="outlined" size="sm" onClick={onRetry}>
          {messages.common.retry}
        </Button>
      }
    >
      {describeLoadError(toApiError(error))}
    </AlertBanner>
  </div>
);

/**
 * W-06-07 컨테이너. 목록·상세·Location 계층을 서버 응답으로 그리고
 * 조회 조건과 선택을 URL에 둔다.
 */
export const WarehouseLocationScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const activeTab = searchParams.get('tab') === 'location' ? 'location' : 'warehouse';

  const filters = useMemo<WarehouseFilters>(
    () => ({
      q: searchParams.get('q') ?? '',
      warehouseTypeCode: searchParams.get('type') ?? '',
      includeInactive: searchParams.get('inactive') === '1',
    }),
    [searchParams],
  );

  const selectedWarehouseId = Number(searchParams.get('wh') ?? '') || null;

  const warehouseList = useWarehouseList(filters);
  const warehouses = warehouseList.data?.items ?? [];
  const detail = useWarehouseDetail(selectedWarehouseId);
  const lookups = useLookupOptions();

  const [formState, setFormState] = useState<WarehouseFormState | null>(null);

  /*
   * 폼의 기준값은 상세 응답에서 온다. 응답 객체가 바뀔 때만 다시 세워
   * 사용자가 입력하는 동안 값이 서버 값으로 되돌아가지 않게 한다.
   * 캐시가 같은 값을 돌려주면 객체 동일성이 유지되므로 다시 세우지 않는다.
   */
  const detailData = detail.data;

  if (detailData !== undefined && formState?.source !== detailData) {
    const seeded = warehouseToFormValues(detailData.warehouse);
    setFormState({ source: detailData, baseline: seeded, values: seeded });
  }

  const formValues = formState?.values ?? emptyWarehouseFormValues();
  const isDirty = formState !== null && !isSameWarehouseValues(formState.values, formState.baseline);

  const locations = useLocationList(selectedWarehouseId);
  const locationItems = useMemo(() => locations.data?.items ?? [], [locations.data]);

  const [expansion, setExpansion] = useState<{
    warehouseId: number;
    ids: ReadonlySet<number>;
  } | null>(null);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [locationFilterText, setLocationFilterText] = useState('');
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    parentLabel: string | null;
  }>({ open: false, mode: 'create', parentLabel: null });
  const [locationValues, setLocationValues] = useState<LocationFormValues>(emptyLocationFormValues);

  const selectedWarehouse = detail.data?.warehouse ?? null;

  /*
   * 기본 펼침 대상 — 하위를 가진 모든 노드.
   * Location 검색이 이미 받아 둔 목록을 클라이언트에서 거르므로, 접힌 노드의 하위는
   * 애초에 행으로 나오지 않는다. 접힌 상태를 기본으로 두면 검색이 「없다」는 잘못된 답을 준다.
   */
  const expandableIds = useMemo(() => {
    const known = new Set(locationItems.map((item) => item.locationId));
    const parents = new Set<number>();

    for (const item of locationItems) {
      const parentId = item.parentLocationId;
      if (parentId !== null && parentId !== undefined && known.has(parentId)) {
        parents.add(parentId);
      }
    }

    return parents;
  }, [locationItems]);

  // 고른 창고가 바뀌면 펼침 상태를 다시 계산한다. 같은 창고를 다시 조회할 때는 사용자의 접기를 지킨다.
  if (
    locations.data !== undefined &&
    selectedWarehouseId !== null &&
    expansion?.warehouseId !== selectedWarehouseId
  ) {
    setExpansion({ warehouseId: selectedWarehouseId, ids: expandableIds });
  }

  const expandedIds = expansion?.ids ?? NO_EXPANDED_IDS;

  const locationRows = useMemo(
    () => buildLocationRows(locationItems, expandedIds),
    [locationItems, expandedIds],
  );

  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    setSearchParams(next);
  };

  // 조회 조건은 화면 상태가 아니라 URL이 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
  const handleApplyFilters = (next: WarehouseFilters) => {
    updateParams({
      q: next.q === '' ? null : next.q,
      type: next.warehouseTypeCode === '' ? null : next.warehouseTypeCode,
      inactive: next.includeInactive ? '1' : null,
    });
  };

  const handleAddWarehouse = () => {
    updateParams({ tab: 'warehouse' });
  };

  const changeFormValues = (patch: Partial<WarehouseFormValues>) => {
    setFormState((prev) => (prev === null ? prev : { ...prev, values: { ...prev.values, ...patch } }));
  };

  /**
   * 선택 목록이 잘리거나 실패했다는 사실을 폼 위에 낸다.
   * 알리지 않으면 선택칸이 이유 없이 비어 보이고 사용자는 값이 사라진 줄 안다.
   */
  const lookupNotice = (() => {
    if (lookups.isError) {
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.optionsLoadFailed}</AlertBanner>
        </div>
      );
    }

    if (lookups.truncated) {
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.optionsTruncated}</AlertBanner>
        </div>
      );
    }

    return null;
  })();

  /** 선택 목록은 사용 중인 것과 지금 선택된 값만 낸다 — 값이 사라진 것처럼 보이면 안 된다. */
  const formLookups: LookupOptions = {
    plants: selectableOptions(lookups.entries.plants, formValues.plantId),
    businessUnits: selectableOptions(lookups.entries.businessUnits, formValues.businessUnitId),
    partners: selectableOptions(lookups.entries.partners, formValues.partnerId),
    uoms: selectableOptions(lookups.entries.uoms, ''),
  };

  const notifyUnavailable = (reason: string) => {
    toast.show({ variant: 'idle', description: reason });
  };

  const handleToggleExpand = (locationId: number) => {
    setExpansion((prev) => {
      if (prev === null) return prev;

      const next = new Set(prev.ids);
      if (next.has(locationId)) {
        next.delete(locationId);
      } else {
        next.add(locationId);
      }
      return { ...prev, ids: next };
    });
  };

  const openLocationDialog = (mode: 'create' | 'edit', parentLabel: string | null) => {
    setLocationValues(emptyLocationFormValues());
    setDialogState({ open: true, mode, parentLabel });
  };

  const handleEditLocation = (location: Location) => {
    setLocationValues(locationToFormValues(location));
    setDialogState({ open: true, mode: 'edit', parentLabel: null });
  };

  const selectedLocationCode = locationRows.find(
    (row) => String(row.location.locationId) === selectedLocationIds[0],
  )?.location.locationCode;

  const listPage = warehouseList.data?.page;
  const listTruncated = listPage !== undefined && isTruncated(listPage, warehouses.length);

  /** 다이얼로그가 어느 창고의 Location을 다루는지 값으로 밝힌다. */
  const warehouseLabel =
    selectedWarehouse === null
      ? ''
      : `${selectedWarehouse.warehouseCode} · ${selectedWarehouse.warehouseName}`;

  /**
   * 우측 페인. 상세를 받지 못한 상태에서 빈 폼을 보이면 사용자가 그것을 자료로 읽는다 —
   * 선택 전·불러오는 중·실패를 각각 다른 화면으로 낸다.
   */
  const renderDetailPane = () => {
    if (selectedWarehouseId === null) {
      return (
        <div className="pane">
          <EmptyState size="sm" title={t.empty.warehouseNotSelected} />
        </div>
      );
    }

    if (detail.isError) {
      return (
        <div className="pane">
          <LoadErrorBanner error={detail.error} onRetry={() => void detail.refetch()} />
        </div>
      );
    }

    if (detail.data === undefined || formState === null || selectedWarehouse === null) {
      return (
        <div className="pane">
          <div role="status" aria-label={t.loading.warehouseDetail}>
            <SkeletonText lines={5} />
          </div>
        </div>
      );
    }

    return (
      <div className="pane">
        <Tabs
          aria-label={t.title}
          value={activeTab}
          onChange={(value) => updateParams({ tab: value })}
          items={[
            {
              value: 'warehouse',
              label: t.tabs.warehouse,
              content: (
                <WarehouseFormPane
                  mode="edit"
                  values={formValues}
                  onChange={changeFormValues}
                  fieldErrors={{}}
                  banner={lookupNotice}
                  codeLockReason={codeLockMessage(detail.data.editability)}
                  isActive={selectedWarehouse.isActive}
                  isDirty={isDirty}
                  isSaving={false}
                  lookups={formLookups}
                  onSave={() => {
                    notifyUnavailable(t.actionReasons.saveUnavailable);
                  }}
                  onCancel={() => {
                    setFormState((prev) =>
                      prev === null ? prev : { ...prev, values: prev.baseline },
                    );
                  }}
                  onDeactivate={() => {
                    notifyUnavailable(t.actionReasons.deactivateUnavailable);
                  }}
                />
              ),
            },
            {
              value: 'location',
              label: t.tabs.location,
              content: (
                <LocationPane
                  rows={locationRows}
                  isLoading={locations.isPending}
                  loadError={
                    locations.isError ? (
                      <LoadErrorBanner
                        error={locations.error}
                        onRetry={() => void locations.refetch()}
                      />
                    ) : null
                  }
                  expandedIds={expandedIds}
                  onToggleExpand={handleToggleExpand}
                  selectedIds={selectedLocationIds}
                  onSelectionChange={setSelectedLocationIds}
                  filterText={locationFilterText}
                  onFilterTextChange={setLocationFilterText}
                  onAddRoot={() => openLocationDialog('create', null)}
                  onAddChild={() => openLocationDialog('create', selectedLocationCode ?? null)}
                  onEdit={handleEditLocation}
                />
              ),
            },
          ]}
        />
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
        actions={<Button onClick={handleAddWarehouse}>{t.actions.addWarehouse}</Button>}
      />

      {/*
       * 목록이 잘렸다는 사실을 감추지 않는다. 페이지 이동 컨트롤은 아직 없으므로
       * 조건을 좁히는 것이 사용자가 할 수 있는 조치다.
       */}
      {listTruncated && listPage !== undefined && (
        <AlertBanner variant="warning">
          {t.listTruncated(warehouses.length, listPage.total)}
        </AlertBanner>
      )}

      <div className="two-pane">
        <WarehouseListPane
          items={warehouses}
          isLoading={warehouseList.isPending}
          appliedFilters={filters}
          onApplyFilters={handleApplyFilters}
          selectedWarehouseId={selectedWarehouseId}
          onSelect={(warehouseId) => {
            updateParams({ wh: String(warehouseId) });
          }}
          onAddWarehouse={handleAddWarehouse}
          loadError={
            warehouseList.isError ? (
              <LoadErrorBanner
                error={warehouseList.error}
                onRetry={() => void warehouseList.refetch()}
              />
            ) : null
          }
        />
        {renderDetailPane()}
      </div>

      <LocationFormDialog
        open={dialogState.open}
        onClose={() => setDialogState((prev) => ({ ...prev, open: false }))}
        mode={dialogState.mode}
        warehouseLabel={warehouseLabel}
        parentLabel={dialogState.parentLabel}
        values={locationValues}
        onChange={(patch) => setLocationValues((prev) => ({ ...prev, ...patch }))}
        fieldErrors={{}}
        banner={null}
        uomOptions={selectableOptions(lookups.entries.uoms, locationValues.capacityUomId)}
        isSaving={false}
        onSave={() => {
          notifyUnavailable(t.actionReasons.saveUnavailable);
        }}
      />
    </>
  );
};
