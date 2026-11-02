import {
  AlertBanner,
  Button,
  type Column,
  EmptyState,
  Icon,
  SkeletonText,
  Tabs,
  type TabItem,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { ManagedTable } from '../../patterns/managed-table';
import { Select } from '../../patterns/select';
import type { InspectionInsightFilters } from './filters';
import { useDefectDistribution, type DefectDistribution } from './queries';
import type { DistributionGroup } from './request-queries';
import { TrendPanels } from './trend-panels';

const t = messages.inspectionResultInsights.tabs;
type Node = DefectDistribution['nodes'][number];
type View = 'trend' | 'distribution';
const EMPTY = '—';
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
  /*
   * 불량 기록의 출처(현장 · 공정검사 · 출하검사 · 수리 · 클레임)에 수입검사가 없어 서버가 수입검사만 거르지 못한다 —
   * 걸러도 전체 불량이 온다(실검증 DB 실측 2026-11-02). 표 대신 안내를 둔다(사용자 결정).
   */
  const iqcOnly = sourceAxisCode === 'IQC';
  const distribution = useDefectDistribution(
    filters,
    group,
    sourceAxisCode,
    queriesEnabled && view === 'distribution' && !iqcOnly,
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
      align: 'start',
      width: '220px',
      render: (node) =>
        node.parentDefectCodeId === undefined
          ? node.label
          : (parentLabels.get(node.parentDefectCodeId) ?? EMPTY),
    },
    {
      key: 'detail',
      header: t.columns.detail,
      align: 'start',
      width: '220px',
      render: (node) => (node.parentDefectCodeId === undefined ? EMPTY : node.label),
    },
    { key: 'recordCount', header: t.columns.recordCount, align: 'center', width: '100px' },
    { key: 'defectQty', header: t.columns.defectQty, align: 'center', width: '120px' },
    {
      key: 'share',
      header: t.columns.share,
      align: 'center',
      width: '100px',
      /* 비중은 소수 한 자리(서버 원값은 긴 소수 · 사용자 실검증 2026-10-30). */
      render: (node) => (node.share === undefined ? EMPTY : `${node.share.toFixed(1)}%`),
    },
  ];
  const duplicateWarning =
    group === 'occurrenceProcess' ||
    group === 'detectionProcess' ||
    distribution.data?.nodes.some((node) => node.duplicateRisk === true) === true;
  const distributionContent = iqcOnly ? (
    <section className="inspection-results-analysis" aria-label={t.distributionPane}>
      <p className="iqc-inspection-action-note" data-tone="info" role="status">
        <Icon name="info" size={14} aria-hidden />
        {t.iqcDistributionUnavailable}
      </p>
    </section>
  ) : (
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
      {/* 모집단 · 불량 원천 안내는 뺐다(사용자 2026-10-30). 공정별 중복 계상 경고는 그대로다. */}
      {duplicateWarning && (
        <div className="inspection-results-banner-stack">
          <AlertBanner variant="warning">{t.duplicateWarning}</AlertBanner>
        </div>
      )}
      {distribution.isPending && <SkeletonText lines={3} />}
      {distribution.isError && (
        <AlertBanner variant="error" title={t.failed} action={retry(distribution.refetch)} />
      )}
      {!distribution.isError && distribution.data !== undefined && (
        <>
          {/* 검사 결과 목록과 같은 표 — 대분류 · 상세는 왼쪽, 수는 가운데(사용자 2026-10-30). */}
          <ManagedTable
            storageKey="omf-mes:inspection-results:columns:distribution"
            className="inspection-results-table"
            caption={t.caption}
            columns={columns}
            rows={[...distribution.data.nodes]}
            getRowId={(node) => String(node.defectCodeId)}
            empty={<EmptyState size="sm" title={t.empty} />}
          />
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
