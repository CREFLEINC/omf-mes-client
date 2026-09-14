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
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import type { InspectionInsightFilters } from './filters';
import { useDefectDistribution, type DefectDistribution } from './queries';
import type { DistributionGroup } from './request-queries';
import { TrendPanels } from './trend-panels';

const t = messages.inspectionResultInsights.tabs;
type Node = DefectDistribution['nodes'][number];
type View = 'trend' | 'distribution';
const EMPTY = '—';
const dateTime = (value: string): string => {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match === null ? value : `${match[1]} ${match[2]}`;
};
const GROUP_OPTIONS = [
  { value: 'defectCode', label: t.groups.defectCode },
  { value: 'occurrenceProcess', label: t.groups.occurrenceProcess },
  { value: 'detectionProcess', label: t.groups.detectionProcess },
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
      {t.retry}
    </Button>
  );
  const parentLabels = new Map(
    distribution.data?.nodes.map((node) => [node.defectCodeId, node.label]) ?? [],
  );
  const columns: Column<Node>[] = [
    {
      key: 'category',
      header: t.columns.category,
      render: (node) =>
        node.parentDefectCodeId === undefined
          ? node.label
          : (parentLabels.get(node.parentDefectCodeId) ?? EMPTY),
    },
    {
      key: 'detail',
      header: t.columns.detail,
      render: (node) => (node.parentDefectCodeId === undefined ? EMPTY : node.label),
    },
    { key: 'recordCount', header: t.columns.recordCount, align: 'end' },
    { key: 'defectQty', header: t.columns.defectQty, align: 'end' },
    {
      key: 'share',
      header: t.columns.share,
      align: 'end',
      render: (node) => (node.share === undefined ? EMPTY : `${node.share}%`),
    },
  ];
  const duplicateWarning =
    group === 'occurrenceProcess' ||
    group === 'detectionProcess' ||
    distribution.data?.nodes.some((node) => node.duplicateRisk === true) === true;
  const distributionContent = (
    <section className="inspection-results-analysis" aria-label={t.distributionPane}>
      <div className="field-cell wide-select inspection-results-distribution-field">
        <span className="field-label">{t.groupBy}</span>
        <Select
          aria-label={t.groupBy}
          value={group}
          options={GROUP_OPTIONS}
          onChange={(value) => setGroup(value as DistributionGroup)}
        />
      </div>
      <div className="inspection-results-banner-stack">
        <AlertBanner variant="info">{t.populationNote}</AlertBanner>
        <AlertBanner variant="warning">{t.sourceWarning}</AlertBanner>
        {duplicateWarning && <AlertBanner variant="warning">{t.duplicateWarning}</AlertBanner>}
      </div>
      {distribution.isPending && <SkeletonText lines={3} />}
      {distribution.isError && (
        <AlertBanner variant="error" title={t.failed} action={retry(distribution.refetch)} />
      )}
      {!distribution.isError && distribution.data !== undefined && (
        <>
          <div className="wide-table inspection-results-table">
            <Table
              density="compact"
              caption={t.caption}
              columns={columns}
              rows={[...distribution.data.nodes]}
              getRowId={(node) => String(node.defectCodeId)}
              empty={<EmptyState size="sm" title={t.empty} />}
            />
          </div>
          <p className="field-note">{t.asOf(dateTime(distribution.data.asOf))}</p>
        </>
      )}
    </section>
  );
  const tabs: TabItem[] = [
    {
      value: 'trend',
      label: t.trend,
      content:
        queriesEnabled && view === 'trend' ? (
          <TrendPanels filters={filters} enabled={queriesEnabled} />
        ) : null,
    },
    {
      value: 'distribution',
      label: t.distribution,
      content: queriesEnabled && view === 'distribution' ? distributionContent : null,
    },
  ];
  return (
    <Tabs
      aria-label={t.label}
      items={tabs}
      value={view}
      onChange={(value) => setView(value as View)}
    />
  );
};
