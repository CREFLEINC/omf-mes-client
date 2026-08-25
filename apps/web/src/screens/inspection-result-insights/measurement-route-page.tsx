import {
  AlertBanner,
  Breadcrumb,
  Button,
  EmptyState,
  PageHeader,
  SkeletonText,
} from '@crefle/web-ui';
import { Link, useParams, useSearchParams } from 'react-router';

import { readInspectionResultPage, type CalibrationFilter } from './filters';
import { useOverallJudgmentLookup } from './lookups';
import { MeasurementPage } from './measurement-page';

const TITLE = '검사 측정치 전체 보기';

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
        <Breadcrumb
          items={[{ label: '품질관리' }, { label: '검사실적·검사결과 조회' }, { label: TITLE }]}
        />
      }
    />
    <div className="form-actions">
      <Link to="/quality/inspection-results">검사실적 목록으로 돌아가기</Link>
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
        <div role="status" aria-label="판정 이름을 준비하는 중">
          <SkeletonText lines={1} />
        </div>
      )}
      {judgment.isError && (
        <AlertBanner
          variant="error"
          title="판정 이름을 불러오지 못했습니다."
          action={
            <Button size="sm" variant="outlined" onClick={judgment.refetch}>
              판정 이름 다시 시도
            </Button>
          }
        />
      )}
      {judgment.truncated && (
        <AlertBanner variant="warning">판정 이름 목록 일부만 확인되었습니다.</AlertBanner>
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
          title="검사 결과 번호가 유효하지 않습니다"
          description="검사실적 목록에서 결과를 다시 선택해 주세요."
        />
      </div>
    );
  }

  return <MeasurementRouteContent inspectionResultId={inspectionResultId} />;
};
