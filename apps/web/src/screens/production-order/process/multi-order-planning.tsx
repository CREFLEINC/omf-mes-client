import { PlanViewSwitch } from './plan-view-switch';
import { useProductionOrderCodeNames } from '../code-names';
import { useUnreleasedWorkOrders, useWorkOrderReadiness } from './queries';
import { judgeAssign } from './process-model';
import { useRoutingOperations } from '../../routing/queries';
import { PlanConfirmDialog } from './plan-confirm-dialog';
import { PlanAddDialog } from './plan-add-dialog';
import { planQuantities } from './plan-quantities';
import { formatQty } from './process-model';
import { WorkOrderOverview, receiptWarehouseLabel } from './work-order-overview';
import { PlanCreationTools } from './plan-creation-tools';
import { BoardTable } from '../../../patterns/board-table';
import { AdjustableNativeTable } from './adjustable-table';
import { AdjustableLayout, useAdjustableOrientation } from './adjustable-layout';
import { MasterDetails } from './master-details';
import { messages } from '@omf-mes/i18n';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AlertBanner, Button, type Column, Dialog, Icon, SkeletonText, Tabs } from '@crefle/web-ui';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { ActionBar } from '../../../patterns/action-bar';
import { useApiClient } from '../../../patterns/api-context';
import { plantToday } from '../../../patterns/plant-time';
import { Select } from '../../../patterns/select';
import { useProductionPlanEditorSession } from '../../production-plan/editor-session';
import type {
  NewProductionPlanDefaults,
  ProductionPlanEditorStateRow,
} from '../../production-plan/editor-state';
import { validateProductionPlanDraft } from '../../production-plan/editor-model';
import {
  useBomReferenceQuery,
  useRoutingReferenceQuery,
  useProductionLineReferenceQuery,
} from '../../production-plan/reference-queries';
import { useProductionOrderByNumber } from '../worklist-queries';
import { useItemCodeNames } from '../item-lookups';
import { useUomReferenceLookup } from '../reference-lookups';
import { invalidateFlow, apiErrorText } from '../release-runner';
import { worklistPath } from '../worklist-filters';
import type { ProductionOrderFact } from '../types';
import { automaticBomId, automaticRoutingId } from './master-step';
import { PlanStep, type PlanLine } from './plan-step';
import { deletePlan, runPlanStep } from './plan-runner';
import { manualPlanDefaults } from './manual-plan-defaults';
import { DistributionControls } from './distribution-controls';

import { LeaveGuard, DiscardDialog } from './leave-guard';
import { ProcessWorkspace } from './process-screen';

type Editor = ReturnType<typeof useProductionPlanEditorSession>;
interface Controller {
  order: ProductionOrderFact;
  item: string;
  itemCode: string;
  itemName: string;
  itemGroupCode: string | null;
  unit: string;
  decimalScale?: number;
  editor: Editor;
  defaults: NewProductionPlanDefaults;
  lines: PlanLine[];
  ready: boolean;
  releaseReady: boolean;
  operations: string[];
  bomId: string;
  routingId: string;
  locked: boolean;
  bomOptions: { value: string; label: string }[];
  routingOptions: { value: string; label: string; isDefault?: boolean; period?: string }[];
  onRoutingChange: (value: string) => void;
}

const ErpWorkOrderList = ({
  entries,
  selected,
  disabled,
  showReadiness = false,
  onSelect,
}: {
  entries: Controller[];
  selected: string;
  disabled: boolean;
  showReadiness?: boolean;
  onSelect: (value: string) => void;
}) => {
  const side = useAdjustableOrientation() === 'side';
  const columns: Column<Controller>[] = [
    {
      key: 'number',
      header: 'ERP W/O',
      width: '168px',
      render: (entry) => entry.order.productionOrderNo,
    },
    ...(entries.some(
      (entry) => entry.order.erpOrderNo && entry.order.erpOrderNo !== entry.order.productionOrderNo,
    )
      ? [
          {
            key: 'erpNo',
            header: 'ERP 원번호',
            width: '168px',
            render: (entry: Controller) => entry.order.erpOrderNo || '—',
          },
        ]
      : []),
    { key: 'itemCode', header: '품목 코드', width: '136px', render: (entry) => entry.itemCode },
    { key: 'itemName', header: '품목명', width: '220px', render: (entry) => entry.itemName },
    ...(entries.some((entry) => entry.itemGroupCode)
      ? [
          {
            key: 'itemGroup',
            header: '품목그룹',
            width: '112px',
            render: (entry: Controller) => entry.itemGroupCode || '—',
          },
        ]
      : []),
    {
      key: 'quantity',
      header: 'ERP W/O 수량',
      width: '112px',
      render: (entry) => `${entry.order.orderQty} ${entry.unit}`,
    },
    {
      key: 'receiptWarehouse',
      header: '생산품 입고 창고',
      width: '180px',
      render: (entry) => receiptWarehouseLabel(entry.order),
    },
    ...(entries.some((entry) => entry.order.dueDate)
      ? [
          {
            key: 'dueDate',
            header: '납기일',
            width: '112px',
            render: (entry: Controller) => entry.order.dueDate || '—',
          },
        ]
      : []),
    ...(showReadiness
      ? [
          {
            key: 'readiness',
            header: '기준 확인',
            width: '120px',
            render: (entry: Controller) => (entry.ready ? '완료' : '필요'),
          },
        ]
      : []),
  ];
  return (
    <aside className="pane po-board-pane erp-wo-order-table-pane" aria-label="ERP W/O 목록">
      <h2 className="pane-title">
        ERP W/O 목록 <span className="field-note">{entries.length}건</span>
      </h2>
      <BoardTable
        label="ERP W/O 목록"
        columns={side ? columns.slice(0, 1) : columns}
        rows={entries}
        getRowId={(entry) => entry.order.productionOrderNo}
        widthKey={`omf-mes:work-planning:erp-wo-list-columns:v2:${side ? 'side' : 'stack'}`}
        minWidth={side ? '10.5rem' : '72rem'}
        className="erp-wo-order-table"
        pick={{
          columnKey: 'number',
          currentId: selected,
          label: (entry) => `${entry.order.productionOrderNo} 선택`,
          canPick: () => !disabled,
          onPick: (entry) => {
            if (!disabled) onSelect(entry.order.productionOrderNo);
          },
        }}
      />
    </aside>
  );
};

const ErpWorkOrderInformation = ({
  entry,
  showReadiness = false,
}: {
  entry: Controller;
  showReadiness?: boolean;
}) => {
  const orientation = useAdjustableOrientation();
  if (orientation === 'stack') return null;
  return (
    <section className="erp-wo-order-information" aria-label="현재 ERP W/O 정보">
      <h2 className="pane-title">ERP W/O 상세</h2>
      <WorkOrderOverview
        order={entry.order}
        item={{
          itemCode: entry.itemCode,
          itemName: entry.itemName,
          erpItemGroupCode: entry.itemGroupCode,
        }}
        unitLabel={entry.unit}
      />
      {showReadiness && (
        <dl className="erp-wo-readiness">
          <div>
            <dt>기준 확인</dt>
            <dd>{entry.ready ? '완료' : '필요'}</dd>
          </div>
        </dl>
      )}
    </section>
  );
};

const OrderSession = ({
  number,
  publish,
}: {
  number: string;
  publish: (id: string, value: Controller) => void;
}) => {
  const order = useProductionOrderByNumber(number);
  if (order.isPending) return <SkeletonText lines={2} />;
  if (order.isError || !order.data)
    return (
      <AlertBanner
        variant="error"
        title={`${number} 조회 실패`}
        action={<Button onClick={() => void order.refetch()}>다시 조회</Button>}
      />
    );
  return <ReadyOrderSession order={order.data} publish={publish} />;
};

const ReadyOrderSession = ({
  order,
  publish,
}: {
  order: ProductionOrderFact;
  publish: (id: string, value: Controller) => void;
}) => {
  const editor = useProductionPlanEditorSession(order.productionOrderId);
  const boms = useBomReferenceQuery(order.itemId);
  const routings = useRoutingReferenceQuery(
    order.itemId,
    !editor.rows.some((row) => row.confirmed),
  );
  const lines = useProductionLineReferenceQuery(order.plantId);
  const item = useItemCodeNames([order.itemId]).get(order.itemId);
  const units = useUomReferenceLookup();
  const codeNames = useProductionOrderCodeNames();
  const revisionLabels = JSON.stringify(
    [...(boms.data?.items ?? []), ...(routings.data?.items ?? [])].map((item) =>
      codeNames.masterVersionStatus(item.statusCode),
    ),
  );

  const unit = units.entries.find((entry) => entry.value === String(order.uomId))?.label ?? '';
  const decimalScale = units.decimalScaleOf?.(order.uomId);
  const [routing, setRouting] = useState<string | null>(null);
  const first = editor.rows[0];
  const draftBomId = String(automaticBomId(boms.data?.items ?? []) ?? '');
  const confirmed = editor.rows.find((row) => row.confirmed);
  const bomId = confirmed?.draft.bomId ?? draftBomId;
  useEffect(() => {
    if (boms.isPending || boms.isError) return;
    editor.rows
      .filter((row) => !row.confirmed && !row.isPending && row.draft.bomId !== draftBomId)
      .forEach((row) => editor.change(row.key, 'bomId', draftBomId));
  }, [draftBomId, editor.rows, editor.change, boms.isPending, boms.isError]);
  const routingId =
    routing ??
    first?.draft.routingId ??
    String(automaticRoutingId(routings.data?.items ?? []) ?? '');
  const itemLabel = item ? `${item.itemName} (${item.itemCode})` : order.productionOrderNo;
  const locked = editor.rows.some((row) => row.confirmed);
  const rows = editor.rows;
  const unreleased = useUnreleasedWorkOrders(order.productionOrderId);
  const readiness = useWorkOrderReadiness(unreleased.data);
  const releaseReady = judgeAssign(
    {
      loading: unreleased.isPending || readiness === undefined,
      pending: unreleased.data?.length ?? 0,
      blocked: readiness?.filter((row) => !row.ready).length ?? 0,
      unsaved: null,
      firstBlocked: null,
    },
    '배포 확인',
  ).complete;
  const operations = useRoutingOperations(routingId ? Number(routingId) : null);
  const operationNames = (operations.data?.items ?? []).map((operation) => operation.operationName);

  const ready =
    editor.isHydrated &&
    !boms.isPending &&
    !routings.isPending &&
    !boms.isError &&
    !routings.isError &&
    !lines.isError &&
    (locked ||
      (boms.data?.items.some((item) => String(item.bomId) === bomId) === true &&
        routings.data?.items.some((item) => String(item.routingId) === routingId) === true)) &&
    !!lines.data;
  const defaults = manualPlanDefaults(
    order,
    rows,
    (lines.data?.items ?? [])
      .filter((line) => line.isActive)
      .map((line) => ({ id: line.productionLineId, code: line.lineCode, name: line.lineName })),
    { bomId: draftBomId, routingId },
    plantToday(),
  );
  useEffect(() => {
    publish(order.productionOrderNo, {
      order,
      item: itemLabel,
      itemCode: item?.itemCode ?? '—',
      itemName: item?.itemName ?? '—',
      itemGroupCode: item?.erpItemGroupCode ?? null,
      unit,
      decimalScale,
      editor,
      defaults,
      lines: (lines.data?.items ?? [])
        .filter((line) => line.isActive)
        .map((line) => ({ id: line.productionLineId, code: line.lineCode, name: line.lineName })),
      ready,
      releaseReady,
      operations: operationNames,
      bomId,
      routingId,
      locked,
      bomOptions: (boms.data?.items ?? []).map((item) => ({
        value: String(item.bomId),
        label: messages.erpWorkOrderFlow.process.master.revision(
          item.bomCode,
          item.bomVersion,
          codeNames.masterVersionStatus(item.statusCode),
        ),
      })),
      routingOptions: (routings.data?.items ?? []).map((item) => ({
        value: String(item.routingId),
        label: messages.erpWorkOrderFlow.process.master.revision(
          item.routingCode,
          item.routingVersion,
          codeNames.masterVersionStatus(item.statusCode),
        ),
        isDefault: item.isDefault,
        period: messages.erpWorkOrderFlow.process.master.effective(
          item.effectiveFrom ?? '',
          item.effectiveTo ?? messages.erpWorkOrderFlow.process.master.periodOpen,
        ),
      })),
      onRoutingChange: (value) => {
        setRouting(value);
        rows
          .filter((row) => !row.confirmed)
          .forEach((row) => editor.change(row.key, 'routingId', value));
      },
    });
  }, [
    order,
    itemLabel,
    item?.itemCode,
    item?.itemName,
    item?.erpItemGroupCode,
    unit,
    decimalScale,
    rows,
    editor.isHydrated,
    bomId,
    draftBomId,
    routingId,
    ready,
    releaseReady,
    revisionLabels,
    operations.data,
    lines.data,
    boms.data,
    routings.data,
    publish,
  ]);
  if (boms.isError || routings.isError || lines.isError)
    return <AlertBanner variant="error" title={`${order.productionOrderNo} 기준 정보 조회 실패`} />;
  return null;
};

export const MultiOrderPlanning = ({ orderNumbers }: { orderNumbers: string[] }) => {
  const { client } = useApiClient();
  const codeNames = useProductionOrderCodeNames();
  const contextUnits = useUomReferenceLookup();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const remainingId = useId();
  const [executionDirty, setExecutionDirty] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [controllers, setControllers] = useState<Record<string, Controller>>({});
  const publish = useCallback(
    (id: string, value: Controller) => setControllers((current) => ({ ...current, [id]: value })),
    [],
  );
  const [stage, setStage] = useState('master');
  const [masterFocus, setMasterFocus] = useState(orderNumbers[0] ?? '');
  const [planView, setPlanView] = useState('week');
  const [distributionDirty, setDistributionDirty] = useState(false);
  const [focus, setFocus] = useState(orderNumbers[0] ?? '');
  const [addRequest, setAddRequest] = useState(0);
  const inspectSelectedPlan = useCallback((key: string) => {
    const number = key.split('::')[0];
    if (number) setFocus(number);
  }, []);
  const [requested, setRequested] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const [results, setResults] = useState<string[]>([]);
  const running = useRef(false);
  const entries = orderNumbers.flatMap((number) =>
    controllers[number] ? [controllers[number]!] : [],
  );
  const allReady = entries.length === orderNumbers.length && entries.every((entry) => entry.ready);
  const plants = new Set(entries.map((entry) => entry.order.plantId));
  const units = new Set(entries.map((entry) => entry.order.uomId));
  const target = controllers[focus];
  const combined = entries.flatMap((entry) =>
    entry.editor.rows.map((row) => ({
      ...row,
      key: `${entry.order.productionOrderNo}::${row.key}`,
    })),
  );
  const ownerOf = (key: string) => controllers[key.split('::')[0] ?? ''];
  const originalKey = (key: string) => key.slice(key.indexOf('::') + 2);
  const dirty = combined.some((row) => row.isDirty);
  const editable = combined.some((row) => !row.confirmed);
  const roundQty = (value: number) => Number(value.toFixed(6));
  const quantitiesOf = (entry: Controller) =>
    planQuantities(entry.order.orderQty, entry.order.confirmedPlanQty, entry.editor.rows);
  const confirmedOf = (entry: Controller) => quantitiesOf(entry).confirmed;
  const draftOf = (entry: Controller) => quantitiesOf(entry).draft;
  const getRemaining = (entry: Controller) => quantitiesOf(entry).remaining;
  const enough =
    allReady &&
    entries.every(
      (entry) =>
        entry.editor.rows.length > 0 &&
        entry.editor.rows.every((row) => row.confirmed) &&
        Math.abs(confirmedOf(entry) - entry.order.orderQty) < 0.0000001,
    );
  const targetOf = (entry: Controller) =>
    Number(
      requested[entry.order.productionOrderNo] ??
        roundQty(entry.order.orderQty - confirmedOf(entry)),
    );
  const toSchedule = (entry: Controller) =>
    roundQty(Math.max(0, Math.min(getRemaining(entry), targetOf(entry) - draftOf(entry))));
  const validTargets = entries.every(
    (entry) =>
      Number.isFinite(targetOf(entry)) &&
      Math.abs(
        targetOf(entry) * 10 ** (entry.decimalScale ?? 6) -
          Math.round(targetOf(entry) * 10 ** (entry.decimalScale ?? 6)),
      ) < 0.00001 &&
      targetOf(entry) >= 0 &&
      targetOf(entry) <= entry.order.orderQty - confirmedOf(entry),
  );
  const fullyAllocated =
    validTargets &&
    entries.every(
      (entry) =>
        Math.abs(draftOf(entry) - targetOf(entry)) < 0.0000001 &&
        Math.abs(confirmedOf(entry) + draftOf(entry) - entry.order.orderQty) < 0.0000001,
    );
  const confirmInputComplete = combined
    .filter((row) => !row.confirmed)
    .every(
      (row) =>
        row.draft.plannedLineId.trim() !== '' &&
        Object.keys(validateProductionPlanDraft(row.draft)).length === 0,
    );
  const save = async (doConfirm: boolean) => {
    if (running.current || !allReady) return;
    if (doConfirm && distributionDirty) {
      setResults(['분배 미리보기를 적용하거나 조건 변경을 취소하세요.']);
      return;
    }
    if (doConfirm && !confirmInputComplete) {
      setResults(['계획일, 생산 라인, 생산량, 개정을 확인하세요.']);
      return;
    }
    if (doConfirm && !fullyAllocated) {
      setResults(['ERP W/O 전량을 편성한 뒤 확정하세요.']);
      return;
    }
    const invalid = entries.flatMap((entry) =>
      entry.editor.rows
        .filter((row) => !row.confirmed)
        .flatMap((row) => {
          const errors = validateProductionPlanDraft(row.draft);
          entry.editor.setErrors(row.key, errors);
          return Object.keys(errors).length
            ? [
                `${entry.order.productionOrderNo} / ${row.planNo ?? `신규 계획 ${row.displayNo}`}: 날짜, 라인, 수량, 개정을 확인하세요.`,
              ]
            : [];
        }),
    );
    if (invalid.length) {
      setResults(invalid);
      return;
    }
    running.current = true;
    setBusy(true);
    setResults([]);
    setHasConflict(false);
    const output: string[] = [];
    let failed = false;
    try {
      for (const entry of entries) {
        const result = await runPlanStep(
          client,
          entry.editor.rows,
          { productionOrderId: entry.order.productionOrderId, uomId: entry.order.uomId },
          doConfirm,
        );
        result.saved.forEach(({ key, plan }) => entry.editor.settle(key, plan));
        result.failures.forEach((failure) => entry.editor.setErrors(failure.key, failure.errors));
        if (result.failures.length) failed = true;
        if (result.failures.some((failure) => failure.error?.kind === 'conflict'))
          setHasConflict(true);
        output.push(
          `${entry.order.productionOrderNo}: 저장 ${result.saved.length}건${doConfirm ? ` / 확정 ${result.confirmed}건` : ''}`,
        );
        result.failures.forEach((failure) =>
          output.push(
            `${entry.order.productionOrderNo} / ${failure.key}: ${failure.message ?? '입력값 확인 필요'}`,
          ),
        );
      }
    } catch (error) {
      failed = true;
      output.push(error instanceof Error ? error.message : '처리 결과를 확인하세요.');
    } finally {
      await invalidateFlow(queryClient);
      setResults(output);
      setBusy(false);
      running.current = false;
      setConfirm(false);
    }
    if (doConfirm && !failed) {
      setRequested({});
      setFocus(
        entries.find((entry) => entry.editor.rows.length > 0)?.order.productionOrderNo ?? focus,
      );
      setStage('assign');
    }
  };
  const remove = async (row: ProductionPlanEditorStateRow) => {
    const owner = ownerOf(row.key);
    if (!owner || busy) return;
    if (row.productionPlanId !== null) {
      setBusy(true);
      const error = await deletePlan(client, row.productionPlanId, row.versionNo);
      setBusy(false);
      if (error) {
        setResults([`${owner.order.productionOrderNo}: ${apiErrorText(error)}`]);
        return;
      }
    }
    owner.editor.remove(originalKey(row.key));
  };
  const [addInitialOrder, setAddInitialOrder] = useState<string>();
  const openPlanAdd = (number?: string) => {
    setAddInitialOrder(number);
    setAddRequest((current) => current + 1);
    setAddOpen(true);
  };
  const moveStage = (value: string) => {
    if (busy || value === stage) return;
    if (value === 'plan' && (!allReady || plants.size !== 1)) return;
    if ((value === 'assign' || value === 'release') && (!enough || dirty || distributionDirty))
      return;
    if (value === 'release' && (!target?.releaseReady || executionDirty)) return;
    if (executionDirty || (stage === 'plan' && distributionDirty))
      setPendingAction(() => () => {
        setExecutionDirty(false);
        setDistributionDirty(false);
        setStage(value);
      });
    else setStage(value);
  };
  return (
    <div className="erp-wo-multi-page">
      <header className="erp-wo-multi-header">
        <Button
          variant="text"
          size="sm"
          leadingIcon={<Icon name="arrow_back" size={18} />}
          onClick={() => void navigate(worklistPath())}
        >
          {messages.erpWorkOrderFlow.process.back}
        </Button>
        <div className="erp-wo-multi-title-row">
          <h1 className="page-title">{messages.erpWorkOrderFlow.process.title}</h1>
          <p>
            선택 ERP W/O <strong>{orderNumbers.length}건</strong>
          </p>
        </div>
      </header>
      <Tabs
        className="erp-wo-stage-tabs"
        value={stage}
        onChange={moveStage}

        items={[
          {
            value: 'master',
            label: `1. ${messages.erpWorkOrderFlow.process.steps.master}`,
            content: null,
          },
          {
            value: 'plan',
            label: '2. 생산계획',
            disabled: !allReady || plants.size !== 1,
            content: null,
          },
          {
            value: 'assign',
            label: '3. 4M 배정',
            disabled: !enough || dirty || distributionDirty,
            content: null,
          },
          {
            value: 'release',
            label: '4. 배포 확인',
            disabled:
              !enough || dirty || distributionDirty || executionDirty || !target?.releaseReady,
            content: null,
          },
        ]}
      />
      <div className="erp-wo-multi-body">
        {stage === 'master' && (
          <section className="erp-wo-master-workspace">
            <h2 className="section-title">{messages.erpWorkOrderFlow.process.master.heading}</h2>
            <AdjustableLayout
              storageKey="omf-mes:work-planning:erp-wo-layout"
              collapsible
              label="ERP W/O 목록과 상세"
              ratio={0.25}
              className="erp-wo-master-selection-layout"
            >
              <ErpWorkOrderList
                entries={entries}
                selected={
                  controllers[masterFocus]
                    ? masterFocus
                    : (entries[0]?.order.productionOrderNo ?? '')
                }
                disabled={busy}
                showReadiness
                onSelect={(value) => {
                  setMasterFocus(value);
                  setFocus(value);
                }}
              />
              {(() => {
                const entry = controllers[masterFocus] ?? entries[0];
                return entry ? (
                  <div
                    className="erp-wo-master-selected"
                    key={entry.order.productionOrderNo}
                    role="region"
                    aria-label="선택 ERP W/O 상세"
                  >
                    <ErpWorkOrderInformation entry={entry} showReadiness />
                    {entry.locked && (
                      <p className="field-note">
                        {messages.erpWorkOrderFlow.process.master.fixedByPlan}
                      </p>
                    )}
                    <MasterDetails
                      bomId={entry.bomId}
                      routingId={entry.routingId}
                      locked={entry.locked}
                      itemId={entry.order.itemId}
                      options={entry.routingOptions}
                      onRoutingChange={entry.onRoutingChange}
                      disabled={busy}
                    />
                  </div>
                ) : null;
              })()}
            </AdjustableLayout>
          </section>
        )}

        {stage === 'plan' && <h2 className="section-title">생산계획 편성</h2>}
        {stage === 'plan' && target && (
          <>
            <div className="erp-wo-multi-quantity-summary">
              <div className="erp-wo-multi-week-heading">
                <dl className="erp-wo-plan-totals" aria-label="선택 ERP W/O 계획 수량 요약">
                  <div>
                    <dt>선택 ERP W/O</dt>
                    <dd>{entries.length}건</dd>
                  </div>
                  {units.size === 1 ? (
                    [
                      [
                        'ERP W/O 수량',
                        entries.reduce((sum, entry) => sum + entry.order.orderQty, 0),
                      ],
                      ['확정 계획량', entries.reduce((sum, entry) => sum + confirmedOf(entry), 0)],
                      ['미확정 계획량', entries.reduce((sum, entry) => sum + draftOf(entry), 0)],
                      ['미계획 수량', entries.reduce((sum, entry) => sum + getRemaining(entry), 0)],
                    ].map(([label, value]) => (
                      <div key={String(label)}>
                        <dt>{label}</dt>
                        <dd>
                          {formatQty(roundQty(Number(value)))} {target.unit}
                        </dd>
                      </div>
                    ))
                  ) : (
                    <div>
                      <dt>계획 수량</dt>
                      <dd>단위가 달라 ERP W/O별로 표시</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
            <PlanCreationTools
              disabled={busy || !allReady || !validTargets}
              addDisabled={entries.every((entry) => getRemaining(entry) <= 0)}
              onAdd={() => openPlanAdd()}
            >
              <DistributionControls
                orders={entries.map((entry) => ({
                  id: entry.order.productionOrderNo,
                  plantId: entry.order.plantId,
                  label: `${entry.order.productionOrderNo} / ${entry.item}`,
                  unit: entry.unit,
                  decimalScale: entry.decimalScale,
                  pending: toSchedule(entry),
                  lines: entry.lines,
                  startDate: entry.defaults.planDate,
                  lineId: entry.defaults.plannedLineId,
                }))}
                existing={entries.flatMap((entry) =>
                  entry.editor.rows.map((row) => ({
                    ...row.draft,
                    owner: entry.order.productionOrderNo,
                  })),
                )}
                disabled={busy || !allReady || !validTargets}
                onDirtyChange={setDistributionDirty}
                onApply={(drafts) => {
                  entries.forEach((entry) =>
                    entry.editor.addMany(
                      drafts
                        .filter((row) => row.owner === entry.order.productionOrderNo)
                        .map((row) => ({ ...entry.defaults, ...row })),
                    ),
                  );
                  setPlanView('week');
                }}
              />
            </PlanCreationTools>
          </>
        )}
        {stage === 'plan' && (
          <details className="erp-wo-plan-quantity-settings">
            <summary>ERP W/O별 편성 수량 설정</summary>
            <section aria-label="선택 ERP W/O" className="pane erp-wo-multi-orders">
              <AdjustableNativeTable
                storageKey="omf-mes:work-planning:erp-wo-quantity-columns:v2"
                className="erp-wo-master-table"
                widths={[168, 136, 240, 128, 128, 128, 128, 144]}
                labels={[
                  'ERP W/O',
                  '품목 코드',
                  '품목명',
                  'ERP W/O 수량',
                  '확정 계획량',
                  '미확정 계획량',
                  '미계획 수량',
                  '이번 계획 수량',
                ]}
              >
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.order.productionOrderNo}>
                      <td>{entry.order.productionOrderNo}</td>
                      <td>{entry.itemCode}</td>
                      <td>{entry.itemName}</td>
                      <td>
                        {formatQty(entry.order.orderQty)} {entry.unit}
                      </td>
                      <td>
                        {formatQty(confirmedOf(entry))} {entry.unit}
                      </td>
                      <td>
                        {formatQty(draftOf(entry))} {entry.unit}
                      </td>
                      <td>
                        {formatQty(getRemaining(entry))} {entry.unit}
                      </td>
                      <td>
                        <input
                          className="erp-wo-batch-qty"
                          aria-label={`${entry.order.productionOrderNo} 이번 계획 수량`}
                          type="number"
                          min="0"
                          max={entry.order.orderQty - confirmedOf(entry)}
                          value={
                            requested[entry.order.productionOrderNo] ??
                            entry.order.orderQty - confirmedOf(entry)
                          }
                          disabled={busy}
                          onChange={(event) =>
                            setRequested((current) => ({
                              ...current,
                              [entry.order.productionOrderNo]: event.target.value,
                            }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </AdjustableNativeTable>
            </section>
          </details>
        )}
        {stage === 'plan' && entries.some((entry) => quantitiesOf(entry).excess > 0) && (
          <AlertBanner variant="error">
            {entries
              .filter((entry) => quantitiesOf(entry).excess > 0)
              .map(
                (entry) =>
                  `${entry.order.productionOrderNo}: 초과 수량 ${formatQty(quantitiesOf(entry).excess)} ${entry.unit}`,
              )
              .join(', ')}
          </AlertBanner>
        )}
        {stage === 'plan' && !validTargets && (
          <AlertBanner variant="warning">
            이번 계획 수량은 계획 가능한 수량과 단위의 소수 자릿수에 맞게 0 이상으로 입력하세요.
          </AlertBanner>
        )}
        {plants.size !== 1 && allReady && (
          <AlertBanner variant="warning">
            같은 공장의 ERP W/O를 선택하세요. 각 ERP W/O의 수량은 해당 단위로 편성합니다.
          </AlertBanner>
        )}
        {orderNumbers.map((number) => (
          <OrderSession key={number} number={number} publish={publish} />
        ))}
        {stage === 'plan' && <PlanViewSwitch value={planView} onChange={setPlanView} />}
        {stage === 'plan' && target && (
          <div className="erp-wo-multi-plan-week">
            <PlanStep
              currentOrderIds={entries.map((entry) => entry.order.productionOrderId)}
              contextUnitLabelOf={(id) =>
                contextUnits.entries.find((unit) => unit.value === String(id))?.label ?? ''
              }
              rowIdentityOf={(row) => {
                const entry = ownerOf(row.key);
                return {
                  orderNo: entry?.order.productionOrderNo ?? '—',
                  itemCode: entry?.itemCode ?? '—',
                  itemName: entry?.itemName ?? '—',
                };
              }}
              hideTools
              hideHeading
              addRequest={addRequest}
              onSelectedKeyChange={inspectSelectedPlan}
              rows={combined}
              planGroups={entries.map((entry) => ({
                id: entry.order.productionOrderNo,
                orderNo: entry.order.productionOrderNo,
                itemCode: entry.itemCode,
                itemName: entry.itemName,
                rowKeys: entry.editor.rows.map(
                  (row) => `${entry.order.productionOrderNo}::${row.key}`,
                ),
                addDisabled: getRemaining(entry) <= 0,
                onAdd: () => openPlanAdd(entry.order.productionOrderNo),
                summary: (
                  <dl className="erp-wo-plan-totals erp-wo-plan-group-totals">
                    {[
                      ['ERP W/O 수량', entry.order.orderQty],
                      ['확정 계획량', confirmedOf(entry)],
                      ['미확정 계획량', draftOf(entry)],
                      ['미계획 수량', getRemaining(entry)],
                    ].map(([label, value]) => (
                      <div key={String(label)}>
                        <dt>{label}</dt>
                        <dd>
                          {formatQty(Number(value))} {entry.unit}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ),
              }))}
              viewMode={planView === 'week' ? 'week' : 'grid'}
              orderQty={
                units.size === 1 ? entries.reduce((sum, entry) => sum + entry.order.orderQty, 0) : 0
              }
              hideTotals
              hideBoardTotal={units.size !== 1}
              uomLabel={units.size === 1 ? target.unit : ''}
              plantId={target.order.plantId}
              lines={[
                ...new Map(
                  entries.flatMap((entry) => entry.lines).map((line) => [line.id, line]),
                ).values(),
              ]}
              rowUomLabelOf={(row) => ownerOf(row.key)?.unit ?? ''}
              rowDecimalScaleOf={(row) => ownerOf(row.key)?.decimalScale}
              orderContextOf={(row) => {
                const entry = ownerOf(row.key);
                return entry ? (
                  <dl
                    className="erp-wo-selected-item-fields erp-wo-plan-owner"
                    aria-label="선택 계획 ERP W/O"
                  >
                    <div>
                      <dt>ERP W/O</dt>
                      <dd>{entry.order.productionOrderNo}</dd>
                    </div>
                    <div>
                      <dt>품목 코드</dt>
                      <dd>{entry.itemCode}</dd>
                    </div>
                    <div>
                      <dt>품목명</dt>
                      <dd>{entry.itemName}</dd>
                    </div>
                    <div>
                      <dt>BOM</dt>
                      <dd>
                        {entry.bomOptions
                          .find((option) => option.value === row.draft.bomId)
                          ?.label.replace(/\bRev\.?\s*/g, '개정 ') ?? '개정 확인 필요'}
                      </dd>
                    </div>
                    <div>
                      <dt>Routing</dt>
                      <dd>
                        {entry.routingOptions
                          .find((option) => option.value === row.draft.routingId)
                          ?.label.replace(/\bRev\.?\s*/g, '개정 ') ?? '개정 확인 필요'}
                      </dd>
                    </div>
                  </dl>
                ) : null;
              }}
              orderNameOf={(row) => {
                const entry = ownerOf(row.key);
                return `${entry?.order.productionOrderNo ?? ''} / ${entry?.item ?? ''}`;
              }}
              statusNameOf={codeNames.productionPlanStatus}
              disabled={busy}
              failures={[]}
              addDisabled={entries.every((entry) => getRemaining(entry) <= 0)}
              onAdd={() => openPlanAdd()}
              onChange={(key, field, value) =>
                ownerOf(key)?.editor.change(originalKey(key), field, value)
              }
              rowPlantIdOf={(row) => ownerOf(row.key)?.order.plantId ?? null}
              onSplit={(row, qty) =>
                ownerOf(row.key)?.editor.splitMany(
                  originalKey(row.key),
                  qty,
                  ownerOf(row.key)?.decimalScale,
                )
              }
              onRemove={(row) => void remove(row)}
            />
          </div>
        )}
        {(stage === 'assign' || stage === 'release') && (
          <section className="erp-wo-multi-execution">
            <AdjustableLayout
              storageKey="omf-mes:work-planning:erp-wo-layout"
              collapsible
              label="ERP W/O 목록과 상세"
              ratio={0.25}
              className="erp-wo-master-selection-layout erp-wo-execution-selection-layout"
            >
              <ErpWorkOrderList
                entries={entries}
                selected={focus}
                disabled={busy}
                onSelect={(value) => {
                  if (value === focus) return;
                  const select = () => {
                    setExecutionDirty(false);
                    setFocus(value);
                    setMasterFocus(value);
                  };
                  if (executionDirty) setPendingAction(() => select);
                  else select();
                }}
              />
              <div
                className="erp-wo-execution-selected"
                role="region"
                aria-label="선택 ERP W/O 상세"
              >
                {target && <ErpWorkOrderInformation entry={target} />}
                {target && (
                  <ProcessWorkspace
                    key={`${focus}-${stage}`}
                    order={target.order}
                    initialStep={stage}
                    onDirtyChange={setExecutionDirty}
                    onStepChange={(value) => {
                      setStage(value);
                    }}
                  />
                )}
              </div>
            </AdjustableLayout>
          </section>
        )}
        {results.length > 0 && (
          <section className="pane" aria-label="계획 처리 결과">
            <h2 className="section-title">처리 결과</h2>
            {hasConflict && (
              <Button
                variant="outlined"
                disabled={busy}
                onClick={() =>
                  setPendingAction(() => () => {
                    entries.forEach((entry) => entry.editor.discard());
                    setResults([]);
                    setHasConflict(false);
                  })
                }
              >
                최신 계획 다시 불러오기
              </Button>
            )}
            <ul>
              {results.map((result, index) => (
                <li key={index}>{result}</li>
              ))}
            </ul>
            <p className="field-note">
              ERP W/O와 계획별 순차 처리입니다. 일부 실패 시 완료된 계획은 유지되며, 실패 사유를
              확인한 뒤 다시 처리하세요.
            </p>
          </section>
        )}
      </div>
      {(stage === 'master' || stage === 'plan') && (
        <ActionBar
          remainingId={remainingId}
          remaining={
            busy
              ? '계획 처리 중'
              : !allReady
                ? '모든 ERP W/O의 BOM과 Routing 선택 및 조회를 완료하세요.'
                : plants.size !== 1
                  ? '같은 공장의 ERP W/O를 선택하세요.'
                  : stage === 'master'
                    ? '개정을 확인한 후 생산계획으로 이동하세요.'
                    : distributionDirty
                      ? '분배 미리보기를 적용하거나 조건 변경을 취소하세요.'
                      : !validTargets
                        ? '이번 계획 수량은 계획 가능한 수량과 단위의 소수 자릿수에 맞게 입력하세요.'
                        : !fullyAllocated && editable
                          ? 'ERP W/O별 미계획 수량을 모두 편성하세요.'
                          : dirty
                            ? '미저장 계획이 있습니다.'
                            : !editable && !enough
                              ? planView === 'grid'
                                ? ''
                                : '계획 추가 또는 자동 분배로 편성하세요.'
                              : !confirmInputComplete && editable
                                ? '계획일, 생산 라인, 생산량, 개정을 확인하세요.'
                                : enough && !editable
                                  ? '확정된 계획의 4M 배정을 진행하세요.'
                                  : '편성 내용을 확인하세요.'
          }
          leading={
            <>
              {stage === 'plan' && dirty ? (
                <Button
                  variant="outlined"
                  disabled={busy || !dirty || !allReady}
                  onClick={() => void save(false)}
                >
                  계획 저장
                </Button>
              ) : undefined}
            </>
          }
        >
          {stage === 'master' ? (
            <Button
              aria-describedby={remainingId}
              disabled={!allReady || plants.size !== 1}
              onClick={() => setStage('plan')}
            >
              다음: 생산계획
            </Button>
          ) : (
            <>
              <Button variant="outlined" disabled={busy} onClick={() => moveStage('master')}>
                이전
              </Button>
              {editable ? (
                <Button
                  aria-describedby={remainingId}
                  disabled={
                    busy ||
                    !allReady ||
                    !fullyAllocated ||
                    !confirmInputComplete ||
                    distributionDirty
                  }
                  onClick={() => setConfirm(true)}
                >
                  계획 확정 후 4M 배정
                </Button>
              ) : enough ? (
                <Button
                  aria-describedby={remainingId}
                  disabled={busy || dirty || distributionDirty}
                  onClick={() => setStage('assign')}
                >
                  4M 배정으로
                </Button>
              ) : null}
            </>
          )}
        </ActionBar>
      )}
      {(stage === 'master' || stage === 'plan') && <LeaveGuard when={dirty || distributionDirty} />}
      {pendingAction && (
        <DiscardDialog
          onCancel={() => setPendingAction(null)}
          onConfirm={() => {
            pendingAction();
            setPendingAction(null);
          }}
        />
      )}
      {addOpen && (
        <PlanAddDialog
          initialOrder={addInitialOrder}
          targets={entries.map((entry) => ({
            id: entry.order.productionOrderNo,
            plantId: entry.order.plantId,
            label: `${entry.order.productionOrderNo} / ${entry.item}`,
            remaining: getRemaining(entry),
            unit: entry.unit,
            decimalScale: entry.decimalScale,
            defaults: entry.defaults,
            lines: entry.lines,
          }))}
          onClose={() => setAddOpen(false)}
          onAdd={(number, draft) => {
            const entry = controllers[number];
            if (!entry || Number(draft.plannedQty) > getRemaining(entry)) return;
            entry.editor.add(draft);
            setFocus(number);
            setAddOpen(false);
          }}
        />
      )}
      {confirm && (
        <PlanConfirmDialog
          plans={combined
            .filter((row) => !row.confirmed)
            .map(
              (row) =>
                `${ownerOf(row.key)?.order.productionOrderNo} / ${row.planNo ?? `신규 계획 ${row.displayNo}`}`,
            )}
          operations={[]}
          groups={entries.map((entry) => ({
            orderNo: entry.order.productionOrderNo,
            plans: entry.editor.rows
              .filter((row) => !row.confirmed)
              .map((row) => row.planNo ?? `신규 계획 ${row.displayNo}`),
            operations: entry.operations,
          }))}
          running={busy}
          onCancel={() => setConfirm(false)}
          onConfirm={() => void save(true)}
        />
      )}
    </div>
  );
};
