import { AlertBanner, Breadcrumb, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { toApiError } from '../../patterns/request';
import { LoadErrorBanner } from './load-error-banner';
import { defaultPolicyFilters } from './options';
import {
  useBusinessUnitLookup,
  useItemLookup,
  usePlantLookup,
  useProcessLookup,
  useRatioPolicies,
} from './queries';
import { RatioListPane } from './ratio-list-pane';
import type { ScopeLookups } from './scope';
import type { OperationPolicy, PolicyFilters } from './types';

const t = messages.shotConversion;

const NO_POLICIES: OperationPolicy[] = [];

/**
 * 오늘. **화면 경계에서 한 번만 읽는다** — 안쪽은 전부 받은 값을 쓴다.
 *
 * ⚠ 실행 환경의 시간대로 읽는다. 「끝났는가」는 사람이 달력을 보고 판단하는 것과 같아야 하고,
 * 그 사람은 자기 자리의 달력을 본다.
 */
const todayText = (): string => {
  const now = new Date();
  const pad = (value: number): string => String(value).padStart(2, '0');

  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/**
 * W-05-01 타발수 환산 파라미터 설정.
 *
 * ⭐ **타발수 = 생산 수량 × 비율.** 이 화면이 그 비율과 「환산을 쓸지」를 정한다.
 *
 * ⛔ **툴별 차이는 여기 없다** — 캐비티 수가 이미 담고 그것은 툴 마스터의 것이다.
 * 두 화면이 한 계산의 입력을 나눠 갖고, 나누는 선이 「툴 고유 ↔ 품목·공정 정책」이다.
 *
 * ⛔ **정책 코드를 사용자에게 묻지 않는다** — 이 화면이 쓰는 코드는 둘로 고정이며 화면이
 * 붙인다. 기계가 정할 수 있는 것을 사람에게 묻지 않는다.
 */
export const ShotConversionScreen = () => {
  const [filters, setFilters] = useState<PolicyFilters>(defaultPolicyFilters);

  const ratios = useRatioPolicies(filters);
  const items = useItemLookup();
  const processes = useProcessLookup();
  const plants = usePlantLookup();
  const businessUnits = useBusinessUnitLookup();

  const rows = ratios.data?.items ?? NO_POLICIES;

  const lookups: ScopeLookups = {
    itemId: items.entries,
    processId: processes.entries,
    plantId: plants.entries,
    businessUnitId: businessUnits.entries,
  };

  const lookupResults = [items, processes, plants, businessUnits];

  /** 선택 목록의 한계. **실패가 잘림보다 앞선다** — 아무것도 못 받은 것이 더 큰 사실이다. */
  const optionsNote = lookupResults.some((result) => result.isError)
    ? t.optionsLoadFailed
    : lookupResults.some((result) => result.truncated)
      ? t.optionsTruncated
      : null;

  const loadError = ratios.isError ? (
    <LoadErrorBanner error={toApiError(ratios.error)} onRetry={() => void ratios.refetch()} />
  ) : null;

  return (
    <div className="screen">
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {/* 고를 목록이 반쪽이면 범위가 없는 것처럼 보인다 — 감추지 않고 밝힌다. */}
      {optionsNote !== null && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{optionsNote}</AlertBanner>
        </div>
      )}

      <RatioListPane
        items={rows}
        isLoading={ratios.isPending}
        /*
         * ⛔ **여기서 잘림을 판정하지 않는다** — 표가 그 일을 이미 한다(`total > items.length`).
         * 두 곳에서 판정하면 한쪽을 고쳐도 다른 쪽이 덮어 주어 고장이 드러나지 않는다.
         */
        total={ratios.data?.page.total ?? null}
        appliedFilters={filters}
        onApplyFilters={setFilters}
        lookups={lookups}
        today={todayText()}
        loadError={loadError}
      />
    </div>
  );
};
