import { AlertBanner, Breadcrumb, Button, PageHeader, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useNavigate } from 'react-router';

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
  const inspectionType = useInspectionTypeLookup();
  const judgment = useOverallJudgmentLookup();
  const item = useInspectionItemLookup();
  const process = useInspectionProcessLookup();
  const lookups = { inspectionType, item, process, judgment };
  const all = [inspectionType, judgment, item, process];
  const failed = all.filter((lookup) => lookup.isError);

  return (
    <div className="screen inspection-results-screen">
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />
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
