import {
  AlertBanner,
  Breadcrumb,
  EmptyState,
  PageHeader,
  SkeletonText,
  Tabs,
  useToast,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import {
  createBuMapDraft,
  isSameBuMapDrafts,
  removeBuMapDraft,
  toBuMapDrafts,
  toBuMapsPayload,
  upsertBuMapDraft,
  type BuMapDraft,
} from './bu-map-draft';
import { BomListPane, bomName } from './bom-list-pane';
import { bomKeys, useBomList } from './bom-queries';
import { BuMapFormDialog } from './bu-map-form-dialog';
import { BuMapPane } from './bu-map-pane';
import {
  createExternalCodeDraft,
  isSameExternalCodeDrafts,
  removeExternalCodeDraft,
  toExternalCodeDrafts,
  toExternalCodesPayload,
  upsertExternalCodeDraft,
  type ExternalCodeDraft,
} from './external-code-draft';
import { ExternalCodeFormDialog } from './external-code-form-dialog';
import { ExternalCodePane } from './external-code-pane';
import { ITEM_KEY, readItemFilters, readPage, readSelectedId, toSearchParams } from './filters';
import { ItemAttrsPane } from './item-attrs-pane';
import { isSameItemAttrsValues, itemToAttrsFormValues, toItemUpdate } from './item-attrs-mappers';
import { ITEM_ATTRS_FORM_FIELDS, validateItemAttrsForm } from './item-attrs-validation';
import { ItemListPane } from './item-list-pane';
import { ItemOriginPane } from './item-origin-pane';
import { itemDetailPath, itemKeys, useItemDetail, useItemList, useItemNames } from './item-queries';
import { LoadErrorBanner } from './load-error-banner';
import {
  useBusinessUnitOptions,
  usePartnerOptions,
  useUomOptions,
  type LookupResult,
} from './lookups';
import { lookupLabel, selectableOptions } from './options';
import { toPageView } from './pagination';
import { SetDefaultDialog } from './set-default-dialog';
import {
  subsidiaryKeys,
  useBuMaps,
  useExternalCodes,
  useUomConversions,
} from './subsidiary-queries';
import {
  DEFAULT_SUBSIDIARY_TAB_ID,
  DEFAULT_TAB_ID,
  ITEM_EXTENDED_ATTRS_TABS,
  SUBSIDIARY_TABS,
  SUBSIDIARY_TAB_KEY,
  TAB_KEY,
  resolveSubsidiaryTab,
  resolveTab,
} from './tabs';
import type { Item, ItemAttrsFormValues, ItemFilters } from './types';
import {
  createUomConversionDraft,
  isSameUomConversionDrafts,
  removeUomConversionDraft,
  toUomConversionDrafts,
  toUomConversionsPayload,
  upsertUomConversionDraft,
  type UomConversionDraft,
} from './uom-conversion-draft';
import { UomConversionFormDialog } from './uom-conversion-form-dialog';
import { UomConversionPane } from './uom-conversion-pane';

type Bom = components['schemas']['Bom'];
type ItemDetailResponse = components['schemas']['ItemDetailResponse'];
type ItemBuItemMapListResponse = components['schemas']['ItemBuItemMapListResponse'];
type ItemUomConversionListResponse = components['schemas']['ItemUomConversionListResponse'];
type ItemExternalCodeListResponse = components['schemas']['ItemExternalCodeListResponse'];

const t = messages.itemExtendedAttrs;

/**
 * 확장 속성 폼의 현재 값과 그것이 어디서 나왔는지.
 *
 * 「고친 것이 있는가」는 둘의 비교로 판정하고, **출처가 바뀔 때만** 폼을 다시 세운다 —
 * 사용자가 입력하는 동안 캐시가 갱신돼도 값이 되돌아가면 안 된다.
 *
 * **출처가 상세 응답 객체다**(등록 갈래가 없다). 계약에 `POST /mdm/items`가 없어
 * 이 화면에는 「아직 없는 품목의 폼」이라는 상태 자체가 없다.
 */
interface ItemAttrsFormState {
  source: ItemDetailResponse;
  baseline: ItemAttrsFormValues;
  values: ItemAttrsFormValues;
}

/** 저장 요청이 함께 들고 가야 하는 것. **조회한 품목이 `isActive`의 출처다**(결정 3). */
interface ItemAttrsWriteVariables {
  values: ItemAttrsFormValues;
  source: Item;
}

/**
 * 사업부 매핑 초안과 그것이 어디서 나왔는지.
 *
 * **초안을 화면이 소유한다**(§5.4). 탭 안 페인이 소유하면 탭을 옮기는 순간 언마운트되어
 * 저장하지 않은 입력이 조용히 사라진다(M10).
 */
interface BuMapDraftState {
  source: ItemBuItemMapListResponse;
  baseline: BuMapDraft[];
  drafts: BuMapDraft[];
}

/** 단위 환산 초안. 사업부 매핑과 **같은 모양이되 서로를 알지 않는다**(결정 6). */
interface UomConversionDraftState {
  source: ItemUomConversionListResponse;
  baseline: UomConversionDraft[];
  drafts: UomConversionDraft[];
}

/** 외부 코드 초안. 같은 모양의 셋째이자 마지막이다. */
interface ExternalCodeDraftState {
  source: ItemExternalCodeListResponse;
  baseline: ExternalCodeDraft[];
  drafts: ExternalCodeDraft[];
}

/**
 * 열려 있는 편집 창의 대상.
 *
 * **초안과 「새 줄인가」를 한 상태에 담는다.** 둘을 따로 두면 창을 닫을 때 하나만 되돌아가
 * 다음에 열리는 창의 제목이 어긋날 수 있고, 초기화 지점마다 둘을 함께 비웠는지 세어야 한다.
 * 한 값으로 묶으면 `null`이 곧 「창이 닫혔다」이고 갈릴 여지가 사라진다.
 */
interface EditingRow<TDraft> {
  draft: TDraft;
  isNew: boolean;
}

/**
 * W-06-05 컨테이너.
 *
 * 조회 조건과 선택은 URL이 소유한다(`?tab=&q=&inactive=1&page=&item=`) —
 * 새로고침·뒤로가기·공유가 같은 화면을 낸다.
 *
 * **좌 칸은 탭 밖에 있다**(결정 2). 앞선 화면(W-06-06)은 탭마다 좌 목록이 통째로 달라
 * 탭이 화면 전체를 갈랐지만, 이 화면은 탭이 전부 「지금 고른 품목」의 다른 면이다.
 * 그래서 **탭을 옮겨도 아무것도 비우지 않는다** — 같은 규칙(「보이는 행이 달라지면 비운다」)에서
 * 나온 반대 결론이다.
 *
 * **탭은 만든 것만 렌더한다**(`tabs.ts`). 자재 명세서 탭은 그 내용이 생길 때 붙는다 —
 * 자리만 먼저 두면 「탭은 있는데 눌러도 빈 화면인」 상태가 된다.
 */
export const ItemExtendedAttrsScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { client } = useApiClient();

  const tab = resolveTab(searchParams.get(TAB_KEY));
  const subTab = resolveSubsidiaryTab(searchParams.get(SUBSIDIARY_TAB_KEY));
  const filters = useMemo<ItemFilters>(() => readItemFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const selectedItemId = readSelectedId(searchParams, ITEM_KEY);

  /**
   * 부속 정보 탭을 보고 있는가.
   *
   * 부속 자원 셋의 조회를 **탭 단위로** 켠다. 하위 탭마다 켜면 하위 탭을 옮길 때마다
   * 새로 받아, 편집 중이던 초안이 서버 응답으로 되감길 여지가 생긴다
   * (§5.4 「세 초안은 서로 다른 자원이라 함께 산다」).
   */
  const isSubsidiaryTab = tab.id === 'sub';

  /**
   * 자재 명세서 탭을 보고 있는가.
   *
   * 부속 자원과 같은 규칙으로 **탭 단위로** 켠다 — 확장 속성만 보는 동안 자재 명세서를
   * 받아 둘 이유가 없고, 계약이 `parentItemId`를 필수 쿼리로 두어 품목 없이는 부를 수도 없다.
   */
  const isBomTab = tab.id === 'bom';

  const itemList = useItemList(filters, page);
  const items = itemList.data?.items ?? [];

  /*
   * 서버가 준 쪽 정보를 정본으로 쓴다. 주소의 쪽 번호를 쓰면 서버가 다른 쪽을 돌려줬을 때
   * 표시와 내용이 어긋난다. 아직 받지 못했으면 건수를 지어내지 않고 0으로 둔다.
   */
  const pageView = toPageView(itemList.data?.page ?? { page, size: 0, total: 0 }, items.length);

  const itemDetail = useItemDetail(selectedItemId);

  /*
   * 단위 목록은 **원본 구획의 기준 단위 이름에만** 쓴다 —
   * 목록만 훑는 동안 쓰지 않을 목록을 받아 둘 이유가 없다.
   */
  const uomOptions = useUomOptions(selectedItemId !== null);

  const [formState, setFormState] = useState<ItemAttrsFormState | null>(null);

  /**
   * 폼의 기준값 출처는 **상세 응답 객체**다.
   *
   * 출처가 그대로면 다시 세우지 않아 사용자가 입력하는 동안 값이 서버 값으로 되돌아가지 않는다.
   * 캐시가 같은 값을 돌려주면 객체 동일성이 유지되므로 다시 세우지 않는다.
   */
  const formSource = itemDetail.data ?? null;

  if (formSource === null) {
    if (formState !== null) setFormState(null);
  } else if (formState?.source !== formSource) {
    const seeded = itemToAttrsFormValues(formSource.item);
    setFormState({ source: formSource, baseline: seeded, values: seeded });
  }

  const isDirty =
    formState !== null && !isSameItemAttrsValues(formState.values, formState.baseline);

  /** 보내기 전에 화면에서 잡은 오류. 저장을 누른 뒤에만 세운다 — 입력 도중에 붉은 글씨를 띄우지 않는다. */
  const [attrsFieldErrors, setAttrsFieldErrors] = useState<Record<string, string>>({});

  const attrsWrite = useMasterWrite<ItemAttrsWriteVariables, Item>({
    request: ({ values, source }, headers) =>
      client.PUT('/mdm/items/{itemId}', {
        params: {
          path: { itemId: selectedItemId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body: toItemUpdate(values, source),
      }),
    /*
     * 잠금 토큰은 **상세 경로**에 보관돼 있다(§5.3 표 1행). 보관 키가 요청 경로라
     * 다른 경로로 꺼내면 언제나 비어 있다.
     *
     * 이 화면의 쓰기 여섯 중 `If-Match`를 요구하는 것은 둘이고 이것이 그 하나다 —
     * 나머지 넷(부속 치환 3종·기본 지정)은 `etagPath`가 **`null`**이어야 한다.
     * 그 자리에 상세 경로를 주면 요청이 나가지 않고 멈춘다.
     */
    etagPath: selectedItemId === null ? null : itemDetailPath(selectedItemId),
    /*
     * 성공 응답에 `ETag`가 오지만 상세까지 무효화한다 —
     * 다른 필드가 서버에서 바뀌었을 수 있고, 무효화를 빠뜨리면 다음 저장이 낡은 토큰을 쓴다.
     */
    invalidateKeys: [itemKeys.all],
    knownFields: ITEM_ATTRS_FORM_FIELDS,
    onSuccess: (saved) => {
      setAttrsFieldErrors({});
      const next = itemToAttrsFormValues(saved);
      setFormState((prev) => (prev === null ? prev : { ...prev, baseline: next, values: next }));
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /* ── 부속 정보 · 사업부 매핑 ────────────────────────────────────────────── */

  const buMapList = useBuMaps(selectedItemId, isSubsidiaryTab);
  const businessUnitOptions = useBusinessUnitOptions(isSubsidiaryTab);

  const [buMapState, setBuMapState] = useState<BuMapDraftState | null>(null);

  /**
   * 초안의 출처. 서버 응답 객체가 바뀔 때만 다시 세운다 —
   * 사용자가 표를 고치는 동안 캐시가 갱신돼도 편집 중인 목록이 되돌아가지 않는다.
   */
  const buMapSource = buMapList.data ?? null;

  if (buMapSource === null) {
    if (buMapState !== null) setBuMapState(null);
  } else if (buMapState?.source !== buMapSource) {
    const seeded = toBuMapDrafts(buMapSource.items);
    setBuMapState({ source: buMapSource, baseline: seeded, drafts: seeded });
  }

  const buMapDrafts = buMapState?.drafts ?? [];
  const isBuMapDirty =
    buMapState !== null && !isSameBuMapDrafts(buMapState.drafts, buMapState.baseline);

  /**
   * 표에 보이는 대상 품목의 이름. **행마다 상세를 부른다**(결정 12) —
   * 계약에 번호 목록으로 품목을 한꺼번에 받는 수단이 없다.
   */
  const buMapItemIds = useMemo(
    () =>
      buMapDrafts
        .map((draft) => Number(draft.toItemId))
        .filter((itemId) => Number.isInteger(itemId) && itemId > 0),
    [buMapDrafts],
  );
  const buMapItemNames = useItemNames(buMapItemIds);

  /** 편집 창의 대상. **열 때만 마운트한다** — 닫힌 창을 남기면 지난 값이 살아 있다. */
  const [editingBuMap, setEditingBuMap] = useState<EditingRow<BuMapDraft> | null>(null);

  const buMapWrite = useMasterWrite<BuMapDraft[], ItemBuItemMapListResponse>({
    request: (drafts, headers) =>
      client.PUT('/mdm/items/{itemId}/bu-item-maps', {
        params: {
          path: { itemId: selectedItemId ?? 0 },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
        /*
         * **경로의 `itemId`가 `fromItemId`다**(계약). 본문에 다시 실으면 두 곳이
         * 정본을 다투게 되고, 계약의 요청 항목에 그 키 자체가 없다.
         */
        body: { maps: toBuMapsPayload(drafts) },
      }),
    /*
     * **반드시 `null`이다**(§5.3 표 2행). 계약에 이 쓰기의 `If-Match` 파라미터 자체가 없고
     * 목록 조회가 `ETag`를 주지도 않는다 — 상세 경로를 주면 토큰을 찾지 못해
     * 요청이 **나가지 않고 멈춘다**(M17).
     */
    etagPath: null,
    invalidateKeys: [subsidiaryKeys.buMaps(selectedItemId ?? 0)],
    // 대응하는 입력칸이 이 구획에 없다(창 안에 있다) — 필드 오류도 배너로 올린다.
    knownFields: [],
    onSuccess: (saved) => {
      /*
       * **서버 응답으로 초안을 다시 세운다.** 서버가 행 번호를 새로 매기므로
       * 보낸 목록을 그대로 두면 다음 저장이 옛 번호로 도는 것처럼 보인다.
       */
      const next = toBuMapDrafts(saved.items);
      setBuMapState({ source: saved, baseline: next, drafts: next });
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const changeBuMapDrafts = (next: (drafts: BuMapDraft[]) => BuMapDraft[]) => {
    setBuMapState((prev) => (prev === null ? prev : { ...prev, drafts: next(prev.drafts) }));
  };

  const openBuMapDialog = (draft: BuMapDraft, isNew: boolean) => {
    buMapWrite.reset();
    setEditingBuMap({ draft, isNew });
  };

  /* ── 부속 정보 · 단위 환산 ──────────────────────────────────────────────── */

  const uomConversionList = useUomConversions(selectedItemId, isSubsidiaryTab);

  const [uomConversionState, setUomConversionState] = useState<UomConversionDraftState | null>(
    null,
  );

  const uomConversionSource = uomConversionList.data ?? null;

  if (uomConversionSource === null) {
    if (uomConversionState !== null) setUomConversionState(null);
  } else if (uomConversionState?.source !== uomConversionSource) {
    const seeded = toUomConversionDrafts(uomConversionSource.items);
    setUomConversionState({ source: uomConversionSource, baseline: seeded, drafts: seeded });
  }

  const uomConversionDrafts = uomConversionState?.drafts ?? [];
  const isUomConversionDirty =
    uomConversionState !== null &&
    !isSameUomConversionDrafts(uomConversionState.drafts, uomConversionState.baseline);

  const [editingUomConversion, setEditingUomConversion] =
    useState<EditingRow<UomConversionDraft> | null>(null);

  const uomConversionWrite = useMasterWrite<UomConversionDraft[], ItemUomConversionListResponse>({
    request: (drafts, headers) =>
      client.PUT('/mdm/items/{itemId}/uom-conversions', {
        params: {
          path: { itemId: selectedItemId ?? 0 },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
        body: { conversions: toUomConversionsPayload(drafts) },
      }),
    /* **반드시 `null`이다**(§5.3 표 3행) — 사업부 매핑과 같은 근거다(M17). */
    etagPath: null,
    invalidateKeys: [subsidiaryKeys.uomConversions(selectedItemId ?? 0)],
    knownFields: [],
    onSuccess: (saved) => {
      const next = toUomConversionDrafts(saved.items);
      setUomConversionState({ source: saved, baseline: next, drafts: next });
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const changeUomConversionDrafts = (
    next: (drafts: UomConversionDraft[]) => UomConversionDraft[],
  ) => {
    setUomConversionState((prev) =>
      prev === null ? prev : { ...prev, drafts: next(prev.drafts) },
    );
  };

  const openUomConversionDialog = (draft: UomConversionDraft, isNew: boolean) => {
    uomConversionWrite.reset();
    setEditingUomConversion({ draft, isNew });
  };

  /* ── 부속 정보 · 외부 코드 ──────────────────────────────────────────────── */

  const externalCodeList = useExternalCodes(selectedItemId, isSubsidiaryTab);
  const partnerOptions = usePartnerOptions(isSubsidiaryTab);

  const [externalCodeState, setExternalCodeState] = useState<ExternalCodeDraftState | null>(null);

  const externalCodeSource = externalCodeList.data ?? null;

  if (externalCodeSource === null) {
    if (externalCodeState !== null) setExternalCodeState(null);
  } else if (externalCodeState?.source !== externalCodeSource) {
    const seeded = toExternalCodeDrafts(externalCodeSource.items);
    setExternalCodeState({ source: externalCodeSource, baseline: seeded, drafts: seeded });
  }

  const externalCodeDrafts = externalCodeState?.drafts ?? [];
  const isExternalCodeDirty =
    externalCodeState !== null &&
    !isSameExternalCodeDrafts(externalCodeState.drafts, externalCodeState.baseline);

  const [editingExternalCode, setEditingExternalCode] =
    useState<EditingRow<ExternalCodeDraft> | null>(null);

  const externalCodeWrite = useMasterWrite<ExternalCodeDraft[], ItemExternalCodeListResponse>({
    request: (drafts, headers) =>
      client.PUT('/mdm/items/{itemId}/external-codes', {
        params: {
          path: { itemId: selectedItemId ?? 0 },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
        body: { externalCodes: toExternalCodesPayload(drafts) },
      }),
    /* **반드시 `null`이다**(§5.3 표 4행) — 부속 3종이 같은 근거다(M17). */
    etagPath: null,
    invalidateKeys: [subsidiaryKeys.externalCodes(selectedItemId ?? 0)],
    knownFields: [],
    onSuccess: (saved) => {
      const next = toExternalCodeDrafts(saved.items);
      setExternalCodeState({ source: saved, baseline: next, drafts: next });
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const changeExternalCodeDrafts = (next: (drafts: ExternalCodeDraft[]) => ExternalCodeDraft[]) => {
    setExternalCodeState((prev) => (prev === null ? prev : { ...prev, drafts: next(prev.drafts) }));
  };

  const openExternalCodeDialog = (draft: ExternalCodeDraft, isNew: boolean) => {
    externalCodeWrite.reset();
    setEditingExternalCode({ draft, isNew });
  };

  /* ── 자재 명세서 ────────────────────────────────────────────────────────── */

  const bomList = useBomList(selectedItemId, isBomTab);
  const boms = bomList.data?.items ?? [];

  /**
   * 기본 지정을 기다리는 자재 명세서. **확인 창은 이 값이 있을 때만 마운트한다** —
   * 닫힌 창을 남기면 지난 대상이 살아 있고 표에도 없는 버튼이 검색에 잡힌다.
   */
  const [pendingDefaultBom, setPendingDefaultBom] = useState<Bom | null>(null);

  const setDefaultWrite = useMasterWrite<number, Bom>({
    request: (bomId, headers) =>
      client.POST('/planning/boms/{bomId}:set-default', {
        params: {
          path: { bomId },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
      }),
    /*
     * **반드시 `null`이다**(§5.3 표 5행). 계약에 이 쓰기의 `If-Match` 파라미터 자체가 없고
     * 헤더 목록·상세 어느 쪽도 `ETag`를 주지 않는다 — 상세 경로를 주면 토큰을 찾지 못해
     * 요청이 **나가지 않고 멈춘다**(M17과 같은 갈래).
     */
    etagPath: null,
    /*
     * **헤더 목록만 무효화한다.** 서버가 지정한 줄만 응답으로 돌려주므로(기존 기본의 해제는
     * 반영되나 응답에 없다) 목록을 다시 받아야 어느 줄이 기본인지 화면이 알 수 있다.
     * 구성품은 달라지지 않으므로 함께 받지 않는다.
     */
    invalidateKeys: [bomKeys.list(selectedItemId ?? 0)],
    // 대응하는 입력칸이 없다(본문 자체가 없는 요청이다) — 필드 오류도 배너로 올린다.
    knownFields: [],
    onSuccess: () => {
      setPendingDefaultBom(null);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /* ── 선택 수명 ──────────────────────────────────────────────────────────── */

  /**
   * 이 품목에 매달린 편집 상태를 통째로 비운다.
   *
   * 폼과 초안은 조회 응답에서 다시 세워지므로 스스로 낫지만, **쓰기 오류와 열린 창은 낫지 않는다** —
   * 어느 품목에서 난 실패인지 훅이 알지 못해 다음 품목 화면에 그대로 남는다.
   */
  const resetItemEditing = () => {
    attrsWrite.reset();
    setFormState(null);
    setAttrsFieldErrors({});

    buMapWrite.reset();
    setBuMapState(null);
    setEditingBuMap(null);

    uomConversionWrite.reset();
    setUomConversionState(null);
    setEditingUomConversion(null);

    externalCodeWrite.reset();
    setExternalCodeState(null);
    setEditingExternalCode(null);

    setDefaultWrite.reset();
    setPendingDefaultBom(null);
  };

  /*
   * 위 함수는 매 렌더 새로 만들어지므로 그대로 의존성에 넣으면 렌더마다 초기화가 돈다 —
   * 입력 도중에 값이 사라진다. 최신 함수를 참조로 들고 **고른 품목에만** 반응하게 한다.
   */
  const resetItemEditingRef = useRef(resetItemEditing);
  resetItemEditingRef.current = resetItemEditing;

  /**
   * 선택 수명 규칙의 실행 지점(§5.4 3행). **클릭 핸들러가 아니라 고른 품목에 묶는다.**
   *
   * 클릭에만 두면 뒤로가기·앞으로가기·주소 직접 편집처럼 핸들러를 거치지 않는 경로에서
   * **앞 품목의 실패 배너가 다음 품목 화면에 따라온다** — 사용자는 지금 품목이 저장에
   * 실패한 줄 안다. 조건 변경·쪽 이동도 주소에서 `item`을 떨구므로 이 한 곳을 지나간다.
   */
  useEffect(() => {
    resetItemEditingRef.current();
  }, [selectedItemId]);

  /**
   * 주소의 일부만 고친다.
   *
   * **한 조작은 이 함수를 한 번만 부른다.** 한 틱에 두 번 부르면 앞 갱신이 렌더되지 않은 채
   * 히스토리 칸으로 남아, 뒤로가기가 사용자가 본 적 없는 중간 상태로 떨어진다.
   *
   * **주소가 달라지지 않으면 갱신하지 않는다.** 같은 값을 다시 쓰는 갱신은 화면을 바꾸지 않으면서
   * 히스토리 칸만 늘린다.
   */
  const patchSearchParams = (patch: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    patch(next);

    if (next.toString() === searchParams.toString()) return;

    setSearchParams(next);
  };

  /**
   * 조건·쪽이 바뀌면 **주소를 통째로 새로 만든다.**
   * 그래야 `item`이 자연히 사라진다 — 보이는 행이 달라지는데 선택이 남으면
   * 우 칸의 내용이 어디서 온 것인지 알 수 없다.
   *
   * 편집 상태를 여기서 비우지 않는다. `item`이 사라지는 것을 위 효과가 보고 비운다 —
   * 비우는 규칙이 조작마다 흩어지면 그중 하나를 빠뜨렸을 때 드러나지 않는다.
   */
  const applyFilters = (next: ItemFilters) => {
    setSearchParams(toSearchParams(tab.id, subTab.id, next, 1));
  };

  const changePage = (nextPage: number) => {
    setSearchParams(toSearchParams(tab.id, subTab.id, filters, nextPage));
  };

  /**
   * 품목을 고른다. **주소 갱신 한 번으로 끝낸다** — 나눠 부르면 뒤로가기가
   * 사용자가 본 적 없는 중간 상태로 떨어진다.
   *
   * **이미 고른 품목을 다시 눌러도 히스토리를 늘리지 않는다.** 화면이 달라지지 않는 갱신은
   * 뒤로가기 한 번을 헛돌게 만든다.
   *
   * 편집 상태를 여기서 비우지 않는다 — 비우기는 고른 품목에 묶여 있고, 재클릭은
   * 그 값을 바꾸지 않으므로 저장하지 않은 입력이 그대로 남는다.
   */
  const handleSelectItem = (itemId: number) => {
    if (itemId === selectedItemId) return;

    patchSearchParams((next) => {
      next.set(ITEM_KEY, String(itemId));
    });
  };

  /**
   * 탭을 옮긴다. **아무것도 비우지 않는다**(M09).
   *
   * 좌 목록도 고른 품목도 달라지지 않는다 — 같은 품목의 다른 면을 보는 것이다.
   * 앞선 화면(W-06-06)은 탭마다 목록이 통째로 달라 전부 비웠고, 여기는 반대다.
   */
  const changeTab = (value: string) => {
    patchSearchParams((next) => {
      if (value === DEFAULT_TAB_ID) {
        // 기본값은 주소에 쓰지 않는다 — 빈 조건과 같은 규칙이다.
        next.delete(TAB_KEY);
      } else {
        next.set(TAB_KEY, value);
      }
    });
  };

  /**
   * 부속 정보 안의 하위 탭을 옮긴다. **여기도 아무것도 비우지 않는다.**
   *
   * 세 부속 자원은 서로 다른 자원이라 함께 산다(§5.4) — 사업부 매핑을 고치다
   * 단위 환산을 보고 돌아왔을 때 앞의 편집이 사라져 있으면 안 된다.
   */
  const changeSubTab = (value: string) => {
    patchSearchParams((next) => {
      if (value === DEFAULT_SUBSIDIARY_TAB_ID) {
        next.delete(SUBSIDIARY_TAB_KEY);
      } else {
        next.set(SUBSIDIARY_TAB_KEY, value);
      }
    });
  };

  /** 값을 고치는 중에 옛 오류가 남아 있으면 무엇을 고쳐야 하는지 알 수 없다. */
  const changeAttrsValues = (patch: Partial<ItemAttrsFormValues>) => {
    setFormState((prev) =>
      prev === null ? prev : { ...prev, values: { ...prev.values, ...patch } },
    );

    for (const field of Object.keys(patch)) {
      attrsWrite.clearFieldError(field);
      setAttrsFieldErrors((prev) => {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSaveAttrs = () => {
    if (formState === null) return;

    const errors = validateItemAttrsForm(formState.values);
    setAttrsFieldErrors(errors);

    // 화면에서 잡히는 오류는 서버로 보내지 않는다.
    if (Object.keys(errors).length > 0) return;

    /*
     * **`isActive`의 출처는 조회 결과다**(결정 3). 폼에 그 값을 두지 않았으므로
     * 저장할 때 상세 응답의 품목을 함께 넘긴다 — 되돌려 싣지 않으면
     * 미사용 품목이 저장하는 순간 되살아난다.
     */
    attrsWrite.write({ values: formState.values, source: formState.source.item });
  };

  /**
   * 저장 충돌을 푸는 유일한 경로. 계약이 덮어쓰기 강제를 제공하지 않으므로
   * 최신 값을 받아 다시 입력하는 수밖에 없고, 입력한 내용은 사라진다.
   */
  const reloadItemDetail = () => {
    resetItemEditing();
    void itemDetail.refetch();
  };

  /**
   * 선택 목록이 잘리거나 실패했다는 사실을 구획 위에 낸다.
   * 알리지 않으면 이름이 이유 없이 비어 보이고 사용자는 값이 사라진 줄 안다.
   */
  const renderOptionsNotice = (lookups: LookupResult[]): ReactNode => {
    if (lookups.some((lookup) => lookup.isError)) {
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.optionsLoadFailed}</AlertBanner>
        </div>
      );
    }

    if (lookups.some((lookup) => lookup.truncated)) {
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.optionsTruncated}</AlertBanner>
        </div>
      );
    }

    return null;
  };

  /**
   * 우 칸 머리 — 품목 원본 정보. **쓰기 경로가 없다**(결정 1).
   * 선택 전·불러오는 중·실패를 각각 다른 화면으로 낸다 — 빈 값을 보이면 자료로 읽힌다.
   */
  const renderOriginPane = (): ReactNode => {
    if (selectedItemId === null) {
      return (
        <section className="pane" aria-label={t.panes.itemOrigin}>
          <EmptyState size="sm" title={t.empty.notSelected} />
        </section>
      );
    }

    if (itemDetail.isError) {
      return (
        <section className="pane" aria-label={t.panes.itemOrigin}>
          <LoadErrorBanner error={itemDetail.error} onRetry={() => void itemDetail.refetch()} />
        </section>
      );
    }

    if (itemDetail.data === undefined) {
      return (
        <section className="pane" aria-label={t.panes.itemOrigin}>
          <div role="status" aria-label={t.loading.itemDetail}>
            <SkeletonText lines={4} />
          </div>
        </section>
      );
    }

    return (
      <ItemOriginPane
        item={itemDetail.data.item}
        uomEntries={uomOptions.entries}
        isUomLoading={uomOptions.isLoading}
      />
    );
  };

  /**
   * 탭① — 확장 속성. 상세를 받지 못한 상태에서 빈 폼을 보이면 사용자가 그것을 자료로 읽는다.
   *
   * 조회 실패·불러오는 중은 원본 구획이 이미 알리므로 여기서 되풀이하지 않는다 —
   * 같은 화면에 같은 안내가 둘이면 무엇이 실패한 것인지 오히려 흐려진다.
   */
  const renderAttrsPane = (): ReactNode => {
    if (formState === null || itemDetail.data === undefined) return null;

    return (
      <ItemAttrsPane
        values={formState.values}
        /* 되돌려 싣는 값과 화면에 내는 값이 **같은 출처**여야 한다. */
        isActive={formState.source.item.isActive}
        onChange={changeAttrsValues}
        // 로컬 검증 결과가 서버 오류를 덮는다 — 지금 고칠 수 있는 것을 먼저 보인다.
        fieldErrors={{ ...attrsWrite.fieldErrors, ...attrsFieldErrors }}
        /*
         * 400·403·409·`STATE_LOCKED`가 전부 이 공통 배너로 온다.
         * **이 화면 전용 충돌 문구를 만들지 않는다** — 원인 구분(외부 재수신 등)은
         * 공통 규약 문구가 이미 갖고 있다.
         */
        banner={<SaveErrorBanner error={attrsWrite.error} onReload={reloadItemDetail} />}
        isDirty={isDirty}
        isSaving={attrsWrite.isSaving}
        onSave={handleSaveAttrs}
        onCancel={() => {
          setAttrsFieldErrors({});
          attrsWrite.reset();
          setFormState((prev) => (prev === null ? prev : { ...prev, values: prev.baseline }));
        }}
      />
    );
  };

  /** 하위 탭①-1 — 사업부 매핑. */
  const renderBuMapPane = (): ReactNode => (
    <BuMapPane
      drafts={buMapDrafts}
      isLoading={buMapList.isPending}
      businessUnitEntries={businessUnitOptions.entries}
      isBusinessUnitLoading={businessUnitOptions.isLoading}
      itemNameEntries={buMapItemNames.entries}
      isItemNameLoading={buMapItemNames.isLoading}
      /*
       * 이름 조회 실패는 **저장을 막지 않는다** — 표시만의 문제라 잘림·실패 안내와
       * 같은 자리에 다른 문구로 낸다.
       */
      optionsNotice={
        buMapItemNames.isError ? (
          <div className="banner-slot">
            <AlertBanner variant="warning">{t.buMap.itemNamesLoadFailed}</AlertBanner>
          </div>
        ) : (
          renderOptionsNotice([businessUnitOptions])
        )
      }
      loadError={
        buMapList.isError ? (
          <LoadErrorBanner error={buMapList.error} onRetry={() => void buMapList.refetch()} />
        ) : null
      }
      /*
       * 400·403이 이 공통 배너로 온다. **이 화면 전용 문구를 만들지 않는다.**
       * 「최신 불러오기」를 주지 않는다 — 이 쓰기에는 낙관적 잠금이 없어 충돌이라는 갈래 자체가 없다.
       */
      banner={<SaveErrorBanner error={buMapWrite.error} />}
      isDirty={isBuMapDirty}
      isSaving={buMapWrite.isSaving}
      onAdd={() => openBuMapDialog(createBuMapDraft(), true)}
      onEdit={(draftId) => {
        const found = buMapDrafts.find((draft) => draft.draftId === draftId);
        if (found !== undefined) openBuMapDialog(found, false);
      }}
      onRemove={(draftId) => {
        changeBuMapDrafts((drafts) => removeBuMapDraft(drafts, draftId));
      }}
      onSave={() => {
        if (buMapState === null) return;

        buMapWrite.write(buMapState.drafts);
      }}
      onCancel={() => {
        buMapWrite.reset();
        setBuMapState((prev) => (prev === null ? prev : { ...prev, drafts: prev.baseline }));
      }}
    />
  );

  /** 하위 탭①-2 — 단위 환산. */
  const renderUomConversionPane = (): ReactNode => (
    <UomConversionPane
      drafts={uomConversionDrafts}
      isLoading={uomConversionList.isPending}
      uomEntries={uomOptions.entries}
      isUomLoading={uomOptions.isLoading}
      /*
       * **단위 목록 안내의 주인은 이 페인이 아니다.**
       *
       * 같은 목록을 원본 구획의 기준 단위도 쓰고, 그 구획은 어느 탭에서나 보인다.
       * 그래서 안내를 우 칸 머리에 한 번만 낸다(`renderOptionsNotice`의 유일한 호출부) —
       * 여기서 한 번 더 내면 이 하위 탭에서만 같은 문구가 둘로 보인다.
       */
      optionsNotice={null}
      loadError={
        uomConversionList.isError ? (
          <LoadErrorBanner
            error={uomConversionList.error}
            onRetry={() => void uomConversionList.refetch()}
          />
        ) : null
      }
      /* 낙관적 잠금이 없어 충돌 갈래가 없다 — 「최신 불러오기」를 주지 않는다. */
      banner={<SaveErrorBanner error={uomConversionWrite.error} />}
      isDirty={isUomConversionDirty}
      isSaving={uomConversionWrite.isSaving}
      onAdd={() => openUomConversionDialog(createUomConversionDraft(), true)}
      onEdit={(draftId) => {
        const found = uomConversionDrafts.find((draft) => draft.draftId === draftId);
        if (found !== undefined) openUomConversionDialog(found, false);
      }}
      onRemove={(draftId) => {
        changeUomConversionDrafts((drafts) => removeUomConversionDraft(drafts, draftId));
      }}
      onSave={() => {
        if (uomConversionState === null) return;

        uomConversionWrite.write(uomConversionState.drafts);
      }}
      onCancel={() => {
        uomConversionWrite.reset();
        setUomConversionState((prev) =>
          prev === null ? prev : { ...prev, drafts: prev.baseline },
        );
      }}
    />
  );

  /** 하위 탭①-3 — 외부 코드. */
  const renderExternalCodePane = (): ReactNode => (
    <ExternalCodePane
      drafts={externalCodeDrafts}
      isLoading={externalCodeList.isPending}
      partnerEntries={partnerOptions.entries}
      isPartnerLoading={partnerOptions.isLoading}
      optionsNotice={renderOptionsNotice([partnerOptions])}
      loadError={
        externalCodeList.isError ? (
          <LoadErrorBanner
            error={externalCodeList.error}
            onRetry={() => void externalCodeList.refetch()}
          />
        ) : null
      }
      /* 낙관적 잠금이 없어 충돌 갈래가 없다 — 「최신 불러오기」를 주지 않는다. */
      banner={<SaveErrorBanner error={externalCodeWrite.error} />}
      isDirty={isExternalCodeDirty}
      isSaving={externalCodeWrite.isSaving}
      onAdd={() => openExternalCodeDialog(createExternalCodeDraft(), true)}
      onEdit={(draftId) => {
        const found = externalCodeDrafts.find((draft) => draft.draftId === draftId);
        if (found !== undefined) openExternalCodeDialog(found, false);
      }}
      onRemove={(draftId) => {
        changeExternalCodeDrafts((drafts) => removeExternalCodeDraft(drafts, draftId));
      }}
      onSave={() => {
        if (externalCodeState === null) return;

        externalCodeWrite.write(externalCodeState.drafts);
      }}
      onCancel={() => {
        externalCodeWrite.reset();
        setExternalCodeState((prev) => (prev === null ? prev : { ...prev, drafts: prev.baseline }));
      }}
    />
  );

  /**
   * 탭③ — 자재 명세서. 지금은 헤더 목록과 기본 지정만 있다.
   *
   * **여기서 서버로 보내지 않는다.** 표의 버튼은 확인 창을 열기만 하고, 지정은 그 창의
   * 확인이 `:set-default` **한 번**으로 끝낸다(결정 9).
   */
  const renderBomPane = (): ReactNode => (
    <BomListPane
      boms={boms}
      isLoading={bomList.isPending}
      loadError={
        bomList.isError ? (
          <LoadErrorBanner error={bomList.error} onRetry={() => void bomList.refetch()} />
        ) : null
      }
      /*
       * **실패 배너를 여기 두지 않는다.** 이 페인의 유일한 쓰기가 확인 창 안에서 일어나므로
       * 실패한 이유도 그 창에 낸다 — 두 자리에 두면 창이 열린 채 같은 문구가 둘로 보인다(F1).
       */
      onRequestSetDefault={(bom) => {
        setDefaultWrite.reset();
        setPendingDefaultBom(bom);
      }}
    />
  );

  const subTabContentOf = (subTabId: string): ReactNode => {
    if (subTabId === 'bu') return renderBuMapPane();
    if (subTabId === 'uom') return renderUomConversionPane();
    if (subTabId === 'ext') return renderExternalCodePane();

    return null;
  };

  /**
   * 탭② — 부속 정보. **탭 안의 탭이다**(결정 2).
   *
   * 바깥 탭은 우 칸 머리에, 안쪽 탭은 이 페인 안에 둔다 — 두 층이 같은 줄에 있으면
   * 어느 것이 무엇을 가르는지 읽히지 않는다.
   */
  const renderSubsidiaryPane = (): ReactNode => (
    <section className="pane-stack">
      <Tabs
        aria-label={t.subTabs.label}
        size="sm"
        value={subTab.id}
        onChange={changeSubTab}
        items={SUBSIDIARY_TABS.map((definition) => ({
          value: definition.id,
          label: definition.label,
          /* 활성 하위 탭의 내용만 만든다 — 디자인 시스템 Tabs는 비활성 패널도 DOM에 둔다. */
          content: definition.id === subTab.id ? subTabContentOf(definition.id) : null,
        }))}
      />
    </section>
  );

  const tabContentOf = (tabId: string): ReactNode => {
    if (tabId === 'attrs') return renderAttrsPane();
    if (tabId === 'sub') return renderSubsidiaryPane();
    if (tabId === 'bom') return renderBomPane();

    return null;
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      <div className="two-pane">
        <ItemListPane
          items={items}
          isLoading={itemList.isPending}
          appliedFilters={filters}
          onApplyFilters={applyFilters}
          pageView={pageView}
          onChangePage={changePage}
          selectedItemId={selectedItemId}
          onSelect={handleSelectItem}
          loadError={
            itemList.isError ? (
              <LoadErrorBanner error={itemList.error} onRetry={() => void itemList.refetch()} />
            ) : null
          }
        />

        {/*
         * 우 칸은 구획을 세로로 쌓는다 — 원본 구획 위, 탭 페인 아래.
         * 원본 구획을 **탭 밖 맨 위**에 두는 것이 결정 2다: 어느 탭에 있어도 지금 어느 품목인지
         * 보이고, 원본에 저장 버튼이 없다는 사실이 항상 눈에 보인다.
         */}
        <div className="pane-stack">
          {selectedItemId !== null && renderOptionsNotice([uomOptions])}
          {renderOriginPane()}

          {/*
           * 품목을 고르기 전에는 탭을 렌더하지 않는다 — 「먼저 고르세요」를 두 번 쌓으면
           * 무엇을 하라는 안내인지 오히려 흐려진다.
           */}
          {selectedItemId !== null && (
            <Tabs
              aria-label={t.tabs.label}
              value={tab.id}
              onChange={changeTab}
              items={ITEM_EXTENDED_ATTRS_TABS.map((definition) => ({
                value: definition.id,
                label: definition.label,
                /*
                 * 활성 탭의 내용만 만든다. 디자인 시스템 Tabs는 비활성 패널도 DOM에 두므로
                 * 모두 만들면 보이지 않는 폼이 함께 살아 있게 된다.
                 */
                content: definition.id === tab.id ? tabContentOf(definition.id) : null,
              }))}
            />
          )}
        </div>
      </div>

      {/*
       * **열 때만 마운트한다.** 디자인 시스템 `Dialog`는 닫혀도 내용이 DOM에 남아,
       * 항상 렌더하면 지난 값이 살아 있고 표에도 없는 입력칸이 검색에 잡힌다.
       */}
      {editingBuMap !== null && (
        <BuMapFormDialog
          draft={editingBuMap.draft}
          isNew={editingBuMap.isNew}
          businessUnitOptions={(selected) =>
            selectableOptions(businessUnitOptions.entries, selected)
          }
          /*
           * 표가 이미 아는 이름을 넘긴다 — 검색 결과에 없어도 선택칸에 번호가 보이지 않는다.
           * **로딩 갈래를 함께 넘긴다**: 빠뜨리면 이름을 받는 중인 창에서만 「알 수 없음」이 되어
           * 표는 「불러오는 중…」인데 창은 값이 없는 것처럼 보인다.
           */
          selectedItemLabel={
            editingBuMap.draft.toItemId === ''
              ? undefined
              : lookupLabel(
                  buMapItemNames.entries,
                  Number(editingBuMap.draft.toItemId),
                  buMapItemNames.isLoading,
                )
          }
          onClose={() => setEditingBuMap(null)}
          onConfirm={(next) => {
            changeBuMapDrafts((drafts) => upsertBuMapDraft(drafts, next));
            setEditingBuMap(null);
          }}
        />
      )}

      {editingUomConversion !== null && (
        <UomConversionFormDialog
          draft={editingUomConversion.draft}
          isNew={editingUomConversion.isNew}
          /* 자기 자신은 초안 키로 걸러진다 — 수정할 때 세 값을 그대로 두는 것이 정상이다. */
          otherDrafts={uomConversionDrafts}
          uomOptions={(selected) => selectableOptions(uomOptions.entries, selected)}
          onClose={() => setEditingUomConversion(null)}
          onConfirm={(next) => {
            changeUomConversionDrafts((drafts) => upsertUomConversionDraft(drafts, next));
            setEditingUomConversion(null);
          }}
        />
      )}

      {editingExternalCode !== null && (
        <ExternalCodeFormDialog
          draft={editingExternalCode.draft}
          isNew={editingExternalCode.isNew}
          otherDrafts={externalCodeDrafts}
          partnerOptions={(selected) => selectableOptions(partnerOptions.entries, selected)}
          onClose={() => setEditingExternalCode(null)}
          onConfirm={(next) => {
            changeExternalCodeDrafts((drafts) => upsertExternalCodeDraft(drafts, next));
            setEditingExternalCode(null);
          }}
        />
      )}

      {/*
       * 기본 지정 확인. **여기서만 서버로 나가고, 나가는 요청은 하나뿐이다**(결정 9) —
       * 기존 기본의 해제를 화면이 따로 부르면 그 사이에 기본이 하나도 없는 순간이 생긴다.
       */}
      {pendingDefaultBom !== null && (
        <SetDefaultDialog
          bomName={bomName(pendingDefaultBom)}
          isSaving={setDefaultWrite.isSaving}
          banner={<SaveErrorBanner error={setDefaultWrite.error} />}
          onClose={() => {
            setDefaultWrite.reset();
            setPendingDefaultBom(null);
          }}
          onConfirm={() => {
            setDefaultWrite.write(pendingDefaultBom.bomId);
          }}
        />
      )}
    </>
  );
};
