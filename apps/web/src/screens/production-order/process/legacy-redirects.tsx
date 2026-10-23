import { SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Navigate, useSearchParams } from 'react-router';

import { useProductionPlanDetail } from '../../production-plan/queries';
import { useProductionOrderDetail } from '../queries';
import { processPath } from '../worklist-filters';

/**
 * 옛 주소(W-02-02, W-02-03, W-02-04)를 ERP W/O 처리로 넘긴다.
 * W-02-02와 W-02-03은 메뉴 없이 내부 번호로만 들어가던 화면이라 처리 화면의 단계로 합쳤다(T-W-C 「나뉜 화면 합치기」).
 * W-02-04의 배포는 작업함의 일괄 배포(자동 계획 완료)와 처리 화면 마지막 단계가 맡는다(C-17).
 */
const WORKLIST = '/production/production-orders';

const readId = (value: string | null): number | null =>
  value !== null && /^[1-9]\d*$/.test(value) ? Number(value) : null;

const Loading = () => (
  <div role="status" aria-label={messages.erpWorkOrderFlow.process.loading}>
    <SkeletonText lines={3} />
  </div>
);

const ToOrder = ({ productionOrderId }: { productionOrderId: number | null }) => {
  const order = useProductionOrderDetail(productionOrderId);
  if (productionOrderId === null || order.isError) return <Navigate to={WORKLIST} replace />;
  if (order.data === undefined) return <Loading />;
  return <Navigate to={processPath(order.data.productionOrderNo)} replace />;
};

export const LegacyPlanRedirect = () => {
  const [params] = useSearchParams();
  return <ToOrder productionOrderId={readId(params.get('productionOrderId'))} />;
};

export const LegacyAssignmentRedirect = () => {
  const [params] = useSearchParams();
  const planId = readId(params.get('productionPlanId'));
  const plan = useProductionPlanDetail(planId);
  if (planId === null || plan.isError) return <Navigate to={WORKLIST} replace />;
  if (plan.data === undefined) return <Loading />;
  return <ToOrder productionOrderId={plan.data.productionOrderId} />;
};

export const LegacyReleaseRedirect = () => <Navigate to={`${WORKLIST}?autoPlan=DONE`} replace />;
