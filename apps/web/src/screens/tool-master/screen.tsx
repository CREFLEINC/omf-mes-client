import { AlertBanner, Breadcrumb, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { toApiError } from '../../patterns/request';
import { CODE_GROUPS, defaultToolFilters, selectableOptions, toCodeLabels } from './code-options';
import { LoadErrorBanner } from './load-error-banner';
import { ToolListPane } from './tool-list-pane';
import { isTruncated, useCodeValues, usePlantLookup, useToolList } from './queries';
import type { ToolFilters } from './types';

const t = messages.toolMaster;

const NO_ITEMS: never[] = [];

/**
 * W-05-13 툴/금형/지그 마스터 관리.
 *
 * ⭐ **테이블 이름은 금형이지만 담는 것은 모든 도구다** — `toolTypeCode` 가 가른다(스펙 §3).
 * ⭐ **예방보전 도래도 사용 가능 타수도 서버가 셈한다** — 축이 둘이고 타발수는 화면이 가진
 * 값이 아니다. 화면이 다시 세면 서버와 다른 답을 낸다.
 * ⛔ **누계 타발수는 이 화면이 고치지 않는다** — 더하는 것은 툴 사용실적 입력이고 되돌리는
 * 것은 툴 예방보전 실적 등록이다(공유계약 B-13).
 */
export const ToolMasterScreen = () => {
  const [filters, setFilters] = useState<ToolFilters>(defaultToolFilters);

  const tools = useToolList(filters);
  const plants = usePlantLookup();
  const statusValues = useCodeValues(CODE_GROUPS.assetStatus);

  const items = tools.data?.items ?? NO_ITEMS;
  const listTruncated = tools.data !== undefined && isTruncated(tools.data.page, items.length);
  const statusOptions = toCodeLabels(statusValues.data ?? NO_ITEMS);

  /*
   * 조회 실패와 잘림은 함께 서지 않는다 — 실패하면 받아 온 목록 자체가 없다.
   * 그래서 여기 순서는 우열이 아니라 서술 순서일 뿐이다.
   */
  const optionsNote = plants.isError
    ? t.optionsLoadFailed
    : plants.truncated
      ? t.optionsTruncated
      : undefined;

  return (
    <div className="screen">
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {optionsNote !== undefined && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{optionsNote}</AlertBanner>
        </div>
      )}

      {listTruncated && (
        <div className="banner-slot">
          <AlertBanner variant="warning">
            {t.listTruncated(items.length, tools.data?.page.total ?? items.length)}
          </AlertBanner>
        </div>
      )}

      <ToolListPane
        items={items}
        isLoading={tools.isLoading}
        appliedFilters={filters}
        onApplyFilters={setFilters}
        plantOptions={selectableOptions(plants.plants, filters.plantId)}
        plantEntries={plants.plants}
        statusOptions={statusOptions}
        loadError={
          tools.isError ? (
            <LoadErrorBanner error={toApiError(tools.error)} onRetry={() => void tools.refetch()} />
          ) : null
        }
      />
    </div>
  );
};
