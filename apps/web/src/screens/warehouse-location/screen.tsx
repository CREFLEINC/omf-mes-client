import { AlertBanner, Breadcrumb, Button, EmptyState, PageHeader, Tabs, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import {
  defaultWarehouseFilters,
  locationFieldErrorFixtures,
  locationFixtures,
  locationFormInitialValues,
  lookupFixtures,
  warehouseFieldErrorFixtures,
  warehouseFixtures,
  warehouseFormInitialValues,
} from './fixtures';
import { LocationFormDialog } from './location-form-dialog';
import { LocationPane } from './location-pane';
import { buildLocationRows } from './location-tree';
import type {
  Location,
  LocationFormValues,
  Warehouse,
  WarehouseFilters,
  WarehouseFormValues,
} from './types';
import { WarehouseFormPane } from './warehouse-form-pane';
import { WarehouseListPane } from './warehouse-list-pane';

const t = messages.warehouseLocation;

type DemoPreset = 'default' | 'empty' | 'loading' | 'error' | 'conflict';

const DEMO_PRESETS: readonly DemoPreset[] = ['default', 'empty', 'loading', 'error', 'conflict'];

const asPreset = (value: string | null): DemoPreset =>
  DEMO_PRESETS.includes(value as DemoPreset) ? (value as DemoPreset) : 'default';

const matchesFilters = (warehouse: Warehouse, filters: WarehouseFilters): boolean => {
  if (filters.warehouseTypeCode !== '' && warehouse.warehouseTypeCode !== filters.warehouseTypeCode) {
    return false;
  }
  if (filters.q === '') return true;
  const needle = filters.q.toLowerCase();
  return (
    warehouse.warehouseCode.toLowerCase().includes(needle) ||
    warehouse.warehouseName.toLowerCase().includes(needle)
  );
};

/**
 * W-06-07 데모 컨테이너 — Phase 1은 예시 데이터를 물려 배치만 확인한다.
 * Phase 2에서 **이 파일만** 실제 컨테이너로 교체된다. 아래 화면 컴포넌트 4개의 props 계약은 그대로 쓰인다.
 */
export const WarehouseLocationScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const preset = asPreset(searchParams.get('demo'));
  const activeTab = searchParams.get('tab') === 'location' ? 'location' : 'warehouse';

  const isLoading = preset === 'loading';
  const sourceWarehouses = preset === 'empty' || preset === 'loading' ? [] : warehouseFixtures;
  const sourceLocations = preset === 'empty' || preset === 'loading' ? [] : locationFixtures;

  const [appliedFilters, setAppliedFilters] = useState<WarehouseFilters>(defaultWarehouseFilters);
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

  // includeInactive는 서버 조회 축이라 Phase 1에서는 목록을 줄이지 않는다.
  // 조건 칩과 상태 왕복만 확인하고, 실제 반영은 Phase 2의 조회 경로가 맡는다.
  const visibleWarehouses = useMemo(
    () => sourceWarehouses.filter((warehouse) => matchesFilters(warehouse, appliedFilters)),
    [sourceWarehouses, appliedFilters],
  );

  const selectedWarehouseId = Number(searchParams.get('wh') ?? '') || null;
  const selectedWarehouse =
    visibleWarehouses.find((warehouse) => warehouse.warehouseId === selectedWarehouseId) ??
    visibleWarehouses[0] ??
    null;

  const locationRows = useMemo(
    () =>
      buildLocationRows(
        sourceLocations.filter(
          (location) => location.warehouseId === (selectedWarehouse?.warehouseId ?? -1),
        ),
        expandedIds,
      ),
    [sourceLocations, selectedWarehouse, expandedIds],
  );

  const updateParams = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      next.set(key, value);
    }
    setSearchParams(next);
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
                  codeLockReason={
                    formMode === 'edit' ? messages.editability.referenced(3) : null
                  }
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
                  isLoading={isLoading}
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
      {/* 미완성 상태가 실데이터로 오해되지 않게 하는 격리 장치. Phase 2에서 제거한다. */}
      <AlertBanner variant="info" title={t.demoNotice.title}>
        {t.demoNotice.description}
      </AlertBanner>

      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
        actions={
          <Button
            onClick={() => {
              setFormMode('create');
              setFormValues(warehouseFormInitialValues);
              setIsDirty(false);
              updateParams({ tab: 'warehouse' });
            }}
          >
            {t.actions.addWarehouse}
          </Button>
        }
      />

      <div className="two-pane">
        <WarehouseListPane
          items={visibleWarehouses}
          isLoading={isLoading}
          appliedFilters={appliedFilters}
          onApplyFilters={setAppliedFilters}
          selectedWarehouseId={selectedWarehouse?.warehouseId ?? null}
          onSelect={(warehouseId) => {
            setFormMode('edit');
            setIsDirty(false);
            updateParams({ wh: String(warehouseId) });
          }}
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
