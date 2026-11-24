import { Button, Chip, EmptyState, Icon, Table, useToast, type Column } from '@crefle/web-ui';
import type { InspectionLotForward, InspectionResultSummaryForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState, type ReactNode } from 'react';

import { InfoTip } from '../../patterns/info-tip';
import { formatQty } from '../../patterns/package-qty';
import { toApiError } from '../../patterns/request';
import { PlanViewLauncher } from '../iqc-inspection/plan-view-launcher';
import {
  SkippedOverview,
  type SkippedOverviewTab,
  usePlanCode,
} from '../parts-iqc-inspection/skipped-overview';
import { useSamplingRule } from '../iqc-inspection/queries';
import { LotNo } from '../parts-iqc-inspection/lot-match-field';
import { ResultList } from '../parts-iqc-inspection/result-list';
import { QueueLoadErrorBanner } from './load-error-banner';
import {
  defaultMatchOf,
  OPEN_STATUSES,
  overviewOfViews,
  pickedLotViewsOf,
  type PickedLotView,
} from './shipment-oqc';
import { LotJudgmentChip, OverviewChip, portionsText, replacedText } from './shipment-oqc-parts';
import { useShipmentOqcRequest, useShipmentRequestRef } from './shipment-oqc-queries';
import { ShipmentResultDrawer } from './shipment-result-drawer';
import { toStatusBadge } from './status-badge';
import { formatDateTime } from './types';

const s = messages.oqcInspection.shipment;

/** 피킹 LOT 표의 한 줄 — 살아 있는 LOT(판정 대상) 또는 교체된 LOT(이력). */
type LotRow =
  { kind: 'active'; view: PickedLotView } | { kind: 'replaced'; lot: InspectionLotForward };

const lotOfRow = (row: LotRow): InspectionLotForward =>
  row.kind === 'active' ? row.view.lot : row.lot;

export interface ShipmentOqcDetailProps {
  inspectionRequestId: number;
  /** 품목 「코드 · 이름」 — 화면이 품목 풀이를 이미 읽어 두었다. 못 풀었으면 표기 글 하나. */
  itemLabel: ReactNode;
  /** 품목 이름 · 코드 — 생략 건 요약(IQC 와 같은 틀 · #353)이 이름 · 코드 차례로 쓴다. 못 풀었으면 null. */
  itemParts: { code: string; name: string } | null;
  uomCode: string | null;
  /** 생략 건 상세의 「검사 진행」 뒤 탭(검사 이력 · 시리얼별 검사 이력 · #353). */
  skippedTabs?: SkippedOverviewTab[];
}

/**
 * W-04-03 출하 OQC 새 흐름 상세(피처 010 · 시안 W0403-After · decisions #47) — IQC W-01-01 새 흐름 상세와 같은 짜임.
 *
 * - 대상 정보: 출하 지시서 · 고객 · 품목 · 목표/피킹(초과) · 검사 유형 · 적용 기준 · 의뢰 일시 · 의뢰번호.
 * - 「판정은 출하 완료 때 확정」 안내(확정 단추 없음).
 * - 피킹 LOT 표: LOT 번호 · 피킹 수량 · 창고 · 위치 · 판정 · 적용 검사, 교체된 LOT 은 맨 아래 회색 줄(교체됨 · 근거 · 부적합 번호).
 * - 검사 결과 표(IQC `ResultList` — 검사 수량 · 불량 칸 없이) + 결과 추가 · 수정 드로어. 결과는 지우지 않는다(서버가 받지 않는다).
 *
 * 옛 흐름(대상 LOT 이 있는 의뢰)은 이 부품을 쓰지 않는다 — 지금 화면 그대로(회차 · 수량 · 확정).
 */
export const ShipmentOqcDetail = ({
  inspectionRequestId,
  itemLabel,
  itemParts,
  uomCode,
  skippedTabs,
}: ShipmentOqcDetailProps) => {
  const toast = useToast();
  const query = useShipmentOqcRequest(inspectionRequestId);
  const request = query.data;
  const ref = useShipmentRequestRef(request?.targetId ?? null, request?.itemId ?? 0);
  const planRule = useSamplingRule(request?.inspectionPlanVersionId ?? null);
  const [drawer, setDrawer] = useState<{ editing: InspectionResultSummaryForward | null } | null>(
    null,
  );
  const addBlockedId = useId();
  /* 기준서 번호는 생략 요약만 보인다 — 일반 건은 부르지 않는다. */
  const planCode = usePlanCode(
    request?.statusCode === 'SKIPPED' ? (request.inspectionPlanVersionId ?? null) : null,
  );

  if (query.isError) {
    return (
      <QueueLoadErrorBanner error={toApiError(query.error)} onRetry={() => void query.refetch()} />
    );
  }
  if (request === undefined) return <p className="field-note">{s.drawer.loading}</p>;

  const uom = uomCode ?? '';
  const qty = (value: number): string => `${formatQty(value)} ${uom}`.trim();
  const { active, replaced } = pickedLotViewsOf(request);
  const results = request.results ?? [];
  const overview = overviewOfViews(request.statusCode, active);
  const isOpen = OPEN_STATUSES.includes(request.statusCode);
  const skipped = request.statusCode === 'SKIPPED';
  const pickedTotal = active.reduce((sum, view) => sum + view.lot.lotQty, 0);
  const badge = toStatusBadge(request.statusCode, request.skipBasisCode ?? null);
  const nextSeqNo =
    request.nextResultSeqNo ?? results.reduce((max, result) => Math.max(max, result.seqNo), 0) + 1;
  const refData = ref.data;
  const shipmentRequestNo = request.shipmentRequestNo ?? refData?.shipmentRequestNo ?? '—';

  /* 생략 건은 IQC 생략 건과 같은 틀 — 입력 · 결과 칸 없이 요약만(사용자 지시 2026-11-23 · #353). */
  if (skipped) {
    return (
      <div className="parts-iqc-detail-body iqc-inbound-detail oqc-shipment-detail">
        <SkippedOverview
          title={messages.partsIqcInspection.skipped.titleOqc}
          {...(skippedTabs === undefined ? {} : { tabs: skippedTabs })}
          itemLabel={messages.partsIqcInspection.skipped.item}
          itemParts={itemParts}
          planCode={planCode}
          planAction={
            request.inspectionPlanVersionId == null ? null : (
              <PlanViewLauncher
                inspectionPlanVersionId={request.inspectionPlanVersionId}
                label={messages.iqcInspection.detail.openPlan}
              />
            )
          }
          requestNo={request.inspectionRequestNo}
          lotNo={active.map((view) => view.lot.lotNo).join(', ') || '-'}
          lotFacts={[
            { key: 'sr', label: s.facts.shipmentRequest, value: shipmentRequestNo },
            { key: 'customer', label: s.facts.customer, value: refData?.customerName ?? '—' },
            {
              key: 'tp',
              label: s.facts.targetPicked,
              value:
                refData === undefined
                  ? '—'
                  : s.targetPicked(formatQty(refData.targetQty), formatQty(refData.pickedQty), uom),
            },
            { key: 'at', label: s.facts.requestedAt, value: formatDateTime(request.requestedAt) },
          ]}
        />
      </div>
    );
  }

  const facts: { key: string; label: string; value: ReactNode; emphasized?: boolean }[] = [
    {
      key: 'sr',
      label: s.facts.shipmentRequest,
      value: shipmentRequestNo,
      emphasized: true,
    },
    { key: 'customer', label: s.facts.customer, value: refData?.customerName ?? '—' },
    { key: 'item', label: s.facts.item, value: itemLabel, emphasized: true },
    {
      key: 'tp',
      label: s.facts.targetPicked,
      value:
        refData === undefined ? (
          '—'
        ) : (
          <span className="oqc-shipment-target">
            {s.targetPicked(formatQty(refData.targetQty), formatQty(refData.pickedQty), uom)}
            {refData.overQty > 0 ? (
              <Chip size="sm" status="info">
                {s.over(formatQty(refData.overQty))}
              </Chip>
            ) : null}
          </span>
        ),
      emphasized: true,
    },
    { key: 'type', label: s.facts.inspectionType, value: s.facts.inspectionTypeValue },
    {
      key: 'plan',
      label: s.facts.plan,
      value:
        request.inspectionPlanVersionId == null ? (
          messages.oqcInspection.detail.noPlanVersion
        ) : (
          <span className="iqc-inspection-plan-cell">
            <span>
              {planRule.data === undefined
                ? '…'
                : messages.iqcInspection.detail.planVersion(planRule.data.planVersion)}
            </span>
            <PlanViewLauncher
              inspectionPlanVersionId={request.inspectionPlanVersionId}
              label={messages.iqcInspection.detail.openPlan}
            />
          </span>
        ),
    },
    { key: 'at', label: s.facts.requestedAt, value: formatDateTime(request.requestedAt) },
    { key: 'no', label: s.facts.request, value: request.inspectionRequestNo },
  ];

  const lotRows: LotRow[] = [
    ...active.map((view): LotRow => ({ kind: 'active', view })),
    ...replaced.map((lot): LotRow => ({ kind: 'replaced', lot })),
  ];
  const lotColumns: Column<LotRow>[] = [
    {
      key: 'lotNo',
      header: s.lots.columns.lotNo,
      render: (row) =>
        row.kind === 'active' ? (
          <LotNo lotNo={row.view.lot.lotNo} />
        ) : (
          <s className="oqc-shipment-replaced-no">{row.lot.lotNo}</s>
        ),
    },
    {
      key: 'qty',
      align: 'end',
      header: s.lots.columns.qty,
      render: (row) => qty(lotOfRow(row).lotQty),
    },
    {
      key: 'portions',
      header: s.lots.columns.portions,
      render: (row) =>
        row.kind === 'active' ? (
          <span className="parts-iqc-muted">
            {portionsText(refData?.lotOf(row.view.lot.lotId) ?? null)}
          </span>
        ) : (
          <span className="parts-iqc-muted">
            {replacedText(refData?.lotOf(row.lot.lotId) ?? null)}
          </span>
        ),
    },
    {
      key: 'judgment',
      header: s.lots.columns.judgment,
      render: (row) =>
        row.kind === 'active' ? (
          <span className="iqc-inbound-chips">
            <LotJudgmentChip code={row.view.judgmentCode} />
            {/* 불합격 LOT 은 PDA 에서 [교체]한다(시안 W0403 ①). */}
            {row.view.judgmentCode === 'REJECTED' ? (
              <span className="parts-iqc-muted">{s.lots.replaceHint}</span>
            ) : null}
          </span>
        ) : (
          <Chip size="sm">{s.lots.replaced}</Chip>
        ),
    },
    {
      key: 'applied',
      header: s.lots.columns.applied,
      render: (row) =>
        row.kind === 'replaced'
          ? '—'
          : row.view.appliedSeqNo !== null
            ? s.lots.applied(row.view.appliedSeqNo)
            : row.view.judgmentCode === 'SKIPPED'
              ? '—'
              : s.lots.appliedNone,
    },
  ];

  return (
    <div className="parts-iqc-detail-body iqc-inbound-detail oqc-shipment-detail">
      <div className="parts-iqc-detail-head">
        <h2 className="parts-iqc-sub-title">{request.inspectionRequestNo}</h2>
        <Chip variant="status" size="sm" status={badge.tone}>
          {badge.label}
        </Chip>
      </div>
      <dl className="parts-iqc-facts iqc-inbound-facts">
        {facts.map((fact) => (
          <div className="parts-iqc-fact" key={fact.key}>
            <dt className="field-label">{fact.label}</dt>
            <dd className={fact.emphasized === true ? 'parts-iqc-fact-key' : undefined}>
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* 출하 완료로 닫힌 의뢰는 그 사실을 한 줄로(생략은 머리줄 안내). 열린 의뢰의 판정 규칙은 「검사 결과」 제목 옆 ⓘ 로(관리웹 정리 시안 A). */}
      {request.statusCode === 'COMPLETED' && (
        <p className="field-note oqc-shipment-note">
          <Icon name="info" size={16} aria-hidden />
          <span>{s.completed}</span>
        </p>
      )}

      <section className="parts-iqc-card" aria-label={s.lots.heading(active.length)}>
        <div className="parts-iqc-block-head">
          <h3>
            {s.lots.title} <span className="parts-iqc-muted">{s.lots.count(active.length)}</span>
          </h3>
          <span className="parts-iqc-footer-gap" />
          <OverviewChip overview={overview} />
          <span className="parts-iqc-muted">{s.lots.total(qty(pickedTotal))}</span>
        </div>
        {lotRows.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<Icon name="inventory_2" size={20} />}
            title={s.lots.emptyTitle}
            description={s.lots.emptyDescription}
          />
        ) : (
          <div className="wide-table iqc-inbound-table oqc-shipment-lots">
            <Table
              density="compact"
              columns={lotColumns}
              rows={lotRows}
              getRowId={(row) => `${row.kind}-${String(lotOfRow(row).lotId)}`}
              aria-label={s.lots.heading(active.length)}
            />
          </div>
        )}
      </section>

      <section className="parts-iqc-card" aria-label={s.results.heading(results.length)}>
        <div className="parts-iqc-block-head">
          <h3 className="oqc-shipment-results-title">
            {s.results.title}{' '}
            <span className="parts-iqc-muted">{s.results.count(results.length)}</span>
            {!skipped && request.statusCode !== 'COMPLETED' && <InfoTip text={s.note} />}
          </h3>
          <span className="parts-iqc-footer-gap" />
          {isOpen ? (
            <Button
              size="md"
              leadingIcon={<Icon name="add" size={18} aria-hidden />}
              disabled={active.length === 0}
              aria-describedby={active.length === 0 ? addBlockedId : undefined}
              onClick={() => setDrawer({ editing: null })}
            >
              {s.results.add}
            </Button>
          ) : null}
        </div>
        {isOpen && active.length === 0 ? (
          <p id={addBlockedId} className="field-note">
            {s.results.addBlocked}
          </p>
        ) : null}
        <ResultList
          results={results}
          lots={request.lots ?? []}
          uomCode={uom}
          locked={!isOpen}
          confirmedAt={null}
          busy={false}
          onEdit={(result) => setDrawer({ editing: result })}
          onDelete={() => undefined}
          text={s.results}
          showQuantities={false}
          showConfirmedAt={false}
          showInspectedAt
          columnsStorageKey="omf-mes:oqc-shipment-results:columns"
          canDelete={false}
          inactiveLotIds={replaced.map((lot) => lot.lotId)}
        />
      </section>

      {drawer !== null && (
        <ShipmentResultDrawer
          inspectionRequestId={request.inspectionRequestId}
          itemId={request.itemId}
          uomId={request.uomId}
          uomCode={uom}
          planVersionId={request.inspectionPlanVersionId}
          views={active}
          results={results}
          editing={drawer.editing}
          seqNo={drawer.editing?.seqNo ?? nextSeqNo}
          preselectedLotIds={drawer.editing === null ? defaultMatchOf(active) : []}
          onClose={() => setDrawer(null)}
          onSaved={(seqNo, edited) => {
            setDrawer(null);
            toast.show({
              variant: 'success',
              description: edited ? s.drawer.updated(seqNo) : s.drawer.added,
            });
          }}
        />
      )}
    </div>
  );
};
