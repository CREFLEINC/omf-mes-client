import { AlertBanner, Breadcrumb, Button, EmptyState, PageHeader } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { toApiError } from '../../patterns/request';
import { ItemPane } from './item-pane';
import { isTruncated, useItemList } from './queries';
import type { ItemFilters } from './types';

const t = messages.routing;

/**
 * 조회 실패의 원인을 한 줄 안내로 옮긴다.
 * 저장 실패와 달리 사용자가 할 수 있는 조치가 재시도뿐이라 액션도 하나다.
 *
 * 서버가 빈 문구를 주는 일이 실제로 있다 — `??`는 빈 문자열을 통과시켜 배너 본문을 지운다.
 * 그래서 널이 아니라 빈 문자열까지 명시적으로 검사한다.
 */
const describeLoadError = (error: ApiError): string => {
  switch (error.kind) {
    case 'network':
      return messages.httpError.offline;
    case 'http':
      if (error.status === 403) return messages.httpError.forbidden;
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
 * W-06-01 컨테이너 — 품목 → Rev → 헤더·공정 라인을 3단으로 놓는다.
 *
 * **접힘 기준점 1280px의 근거**(배치 규범 5의 이탈 조건이 정한 자리):
 * 좌 240 + 중 200 + 이음매 40 + 본문 안쪽 여백 48 = 528px이 왼쪽 두 칸의 하한이고,
 * 오른쪽 편집 칸은 폼 그리드 2열을 유지할 폭(약 700px)이 필요하다. 합이 약 1,228px이라
 * 기존 규범 5와 같은 1280px을 쓴다. 그 아래에서는 좌·중을 한 줄로 두고 편집 칸을 다음 줄 전체 폭으로 내린다.
 * 3단을 쓰는 화면이 둘이 되면 그때 규범으로 올린다 — 화면 한 장에서 전반 규범을 뽑으면 과적합한다.
 *
 * 조회 조건과 선택은 URL이 소유한다(`?item=&rev=&q=&noRouting=1`) —
 * 새로고침·뒤로가기·공유가 같은 화면을 낸다.
 */
export const RoutingScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<ItemFilters>(
    () => ({
      q: searchParams.get('q') ?? '',
      onlyWithoutRouting: searchParams.get('noRouting') === '1',
    }),
    [searchParams],
  );

  const selectedItemId = Number(searchParams.get('item') ?? '') || null;

  const itemList = useItemList(filters);
  const items = itemList.data?.items ?? [];

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

  const handleApplyFilters = (next: ItemFilters) => {
    updateParams({
      q: next.q === '' ? null : next.q,
      noRouting: next.onlyWithoutRouting ? '1' : null,
    });
  };

  /** 품목을 바꾸면 Rev 선택을 지운다 — 다른 품목의 Rev를 가리키면 안 된다. */
  const handleSelectItem = (itemId: number) => {
    updateParams({ item: String(itemId), rev: null });
  };

  const itemPage = itemList.data?.page;
  const isItemListTruncated = itemPage !== undefined && isTruncated(itemPage, items.length);

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {/*
       * 목록이 잘렸다는 사실을 감추지 않는다. 페이지 이동 컨트롤은 아직 없으므로
       * 조건을 좁히는 것이 사용자가 할 수 있는 조치다.
       */}
      {isItemListTruncated && itemPage !== undefined && (
        <AlertBanner variant="warning">{t.listTruncated(items.length, itemPage.total)}</AlertBanner>
      )}

      <div className="three-pane">
        <ItemPane
          items={items}
          isLoading={itemList.isPending}
          appliedFilters={filters}
          onApplyFilters={handleApplyFilters}
          selectedItemId={selectedItemId}
          onSelect={handleSelectItem}
          loadError={
            itemList.isError ? (
              <LoadErrorBanner error={itemList.error} onRetry={() => void itemList.refetch()} />
            ) : null
          }
        />

        <section className="pane" aria-label={t.panes.revision}>
          <EmptyState size="sm" title={t.empty.itemNotSelected} />
        </section>

        <div className="pane-stack">
          <section className="pane" aria-label={t.panes.header}>
            <EmptyState size="sm" title={t.empty.itemNotSelected} />
          </section>
        </div>
      </div>
    </>
  );
};
