import { Breadcrumb, Button, EmptyState, PageHeader, SkeletonText } from '@crefle/web-ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useSession } from '../../patterns/session';
import { toWebAccess } from '../../patterns/web-access';
import { ForbiddenNotice } from './forbidden-notice';
import { AutoPlanResult, type AutoPlanResultFilter } from './auto-plan-result';
import { useWorklistBulk } from './bulk-actions';
import { worklistPath } from './worklist-filters';

export const AUTO_PLAN_RESULT_PATH = '/production/production-orders/auto-plan-results';
export const AutoPlanResultPage = ({
  permissionMenuPath = null,
}: {
  permissionMenuPath?: string | null;
}) => {
  const bulk = useWorklistBulk();
  const navigate = useNavigate();
  const { session } = useSession();
  const [filter, setFilter] = useState<AutoPlanResultFilter>(null);
  const back = () => void navigate(worklistPath());
  const allowed = toWebAccess(session?.permissions).allows('/production/production-orders');
  return (
    <div className="erp-wo-result-page">
      <PageHeader
        title="생산계획 자동 전개 결과"
        breadcrumb={
          <Breadcrumb
            aria-label="탐색 경로"
            items={[
              { label: '작업계획', href: worklistPath() },
              { label: '생산계획 자동 전개 결과' },
            ]}
          />
        }
      />
      {!allowed ? (
        <ForbiddenNotice menuPath={permissionMenuPath} />
      ) : bulk.isRunning ? (
        <div role="status">
          <SkeletonText lines={3} />
          <p>생산계획 자동 전개 처리 중</p>
        </div>
      ) : bulk.run?.kind === 'autoPlan' ? (
        <AutoPlanResult
          outcomes={bulk.run.outcomes}
          filter={filter}
          onFilterChange={setFilter}
          onClose={back}
          standalone
        />
      ) : (
        <EmptyState
          title="조회할 실행 결과가 없습니다"
          description="작업계획 목록에서 생산계획 자동 전개를 실행하세요."
          action={<Button onClick={back}>작업계획 목록으로</Button>}
        />
      )}
    </div>
  );
};
