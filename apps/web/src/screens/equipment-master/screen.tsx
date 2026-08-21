import { AlertBanner, Breadcrumb, EmptyState, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { toApiError } from '../../patterns/request';
import { selectableOptions } from './code-options';
import { GroupListPane } from './group-list-pane';
import { buildGroupRows } from './group-tree';
import { LoadErrorBanner } from './load-error-banner';
import { isTruncated, useGroupList, useLookupOptions } from './queries';
import type { GroupFilters } from './types';

const t = messages.equipmentMaster;

const NO_EXPANDED_IDS: ReadonlySet<number> = new Set();

/**
 * W-05-12 컨테이너. 설비 그룹 계층을 서버 응답으로 그리고 조회 조건과 선택을 URL에 둔다.
 *
 * ⭐ **화면은 「설비 그룹」이라고 부른다.** 계약이 설비 응답에서 소속 그룹을 `productionLineId`
 * 로 부르지만 그것은 저장처의 이름이다 — 같은 값이며, 이름이 갈리는 자리는 `mappers.ts` 하나다.
 */
export const EquipmentMasterScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<GroupFilters>(
    () => ({
      q: searchParams.get('q') ?? '',
      plantId: searchParams.get('plant') ?? '',
      includeInactive: searchParams.get('inactive') === '1',
    }),
    [searchParams],
  );

  const selectedGroupId = Number(searchParams.get('grp') ?? '') || null;

  const groupList = useGroupList(filters);
  const groupItems = useMemo(() => groupList.data?.items ?? [], [groupList.data]);
  const lookups = useLookupOptions();

  /**
   * 기본 펼침 대상 — 하위를 가진 모든 노드.
   * 접힌 상태를 기본으로 두면 조회 결과에 있는 하위 그룹이 표에 나오지 않아
   * 사용자가 「없다」는 잘못된 답을 얻는다.
   */
  const expandableIds = useMemo(() => {
    const known = new Set(groupItems.map((item) => item.equipmentGroupId));
    const parents = new Set<number>();

    for (const item of groupItems) {
      const parentId = item.parentGroupId;
      // 자기참조는 부모로 세지 않는다 — buildGroupRows가 그것을 최상위로 올린다.
      if (
        parentId !== null &&
        parentId !== undefined &&
        parentId !== item.equipmentGroupId &&
        known.has(parentId)
      ) {
        parents.add(parentId);
      }
    }

    return parents;
  }, [groupItems]);

  /**
   * 펼침 상태는 「어느 조회 결과에 대한 것인가」와 함께 들고 있는다.
   * 조회 조건이 바뀌면 다시 계산하고, 같은 조건으로 다시 조회할 때는 사용자의 접기를 지킨다.
   */
  const [expansion, setExpansion] = useState<{
    key: string;
    ids: ReadonlySet<number>;
  } | null>(null);

  const expansionKey = JSON.stringify(filters);

  if (groupList.data !== undefined && expansion?.key !== expansionKey) {
    setExpansion({ key: expansionKey, ids: expandableIds });
  }

  const expandedIds = expansion?.ids ?? NO_EXPANDED_IDS;

  const groupRows = useMemo(
    () => buildGroupRows(groupItems, expandedIds),
    [groupItems, expandedIds],
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
  const handleApplyFilters = (next: GroupFilters) => {
    updateParams({
      q: next.q === '' ? null : next.q,
      plant: next.plantId === '' ? null : next.plantId,
      inactive: next.includeInactive ? '1' : null,
    });
  };

  const handleToggleExpand = (equipmentGroupId: number) => {
    setExpansion((prev) => {
      if (prev === null) return prev;

      const next = new Set(prev.ids);
      if (next.has(equipmentGroupId)) {
        next.delete(equipmentGroupId);
      } else {
        next.add(equipmentGroupId);
      }
      return { ...prev, ids: next };
    });
  };

  /**
   * 선택 목록이 잘리거나 실패했다는 사실을 낸다.
   * 알리지 않으면 선택칸이 이유 없이 비어 보이고 사용자는 값이 사라진 줄 안다.
   */
  const lookupNotice = (() => {
    if (lookups.isError) {
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.optionsLoadFailed}</AlertBanner>
        </div>
      );
    }

    if (lookups.truncated) {
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.optionsTruncated}</AlertBanner>
        </div>
      );
    }

    return null;
  })();

  const listPage = groupList.data?.page;
  const listTruncated = listPage !== undefined && isTruncated(listPage, groupItems.length);

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {lookupNotice}

      {/*
       * 목록이 잘렸다는 사실을 감추지 않는다. 페이지 이동 컨트롤은 아직 없으므로
       * 조건을 좁히는 것이 사용자가 할 수 있는 조치다.
       */}
      {listTruncated && listPage !== undefined && (
        <AlertBanner variant="warning">
          {t.listTruncated(groupItems.length, listPage.total)}
        </AlertBanner>
      )}

      <div className="two-pane">
        <GroupListPane
          rows={groupRows}
          isLoading={groupList.isPending}
          appliedFilters={filters}
          onApplyFilters={handleApplyFilters}
          plantOptions={selectableOptions(lookups.entries.plants, filters.plantId)}
          plantEntries={lookups.entries.plants}
          expandedIds={expandedIds}
          onToggleExpand={handleToggleExpand}
          selectedGroupId={selectedGroupId}
          onSelect={(equipmentGroupId) => updateParams({ grp: String(equipmentGroupId) })}
          loadError={
            groupList.isError ? (
              <LoadErrorBanner
                error={toApiError(groupList.error)}
                onRetry={() => void groupList.refetch()}
              />
            ) : null
          }
        />
        <div className="pane">
          <EmptyState size="sm" title={t.empty.groupNotSelected} />
        </div>
      </div>
    </>
  );
};
