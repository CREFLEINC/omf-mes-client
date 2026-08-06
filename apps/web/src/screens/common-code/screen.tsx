import { Breadcrumb, EmptyState, PageHeader, Tabs } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { CodeGroupListPane } from './code-group-list-pane';
import { useCodeGroupList } from './code-group-queries';
import { readCodeGroupFilters, readPage, toSearchParams } from './filters';
import { LoadErrorBanner } from './load-error-banner';
import { toPageView } from './pagination';
import { COMMON_CODE_TABS, resolveTab, tabSearchParams } from './tabs';
import type { CodeGroupFilters } from './types';

const t = messages.commonCode;

/**
 * W-06-06 컨테이너.
 *
 * 조회 조건과 선택은 URL이 소유한다(`?tab=&q=&inactive=1&page=&grp=`) —
 * 새로고침·뒤로가기·공유가 같은 화면을 낸다.
 *
 * **탭은 만든 것만 렌더한다**(`tabs.ts`). 조직·작업자 탭은 그 탭의 목록·폼이 생길 때 붙는다 —
 * 자리만 먼저 두면 「탭은 있는데 눌러도 빈 화면인」 상태가 된다.
 */
export const CommonCodeScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = resolveTab(searchParams.get('tab'));

  const filters = useMemo<CodeGroupFilters>(
    () => readCodeGroupFilters(searchParams),
    [searchParams],
  );
  const page = readPage(searchParams);

  const selectedCodeGroupId = Number(searchParams.get('grp') ?? '') || null;

  const codeGroupList = useCodeGroupList(filters, page);
  const codeGroups = codeGroupList.data?.items ?? [];

  /*
   * 서버가 준 쪽 정보를 정본으로 쓴다. 주소의 쪽 번호를 쓰면 서버가 다른 쪽을 돌려줬을 때
   * 표시와 내용이 어긋난다. 아직 받지 못했으면 건수를 지어내지 않고 0으로 둔다.
   */
  const codeGroupPageView = toPageView(
    codeGroupList.data?.page ?? { page, size: 0, total: 0 },
    codeGroups.length,
  );

  /**
   * 조건·쪽이 바뀌면 **주소를 통째로 새로 만든다.**
   * 그래야 `grp`·`val`·`vpage`·`vinactive`·`new`가 자연히 사라진다 — 보이는 행이 달라지는데
   * 선택이 남으면 우 칸의 폼이 어디서 온 것인지 알 수 없다.
   */
  const applyFilters = (next: CodeGroupFilters) => {
    setSearchParams(toSearchParams(tab.id, next, 1));
  };

  const changeCodeGroupPage = (nextPage: number) => {
    setSearchParams(toSearchParams(tab.id, filters, nextPage));
  };

  const selectCodeGroup = (codeGroupId: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('grp', String(codeGroupId));
    // 다른 그룹의 코드값을 가리키면 안 된다.
    next.delete('val');
    next.delete('vpage');
    setSearchParams(next);
  };

  /*
   * 탭이 바뀌면 그 탭의 처음 상태로 간다. 한쪽 탭의 조건·선택이 남으면
   * 그 탭에 없는 자원을 조회하게 된다.
   */
  const changeTab = (value: string) => {
    setSearchParams(tabSearchParams(value));
  };

  /**
   * 우 칸 위쪽 — 코드그룹 정보.
   *
   * 상세를 받지 못한 상태에서 빈 폼을 보이면 사용자가 그것을 자료로 읽는다 —
   * 선택 전과 그 밖의 상태를 각각 다른 화면으로 낸다.
   */
  const renderCodeGroupFormPane = (): ReactNode => {
    if (selectedCodeGroupId === null) {
      return <EmptyState size="sm" title={t.codeGroup.empty.notSelected} />;
    }

    return null;
  };

  const codeTabContent = (
    <div className="two-pane">
      <CodeGroupListPane
        codeGroups={codeGroups}
        isLoading={codeGroupList.isPending}
        appliedFilters={filters}
        onApplyFilters={applyFilters}
        pageView={codeGroupPageView}
        onChangePage={changeCodeGroupPage}
        selectedCodeGroupId={selectedCodeGroupId}
        onSelect={selectCodeGroup}
        loadError={
          codeGroupList.isError ? (
            <LoadErrorBanner
              error={codeGroupList.error}
              onRetry={() => void codeGroupList.refetch()}
            />
          ) : null
        }
      />

      <div className="pane-stack">{renderCodeGroupFormPane()}</div>
    </div>
  );

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      <Tabs
        aria-label={t.tabs.label}
        value={tab.id}
        onChange={changeTab}
        items={COMMON_CODE_TABS.map((definition) => ({
          value: definition.id,
          label: definition.label,
          /*
           * 활성 탭의 내용만 만든다. 디자인 시스템 Tabs는 비활성 패널도 DOM에 두므로
           * 모두 만들면 보이지 않는 표가 함께 살아 있게 된다.
           */
          content: definition.id === tab.id ? codeTabContent : null,
        }))}
      />
    </>
  );
};
