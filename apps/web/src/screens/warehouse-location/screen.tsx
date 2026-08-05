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
import {
  locationFieldErrorFixtures,
  locationFixtures,
  locationFormInitialValues,
} from './fixtures';
import { LocationFormDialog } from './location-form-dialog';
import { LocationPane } from './location-pane';
import { buildLocationRows } from './location-tree';
import { emptyWarehouseFormValues, isSameWarehouseValues, warehouseToFormValues } from './mappers';
import { isTruncated, useLookupOptions, useWarehouseDetail, useWarehouseList } from './queries';
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

type DemoPreset = 'default' | 'error' | 'conflict';

const DEMO_PRESETS: readonly DemoPreset[] = ['default', 'error', 'conflict'];

const asPreset = (value: string | null): DemoPreset =>
  DEMO_PRESETS.includes(value as DemoPreset) ? (value as DemoPreset) : 'default';

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
 * W-06-07 컨테이너 — 좌측 목록은 서버 응답으로 그린다.
 * 우측 폼과 Location 탭은 아직 예시 데이터를 쓰며 뒤 단계에서 차례로 실데이터로 바뀐다.
 */
export const WarehouseLocationScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const preset = asPreset(searchParams.get('demo'));
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

  const [expandedIds, setExpandedIds] = useState<ReadonlySet<number>>(new Set([2001, 2002]));
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [locationFilterText, setLocationFilterText] = useState('');
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    parentLabel: string | null;
  }>({ open: false, mode: 'create', parentLabel: null });
  const [locationValues, setLocationValues] = useState<LocationFormValues>(
    locationFormInitialValues,
  );

  const selectedWarehouse = detail.data?.warehouse ?? null;

  const locationRows = useMemo(
    () =>
      buildLocationRows(
        locationFixtures.filter(
          (location) => location.warehouseId === (selectedWarehouse?.warehouseId ?? -1),
        ),
        expandedIds,
      ),
    [selectedWarehouse, expandedIds],
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

  const notifyDemoAction = () => {
    toast.show({ variant: 'idle', description: t.demoActionToast });
  };

  const conflictBanner =
    preset === 'conflict' ? (
      <AlertBanner
        variant="error"
        title={messages.conflict.user}
        action={
          <Button variant="outlined" onClick={notifyDemoAction}>
            {messages.conflict.reloadAction}
          </Button>
        }
      />
    ) : null;

  const handleToggleExpand = (locationId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(locationId)) {
        next.delete(locationId);
      } else {
        next.add(locationId);
      }
      return next;
    });
  };

  const openLocationDialog = (mode: 'create' | 'edit', parentLabel: string | null) => {
    setLocationValues(locationFormInitialValues);
    setDialogState({ open: true, mode, parentLabel });
  };

  const handleEditLocation = (location: Location) => {
    setLocationValues({
      locationCode: location.locationCode,
      locationName: location.locationName,
      locationTypeCode: location.locationTypeCode,
      qualityZoneCode: location.qualityZoneCode ?? '',
      storageConditionCode: location.storageConditionCode ?? '',
      allowMixedItem: location.allowMixedItem,
      allowMixedLot: location.allowMixedLot,
      capacityQty: location.capacityQty === null ? '' : String(location.capacityQty ?? ''),
      capacityUomId: location.capacityUomId === null ? '' : String(location.capacityUomId ?? ''),
    });
    setDialogState({ open: true, mode: 'edit', parentLabel: null });
  };

  const selectedLocationCode = locationRows.find(
    (row) => String(row.location.locationId) === selectedLocationIds[0],
  )?.location.locationCode;

  const listPage = warehouseList.data?.page;
  const listTruncated = listPage !== undefined && isTruncated(listPage, warehouses.length);

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
                  banner={
                    <>
                      {lookupNotice}
                      {conflictBanner}
                    </>
                  }
                  codeLockReason={codeLockMessage(detail.data.editability)}
                  isActive={selectedWarehouse.isActive}
                  isDirty={isDirty}
                  isSaving={false}
                  lookups={formLookups}
                  onSave={() => {
                    notifyDemoAction();
                  }}
                  onCancel={() => {
                    setFormState((prev) =>
                      prev === null ? prev : { ...prev, values: prev.baseline },
                    );
                  }}
                  onDeactivate={notifyDemoAction}
                />
              ),
            },
            {
              value: 'location',
              label: t.tabs.location,
              content: (
                <LocationPane
                  rows={locationRows}
                  isLoading={false}
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
      {/* 미완성 상태가 실데이터로 오해되지 않게 하는 격리 장치. 우측 폼이 실데이터로 바뀌면 제거한다. */}
      <AlertBanner variant="info" title={t.demoNotice.title}>
        {t.demoNotice.description}
      </AlertBanner>

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
        parentLabel={dialogState.parentLabel}
        values={locationValues}
        onChange={(patch) => setLocationValues((prev) => ({ ...prev, ...patch }))}
        fieldErrors={preset === 'error' ? locationFieldErrorFixtures : {}}
        banner={conflictBanner}
        uomOptions={selectableOptions(lookups.entries.uoms, locationValues.capacityUomId)}
        isSaving={false}
        onSave={() => {
          setDialogState((prev) => ({ ...prev, open: false }));
          notifyDemoAction();
        }}
      />
    </>
  );
};
