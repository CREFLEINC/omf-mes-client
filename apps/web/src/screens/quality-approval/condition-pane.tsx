import { AlertBanner, Button, EmptyState, Icon, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
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
  /**
   * 특채 승인 상세 카드의 「요청 정보」(#193) — 수량 요약 바로 아래, 사용 조건 위에 선다. 특채를 아직 못 읽었거나
   * 못 찾았을 때도 요청 정보는 먼저 보인다(그 아래에 상태 안내가 선다).
   */
  requestInfo?: ReactNode;
}

export const ConditionPane = ({ approvalRequestId, requestInfo = null }: ConditionPaneProps) => {
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
      <>
        {requestInfo}
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={2} />
        </div>
      </>
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
      <>
        {requestInfo}
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
      </>
    );
  }

  if (cardinality?.kind === 'none') {
    return (
      <>
        {requestInfo}
        <EmptyState size="sm" live title={t.none} />
      </>
    );
  }
  if (cardinality?.kind === 'unsafe') {
    return (
      <>
        {requestInfo}
        <AlertBanner variant="error">{t.unsafe}</AlertBanner>
      </>
    );
  }
  if (detail.isPending) {
    return (
      <>
        {requestInfo}
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={2} />
        </div>
      </>
    );
  }
  if (detail.data === undefined) return <>{requestInfo}</>;

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
  /* 수량 요약의 단위 — 단위 이름(「개」)만 붙인다. 못 읽었으면 비운다(아래 「단위」 칸이 사정을 말한다). */
  const uomName =
    uoms.data?.items.find((uom) => uom.uomId === detail.data.uomId)?.uomName.trim() ?? '';
  const hasReferenceError =
    workOrder.isError ||
    customer.isError ||
    uoms.isError ||
    (hasProcessReference && processes.isError);

  const facts = (rows: ReadonlyArray<readonly [string, string]>, className: string) => (
    <dl className={className}>
      {rows.map(([label, value]) => (
        <div className="field-cell" key={label}>
          <dt className="field-label">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );

  /*
   * 특채 승인 상세(#193) — 수량 요약 → 요청 정보 → 사용 조건(적용 제한) → 연관 부적합 차례다.
   * 묶음 이름(`aria-label`)은 종전의 「연결 조건」 그대로다 — 이 묶음이 특채 조건을 싣는다는 뜻은 같다.
   */
  return (
    <div className="quality-approval-concession" role="group" aria-label={t.title}>
      <dl className="quality-approval-concession-qty">
        {[
          [t.approvedQty, view.approvedQty],
          [t.consumedQty, view.consumedQty],
          [t.remainingQty, view.remainingQty],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="field-label">{label}</dt>
            <dd>
              <strong>{value}</strong>
              {uomName !== '' && <span>{uomName}</span>}
            </dd>
          </div>
        ))}
      </dl>
      {requestInfo}
      <section className="quality-approval-concession-section" aria-label={t.usageTitle}>
        <h3>{t.usageTitle}</h3>
        {facts(
          [
            [t.concessionNo, view.concessionNo],
            [t.validity, view.validity],
            [t.usableLabel, view.usable],
            [t.uom, view.uom],
          ],
          'quality-approval-concession-grid',
        )}
        <div className="quality-approval-concession-limits" role="group" aria-label={t.limits}>
          <h4>{t.limits}</h4>
          {facts(
            [
              [t.limitWorkOrder, view.workOrder],
              [t.limitProcess, view.process],
              [t.limitCustomer, view.customer],
            ],
            'quality-approval-concession-grid is-three',
          )}
        </div>
        {facts([[t.remarks, view.remarks]], 'quality-approval-concession-grid')}
      </section>
      {/*
       * ⭐ **「부적합 열기」 — 특채일 때만 선다**(스펙 §5-1). 지목할 부적합 식별자를 특채가 들고 있다(계약 필수).
       * **버튼 모양의 링크다** — 이름이 갈 곳을 말하고, 번호는 어느 부적합인지를 말한다(번호를 이름 옆에 둔다).
       * 주소는 **가는 쪽 화면이 만든다**(진입 규약 omf-mes#194 §3).
       */}
      <div className="quality-approval-concession-nc" role="group" aria-label={t.nonconformance}>
        <div>
          <h3>{t.nonconformanceHeading}</h3>
          <span>{view.nonconformanceNo}</span>
        </div>
        <Link
          className="quality-approval-concession-nc-link"
          to={dispositionEntryPath(detail.data.nonconformanceId)}
        >
          {t.openNonconformance}
          <Icon name="open_in_new" size={18} />
        </Link>
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
