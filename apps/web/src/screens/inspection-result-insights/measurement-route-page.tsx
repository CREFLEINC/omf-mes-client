import {
  AlertBanner,
  Breadcrumb,
  Button,
  EmptyState,
  PageHeader,
  SkeletonText,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Link, useParams, useSearchParams } from 'react-router';

import { readInspectionResultPage, type CalibrationFilter } from './filters';
import { useOverallJudgmentLookup } from './lookups';
import { MeasurementPage } from './measurement-page';

const t = messages.inspectionResultInsights;
const TITLE = t.measurementRoute.title;

const readInspectionResultId = (raw: string | undefined): number | null => {
  if (raw === undefined || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 ? value : null;
};

const readCalibration = (params: URLSearchParams): CalibrationFilter => {
  const raw = params.get('calibration');
  return raw === 'only' || raw === 'exclude' ? raw : '';
};

const Header = () => (
  <>
    <PageHeader
      title={TITLE}
      breadcrumb={
        <Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }, { label: TITLE }]} />
      }
    />
    <div className="form-actions">
      <Link to="/quality/inspection-results">{t.measurementRoute.backToList}</Link>
    </div>
  </>
);

const MeasurementRouteContent = ({ inspectionResultId }: { inspectionResultId: number }) => {
  const [params, setParams] = useSearchParams();
  const judgment = useOverallJudgmentLookup();
  const page = readInspectionResultPage(params);
  const calibration = readCalibration(params);
  const update = (nextPage: number, nextCalibration: CalibrationFilter): void => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (nextPage <= 1) next.delete('page');
      else next.set('page', String(nextPage));
      if (nextCalibration === '') next.delete('calibration');
      else next.set('calibration', nextCalibration);
      return next;
    });
  };

  return (
    <div className="screen">
      <Header />
      {judgment.isLoading && (
        <div role="status" aria-label={t.measurementRoute.judgmentPreparing}>
          <SkeletonText lines={1} />
        </div>
      )}
      {judgment.isError && (
        <AlertBanner
          variant="error"
          title={t.measurementRoute.judgmentFailed}
          action={
            <Button size="sm" variant="outlined" onClick={judgment.refetch}>
              {t.measurementRoute.judgmentRetry}
            </Button>
          }
        />
      )}
      {judgment.truncated && (
        <AlertBanner variant="warning">{t.measurementRoute.judgmentTruncated}</AlertBanner>
      )}
      <MeasurementPage
        inspectionResultId={inspectionResultId}
        page={page}
        calibrationExpired={calibration}
        judgmentSource={judgment}
        onPageChange={(nextPage) => update(nextPage, calibration)}
        onCalibrationChange={(nextCalibration) => update(1, nextCalibration)}
      />
    </div>
  );
};

export const InspectionMeasurementRoutePage = () => {
  const inspectionResultId = readInspectionResultId(useParams().inspectionResultId);

  if (inspectionResultId === null) {
    return (
      <div className="screen">
        <Header />
        <EmptyState
          title={t.measurementRoute.invalidId}
          description={t.measurementRoute.invalidIdDescription}
        />
      </div>
    );
  }

  return <MeasurementRouteContent inspectionResultId={inspectionResultId} />;
};
