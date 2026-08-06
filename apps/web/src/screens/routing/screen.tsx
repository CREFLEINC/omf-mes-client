import {
  AlertBanner,
  Breadcrumb,
  Button,
  EmptyState,
  PageHeader,
  SkeletonText,
} from '@crefle/web-ui';
import type { ApiError, components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { codeLockMessage } from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import { HeaderPane } from './header-pane';
import { ItemPane } from './item-pane';
import { isSameHeaderValues, routingToFormValues } from './mappers';
import { isTruncated, useItemList, useRoutingDetail, useRoutingList } from './queries';
import { RevisionPane } from './revision-pane';
import { resolveRoutingStatus } from './routing-status';
import type { ItemFilters, RoutingHeaderFormValues } from './types';

type RoutingDetailResponse = components['schemas']['RoutingDetailResponse'];

/** 폼의 현재 값과 그것이 어디서 나왔는지. 「고친 것이 있는가」는 둘의 비교로 판정한다. */
interface HeaderFormState {
  source: RoutingDetailResponse;
  baseline: RoutingHeaderFormValues;
  values: RoutingHeaderFormValues;
}

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
  const selectedRoutingId = Number(searchParams.get('rev') ?? '') || null;

  const itemList = useItemList(filters);
  const items = itemList.data?.items ?? [];

  const revisionList = useRoutingList(selectedItemId);
  const revisions = revisionList.data?.items ?? [];

  const detail = useRoutingDetail(selectedRoutingId);

  const [formState, setFormState] = useState<HeaderFormState | null>(null);

  /*
   * 폼의 기준값은 상세 응답에서 온다. 응답 객체가 바뀔 때만 다시 세워
   * 사용자가 입력하는 동안 값이 서버 값으로 되돌아가지 않게 한다.
   * 캐시가 같은 값을 돌려주면 객체 동일성이 유지되므로 다시 세우지 않는다.
   */
  const formSource = detail.data ?? null;

  if (formSource !== null && formState?.source !== formSource) {
    const seeded = routingToFormValues(formSource.routing);
    setFormState({ source: formSource, baseline: seeded, values: seeded });
  }

  const isHeaderDirty =
    formState !== null && !isSameHeaderValues(formState.values, formState.baseline);

  const changeHeaderValues = (patch: Partial<RoutingHeaderFormValues>) => {
    setFormState((prev) =>
      prev === null ? prev : { ...prev, values: { ...prev.values, ...patch } },
    );
  };

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

  /** 어느 품목의 Routing인지 값으로 밝힌다. 조건이 좁아져 목록에 없으면 지어내지 않는다. */
  const selectedItem = items.find((item) => item.itemId === selectedItemId) ?? null;
  const itemLabel =
    selectedItem === null ? t.values.empty : `${selectedItem.itemCode} · ${selectedItem.itemName}`;

  /**
   * 우측 편집 칸. 상세를 받지 못한 상태에서 빈 폼을 보이면 사용자가 그것을 자료로 읽는다 —
   * 선택 전·불러오는 중·실패를 각각 다른 화면으로 낸다.
   */
  const renderHeaderPane = () => {
    if (selectedItemId === null) {
      return (
        <section className="pane" aria-label={t.panes.header}>
          <EmptyState size="sm" title={t.empty.itemNotSelected} />
        </section>
      );
    }

    if (selectedRoutingId === null) {
      return (
        <section className="pane" aria-label={t.panes.header}>
          <EmptyState size="sm" title={t.empty.revisionNotSelected} />
        </section>
      );
    }

    if (detail.isError) {
      return (
        <section className="pane" aria-label={t.panes.header}>
          <LoadErrorBanner error={detail.error} onRetry={() => void detail.refetch()} />
        </section>
      );
    }

    if (detail.data === undefined || formState === null) {
      return (
        <section className="pane" aria-label={t.panes.header}>
          <div role="status" aria-label={t.loading.header}>
            <SkeletonText lines={5} />
          </div>
        </section>
      );
    }

    return (
      <HeaderPane
        itemLabel={itemLabel}
        routingVersion={detail.data.routing.routingVersion}
        status={resolveRoutingStatus(detail.data.routing.statusCode)}
        values={formState.values}
        onChange={changeHeaderValues}
        fieldErrors={{}}
        banner={null}
        // 판정의 주인은 codeEditable이다. reason은 문구 선택에만 쓴다.
        codeLockReason={codeLockMessage(detail.data.editability)}
        isDirty={isHeaderDirty}
        isSaving={false}
        onSave={undefined}
        onCancel={() =>
          setFormState((prev) => (prev === null ? prev : { ...prev, values: prev.baseline }))
        }
      />
    );
  };

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

        <RevisionPane
          revisions={revisions}
          isLoading={revisionList.isPending}
          isItemSelected={selectedItemId !== null}
          selectedRoutingId={selectedRoutingId}
          onSelect={(routingId) => updateParams({ rev: String(routingId) })}
          loadError={
            revisionList.isError ? (
              <LoadErrorBanner
                error={revisionList.error}
                onRetry={() => void revisionList.refetch()}
              />
            ) : null
          }
        />

        <div className="pane-stack">{renderHeaderPane()}</div>
      </div>
    </>
  );
};
