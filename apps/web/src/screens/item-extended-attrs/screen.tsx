import { AlertBanner, Breadcrumb, EmptyState, PageHeader, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { ITEM_KEY, readItemFilters, readPage, readSelectedId, toSearchParams } from './filters';
import { ItemListPane } from './item-list-pane';
import { ItemOriginPane } from './item-origin-pane';
import { useItemDetail, useItemList } from './item-queries';
import { LoadErrorBanner } from './load-error-banner';
import { useUomOptions, type LookupResult } from './lookups';
import { toPageView } from './pagination';
import type { ItemFilters } from './types';

const t = messages.itemExtendedAttrs;

/**
 * W-06-05 컨테이너.
 *
 * 조회 조건과 선택은 URL이 소유한다(`?q=&inactive=1&page=&item=`) —
 * 새로고침·뒤로가기·공유가 같은 화면을 낸다.
 *
 * **좌 칸은 탭 밖에 있다**(결정 2). 앞선 화면(W-06-06)은 탭마다 좌 목록이 통째로 달라
 * 탭이 화면 전체를 갈랐지만, 이 화면은 탭이 전부 「지금 고른 품목」의 다른 면이다.
 *
 * **아직 탭을 렌더하지 않는다.** 탭은 그 탭의 내용이 생기는 작업에서 한 줄씩 더한다 —
 * 자리만 먼저 두면 「탭은 있는데 눌러도 빈 화면인」 상태가 된다.
 */
export const ItemExtendedAttrsScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

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
    setSearchParams(toSearchParams(next, 1));
  };

  const changePage = (nextPage: number) => {
    setSearchParams(toSearchParams(filters, nextPage));
  };

  const handleSelectItem = (itemId: number) => {
    patchSearchParams((next) => {
      next.set(ITEM_KEY, String(itemId));
    });
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
         * 우 칸은 구획을 세로로 쌓는다 — 원본 구획 아래에 탭 페인이 붙는다(작업 2 이후).
         * 원본 구획을 탭 밖 맨 위에 두는 것이 결정 2다.
         */}
        <div className="pane-stack">
          {selectedItemId !== null && renderOptionsNotice([uomOptions])}
          {renderOriginPane()}
        </div>
      </div>
    </>
  );
};
