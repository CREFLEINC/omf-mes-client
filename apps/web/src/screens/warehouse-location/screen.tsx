import { AlertBanner, Breadcrumb, Button, EmptyState, PageHeader, Tabs, useToast } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { toApiError } from '../../patterns/request';
import {
  locationFieldErrorFixtures,
  locationFixtures,
  locationFormInitialValues,
  lookupFixtures,
  warehouseFieldErrorFixtures,
  warehouseFormInitialValues,
} from './fixtures';
import { LocationFormDialog } from './location-form-dialog';
import { LocationPane } from './location-pane';
import { buildLocationRows } from './location-tree';
import { isTruncated, useWarehouseList } from './queries';
import type { Location, LocationFormValues, WarehouseFilters, WarehouseFormValues } from './types';
import { WarehouseFormPane } from './warehouse-form-pane';
import { WarehouseListPane } from './warehouse-list-pane';

const t = messages.warehouseLocation;

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

  const warehouseList = useWarehouseList(filters);
  const warehouses = warehouseList.data?.items ?? [];

  const [formValues, setFormValues] = useState<WarehouseFormValues>(warehouseFormInitialValues);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('edit');
  const [isDirty, setIsDirty] = useState(false);

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

  const selectedWarehouseId = Number(searchParams.get('wh') ?? '') || null;
  const selectedWarehouse =
    warehouses.find((warehouse) => warehouse.warehouseId === selectedWarehouseId) ?? null;

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
    setFormMode('create');
    setFormValues(warehouseFormInitialValues);
    setIsDirty(false);
    updateParams({ tab: 'warehouse' });
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

  const detailPane =
    selectedWarehouse === null ? (
      <div className="pane">
        <EmptyState size="sm" title={t.empty.warehouseNotSelected} />
      </div>
    ) : (
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
                  mode={formMode}
                  values={formValues}
                  onChange={(patch) => {
                    setFormValues((prev) => ({ ...prev, ...patch }));
                    setIsDirty(true);
                  }}
                  fieldErrors={preset === 'error' ? warehouseFieldErrorFixtures : {}}
                  banner={conflictBanner}
                  codeLockReason={formMode === 'edit' ? messages.editability.referenced(3) : null}
                  isActive={selectedWarehouse.isActive}
                  isDirty={isDirty}
                  isSaving={false}
                  lookups={lookupFixtures}
                  onSave={() => {
                    setIsDirty(false);
                    notifyDemoAction();
                  }}
                  onCancel={() => {
                    setFormValues(warehouseFormInitialValues);
                    setIsDirty(false);
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
            setFormMode('edit');
            setIsDirty(false);
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
        {detailPane}
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
        uomOptions={lookupFixtures.uoms}
        isSaving={false}
        onSave={() => {
          setDialogState((prev) => ({ ...prev, open: false }));
          notifyDemoAction();
        }}
      />
    </>
  );
};
