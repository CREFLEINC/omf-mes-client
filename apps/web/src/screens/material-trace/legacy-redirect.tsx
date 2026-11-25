import { Navigate, useSearchParams } from 'react-router';

import { legacyTraceHref } from '../../patterns/trace-tree/href';

/**
 * 옛 주소 `/production/lot-trace`(W-02-09 LOT 생산 이력 조회) → 자재 기준 생산 추적(W-02-13) · 제품 기준 역추적(W-02-14)
 * (피처 015 FR-018 · R-10). 북마크 · 다른 화면의 옛 링크가 오면 LOT 종류에 맞는 새 화면으로 `replace` 넘기고, 그 LOT 을
 * 목록에 넣어 고른 채 연다. LOT 이 정해지지 않은 주소는 자재 기준 최근 목록이다.
 */
export const LotTraceLegacyRedirect = () => {
  const [searchParams] = useSearchParams();
  return <Navigate to={legacyTraceHref(searchParams)} replace />;
};
