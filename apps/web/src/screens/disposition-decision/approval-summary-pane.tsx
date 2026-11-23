import { AlertBanner, Button, SkeletonText } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { CONCESSION_DISPOSITION, dispositionTypeLabel } from './disposition-codes';
import { dispositionKeys } from './queries';
import { formatQty } from './types';

type ApprovalNonconformanceSummary = components['schemas']['ApprovalNonconformanceSummary'];

const t = messages.dispositionDecision.approvalSummary;

/** 결재 대상 부적합의 정보(omf-all-around#352) — 결재자가 무엇을 승인하는지 본다. 대상이 부적합이 아니면 부르지 않는다. */
export const useApprovalNonconformanceSummary = (approvalRequestId: number | null) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: [...dispositionKeys.all, 'approval-summary', approvalRequestId ?? 0] as const,
    enabled: approvalRequestId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/approval-requests/{approvalRequestId}/nonconformance-summary', {
          params: { path: { approvalRequestId: approvalRequestId as number } },
        }),
      ),
  });
};

const qtyText = (qty: number | null | undefined, uomCode: string | null): string => {
  if (qty === null || qty === undefined) return '-';
  return uomCode === null || uomCode.trim() === ''
    ? formatQty(qty)
    : `${formatQty(qty)} ${uomCode}`;
};

/** 화면에 늘어놓을 칸 — 비어 있는 칸은 두지 않는다. */
export const toSummaryRows = (
  summary: ApprovalNonconformanceSummary,
): { label: string; value: string; wide?: boolean }[] => {
  const uom = summary.uomCode;
  const rows: { label: string; value: string; wide?: boolean }[] = [
    { label: t.nonconformanceNo, value: summary.nonconformanceNo },
    { label: t.item, value: `${summary.itemCode} · ${summary.itemName}` },
    {
      label: t.lots,
      value: summary.lots
        .map((lot) => `${lot.lotNo} (${qtyText(lot.affectedQty, uom)})`)
        .join(', '),
      wide: true,
    },
    { label: t.affectedQty, value: qtyText(summary.affectedQtyTotal, uom) },
    { label: t.remainingQty, value: qtyText(summary.remainingQty, uom) },
    { label: t.defect, value: summary.description, wide: true },
  ];

  const request = summary.dispositionApproval;
  if (request !== null) {
    const typeLabel = dispositionTypeLabel(request.dispositionTypeCode);
    rows.push({
      label: t.requestedDisposition,
      value:
        request.decisionQty === null
          ? typeLabel
          : `${typeLabel} ${qtyText(request.decisionQty, request.uomCode ?? uom)}`,
    });
    if (request.dispositionTypeCode === 'SORT') {
      rows.push({
        label: t.sortLots,
        value: request.lots.map((lot) => lot.lotNo).join(', '),
        wide: true,
      });
      if (request.goodQty !== null)
        rows.push({ label: t.goodQty, value: qtyText(request.goodQty, uom) });
      if (request.defectQty !== null) {
        rows.push({ label: t.defectQty, value: qtyText(request.defectQty, uom) });
      }
    }
    rows.push({ label: t.reason, value: request.reason, wide: true });
  } else if (summary.concession !== null) {
    rows.push({
      label: t.requestedDisposition,
      value: `${dispositionTypeLabel(CONCESSION_DISPOSITION)} ${qtyText(summary.concession.approvedQty, uom)}`,
    });
  }

  return rows.filter((row) => row.value.trim() !== '');
};

export interface ApprovalSummaryPaneProps {
  approvalRequestId: number;
}

/**
 * 「부적합 정보」 구획 — 품질 승인 처리 · 결재함 상세에 선다(omf-all-around#352). 값 표기만 하고 고칠 칸은 없다.
 */
export const ApprovalSummaryPane = ({ approvalRequestId }: ApprovalSummaryPaneProps) => {
  const summary = useApprovalNonconformanceSummary(approvalRequestId);

  return (
    <section className="quality-approval-concession-section" aria-label={t.title}>
      <h3>{t.title}</h3>
      {summary.isPending ? (
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={3} />
        </div>
      ) : summary.isError ? (
        <AlertBanner
          variant="error"
          action={
            <Button variant="outlined" size="sm" onClick={() => void summary.refetch()}>
              {messages.common.retry}
            </Button>
          }
        >
          {t.loadError}
        </AlertBanner>
      ) : (
        <dl className="quality-approval-concession-grid">
          {toSummaryRows(summary.data).map((row) => (
            <div className={`field-cell${row.wide === true ? ' is-wide' : ''}`} key={row.label}>
              <dt className="field-label">{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
};
