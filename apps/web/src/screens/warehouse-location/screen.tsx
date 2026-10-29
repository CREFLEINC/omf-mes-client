import { AlertBanner, Button, EmptyState, SkeletonText, Tabs, useToast } from '@crefle/web-ui';
import type { ApiError, components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { BoardFrame } from '../../patterns/board-frame';
import { LOCATION_LEVEL_CODES } from '../../patterns/location-level';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { runRequest, toApiError } from '../../patterns/request';
import { isPutawayStaging, isSystemLocation } from '../../patterns/system-location';
import { selectableOptions } from './code-options';
import { DeactivateConfirmDialog } from './deactivate-confirm-dialog';
import { issueLocationCode } from './location-code';
import { LocationFormDialog } from './location-form-dialog';
import { RackLayoutDialog } from './rack-layout-dialog';
import { LocationLabelDialog, type LocationLabelPreview } from './location-label-dialog';
import { LocationLabelIssueDialog } from './location-label-issue-dialog';
import { LocationPane } from './location-pane';
import { buildLocationRows } from './location-tree';
import { LOCATION_FORM_FIELDS, validateLocation } from './location-validation';
import {
  emptyLocationFormValues,
  emptyWarehouseFormValues,
  isSameWarehouseValues,
  locationOptionLabel,
  locationToFormValues,
  toLocationCreate,
  toLocationUpdate,
  toWarehouseCreate,
  toWarehouseUpdate,
  warehouseToFormValues,
} from './mappers';
import {
  isTruncated,
  locationDetailPath,
  locationKeys,
  useLocationDetail,
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
import { PutawayRulePanel } from '../putaway-rule/screen';
import { WarehouseFormPane } from './warehouse-form-pane';
import { WarehouseFilterBar } from './warehouse-filter-bar';
import { WarehouseListPane } from './warehouse-list-pane';
import { WAREHOUSE_FORM_FIELDS, validateWarehouse } from './warehouse-validation';

const t = messages.warehouseLocation;

/** 적치 규칙 탭이 주소에 두는 키 — 다른 창고로 옮기거나 새 창고를 열면 함께 지운다. */
const PUTAWAY_PARAMS_CLEARED = { item: null, active: null, page: null, rule: null, new: null };

type WarehouseDetailResponse = components['schemas']['WarehouseDetailResponse'];
type LocationDetailResponse = components['schemas']['LocationDetailResponse'];
type DocumentIssueCreate = components['schemas']['DocumentIssueCreate'];
type DocumentIssueBatchResponse = components['schemas']['DocumentIssueBatchResponse'];
type DocumentIssueSummaryResponse = components['schemas']['DocumentIssueSummaryResponse'];

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

/** Location 다이얼로그가 무엇을 다루는지. 계층 값은 폼이 소유한다. */
interface LocationDialogState {
  open: boolean;
  mode: 'create' | 'edit';
  locationId: number | null;
}

const CLOSED_LOCATION_DIALOG: LocationDialogState = {
  open: false,
  mode: 'create',
  locationId: null,
};

/**
 * 위치 계층은 창고가 아니라 위치가 정한다(사용자 결정 2026-10-29 · 서버 위치 계층 계약): 구역(0) › 랙(1) › 층(2) ›
 * 셀(3). 구역은 늘 창고 바로 밑이고(구역 안에 구역은 없다), 그 밑은 한 단계씩이다.
 */
const ZONE_DEPTH = 0;
const RACK_DEPTH = 1;

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
      // 서버가 빈 message를 주는 일이 실제로 있다. ??는 빈 문자열을 통과시켜 본문을 지운다.
      return error.message === undefined || error.message === ''
        ? messages.httpError.description
        : error.message;
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
  const { client, baseUrl, etags } = useApiClient();

  const tabParam = searchParams.get('tab');
  const requestedTab =
    tabParam === 'location' || tabParam === 'putaway' ? tabParam : ('warehouse' as const);

  const filters = useMemo<WarehouseFilters>(
    () => ({
      q: searchParams.get('q') ?? '',
      plantId: searchParams.get('plant') ?? '',
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
  const isDirty =
    formState !== null && !isSameWarehouseValues(formState.values, formState.baseline);

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

  const [warehouseStatusOpen, setWarehouseStatusOpen] = useState(false);

  const warehouseStatusWrite = useMasterWrite<void, Warehouse>({
    request: (_variables, headers) =>
      detail.data?.warehouse.isActive === false
        ? client.POST('/mdm/warehouses/{warehouseId}:activate', {
            params: {
              path: { warehouseId: selectedWarehouseId ?? 0 },
              header: {
                'Idempotency-Key': headers['Idempotency-Key'],
                'If-Match': headers['If-Match'] ?? '',
              },
            },
          })
        : client.POST('/mdm/warehouses/{warehouseId}:deactivate', {
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
      setWarehouseStatusOpen(false);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const [locationFilterText, setLocationFilterText] = useState('');
  const locations = useLocationList(selectedWarehouseId, locationFilterText);
  const locationItems = useMemo(() => locations.data?.items ?? [], [locations.data]);
  /* 검색 결과와 별도로 완전한 계층을 유지해야 부모 후보·깊이 판정이 검색어에 흔들리지 않는다. */
  const locationHierarchy = useLocationList(selectedWarehouseId, '');
  const hierarchyItems = useMemo(
    () => locationHierarchy.data?.items ?? [],
    [locationHierarchy.data],
  );

  const [expansion, setExpansion] = useState<{
    warehouseId: number;
    /** 이 펼침을 정한 검색어 — 검색어가 바뀌면 다시 정한다. */
    q: string;
    ids: ReadonlySet<number>;
  } | null>(null);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [dialogState, setDialogState] = useState<LocationDialogState>(CLOSED_LOCATION_DIALOG);
  const [locationValues, setLocationValues] = useState<LocationFormValues>(emptyLocationFormValues);
  const [locationFieldErrors, setLocationFieldErrors] = useState<Record<string, string>>({});
  const [locationFormSource, setLocationFormSource] = useState<LocationDetailResponse | null>(null);
  const [locationSourceEtag, setLocationSourceEtag] = useState<string | null>(null);

  /*
   * 편집 다이얼로그를 열 때만 상세를 조회한다. 목록 응답에는 잠금 토큰도 코드 편집 가능 여부도 없다.
   * 다이얼로그의 초기값은 목록 행에서 오고, 이 조회는 그 둘을 확보하는 데만 쓴다.
   */
  const locationDetail = useLocationDetail(dialogState.open ? dialogState.locationId : null);

  /* 폼 값과 ETag는 반드시 같은 상세 응답에서 시작해야 최신 ETag로 오래된 목록값을 덮지 않는다. */
  if (
    dialogState.open &&
    dialogState.mode === 'edit' &&
    !locationDetail.isFetching &&
    locationDetail.data !== undefined &&
    locationFormSource === null
  ) {
    setLocationFormSource(locationDetail.data);
    setLocationSourceEtag(
      dialogState.locationId === null
        ? null
        : (etags.ifMatch(locationDetailPath(dialogState.locationId)) ?? null),
    );
    setLocationValues(locationToFormValues(locationDetail.data.location));
  }

  const locationWrite = useMasterWrite<LocationFormValues, Location>({
    request: (values, headers) =>
      dialogState.mode === 'create'
        ? client.POST('/mdm/locations', {
            params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
            body: toLocationCreate(values, selectedWarehouseId ?? 0),
          })
        : client.PUT('/mdm/locations/{locationId}', {
            params: {
              path: { locationId: dialogState.locationId ?? 0 },
              header: {
                'Idempotency-Key': headers['Idempotency-Key'],
                'If-Match': locationSourceEtag ?? '',
              },
            },
            /* 저장된 위치명 · 별칭과 견줘 위치명을 정한다 — 편집은 상세를 받은 뒤에만 저장할 수 있다. */
            body: toLocationUpdate(values, locationFormSource?.location ?? { locationName: '' }),
          }),
    etagPath:
      dialogState.mode === 'edit' && dialogState.locationId !== null
        ? locationDetailPath(dialogState.locationId)
        : null,
    invalidateKeys: [locationKeys.all],
    knownFields: LOCATION_FORM_FIELDS,
    onSuccess: (saved) => {
      setDialogState(CLOSED_LOCATION_DIALOG);
      setLocationFieldErrors({});
      toast.show({
        variant: 'success',
        description:
          dialogState.mode === 'create' ? messages.common.created : messages.common.saved,
      });

      // 하위로 등록했으면 그 부모를 펼쳐 둔다. 접혀 있으면 방금 만든 것이 행으로 나오지 않는다.
      const parentId = saved.parentLocationId;
      if (parentId !== null && parentId !== undefined) {
        setExpansion((prev) =>
          prev === null ? prev : { ...prev, ids: new Set([...prev.ids, parentId]) },
        );
      }
    },
  });

  const locationStatusMode =
    locationDetail.data?.location.isActive === false ? 'activate' : 'deactivate';
  const [locationStatusOpen, setLocationStatusOpen] = useState(false);
  const locationStatusWrite = useMasterWrite<void, Location>({
    request: (_variables, headers) =>
      locationStatusMode === 'activate'
        ? client.POST('/mdm/locations/{locationId}:activate', {
            params: {
              path: { locationId: dialogState.locationId ?? 0 },
              header: {
                'Idempotency-Key': headers['Idempotency-Key'],
                'If-Match': locationSourceEtag ?? '',
              },
            },
          })
        : client.POST('/mdm/locations/{locationId}:deactivate', {
            params: {
              path: { locationId: dialogState.locationId ?? 0 },
              header: {
                'Idempotency-Key': headers['Idempotency-Key'],
                'If-Match': locationSourceEtag ?? '',
              },
            },
          }),
    etagPath: dialogState.locationId === null ? null : locationDetailPath(dialogState.locationId),
    invalidateKeys: [locationKeys.all],
    knownFields: [],
    onSuccess: () => {
      setLocationStatusOpen(false);
      setDialogState(CLOSED_LOCATION_DIALOG);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const [labelPreviews, setLabelPreviews] = useState<LocationLabelPreview[] | null>(null);
  const [pendingLabelIds, setPendingLabelIds] = useState<number[] | null>(null);
  const [labelReasonCode, setLabelReasonCode] = useState('');
  const [reissueCount, setReissueCount] = useState(0);
  const labelWrite = useMasterWrite<DocumentIssueCreate, DocumentIssueBatchResponse>({
    request: (body, headers) =>
      client.POST('/app/document-issues', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [],
    knownFields: [],
    keyLifetime: 'until-applied',
    onSuccess: (result) => {
      setPendingLabelIds(null);
      setLabelPreviews(
        result.items.map((issue) => {
          const location = locationItems.find((item) => item.locationId === issue.target.targetId);
          return {
            documentIssueLogId: issue.documentIssueLogId,
            locationCode: location?.locationCode ?? String(issue.target.targetId),
            issueSeq: issue.issueSeq,
          };
        }),
      );
      toast.show({ variant: 'success', description: t.labelPreview.created(result.issuedCount) });
    },
  });

  const issueLocationLabels = (locationIds: number[], reissueReasonCode?: string): void => {
    labelWrite.write({
      documentTypeCode: 'LOCATION_LABEL',
      targets: locationIds.map((targetId) => ({ targetTypeCode: 'LOCATION', targetId })),
      ...(reissueReasonCode === undefined ? {} : { reissueReasonCode }),
    });
  };

  const labelSummary = useMutation({
    mutationFn: (locationIds: number[]) =>
      runRequest(() =>
        client.GET('/app/document-issues/summary', {
          params: {
            query: {
              targetTypeCode: 'LOCATION',
              targetIds: locationIds,
              documentTypeCode: 'LOCATION_LABEL',
            },
          },
        }),
      ) as Promise<DocumentIssueSummaryResponse>,
    onSuccess: (result, locationIds) => {
      const alreadyIssued = result.items.filter((item) => item.issueCount > 0).length;
      if (alreadyIssued === 0) {
        issueLocationLabels(locationIds);
        return;
      }

      setPendingLabelIds(locationIds);
      setReissueCount(alreadyIssued);
      setLabelReasonCode('');
    },
  });

  const selectedWarehouse = detail.data?.warehouse ?? null;

  /* 창고 관리 수준이 없어져(2026-10-29) Location 탭은 늘 열린다 — 위치가 없는 창고는 창고 단위로 관리된다. */
  const activeTab = requestedTab;

  /**
   * 처음 펼칠 노드. 검색하지 않을 때는 구역(맨 위)만 펼쳐 랙까지 보인다 — 랙이 백 개를 넘으면 층 · 셀까지 다 펼친
   * 표는 수천 행이 된다(사용자 지시 2026-10-29). 검색 중에는 찾은 위치가 묻히지 않게 하위를 가진 노드를 다 펼친다.
   */
  const initialExpandedIds = useMemo(() => {
    const known = new Set(locationItems.map((item) => item.locationId));
    const parents = new Set<number>();
    const isRoot = (item: Location): boolean =>
      item.parentLocationId === null ||
      item.parentLocationId === undefined ||
      item.parentLocationId === item.locationId ||
      !known.has(item.parentLocationId);
    const rootIds = new Set(locationItems.filter(isRoot).map((item) => item.locationId));

    for (const item of locationItems) {
      const parentId = item.parentLocationId;
      // 자기참조는 부모로 세지 않는다 — buildLocationRows가 그것을 최상위로 올린다.
      if (
        parentId !== null &&
        parentId !== undefined &&
        parentId !== item.locationId &&
        known.has(parentId) &&
        (locationFilterText !== '' || rootIds.has(parentId))
      ) {
        parents.add(parentId);
      }
    }

    return parents;
  }, [locationItems, locationFilterText]);

  // 고른 창고나 검색어가 바뀌면 펼침 상태를 다시 계산한다. 같은 조건을 다시 조회할 때는 사용자의 접기를 지킨다.
  if (
    locations.data !== undefined &&
    selectedWarehouseId !== null &&
    (expansion?.warehouseId !== selectedWarehouseId || expansion.q !== locationFilterText)
  ) {
    setExpansion({
      warehouseId: selectedWarehouseId,
      q: locationFilterText,
      ids: initialExpandedIds,
    });
  }

  const expandedIds = expansion?.ids ?? NO_EXPANDED_IDS;

  const locationRows = useMemo(
    () => buildLocationRows(locationItems, expandedIds),
    [locationItems, expandedIds],
  );

  const allLocationRows = useMemo(
    () => buildLocationRows(hierarchyItems, new Set(hierarchyItems.map((item) => item.locationId))),
    [hierarchyItems],
  );
  const locationDepthById = useMemo(
    () => new Map(allLocationRows.map((row) => [row.location.locationId, row.depth])),
    [allLocationRows],
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
      plant: next.plantId === '' ? null : next.plantId,
      type: next.warehouseTypeCode === '' ? null : next.warehouseTypeCode,
      inactive: next.includeInactive ? '1' : null,
    });
  };

  // 신규 등록은 선택을 지운다 — 어느 창고의 상세도 아닌 새 폼이다.
  const handleAddWarehouse = () => {
    warehouseWrite.reset();
    setLocalFieldErrors({});
    setSelectedLocationIds([]);
    setLocationFilterText('');
    setDialogState(CLOSED_LOCATION_DIALOG);
    setLocationFormSource(null);
    setLocationSourceEtag(null);
    setPendingLabelIds(null);
    setLabelPreviews(null);
    labelSummary.reset();
    labelWrite.reset();
    updateParams({ mode: 'create', wh: null, tab: 'warehouse', ...PUTAWAY_PARAMS_CLEARED });
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

  const handleReloadLocationDetail = () => {
    locationWrite.reset();
    locationStatusWrite.reset();
    setLocationFieldErrors({});
    setLocationFormSource(null);
    setLocationSourceEtag(null);
    void locationDetail.refetch().then((result) => {
      if (result.data !== undefined) {
        setLocationFormSource(result.data);
        setLocationSourceEtag(
          dialogState.locationId === null
            ? null
            : (etags.ifMatch(locationDetailPath(dialogState.locationId)) ?? null),
        );
        setLocationValues(locationToFormValues(result.data.location));
      }
    });
  };

  /**
   * 선택 목록이 잘리거나 실패했다는 사실을 폼 위에 낸다.
   * 알리지 않으면 선택칸이 이유 없이 비어 보이고 사용자는 값이 사라진 줄 안다.
   */
  const lookupNotice = (() => {
    if (lookups.isError) {
      return (
        <div className="banner-slot warehouse-location-lookup-notice">
          <AlertBanner variant="warning">{t.optionsLoadFailed}</AlertBanner>
        </div>
      );
    }

    if (lookups.truncated) {
      return (
        <div className="banner-slot warehouse-location-lookup-notice">
          <AlertBanner variant="warning">{t.optionsTruncated}</AlertBanner>
        </div>
      );
    }

    return null;
  })();

  /** 선택 목록은 사용 중인 것과 지금 선택된 값만 낸다 — 값이 사라진 것처럼 보이면 안 된다. */
  const formLookups: LookupOptions = {
    plants: selectableOptions(lookups.sources.plants, formValues.plantId),
    businessUnits: selectableOptions(lookups.sources.businessUnits, formValues.businessUnitId),
    warehouseTypes: selectableOptions(lookups.sources.warehouseTypes, formValues.warehouseTypeCode),
    locationTypes: selectableOptions(
      lookups.sources.locationTypes,
      locationValues.locationTypeCode,
    ),
    reissueReasons: selectableOptions(lookups.sources.reissueReasons, ''),
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

  /** 추가 — 상위는 단추가 정한다(구역 추가는 창고 밑, 랙 추가는 고른 구역 밑). 코드는 여기서 발행한다. */
  const openCreateLocation = (parentLocationId: number | null) => {
    const parent =
      parentLocationId === null
        ? null
        : (hierarchyItems.find((item) => item.locationId === parentLocationId) ?? null);
    const parentDepth = parent === null ? -1 : (locationDepthById.get(parent.locationId) ?? -1);
    const level = LOCATION_LEVEL_CODES[parentDepth + 1] ?? 'ZONE';
    locationWrite.reset();
    setLocationFieldErrors({});
    setLocationFormSource(null);
    setLocationSourceEtag(null);
    setLocationValues({
      ...emptyLocationFormValues(),
      parentLocationId: parentLocationId === null ? '' : String(parentLocationId),
      locationCode: issueLocationCode(level, parent, hierarchyItems),
    });
    setDialogState({
      open: true,
      mode: 'create',
      locationId: null,
    });
  };

  const handleEditLocation = (location: Location) => {
    locationWrite.reset();
    setLocationFieldErrors({});
    setLocationFormSource(null);
    setLocationSourceEtag(null);
    setLocationValues(locationToFormValues(location));
    setDialogState({
      open: true,
      mode: 'edit',
      locationId: location.locationId,
    });
  };

  const changeLocationValues = (patch: Partial<LocationFormValues>) => {
    setLocationValues((prev) => ({ ...prev, ...patch }));

    for (const field of Object.keys(patch)) {
      locationWrite.clearFieldError(field);
      setLocationFieldErrors((prev) => {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSaveLocation = () => {
    const errors = validateLocation(locationValues);
    const parentId = Number(locationValues.parentLocationId) || null;
    const parentDepth = parentId === null ? -1 : locationDepthById.get(parentId);
    const currentDepth =
      dialogState.locationId === null ? undefined : locationDepthById.get(dialogState.locationId);

    /* 상위는 같은 단계의 다른 상위로만 바뀐다 — 단계가 바뀌면 서버가 거절한다(위치 계층 계약). */
    if (parentDepth === undefined) {
      errors.parentLocationId = t.validation.parentLocationUnavailable;
    } else if (currentDepth !== undefined && parentDepth + 1 !== currentDepth) {
      errors.parentLocationId = t.validation.locationLevelChanged;
    }
    setLocationFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;

    locationWrite.write(locationValues);
  };

  const selectedLocationId = Number(selectedLocationIds[0] ?? '') || null;

  const unavailableParentIds = useMemo(() => {
    const unavailable = new Set<number>();
    if (dialogState.locationId === null) return unavailable;

    unavailable.add(dialogState.locationId);
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of hierarchyItems) {
        if (
          item.parentLocationId !== null &&
          item.parentLocationId !== undefined &&
          unavailable.has(item.parentLocationId) &&
          !unavailable.has(item.locationId)
        ) {
          unavailable.add(item.locationId);
          changed = true;
        }
      }
    }
    return unavailable;
  }, [dialogState.locationId, hierarchyItems]);

  const selectedLocationRow = allLocationRows.find(
    (row) => String(row.location.locationId) === selectedLocationIds[0],
  );
  const canAddRootLocation = selectedWarehouse !== null && locationHierarchy.data !== undefined;
  /*
   * 단추는 단계로 나눈다(사용자 지시 2026-10-29) — 구역은 창고 밑에, 랙은 고른 구역 밑에, 층 · 셀은 고른 랙에서
   * 한꺼번에 짠다. 시스템 자리(창고 전체 · 적치 대기) 밑에는 달 수 없다(서버 400 INVALID).
   */
  const selectedUserLocationDepth =
    selectedLocationIds.length === 1 &&
    selectedLocationRow !== undefined &&
    !isSystemLocation(selectedLocationRow.location) &&
    locationHierarchy.data !== undefined
      ? selectedLocationRow.depth
      : null;
  const canAddChildLocation = selectedUserLocationDepth === ZONE_DEPTH;
  const canConfigureRack = selectedUserLocationDepth === RACK_DEPTH;
  const [rackLayoutTarget, setRackLayoutTarget] = useState<Location | null>(null);
  const createParentDepth =
    locationValues.parentLocationId === ''
      ? -1
      : locationDepthById.get(Number(locationValues.parentLocationId));
  const createLocationTitle =
    createParentDepth === -1
      ? t.dialog.createZoneTitle
      : createParentDepth === ZONE_DEPTH
        ? t.dialog.createRackTitle
        : undefined;

  /** 다이얼로그가 어느 창고의 Location을 다루는지 값으로 밝힌다. */
  const warehouseLabel =
    selectedWarehouse === null
      ? ''
      : `${selectedWarehouse.warehouseCode} · ${selectedWarehouse.warehouseName}`;

  /*
   * 상위 위치(사용자 지시 2026-10-29 — 「최상위」는 없다). 추가는 단추가 상위를 정해 글자로만 보인다. 구역 · 서버가
   * 만든 위치는 창고 바로 밑이라 고칠 때도 글자다. 랙 · 층 · 셀을 고칠 때만 지금 상위와 같은 단계(한 단계 위)의
   * 사람이 만든 위치 가운데서 고른다 — 자기 자신과 하위는 뺀다.
   */
  const editingLocation =
    dialogState.mode === 'edit' && dialogState.locationId !== null
      ? hierarchyItems.find((item) => item.locationId === dialogState.locationId)
      : undefined;
  const editingDepth =
    dialogState.locationId === null ? undefined : locationDepthById.get(dialogState.locationId);
  const parentSelectable =
    dialogState.mode === 'edit' &&
    editingDepth !== undefined &&
    editingDepth > ZONE_DEPTH &&
    (editingLocation === undefined || !isSystemLocation(editingLocation)) &&
    (locationDetail.data === undefined || !isSystemLocation(locationDetail.data.location));

  const parentOptions = parentSelectable
    ? allLocationRows
        .filter(
          (row) =>
            !unavailableParentIds.has(row.location.locationId) &&
            row.depth === (editingDepth ?? 0) - 1 &&
            !isSystemLocation(row.location),
        )
        .map((row) => ({
          value: String(row.location.locationId),
          label: locationOptionLabel(row.location),
        }))
    : null;

  /*
   * 서버 검색 결과나 페이지 한도 때문에 현재 부모가 목록 밖일 수 있다. 이 경우 Select가
   * 빈 값처럼 보이지 않도록 현재 참조를 보존하되, 내부 ID를 업무명처럼 노출하지 않는다.
   */
  if (
    parentOptions !== null &&
    locationValues.parentLocationId !== '' &&
    !parentOptions.some((option) => option.value === locationValues.parentLocationId)
  ) {
    parentOptions.push({
      value: locationValues.parentLocationId,
      label: t.values.currentParentOutsideList,
    });
  }

  const fixedParent =
    locationValues.parentLocationId === ''
      ? undefined
      : hierarchyItems.find((item) => String(item.locationId) === locationValues.parentLocationId);
  const parentLabel =
    locationValues.parentLocationId === ''
      ? warehouseLabel
      : fixedParent === undefined
        ? t.values.currentParentOutsideList
        : locationOptionLabel(fixedParent);

  const listPage = warehouseList.data?.page;
  const listTruncated = listPage !== undefined && isTruncated(listPage, warehouses.length);

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
        warehouseStatusWrite.reset();
        setWarehouseStatusOpen(true);
      }}
      onActivate={() => {
        warehouseStatusWrite.reset();
        setWarehouseStatusOpen(true);
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
        <div>{renderWarehouseForm({ mode: 'create', codeLockReason: null, isActive: true })}</div>
      );
    }

    if (selectedWarehouseId === null) {
      return (
        <div>
          <EmptyState
            size="sm"
            title={t.empty.warehouseNotSelectedTitle}
            description={t.empty.warehouseNotSelectedDescription}
          />
        </div>
      );
    }

    if (detail.isError) {
      return (
        <div>
          <LoadErrorBanner error={detail.error} onRetry={() => void detail.refetch()} />
        </div>
      );
    }

    if (detail.data === undefined || formState === null || selectedWarehouse === null) {
      return (
        <div>
          <div role="status" aria-label={t.loading.warehouseDetail}>
            <SkeletonText lines={5} />
          </div>
        </div>
      );
    }

    return (
      <div>
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
                codeLockReason: null,
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
                  onFilterTextChange={(value) => {
                    setLocationFilterText(value);
                    setSelectedLocationIds([]);
                  }}
                  canAddRoot={canAddRootLocation}
                  addRootDisabledReason={t.actionReasons.locationHierarchyUnavailable}
                  onAddRoot={() => openCreateLocation(null)}
                  canAddChild={canAddChildLocation}
                  onAddChild={() => openCreateLocation(selectedLocationId)}
                  canConfigureRack={canConfigureRack}
                  onConfigureRack={() => setRackLayoutTarget(selectedLocationRow?.location ?? null)}
                  onEdit={handleEditLocation}
                  onGenerateLabels={() =>
                    labelSummary.mutate(selectedLocationIds.map((id) => Number(id)))
                  }
                  isGeneratingLabels={labelSummary.isPending || labelWrite.isSaving}
                  actionBanner={
                    <>
                      {locations.data !== undefined &&
                        isTruncated(locations.data.page, locationItems.length) && (
                          <div className="banner-slot">
                            <AlertBanner variant="warning">
                              {t.listTruncated(locationItems.length, locations.data.page.total)}
                            </AlertBanner>
                          </div>
                        )}
                      {locationFilterText !== '' && locationHierarchy.isError && (
                        <LoadErrorBanner
                          error={locationHierarchy.error}
                          onRetry={() => void locationHierarchy.refetch()}
                        />
                      )}
                      {labelSummary.isError && (
                        <LoadErrorBanner
                          error={labelSummary.error}
                          onRetry={() =>
                            labelSummary.mutate(
                              labelSummary.variables ?? selectedLocationIds.map((id) => Number(id)),
                            )
                          }
                        />
                      )}
                      <SaveErrorBanner error={labelWrite.error} />
                    </>
                  }
                />
              ),
            },
            {
              value: 'putaway',
              label: t.tabs.putaway,
              /*
               * 적치 규칙은 창고 상세 안에서 관리한다(사용자 지시 2026-10-29) — 고르기 · 고치기는 대화상자.
               * 탭 패널은 숨겨져도 붙어 있으므로 이 탭일 때만 붙인다 — 아니면 다른 탭에서도 규칙 · 잔액 · 위치 조회가 나간다.
               */
              content: activeTab === 'putaway' ? <PutawayRulePanel /> : null,
            },
          ]}
        />
      </div>
    );
  };

  return (
    <>
      <BoardFrame
        splitKey="omf-mes:warehouse-location:split"
        initialRatio={0.45}
        splitter={{ label: t.splitter, collapseLabel: t.listCollapse, expandLabel: t.listExpand }}
        above={{
          label: t.panes.filters,
          content: (
            <>
              {/*
               * 목록이 잘렸다는 사실을 감추지 않는다. 페이지 이동 컨트롤은 아직 없으므로
               * 조건을 좁히는 것이 사용자가 할 수 있는 조치다.
               */}
              {listTruncated && listPage !== undefined && (
                <AlertBanner variant="warning">
                  {t.listTruncated(warehouses.length, listPage.total)}
                </AlertBanner>
              )}
              <div className="pane po-board-filter">
                <WarehouseFilterBar
                  appliedFilters={filters}
                  onApplyFilters={handleApplyFilters}
                  onAddWarehouse={handleAddWarehouse}
                  warehouseTypeOptions={selectableOptions(
                    lookups.sources.warehouseTypes,
                    filters.warehouseTypeCode,
                  )}
                  plantOptions={selectableOptions(lookups.sources.plants, filters.plantId)}
                />
              </div>
            </>
          ),
        }}
        list={{
          label: t.panes.list,
          content: (
            <WarehouseListPane
              items={warehouses}
              isLoading={warehouseList.isPending}
              appliedFilters={filters}
              onApplyFilters={handleApplyFilters}
              selectedWarehouseId={selectedWarehouseId}
              onSelect={(warehouseId) => {
                warehouseWrite.reset();
                setLocalFieldErrors({});
                setSelectedLocationIds([]);
                setLocationFilterText('');
                setDialogState(CLOSED_LOCATION_DIALOG);
                setLocationFormSource(null);
                setLocationSourceEtag(null);
                setPendingLabelIds(null);
                setLabelPreviews(null);
                labelSummary.reset();
                labelWrite.reset();
                updateParams({ wh: String(warehouseId), mode: null, ...PUTAWAY_PARAMS_CLEARED });
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
              warehouseTypeOptions={selectableOptions(
                lookups.sources.warehouseTypes,
                filters.warehouseTypeCode,
              )}
              plants={lookups.sources.plants}
            />
          ),
        }}
        detail={{ label: t.panes.detail, content: renderDetailPane() }}
      />

      <DeactivateConfirmDialog
        open={warehouseStatusOpen}
        onClose={() => setWarehouseStatusOpen(false)}
        onConfirm={() => warehouseStatusWrite.write(undefined)}
        isSaving={warehouseStatusWrite.isSaving}
        mode={selectedWarehouse?.isActive === false ? 'activate' : 'deactivate'}
        // 충돌은 상세를 다시 받아 잠금 토큰을 갱신하면 풀린다. 버릴 입력이 없다.
        banner={
          <SaveErrorBanner error={warehouseStatusWrite.error} onReload={handleReloadDetail} />
        }
      />

      <RackLayoutDialog
        rack={rackLayoutTarget}
        warehouseId={selectedWarehouseId ?? 0}
        items={hierarchyItems}
        onClose={() => setRackLayoutTarget(null)}
      />

      <LocationFormDialog
        open={dialogState.open}
        onClose={() => {
          setDialogState(CLOSED_LOCATION_DIALOG);
          setLocationFormSource(null);
          setLocationSourceEtag(null);
        }}
        mode={dialogState.mode}
        {...(createLocationTitle === undefined ? {} : { createTitle: createLocationTitle })}
        warehouseLabel={warehouseLabel}
        parentOptions={parentOptions}
        parentLabel={parentLabel}
        values={locationValues}
        onChange={changeLocationValues}
        fieldErrors={{ ...locationWrite.fieldErrors, ...locationFieldErrors }}
        banner={
          <>
            {dialogState.mode === 'edit' && locationDetail.isFetching && (
              <div className="banner-slot">
                <AlertBanner variant="info">{t.loading.locationDetail}</AlertBanner>
              </div>
            )}
            {dialogState.mode === 'edit' && locationDetail.isError && (
              <LoadErrorBanner error={locationDetail.error} onRetry={handleReloadLocationDetail} />
            )}
            <SaveErrorBanner
              error={locationWrite.error}
              onReload={dialogState.mode === 'edit' ? handleReloadLocationDetail : undefined}
            />
          </>
        }
        systemLocked={
          locationDetail.data !== undefined && isSystemLocation(locationDetail.data.location)
        }
        canToggleActive={
          locationDetail.data === undefined || !isPutawayStaging(locationDetail.data.location)
        }
        locationTypeOptions={formLookups.locationTypes}
        isActive={locationDetail.data?.location.isActive ?? true}
        isReady={
          locationHierarchy.data !== undefined &&
          (dialogState.mode === 'create' ||
            (locationFormSource !== null &&
              locationSourceEtag !== null &&
              !locationDetail.isFetching))
        }
        onToggleActive={() => {
          locationStatusWrite.reset();
          setLocationStatusOpen(true);
        }}
        isSaving={locationWrite.isSaving}
        onSave={handleSaveLocation}
      />

      <DeactivateConfirmDialog
        open={locationStatusOpen}
        onClose={() => setLocationStatusOpen(false)}
        onConfirm={() => locationStatusWrite.write(undefined)}
        isSaving={locationStatusWrite.isSaving}
        mode={locationStatusMode}
        banner={
          <SaveErrorBanner
            error={locationStatusWrite.error}
            onReload={handleReloadLocationDetail}
          />
        }
      />

      {labelPreviews !== null && (
        <LocationLabelDialog
          previews={labelPreviews}
          baseUrl={baseUrl}
          onClose={() => setLabelPreviews(null)}
        />
      )}

      {pendingLabelIds !== null && (
        <LocationLabelIssueDialog
          count={reissueCount}
          reasonCode={labelReasonCode}
          reasonOptions={formLookups.reissueReasons}
          reasonError={labelWrite.fieldErrors.reissueReasonCode}
          isSaving={labelWrite.isSaving}
          onReasonChange={(value) => {
            setLabelReasonCode(value);
            labelWrite.clearFieldError('reissueReasonCode');
          }}
          onConfirm={() => issueLocationLabels(pendingLabelIds, labelReasonCode)}
          onClose={() => setPendingLabelIds(null)}
          banner={<SaveErrorBanner error={labelWrite.error} />}
        />
      )}
    </>
  );
};
