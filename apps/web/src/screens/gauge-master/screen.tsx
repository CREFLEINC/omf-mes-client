import { AlertBanner, Breadcrumb, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { toApiError } from '../../patterns/request';
import { useState } from 'react';

import { CODE_GROUPS, defaultGaugeFilters, selectableOptions, toCodeLabels } from './code-options';
import { GaugeListPane } from './gauge-list-pane';
import { LoadErrorBanner } from './load-error-banner';
import { isTruncated, useCodeValues, useGaugeList, usePlantLookup } from './queries';
import { todayIso } from './today';
import type { GaugeFilters } from './types';

const t = messages.gaugeMaster;

const NO_ITEMS: never[] = [];

export interface GaugeMasterScreenProps {
  /**
   * 오늘. **인자로 받는다** — 화면이 시각을 직접 읽으면 검교정 판정이 실행 시각에 흔들려
   * 시험이 날짜마다 다른 답을 낸다. 화면을 여는 자리에서는 기본값이 곧 오늘이다.
   */
  today?: string;
}

/**
 * W-05-11 계측기 마스터 관리.
 *
 * ⭐ **계측기 전용 경로가 없다** — 설비 목록을 `equipmentTypeCode` 로 거른다(스펙 §3-2).
 * ⭐ **「만료」는 저장된 값이 아니다** — 차기 예정일과 오늘을 견줘 화면이 판정한다(§5-2).
 */
export const GaugeMasterScreen = ({ today = todayIso() }: GaugeMasterScreenProps = {}) => {
  const [filters, setFilters] = useState<GaugeFilters>(defaultGaugeFilters);

  const gauges = useGaugeList(filters);
  const plants = usePlantLookup();
  const statusValues = useCodeValues(CODE_GROUPS.equipmentStatus);

  const items = gauges.data?.items ?? NO_ITEMS;
  const listTruncated = gauges.data !== undefined && isTruncated(gauges.data.page, items.length);

  /*
   * ⚠ 계측기 유형 값 목록이 아직 없다(설계 질의 `omf-mes#195`). 자리표시 값으로 거르면
   * 목록이 늘 비므로 조건을 걸지 않고, **그 사실을 화면이 밝힌다**(G-2).
   */
  const canFilterByType = false;

  const plantOptions = selectableOptions(plants.plants, filters.plantId);

  /*
   * 둘은 함께 서지 않는다 — 조회가 실패하면 받아 온 목록 자체가 없어 잘림 판정이 거짓이다.
   * 그래서 여기 순서는 우열이 아니라 서술 순서일 뿐이다(뮤테이션 M19 — 순서를 바꿔도 같은 화면).
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
            {t.listTruncated(items.length, gauges.data?.page.total ?? items.length)}
          </AlertBanner>
        </div>
      )}

      <GaugeListPane
        items={items}
        isLoading={gauges.isLoading}
        appliedFilters={filters}
        onApplyFilters={setFilters}
        plantOptions={plantOptions}
        plantEntries={plants.plants}
        statusOptions={toCodeLabels(statusValues.data ?? NO_ITEMS)}
        today={today}
        canFilterByType={canFilterByType}
        isTruncated={listTruncated}
        loadError={
          gauges.isError ? (
            <LoadErrorBanner
              error={toApiError(gauges.error)}
              onRetry={() => void gauges.refetch()}
            />
          ) : null
        }
      />
    </div>
  );
};
