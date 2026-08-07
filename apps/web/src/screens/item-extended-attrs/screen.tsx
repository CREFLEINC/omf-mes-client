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
import { type ReactNode, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { ITEM_KEY, readItemFilters, readPage, readSelectedId, toSearchParams } from './filters';
import { ItemAttrsPane } from './item-attrs-pane';
import { isSameItemAttrsValues, itemToAttrsFormValues, toItemUpdate } from './item-attrs-mappers';
import { ITEM_ATTRS_FORM_FIELDS, validateItemAttrsForm } from './item-attrs-validation';
import { ItemListPane } from './item-list-pane';
import { ItemOriginPane } from './item-origin-pane';
import { itemDetailPath, itemKeys, useItemDetail, useItemList } from './item-queries';
import { LoadErrorBanner } from './load-error-banner';
import { useUomOptions, type LookupResult } from './lookups';
import { toPageView } from './pagination';
import { DEFAULT_TAB_ID, ITEM_EXTENDED_ATTRS_TABS, TAB_KEY, resolveTab } from './tabs';
import type { Item, ItemAttrsFormValues, ItemFilters } from './types';

type ItemDetailResponse = components['schemas']['ItemDetailResponse'];

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
 * **탭은 만든 것만 렌더한다**(`tabs.ts`). 부속 정보·자재 명세서 탭은 그 내용이 생길 때 붙는다 —
 * 자리만 먼저 두면 「탭은 있는데 눌러도 빈 화면인」 상태가 된다.
 */
export const ItemExtendedAttrsScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { client } = useApiClient();

  const tab = resolveTab(searchParams.get(TAB_KEY));
  const filters = useMemo<ItemFilters>(() => readItemFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const selectedItemId = readSelectedId(searchParams, ITEM_KEY);

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

  /** 편집 중이던 상태를 통째로 비운다. 보이는 행이 달라질 때 함께 부른다. */
  const resetAttrsEditing = () => {
    attrsWrite.reset();
    setFormState(null);
    setAttrsFieldErrors({});
  };

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
   */
  const applyFilters = (next: ItemFilters) => {
    resetAttrsEditing();
    setSearchParams(toSearchParams(tab.id, next, 1));
  };

  const changePage = (nextPage: number) => {
    resetAttrsEditing();
    setSearchParams(toSearchParams(tab.id, filters, nextPage));
  };

  /**
   * 품목을 고른다. **주소 갱신 한 번으로 끝낸다** — 나눠 부르면 뒤로가기가
   * 사용자가 본 적 없는 중간 상태로 떨어진다.
   *
   * 편집 중이던 상태를 함께 비운다 — 다른 품목의 폼·실패 배너가 남으면
   * 뒤로가기로 돌아왔을 때 **남의 실패 배너**를 보게 된다.
   */
  const handleSelectItem = (itemId: number) => {
    resetAttrsEditing();

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
    resetAttrsEditing();
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

    return <ItemOriginPane item={itemDetail.data.item} uomEntries={uomOptions.entries} />;
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

  const tabContentOf = (tabId: string): ReactNode => (tabId === 'attrs' ? renderAttrsPane() : null);

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
    </>
  );
};
