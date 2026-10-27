import { AlertBanner, Button, EmptyState, SkeletonText, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState, type ReactNode } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import { useSession } from '../../patterns/session';
import { toWebAccess } from '../../patterns/web-access';
import { DISPOSITION_SCREEN_PATH, dispositionEntryPath } from '../disposition-decision/filters';
import { dispositionKeys } from '../disposition-decision/queries';
import { SkipExecutePane } from '../iqc-skip-approval/skip-execute-pane';
import { LOT_STATUS_SCREEN_PATH, lotStatusEntryPath } from '../lot-status-history/filters';
import {
  WORK_ORDER_PROGRESS_SCREEN_PATH,
  workOrderProgressEntryPath,
} from '../work-order-progress/filters';
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
  qualityApprovalKeys,
} from './queries';
import type { DetailPaneProps } from './detail-pane';
import { RelatedLink } from './related-link';

export interface ConditionPaneProps {
  approvalRequestId: number | null;
  /**
   * 특채 승인 상세 카드의 「요청 정보」(#193) — 수량 요약 바로 아래, 사용 조건 위에 선다. 특채를 아직 못 읽었거나
   * 못 찾았을 때도 요청 정보는 먼저 보인다(그 아래에 상태 안내가 선다).
   * 특채를 읽었으면 그 LOT 과 「LOT 열기」 단추를 넘긴다 — 대상 LOT 칸 옆에 선다(권한이 없으면 넘기지 않는다).
   */
  requestInfo?: (targetLot?: DetailPaneProps['targetLot']) => ReactNode;
  /** 결재 요청의 상태 — 승인(APPROVED)이면 아직 적용 안 한 특채에 적용 구획이 선다(#193). */
  requestStatusCode?: string;
}

/** 특채 상태(서버 P-79) — 적용 전은 PENDING, 적용하면 APPROVED, 반려를 닫으면 REJECTED. */
const CONCESSION_PENDING = 'PENDING';
const CONCESSION_APPLIED = 'APPROVED';

export const ConditionPane = ({
  approvalRequestId,
  requestInfo = () => null,
  requestStatusCode,
}: ConditionPaneProps) => {
  const t = messages.qualityApproval.condition;
  const { session } = useSession();
  const access = toWebAccess(session?.permissions);
  const { client } = useApiClient();
  const toast = useToast();
  /*
   * 승인된 특채의 적용(#193) — IQC·OQC 생략 실행처럼 이 화면에서 한다. 서버 경로는 처분 판정 처리의 적용과 같고,
   * 서버가 결재 화면(W-03-09) 권한으로도 연다(서버 `manual-permissions` · #193). 적용 여부는 특채 상태가 말한다.
   */
  const [applySentId, setApplySentId] = useState<number | null>(null);
  const applyWrite = useMasterWrite<number, unknown>({
    request: (concessionId, headers) =>
      client.POST('/quality/concessions/{concessionId}:apply', {
        params: {
          path: { concessionId },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
      }),
    etagPath: null,
    /* 적용은 특채·LOT·부적합·판정을 함께 바꾼다 — 이 화면과 처분 판정 처리의 뿌리 키를 다시 부른다. */
    invalidateKeys: [qualityApprovalKeys.all, dispositionKeys.all],
    knownFields: [],
    onSuccess: () => {
      toast.show({
        variant: 'success',
        description: messages.qualityApproval.concessionApply.done,
      });
    },
  });
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
        {requestInfo()}
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
        {requestInfo()}
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
        {requestInfo()}
        <EmptyState size="sm" live title={t.none} />
      </>
    );
  }
  if (cardinality?.kind === 'unsafe') {
    return (
      <>
        {requestInfo()}
        <AlertBanner variant="error">{t.unsafe}</AlertBanner>
      </>
    );
  }
  if (detail.isPending) {
    return (
      <>
        {requestInfo()}
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={2} />
        </div>
      </>
    );
  }
  if (detail.data === undefined) return <>{requestInfo()}</>;

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
      {requestInfo(
        access.allows(LOT_STATUS_SCREEN_PATH)
          ? {
              to: lotStatusEntryPath(detail.data.lotId),
              label: t.openLot,
              name: detail.data.lotNo?.trim() || t.lotNoUnknown,
            }
          : undefined,
      )}
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
        {view.isUnrestricted ? (
          /* 셋 다 제한이 없으면 한 줄로 줄인다(사용자 지시 2026-10-27). */
          <div
            className="quality-approval-concession-limits is-none"
            role="group"
            aria-label={t.limits}
          >
            <h4>{t.limits}</h4>
            <span>{t.limitsNone}</span>
          </div>
        ) : (
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
        )}
        {facts([[t.remarks, view.remarks]], 'quality-approval-concession-grid')}
      </section>
      {requestStatusCode === 'APPROVED' &&
        (detail.data.statusCode === CONCESSION_PENDING ||
          detail.data.statusCode === CONCESSION_APPLIED) && (
          <SkipExecutePane
            texts={messages.qualityApproval.concessionApply}
            compact={messages.qualityApproval.concessionApply.compact}
            state={
              detail.data.statusCode === CONCESSION_APPLIED
                ? { kind: 'executed' }
                : { kind: 'executable' }
            }
            isSaving={applySentId === detail.data.concessionId && applyWrite.isSaving}
            onExecute={() => {
              setApplySentId(detail.data.concessionId);
              applyWrite.write(detail.data.concessionId);
            }}
            banner={
              <SaveErrorBanner
                error={applySentId === detail.data.concessionId ? applyWrite.error : null}
              />
            }
          />
        )}
      {/*
       * 다른 화면에서 이 정보를 여는 줄(#193) — 연관 부적합(처분 판정 처리) · 허용 작업지시
       * (W/O 진행현황). 그 화면을 볼 권한이 없으면 줄을 세우지 않는다 — 누르는 순간 막힌 화면이 선다.
       * ⭐ 부적합은 특채일 때만 성립한다(스펙 §5-1) — 지목할 식별자를 특채가 들고 있다(계약 필수).
       */}
      {access.allows(DISPOSITION_SCREEN_PATH) && (
        <RelatedLink
          heading={t.nonconformanceHeading}
          value={view.nonconformanceNo}
          to={dispositionEntryPath(detail.data.nonconformanceId)}
          label={t.openNonconformance}
        />
      )}
      {detail.data.allowedWorkOrderId != null && access.allows(WORK_ORDER_PROGRESS_SCREEN_PATH) && (
        <RelatedLink
          heading={t.workOrderHeading}
          value={view.workOrder}
          to={workOrderProgressEntryPath(detail.data.allowedWorkOrderId)}
          label={t.openWorkOrder}
        />
      )}
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
