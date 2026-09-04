import {
  AlertBanner,
  Button,
  type Column,
  EmptyState,
  Select,
  SkeletonText,
  Table,
  Tabs,
  type TabItem,
} from '@crefle/web-ui';
import { useState } from 'react';

import type { InspectionInsightFilters } from './filters';
import { useDefectDistribution, type DefectDistribution } from './queries';
import type { DistributionGroup } from './request-queries';
import { TrendPanels } from './trend-panels';

type Node = DefectDistribution['nodes'][number];
type View = 'trend' | 'distribution';
const EMPTY = '—';
const dateTime = (value: string): string => {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match === null ? value : `${match[1]} ${match[2]}`;
};
const GROUP_OPTIONS = [
  { value: 'defectCode', label: '불량코드' },
  { value: 'occurrenceProcess', label: '발생 공정' },
  { value: 'detectionProcess', label: '검출 공정' },
];

interface InsightTabsProps {
  filters: InspectionInsightFilters;
  sourceAxisCode: string;
  queriesEnabled?: boolean;
}

export const InsightTabs = ({
  filters,
  sourceAxisCode,
  queriesEnabled = true,
}: InsightTabsProps) => {
  const [view, setView] = useState<View>('trend');
  const [group, setGroup] = useState<DistributionGroup>('defectCode');
  const distribution = useDefectDistribution(
    filters,
    group,
    sourceAxisCode,
    queriesEnabled && view === 'distribution',
  );
  const retry = (refetch: () => Promise<unknown>) => (
    <Button size="sm" variant="outlined" onClick={() => void refetch()}>
      다시 시도
    </Button>
  );
  const parentLabels = new Map(
    distribution.data?.nodes.map((node) => [node.defectCodeId, node.label]) ?? [],
  );
  const columns: Column<Node>[] = [
    {
      key: 'category',
      header: '대분류',
      render: (node) =>
        node.parentDefectCodeId === undefined
          ? node.label
          : (parentLabels.get(node.parentDefectCodeId) ?? EMPTY),
    },
    {
      key: 'detail',
      header: '상세',
      render: (node) => (node.parentDefectCodeId === undefined ? EMPTY : node.label),
    },
    { key: 'recordCount', header: '건수', align: 'end' },
    { key: 'defectQty', header: '수량', align: 'end' },
    {
      key: 'share',
      header: '비중',
      align: 'end',
      render: (node) => (node.share === undefined ? EMPTY : `${node.share}%`),
    },
  ];
  const duplicateWarning =
    group === 'occurrenceProcess' ||
    group === 'detectionProcess' ||
    distribution.data?.nodes.some((node) => node.duplicateRisk === true) === true;
  const distributionContent = (
    <section className="inspection-results-analysis" aria-label="불량 분포 결과">
      <div className="field-cell wide-select inspection-results-distribution-field">
        <span className="field-label">분포 묶음 기준</span>
        <Select
          aria-label="분포 묶음 기준"
          value={group}
          options={GROUP_OPTIONS}
          onChange={(value) => setGroup(value as DistributionGroup)}
        />
      </div>
      <div className="inspection-results-banner-stack">
        <AlertBanner variant="info">
          목록·요약·추이와 다른 모집단이며 두 수가 다른 것이 정상입니다.
        </AlertBanner>
        <AlertBanner variant="warning">현재 담기지 않는 불량 원천이 있을 수 있습니다.</AlertBanner>
        {duplicateWarning && (
          <AlertBanner variant="warning">공정별 분포는 중복 계상될 수 있습니다.</AlertBanner>
        )}
      </div>
      {distribution.isPending && <SkeletonText lines={3} />}
      {distribution.isError && (
        <AlertBanner
          variant="error"
          title="불량 분포를 불러오지 못했습니다."
          action={retry(distribution.refetch)}
        />
      )}
      {!distribution.isError && distribution.data !== undefined && (
        <>
          <div className="wide-table inspection-results-table">
            <Table
              density="compact"
              caption="불량코드 분포"
              columns={columns}
              rows={[...distribution.data.nodes]}
              getRowId={(node) => String(node.defectCodeId)}
              empty={<EmptyState size="sm" title="분포 데이터가 없습니다" />}
            />
          </div>
          <p className="field-note">기준 {dateTime(distribution.data.asOf)}</p>
        </>
      )}
    </section>
  );
  const tabs: TabItem[] = [
    {
      value: 'trend',
      label: '불량률 추이',
      content:
        queriesEnabled && view === 'trend' ? (
          <TrendPanels filters={filters} enabled={queriesEnabled} />
        ) : null,
    },
    {
      value: 'distribution',
      label: '불량 분포',
      content: queriesEnabled && view === 'distribution' ? distributionContent : null,
    },
  ];
  return (
    <Tabs
      aria-label="검사 결과 인사이트"
      items={tabs}
      value={view}
      onChange={(value) => setView(value as View)}
    />
  );
};
