import {
  AlertBanner,
  Chip,
  type Column,
  EmptyState,
  Icon,
  Radio,
  RadioGroup,
  SkeletonText,
  Table,
  TextArea,
  TextField,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';

import { InfoTip } from '../../patterns/info-tip';
import { lookupDisplayLabel, type LookupSource } from '../../patterns/lookup-display';
import { reasonError, REASON_MAX, type DecisionCode, type DecisionDraft } from './decision';
import {
  changedFieldsSummary,
  qtyDeltaOf,
  type AffectedWorkOrder,
  type ChangedField,
  type ChangeNotification,
} from './types';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { ROW_PICK_CLASS, rowPickHandlers } from '../../patterns/row-pick';

const t = messages.poChangeReview;

/** 상세 상자 제목 — 앞에 상자 아이콘(시안 · #360). */
const PaneTitle = ({ icon, children }: { icon: string; children: ReactNode }) => (
  <h2 className="po-change-review-title">
    <Icon name={icon} size={20} aria-hidden />
    {children}
  </h2>
);

/** 원문은 연계 동기화 현황(지금 「ERP 연동 현황·이력」 첫 탭)에서 본다. */
const SOURCE_PATH = '/master-data/integration-sync';

/**
 * 작업지시 상태 칩 색 — 진행 중은 파랑, 계획은 회색(사용자 지시 · #360). 이름은 공통코드 마스터에서 받는다.
 */
const STATUS_TONE: Readonly<Record<string, 'info' | 'success' | 'warning' | 'error' | 'idle'>> = {
  IN_PROGRESS: 'info',
  RELEASED: 'info',
  COMPLETED: 'success',
  CLOSED: 'success',
  SUSPENDED: 'warning',
  CANCELLED: 'error',
};

/** 「2026-08-05T09:12:00+09:00」 → 「2026-08-05 07:12」(공장 시각 · `patterns/plant-time`) — 분까지만. 초는 판단에 쓰이지 않는다. */
const dateTimeText = (value: string): string => {
  return formatPlantDateTime(value) ?? value;
};

/* ── ① 변경 알림 목록 ───────────────────────────────────────────────────── */

export interface NotificationListProps {
  rows: ChangeNotification[];
  selectedId: number | null;
  isLoading: boolean;
  error: ReactNode;
  onSelect: (productionOrderId: number) => void;
}

/** 목록 「변경 항목」 열 — 못 받았으면 「변경 내역 없음」, 열거 밖이면 「항목 미상」(G-9). */
const changedFieldsText = (row: ChangeNotification): string => {
  const summary = changedFieldsSummary(row.lastChange);
  if (summary === null) return t.list.changedFieldsUnknown;
  return summary === '' ? t.list.changedFieldsOutOfScope : summary;
};

/**
 * ① 변경 알림 목록 — 행마다 「무엇이 몇에서 몇으로」를 `lastChange`로 그린다(§4-A).
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
      key: 'receivedAt',
      header: t.list.fields.receivedAt,
      render: (row) =>
        row.lastChange === null
          ? messages.common.reference.unknown
          : dateTimeText(row.lastChange.receivedAt),
    },
    {
      key: 'productionOrderNo',
      header: t.list.fields.productionOrderNo,
      render: (row) => (
        <button
          type="button"
          className={`link-cell ${ROW_PICK_CLASS}`}
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
      render: (row) => changedFieldsText(row),
    },
    {
      key: 'acknowledged',
      header: t.list.fields.acknowledged,
      align: 'center',
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
    /* 줄 아무 곳이나 눌러 고른다(#360) — 배치에 끼지 않는 상자(`display: contents`)가 누름만 받는다. */
    <div className="row-pick-box" {...rowPickHandlers}>
      <Table
        className="po-change-review-table po-change-review-list"
        caption={<span className="po-change-review-table-caption">{t.panes.list}</span>}
        density="compact"
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.productionOrderId)}
        empty={
          <EmptyState size="sm" live title={t.list.empty} description={t.list.emptyDescription} />
        }
      />
    </div>
  );
};

/* ── ② 무엇이 바뀌었나 ─────────────────────────────────────────────────── */

export interface DiffPaneProps {
  selected: ChangeNotification | null;
  uoms: LookupSource;
}

/** 비고 열 — 수량이면 「▼ n 감소」/「▲ n 증가」, 값이 같으면 「(동일)」, 그 밖은 빈칸. */
const noteOf = (field: ChangedField, orderQty: number): string => {
  const delta = qtyDeltaOf(field, orderQty);
  if (delta !== null && delta !== 0) {
    return delta > 0 ? t.diff.decrease(String(delta)) : t.diff.increase(String(-delta));
  }
  return field.beforeText === field.afterText ? t.diff.same : '';
};

/**
 * ② 무엇이 바뀌었나 — 2열 비교표(§3 · §4-A).
 *
 * ⛔ **화면이 코드→이름 표를 갖지 않는다** — `label`·`beforeText`·`afterText`가 계약에서 그대로
 * 온다. 화면이 더하는 것은 수량 항목의 감소량(단순 뺄셈)과 단위 표시뿐이다.
 *
 * ⚠ **간접 비교로 채우지 않는다** — 변경 내역이 안 왔으면 그 사실을 적는다(G-9). 열거 밖 항목만
 * 바뀌어 빈 배열이 오면 「항목을 낼 수 없다 — 원문은 연계 동기화 현황에서」를 적는다(§5-1).
 */
export const DiffPane = ({ selected, uoms }: DiffPaneProps) => {
  if (selected === null) {
    return (
      <section className="pane po-change-review-pane" aria-label={t.panes.diff}>
        <PaneTitle icon="description">{t.panes.diff}</PaneTitle>
        <EmptyState size="sm" title={t.diff.selectFirst} />
      </section>
    );
  }

  const change = selected.lastChange;
  const uomLabel = lookupDisplayLabel(uoms, selected.uomId);
  const withUom = (field: ChangedField, text: string): string =>
    field.field === 'ORDER_QTY' && uomLabel !== '' ? `${text} ${uomLabel}` : text;
  const columns: Column<ChangedField>[] = [
    { key: 'field', header: t.diff.columns.field, render: (row) => row.label },
    {
      key: 'before',
      header: t.diff.columns.before,
      render: (row) => withUom(row, row.beforeText),
    },
    { key: 'after', header: t.diff.columns.after, render: (row) => withUom(row, row.afterText) },
    { key: 'note', header: t.diff.columns.note, render: (row) => noteOf(row, selected.orderQty) },
  ];

  return (
    <section className="pane po-change-review-pane" aria-label={t.panes.diff}>
      <PaneTitle icon="description">{t.panes.diff}</PaneTitle>
      {change === null ? (
        <p className="iqc-inspection-action-note po-change-review-note" data-tone="info">
          <Icon name="info" size={16} aria-hidden />
          {t.diff.noLastChange}
          <span className="po-change-review-note-bar" aria-hidden="true">
            |
          </span>
          <Link to={SOURCE_PATH}>{t.diff.viewSource}</Link>
        </p>
      ) : (
        <>
          <p className="field-note">{t.diff.receivedAt(dateTimeText(change.receivedAt))}</p>
          {change.changedFields.length === 0 ? (
            <div className="banner-slot">
              <AlertBanner variant="info">{t.diff.outOfScope}</AlertBanner>
            </div>
          ) : (
            <Table
              className="po-change-review-table po-change-review-diff"
              caption={<span className="po-change-review-table-caption">{t.panes.diff}</span>}
              density="compact"
              columns={columns}
              rows={change.changedFields}
              getRowId={(row) => row.field}
            />
          )}
        </>
      )}
    </section>
  );
};

/* ── ③ 영향 받는 W/O ───────────────────────────────────────────────────── */

export interface WorkOrderPaneProps {
  rows: AffectedWorkOrder[];
  isLoading: boolean;
  isError: boolean;
  hasSelection: boolean;
  /** 상태 코드 → 표시명(공통코드 마스터). */
  statusNameOf: (code: string) => string;
  overProduced: readonly AffectedWorkOrder[];
  changedQty: number | null;
  /** 반영을 골랐을 때만 조정 수량 칸이 열린다. */
  showAdjustments: boolean;
  adjustments: Readonly<Record<string, string>>;
  adjustmentErrors: Readonly<Record<string, string>>;
  onChangeAdjustment: (workOrderId: number, value: string) => void;
}

/**
 * ③ 영향 받는 W/O — 반영이면 W/O별 조정 수량을 여기서 적는다(§5 「수량 — W/O 수량 조정 — 한 트랜잭션」).
 *
 * ⚠ **실적을 못 받은 것과 0인 것을 가른다**(G-9) — 0으로 접으면 「아직 안 만든 W/O」로 보여
 * 「이미 생산됨」 경고가 사라진다. 반영하면 계획이 실적보다 작아지는 바로 그 경우다.
 * ⛔ 판번호가 없는 W/O 는 조정할 수 없다 — 계약이 `versionNo`를 필수로 둔다. 칸을 잠그고 사유를 적는다(규범 4).
 */
export const WorkOrderPane = ({
  rows,
  isLoading,
  isError,
  hasSelection,
  statusNameOf,
  overProduced,
  changedQty,
  showAdjustments,
  adjustments,
  adjustmentErrors,
  onChangeAdjustment,
}: WorkOrderPaneProps) => {
  const columns: Column<AffectedWorkOrder>[] = [
    {
      key: 'workOrderNo',
      header: t.workOrders.fields.workOrderNo,
      render: (row) => <span className="nowrap-cell">{row.workOrderNo}</span>,
    },
    {
      key: 'qty',
      header: t.workOrders.fields.qty,
      align: 'end',
      render: (row) => String(row.orderQty),
    },
    {
      key: 'status',
      header: t.workOrders.fields.status,
      align: 'center',
      render: (row) => (
        <Chip size="sm" status={STATUS_TONE[row.statusCode] ?? 'idle'}>
          {statusNameOf(row.statusCode)}
        </Chip>
      ),
    },
    {
      key: 'produced',
      header: t.workOrders.fields.produced,
      align: 'end',
      /* 숫자만(사용자 지시 · #360) — 실적이 계획을 넘는 경우는 표 아래 경고가 말한다. */
      render: (row) =>
        row.producedQty === null ? messages.common.reference.unknown : String(row.producedQty),
    },
    {
      key: 'mismatch',
      header: t.workOrders.fields.mismatch,
      align: 'center',
      render: (row) =>
        row.poMismatch ? <Chip status="error">{t.workOrders.mismatchChip}</Chip> : '—',
    },
    ...(showAdjustments
      ? [
          {
            key: 'adjust',
            header: t.workOrders.fields.adjustQty,
            render: (row: AffectedWorkOrder) => (
              <TextField
                aria-label={t.workOrders.adjustLabel(row.workOrderNo)}
                value={adjustments[String(row.workOrderId)] ?? ''}
                inputMode="decimal"
                disabled={row.versionNo === null}
                disabledReason={row.versionNo === null ? t.workOrders.adjustLocked : undefined}
                error={adjustmentErrors[String(row.workOrderId)]}
                onChange={(event) => onChangeAdjustment(row.workOrderId, event.target.value)}
              />
            ),
          } satisfies Column<AffectedWorkOrder>,
        ]
      : []),
  ];

  return (
    <section className="pane po-change-review-pane" aria-label={t.panes.workOrders}>
      <h2 className="po-change-review-title">
        <Icon name="layers" size={20} aria-hidden />
        {hasSelection && !isError && !isLoading
          ? t.panes.workOrdersCount(rows.length)
          : t.panes.workOrders}
        {/* 조정 수량을 적는 법은 제목 옆 ⓘ 로 — 늘 펼쳐 둘 문장은 아니다(관리웹 정리 시안 A). */}
        {hasSelection && !isError && !isLoading && showAdjustments && rows.length > 0 && (
          <InfoTip text={t.workOrders.adjustHelp} />
        )}
      </h2>
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
            className="po-change-review-table"
            caption={<span className="po-change-review-table-caption">{t.panes.workOrders}</span>}
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
  /** 처리할 수 없는 건이면 그 한 줄(주황) — 상자 위에 둔다. */
  blockedNote?: string;
  /** 맨 아래 오른쪽 [처리] 단추 줄과 서버 거절 상자. */
  footer: ReactNode;
  onChange: (patch: Partial<DecisionDraft>) => void;
}

/**
 * ④ 판정 — 반영 / 강행.
 *
 * ⛔ **강행 사유는 화면이 막는다** — DB 는 강제하지 않는다(§6). 나중에 이 판단의 근거가 되는
 * 유일한 글이라 비워 보내면 「왜 어긋난 채 두었나」에 답할 것이 남지 않는다.
 *
 * ⭐ **파급을 저장 «전»에 말한다**(G-19) — 강행하면 불일치 표식이 남고, 반영인데 조정을 하나도
 * 적지 않으면 조정되지 않은 W/O 에 같은 표식이 남는다.
 */
export const DecisionPane = ({
  draft,
  showError,
  warnings,
  blockedNote,
  footer,
  onChange,
}: DecisionPaneProps) => {
  const labelId = useId();

  return (
    <>
      {/* 처리할 수 없으면 처리 방식 상자 위에 주황 한 줄만(사용자 지시 · #360). */}
      {blockedNote !== undefined && (
        <p
          className="iqc-inspection-action-note po-change-review-note"
          data-tone="warning"
          role="status"
        >
          <Icon name="warning" size={16} aria-hidden />
          {blockedNote}
        </p>
      )}
      <section className="pane po-change-review-pane" aria-label={t.panes.decision}>
        <h2 className="po-change-review-title">
          <Icon name="settings" size={20} aria-hidden />
          <span id={labelId}>{t.panes.decision}</span>
          {/* 중단·취소 반영 뒤 W/O 취소는 건별로 따로 한다는 것 — 제목 옆 ⓘ 로 둔다(관리웹 정리 시안 A). */}
          <InfoTip text={t.withdrawn.cancelFollowUp} />
        </h2>

        <RadioGroup
          name="po-change-decision"
          className="po-change-review-choices"
          value={draft.decision ?? ''}
          aria-labelledby={labelId}
          onChange={(next) => onChange({ decision: next as DecisionCode })}
        >
          {/* 이름 아래 흐린 설명 한 줄(시안 · #360) — 이름은 aria-label, 설명은 aria-describedby 로 읽힌다. */}
          <Radio value="APPLY" aria-label={t.decision.apply} aria-describedby={`${labelId}-apply`}>
            <span className="po-change-review-choice">
              {t.decision.apply}
              <small id={`${labelId}-apply`}>{t.decision.applyHint}</small>
            </span>
          </Radio>
          <Radio
            value="PROCEED"
            aria-label={t.decision.proceed}
            aria-describedby={`${labelId}-proceed`}
          >
            <span className="po-change-review-choice">
              {t.decision.proceed}
              <small id={`${labelId}-proceed`}>{t.decision.proceedHint}</small>
            </span>
          </Radio>
        </RadioGroup>

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

        {footer}
      </section>
    </>
  );
};
