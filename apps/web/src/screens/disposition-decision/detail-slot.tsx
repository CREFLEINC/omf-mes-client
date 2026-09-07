import { EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { DecisionHistory } from './decision-history';
import { DetailPane } from './detail-pane';
import { LoadErrorBanner } from './load-error';
import type { DispositionLookup } from './lookups';
import type { RemainingQty } from './remaining-qty';
import type { DecisionRow, NonconformanceDetailView } from './types';

export interface DetailSlotProps {
  /** 고른 부적합이 없으면 `null`. */
  selectedId: number | null;
  detail: {
    isPending: boolean;
    isError: boolean;
    /** 404다. 「없는 부적합」과 「불러오지 못함」은 사용자가 할 일이 다르다. */
    isNotFound: boolean;
    error: unknown;
    view: NonconformanceDetailView | null;
  };
  decisions: {
    rows: DecisionRow[];
    isLoading: boolean;
    isError: boolean;
  };
  remaining: RemainingQty;
  items: DispositionLookup;
  severity: DispositionLookup;
  status: DispositionLookup;
  uoms: DispositionLookup;
  onRetry: () => void;
}

/**
 * ② 칸의 상태 갈래를 한 곳에 모은다 — **다섯이고 서로 다른 것을 말한다.**
 *
 * | 상태 | 보이는 것 | 왜 갈라야 하나 |
 * | --- | --- | --- |
 * | 고르지 않음 | 「부적합을 선택하세요」 | 할 일을 알린다 |
 * | 불러오는 중 | 뼈대 | 빈 칸과 구분된다 |
 * | 없음(404) | 「찾을 수 없습니다」 + 다시 조회 안내 | **다시 시도로 풀리지 않는다** |
 * | 그 밖의 실패 | 오류 배너 + 다시 시도 | 눌러서 풀린다 |
 * | 정상 | 상세 + 판정 이력 | |
 *
 * 없음과 그 밖의 실패를 뭉개면 **없는 부적합을 계속 다시 부르게** 된다.
 */
export const DetailSlot = ({
  selectedId,
  detail,
  decisions,
  remaining,
  items,
  severity,
  status,
  uoms,
  onRetry,
}: DetailSlotProps): ReactNode => {
  const t = messages.dispositionDecision;

  if (selectedId === null) return <EmptyState size="sm" title={t.detail.select} />;

  if (detail.isPending) {
    return (
      <div role="status" aria-label={t.detail.loading}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  if (detail.isNotFound) {
    return (
      <EmptyState
        size="sm"
        live
        title={t.detail.notFound}
        description={t.detail.notFoundDescription}
      />
    );
  }

  if (detail.isError) {
    return <LoadErrorBanner error={detail.error} isDetail onRetry={onRetry} />;
  }

  if (detail.view === null) return null;

  return (
    <>
      <DetailPane
        view={detail.view}
        items={items}
        uoms={uoms}
        severity={severity}
        status={status}
      />
      <DecisionHistory
        rows={decisions.rows}
        remaining={remaining}
        uoms={uoms}
        isLoading={decisions.isLoading}
        isError={decisions.isError}
      />
    </>
  );
};
