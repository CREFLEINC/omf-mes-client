import { MasterDetails } from './master-details';
import { messages } from '@omf-mes/i18n';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AlertBanner, Button, Dialog, SkeletonText, Tabs, TextField } from '@crefle/web-ui';
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
import { DistributionControls } from './distribution-controls';

import { LeaveGuard, DiscardDialog } from './leave-guard';
import { ProcessWorkspace } from './process-screen';

type Editor = ReturnType<typeof useProductionPlanEditorSession>;
interface Controller {
  order: ProductionOrderFact;
  item: string;
  itemCode: string;
  itemName: string;
  unit: string;
  decimalScale?: number;
  editor: Editor;
  defaults: NewProductionPlanDefaults;
  lines: PlanLine[];
  ready: boolean;
  bomId: string;
  routingId: string;
  locked: boolean;
  bomOptions: { value: string; label: string }[];
  routingOptions: { value: string; label: string; isDefault?: boolean; period?: string }[];
  onRoutingChange: (value: string) => void;
}

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
  const defaults: NewProductionPlanDefaults = {
    planDate: plantToday(),
    plannedQty: '1',
    bomId: draftBomId,
    routingId,
  };
  useEffect(() => {
    publish(order.productionOrderNo, {
      order,
      item: itemLabel,
      itemCode: item?.itemCode ?? '—',
      itemName: item?.itemName ?? '—',
      unit,
      decimalScale,
      editor,
      defaults,
      lines: (lines.data?.items ?? [])
        .filter((line) => line.isActive)
        .map((line) => ({ id: line.productionLineId, code: line.lineCode, name: line.lineName })),
      ready,
      bomId,
      routingId,
      locked,
      bomOptions: (boms.data?.items ?? []).map((item) => ({
        value: String(item.bomId),
        label: `${item.bomCode} (Rev ${item.bomVersion})`,
      })),
      routingOptions: (routings.data?.items ?? []).map((item) => ({
        value: String(item.routingId),
        label: `${item.routingCode} (Rev ${item.routingVersion})`,
        isDefault: item.isDefault,
        period: `${item.effectiveFrom ?? '시작일 미설정'} ~ ${item.effectiveTo ?? '종료일 없음'}`,
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
    unit,
    decimalScale,
    rows,
    editor.isHydrated,
    bomId,
    draftBomId,
    routingId,
    ready,
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
  const [requested, setRequested] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addQuantity, setAddQuantity] = useState('');
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
  const confirmedOf = (entry: Controller) =>
    entry.order.confirmedPlanQty ??
    entry.editor.rows
      .filter((row) => row.confirmed)
      .reduce((sum, row) => sum + Number(row.draft.plannedQty), 0);
  const enough =
    allReady &&
    entries.every(
      (entry) =>
        entry.editor.rows.length > 0 &&
        entry.editor.rows.every((row) => row.confirmed) &&
        Math.abs(confirmedOf(entry) - entry.order.orderQty) < 0.0000001,
    );
  const roundQty = (value: number) => Number(value.toFixed(6));
  const draftOf = (entry: Controller) =>
    roundQty(
      entry.editor.rows
        .filter((row) => !row.confirmed)
        .reduce((sum, row) => sum + (Number(row.draft.plannedQty) || 0), 0),
    );
  const getRemaining = (entry: Controller) =>
    roundQty(Math.max(0, entry.order.orderQty - confirmedOf(entry) - draftOf(entry)));
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
  const save = async (doConfirm: boolean) => {
    if (running.current || !allReady) return;
    if (doConfirm && distributionDirty) {
      setResults(['분배 미리보기를 적용하거나 조건 변경을 취소하세요.']);
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
  const moveStage = (value: string) => {
    if (busy || value === stage) return;
    if ((value === 'assign' || value === 'release') && (!enough || dirty || distributionDirty))
      return;
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
      <div className="erp-wo-multi-header">
        <Button variant="text" onClick={() => void navigate(worklistPath())}>
          {messages.erpWorkOrderFlow.process.back}
        </Button>
        <h1 className="page-title">{messages.erpWorkOrderFlow.process.title}</h1>
        <p>선택 ERP W/O {orderNumbers.length}건</p>
      </div>
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
            disabled: !enough || dirty || distributionDirty,
            content: null,
          },
        ]}
      />
      <div className="erp-wo-multi-body">
        {stage === 'master' && (
          <section className="erp-wo-master-workspace">
            <h2 className="section-title">{messages.erpWorkOrderFlow.process.master.heading}</h2>
            <div className="erp-wo-master-selection-layout">
              <aside className="erp-wo-master-order-list" aria-label="ERP W/O 목록">
                {entries.map((entry) => (
                  <Button
                    key={entry.order.productionOrderNo}
                    variant="outlined"
                    disabled={busy}
                    aria-pressed={
                      (controllers[masterFocus]
                        ? masterFocus
                        : entries[0]?.order.productionOrderNo) === entry.order.productionOrderNo
                    }
                    onClick={() => setMasterFocus(entry.order.productionOrderNo)}
                  >
                    <strong>{entry.order.productionOrderNo}</strong>
                    <span className="erp-wo-item-field">
                      <span className="erp-wo-item-field-label">품목코드</span>
                      <span>{entry.itemCode}</span>
                    </span>
                    <span className="erp-wo-item-field">
                      <span className="erp-wo-item-field-label">품목명</span>
                      <span>{entry.itemName}</span>
                    </span>
                    <span>
                      {entry.order.orderQty} {entry.unit} ·{' '}
                      {entry.ready ? '기준 확인 완료' : '기준 확인 필요'}
                    </span>
                  </Button>
                ))}
              </aside>
              {(() => {
                const entry = controllers[masterFocus] ?? entries[0];
                return entry ? (
                  <div
                    className="erp-wo-master-selected"
                    key={entry.order.productionOrderNo}
                    role="region"
                    aria-label="선택 ERP W/O 상세"
                  >
                    <div className="erp-wo-master-selected-heading">
                      <strong>{entry.order.productionOrderNo}</strong>
                      <dl className="erp-wo-selected-item-fields">
                        <div>
                          <dt>품목코드</dt>
                          <dd>{entry.itemCode}</dd>
                        </div>
                        <div>
                          <dt>품목명</dt>
                          <dd>{entry.itemName}</dd>
                        </div>
                      </dl>
                    </div>
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
            </div>
          </section>
        )}

        {stage === 'plan' && (
          <Tabs
            className="erp-wo-multi-view-tabs"
            size="sm"
            aria-label="생산계획 보기"
            value={planView}
            onChange={setPlanView}
            items={[
              { value: 'week', label: '주간 편성', content: null },
              { value: 'grid', label: 'ERP W/O별 계획 수량', content: null },
            ]}
          />
        )}
        {stage === 'plan' && planView === 'grid' && (
          <section aria-label="선택 ERP W/O" className="pane erp-wo-multi-orders">
            <table className="erp-wo-master-table">
              <thead>
                <tr>
                  <th>ERP W/O</th>
                  <th>품목</th>
                  <th>ERP W/O 수량</th>
                  <th>확정 계획량</th>
                  <th>미확정 계획량</th>
                  <th>미계획 수량</th>
                  <th>이번 계획 수량</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.order.productionOrderNo}>
                    <td>{entry.order.productionOrderNo}</td>
                    <td>{entry.item}</td>
                    <td>
                      {entry.order.orderQty} {entry.unit}
                    </td>
                    <td>
                      {confirmedOf(entry)} {entry.unit}
                    </td>
                    <td>
                      {draftOf(entry)} {entry.unit}
                    </td>
                    <td>
                      {getRemaining(entry)} {entry.unit}
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
            </table>
          </section>
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
        {stage === 'plan' && target && (
          <div className="erp-wo-multi-plan-week" hidden={planView !== 'week'}>
            <div className="erp-wo-multi-week-tools">
              <div className="erp-wo-multi-week-heading">
                <p className="field-note">
                  대상 ERP W/O {entries.length}건
                  {units.size === 1
                    ? ` / 이번 계획 ${roundQty(entries.reduce((sum, entry) => sum + targetOf(entry), 0))} / 편성 ${roundQty(entries.reduce((sum, entry) => sum + draftOf(entry), 0))} / 편성 대기 ${roundQty(entries.reduce((sum, entry) => sum + toSchedule(entry), 0))} ${target.unit}`
                    : ' / ERP W/O별 수량은 ERP W/O별 계획 수량에서 확인하세요.'}
                </p>
              </div>
            </div>
            <PlanStep
              planningTools={
                <DistributionControls
                  orders={entries.map((entry) => ({
                    id: entry.order.productionOrderNo,
                    label: `${entry.order.productionOrderNo} / ${entry.item}`,
                    unit: entry.unit,
                    decimalScale: entry.decimalScale,
                    pending: toSchedule(entry),
                    lines: entry.lines,
                  }))}
                  existing={entries.flatMap((entry) =>
                    entry.editor.rows.map((row) => ({
                      ...row.draft,
                      owner: entry.order.productionOrderNo,
                    })),
                  )}
                  disabled={busy || !allReady || !validTargets}
                  onDirtyChange={setDistributionDirty}
                  onApply={(drafts) =>
                    entries.forEach((entry) =>
                      entry.editor.addMany(
                        drafts
                          .filter((row) => row.owner === entry.order.productionOrderNo)
                          .map((row) => ({ ...entry.defaults, ...row })),
                      ),
                    )
                  }
                />
              }
              rows={combined}
              viewMode="week"
              orderQty={0}
              hideTotals
              uomLabel={units.size === 1 ? target.unit : ''}
              plantId={target.order.plantId}
              lines={target.lines}
              orderNameOf={(row) => {
                const entry = ownerOf(row.key);
                return `${entry?.order.productionOrderNo ?? ''} / ${entry?.item ?? ''}`;
              }}
              statusNameOf={(code) => (code === 'CONFIRMED' ? '확정' : '미확정')}
              disabled={busy}
              failures={[]}
              addDisabled={entries.every((entry) => getRemaining(entry) <= 0)}
              onAdd={() => {
                const next =
                  entries.find((entry) => toSchedule(entry) > 0) ??
                  entries.find((entry) => getRemaining(entry) > 0);
                if (!next) return;
                setFocus(next.order.productionOrderNo);
                setAddQuantity(String(Math.max(1, toSchedule(next))));
                setAddOpen(true);
              }}
              onChange={(key, field, value) =>
                ownerOf(key)?.editor.change(originalKey(key), field, value)
              }
              onSplit={(row, qty) => ownerOf(row.key)?.editor.split(originalKey(row.key), qty)}
              onRemove={(row) => void remove(row)}
            />
          </div>
        )}
        {(stage === 'assign' || stage === 'release') && (
          <section className="erp-wo-multi-execution">
            <div className="field-cell">
              <span className="field-label">ERP W/O</span>
              <Select
                value={focus}
                options={entries.map((entry) => ({
                  value: entry.order.productionOrderNo,
                  label: `${entry.order.productionOrderNo} / ${entry.item}`,
                }))}
                onChange={(value) => {
                  if (executionDirty)
                    setPendingAction(() => () => {
                      setExecutionDirty(false);
                      setFocus(value);
                    });
                  else setFocus(value);
                }}
              />
            </div>
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
                              : enough && !editable
                                ? '확정된 계획의 4M 배정을 진행하세요.'
                                : '편성 내용을 확인하세요.'
          }
          leading={
            <>
              {stage === 'plan' && planView === 'grid' && (
                <Button variant="outlined" onClick={() => setPlanView('week')}>
                  주간 편성으로 이동
                </Button>
              )}
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
                  disabled={busy || !allReady || !fullyAllocated || distributionDirty}
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
      {addOpen && target && (
        <Dialog
          open
          title="계획 추가"
          closeOnBackdropClick={false}
          onClose={() => setAddOpen(false)}
          footer={
            <>
              <Button variant="outlined" onClick={() => setAddOpen(false)}>
                취소
              </Button>
              <Button
                aria-describedby={`${remainingId}-add`}
                disabled={
                  busy ||
                  !Number.isFinite(Number(addQuantity)) ||
                  Math.abs(
                    Number(addQuantity) * 10 ** (target.decimalScale ?? 6) -
                      Math.round(Number(addQuantity) * 10 ** (target.decimalScale ?? 6)),
                  ) > 0.00001 ||
                  Number(addQuantity) <= 0 ||
                  Number(addQuantity) > getRemaining(target)
                }
                onClick={() => {
                  target.editor.add({ ...target.defaults, plannedQty: addQuantity });
                  setAddOpen(false);
                }}
              >
                추가
              </Button>
            </>
          }
        >
          <div className="erp-wo-plan-add-form">
            <div className="field-cell">
              <span className="field-label">계획을 추가할 ERP W/O</span>
              <Select
                aria-label="계획을 추가할 ERP W/O"
                value={focus}
                options={entries
                  .filter((entry) => getRemaining(entry) > 0)
                  .map((entry) => ({
                    value: entry.order.productionOrderNo,
                    label: `${entry.order.productionOrderNo} / ${entry.item}`,
                  }))}
                onChange={(value) => {
                  setFocus(value);
                  const entry = controllers[value];
                  if (entry) setAddQuantity(String(Math.max(1, toSchedule(entry))));
                }}
              />
            </div>
            <p className="field-note">
              이번 계획 {targetOf(target)}, 편성 {draftOf(target)}, 추가 편성 가능{' '}
              {getRemaining(target)} {target.unit}
            </p>
            <TextField
              label="추가할 계획 수량"
              inputMode="numeric"
              value={addQuantity}
              onChange={(event) => setAddQuantity(event.target.value)}
            />
            <p className="field-note" id={`${remainingId}-add`}>
              추가 수량은 편성 가능한 수량 이내에서 단위 소수 자릿수에 맞게 입력하세요.
            </p>
            <p className="field-note">
              추가한 계획이 오른쪽 편집 영역에서 선택됩니다. 날짜와 라인을 지정하세요.
            </p>
          </div>
        </Dialog>
      )}
      {confirm && (
        <Dialog
          open
          title="선택 ERP W/O 계획 확정"
          onClose={() => !busy && setConfirm(false)}
          closeOnBackdropClick={false}
          footer={
            <>
              <Button variant="outlined" disabled={busy} onClick={() => setConfirm(false)}>
                취소
              </Button>
              <Button loading={busy} onClick={() => void save(true)}>
                계획 확정
              </Button>
            </>
          }
        >
          <p>
            선택 ERP W/O {entries.length}건의 미확정 계획{' '}
            {combined.filter((row) => !row.confirmed).length}건을 저장하고 확정한 뒤 Routing에 따라
            작업지시를 생성합니다.
          </p>
          <p>
            확정 후 계획은 수정할 수 없습니다. ERP W/O와 계획별로 처리하므로 일부만 완료될 수
            있습니다.
          </p>
        </Dialog>
      )}
    </div>
  );
};
