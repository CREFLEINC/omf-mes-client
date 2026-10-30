import { EmptyState, Icon, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { UseQueryResult } from '@tanstack/react-query';

import {
  InspectionDrawingImages,
  type InspectionDrawing,
} from '../../patterns/inspection-drawings';
import { LoadErrorBanner } from './load-error-banner';

const t = messages.inspectionStandard.versionSection;

/**
 * 버전 상세 「도면」 탭(omf-all-around#208) — 고른 버전의 기준서 도면. 도면은 기준서(TCKT) 엑셀 올리기로만 붙는다.
 * 조회는 화면이 쥔다(탭 이름의 건수와 같은 조회).
 */
export const VersionDrawings = ({
  drawings,
}: {
  drawings: UseQueryResult<InspectionDrawing[]>;
}) => {
  if (drawings.isError) {
    return <LoadErrorBanner error={drawings.error} onRetry={() => void drawings.refetch()} />;
  }
  if (drawings.data === undefined) {
    return (
      <div role="status" aria-label={t.drawingsLoading}>
        <SkeletonText lines={3} />
      </div>
    );
  }
  if (drawings.data.length === 0) {
    return (
      <EmptyState
        size="sm"
        icon={<Icon name="image" size={32} />}
        title={t.drawingsNone}
        description={t.drawingsNoneHint}
      />
    );
  }
  return (
    <InspectionDrawingImages
      drawings={drawings.data}
      altOf={t.drawingAlt}
      labels={{ prev: t.drawingPrev, next: t.drawingNext }}
    />
  );
};
