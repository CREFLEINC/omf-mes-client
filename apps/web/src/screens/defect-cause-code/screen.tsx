import { AlertBanner, Breadcrumb, Button, EmptyState, PageHeader, Tabs } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { toApiError } from '../../patterns/request';
import { CodeListPane } from './code-list-pane';
import { indexById, isCategory, orderForGrouping } from './hierarchy';
import { isTruncated, useCodeList } from './queries';
import { CODE_TABS, resolveTab } from './tabs';
import type { CodeFilters } from './types';

const t = messages.defectCauseCode;

/**
 * 조회 실패의 원인을 한 줄 안내로 옮긴다.
 * 저장 실패와 달리 사용자가 할 수 있는 조치가 재시도뿐이라 액션도 하나다.
 *
 * 다른 화면 슬라이스에도 같은 함수가 있으나 가져다 쓰지 않는다 —
 * 화면 슬라이스끼리 참조하면 한쪽의 사정이 다른 쪽 화면을 바꾼다.
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
 * W-06-03 컨테이너. 불량 코드와 원인 코드를 같은 부품으로 그리고,
 * 탭·조회 조건·선택을 주소에 둔다.
 */
export const DefectCauseCodeScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = resolveTab(searchParams.get('tab'));
  const adapter = tab.adapter;

  const filters = useMemo<CodeFilters>(
    () => ({
      q: searchParams.get('q') ?? '',
      includeInactive: searchParams.get('inactive') === '1',
    }),
    [searchParams],
  );

  const isCreateMode = searchParams.get('mode') === 'create';
  const selectedId = isCreateMode ? null : Number(searchParams.get('sel') ?? '') || null;

  const list = useCodeList(adapter, filters);
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const byId = useMemo(() => indexById(items), [items]);
  const rows = useMemo(() => orderForGrouping(items, byId), [items, byId]);

  const selected = selectedId === null ? null : (byId.get(selectedId) ?? null);
  const canAddChild = selected !== null && isCategory(selected);

  const listPage = list.data?.page;
  const listTruncated = listPage !== undefined && isTruncated(listPage, items.length);

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

  // 조회 조건은 화면 상태가 아니라 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
  const handleApplyFilters = (next: CodeFilters) => {
    updateParams({
      q: next.q === '' ? null : next.q,
      inactive: next.includeInactive ? '1' : null,
    });
  };

  /*
   * 탭이 바뀌면 그 탭의 처음 상태로 간다. 한쪽 탭의 코드 번호가 남으면
   * 다른 탭에는 없는 리소스의 상세를 조회하게 된다.
   */
  const handleChangeTab = (value: string) => {
    setSearchParams(new URLSearchParams({ tab: value }));
  };

  const codeListPane = (
    <CodeListPane
      adapter={adapter}
      rows={rows}
      byId={byId}
      isLoading={list.isPending}
      appliedFilters={filters}
      onApplyFilters={handleApplyFilters}
      selectedId={selectedId}
      onSelect={(id) => updateParams({ sel: String(id), mode: null })}
      onAddCategory={() => updateParams({ mode: 'create', sel: null })}
      onAddChild={() => updateParams({ mode: 'create' })}
      canAddChild={canAddChild}
      loadError={
        list.isError ? (
          <LoadErrorBanner error={list.error} onRetry={() => void list.refetch()} />
        ) : null
      }
    />
  );

  const tabContent = (
    <div className="two-pane">
      {codeListPane}
      <div className="pane">
        <EmptyState size="sm" title={t.empty.codeNotSelected} />
      </div>
    </div>
  );

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
      {listTruncated && listPage !== undefined && (
        <AlertBanner variant="warning">{t.listTruncated(items.length, listPage.total)}</AlertBanner>
      )}

      <Tabs
        aria-label={t.title}
        value={tab.kind}
        onChange={handleChangeTab}
        items={CODE_TABS.map((definition) => ({
          value: definition.kind,
          label: definition.adapter.labels.tab,
          /*
           * 활성 탭의 내용만 만든다. 디자인 시스템 Tabs는 비활성 패널도 DOM에 두므로
           * 모두 만들면 보이지 않는 표가 함께 살아 있게 된다.
           */
          content: definition.kind === tab.kind ? tabContent : null,
        }))}
      />
    </>
  );
};
