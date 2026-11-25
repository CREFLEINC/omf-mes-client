import { AlertBanner, EmptyState, SkeletonText, useToast } from '@crefle/web-ui';
import { type components, createIdempotencyKey } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { BoardFrame } from '../../patterns/board-frame';
import {
  buildLocationRows,
  initialExpandedLocationIds,
  parentLocationIds,
} from '../../patterns/location-tree';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { ApiRequestError, runRequest } from '../../patterns/request';
import { isPutawayStaging, isSystemLocation } from '../../patterns/system-location';
import { visibleWarehouses, WarehouseFilterBar } from '../../patterns/warehouse-filter-bar';
import { LoadErrorBanner } from '../../patterns/load-error-banner';
import { BulkCreateDialog } from './bulk-create-dialog';
import { selectableOptions } from './code-options';
import { DeactivateConfirmDialog } from './deactivate-confirm-dialog';
import { generateLocationPrefix } from './location-prefix';
import { LocationDeleteDialog } from './location-delete-dialog';
import { countSubtree } from './location-identity';
import { LocationFormDialog } from './location-form-dialog';
import {
  draftItemIds,
  isItemsDraftChanged,
  type LocationItemsDraft,
  LocationItemsSection,
  RestrictionToggle,
} from './location-items-section';
import { itemTypesForWarehouse } from './item-scope';
import { RackCreateDialog, type RackLeafItems } from './rack-create-dialog';
import { LocationLabelDialog, type LocationLabelPreview } from './location-label-dialog';
import { LocationLabelIssueDialog } from './location-label-issue-dialog';
import { LocationLabelSection } from './location-label-section';
import { LocationPane } from './location-pane';
import { locationCountText, summarizeLocations } from './location-summary';
import { LOCATION_FORM_FIELDS, validateLocation } from './location-validation';
import {
  emptyLocationFormValues,
  emptyWarehouseFormValues,
  isSameLocationValues,
  isSameWarehouseValues,
  locationAliasOrCode,
  locationToFormValues,
  toLocationUpdate,
  toWarehouseCreate,
  toWarehouseUpdate,
  warehouseToFormValues,
} from './mappers';
import {
  isTruncated,
  locationDetailPath,
  locationKeys,
  locationLabelKeys,
  useLocationDetail,
  useLocationItems,
  useCanEditLayout,
  useLocationList,
  useCanWriteLocations,
  useLookupOptions,
  useWarehouseDetail,
  useWarehouseList,
  useWarehouseStockSummary,
  warehouseDetailPath,
  warehouseKeys,
} from './queries';
import type {
  Location,
  LocationFormValues,
  LocationItem,
  LookupOptions,
  Warehouse,
  WarehouseFilters,
  WarehouseFormValues,
} from './types';
import {
  buildLeafLocationRows,
  LOCATION_VIEW_PARAM,
  parentPathOf,
  readLocationViewMode,
} from './leaf-rows';
import { WarehouseEditDialog } from './warehouse-edit-dialog';
import { WarehouseFormPane } from './warehouse-form-pane';
import { WarehouseHeader } from './warehouse-header';
import { WarehouseListPane } from './warehouse-list-pane';
import { WAREHOUSE_FORM_FIELDS, validateWarehouse } from './warehouse-validation';

const t = messages.warehouseLocation;

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

/**
 * Location 수정 창이 어느 위치를 다루는지. 위치는 [Location 추가](일괄 생성)와 랙 창으로만 만든다 — 하나씩 추가하는
 * 창은 없앴다(사용자 지시 2026-11-24). 계층 값은 폼이 소유한다.
 */
interface LocationDialogState {
  open: boolean;
  locationId: number | null;
}

const CLOSED_LOCATION_DIALOG: LocationDialogState = {
  open: false,
  locationId: null,
};

/**
 * 위치 계층은 창고가 아니라 위치가 정한다(사용자 결정 2026-10-29 · 서버 위치 계층 계약): 구역(0) › 랙(1) › 층(2) ›
 * 셀(3). 구역은 늘 창고 바로 밑이고(구역 안에 구역은 없다), 그 밑은 한 단계씩이다.
 */
const ZONE_DEPTH = 0;

/** 라벨 발행 · 발행 이력 집계 한 번의 상한(서버 1000건). 넘으면 일괄 출력을 막는다. */
const LABEL_BATCH_MAX = 1000;

/**
 * W-06-07 컨테이너. 목록·상세·Location 계층을 서버 응답으로 그리고
 * 조회 조건과 선택을 URL에 둔다.
 */
export const WarehouseLocationScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { client, etags, baseUrl } = useApiClient();
  const canWriteLocations = useCanWriteLocations();

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
  const warehouses = useMemo(
    () => visibleWarehouses(warehouseList.data?.items ?? [], filters),
    [warehouseList.data, filters],
  );
  const detail = useWarehouseDetail(selectedWarehouseId);
  const lookups = useLookupOptions();

  const [formState, setFormState] = useState<WarehouseFormState | null>(null);
  /** 창고 정보 수정 창(안 B, 사용자 결정 2026-11-24) — 창고 칸은 오른쪽 창이 아니라 이 창에서 고친다. */
  const [warehouseEditOpen, setWarehouseEditOpen] = useState(false);

  /*
   * 폼의 기준값은 상세 응답에서 온다. 응답 객체가 바뀔 때만 다시 세워
   * 사용자가 입력하는 동안 값이 서버 값으로 되돌아가지 않게 한다.
   * 캐시가 같은 값을 돌려주면 객체 동일성이 유지되므로 다시 세우지 않는다.
   */
  const formSource: WarehouseFormSource | null = isCreateMode
    ? CREATE_FORM_SOURCE
    : (detail.data ?? null);

  if (formSource !== null && formState?.source !== formSource) {
    /* 등록 폼은 창고 위치 코드를 무작위로 지어 채운다(#292) — 기준값에도 넣어 손대지 않은 폼이 「고친 것」이 아니다. */
    const seeded =
      formSource === CREATE_FORM_SOURCE
        ? { ...emptyWarehouseFormValues(), locationPrefix: generateLocationPrefix() }
        : warehouseToFormValues(formSource.warehouse);
    setFormState({ source: formSource, baseline: seeded, values: seeded });
  }

  /*
   * 등록에서 고를 공장이 하나뿐이면 미리 채운다 — 선택 목록이 늦게 와도 아직 고르지 않았을 때만. 기준값에도 넣어
   * 손대지 않은 등록 폼이 「고친 것」으로 읽히지 않게 한다.
   */
  const onlyPlant = (() => {
    const plants = selectableOptions(lookups.sources.plants, '');
    return plants.length === 1 ? plants[0]!.value : null;
  })();
  if (
    formState !== null &&
    formState.source === CREATE_FORM_SOURCE &&
    onlyPlant !== null &&
    formState.values.plantId === '' &&
    formState.baseline.plantId === ''
  ) {
    setFormState({
      ...formState,
      baseline: { ...formState.baseline, plantId: onlyPlant },
      values: { ...formState.values, plantId: onlyPlant },
    });
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
    /* 창고 위치 코드(#292) — 다른 창고가 쓰면 고칠 방법(다른 코드 · [다시 만들기])까지 말한다. */
    restateFieldError: (item) => {
      if (item.field !== 'locationPrefix') return undefined;
      if (item.code === 'UNIQUE_VIOLATION') return t.locationPrefix.taken;
      if (item.code === 'INVALID') return t.locationPrefix.invalid;
      return undefined;
    },
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
      setWarehouseEditOpen(false);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const [warehouseStatusOpen, setWarehouseStatusOpen] = useState(false);
  /* 창고를 끄기 전 남은 재고 — 사용 중지 확인 창을 열 때만 묻는다(사용자 지시 2026-10-30). */
  const stockSummary = useWarehouseStockSummary(
    selectedWarehouseId,
    warehouseStatusOpen && detail.data?.warehouse.isActive === true,
  );

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
  /** 일괄 생성 창 — 열 때만 그려 닫으면 입력 · 계획이 함께 사라진다(#267 R-3). */
  const [bulkCreateOpen, setBulkCreateOpen] = useState(false);
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
      client.PUT('/mdm/locations/{locationId}', {
        params: {
          path: { locationId: dialogState.locationId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': locationSourceEtag ?? '',
          },
        },
        /* 저장된 위치명 · 별칭과 견줘 위치명을 정한다 — 편집은 상세를 받은 뒤에만 저장할 수 있다. */
        body: toLocationUpdate(
          values,
          locationFormSource?.location ?? {
            locationName: '',
            aliasName: null,
            systemRoleCode: null,
          },
        ),
      }),
    etagPath: dialogState.locationId === null ? null : locationDetailPath(dialogState.locationId),
    invalidateKeys: [locationKeys.all],
    knownFields: LOCATION_FORM_FIELDS,
    onSuccess: (saved) => {
      /*
       * 보관 품목도 바꿨으면 이어서 보낸다 — 창은 그것까지 끝나야 닫는다. 위치는 이미 저장됐으니 기준값 · 잠금 토큰을
       * 응답으로 옮겨 둔다(품목이 거절돼 다시 저장할 때 위치를 또 보내지 않게).
       */
      const pendingItems = pendingItemsRef.current;
      if (pendingItems !== null) {
        setLocationFormSource((prev) => (prev === null ? prev : { ...prev, location: saved }));
        setLocationSourceEtag(
          (prev) => etags.ifMatch(locationDetailPath(saved.locationId)) ?? prev,
        );
        setLocationValues(locationToFormValues(saved));
        itemsWrite.write(pendingItems);
        return;
      }
      setDialogState(CLOSED_LOCATION_DIALOG);
      setLocationFieldErrors({});
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /** 랙 창 — 구역만 있으면 추가, 랙이 있으면 그 랙의 층 · 셀 수 고치기. */
  const [rackDialog, setRackDialog] = useState<{ zone: Location; rack: Location | null } | null>(
    null,
  );
  /* 랙 창이 받는 상세와 같은 조회 — 사용 중지의 잠금 토큰 · 지금 상태를 여기서도 본다. */
  const editRackId = rackDialog?.rack?.locationId ?? null;
  const rackDetail = useLocationDetail(editRackId);

  /*
   * 사용 중지 · 다시 사용은 구역과 랙 단위로(사용자 지시 2026-10-29) — 밑의 층 · 셀은 서버가 함께 바꾼다. 랙 창이
   * 열려 있으면 그 랙, 아니면 수정 창의 위치(구역 · 창고 전체)가 대상이다.
   */
  const statusLocationId = editRackId ?? dialogState.locationId;
  const statusSource = editRackId !== null ? rackDetail.data : locationDetail.data;
  const locationStatusMode = statusSource?.location.isActive === false ? 'activate' : 'deactivate';
  const [locationStatusOpen, setLocationStatusOpen] = useState(false);
  const locationStatusWrite = useMasterWrite<void, Location>({
    request: (_variables, headers) => {
      const params = {
        path: { locationId: statusLocationId ?? 0 },
        header: {
          'Idempotency-Key': headers['Idempotency-Key'],
          /* 수정 창은 폼과 같은 상세 응답의 토큰, 랙 창은 상세 경로에 보관된 토큰. */
          'If-Match': (editRackId !== null ? headers['If-Match'] : locationSourceEtag) ?? '',
        },
      };
      return locationStatusMode === 'activate'
        ? client.POST('/mdm/locations/{locationId}:activate', { params })
        : client.POST('/mdm/locations/{locationId}:deactivate', { params });
    },
    etagPath: statusLocationId === null ? null : locationDetailPath(statusLocationId),
    invalidateKeys: [locationKeys.all],
    knownFields: [],
    onSuccess: () => {
      setLocationStatusOpen(false);
      setDialogState(CLOSED_LOCATION_DIALOG);
      setRackDialog(null);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /*
   * 라벨 일괄 출력(사용자 지시 2026-10-29) — 이력을 세어 처음이면 바로, 이미 낸 것이 섞였으면 사유를 받아 모두
   * 발행하고, 발행한 그림을 모아 보인다.
   */
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
    invalidateKeys: [locationLabelKeys.all],
    knownFields: ['reissueReasonCode'],
    keyLifetime: 'until-applied',
    onSuccess: (result) => {
      setPendingLabelIds(null);
      setLabelPreviews(
        result.items.map((issue) => ({
          documentIssueLogId: issue.documentIssueLogId,
          locationCode:
            hierarchyItems.find((item) => item.locationId === issue.target.targetId)
              ?.locationCode ?? String(issue.target.targetId),
          issueSeq: issue.issueSeq,
        })),
      );
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
      labelWrite.reset();
      setPendingLabelIds(locationIds);
      setReissueCount(alreadyIssued);
      setLabelReasonCode('');
    },
  });

  const resetLabelBatch = () => {
    setPendingLabelIds(null);
    setLabelPreviews(null);
    labelSummary.reset();
    labelWrite.reset();
  };

  const selectedWarehouse = detail.data?.warehouse ?? null;

  /**
   * 처음 펼칠 노드. 검색하지 않을 때는 구역(맨 위)만 펼쳐 랙까지 보인다 — 랙이 백 개를 넘으면 층 · 셀까지 다 펼친
   * 표는 수천 행이 된다(사용자 지시 2026-10-29). 검색 중에는 찾은 위치가 묻히지 않게 하위를 가진 노드를 다 펼친다.
   */
  const initialExpandedIds = useMemo(
    () => initialExpandedLocationIds(locationItems, locationFilterText !== ''),
    [locationItems, locationFilterText],
  );

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

  /* 상위 경로는 검색과 무관한 전체 계층에서 찾는다 — 검색으로 빠진 랙도 이름이 보이게. */
  const hierarchyById = useMemo(
    () => new Map(hierarchyItems.map((item) => [item.locationId, item] as const)),
    [hierarchyItems],
  );

  /*
   * 「배치도」 아이콘(사용자 지시 2026-11-24) — 배치도 수정 창을 그 창고 · 그 위치로 바로 연다. 배치도에는 구역 · 랙만
   * 놓을 수 있어 그 줄에만 두고, 배치도 수정 권한이 없으면 두지 않는다.
   */
  const canEditLayout = useCanEditLayout();
  const layoutHrefOf = (location: Location): string | null =>
    canEditLayout &&
    selectedWarehouseId !== null &&
    (location.locationLevelCode === 'ZONE' || location.locationLevelCode === 'RACK')
      ? `/master-data/warehouse-layout?warehouse=${String(selectedWarehouseId)}&location=${String(location.locationId)}&edit=1`
      : null;

  /* 보기(사용자 지시 2026-11-19) — 적치 위치만은 랙 아래 말단을 한 줄씩. */
  const locationViewMode = readLocationViewMode(searchParams.get(LOCATION_VIEW_PARAM));
  const locationRows = useMemo(
    () =>
      locationViewMode === 'leaf'
        ? buildLeafLocationRows(locationItems)
        : buildLocationRows(locationItems, expandedIds),
    [locationItems, expandedIds, locationViewMode],
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

  /** 사용 중지 충돌 — 랙이면 랙 상세를, 아니면 수정 창의 상세를 다시 받는다. */
  const handleReloadStatusTarget = () => {
    if (editRackId === null) {
      handleReloadLocationDetail();
      return;
    }
    locationStatusWrite.reset();
    void rackDetail.refetch();
  };

  const handleReloadLocationDetail = () => {
    locationWrite.reset();
    locationStatusWrite.reset();
    resetItemsDraft();
    void itemsQuery.refetch();
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

  const handleEditLocation = (location: Location) => {
    /* 랙을 누르면 랙 창 — 별칭과 층 · 셀 수를 함께 고친다(사용자 지시 2026-10-29). */
    const zone = hierarchyItems.find((item) => item.locationId === location.parentLocationId);
    if (
      !isSystemLocation(location) &&
      zone !== undefined &&
      locationDepthById.get(location.locationId) === ZONE_DEPTH + 1
    ) {
      resetItemsDraft();
      setRackDialog({ zone, rack: location });
      return;
    }
    locationWrite.reset();
    resetItemsDraft();
    setLocationFieldErrors({});
    setLocationFormSource(null);
    setLocationSourceEtag(null);
    setLocationValues(locationToFormValues(location));
    setDialogState({
      open: true,
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

  /**
   * 저장 하나가 둘을 맡는다 — 위치 칸(별칭 · 「지정 품목만 받기」)을 고쳤으면 위치 수정, 보관 품목을 바꿨으면 품목 목록 교체.
   * 둘 다면 위치가 먼저다 — 단, 「지정 품목만 받기」를 **켜는** 저장은 품목이 먼저다(피처 009). 서버가 켤 때 저장된 지정
   * 품목으로 조건을 보므로, 품목을 더하면서 켜면 품목이 먼저 들어가 있어야 한다. 끄는 저장은 위치가 먼저라 끈 뒤의 품목
   * 교체가 지정 밖 재고 검사에 걸리지 않는다.
   * 켜는데 지정 품목이 하나도 없으면 보내지 않고 스위치 아래에 알린다(서버도 거절한다).
   */
  const handleSaveLocation = () => {
    const errors: Record<string, string> = { ...validateLocation(locationValues) };
    const storedRestricted = locationFormSource?.location.itemRestricted ?? false;
    const turningOn = locationValues.itemRestricted === true && !storedRestricted;
    if (turningOn && itemsDraft !== null && itemsDraft.items.length === 0) {
      errors.itemRestricted = t.itemsSection.restrict.noItems;
    }
    setLocationFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;

    const pendingItems =
      itemsChanged && itemsDraft !== null && itemsTargetId !== null
        ? { locationId: itemsTargetId, itemIds: draftItemIds(itemsDraft) }
        : null;
    itemsWrite.reset();

    if (turningOn && pendingItems !== null) {
      pendingItemsRef.current = null;
      pendingLocationRef.current = locationValues;
      itemsWrite.write(pendingItems);
      return;
    }

    pendingItemsRef.current = pendingItems;
    pendingLocationRef.current = null;
    if (locationChanged || pendingItems === null) {
      locationWrite.write(locationValues);
      return;
    }
    itemsWrite.write(pendingItems);
  };

  const selectedLocationId = Number(selectedLocationIds[0] ?? '') || null;

  const selectedLocationRow = allLocationRows.find(
    (row) => String(row.location.locationId) === selectedLocationIds[0],
  );
  const canAddRootLocation = selectedWarehouse !== null && locationHierarchy.data !== undefined;
  /*
   * 단추는 단계로 나눈다(사용자 지시 2026-10-29) — 구역은 창고 밑에, 랙은 고른 구역 밑에 그 층 · 셀과 함께 만든다.
   * 시스템 자리(창고 전체 · 적치 대기) 밑에는 달 수 없다(서버 400 INVALID).
   */
  const selectedUserLocationDepth =
    selectedLocationIds.length === 1 &&
    selectedLocationRow !== undefined &&
    !isSystemLocation(selectedLocationRow.location) &&
    locationHierarchy.data !== undefined
      ? selectedLocationRow.depth
      : null;
  const canAddChildLocation = selectedUserLocationDepth === ZONE_DEPTH;
  /**
   * 라벨은 맨 아래 위치에만(사용자 결정 2026-10-29) — 재고는 하위가 없는 위치에만 둘 수 있어(서버 위치 ④) 하위가 있는
   * 구역 · 랙 · 층의 라벨은 찍어도 쓸 데가 없다. 서버 `isLeaf` 를 따르고, 목록에 없으면 켜진 하위가 있는지 본다.
   */
  const isLeafLocation = (locationId: number): boolean => {
    const item = hierarchyItems.find((candidate) => candidate.locationId === locationId);
    if (item !== undefined) return item.isLeaf;
    return !hierarchyItems.some(
      (child) =>
        child.isActive && child.parentLocationId === locationId && child.locationId !== locationId,
    );
  };

  /*
   * 보관 품목(사용자 지시 2026-10-29) — 고치는 맨 아래 위치에만. 제한은 그 위치에만 걸려 하위로 물려주지 않으므로 하위가
   * 있는 위치에는 두지 않고, 서버가 만든 자리(적치 대기 · 창고 전체)는 서버가 거절한다(400 STATE_LOCKED).
   */
  const editingLocation =
    dialogState.open && dialogState.locationId !== null
      ? (locationDetail.data?.location ??
        hierarchyItems.find((item) => item.locationId === dialogState.locationId) ??
        null)
      : /* 층 없는 랙은 랙 창이 맨 아래 위치의 수정 창이다(#1673). */
        (rackDialog?.rack ?? null);
  /* 창고 유형이 보관 품목의 유형을 정한다 — 예비품창고는 보관 품목을 두지 않는다(`item-scope.ts`). */
  const itemTypeScope = itemTypesForWarehouse(selectedWarehouse?.warehouseTypeCode);
  const itemsTargetId =
    editingLocation !== null &&
    itemTypeScope !== null &&
    !isSystemLocation(editingLocation) &&
    isLeafLocation(editingLocation.locationId)
      ? editingLocation.locationId
      : null;
  const itemsQuery = useLocationItems(itemsTargetId);
  const [itemsDraft, setItemsDraft] = useState<LocationItemsDraft | null>(null);
  /*
   * 층 없는 랙(랙 창 · #1673)의 「지정 품목만 받기」 — 랙 창은 위치 폼 값을 쓰지 않아 따로 둔다(피처 009 · FR-017c).
   * null 이면 고치지 않았다(받은 값 그대로).
   */
  const [rackRestricted, setRackRestricted] = useState<boolean | null>(null);
  const [rackRestrictError, setRackRestrictError] = useState<string | undefined>(undefined);
  /** 위치를 먼저 저장한 뒤 이어 보낼 품목 목록 — 위치 저장의 성공 처리기가 읽는다. */
  const pendingItemsRef = useRef<{ locationId: number; itemIds: number[] } | null>(null);
  /** 품목을 먼저 저장한 뒤 이어 보낼 위치 값 — 「지정 품목만 받기」를 켜는 저장(피처 009). 품목 저장의 성공 처리기가 읽는다. */
  const pendingLocationRef = useRef<LocationFormValues | null>(null);

  /* 고칠 목록은 받은 목록에서 시작한다 — 다시 받는 중에는 기다려 옛 캐시로 시작하지 않는다. */
  if (
    itemsTargetId !== null &&
    itemsDraft === null &&
    itemsQuery.data !== undefined &&
    !itemsQuery.isFetching
  ) {
    setItemsDraft({ items: itemsQuery.data });
  }

  const itemsWrite = useMasterWrite<
    { locationId: number; itemIds: number[] },
    { items: LocationItem[] }
  >({
    request: ({ locationId, itemIds }, headers) =>
      client.PUT('/mdm/locations/{locationId}/items', {
        params: {
          path: { locationId },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
        body: { itemIds },
      }),
    etagPath: null,
    /* 목록의 표식(hasItemRestriction)과 품목 목록을 함께 다시 받는다. */
    invalidateKeys: [locationKeys.all],
    knownFields: ['itemIds'],
    onSuccess: () => {
      pendingItemsRef.current = null;
      /* 「지정 품목만 받기」를 켜는 저장 — 품목이 들어갔으니 이제 위치를 보낸다. 창은 그것까지 끝나야 닫는다. */
      const pendingLocation = pendingLocationRef.current;
      if (pendingLocation !== null) {
        pendingLocationRef.current = null;
        locationWrite.write(pendingLocation);
        return;
      }
      setDialogState(CLOSED_LOCATION_DIALOG);
      setLocationFieldErrors({});
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /** 창을 열고 닫을 때 · 최신을 다시 받을 때 — 고치던 품목 목록과 그 오류를 버린다. */
  const resetItemsDraft = (): void => {
    setItemsDraft(null);
    setRackRestricted(null);
    setRackRestrictError(undefined);
    pendingItemsRef.current = null;
    pendingLocationRef.current = null;
    itemsWrite.reset();
  };

  const itemsChanged =
    itemsTargetId !== null &&
    itemsDraft !== null &&
    itemsQuery.data !== undefined &&
    isItemsDraftChanged(itemsDraft, itemsQuery.data);
  const locationChanged =
    locationFormSource === null ||
    !isSameLocationValues(locationValues, locationToFormValues(locationFormSource.location));

  /* 지정 밖 품목의 재고가 있다는 거절(STATE_LOCKED · itemIds)은 배너가 아니라 품목 칸 아래에 둔다. */
  const itemsLockedMessage =
    itemsWrite.error?.kind === 'stateLocked' &&
    itemsWrite.error.errors.length > 0 &&
    itemsWrite.error.errors.every((item) => item.field === 'itemIds')
      ? itemsWrite.error.errors.map((item) => item.message).join(' ')
      : undefined;

  const changeItemsDraft = (draft: LocationItemsDraft) => {
    setItemsDraft(draft);
    itemsWrite.reset();
    setLocationFieldErrors((prev) => {
      if (!('itemIds' in prev) && !('itemRestricted' in prev)) return prev;
      const next = { ...prev };
      delete next.itemIds;
      delete next.itemRestricted;
      return next;
    });
  };

  /*
   * 「지정 품목만 받기」 켜기를 서버가 거절한 까닭(STATE_LOCKED · itemRestricted — 지정 밖 재고 · 시스템 자리)은 배너가 아니라
   * 스위치 아래에 둔다(피처 009).
   */
  const restrictLockedMessage =
    locationWrite.error?.kind === 'stateLocked' &&
    locationWrite.error.errors.length > 0 &&
    locationWrite.error.errors.every((item) => item.field === 'itemRestricted')
      ? locationWrite.error.errors.map((item) => item.message).join(' ')
      : undefined;
  const restrictionSaving = locationWrite.isSaving || itemsWrite.isSaving;
  const restrictionChecked = locationValues.itemRestricted ?? false;
  /** 고치는 위치의 「지정 품목만 받기」 스위치. 지정 품목이 없으면 켜기만 미리 잠근다 — 켠 것을 끄는 것은 늘 된다. */
  const restriction = {
    checked: restrictionChecked,
    onChange: (checked: boolean) => changeLocationValues({ itemRestricted: checked }),
    locked: !restrictionChecked && itemsDraft !== null && itemsDraft.items.length === 0,
    error:
      locationFieldErrors.itemRestricted ??
      locationWrite.fieldErrors.itemRestricted ??
      restrictLockedMessage,
    disabled: restrictionSaving,
  };

  /**
   * 층 없는 랙의 보관 품목(#1673) — 칸은 수정 창과 같고, 저장은 랙 창이 별칭 다음에 이어 부른다. 실패는 랙 창이 멈춘
   * 자리와 서버 문구로 알린다.
   */
  const rackItemsId =
    itemsTargetId !== null && rackDialog?.rack?.locationId === itemsTargetId ? itemsTargetId : null;
  /*
   * 랙 창의 「지정 품목만 받기」(피처 009 · FR-017c) — Location 수정 창과 같은 규칙: 지정 품목이 없으면 켜기만 미리 잠그고,
   * 그 밖의 조건은 저장 때 서버가 검사한다. 거절은 스위치 아래에 서버 문구로.
   */
  const rackStoredRestricted =
    rackDetail.data?.location.itemRestricted ?? rackDialog?.rack?.itemRestricted ?? false;
  const rackRestrictedNow = rackRestricted ?? rackStoredRestricted;
  const rackRestrictChanged = rackRestrictedNow !== rackStoredRestricted;
  const rackItemsEmpty = itemsDraft !== null && itemsDraft.items.length === 0;
  /* 빈 목록은 「지정 없음」일 뿐이다(피처 009) — 켜는 저장에서만 막는다(서버도 거절한다). */
  const rackItemsInvalid = rackRestrictChanged && rackRestrictedNow && rackItemsEmpty;
  const putRackItems = async (locationId: number): Promise<void> => {
    if (!itemsChanged || itemsDraft === null) return;
    await runRequest(() =>
      client.PUT('/mdm/locations/{locationId}/items', {
        params: {
          path: { locationId },
          header: { 'Idempotency-Key': createIdempotencyKey() },
        },
        body: { itemIds: draftItemIds(itemsDraft) },
      }),
    );
  };
  /** 옵션만 바꾼다 — 별칭을 먼저 저장했을 수 있어 상세를 다시 받아 그 잠금 토큰으로 보낸다. */
  const putRackRestriction = async (locationId: number): Promise<void> => {
    if (!rackRestrictChanged) return;
    const fresh = (
      await runRequest(() =>
        client.GET('/mdm/locations/{locationId}', { params: { path: { locationId } } }),
      )
    ).location;
    try {
      await runRequest(() =>
        client.PUT('/mdm/locations/{locationId}', {
          params: {
            path: { locationId },
            header: {
              'Idempotency-Key': createIdempotencyKey(),
              'If-Match': etags.ifMatch(locationDetailPath(locationId)) ?? '',
            },
          },
          body: toLocationUpdate(
            { ...locationToFormValues(fresh), itemRestricted: rackRestrictedNow },
            fresh,
          ),
        }),
      );
    } catch (error) {
      const api = error instanceof ApiRequestError ? error.apiError : null;
      const items =
        api !== null && (api.kind === 'validation' || api.kind === 'stateLocked')
          ? api.errors.filter((item) => item.field === 'itemRestricted')
          : [];
      if (items.length > 0) setRackRestrictError(items.map((item) => item.message).join(' '));
      throw error;
    }
  };
  const rackLeafItems: RackLeafItems | null =
    rackItemsId !== null
      ? {
          slot: (disabled) => (
            <LocationItemsSection
              isLoading={itemsQuery.isPending || (itemsDraft === null && itemsQuery.isFetching)}
              isError={itemsQuery.isError}
              onRetry={() => void itemsQuery.refetch()}
              draft={itemsDraft}
              onChange={changeItemsDraft}
              error={undefined}
              disabled={disabled}
              itemTypeCodes={itemTypeScope ?? undefined}
              restriction={{
                checked: rackRestrictedNow,
                onChange: (checked) => {
                  setRackRestricted(checked);
                  setRackRestrictError(undefined);
                },
                locked: !rackRestrictedNow && rackItemsEmpty,
                error: rackItemsInvalid ? t.itemsSection.restrict.noItems : rackRestrictError,
                disabled,
              }}
            />
          ),
          changed: itemsChanged || rackRestrictChanged,
          invalid: rackItemsInvalid,
          /*
           * 켜는 저장은 품목이 먼저(서버가 저장된 지정으로 켜기를 검사한다), 끄는 저장은 옵션이 먼저(끈 뒤의 품목 교체가 지정 밖
           * 재고 검사에 걸리지 않게) — Location 수정 창과 같다.
           */
          save: async () => {
            if (rackRestrictChanged && !rackRestrictedNow) {
              await putRackRestriction(rackItemsId);
              await putRackItems(rackItemsId);
              return;
            }
            await putRackItems(rackItemsId);
            await putRackRestriction(rackItemsId);
          },
        }
      : null;

  /** 지울 위치 — 확인 창이 열린다. */
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);
  /**
   * 일괄 출력할 위치 — 고른 맨 아래 위치와, 고른 구역 · 랙 · 층 밑의 켜진 맨 아래 위치 전부(랙을 고르면 그 셀이 다
   * 나온다). 꺼진 위치 · 적치 대기는 빼고 겹친 것은 한 번만.
   */
  const labelTargetIds = useMemo(() => {
    const byId = new Map(hierarchyItems.map((item) => [item.locationId, item]));
    const children = new Map<number, Location[]>();
    for (const item of hierarchyItems) {
      const parentId = item.parentLocationId;
      if (parentId === null || parentId === undefined || parentId === item.locationId) continue;
      children.set(parentId, [...(children.get(parentId) ?? []), item]);
    }
    const picked = new Set<number>();
    const visit = (item: Location, seen: Set<number>): void => {
      if (seen.has(item.locationId)) return;
      seen.add(item.locationId);
      if (!item.isActive || isPutawayStaging(item)) return;
      if (item.isLeaf) {
        picked.add(item.locationId);
        return;
      }
      for (const child of children.get(item.locationId) ?? []) visit(child, seen);
    };
    for (const id of selectedLocationIds) {
      const item = byId.get(Number(id));
      if (item !== undefined) visit(item, new Set());
    }
    return [...picked];
  }, [hierarchyItems, selectedLocationIds]);
  const labelBatchBusy = labelSummary.isPending || labelWrite.isSaving;

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
  /*
   * 상위는 고치지 않는다 — 코드가 상위 경로를 담고 바꿀 수 없어(위치 ③) 잘못 달았으면 지우고 다시 만든다.
   * 별칭이 있으면 별칭, 없으면 코드 하나만 보인다(사용자 지시 2026-10-29).
   */
  const fixedParent =
    locationValues.parentLocationId === ''
      ? undefined
      : hierarchyItems.find((item) => String(item.locationId) === locationValues.parentLocationId);
  const parentLabel =
    locationValues.parentLocationId === ''
      ? warehouseLabel
      : fixedParent === undefined
        ? t.values.currentParentOutsideList
        : locationAliasOrCode(fixedParent);

  /* 창 머리의 단계 — 고치는 그 위치. */
  const formSubject = locationDetail.data?.location ??
    hierarchyItems.find((item) => item.locationId === dialogState.locationId) ?? {
      locationLevelCode: null,
      systemRoleCode: null,
    };
  /* 사용 중지 · 다시 사용 확인의 대상 — 랙 창이 열려 있으면 그 랙, 아니면 수정 창의 위치. */
  const statusTarget = statusSource?.location ?? null;

  /*
   * 남은 재고 — 있으면 품목 수 · LOT 수 한 줄(막지 않는다), 묻지 못했으면 그 사실 한 줄, 권한이 없으면(403) 아무것도
   * 보이지 않는다. 단위가 섞여 수량 합계는 보이지 않는다.
   */
  const warehouseStockNotice = (() => {
    if (selectedWarehouse?.isActive !== true || stockSummary.isFetching) return null;
    if (stockSummary.isError) {
      const forbidden =
        stockSummary.error instanceof ApiRequestError && stockSummary.error.httpStatus === 403;
      return forbidden ? null : (
        <p className="location-confirm-line">{t.deactivate.stockCheckFailed}</p>
      );
    }
    const stock = stockSummary.data;
    if (stock === undefined || (stock.lotCount <= 0 && stock.onHandQty <= 0)) return null;
    return (
      <p className="location-confirm-line is-warning">
        {t.deactivate.stockLeft(stock.itemCount, stock.lotCount)}
      </p>
    );
  })();

  const listPage = warehouseList.data?.page;
  /* 서버가 자른 것인지는 받은 줄 수로 본다 — 외부 창고를 숨긴 뒤의 수로 보면 잘리지 않았는데도 잘렸다고 한다. */
  const receivedCount = warehouseList.data?.items.length ?? 0;
  const listTruncated = listPage !== undefined && isTruncated(listPage, receivedCount);

  /** 창고 정보 판의 칸 · 오류 · 고르기 — 오른쪽 창의 등록 판과 수정 창이 함께 쓴다. */
  const warehouseFormProps = (mode: 'create' | 'edit') => ({
    values: formValues,
    onChange: changeFormValues,
    // 로컬 검증 결과가 서버 오류를 덮는다 — 지금 고칠 수 있는 것을 먼저 보인다.
    fieldErrors: { ...warehouseWrite.fieldErrors, ...localFieldErrors },
    banner: (
      <>
        {lookupNotice}
        <SaveErrorBanner
          error={warehouseWrite.error}
          onReload={mode === 'edit' ? handleReloadDetail : undefined}
        />
      </>
    ),
    codeLockReason: null,
    baseline: formState?.baseline,
    isDirty,
    isSaving: warehouseWrite.isSaving,
    lookups: formLookups,
    onSave: handleSaveWarehouse,
    onDeactivate: () => {
      warehouseStatusWrite.reset();
      setWarehouseStatusOpen(true);
    },
    onActivate: () => {
      warehouseStatusWrite.reset();
      setWarehouseStatusOpen(true);
    },
  });

  /** 고친 값 · 오류를 버린다 — 등록 판의 [취소], 수정 창의 닫기 · [취소]. */
  const discardWarehouseEdits = () => {
    setLocalFieldErrors({});
    warehouseWrite.reset();
    setFormState((prev) => (prev === null ? prev : { ...prev, values: prev.baseline }));
  };

  /**
   * 우측 페인. 상세를 받지 못한 상태에서 빈 폼을 보이면 사용자가 그것을 자료로 읽는다 —
   * 선택 전·불러오는 중·실패를 각각 다른 화면으로 낸다.
   */
  const renderDetailPane = () => {
    /*
     * 신규 등록에는 Location 표를 두지 않는다. 아직 만들어지지 않은 창고에는
     * 위치를 붙일 대상이 없다.
     */
    if (isCreateMode) {
      return (
        <div>
          <WarehouseFormPane
            {...warehouseFormProps('create')}
            mode="create"
            isActive
            onCancel={discardWarehouseEdits}
          />
        </div>
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
        <WarehouseHeader
          values={formState.baseline}
          isActive={selectedWarehouse.isActive}
          lookups={formLookups}
          onEdit={() => {
            discardWarehouseEdits();
            setWarehouseEditOpen(true);
          }}
        />
        <LocationPane
          countText={
            locationHierarchy.data === undefined
              ? null
              : locationCountText(summarizeLocations(locationHierarchy.data.items))
          }
          rows={locationRows}
          isLoading={locations.isPending}
          loadError={
            locations.isError ? (
              <LoadErrorBanner error={locations.error} onRetry={() => void locations.refetch()} />
            ) : null
          }
          viewMode={locationViewMode}
          onViewModeChange={(mode) => {
            const next = new URLSearchParams(searchParams);
            if (mode === 'leaf') next.set(LOCATION_VIEW_PARAM, 'leaf');
            else next.delete(LOCATION_VIEW_PARAM);
            setSearchParams(next, { replace: true });
            setSelectedLocationIds([]);
          }}
          parentPathOf={(location) => parentPathOf(location, hierarchyById)}
          layoutHrefOf={layoutHrefOf}
          expandedIds={expandedIds}
          onToggleExpand={handleToggleExpand}
          onCollapseAll={() =>
            setExpansion((prev) => (prev === null ? prev : { ...prev, ids: new Set() }))
          }
          onExpandAll={() =>
            setExpansion((prev) =>
              prev === null ? prev : { ...prev, ids: parentLocationIds(locationItems) },
            )
          }
          selectedIds={selectedLocationIds}
          onSelectionChange={setSelectedLocationIds}
          filterText={locationFilterText}
          onFilterTextChange={(value) => {
            setLocationFilterText(value);
            setSelectedLocationIds([]);
          }}
          canAddRoot={canAddRootLocation}
          addRootDisabledReason={t.actionReasons.locationHierarchyUnavailable}
          canAddChild={canAddChildLocation}
          onAddChild={() => {
            const zone = selectedLocationRow?.location;
            if (zone !== undefined) setRackDialog({ zone, rack: null });
          }}
          canPrintLabels={
            locationHierarchy.data !== undefined &&
            labelTargetIds.length > 0 &&
            labelTargetIds.length <= LABEL_BATCH_MAX
          }
          isPrintingLabels={labelBatchBusy}
          onPrintLabels={() => {
            resetLabelBatch();
            labelSummary.mutate(labelTargetIds);
          }}
          onEdit={handleEditLocation}
          canEditAlias={canWriteLocations}
          canBulkCreate={canWriteLocations}
          onBulkCreate={() => setBulkCreateOpen(true)}
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
                  onRetry={() => labelSummary.mutate(labelSummary.variables ?? [])}
                />
              )}
              {pendingLabelIds === null && <SaveErrorBanner error={labelWrite.error} />}
            </>
          }
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
        list={{
          label: t.panes.list,
          count: listPage?.total,
          content: (
            /* 조회 조건은 목록 위에 좁게(사용자 지시 2026-10-29) — 화면 위 상자를 두지 않는다. 표는 구획의 바로 아래 자식이라 남은 높이에서 스크롤한다. */
            <>
              {listTruncated && listPage !== undefined && (
                <AlertBanner variant="warning">
                  {t.listTruncated(receivedCount, listPage.total)}
                </AlertBanner>
              )}
              <WarehouseFilterBar
                appliedFilters={filters}
                onApplyFilters={handleApplyFilters}
                warehouseTypeOptions={selectableOptions(
                  lookups.sources.warehouseTypes,
                  filters.warehouseTypeCode,
                )}
                plantOptions={selectableOptions(lookups.sources.plants, filters.plantId)}
              />
              <WarehouseListPane
                items={warehouses}
                isLoading={warehouseList.isPending}
                appliedFilters={filters}
                onApplyFilters={handleApplyFilters}
                selectedWarehouseId={selectedWarehouseId}
                onSelect={(warehouseId) => {
                  warehouseWrite.reset();
                  resetLabelBatch();
                  setLocalFieldErrors({});
                  setSelectedLocationIds([]);
                  setLocationFilterText('');
                  setDialogState(CLOSED_LOCATION_DIALOG);
                  setLocationFormSource(null);
                  setLocationSourceEtag(null);
                  setWarehouseEditOpen(false);
                  /* 고른 줄을 한 번 더 누르면 고르기를 푼다(사용자 지시 2026-11-24). */
                  updateParams({
                    wh: warehouseId === selectedWarehouseId ? null : String(warehouseId),
                    mode: null,
                    tab: null,
                  });
                }}
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
            </>
          ),
        }}
        detail={{ label: t.panes.detail, content: renderDetailPane() }}
      />

      {warehouseEditOpen && selectedWarehouse !== null && formState !== null && !isCreateMode && (
        <WarehouseEditDialog
          {...warehouseFormProps('edit')}
          open
          onClose={() => {
            discardWarehouseEdits();
            setWarehouseEditOpen(false);
          }}
          isActive={selectedWarehouse.isActive}
        />
      )}

      <DeactivateConfirmDialog
        open={warehouseStatusOpen}
        onClose={() => setWarehouseStatusOpen(false)}
        onConfirm={() => warehouseStatusWrite.write(undefined)}
        isSaving={warehouseStatusWrite.isSaving}
        mode={selectedWarehouse?.isActive === false ? 'activate' : 'deactivate'}
        warehouse={
          selectedWarehouse === null
            ? undefined
            : { code: selectedWarehouse.warehouseCode, name: selectedWarehouse.warehouseName }
        }
        notice={warehouseStockNotice}
        confirmDisabled={selectedWarehouse?.isActive === true && stockSummary.isFetching}
        // 충돌은 상세를 다시 받아 잠금 토큰을 갱신하면 풀린다. 버릴 입력이 없다.
        banner={
          <SaveErrorBanner error={warehouseStatusWrite.error} onReload={handleReloadDetail} />
        }
      />

      <LocationDeleteDialog
        target={deleteTarget}
        count={deleteTarget === null ? 0 : countSubtree(hierarchyItems, deleteTarget.locationId)}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          setRackDialog(null);
          setDialogState(CLOSED_LOCATION_DIALOG);
          setSelectedLocationIds([]);
        }}
      />

      {bulkCreateOpen && selectedWarehouseId !== null && selectedWarehouse !== null && (
        <BulkCreateDialog
          open
          warehouseId={selectedWarehouseId}
          locationPrefix={selectedWarehouse.locationPrefix}
          warehouseLabel={warehouseLabel}
          items={hierarchyItems}
          onClose={() => setBulkCreateOpen(false)}
        />
      )}

      <RackCreateDialog
        zone={rackDialog?.zone ?? null}
        rack={rackDialog?.rack ?? null}
        warehouseId={selectedWarehouseId ?? 0}
        warehouseLabel={warehouseLabel}
        items={hierarchyItems}
        labelSlot={
          rackDialog?.rack && isLeafLocation(rackDialog.rack.locationId) ? (
            <LocationLabelSection
              key={rackDialog.rack.locationId}
              locationId={rackDialog.rack.locationId}
              locationCode={rackDialog.rack.locationCode}
              reasonOptions={formLookups.reissueReasons}
            />
          ) : null
        }
        leafItems={rackLeafItems}
        onClose={() => {
          setRackDialog(null);
          resetItemsDraft();
        }}
        onDelete={() => setDeleteTarget(rackDialog?.rack ?? null)}
        isActive={rackDetail.data?.location.isActive ?? rackDialog?.rack?.isActive ?? true}
        onToggleActive={() => {
          locationStatusWrite.reset();
          setLocationStatusOpen(true);
        }}
        onCreated={(zoneId, rackId) =>
          setExpansion((prev) =>
            prev === null ? prev : { ...prev, ids: new Set([...prev.ids, zoneId, rackId]) },
          )
        }
      />

      <LocationFormDialog
        open={dialogState.open}
        onClose={() => {
          setDialogState(CLOSED_LOCATION_DIALOG);
          setLocationFormSource(null);
          setLocationSourceEtag(null);
          resetItemsDraft();
        }}
        warehouseLabel={warehouseLabel}
        parentLabel={parentLabel}
        subject={formSubject}
        values={locationValues}
        onChange={changeLocationValues}
        fieldErrors={{ ...locationWrite.fieldErrors, ...locationFieldErrors }}
        banner={
          <>
            {locationDetail.isFetching && (
              <div className="banner-slot">
                <AlertBanner variant="info">{t.loading.locationDetail}</AlertBanner>
              </div>
            )}
            {locationDetail.isError && (
              <LoadErrorBanner error={locationDetail.error} onRetry={handleReloadLocationDetail} />
            )}
            {restrictLockedMessage === undefined && (
              <SaveErrorBanner error={locationWrite.error} onReload={handleReloadLocationDetail} />
            )}
            {itemsLockedMessage === undefined && <SaveErrorBanner error={itemsWrite.error} />}
          </>
        }
        systemLocked={
          locationDetail.data !== undefined && isSystemLocation(locationDetail.data.location)
        }
        /*
         * 삭제도 구역 · 랙 단위로(사용자 지시 2026-10-29) — 이 창에서는 구역만, 층 · 셀은 랙 창에서 줄여 지운다.
         * 서버가 만든 자리는 지울 수 없다(400 STATE_LOCKED).
         */
        onDelete={
          locationDetail.data !== undefined &&
          !isSystemLocation(locationDetail.data.location) &&
          locationDepthById.get(locationDetail.data.location.locationId) === ZONE_DEPTH
            ? () => setDeleteTarget(locationDetail.data?.location ?? null)
            : undefined
        }
        /* 구역(과 창고 전체)만 — 층 · 셀은 랙 창에서 랙째로 끈다. 적치 대기는 끌 수 없다. */
        canToggleActive={
          dialogState.locationId !== null &&
          locationDepthById.get(dialogState.locationId) === ZONE_DEPTH &&
          (locationDetail.data === undefined || !isPutawayStaging(locationDetail.data.location))
        }
        isActive={locationDetail.data?.location.isActive ?? true}
        isReady={
          locationHierarchy.data !== undefined &&
          locationFormSource !== null &&
          locationSourceEtag !== null &&
          !locationDetail.isFetching
        }
        onToggleActive={() => {
          locationStatusWrite.reset();
          setLocationStatusOpen(true);
        }}
        isSaving={locationWrite.isSaving || itemsWrite.isSaving}
        onSave={handleSaveLocation}
        isDirty={locationChanged || itemsChanged}
        itemsSlot={
          itemsTargetId !== null ? (
            <LocationItemsSection
              isLoading={itemsQuery.isPending || (itemsDraft === null && itemsQuery.isFetching)}
              isError={itemsQuery.isError}
              onRetry={() => void itemsQuery.refetch()}
              draft={itemsDraft}
              onChange={changeItemsDraft}
              error={
                locationFieldErrors.itemIds ?? itemsWrite.fieldErrors.itemIds ?? itemsLockedMessage
              }
              disabled={locationWrite.isSaving || itemsWrite.isSaving}
              itemTypeCodes={itemTypeScope ?? undefined}
              restriction={restriction}
            />
          ) : editingLocation !== null && isSystemLocation(editingLocation) ? (
            /* 시스템 자리(창고 전체 · 적치 대기)는 켤 수 없다 — 잠긴 스위치 줄만 까닭과 함께(시안 결정 · FR-017c). */
            <section
              className="location-section location-items-section"
              aria-label={t.itemsSection.restrict.label}
            >
              <h3 className="location-section-title">{t.itemsSection.restrict.label}</h3>
              <RestrictionToggle checked={false} lockReason={t.itemsSection.restrict.system} />
            </section>
          ) : null
        }
        /* 라벨은 맨 아래 위치에만. */
        labelSlot={
          dialogState.locationId !== null && isLeafLocation(dialogState.locationId) ? (
            <LocationLabelSection
              key={dialogState.locationId}
              locationId={dialogState.locationId}
              locationCode={
                locationDetail.data?.location.locationCode ?? locationValues.locationCode
              }
              reasonOptions={formLookups.reissueReasons}
            />
          ) : null
        }
      />

      <DeactivateConfirmDialog
        open={locationStatusOpen}
        onClose={() => setLocationStatusOpen(false)}
        onConfirm={() => locationStatusWrite.write(undefined)}
        isSaving={locationStatusWrite.isSaving}
        mode={locationStatusMode}
        location={
          statusTarget === null
            ? undefined
            : {
                target: statusTarget,
                count: countSubtree(hierarchyItems, statusTarget.locationId),
              }
        }
        banner={
          <SaveErrorBanner error={locationStatusWrite.error} onReload={handleReloadStatusTarget} />
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
          alreadyIssuedCount={reissueCount}
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
