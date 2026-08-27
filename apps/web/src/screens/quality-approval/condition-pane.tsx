import { AlertBanner, Button, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Link } from 'react-router';

import { toApiError } from '../../patterns/request';
import { dispositionEntryPath } from '../disposition-decision/filters';
import {
  toConcessionCardinality,
  toConcessionCardView,
  toExactReference,
  toListReference,
  UNKNOWN_CONDITION_REFERENCES,
} from './conditions';
import {
  useConditionCustomer,
  useConditionProcesses,
  useConditionUoms,
  useConditionWorkOrder,
  useConcessionCandidates,
  useConcessionDetail,
} from './queries';

export interface ConditionPaneProps {
  approvalRequestId: number | null;
}

export const ConditionPane = ({ approvalRequestId }: ConditionPaneProps) => {
  const t = messages.qualityApproval.condition;
  const candidates = useConcessionCandidates(approvalRequestId);
  const cardinality =
    approvalRequestId === null || candidates.data === undefined
      ? null
      : toConcessionCardinality(approvalRequestId, candidates.data);
  const concessionId = cardinality?.kind === 'one' ? cardinality.concessionId : null;
  const detail = useConcessionDetail(concessionId);
  const workOrder = useConditionWorkOrder(detail.data?.allowedWorkOrderId ?? null);
  const customer = useConditionCustomer(detail.data?.allowedCustomerId ?? null);
  const uoms = useConditionUoms(detail.data !== undefined);
  const processId = detail.data?.allowedProcessId ?? null;
  const hasProcessReference = processId !== null;
  const processes = useConditionProcesses(processId);

  if (approvalRequestId === null) return null;
  if (candidates.isPending) {
    return (
      <div role="status" aria-label={t.loading}>
        <SkeletonText lines={2} />
      </div>
    );
  }

  const error = candidates.error ?? detail.error;
  if (error !== null) {
    const description =
      toApiError(error).kind === 'network'
        ? messages.httpError.offline
        : messages.httpError.description;
    const retry = candidates.error === null ? detail.refetch : candidates.refetch;
    return (
      <AlertBanner
        variant="error"
        title={messages.httpError.loadTitle}
        action={
          <Button variant="outlined" size="sm" onClick={() => void retry()}>
            {messages.common.retry}
          </Button>
        }
      >
        {description}
      </AlertBanner>
    );
  }

  if (cardinality?.kind === 'none') return <EmptyState size="sm" live title={t.none} />;
  if (cardinality?.kind === 'unsafe') {
    return <AlertBanner variant="error">{t.unsafe}</AlertBanner>;
  }
  if (detail.isPending) {
    return (
      <div role="status" aria-label={t.loading}>
        <SkeletonText lines={2} />
      </div>
    );
  }
  if (detail.data === undefined) return null;

  const view = toConcessionCardView(detail.data, {
    ...UNKNOWN_CONDITION_REFERENCES,
    uom: toListReference(
      {
        entries:
          uoms.data?.items.map((uom) => ({
            id: uom.uomId,
            name:
              uom.uomCode.trim() === '' || uom.uomName.trim() === ''
                ? ''
                : `${uom.uomCode} · ${uom.uomName}`,
          })) ?? [],
        total: uoms.data?.page.total ?? 0,
        isError: uoms.isError,
        isLoading: uoms.isPending,
      },
      detail.data.uomId,
    ),
    workOrder: toExactReference({
      name: workOrder.data?.workOrderNo,
      isError: workOrder.isError,
      isLoading: workOrder.isPending,
    }),
    customer: toExactReference({
      name: customer.data?.partnerName,
      isError: customer.isError,
      isLoading: customer.isPending,
    }),
    process: toListReference(
      {
        entries:
          processes.data?.items.map((process) => ({
            id: process.processId,
            name: process.processName,
          })) ?? [],
        total: processes.data?.page.total ?? 0,
        isError: processes.isError,
        isLoading: processes.isPending,
      },
      detail.data.allowedProcessId,
    ),
  });
  const hasReferenceError =
    workOrder.isError ||
    customer.isError ||
    uoms.isError ||
    (hasProcessReference && processes.isError);

  return (
    <div role="group" aria-label={t.title}>
      <span className="field-label">{t.title}</span>
      <dl className="filter-bar">
        {[
          [t.concessionNo, view.concessionNo],
          [t.approvedQty, view.approvedQty],
          [t.consumedQty, view.consumedQty],
          [t.uom, view.uom],
          [t.validity, view.validity],
          [messages.qualityApproval.fields.statusCode, view.statusCode],
          [t.usableLabel, view.usable],
          [t.remarks, view.remarks],
          [t.workOrder, view.workOrder],
          [t.process, view.process],
          [t.customer, view.customer],
        ].map(([label, value]) => (
          <div className="field-cell" key={label}>
            <dt className="field-label">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {/*
       * ⭐ **「부적합 열기」 — 특채일 때만 선다**(스펙 §5-1). 지목할 부적합 식별자를 특채가
       * 들고 있어(계약에서 `nonconformanceId`가 필수다) 이 칸이 그 이동의 자리다. 한도승인처럼
       * 연결 조건이 없는 결재에서는 이 칸 자체가 그려지지 않으므로 갈 곳 없는 컨트롤이 남지 않는다.
       *
       * **버튼이 아니라 링크다.** 자리표시 시절에는 잠긴 버튼이라 사유를 `aria-describedby`로
       * 이어야 했지만, 링크는 포커스를 받고 그 이름이 갈 곳을 그대로 말한다.
       *
       * 주소는 **가는 쪽 화면이 만든다** — 키 이름을 여기서 손으로 적으면 그 화면이 키를 바꿀 때
       * 조용히 끊어진다(진입 규약 omf-mes#194 §3).
       */}
      <div className="field-cell">
        <Link to={dispositionEntryPath(detail.data.nonconformanceId)}>{t.openNonconformance}</Link>
      </div>
      {hasReferenceError ? (
        <AlertBanner
          variant="error"
          title={t.reference.failed}
          action={
            <Button
              variant="outlined"
              size="sm"
              onClick={() => {
                if (workOrder.isError) void workOrder.refetch();
                if (customer.isError) void customer.refetch();
                if (uoms.isError) void uoms.refetch();
                if (hasProcessReference && processes.isError) void processes.refetch();
              }}
            >
              {messages.common.retry}
            </Button>
          }
        >
          {messages.httpError.description}
        </AlertBanner>
      ) : null}
    </div>
  );
};
