import { messages } from '@omf-mes/i18n';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AlertBanner, Button, Dialog, SkeletonText, Tabs } from '@crefle/web-ui';
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
import { distributePlans } from './distribution-model';
import { LeaveGuard, DiscardDialog } from './leave-guard';
import { ProcessWorkspace } from './process-screen';

type Editor = ReturnType<typeof useProductionPlanEditorSession>;
interface Controller {
  order: ProductionOrderFact;
  item: string;
  unit: string;
  editor: Editor;
  defaults: NewProductionPlanDefaults;
  lines: PlanLine[];
  ready: boolean;
  bomId: string;
  routingId: string;
  locked: boolean;
  bomOptions: { value: string; label: string }[];
  routingOptions: { value: string; label: string }[];
  onBomChange: (value: string) => void;
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
  const [bom, setBom] = useState<string | null>(null);
  const [routing, setRouting] = useState<string | null>(null);
  const first = editor.rows[0];
  const bomId = bom ?? first?.draft.bomId ?? String(automaticBomId(boms.data?.items ?? []) ?? '');
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
    bomId,
    routingId,
  };
  useEffect(() => {
    publish(order.productionOrderNo, {
      order,
      item: itemLabel,
      unit,
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
      })),
      onBomChange: (value) => {
        setBom(value);
        rows
          .filter((row) => !row.confirmed)
          .forEach((row) => editor.change(row.key, 'bomId', value));
      },
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
    unit,
    rows,
    editor.isHydrated,
    bomId,
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
  const [planView, setPlanView] = useState('grid');
  const [focus, setFocus] = useState(orderNumbers[0] ?? '');
  const [requested, setRequested] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const running = useRef(false);
  const entries = orderNumbers.flatMap((number) =>
    controllers[number] ? [controllers[number]!] : [],
  );
  const allReady = entries.length === orderNumbers.length && entries.every((entry) => entry.ready);
  const plants = new Set(entries.map((entry) => entry.order.plantId));
  const units = new Set(entries.map((entry) => entry.order.uomId));
  const compatible = plants.size === 1 && units.size === 1;
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
  const enough =
    entries.some((entry) => entry.editor.rows.length > 0) &&
    entries.every((entry) => entry.editor.rows.every((row) => row.confirmed));
  const confirmedOf = (entry: Controller) =>
    entry.order.confirmedPlanQty ??
    entry.editor.rows
      .filter((row) => row.confirmed)
      .reduce((sum, row) => sum + Number(row.draft.plannedQty), 0);
  const draftOf = (entry: Controller) =>
    entry.editor.rows
      .filter((row) => !row.confirmed)
      .reduce((sum, row) => sum + Number(row.draft.plannedQty), 0);
  const getRemaining = (entry: Controller) =>
    Math.max(0, entry.order.orderQty - confirmedOf(entry) - draftOf(entry));
  const targetOf = (entry: Controller) =>
    Number(requested[entry.order.productionOrderNo] ?? entry.order.orderQty - confirmedOf(entry));
  const toSchedule = (entry: Controller) =>
    Math.max(0, Math.min(getRemaining(entry), targetOf(entry) - draftOf(entry)));
  const validTargets = entries.every(
    (entry) =>
      Number.isSafeInteger(targetOf(entry)) &&
      targetOf(entry) >= 0 &&
      targetOf(entry) <= entry.order.orderQty - confirmedOf(entry),
  );
  const fullyAllocated =
    validTargets && entries.every((entry) => draftOf(entry) === targetOf(entry));
  const save = async (doConfirm: boolean) => {
    if (running.current || !allReady) return;
    if (doConfirm && !fullyAllocated) {
      setResults(['이번 계획 수량과 미확정 편성 수량을 오더별로 맞춘 뒤 확정하세요.']);
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
  return (
    <div className="erp-wo-multi-page">
      <div className="erp-wo-multi-header">
        <Button variant="text" onClick={() => void navigate(worklistPath())}>
          작업지시 목록
        </Button>
        <h1 className="page-title">작업계획</h1>
        <p>선택 오더 {orderNumbers.length}건</p>
      </div>
      <Tabs
        className="erp-wo-stage-tabs"
        value={stage}
        onChange={(value) => {
          if (busy) return;
          if (executionDirty)
            setPendingAction(() => () => {
              setExecutionDirty(false);
              setStage(value);
            });
          else setStage(value);
        }}
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
          { value: 'assign', label: '3. 4M 배정', disabled: !enough || dirty, content: null },
          { value: 'release', label: '4. 배포 확인', disabled: !enough || dirty, content: null },
        ]}
      />
      <div className="erp-wo-multi-body">
        {stage === 'master' && (
          <section className="erp-wo-master-workspace">
            <h2 className="section-title">{messages.erpWorkOrderFlow.process.master.heading}</h2>
            <div className="pane erp-wo-master-board">
              <table className="erp-wo-master-table">
                <thead>
                  <tr>
                    <th>ERP W/O</th>
                    <th>품목</th>
                    <th>BOM 개정</th>
                    <th>Routing 개정</th>
                    <th>점검</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.order.productionOrderNo}>
                      <td>{entry.order.productionOrderNo}</td>
                      <td>{entry.item}</td>
                      <td>
                        <Select
                          aria-label={`${entry.order.productionOrderNo} BOM`}
                          value={entry.bomId}
                          options={entry.bomOptions}
                          disabled={busy || entry.locked}
                          onChange={entry.onBomChange}
                        />
                      </td>
                      <td>
                        <Select
                          aria-label={`${entry.order.productionOrderNo} Routing`}
                          value={entry.routingId}
                          options={entry.routingOptions}
                          disabled={busy || entry.locked}
                          onChange={entry.onRoutingChange}
                        />
                      </td>
                      <td>{entry.ready ? '개정 선택 완료' : '개정 선택 필요'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="field-note">확정 계획에 사용한 개정은 변경할 수 없습니다.</p>
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
              { value: 'grid', label: '오더 그리드', content: null },
              { value: 'week', label: '주간 편성', content: null },
            ]}
          />
        )}
        {stage === 'plan' && planView === 'grid' && (
          <section aria-label="선택 오더" className="pane erp-wo-multi-orders">
            <table className="erp-wo-master-table">
              <thead>
                <tr>
                  <th>ERP W/O</th>
                  <th>품목</th>
                  <th>오더 수량</th>
                  <th>확정 계획량</th>
                  <th>미확정 계획량</th>
                  <th>미계획 수량</th>
                  <th>이번 계획 수량</th>
                  <th>계획 추가 대상</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.order.productionOrderNo}
                    className={focus === entry.order.productionOrderNo ? 'is-active' : undefined}
                  >
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
                    <td>
                      <input
                        type="radio"
                        name="plan-target"
                        aria-label={`${entry.order.productionOrderNo} 계획 추가 대상`}
                        checked={focus === entry.order.productionOrderNo}
                        disabled={busy}
                        onChange={() => setFocus(entry.order.productionOrderNo)}
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
            이번 계획 수량은 계획 가능한 수량 이내의 0 이상 정수로 입력하세요.
          </AlertBanner>
        )}
        {!compatible && allReady && (
          <AlertBanner variant="warning">
            공장 또는 수량 단위가 서로 다릅니다. 오더별 수동 편성은 가능하며, 공통 자동 분배는 같은
            공장과 단위의 오더를 선택해야 합니다.
          </AlertBanner>
        )}
        {orderNumbers.map((number) => (
          <OrderSession key={number} number={number} publish={publish} />
        ))}
        {stage === 'plan' && planView === 'week' && target && (
          <>
            <div className="erp-wo-multi-week-tools">
              <div className="erp-wo-multi-week-heading">
                <div className="field-cell">
                  <span className="field-label visually-hidden">계획 추가 대상</span>
                  <Select
                    aria-label="계획 추가 대상"
                    value={focus}
                    options={entries.map((entry) => ({
                      value: entry.order.productionOrderNo,
                      label: `${entry.order.productionOrderNo} / ${entry.item}`,
                    }))}
                    onChange={setFocus}
                    disabled={busy}
                  />
                </div>
                <p className="field-note">
                  이번 계획 {targetOf(target)}, 편성 {draftOf(target)}, 편성 대기{' '}
                  {toSchedule(target)} {target.unit}
                </p>
              </div>
              <DistributionControls
                lines={target.lines}
                disabled={busy || !allReady || !compatible || !validTargets}
                onDistribute={(options) => {
                  const result = distributePlans(
                    entries.map((entry) => ({
                      id: entry.order.productionOrderNo,
                      remaining: toSchedule(entry),
                    })),
                    options,
                    entries.flatMap((entry) => entry.editor.rows.map((row) => row.draft)),
                  );
                  entries.forEach((entry) =>
                    entry.editor.addMany(
                      result.drafts
                        .filter((row) => row.owner === entry.order.productionOrderNo)
                        .map((row) => ({ ...entry.defaults, ...row })),
                    ),
                  );
                  return `${result.drafts.length}개 계획 추가 / 편성 대기 ${result.pending} ${target.unit}. 저장 전 편성을 확인하세요.`;
                }}
              />
            </div>
            <PlanStep
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
              onAdd={() =>
                target.editor.add({
                  ...target.defaults,
                  plannedQty: String(Math.max(1, toSchedule(target))),
                })
              }
              onChange={(key, field, value) =>
                ownerOf(key)?.editor.change(originalKey(key), field, value)
              }
              onSplit={(row, qty) => ownerOf(row.key)?.editor.split(originalKey(row.key), qty)}
              onRemove={(row) => void remove(row)}
            />
          </>
        )}
        {(stage === 'assign' || stage === 'release') && (
          <section className="erp-wo-multi-execution">
            <div className="field-cell">
              <span className="field-label">작업 오더</span>
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
                executionScope
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
              오더와 계획별 순차 처리입니다. 일부 실패 시 완료된 계획은 유지되며, 실패 사유를 확인한
              뒤 다시 처리하세요.
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
                ? '모든 오더의 BOM과 Routing 선택 및 조회를 완료하세요.'
                : plants.size !== 1
                  ? '같은 공장의 오더를 선택하세요.'
                  : !validTargets
                    ? '이번 계획 수량은 계획 가능한 수량 이내의 정수로 입력하세요.'
                    : !fullyAllocated && editable
                      ? '이번 계획 수량과 오더별 편성 수량을 맞추세요.'
                      : dirty
                        ? '미저장 계획이 있습니다.'
                        : !editable && !enough
                          ? '계획을 추가하세요.'
                          : '편성 내용을 확인하세요.'
          }
          leading={
            stage === 'plan' ? (
              <Button
                variant="outlined"
                disabled={busy || !dirty || !allReady}
                onClick={() => void save(false)}
              >
                계획 저장
              </Button>
            ) : undefined
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
              <Button variant="outlined" disabled={busy} onClick={() => setStage('master')}>
                이전
              </Button>
              {planView === 'grid' ? (
                <Button
                  aria-describedby={remainingId}
                  disabled={busy || !allReady}
                  onClick={() => setPlanView('week')}
                >
                  주간 편성에서 확인 →
                </Button>
              ) : (
                <Button
                  aria-describedby={remainingId}
                  disabled={busy || !editable || !allReady || !fullyAllocated}
                  onClick={() => setConfirm(true)}
                >
                  전개 확정
                </Button>
              )}
              {enough && (
                <Button
                  aria-describedby={remainingId}
                  disabled={busy || dirty}
                  onClick={() => setStage('assign')}
                >
                  다음: 4M 배정
                </Button>
              )}
            </>
          )}
        </ActionBar>
      )}
      {(stage === 'master' || stage === 'plan') && <LeaveGuard when={dirty} />}
      {pendingAction && (
        <DiscardDialog
          onCancel={() => setPendingAction(null)}
          onConfirm={() => {
            pendingAction();
            setPendingAction(null);
          }}
        />
      )}
      {confirm && (
        <Dialog
          open
          title="선택 오더 계획 전개 확정"
          onClose={() => !busy && setConfirm(false)}
          closeOnBackdropClick={false}
          footer={
            <>
              <Button variant="outlined" disabled={busy} onClick={() => setConfirm(false)}>
                취소
              </Button>
              <Button loading={busy} onClick={() => void save(true)}>
                전개 확정
              </Button>
            </>
          }
        >
          <p>
            선택 오더 {entries.length}건의 미확정 계획{' '}
            {combined.filter((row) => !row.confirmed).length}건을 저장하고 확정한 뒤 Routing에 따라
            작업지시를 생성합니다.
          </p>
          <p>
            확정 후 계획은 수정할 수 없습니다. 오더와 계획별로 처리하므로 일부만 완료될 수 있습니다.
          </p>
        </Dialog>
      )}
    </div>
  );
};
