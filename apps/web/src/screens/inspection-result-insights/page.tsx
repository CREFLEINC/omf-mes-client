import { AlertBanner, Breadcrumb, Button, PageHeader, SkeletonText } from '@crefle/web-ui';
import { useNavigate, useSearchParams } from 'react-router';

import type { LookupEntry } from '../../patterns/lookup-display';
import type { InspectionFilterOption } from './filter-bar';
import {
  useInspectionItemLookup,
  useInspectionProcessLookup,
  useInspectionTypeLookup,
  useOverallJudgmentLookup,
  type InspectionLookup,
} from './lookups';
import { InspectionResultInsightsScreen } from './screen';

const displayLabel = (entry: LookupEntry): string =>
  entry.isActive ? entry.label : `${entry.label} (미사용)`;
const toOptions = (lookup: InspectionLookup): InspectionFilterOption[] =>
  lookup.entries.map((entry) => ({ value: entry.value, label: displayLabel(entry) }));
const toLabelMap = (lookup: InspectionLookup): Map<string, string> =>
  new Map(lookup.entries.map((entry) => [entry.value, displayLabel(entry)]));

export const InspectionResultInsightsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inspectionTypes = useInspectionTypeLookup();
  const judgments = useOverallJudgmentLookup();
  const items = useInspectionItemLookup();
  const processes = useInspectionProcessLookup();
  const lookups = [inspectionTypes, judgments, items, processes];
  const failed = lookups.filter((lookup) => lookup.isError);
  const isLoading = lookups.some((lookup) => lookup.isLoading);
  const isTruncated = lookups.some((lookup) => lookup.truncated);
  const itemLabels = new Map(
    [...toLabelMap(items)].map(([value, label]) => [Number(value), label] as const),
  );

  return (
    <div className="screen">
      <PageHeader
        title="검사실적·검사결과 조회"
        breadcrumb={
          <Breadcrumb items={[{ label: '품질관리' }, { label: '검사실적·검사결과 조회' }]} />
        }
      />
      {isLoading && (
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
      {isTruncated && (
        <AlertBanner variant="warning">조회 조건 목록 일부만 표시됩니다.</AlertBanner>
      )}
      <InspectionResultInsightsScreen
        options={{
          inspectionType: toOptions(inspectionTypes),
          item: toOptions(items),
          process: toOptions(processes),
          judgment: toOptions(judgments),
        }}
        labels={{ item: itemLabels, judgment: toLabelMap(judgments) }}
        sourceAxisCode={searchParams.get('type') ?? ''}
        onViewMeasurements={(inspectionResultId) =>
          navigate(`/quality/inspection-results/${String(inspectionResultId)}/measurements`)
        }
      />
    </div>
  );
};
