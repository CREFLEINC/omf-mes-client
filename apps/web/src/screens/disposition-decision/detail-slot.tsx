import { EmptyState, Icon, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { DetailPane } from './detail-pane';
import { LoadErrorBanner } from './load-error';
import type { DispositionLookup } from './lookups';
import type { NonconformanceDetailView } from './types';

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
  items: DispositionLookup;
  severity: DispositionLookup;
  uoms: DispositionLookup;
  onRetry: () => void;
  /** 고르기 전 안내 — 탭마다 다르다(#223). 비면 처분 대기 문구. */
  emptyTitle?: string;
  /** 대상 LOT 의 지금 상태(#223). */
  lotStatuses?: Record<number, string>;
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
 * | 정상 | 상세 | |
 *
 * 없음과 그 밖의 실패를 뭉개면 **없는 부적합을 계속 다시 부르게** 된다.
 */
export const DetailSlot = ({
  selectedId,
  detail,
  items,
  severity,
  uoms,
  onRetry,
  emptyTitle,
  lotStatuses,
}: DetailSlotProps): ReactNode => {
  const t = messages.dispositionDecision;

  /* 고르기 전 — 아이콘 + 한 줄 안내만(사용자 시안 · #223). 판정 입력은 고른 뒤에만 선다. */
  if (selectedId === null)
    return (
      <EmptyState
        size="sm"
        icon={<Icon name="ads_click" size={32} />}
        title={emptyTitle ?? t.detail.select}
      />
    );

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

  /* 판정 이력은 판정 입력 아래 접는 구역으로 옮겼다(사용자 시안 · #223). */
  return (
    <DetailPane
      view={detail.view}
      items={items}
      uoms={uoms}
      severity={severity}
      lotStatuses={lotStatuses}
    />
  );
};
