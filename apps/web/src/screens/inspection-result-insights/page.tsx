import { AlertBanner, Breadcrumb, Button, PageHeader, SkeletonText } from '@crefle/web-ui';
import { useNavigate } from 'react-router';

import {
  useInspectionItemLookup,
  useInspectionProcessLookup,
  useInspectionTypeLookup,
  useOverallJudgmentLookup,
} from './lookups';
import { InspectionResultInsightsScreen } from './screen';

export const InspectionResultInsightsPage = () => {
  const navigate = useNavigate();
  const inspectionType = useInspectionTypeLookup();
  const judgment = useOverallJudgmentLookup();
  const item = useInspectionItemLookup();
  const process = useInspectionProcessLookup();
  const lookups = { inspectionType, item, process, judgment };
  const all = [inspectionType, judgment, item, process];
  const failed = all.filter((lookup) => lookup.isError);

  return (
    <div className="screen">
      <PageHeader
        title="검사실적·검사결과 조회"
        breadcrumb={
          <Breadcrumb items={[{ label: '품질관리' }, { label: '검사실적·검사결과 조회' }]} />
        }
      />
      {all.some((lookup) => lookup.isLoading) && (
        <div role="status" aria-label="검사 조회 조건을 준비하는 중">
          <SkeletonText lines={1} />
        </div>
      )}
      {failed.length > 0 && (
        <AlertBanner
          variant="error"
          title="일부 조회 조건 이름을 불러오지 못했습니다."
          action={
            <Button
              size="sm"
              variant="outlined"
              onClick={() => failed.forEach((lookup) => lookup.refetch())}
            >
              실패한 조건 다시 시도
            </Button>
          }
        >
          내부 번호나 코드를 대신 표시하지 않습니다.
        </AlertBanner>
      )}
      {all.some((lookup) => lookup.truncated) && (
        <AlertBanner variant="warning">조회 조건 목록 일부만 표시됩니다.</AlertBanner>
      )}
      <InspectionResultInsightsScreen
        lookups={lookups}
        onViewMeasurements={(inspectionResultId) =>
          navigate(`/quality/inspection-results/${String(inspectionResultId)}/measurements`)
        }
      />
    </div>
  );
};
