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

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, codeLockMessage, useMasterWrite } from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import { selectableOptions } from './code-options';
import { DeactivateConfirmDialog } from './deactivate-confirm-dialog';
import { LocationFormDialog } from './location-form-dialog';
import { LocationPane } from './location-pane';
import { buildLocationRows } from './location-tree';
import {
  emptyLocationFormValues,
  emptyWarehouseFormValues,
  isSameWarehouseValues,
  locationToFormValues,
  toWarehouseCreate,
  toWarehouseUpdate,
  warehouseToFormValues,
} from './mappers';
import {
  isTruncated,
  useLocationList,
  useLookupOptions,
  useWarehouseDetail,
  useWarehouseList,
  warehouseDetailPath,
  warehouseKeys,
} from './queries';
import type {
  Location,
  LocationFormValues,
  LookupOptions,
  Warehouse,
  WarehouseFilters,
  WarehouseFormValues,
} from './types';
import { WarehouseFormPane } from './warehouse-form-pane';
import { WarehouseListPane } from './warehouse-list-pane';
import { WAREHOUSE_FORM_FIELDS, validateWarehouse } from './warehouse-validation';

const t = messages.warehouseLocation;

type WarehouseDetailResponse = components['schemas']['WarehouseDetailResponse'];

/** 신규 등록 폼의 기준값 출처. 상세 응답과 같은 자리를 채우는 안정된 표식이다. */
const CREATE_FORM_SOURCE = Symbol('warehouse-create');

type WarehouseFormSource = WarehouseDetailResponse | typeof CREATE_FORM_SOURCE;

/** 폼의 현재 값과 그것이 어디서 나왔는지. 「고친 것이 있는가」는 둘의 비교로 판정한다. */
interface WarehouseFormState {
  source: WarehouseFormSource;
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
  const { client } = useApiClient();

  const activeTab = searchParams.get('tab') === 'location' ? 'location' : 'warehouse';

  const filters = useMemo<WarehouseFilters>(
    () => ({
      q: searchParams.get('q') ?? '',
      warehouseTypeCode: searchParams.get('type') ?? '',
      includeInactive: searchParams.get('inactive') === '1',
    }),
    [searchParams],
  );

  const isCreateMode = searchParams.get('mode') === 'create';
  const selectedWarehouseId = isCreateMode ? null : Number(searchParams.get('wh') ?? '') || null;

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
  const formSource: WarehouseFormSource | null = isCreateMode
    ? CREATE_FORM_SOURCE
    : (detail.data ?? null);

  if (formSource !== null && formState?.source !== formSource) {
    const seeded =
      formSource === CREATE_FORM_SOURCE
        ? emptyWarehouseFormValues()
        : warehouseToFormValues(formSource.warehouse);
    setFormState({ source: formSource, baseline: seeded, values: seeded });
  }

  const formValues = formState?.values ?? emptyWarehouseFormValues();
  const isDirty = formState !== null && !isSameWarehouseValues(formState.values, formState.baseline);

  /** 보내기 전에 화면에서 잡은 오류. 저장을 누른 뒤에만 세운다 — 입력 도중에 붉은 글씨를 띄우지 않는다. */
  const [localFieldErrors, setLocalFieldErrors] = useState<Record<string, string>>({});

  const warehouseWrite = useMasterWrite<WarehouseFormValues, Warehouse>({
    request: (values, headers) =>
      isCreateMode
        ? // 등록에는 낙관적 잠금이 없다 — 계약이 If-Match를 요구하지 않는다.
          client.POST('/mdm/warehouses', {
            params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
            body: toWarehouseCreate(values),
          })
        : client.PUT('/mdm/warehouses/{warehouseId}', {
            params: {
              path: { warehouseId: selectedWarehouseId ?? 0 },
              header: {
                'Idempotency-Key': headers['Idempotency-Key'],
                'If-Match': headers['If-Match'] ?? '',
              },
            },
            body: toWarehouseUpdate(values),
          }),
    // ETag는 상세 경로에 보관된다. 저장 응답의 ETag도 같은 경로로 갱신돼 연속 수정이 된다.
    etagPath: selectedWarehouseId === null ? null : warehouseDetailPath(selectedWarehouseId),
    invalidateKeys: [warehouseKeys.all],
    knownFields: WAREHOUSE_FORM_FIELDS,
    onSuccess: (saved) => {
      setLocalFieldErrors({});

      if (isCreateMode) {
        toast.show({ variant: 'success', description: messages.common.created });
        /*
         * 등록 응답(201)에는 ETag가 없다. 등록한 창고의 상세로 옮겨 다시 조회해야
         * 낙관적 잠금 토큰이 확보되고 이어서 수정할 수 있다.
         */
        updateParams({ mode: null, wh: String(saved.warehouseId) });
        return;
      }

      const next = warehouseToFormValues(saved);
      setFormState((prev) => (prev === null ? prev : { ...prev, baseline: next, values: next }));
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);

  const deactivateWrite = useMasterWrite<void, Warehouse>({
    request: (_variables, headers) =>
      client.POST('/mdm/warehouses/{warehouseId}:deactivate', {
        params: {
          path: { warehouseId: selectedWarehouseId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
      }),
    /*
     * 잠금 토큰은 상세 경로에 보관돼 있다. 요청 경로(`...:deactivate`)로 꺼내면 언제나 비어 있다.
     */
    etagPath: selectedWarehouseId === null ? null : warehouseDetailPath(selectedWarehouseId),
    invalidateKeys: [warehouseKeys.all],
    // 대응하는 입력칸이 없다 — 필드 오류도 전부 배너로 올린다.
    knownFields: [],
    onSuccess: () => {
      setIsDeactivateOpen(false);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

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

  // 신규 등록은 선택을 지운다 — 어느 창고의 상세도 아닌 새 폼이다.
  const handleAddWarehouse = () => {
    warehouseWrite.reset();
    setLocalFieldErrors({});
    updateParams({ mode: 'create', wh: null, tab: 'warehouse' });
  };

  /** 값을 고치는 중에 옛 오류가 남아 있으면 무엇을 고쳐야 하는지 알 수 없다. */
  const changeFormValues = (patch: Partial<WarehouseFormValues>) => {
    setFormState((prev) =>
      prev === null ? prev : { ...prev, values: { ...prev.values, ...patch } },
    );

    for (const field of Object.keys(patch)) {
      warehouseWrite.clearFieldError(field);
      setLocalFieldErrors((prev) => {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSaveWarehouse = () => {
    const errors = validateWarehouse(formValues, isCreateMode ? 'create' : 'edit');
    setLocalFieldErrors(errors);

    // 화면에서 잡히는 오류는 서버로 보내지 않는다.
    if (Object.keys(errors).length > 0) return;

    warehouseWrite.write(formValues);
  };

  /**
   * 저장 충돌을 푸는 유일한 경로. 계약이 덮어쓰기 강제를 제공하지 않으므로
   * 최신 값을 받아 다시 입력하는 수밖에 없고, 입력한 내용은 사라진다.
   */
  const handleReloadDetail = () => {
    warehouseWrite.reset();
    setLocalFieldErrors({});
    setFormState(null);
    void detail.refetch();
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

  const renderWarehouseForm = (options: {
    mode: 'create' | 'edit';
    codeLockReason: string | null;
    isActive: boolean;
  }) => (
    <WarehouseFormPane
      mode={options.mode}
      values={formValues}
      onChange={changeFormValues}
      // 로컬 검증 결과가 서버 오류를 덮는다 — 지금 고칠 수 있는 것을 먼저 보인다.
      fieldErrors={{ ...warehouseWrite.fieldErrors, ...localFieldErrors }}
      banner={
        <>
          {lookupNotice}
          <SaveErrorBanner
            error={warehouseWrite.error}
            onReload={options.mode === 'edit' ? handleReloadDetail : undefined}
          />
        </>
      }
      codeLockReason={options.codeLockReason}
      isActive={options.isActive}
      isDirty={isDirty}
      isSaving={warehouseWrite.isSaving}
      lookups={formLookups}
      onSave={handleSaveWarehouse}
      onCancel={() => {
        setLocalFieldErrors({});
        warehouseWrite.reset();
        setFormState((prev) => (prev === null ? prev : { ...prev, values: prev.baseline }));
      }}
      onDeactivate={() => {
        deactivateWrite.reset();
        setIsDeactivateOpen(true);
      }}
    />
  );

  /**
   * 우측 페인. 상세를 받지 못한 상태에서 빈 폼을 보이면 사용자가 그것을 자료로 읽는다 —
   * 선택 전·불러오는 중·실패를 각각 다른 화면으로 낸다.
   */
  const renderDetailPane = () => {
    /*
     * 신규 등록에는 Location 탭을 두지 않는다. 아직 만들어지지 않은 창고에는
     * 위치를 붙일 대상이 없다.
     */
    if (isCreateMode) {
      return (
        <div className="pane">
          {renderWarehouseForm({ mode: 'create', codeLockReason: null, isActive: true })}
        </div>
      );
    }

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
              content: renderWarehouseForm({
                mode: 'edit',
                codeLockReason: codeLockMessage(detail.data.editability),
                isActive: selectedWarehouse.isActive,
              }),
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
            warehouseWrite.reset();
            setLocalFieldErrors({});
            updateParams({ wh: String(warehouseId), mode: null });
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

      <DeactivateConfirmDialog
        open={isDeactivateOpen}
        onClose={() => setIsDeactivateOpen(false)}
        onConfirm={() => deactivateWrite.write(undefined)}
        isSaving={deactivateWrite.isSaving}
        // 충돌은 상세를 다시 받아 잠금 토큰을 갱신하면 풀린다. 버릴 입력이 없다.
        banner={<SaveErrorBanner error={deactivateWrite.error} onReload={handleReloadDetail} />}
      />

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
