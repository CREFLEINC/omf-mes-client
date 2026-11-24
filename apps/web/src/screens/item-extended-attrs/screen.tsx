import { AlertBanner, EmptyState, SkeletonText, Tabs, useToast } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { BoardFrame } from '../../patterns/board-frame';
import { SaveErrorBanner, requireIfMatch, useMasterWrite } from '../../patterns/master';
import { planKeys } from '../inspection-standard/queries';
import { ITEM_KEY, readItemFilters, readPage, readSelectedId, toSearchParams } from './filters';
import { ItemAttrsPane } from './item-attrs-pane';
import { isSameItemAttrsValues, itemToAttrsFormValues, toItemUpdate } from './item-attrs-mappers';
import { ITEM_ATTRS_FORM_FIELDS, validateItemAttrsForm } from './item-attrs-validation';
import { ItemFilterBar, ItemListPane } from './item-list-pane';
import { ItemOriginFacts } from './item-origin-pane';
import { useItemPackages } from './item-package-queries';
import { ItemResourceMapSection } from './item-resource-map-section';
import {
  itemDetailPath,
  itemKeys,
  useItemDetail,
  useItemList,
  useItemTypeOptions,
} from './item-queries';
import { LoadErrorBanner } from '../../patterns/load-error-banner';
import { useUomCodes, useUomOptions, type LookupResult } from './lookups';
import { codeValueName, selectableOptions } from './options';
import { CODE_GROUPS, useCodeValueOptions } from './code-values';
import { toPageView } from './pagination';
import { subsidiaryKeys, uomConversionsPath, useUomConversions } from './subsidiary-queries';
import { DEFAULT_TAB_ID, ITEM_DETAIL_TABS, TAB_KEY, resolveTab } from './tabs';
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

type ItemDetailResponse = components['schemas']['ItemDetailResponse'];
type ItemUomConversionListResponse = components['schemas']['ItemUomConversionListResponse'];

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
 * 단위 환산 초안과 그것이 어디서 나왔는지.
 *
 * **초안을 화면이 소유한다**(§5.4). 탭 안 페인이 소유하면 탭을 옮기는 순간 언마운트되어
 * 저장하지 않은 입력이 조용히 사라진다(M10).
 */
interface UomConversionDraftState {
  source: ItemUomConversionListResponse;
  baseline: UomConversionDraft[];
  drafts: UomConversionDraft[];
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
 * W-06-05 「품목·BOM 정보」의 품목 탭. BOM 탭은 `bom-screen.tsx` 다 — 두 탭은 셸 탭 막대가 오간다(`nav-tree.ts`).
 *
 * 「ERP 연동 현황·이력」의 품목 · BOM 탭과 같은 짜임이다(사용자 지시 2026-10-28): 위에 조회 조건, 왼쪽 품목 목록 |
 * 오른쪽 고른 품목의 사실 칸과 확장 속성 / 단위 환산 / 설비·금형 탭. 제목·경로는 셸 탭 막대가 대신한다.
 *
 * 조회 조건과 선택은 URL이 소유한다(`?tab=&q=&inactive=1&page=&item=`) —
 * 새로고침·뒤로가기·공유가 같은 화면을 낸다. 탭을 옮겨도 조건·선택·초안은 비우지 않아
 * 같은 품목의 다른 면을 오갈 수 있다.
 */
export const ItemExtendedAttrsScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { client } = useApiClient();

  const tab = resolveTab(searchParams.get(TAB_KEY));
  const filters = useMemo<ItemFilters>(() => readItemFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const selectedItemId = readSelectedId(searchParams, ITEM_KEY);

  /** 단위 환산은 그 탭을 열 때 받는다 — 초안은 화면이 들고 있어 탭을 옮겨도 남는다(§5.4). */
  const isUomTab = tab.id === 'uom';

  const itemList = useItemList(filters, page);
  const items = itemList.data?.items ?? [];
  // 유형 선택지를 못 받아도 목록은 그대로 쓴다 — 「전체」와 주소에 실린 코드만 고를 수 있다.
  const itemTypes = useItemTypeOptions();

  /*
   * 서버가 준 쪽 정보를 정본으로 쓴다. 주소의 쪽 번호를 쓰면 서버가 다른 쪽을 돌려줬을 때
   * 표시와 내용이 어긋난다. 아직 받지 못했으면 건수를 지어내지 않고 0으로 둔다.
   */
  const pageView = toPageView(itemList.data?.page ?? { page, size: 0, total: 0 }, items.length);

  const itemDetail = useItemDetail(selectedItemId);
  /* 소포장은 원자재 · 부자재만 — 그 밖의 품목은 묻지 않는다(사용자 지시 2026-11-24). */
  const selectedTypeCode = itemDetail.data?.item.itemTypeCode ?? null;
  const itemPackages = useItemPackages(
    selectedTypeCode !== null && isMaterialType(selectedTypeCode) ? selectedItemId : null,
  );

  /*
   * 단위 목록은 **원본 구획의 기준 단위 이름에만** 쓴다 —
   * 목록만 훑는 동안 쓰지 않을 목록을 받아 둘 이유가 없다.
   */
  const uomOptions = useUomOptions(selectedItemId !== null);
  /* 사실 칸은 코드만(「EA」) — 「ERP 연동 현황·이력」의 품목 탭과 같은 표기. 같은 조회라 요청이 늘지 않는다. */
  const uomCodes = useUomCodes(selectedItemId !== null);

  /*
   * MES 구분(신재·재생재)의 이름. 사실 칸에 보이므로 품목을 골랐을 때 받는다.
   * 표시에만 쓰므로 미사용 코드값도 받는다 — 받지 못하면 코드 그대로 낸다.
   */
  const mesCategories = useCodeValueOptions(CODE_GROUPS.mesCategory, {
    enabled: selectedItemId !== null,
    includeInactive: true,
  });

  /*
   * 원본 구획의 품목유형 이름. 좌 목록의 선택지(사용 중인 것만)와 달리 **미사용 유형도 받는다** —
   * 고객이 사용을 멈춘 유형을 들고 있는 품목이 이름을 잃으면 안 된다. 품목을 고른 뒤에만 받는다.
   */
  const itemTypeNames = useCodeValueOptions(CODE_GROUPS.itemType, {
    enabled: selectedItemId !== null,
    includeInactive: true,
  });

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
    /* 「IQC 대상」은 그 품목 IQC 검사 기준의 기본 생략을 함께 바꾼다(#215) — 검사 기준 화면 자료도 다시 읽게 한다. */
    invalidateKeys: [itemKeys.all, planKeys.all],
    knownFields: ITEM_ATTRS_FORM_FIELDS,
    onSuccess: (saved) => {
      setAttrsFieldErrors({});
      const next = itemToAttrsFormValues(saved);
      setFormState((prev) => (prev === null ? prev : { ...prev, baseline: next, values: next }));
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /* ── 단위 환산 ──────────────────────────────────────────────── */

  /*
   * 한 번 연 품목은 탭을 옮겨도 켜 둔다 — 끄고 켜면 다시 받으러 가고, 편집 중이던 초안이 서버 응답으로
   * 되감길 여지가 생긴다(§5.4). 품목이 바뀌면 그 품목에서 탭을 열 때 다시 켠다.
   */
  const [uomOpenedFor, setUomOpenedFor] = useState<number | null>(null);
  if (isUomTab && selectedItemId !== null && uomOpenedFor !== selectedItemId) {
    setUomOpenedFor(selectedItemId);
  }
  const uomConversionList = useUomConversions(
    selectedItemId,
    selectedItemId !== null && uomOpenedFor === selectedItemId,
  );

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
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': requireIfMatch(headers),
          },
        },
        body: { conversions: toUomConversionsPayload(drafts) },
      }),
    /* ⭐ **client#602 — 이 목록 조회에 `ETag`가 새로 생겼다**(§5.3 표 3행) */
    etagPath: selectedItemId === null ? null : uomConversionsPath(selectedItemId),
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

    uomConversionWrite.reset();
    setUomConversionState(null);
    setEditingUomConversion(null);
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
    setSearchParams(toSearchParams(tab.id, next, 1));
  };

  const changePage = (nextPage: number) => {
    setSearchParams(toSearchParams(tab.id, filters, nextPage));
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

  /** 주소의 보기를 옮긴다. 같은 품목의 다른 면이므로 선택과 초안은 비우지 않는다. */
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
        itemTypeCode={formState.source.item.itemTypeCode}
        uomOptions={selectableOptions(uomOptions, formState.values.defaultLotStorageUomId)}
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
        packages={isMaterialType(formState.source.item.itemTypeCode) ? itemPackages : undefined}
        onCancel={() => {
          setAttrsFieldErrors({});
          attrsWrite.reset();
          setFormState((prev) => (prev === null ? prev : { ...prev, values: prev.baseline }));
        }}
      />
    );
  };

  /** 탭② — 단위 환산. */
  const renderUomConversionPane = (): ReactNode => (
    <UomConversionPane
      drafts={uomConversionDrafts}
      isLoading={uomConversionList.isPending}
      uomEntries={uomOptions.entries}
      isUomLoading={uomOptions.isLoading}
      isUomError={uomOptions.isError}
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

  const tabContentOf = (tabId: string): ReactNode => {
    if (tabId === 'attrs') return renderAttrsPane();
    if (tabId === 'uom') return renderUomConversionPane();
    /* 품목 번호를 `key`로 준다 — 품목이 바뀌면 열린 창·쓰기 오류가 다음 품목에 따라가지 않는다. */
    if (tabId === 'res' && selectedItemId !== null) {
      return <ItemResourceMapSection key={selectedItemId} itemId={selectedItemId} />;
    }

    return null;
  };

  /**
   * 오른쪽 구획 — 고른 품목의 사실 칸과 확장 속성 / 단위 환산 / 설비·금형 탭. **원본에 쓰기 경로가 없다**(결정 1).
   * 선택 전·불러오는 중·실패를 각각 다른 화면으로 낸다 — 빈 값을 보이면 자료로 읽힌다.
   */
  const renderDetail = (): ReactNode => {
    if (selectedItemId === null) return <EmptyState size="sm" title={t.empty.notSelected} />;

    if (itemDetail.isError) {
      return <LoadErrorBanner error={itemDetail.error} onRetry={() => void itemDetail.refetch()} />;
    }

    if (itemDetail.data === undefined) {
      return (
        <div role="status" aria-label={t.loading.itemDetail}>
          <SkeletonText lines={4} />
        </div>
      );
    }

    return (
      <>
        {renderOptionsNotice([uomOptions])}
        <ItemOriginFacts
          item={itemDetail.data.item}
          uomEntries={uomCodes.entries}
          isUomLoading={uomCodes.isLoading}
          isUomError={uomCodes.isError}
          itemTypeOptions={itemTypeNames.data}
          mesCategoryName={codeValueName(
            mesCategories.data,
            itemDetail.data.item.mesCategoryCode ?? '',
          )}
        />
        <Tabs
          aria-label={t.tabs.label}
          value={tab.id}
          onChange={changeTab}
          items={ITEM_DETAIL_TABS.map((definition) => ({
            value: definition.id,
            label: definition.label,
            content: definition.id === tab.id ? tabContentOf(definition.id) : null,
          }))}
        />
      </>
    );
  };

  return (
    <>
      <BoardFrame
        splitKey="omf-mes:item-extended-attrs:split"
        initialRatio={0.35}
        splitter={{ label: t.splitter, collapseLabel: t.listCollapse, expandLabel: t.listExpand }}
        above={{
          label: t.panes.filter,
          content: (
            <div className="pane po-board-filter item-master-filter filter-field-surface">
              <ItemFilterBar
                applied={filters}
                onApply={applyFilters}
                itemTypeOptions={itemTypes.data}
              />
            </div>
          ),
        }}
        list={{
          label: t.panes.item,
          count: itemList.data?.page.total,
          content: (
            <ItemListPane
              items={items}
              isLoading={itemList.isPending}
              appliedFilters={filters}
              onApplyFilters={applyFilters}
              pageView={pageView}
              onChangePage={changePage}
              selectedItemId={selectedItemId}
              onSelect={handleSelectItem}
              itemTypeOptions={itemTypes.data}
              loadError={
                itemList.isError ? (
                  <LoadErrorBanner error={itemList.error} onRetry={() => void itemList.refetch()} />
                ) : null
              }
            />
          ),
        }}
        detail={{ label: t.panes.detail, content: renderDetail() }}
      />

      {/*
       * **열 때만 마운트한다.** 디자인 시스템 `Dialog`는 닫혀도 내용이 DOM에 남아,
       * 항상 렌더하면 지난 값이 살아 있고 표에도 없는 입력칸이 검색에 잡힌다.
       */}
      {editingUomConversion !== null && (
        <UomConversionFormDialog
          draft={editingUomConversion.draft}
          isNew={editingUomConversion.isNew}
          /* 자기 자신은 초안 키로 걸러진다 — 수정할 때 세 값을 그대로 두는 것이 정상이다. */
          otherDrafts={uomConversionDrafts}
          uomOptions={(selected) => selectableOptions(uomOptions, selected)}
          onClose={() => setEditingUomConversion(null)}
          onConfirm={(next) => {
            changeUomConversionDrafts((drafts) => upsertUomConversionDraft(drafts, next));
            setEditingUomConversion(null);
          }}
        />
      )}
    </>
  );
};

/** 공급사에서 사 오는 품목 — 소포장(공급사·품목 기본 정보)이 있는 유형. */
const isMaterialType = (itemTypeCode: string): boolean =>
  itemTypeCode === 'RAW_MATERIAL' || itemTypeCode === 'SUBSIDIARY_MATERIAL';
