import { AlertBanner, Breadcrumb, Button, PageHeader, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useNavigate } from 'react-router';

import { usePageHub } from '../../patterns/page-hub';
import {
  useInspectionItemLookup,
  useInspectionProcessLookup,
  useInspectionTypeLookup,
  useOverallJudgmentLookup,
} from './lookups';
import { InspectionResultInsightsScreen } from './screen';

const t = messages.inspectionResultInsights;

export const InspectionResultInsightsPage = () => {
  const navigate = useNavigate();
  const hub = usePageHub();
  const inspectionType = useInspectionTypeLookup();
  const judgment = useOverallJudgmentLookup();
  const item = useInspectionItemLookup();
  const process = useInspectionProcessLookup();
  const lookups = { inspectionType, item, process, judgment };
  const all = [inspectionType, judgment, item, process];
  const failed = all.filter((lookup) => lookup.isError);

  return (
    <div className="screen inspection-results-screen">
      {/* 탭 묶음 안이면 탭 막대가 화면 이름을 말한다 — 경로·제목을 세우지 않는다(omf-all-around#210). */}
      {hub === null && (
        <PageHeader
          title={t.title}
          breadcrumb={
            <Breadcrumb
              items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
              aria-label={messages.common.shell.breadcrumb}
            />
          }
        />
      )}
      {all.some((lookup) => lookup.isLoading) && (
        <div role="status" aria-label={t.page.preparing}>
          <SkeletonText lines={1} />
        </div>
      )}
      {failed.length > 0 && (
        <div className="banner-slot">
          <AlertBanner
            variant="error"
            title={t.page.lookupFailed}
            action={
              <Button
                size="sm"
                variant="outlined"
                onClick={() => failed.forEach((lookup) => lookup.refetch())}
              >
                {t.page.lookupRetry}
              </Button>
            }
          >
            {t.page.lookupFailedDetail}
          </AlertBanner>
        </div>
      )}
      {all.some((lookup) => lookup.truncated) && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.page.lookupTruncated}</AlertBanner>
        </div>
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
