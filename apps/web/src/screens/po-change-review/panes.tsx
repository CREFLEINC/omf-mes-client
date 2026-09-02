import {
  AlertBanner,
  Chip,
  type Column,
  EmptyState,
  Radio,
  RadioGroup,
  SkeletonText,
  Table,
  TextArea,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { lookupDisplayLabel, type LookupSource } from '../../patterns/lookup-display';
import { reasonError, REASON_MAX, type DecisionCode, type DecisionDraft } from './decision';
import type { AffectedWorkOrder, ChangeNotification } from './types';

const t = messages.poChangeReview;

/* ── ① 변경 알림 목록 ───────────────────────────────────────────────────── */

export interface NotificationListProps {
  rows: ChangeNotification[];
  selectedId: number | null;
  isLoading: boolean;
  error: ReactNode;
  onSelect: (productionOrderId: number) => void;
}

/**
 * ① 변경 알림 목록.
 *
 * ⚠ **「변경 항목」 열이 비어 있다** — 그 값을 담아 내릴 계약 자리가 생성물에 아직 반영되지
 * 않았다. **만들지 않은 것이 아니라 아직 안 오는 것**이라 그 사실을 적는다(G-9).
 */
export const NotificationList = ({
  rows,
  selectedId,
  isLoading,
  error,
  onSelect,
}: NotificationListProps) => {
  const columns: Column<ChangeNotification>[] = [
    {
      key: 'productionOrderNo',
      header: t.list.fields.productionOrderNo,
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-label={t.list.selectRow(row.productionOrderNo)}
          aria-current={row.productionOrderId === selectedId ? 'true' : undefined}
          onClick={() => onSelect(row.productionOrderId)}
        >
          {row.productionOrderNo}
        </button>
      ),
    },
    {
      key: 'changedFields',
      header: t.list.fields.changedFields,
      /* ⚠ 지어내지 않는다 — 아직 안 오는 값이다. 사유는 표 머리 배너가 진다. */
      render: () => '—',
    },
    {
      key: 'acknowledged',
      header: t.list.fields.acknowledged,
      render: (row) =>
        row.acknowledgedAt === null ? (
          <Chip status="warning">{t.list.unacknowledgedChip}</Chip>
        ) : (
          <Chip>{t.list.acknowledgedChip}</Chip>
        ),
    },
  ];

  if (error !== null && error !== undefined) return error;

  if (isLoading) {
    return (
      <div role="status" aria-label={t.list.loading}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  return (
    <>
      <div className="banner-slot">
        <AlertBanner variant="info">{t.diff.pendingContract}</AlertBanner>
      </div>
      <Table
        density="compact"
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.productionOrderId)}
        empty={
          <EmptyState size="sm" live title={t.list.empty} description={t.list.emptyDescription} />
        }
      />
    </>
  );
};

/* ── ② 무엇이 바뀌었나 ─────────────────────────────────────────────────── */

export interface DiffPaneProps {
  selected: ChangeNotification | null;
  uoms: LookupSource;
}

/**
 * ② 무엇이 바뀌었나 — 2열 비교.
 *
 * ⛔ **구획을 접지 않는다**(설계 지시). 계약이 반영되면 `DiffRow` 에 `label`·`beforeText`·
 * `afterText` 가 1:1로 꽂히므로 **자리를 그대로 세워 두고** 지금은 「아직 안 온다」를 적는다.
 *
 * ⚠ **간접 비교로 채우지 않는다** — W/O 수량으로 견주면 **수량만** 되고 납기·중단을 말하지
 * 못해 세 행 중 둘이 빈다. 「계약이 늦으면 비워 두는 편이 낫다」가 설계의 지시다.
 */
export const DiffPane = ({ selected, uoms }: DiffPaneProps) => (
  <section className="pane" aria-label={t.panes.diff}>
    <h2>{t.panes.diff}</h2>
    {selected === null ? (
      <EmptyState size="sm" title={t.diff.selectFirst} />
    ) : (
      <>
        {/* 지금 확실히 아는 것 하나 — 변경 «후» 값이다. 왼쪽(기존)은 아직 못 받는다. */}
        <dl className="filter-bar">
          <div className="field-cell">
            <dt className="field-label">{t.diff.columns.after}</dt>
            <dd>
              {String(selected.orderQty)} {lookupDisplayLabel(uoms, selected.uomId)}
            </dd>
          </div>
        </dl>
        <div className="banner-slot">
          <AlertBanner variant="info">{t.diff.pendingContract}</AlertBanner>
        </div>
      </>
    )}
  </section>
);

/* ── ③ 영향 받는 W/O ───────────────────────────────────────────────────── */

export interface WorkOrderPaneProps {
  rows: AffectedWorkOrder[];
  isLoading: boolean;
  isError: boolean;
  hasSelection: boolean;
  overProduced: readonly AffectedWorkOrder[];
  changedQty: number | null;
}

/**
 * ③ 영향 받는 W/O.
 *
 * ⚠ **실적을 못 받은 것과 0인 것을 가른다**(G-9) — 0으로 접으면 「아직 안 만든 W/O」로 보여
 * 「이미 생산됨」 경고가 사라진다. 반영하면 계획이 실적보다 작아지는 바로 그 경우다.
 */
export const WorkOrderPane = ({
  rows,
  isLoading,
  isError,
  hasSelection,
  overProduced,
  changedQty,
}: WorkOrderPaneProps) => {
  const columns: Column<AffectedWorkOrder>[] = [
    {
      key: 'workOrderNo',
      header: t.workOrders.fields.workOrderNo,
      render: (row) => row.workOrderNo,
    },
    {
      key: 'qty',
      header: t.workOrders.fields.qty,
      align: 'end',
      render: (row) => String(row.orderQty),
    },
    { key: 'status', header: t.workOrders.fields.status, render: (row) => row.statusCode },
    {
      key: 'produced',
      header: t.workOrders.fields.produced,
      align: 'end',
      render: (row) =>
        row.producedQty === null ? (
          messages.common.reference.unknown
        ) : row.producedQty > 0 ? (
          <Chip status="warning">{`${String(row.producedQty)} ${t.workOrders.alreadyProduced}`}</Chip>
        ) : (
          String(row.producedQty)
        ),
    },
    {
      key: 'mismatch',
      header: t.workOrders.fields.mismatch,
      render: (row) =>
        row.poMismatch ? <Chip status="error">{t.workOrders.mismatchChip}</Chip> : null,
    },
  ];

  return (
    <section className="pane" aria-label={t.panes.workOrders}>
      <h2>{t.panes.workOrders}</h2>
      {!hasSelection ? (
        <EmptyState size="sm" title={t.diff.selectFirst} />
      ) : isError ? (
        <AlertBanner variant="error">{t.workOrders.loadFailed}</AlertBanner>
      ) : isLoading ? (
        <div role="status" aria-label={t.workOrders.loading}>
          <SkeletonText lines={3} />
        </div>
      ) : (
        <>
          <Table
            density="compact"
            columns={columns}
            rows={rows}
            getRowId={(row) => String(row.workOrderId)}
            empty={<EmptyState size="sm" title={t.workOrders.empty} />}
          />
          {/* ⚠ 막지 않고 경고한다(A-9 ⓑ) — 반영이 업무적으로 옳을 수 있고 그것은 관리자가 안다. */}
          {overProduced.length > 0 && changedQty !== null && (
            <div className="banner-slot">
              <AlertBanner variant="warning">
                {t.workOrders.producedOverWarning(
                  String(Math.max(...overProduced.map((one) => one.producedQty ?? 0))),
                  String(changedQty),
                )}
              </AlertBanner>
            </div>
          )}
        </>
      )}
    </section>
  );
};

/* ── ④ 판정 ────────────────────────────────────────────────────────────── */

export interface DecisionPaneProps {
  draft: DecisionDraft;
  showError: boolean;
  warnings: { mismatch: boolean; applyWithoutAdjustment: boolean };
  onChange: (patch: Partial<DecisionDraft>) => void;
}

/**
 * ④ 판정 — 반영 / 강행.
 *
 * ⛔ **강행 사유는 화면이 막는다** — DB 는 강제하지 않는다(§6). 나중에 이 판단의 근거가 되는
 * 유일한 글이라 비워 보내면 「왜 어긋난 채 두었나」에 답할 것이 남지 않는다.
 *
 * ⭐ **파급을 저장 «전»에 말한다**(G-19) — 강행하면 불일치 표식이 남고, 반영해도 조정을 못
 * 보내는 동안에는 같은 표식이 남는다.
 */
export const DecisionPane = ({ draft, showError, warnings, onChange }: DecisionPaneProps) => {
  const labelId = useId();

  return (
    <section className="pane" aria-label={t.panes.decision}>
      <h2>{t.panes.decision}</h2>

      <div className="field-cell" role="group" aria-label={t.decision.label}>
        <span className="field-label" id={labelId}>
          {t.decision.label}
        </span>
        <RadioGroup
          name="po-change-decision"
          value={draft.decision ?? ''}
          aria-labelledby={labelId}
          onChange={(next) => onChange({ decision: next as DecisionCode })}
        >
          <Radio value="APPLY">{t.decision.apply}</Radio>
          <Radio value="PROCEED">{t.decision.proceed}</Radio>
        </RadioGroup>
      </div>

      {draft.decision === 'PROCEED' && (
        <>
          <TextArea
            label={t.decision.reasonLabel}
            value={draft.reason}
            required
            fullWidth
            rows={3}
            maxLength={REASON_MAX}
            error={showError ? reasonError(draft) : undefined}
            helperText={t.decision.reasonHelp}
            onChange={(event) => onChange({ reason: event.target.value })}
          />
          <div className="banner-slot">
            <AlertBanner variant="warning">{t.decision.proceedNote}</AlertBanner>
          </div>
        </>
      )}

      {warnings.applyWithoutAdjustment && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.decision.applyWithoutAdjustment}</AlertBanner>
        </div>
      )}

      {/* A-11 — 아직 못 보내는 것을 못 보낸다고 적는다. 자리는 여기다. */}
      <p className="field-note">{t.withdrawn.adjustment}</p>
      <p className="field-note">{t.withdrawn.cancelFollowUp}</p>
    </section>
  );
};
