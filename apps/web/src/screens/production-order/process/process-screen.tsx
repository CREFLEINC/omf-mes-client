/**
 * W-02-01 작업지시 목록 처리 화면 (W-02-02 W/O 전개와 편성, W-02-03 4M 자원배정, W-02-04 W/O 확정과 배포를 단계로 합침)
 * 유형: T-W-C 처리형 (작업함: ProductionOrderScreen, 처리 화면: ProductionOrderProcessScreen)
 * 이탈: C-17 「자동」 표시 없음(배정 출처 칸 계약 대기, omf-all-around#129).
 *       C-12 마스터 점검의 BOM, Routing 개정은 그 품목의 개정 목록이라 Select다(구성안 C-20 표).
 *       T-W-C 4M 편집 영역은 위치 묶음을 펼치면(라인에 기본 위치가 없을 때) 1280×800에 들어가지 않아
 *       편집 영역 안에서만 스크롤하고 머리를 고정한다(높이가 모자랄 때 ②, 구성안 8장).
 */
import { AlertBanner, Button, SkeletonText, useToast } from '@crefle/web-ui';
import { createIdempotencyKey, type ApiError } from '@omf-mes/api-client';
import { messages, named } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { ActionBar } from '../../../patterns/action-bar';
import { useApiClient } from '../../../patterns/api-context';
import { SaveErrorBanner } from '../../../patterns/master';
import { josa } from '../../../patterns/josa';
import { plantToday } from '../../../patterns/plant-time';
import {
  ProcessPage,
  type PastSummaryGroup,
  type ProcessStep,
} from '../../../patterns/process-page';
import {
  validateProductionPlanDraft,
  type ProductionPlanDraftField,
} from '../../production-plan/editor-model';
import { useProductionPlanEditorSession } from '../../production-plan/editor-session';
import {
  useBomReferenceQuery,
  useProductionLineReferenceQuery,
  useRoutingReferenceQuery,
} from '../../production-plan/reference-queries';
import { useRoutingOperations } from '../../routing/queries';
import { useProductionOrderCodeNames } from '../code-names';
import { useItemCodeNames } from '../item-lookups';
import { useAutoPlanMutation } from '../mutations';
import { useUomReferenceLookup } from '../reference-lookups';
import { apiErrorText, invalidateFlow, releaseWorkOrder } from '../release-runner';
import { ProcessStateChip, ReasonChips } from '../worklist-chips';
import {
  processPath,
  readWorklistFilters,
  rememberedWorklistSearch,
  worklistPath,
} from '../worklist-filters';
import { deriveWorklistState, type ProcessStepKey } from '../worklist-model';
import {
  useProductionOrderByNumber,
  useWorklist,
  useWorklistCount,
  worklistKeys,
} from '../worklist-queries';
import type { ProductionOrderFact } from '../types';
import { AssignStep } from './assign-step';
import { automaticBomId, automaticRoutingId, MasterStep } from './master-step';
import { readableFinding } from './finding-text';
import { DiscardDialog, LeaveGuard } from './leave-guard';
import { PlanConfirmDialog } from './plan-confirm-dialog';
import { deletePlan, runPlanStep } from './plan-runner';
import { PlanStep } from './plan-step';
import {
  canEnter,
  firstOpenStep,
  formatQty,
  judgeAssign,
  judgeMaster,
  judgePlan,
  judgeRelease,
  STEP_KEYS,
  type StepJudgment,
} from './process-model';
import { useAllOrderWorkOrders, useUnreleasedWorkOrders, useWorkOrderReadiness } from './queries';
import { ReleaseStep, toReleaseLines, useDefaultLotSizes } from './release-step';

const t = messages.erpWorkOrderFlow;
const tp = t.process;

type ScreenStep = ProcessStepKey | 'done';

const PLAN_FIELD_NAMES: Partial<Record<ProductionPlanDraftField, string>> = {
  planDate: tp.plan.columns.planDate,
  plannedQty: tp.plan.columns.plannedQty,
  plannedLineId: tp.plan.columns.line,
};

const ProcessWorkspace = ({ order }: { order: ProductionOrderFact }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { client } = useApiClient();
  const remainingId = useId();
  const codeNames = useProductionOrderCodeNames();
  const uoms = useUomReferenceLookup();
  const uomLabelOf = (uomId: number) =>
    uoms.entries.find((entry) => entry.value === String(uomId))?.label ?? '';
  const item = useItemCodeNames([order.itemId]).get(order.itemId);
  const stepName = (key: ProcessStepKey) => tp.steps[key];

  /* 마스터 점검 */
  const boms = useBomReferenceQuery(order.itemId);
  const routings = useRoutingReferenceQuery(order.itemId, true);
  const lines = useProductionLineReferenceQuery(order.plantId);
  const editor = useProductionPlanEditorSession(order.productionOrderId);
  const planFacts = editor.plans.data?.items ?? [];
  const confirmedPlans = planFacts.filter((plan) => plan.confirmedAt !== null);
  const planBom = confirmedPlans[0]?.bomId ?? planFacts[0]?.bomId;
  const planRouting = confirmedPlans[0]?.routingId ?? planFacts[0]?.routingId;
  const [bomChoice, setBomChoice] = useState<string | null>(null);
  const [routingChoice, setRoutingChoice] = useState<string | null>(null);
  const bomItems = boms.data?.items ?? [];
  const routingItems = routings.data?.items ?? [];
  const fallbackBom = planBom ?? automaticBomId(bomItems);
  const fallbackRouting = planRouting ?? automaticRoutingId(routingItems);
  const bomId =
    bomChoice ?? (fallbackBom === undefined || fallbackBom === null ? '' : String(fallbackBom));
  const routingId =
    routingChoice ??
    (fallbackRouting === undefined || fallbackRouting === null ? '' : String(fallbackRouting));
  const operations = useRoutingOperations(routingId === '' ? null : Number(routingId));
  const master = judgeMaster(
    {
      loading: boms.isPending || routings.isPending,
      failed: boms.isError || routings.isError,
      bomCount: bomItems.length,
      routingCount: routingItems.length,
      bomSelected: bomItems.some((entry) => String(entry.bomId) === bomId),
      routingSelected: routingItems.some((entry) => String(entry.routingId) === routingId),
    },
    stepName('plan'),
  );

  /* 생산계획: 확정 전 줄은 마스터 점검의 BOM, Routing을 따른다. */
  const { change } = editor;
  useEffect(() => {
    editor.rows.forEach((row) => {
      if (row.confirmed || row.isPending) return;
      if (bomId !== '' && row.draft.bomId !== bomId) change(row.key, 'bomId', bomId);
      if (routingId !== '' && row.draft.routingId !== routingId)
        change(row.key, 'routingId', routingId);
    });
  }, [bomId, change, editor.rows, routingId]);
  const rowName = (row: (typeof editor.rows)[number]) =>
    row.planNo ?? tp.plan.newRow(row.displayNo);
  const unconfirmedRows = editor.rows.filter((row) => !row.confirmed);
  const invalidRow = unconfirmedRows
    .map((row) => {
      const errors = validateProductionPlanDraft(row.draft);
      const field = (Object.keys(PLAN_FIELD_NAMES) as ProductionPlanDraftField[]).find(
        (name) => errors[name] !== undefined,
      );
      return field === undefined
        ? null
        : { plan: rowName(row), field: PLAN_FIELD_NAMES[field] ?? '' };
    })
    .find((entry) => entry !== null);
  const plan = judgePlan(
    {
      loading: !editor.isHydrated,
      rowCount: editor.rows.length,
      unconfirmed: unconfirmedRows.length,
      invalid: invalidRow ?? null,
      missingLine: (() => {
        const row = unconfirmedRows.find((entry) => entry.draft.plannedLineId === '');
        return row === undefined ? null : rowName(row);
      })(),
      totalQty: editor.rows.reduce((sum, row) => sum + (Number(row.draft.plannedQty) || 0), 0),
      confirmedQty: confirmedPlans.reduce((sum, entry) => sum + entry.plannedQty, 0),
      orderQty: order.orderQty,
    },
    stepName('assign'),
  );
  const planDirty = unconfirmedRows.some((row) => row.productionPlanId === null || row.isDirty);
  const [planBusy, setPlanBusy] = useState(false);
  const [planFailures, setPlanFailures] = useState<string[]>([]);
  /* 불러온 뒤 서버 계획이 바뀌어 저장이 409로 돌아온 경우. 덮어쓰지 않고 다시 불러오기를 안내한다. */
  const [planConflict, setPlanConflict] = useState<ApiError | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const planLines = (lines.data?.items ?? []).map((line) => ({
    id: line.productionLineId,
    code: line.lineCode,
    name: line.lineName,
  }));
  const lineName = (lineId: number | null) => {
    const line = planLines.find((entry) => entry.id === lineId);
    return line === undefined ? null : named(line.name, line.code);
  };

  /* 4M 배정 */
  const unreleased = useUnreleasedWorkOrders(order.productionOrderId);
  const allWorkOrders = useAllOrderWorkOrders(order.productionOrderId);
  const readiness = useWorkOrderReadiness(unreleased.data);
  const blockedIds = useMemo(
    () =>
      readiness === undefined
        ? undefined
        : new Set(readiness.filter((entry) => !entry.ready).map((entry) => entry.workOrderId)),
    [readiness],
  );
  const firstBlockedReadiness = readiness?.find((entry) => !entry.ready);
  const firstBlocked = unreleased.data?.find(
    (entry) => entry.workOrderId === firstBlockedReadiness?.workOrderId,
  );
  const [assignSelected, setAssignSelected] = useState<number | null>(null);
  const [assignDirty, setAssignDirty] = useState(false);
  const [pendingStep, setPendingStep] = useState<ProcessStepKey | null>(null);
  const selectedWorkOrder = unreleased.data?.find((entry) => entry.workOrderId === assignSelected);
  const assign = judgeAssign(
    {
      loading: unreleased.isPending || readiness === undefined,
      pending: unreleased.data?.length ?? 0,
      blocked: blockedIds?.size ?? 0,
      unsaved:
        assignDirty && selectedWorkOrder !== undefined ? selectedWorkOrder.workOrderNo : null,
      firstBlocked:
        firstBlocked === undefined || firstBlockedReadiness === undefined
          ? null
          : {
              operation: firstBlocked.operationName,
              field:
                firstBlockedReadiness.missingField === null
                  ? null
                  : tp.assign.fields[firstBlockedReadiness.missingField],
              finding:
                firstBlockedReadiness.finding === null
                  ? null
                  : readableFinding(firstBlockedReadiness.finding),
            },
    },
    stepName('release'),
  );
  const judgments: Record<Exclude<ProcessStepKey, 'release'>, StepJudgment> = {
    master,
    plan,
    assign,
  };

  /* 배포 확인 */
  const defaultLots = useDefaultLotSizes(unreleased.data ?? []);
  const [lotSizeTexts, setLotSizeTexts] = useState<Record<number, string>>({});
  const [failures, setFailures] = useState<string[]>([]);
  const [releasing, setReleasing] = useState(false);
  /* 같은 W/O와 LOT 크기의 배포는 반영될 때까지 같은 멱등 키를 다시 쓴다(옛 배포 화면의 until-applied 수명). */
  const releaseKeys = useRef(new Map<string, string>());
  const releaseLines =
    unreleased.data === undefined
      ? undefined
      : toReleaseLines(unreleased.data, lotSizeTexts, defaultLots);
  const missingLot =
    releaseLines?.find((line) => line.lotSize === null)?.workOrder.workOrderNo ?? null;
  const releaseGuidance = judgeRelease(
    releaseLines === undefined || releaseLines.length === 0 ? null : missingLot,
  );

  /* 단계 */
  const [step, setStep] = useState<ScreenStep | null>(null);
  const [releasedCount, setReleasedCount] = useState<number | null>(null);
  const loading =
    boms.isPending ||
    routings.isPending ||
    !editor.isHydrated ||
    unreleased.isPending ||
    readiness === undefined;
  const alreadyReleased =
    !loading &&
    plan.complete &&
    (unreleased.data?.length ?? 0) === 0 &&
    (order.expandedWorkOrderCount ?? 0) > 0;
  useEffect(() => {
    if (step !== null || loading) return;
    /* 처음 한 번만 정한다(T-W-C 처음 여는 단계). 이후 이동은 사용자가 한다. */
    setStep(alreadyReleased ? 'done' : firstOpenStep(judgments));
  }, [alreadyReleased, judgments, loading, step]);
  useEffect(() => {
    if (step === 'assign' && assignSelected === null) {
      const first = firstBlocked ?? unreleased.data?.[0];
      if (first !== undefined) setAssignSelected(first.workOrderId);
    }
  }, [assignSelected, firstBlocked, step, unreleased.data]);

  /* 계획을 확정하면 서버가 자동 계획 결과(머리 칩)를 다시 정한다. 머리 요약을 그 값으로 맞춘다. */
  const plansUpdatedAt = editor.plans.dataUpdatedAt;
  useEffect(() => {
    if (plansUpdatedAt === 0) return;
    void queryClient.invalidateQueries({
      queryKey: worklistKeys.byNumber(order.productionOrderNo),
    });
  }, [order.productionOrderNo, plansUpdatedAt, queryClient]);

  const autoPlan = useAutoPlanMutation({
    onSuccess: (result) => {
      toast.show({
        variant: result.outcome === 'CONFIRMED' ? 'success' : 'warning',
        description:
          result.outcome === 'NOT_PLANNED'
            ? `${tp.autoPlanResult.NOT_PLANNED}: ${result.reasons.map((reason) => t.reasons[reason]).join(', ')}`
            : tp.autoPlanResult[result.outcome],
      });
      setStep(null);
    },
  });

  const derivedBase = deriveWorklistState(order, {
    pending: unreleased.data?.length ?? 0,
    blocked: blockedIds?.size ?? 0,
  });
  /* 서버 사유에 없어도 데이터로 보이는 막힘(작성 중 계획의 라인 미정)을 앞에 둔다(T-W-C 처음 여는 단계와 같은 판단). */
  const derived =
    derivedBase.state === 'NEEDS_REVIEW' &&
    unconfirmedRows.some((row) => row.draft.plannedLineId === '') &&
    !derivedBase.reasons.includes('LINE_UNKNOWN')
      ? { ...derivedBase, reasons: ['LINE_UNKNOWN' as const, ...derivedBase.reasons] }
      : derivedBase;
  const lastSearch = useMemo(() => rememberedWorklistSearch(), []);
  const lastFilters = useMemo(() => readWorklistFilters(lastSearch), [lastSearch]);
  const nextList = useWorklist(lastFilters);
  const needsReviewCount = useWorklistCount('NEEDS_REVIEW');
  const nextOrder = (() => {
    const items = nextList.data?.items ?? [];
    const index = items.findIndex((entry) => entry.productionOrderNo === order.productionOrderNo);
    return index >= 0
      ? items[index + 1]
      : items.find((entry) => entry.productionOrderNo !== order.productionOrderNo);
  })();

  const savePlans = useCallback(
    async (confirm: boolean) => {
      setPlanBusy(true);
      setPlanFailures([]);
      setPlanConflict(null);
      const result = await runPlanStep(
        client,
        editor.rows,
        { productionOrderId: order.productionOrderId, uomId: order.uomId },
        confirm,
      );
      result.saved.forEach(({ key, plan: saved }) => editor.settle(key, saved));
      result.failures.forEach((failure) => editor.setErrors(failure.key, failure.errors));
      await invalidateFlow(queryClient);
      setPlanBusy(false);
      setConfirmOpen(false);
      if (result.failures.length > 0) {
        const conflict = result.failures.find((failure) => failure.error?.kind === 'conflict');
        if (conflict?.error !== undefined && conflict.error !== null) {
          setPlanConflict(conflict.error);
        }
        setPlanFailures(
          result.failures.flatMap((failure) =>
            failure.message === null || failure.error?.kind === 'conflict' ? [] : [failure.message],
          ),
        );
        return;
      }
      if (confirm) {
        /* 확정하면 바로 다음 단계로 넘어간다(T-W-C 중간 단계의 확정). */
        await queryClient.refetchQueries({
          queryKey: ['work-orders', 'by-order', order.productionOrderId],
        });
        setAssignSelected(null);
        setStep('assign');
      } else {
        toast.show({ variant: 'success', description: messages.common.saved });
      }
    },
    [client, editor, order.productionOrderId, order.uomId, queryClient, toast],
  );

  if (step === null) {
    return (
      <div role="status" aria-label={tp.loading}>
        <SkeletonText lines={6} />
      </div>
    );
  }

  const steps: ProcessStep[] = STEP_KEYS.map((key) => ({
    key,
    label: stepName(key),
    status:
      step === 'done'
        ? 'complete'
        : key === step
          ? 'current'
          : key !== 'release' && judgments[key].complete && canEnter(key, judgments)
            ? 'complete'
            : 'pending',
    canReturn: step !== 'done',
  }));
  const index = step === 'done' ? STEP_KEYS.length : STEP_KEYS.indexOf(step);
  const nextKey = step === 'done' ? undefined : STEP_KEYS[index + 1];

  const release = async () => {
    if (releaseLines === undefined || missingLot !== null) return;
    setReleasing(true);
    setFailures([]);
    const attempts = [];
    for (const line of releaseLines) {
      const signature = `${String(line.workOrder.workOrderId)}:${String(line.lotSize)}`;
      const key = releaseKeys.current.get(signature) ?? createIdempotencyKey();
      releaseKeys.current.set(signature, key);
      const attempt = await releaseWorkOrder(
        client,
        queryClient,
        { workOrderId: line.workOrder.workOrderId, workOrderNo: line.workOrder.workOrderNo },
        line.lotSize,
        key,
      );
      if (attempt.status === 'released') releaseKeys.current.delete(signature);
      attempts.push(attempt);
    }
    await invalidateFlow(queryClient);
    setReleasing(false);
    const problems = attempts.filter((attempt) => attempt.status !== 'released');
    if (problems.length === 0) {
      setLotSizeTexts({});
      setReleasedCount(attempts.length);
      setStep('done');
    } else {
      setFailures(
        problems.map((attempt) => tp.release.failed(attempt.workOrderNo, attempt.reason ?? '')),
      );
    }
  };

  /* 지난 단계 요약: 지난 단계에서 정한 값만. 단계별 묶음과 「라벨 값」 쌍(T-W-C 지난 단계 요약 형식) */
  const ps = tp.pastSummary;
  const pastGroups: PastSummaryGroup[] = [];
  if (index > 0) {
    const bom = bomItems.find((entry) => String(entry.bomId) === bomId);
    const routing = routingItems.find((entry) => String(entry.routingId) === routingId);
    pastGroups.push({
      step: stepName('master'),
      pairs: [
        bom === undefined
          ? { label: ps.bom, value: ps.unset, unset: true }
          : { label: ps.bom, value: ps.revision(bom.bomCode, bom.bomVersion) },
        routing === undefined
          ? { label: ps.routing, value: ps.unset, unset: true }
          : { label: ps.routing, value: ps.revision(routing.routingCode, routing.routingVersion) },
      ],
    });
  }
  if (index > 1) {
    const qty = confirmedPlans.reduce((sum, entry) => sum + entry.plannedQty, 0);
    const planLineNames = [
      ...new Set(confirmedPlans.map((entry) => lineName(entry.plannedLineId))),
    ];
    pastGroups.push({
      step: stepName('plan'),
      pairs: [
        { label: ps.confirmedQty, value: `${formatQty(qty)} ${uomLabelOf(order.uomId)}` },
        ...(planLineNames.length === 0 ? [null] : planLineNames).map((name) =>
          name === null
            ? { label: ps.line, value: ps.unset, unset: true }
            : { label: ps.line, value: name },
        ),
      ],
    });
  }
  if (index > 2) {
    const count =
      step === 'done' ? (allWorkOrders.data?.length ?? 0) : (unreleased.data?.length ?? 0);
    pastGroups.push({
      step: stepName('assign'),
      pairs: [{ label: ps.assigned, value: ps.workOrders(count) }],
    });
  }

  const guidance =
    step === 'done'
      ? { text: tp.remaining.remainingOrders(needsReviewCount.data ?? 0), todo: false }
      : step === 'release'
        ? releaseGuidance
        : judgments[step].guidance;
  const remainingLink =
    step === 'master' && master.blockedOutside === 'bom' ? (
      <Link to="/system/erp-data/boms">{tp.links.bom}</Link>
    ) : step === 'master' && master.blockedOutside === 'routing' ? (
      <Link to="/master-data/routing">{tp.links.routing}</Link>
    ) : undefined;

  /*
   * 저장하지 않은 변경(T-W-C 저장하지 않은 변경): 생산계획의 고친 줄, 4M 편집, 배포 확인의 LOT 크기.
   * 단계 표시와 [이전]은 지금 단계의 변경을, 화면을 떠나는 이동은 모든 변경을 확인한다.
   */
  const lotDirty = Object.entries(lotSizeTexts).some(
    ([workOrderId, text]) => text !== String(defaultLots.get(Number(workOrderId)) ?? ''),
  );
  const unsavedIn = (key: ScreenStep): boolean =>
    key === 'plan' ? planDirty : key === 'assign' ? assignDirty : key === 'release' && lotDirty;
  const goTo = (key: string) => {
    if (key !== step && unsavedIn(step)) {
      setPendingStep(key as ProcessStepKey);
      return;
    }
    setStep(key as ProcessStepKey);
  };
  const discardStep = (key: ScreenStep) => {
    if (key === 'plan') {
      setPlanFailures([]);
      setPlanConflict(null);
      editor.discard();
    } else if (key === 'assign') setAssignDirty(false);
    else if (key === 'release') setLotSizeTexts({});
  };

  const body = (() => {
    switch (step) {
      case 'master':
        return (
          <MasterStep
            boms={{
              items: bomItems,
              isLoading: boms.isPending,
              isError: boms.isError,
              refetch: () => void boms.refetch(),
            }}
            routings={{
              items: routingItems,
              isLoading: routings.isPending,
              isError: routings.isError,
              refetch: () => void routings.refetch(),
            }}
            bomId={bomId}
            routingId={routingId}
            locked={confirmedPlans.length > 0}
            statusNameOf={codeNames.masterVersionStatus}
            onBomChange={setBomChoice}
            onRoutingChange={setRoutingChoice}
          />
        );
      case 'plan':
        return (
          <>
            <SaveErrorBanner
              error={planConflict}
              onReload={() => {
                setPlanConflict(null);
                setPlanFailures([]);
                editor.discard();
              }}
            />
            <PlanStep
              rows={editor.rows}
              orderQty={order.orderQty}
              uomLabel={uomLabelOf(order.uomId)}
              plantId={order.plantId}
              lines={planLines}
              statusNameOf={codeNames.productionPlanStatus}
              disabled={planBusy || !master.complete}
              failures={planFailures}
              onAdd={() =>
                editor.add({
                  planDate: plantToday(),
                  plannedQty: String(
                    Math.max(
                      0,
                      order.orderQty -
                        editor.rows.reduce(
                          (sum, row) => sum + (Number(row.draft.plannedQty) || 0),
                          0,
                        ),
                    ),
                  ),
                  bomId,
                  routingId,
                  plannedLineId: editor.rows.at(-1)?.draft.plannedLineId ?? '',
                })
              }
              onChange={editor.change}
              onRemove={(row) => {
                if (row.productionPlanId === null) {
                  editor.remove(row.key);
                  return;
                }
                setPlanConflict(null);
                void deletePlan(client, row.productionPlanId, row.versionNo).then(async (error) => {
                  if (error?.kind === 'conflict') setPlanConflict(error);
                  else if (error !== null) setPlanFailures([apiErrorText(error)]);
                  else {
                    editor.remove(row.key);
                    await invalidateFlow(queryClient);
                  }
                });
              }}
            />
          </>
        );
      case 'assign':
        return (
          <AssignStep
            workOrders={unreleased.data}
            blockedIds={blockedIds}
            plantId={order.plantId}
            planDateOf={(planId) =>
              planFacts.find((entry) => entry.productionPlanId === planId)?.planDate ?? null
            }
            selectedId={assignSelected}
            onSelect={setAssignSelected}
            onDirtyChange={setAssignDirty}
          />
        );
      case 'release':
        return (
          <ReleaseStep
            lines={releaseLines}
            uomLabelOf={uomLabelOf}
            failures={failures}
            revealErrors={false}
            onLotSizeChange={(workOrderId, value) =>
              setLotSizeTexts((current) => ({ ...current, [workOrderId]: value }))
            }
          />
        );
      case 'done':
        return (
          <section className="pane erp-wo-step-pane" aria-label={tp.done.heading}>
            <h2 className="section-title">{tp.done.heading}</h2>
            <p className="done-lead">
              {releasedCount === null
                ? tp.done.alreadyReleased
                : tp.done.success(order.productionOrderNo, releasedCount)}
            </p>
            <ul className="erp-wo-plain-list">
              {(allWorkOrders.data ?? []).map((workOrder) => (
                <li key={workOrder.workOrderId}>
                  {tp.done.statusLine(
                    workOrder.workOrderNo,
                    workOrder.operationName,
                    codeNames.workOrderStatus(workOrder.statusCode),
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
    }
  })();

  const primary = (() => {
    if (step === 'done') {
      return nextOrder === undefined ? (
        <Button onClick={() => void navigate(worklistPath(lastSearch))}>
          {josa(tp.done.toWorklist, '으로/로')}
        </Button>
      ) : (
        <>
          <Button variant="outlined" onClick={() => void navigate(worklistPath(lastSearch))}>
            {josa(tp.done.toWorklist, '으로/로')}
          </Button>
          <Button onClick={() => void navigate(processPath(nextOrder.productionOrderNo))}>
            {tp.done.nextOrder}
          </Button>
        </>
      );
    }
    const prev =
      index > 0 ? (
        <Button variant="outlined" onClick={() => goTo(STEP_KEYS[index - 1] ?? 'master')}>
          {messages.screenPatterns.actionBar.prev}
        </Button>
      ) : null;
    if (step === 'release') {
      return (
        <>
          {prev}
          <Button
            loading={releasing}
            disabled={releasing || missingLot !== null}
            aria-describedby={remainingId}
            onClick={() => void release()}
          >
            {tp.release.release}
          </Button>
        </>
      );
    }
    if (step === 'plan' && !plan.complete) {
      return (
        <>
          {prev}
          <Button
            loading={planBusy}
            disabled={!plan.canConfirm || planBusy}
            aria-describedby={plan.canConfirm ? undefined : remainingId}
            onClick={() => setConfirmOpen(true)}
          >
            {tp.plan.confirm}
          </Button>
        </>
      );
    }
    const complete = judgments[step].complete;
    return (
      <>
        {prev}
        <Button
          disabled={!complete}
          aria-describedby={complete ? undefined : remainingId}
          onClick={() => nextKey !== undefined && goTo(nextKey)}
        >
          {messages.screenPatterns.actionBar.next(nextKey === undefined ? '' : stepName(nextKey))}
        </Button>
      </>
    );
  })();

  const dirtyPlans = step === 'plan' && planDirty;
  const canRerun = derived.state === 'NEEDS_REVIEW' || derived.state === 'NOT_PLANNED';

  return (
    <ProcessPage
      backLabel={tp.back}
      onBack={() => void navigate(worklistPath(lastSearch))}
      title={order.productionOrderNo}
      badges={
        <>
          <ProcessStateChip
            state={derived.state}
            cancelledName={codeNames.productionOrderStatus('CANCELLED')}
          />
          <ReasonChips reasons={derived.reasons} />
        </>
      }
      summary={
        <dl className="erp-wo-summary">
          <div>
            <dt>{tp.summary.item}</dt>
            <dd>{item === undefined ? '' : named(item.itemName, item.itemCode)}</dd>
          </div>
          <div>
            <dt>{tp.summary.orderQty}</dt>
            <dd>{`${formatQty(order.orderQty)} ${uomLabelOf(order.uomId)}`}</dd>
          </div>
          {order.dueDate !== null && (
            <div>
              <dt>{tp.summary.dueDate}</dt>
              <dd>{order.dueDate}</dd>
            </div>
          )}
          {order.erpOrderNo !== null && (
            <div>
              <dt>{tp.summary.erpNo}</dt>
              <dd>{order.erpOrderNo}</dd>
            </div>
          )}
        </dl>
      }
      headerActions={
        canRerun && step !== 'done' ? (
          <Button
            variant="outlined"
            loading={autoPlan.isSaving}
            onClick={() => autoPlan.write(order.productionOrderId)}
          >
            {tp.rerunAutoPlan}
          </Button>
        ) : undefined
      }
      steps={steps}
      onSelectStep={goTo}
      pastSummary={pastGroups}
      actionBar={
        <ActionBar
          remaining={guidance?.text ?? null}
          todo={guidance?.todo ?? false}
          remainingLink={remainingLink}
          remainingId={remainingId}
          leading={
            dirtyPlans ? (
              <Button variant="outlined" disabled={planBusy} onClick={() => void savePlans(false)}>
                {tp.plan.saveDraft}
              </Button>
            ) : undefined
          }
        >
          {primary}
        </ActionBar>
      }
    >
      {autoPlan.error !== null && (
        <AlertBanner variant="warning">
          {autoPlan.error.kind === 'conflict'
            ? tp.autoPlanResult.running
            : messages.httpError.description}
        </AlertBanner>
      )}
      {body}
      <LeaveGuard when={planDirty || assignDirty || lotDirty} />
      {pendingStep !== null && (
        <DiscardDialog
          onCancel={() => setPendingStep(null)}
          onConfirm={() => {
            const next = pendingStep;
            setPendingStep(null);
            discardStep(step);
            setStep(next);
          }}
        />
      )}
      {confirmOpen && (
        <PlanConfirmDialog
          plans={unconfirmedRows.map(rowName)}
          operations={(operations.data?.items ?? []).map((operation) => operation.operationName)}
          running={planBusy}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void savePlans(true)}
        />
      )}
    </ProcessPage>
  );
};

export const ProductionOrderProcessScreen = () => {
  const { productionOrderNo = '' } = useParams();
  const navigate = useNavigate();
  const order = useProductionOrderByNumber(productionOrderNo);

  if (order.isPending) {
    return (
      <div role="status" aria-label={tp.loading}>
        <SkeletonText lines={6} />
      </div>
    );
  }
  if (order.isError || order.data === null) {
    return (
      <AlertBanner
        variant={order.isError ? 'error' : 'warning'}
        title={order.isError ? tp.loadFailed : tp.notFound}
        action={
          order.isError ? (
            <Button size="sm" variant="outlined" onClick={() => void order.refetch()}>
              {tp.retry}
            </Button>
          ) : (
            <Button size="sm" variant="outlined" onClick={() => void navigate(worklistPath())}>
              {tp.back}
            </Button>
          )
        }
      >
        {order.isError ? undefined : tp.notFoundDescription}
      </AlertBanner>
    );
  }
  return <ProcessWorkspace key={order.data.productionOrderId} order={order.data} />;
};
