import { AlertBanner, Button, SkeletonText, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { formatDateRange, formatTimeOfDay } from '../../patterns/date-display';
import {
  selectableLookupOptions,
  type LookupEntry,
  type LookupSource,
} from '../../patterns/lookup-display';
import { SaveErrorBanner } from '../../patterns/master';
import {
  plannedWindowLocal,
  toWorkOrderAssignmentUpdate,
  validateWorkOrderAssignmentDraft,
  workOrderAssignmentDraftFrom,
  type WorkOrderAssignmentDraft,
} from './assignment-model';
import {
  canApplyWorkOrderReload,
  isExactWorkOrderDetail,
  mergeWorkOrderAssignmentFieldErrors,
  toOwnedResourceLookup,
  withKeptEntry,
} from './editor-support';
import { useUpdateWorkOrder } from './mutations';
import {
  useWorkOrderMold,
  useWorkOrderMolds,
  useWorkOrderWorker,
  useWorkOrderWorkers,
  type WorkOrderMoldFact,
  type WorkOrderWorkerFact,
} from './people-tool-queries';
import {
  useWorkOrderDetail,
  useWorkOrderResourceRecommendations,
  useWorkOrderValidation,
  type WorkOrderFact,
} from './queries';
import { toRecommendationChips } from './resource-recommendation';
import {
  useWorkOrderEquipment,
  useWorkOrderEquipments,
  LINE_LOCATION_WAREHOUSE_TYPES,
  useWorkOrderLocations,
  useWorkOrderProductionLines,
  useWorkOrderShifts,
  type WorkOrderEquipmentFact,
} from './resource-queries';
import { workOrderDraftEquals, workOrderFieldErrorMessage } from './screen-model';
import { WorkOrderAssignmentActions } from './work-order-assignment-actions';
import { WorkOrderPlanFieldsPane } from './work-order-plan-fields-pane';
import { WorkOrderResourcePane, type WorkOrderResourceOption } from './work-order-resource-pane';
import { WorkOrderValidationPane } from './work-order-validation-pane';

const t = messages.workOrder.editor;
const idOrNull = (value: string): number | null =>
  /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
const options = (lookup: LookupSource, current: string): WorkOrderResourceOption[] =>
  selectableLookupOptions(lookup, current);
const entry = (value: number, code: string, name: string, isActive: boolean) => ({
  value: String(value),
  label: `${code} · ${name}`,
  isActive,
});
const workOrderFactEquals = (left: WorkOrderFact, right: WorkOrderFact): boolean =>
  Object.entries(left).every(([field, value]) => right[field as keyof WorkOrderFact] === value);
export interface WorkOrderAssignmentEditorSessionProps {
  workOrder: WorkOrderFact;
  plantId: number | null;
  /** 생산계획의 계획일 — 교대를 고르면 이 날짜로 계획 시각을 다시 낸다. */
  planDate: string | null;
  priorityText: string;
  blockedReason?: string | null;
  onPriorityChange: (value: string) => void;
  onReload: () => void;
  onSaved?: (saved: WorkOrderFact) => boolean;
}
export const WorkOrderAssignmentEditorSession = ({
  workOrder,
  plantId,
  planDate,
  priorityText,
  blockedReason = null,
  onPriorityChange,
  onReload,
  onSaved,
}: WorkOrderAssignmentEditorSessionProps) => {
  const toast = useToast();
  const seeded = workOrderAssignmentDraftFrom(workOrder);
  const [baseline, setBaseline] = useState(seeded);
  const [draft, setDraft] = useState(seeded);
  const [writeOwnerMismatch, setWriteOwnerMismatch] = useState(false);
  const effectiveDraft = { ...draft, priorityNo: priorityText };
  const validation = validateWorkOrderAssignmentDraft(effectiveDraft);
  const lineId = idOrNull(effectiveDraft.productionLineId);
  const lines = useWorkOrderProductionLines(plantId, 1);
  /* 라인을 바꾸면 기본 위치 셋을 그 라인 기본값으로 덮어쓴다 — 앞 라인의 위치가 남으면 자재가 엉뚱한 곳으로 나간다. */
  const lineDefaultDraft = (
    productionLineId: string,
  ): Pick<
    WorkOrderAssignmentDraft,
    'defaultWipLocationId' | 'defaultFgLocationId' | 'defaultScrapLocationId'
  > => {
    const line = lines.data?.items.find(
      (item) => String(item.productionLineId) === productionLineId,
    );
    const text = (id: number | null | undefined): string => (id == null ? '' : String(id));
    return {
      defaultWipLocationId: text(line?.defaultWipLocationId),
      defaultFgLocationId: text(line?.defaultFgLocationId),
      defaultScrapLocationId: text(line?.defaultScrapLocationId),
    };
  };
  const equipments = useWorkOrderEquipments(plantId, lineId, 1);
  /* 작업자는 창에서 찾아 고른다(사용자 지시 2026-09-20) — 첫 쪽은 저장된 값의 이름을 풀 때 쓴다. */
  const workers = useWorkOrderWorkers(plantId, 1);
  /*
   * ⛔ 고른 작업자가 지금 쪽(첫 쪽·검색 결과)에 없어도 이름이 사라지면 안 된다 — 한 번 본
   *    작업자를 기억하고, 처음부터 못 본 저장값은 그 한 명만 따로 묻는다.
   */
  const seenWorkers = useRef(new Map<number, WorkOrderWorkerFact>());
  useEffect(() => {
    for (const worker of workers.data?.items ?? [])
      seenWorkers.current.set(worker.workerId, worker);
  });
  const selectedWorkerId = idOrNull(effectiveDraft.responsibleWorkerId);
  const listedWorker =
    selectedWorkerId === null
      ? undefined
      : (workers.data?.items.find((worker) => worker.workerId === selectedWorkerId) ??
        seenWorkers.current.get(selectedWorkerId));
  const selectedWorker = useWorkOrderWorker(
    selectedWorkerId !== null && workers.data !== undefined && listedWorker === undefined
      ? selectedWorkerId
      : null,
  );
  const keptWorker = listedWorker ?? selectedWorker.data;
  const molds = useWorkOrderMolds(plantId, 1);
  const shifts = useWorkOrderShifts(plantId, 1);
  const locations = useWorkOrderLocations(plantId);
  const validationQuery = useWorkOrderValidation(workOrder.workOrderId);
  const recommendations = useWorkOrderResourceRecommendations(workOrder.workOrderId);
  /*
   * 설비·금형도 작업자와 같은 규칙이다 — 목록은 한 쪽(설비는 라인별)만 받는데 자동 배정·추천은
   * 그 밖의 값을 넣는다. 본 것을 기억하고, 추천이 아는 이름을 쓰고, 그래도 모르면 한 건만 묻는다.
   */
  const seenEquipments = useRef(new Map<number, WorkOrderEquipmentFact>());
  const seenMolds = useRef(new Map<number, WorkOrderMoldFact>());
  useEffect(() => {
    for (const item of equipments.data?.items ?? [])
      seenEquipments.current.set(item.equipmentId, item);
    for (const item of molds.data?.items ?? []) seenMolds.current.set(item.moldId, item);
  });
  const selectedEquipmentId = idOrNull(effectiveDraft.plannedEquipmentId);
  const listedEquipment =
    selectedEquipmentId === null
      ? undefined
      : (equipments.data?.items.find((item) => item.equipmentId === selectedEquipmentId) ??
        seenEquipments.current.get(selectedEquipmentId));
  const recommendedEquipment = recommendations.data?.equipments.find(
    (item) => item.equipmentId === selectedEquipmentId,
  );
  const fetchedEquipment = useWorkOrderEquipment(
    selectedEquipmentId !== null &&
      equipments.data !== undefined &&
      /* 추천에 실려 오면 따로 묻지 않는다 — 추천 응답을 기다린 뒤에 판단한다. */
      !recommendations.isPending &&
      listedEquipment === undefined &&
      recommendedEquipment === undefined
      ? selectedEquipmentId
      : null,
  );
  const selectedMoldId = idOrNull(effectiveDraft.plannedMoldId);
  const listedMold =
    selectedMoldId === null
      ? undefined
      : (molds.data?.items.find((item) => item.moldId === selectedMoldId) ??
        seenMolds.current.get(selectedMoldId));
  const recommendedMold = recommendations.data?.molds.find(
    (item) => item.moldId === selectedMoldId,
  );
  const fetchedMold = useWorkOrderMold(
    selectedMoldId !== null &&
      molds.data !== undefined &&
      !recommendations.isPending &&
      listedMold === undefined &&
      recommendedMold === undefined
      ? selectedMoldId
      : null,
  );
  /* 다른 공장의 것은 덧붙이지 않는다 — 목록과 같은 소유 규칙이다. */
  const ownEquipment = (item: WorkOrderEquipmentFact | undefined): LookupEntry | undefined =>
    item === undefined || item.plantId !== plantId
      ? undefined
      : entry(item.equipmentId, item.equipmentCode, item.equipmentName, item.isActive);
  const ownMold = (item: WorkOrderMoldFact | undefined): LookupEntry | undefined =>
    item === undefined || item.plantId !== plantId
      ? undefined
      : entry(item.moldId, item.moldCode, item.moldName, item.isActive);
  const keptEquipment =
    ownEquipment(listedEquipment) ??
    (recommendedEquipment === undefined || plantId === null
      ? ownEquipment(fetchedEquipment.data)
      : entry(
          recommendedEquipment.equipmentId,
          recommendedEquipment.equipmentCode,
          recommendedEquipment.equipmentName,
          true,
        ));
  const keptMold =
    ownMold(listedMold) ??
    (recommendedMold === undefined || plantId === null
      ? ownMold(fetchedMold.data)
      : entry(recommendedMold.moldId, recommendedMold.moldCode, recommendedMold.moldName, true));
  const update = useUpdateWorkOrder({
    workOrderId: workOrder.workOrderId,
    onSuccess: (saved) => {
      if (!isExactWorkOrderDetail(workOrder.workOrderId, saved)) {
        setWriteOwnerMismatch(true);
        return;
      }
      if (onSaved?.(saved) === false) return;
      setWriteOwnerMismatch(false);
      const next = workOrderAssignmentDraftFrom(saved);
      setBaseline(next);
      setDraft(next);
      onPriorityChange(next.priorityNo);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });
  const patch = (next: Partial<WorkOrderAssignmentDraft>): void => {
    if (next.priorityNo !== undefined) onPriorityChange(next.priorityNo);
    setDraft((current) => ({
      ...current,
      ...next,
      ...(next.productionLineId === undefined || next.productionLineId === current.productionLineId
        ? {}
        : {
            /* 추천 설비는 라인과 함께 온다 — 그때는 고른 설비를 지우지 않는다. */
            plannedEquipmentId: next.plannedEquipmentId ?? '',
            ...lineDefaultDraft(next.productionLineId),
          }),
      /* 교대를 바꾸면 계획 시각을 따라 바꾼다 — 칸은 남겨 두어 여러 날 작업처럼 예외는 손으로 고친다. */
      ...(next.plannedShiftId === undefined ||
      next.plannedShiftId === current.plannedShiftId ||
      planDate === null
        ? {}
        : plannedWindowLocal(planDate, next.plannedShiftId, shifts.data?.items ?? [])),
    }));
    setWriteOwnerMismatch(false);
    update.reset();
  };
  const lookupNote = (lookup: LookupSource, truncated: boolean | undefined): string | undefined =>
    plantId === null
      ? t.lookup.noPlant
      : lookup.isError
        ? t.lookup.failed
        : lookup.isLoading
          ? t.lookup.loading
          : truncated
            ? t.lookup.truncated
            : undefined;
  /* 창이 서버에서 찾으므로 「일부만 보인다」는 안내는 더 두지 않는다 — 실패·대기만 알린다. */
  const workerNote = (): string | undefined =>
    workerSource.isError || workerSource.isLoading ? lookupNote(workerSource, false) : undefined;
  const lineSource = toOwnedResourceLookup(
    { items: lines.data?.items ?? [], plantId, isPending: lines.isPending, isError: lines.isError },
    (item) => entry(item.productionLineId, item.lineCode, item.lineName, item.isActive),
  );
  const equipmentSource = withKeptEntry(
    toOwnedResourceLookup(
      {
        items: equipments.data?.items ?? [],
        plantId,
        isPending: equipments.isPending,
        isError: equipments.isError,
      },
      (item) => entry(item.equipmentId, item.equipmentCode, item.equipmentName, item.isActive),
    ),
    keptEquipment,
  );
  const workerItems = workers.data?.items ?? [];
  const workerSource = toOwnedResourceLookup(
    {
      items:
        keptWorker === undefined ||
        keptWorker.plantId !== plantId ||
        workerItems.some((worker) => worker.workerId === keptWorker.workerId)
          ? workerItems
          : [keptWorker, ...workerItems],
      plantId,
      isPending: workers.isPending,
      isError: workers.isError,
    },
    (item) => entry(item.workerId, item.workerNo, item.workerName, item.isActive),
  );
  const moldSource = withKeptEntry(
    toOwnedResourceLookup(
      {
        items: molds.data?.items ?? [],
        plantId,
        isPending: molds.isPending,
        isError: molds.isError,
      },
      (item) => entry(item.moldId, item.moldCode, item.moldName, item.isActive),
    ),
    keptMold,
  );
  const shiftSource = toOwnedResourceLookup(
    {
      items: shifts.data?.items ?? [],
      plantId,
      isPending: shifts.isPending,
      isError: shifts.isError,
    },
    (item) =>
      entry(
        item.shiftId,
        item.shiftCode,
        /* 근무 시간은 `HH:mm ~ HH:mm`(⭐ 관리웹 날짜 표기 통일 · 사용자 지시 2026-10-19). */
        `${item.shiftName} (${formatDateRange(formatTimeOfDay(item.startTime), formatTimeOfDay(item.endTime))})`,
        item.isActive,
      ),
  );
  /* 칸마다 맞는 창고 유형의 위치만 고르게 한다 — 완제품 칸에 일반 창고 위치가 섞이지 않게. */
  const locationSource = (field: keyof typeof LINE_LOCATION_WAREHOUSE_TYPES): LookupSource => ({
    entries: locations.items
      .filter((item) => item.warehouseTypeCode === LINE_LOCATION_WAREHOUSE_TYPES[field])
      .map((item) => ({
        ...entry(item.locationId, item.locationCode, item.locationName, item.isActive),
        label:
          item.warehouseCode === null
            ? `${item.locationCode} · ${item.locationName}`
            : `[${item.warehouseCode} ${item.warehouseName ?? ''}] ${item.locationCode} · ${item.locationName}`,
      })),
    isLoading: locations.isPending,
    isError: locations.isError,
  });
  const fieldErrors = mergeWorkOrderAssignmentFieldErrors(
    Object.fromEntries(
      Object.entries(validation.fieldErrors).map(([field, error]) => [
        field,
        workOrderFieldErrorMessage(error),
      ]),
    ),
    update.fieldErrors,
  );
  const validationBlockedReason = validationQuery.isError ? t.validationBlocked : null;
  const lockReason = update.isSaving
    ? messages.workOrder.assignmentActions.reasons.saving
    : (blockedReason ?? validationBlockedReason);
  const validationError: ReactNode = validationQuery.isError ? (
    <AlertBanner
      variant="error"
      action={
        <Button size="sm" variant="outlined" onClick={() => void validationQuery.refetch()}>
          {messages.common.retry}
        </Button>
      }
    >
      {t.validationFailed}
    </AlertBanner>
  ) : null;

  return (
    <div className="work-order-assignment-editor">
      <SaveErrorBanner error={update.error} onReload={onReload} />
      {writeOwnerMismatch && <AlertBanner variant="error">{t.writeOwnerMismatch}</AlertBanner>}
      {/* W/O 번호는 여기서 한 번만 — 아래 두 구획은 제 역할 이름만 단다(사용자 지시 2026-09-20). */}
      <h2 className="work-order-assignment-selected">
        {messages.workOrder.screen.view.selectedHeading(workOrder.workOrderNo)}
      </h2>
      <div className="work-order-assignment-edit-grid">
        <WorkOrderResourcePane
          selectedWorkOrderNo={workOrder.workOrderNo}
          draft={effectiveDraft}
          productionLineOptions={options(lineSource, effectiveDraft.productionLineId)}
          plannedEquipmentOptions={options(equipmentSource, effectiveDraft.plannedEquipmentId)}
          responsibleWorkerOptions={options(workerSource, effectiveDraft.responsibleWorkerId)}
          plannedMoldOptions={options(moldSource, effectiveDraft.plannedMoldId)}
          plannedShiftOptions={options(shiftSource, effectiveDraft.plannedShiftId)}
          defaultWipLocationOptions={options(
            locationSource('defaultWipLocationId'),
            effectiveDraft.defaultWipLocationId,
          )}
          defaultFgLocationOptions={options(
            locationSource('defaultFgLocationId'),
            effectiveDraft.defaultFgLocationId,
          )}
          defaultScrapLocationOptions={options(
            locationSource('defaultScrapLocationId'),
            effectiveDraft.defaultScrapLocationId,
          )}
          fieldErrors={fieldErrors}
          recommendations={toRecommendationChips(recommendations.data)}
          plantId={plantId}
          fieldNotes={{
            productionLineId: lookupNote(lineSource, lines.data?.truncated),
            plannedEquipmentId: lookupNote(equipmentSource, equipments.data?.truncated),
            responsibleWorkerId: workerNote(),
            plannedMoldId: lookupNote(moldSource, molds.data?.truncated),
            plannedShiftId: lookupNote(shiftSource, shifts.data?.truncated),
            defaultWipLocationId: lookupNote(
              locationSource('defaultWipLocationId'),
              locations.truncated,
            ),
            defaultFgLocationId: lookupNote(
              locationSource('defaultFgLocationId'),
              locations.truncated,
            ),
            defaultScrapLocationId: lookupNote(
              locationSource('defaultScrapLocationId'),
              locations.truncated,
            ),
          }}
          disabled={lockReason !== null}
          disabledReason={lockReason ?? undefined}
          onChange={patch}
        />
        <WorkOrderPlanFieldsPane
          selectedWorkOrderNo={workOrder.workOrderNo}
          draft={effectiveDraft}
          fieldErrors={fieldErrors}
          disabled={lockReason !== null}
          disabledReason={lockReason ?? undefined}
          onChange={patch}
        />
      </div>
      <WorkOrderValidationPane
        selectedWorkOrderNo={workOrder.workOrderNo}
        report={validationQuery.data}
        isInitialLoading={validationQuery.isPending && validationQuery.data === undefined}
        isRefreshing={validationQuery.isFetching && validationQuery.data !== undefined}
        loadError={validationError}
        summaryChipSize="md"
        checkScope={{
          hasEquipment: workOrder.plannedEquipmentId !== null,
          hasMold: workOrder.plannedMoldId !== null,
          hasWorker: workOrder.responsibleWorkerId !== null,
        }}
      />
      <WorkOrderAssignmentActions
        draft={effectiveDraft}
        isDirty={!workOrderDraftEquals(baseline, effectiveDraft)}
        isSaving={update.isSaving}
        blockedReason={blockedReason ?? validationBlockedReason}
        onValidate={() => void validationQuery.refetch()}
        onReset={() => {
          setDraft(baseline);
          onPriorityChange(baseline.priorityNo);
          setWriteOwnerMismatch(false);
          update.reset();
        }}
        onSave={() => {
          const body = toWorkOrderAssignmentUpdate(effectiveDraft);
          if (body !== null) update.write(body);
        }}
      />
    </div>
  );
};

export interface WorkOrderAssignmentEditorProps {
  workOrderId: number;
  plantId: number | null;
  planDate: string | null;
  priorityText: string;
  blockedReason?: string | null;
  onPriorityChange: (value: string) => void;
}

const WorkOrderAssignmentEditorOwner = (props: WorkOrderAssignmentEditorProps) => {
  const detail = useWorkOrderDetail(props.workOrderId);
  const [reloadKey, setReloadKey] = useState(0);
  const acceptedDetailRef = useRef<WorkOrderFact | undefined>(undefined);
  const supersededDetailRef = useRef<{ detail: WorkOrderFact; dataUpdatedAt: number } | undefined>(
    undefined,
  );
  const activeRef = useRef(true);
  const exactDetail = isExactWorkOrderDetail(props.workOrderId, detail.data)
    ? detail.data
    : undefined;
  if (acceptedDetailRef.current === undefined && exactDetail !== undefined) {
    acceptedDetailRef.current = exactDetail;
  }
  let acceptedDetail = acceptedDetailRef.current;
  if (
    acceptedDetail !== undefined &&
    exactDetail !== undefined &&
    exactDetail !== acceptedDetail &&
    workOrderFactEquals(acceptedDetail, exactDetail)
  ) {
    acceptedDetailRef.current = exactDetail;
    supersededDetailRef.current = undefined;
    acceptedDetail = exactDetail;
  }
  const ownerMismatch = detail.data !== undefined && exactDetail === undefined;
  const isSupersededSnapshot =
    exactDetail !== undefined &&
    exactDetail === supersededDetailRef.current?.detail &&
    detail.dataUpdatedAt === supersededDetailRef.current.dataUpdatedAt;
  const hasNewerDetail =
    exactDetail !== undefined && exactDetail !== acceptedDetail && !isSupersededSnapshot;
  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);
  const applyDetail = (next: WorkOrderFact): void => {
    supersededDetailRef.current = undefined;
    acceptedDetailRef.current = next;
    props.onPriorityChange(String(next.priorityNo));
    setReloadKey((value) => value + 1);
  };
  const retry = (
    <Button size="sm" variant="outlined" onClick={() => void detail.refetch()}>
      {messages.common.retry}
    </Button>
  );

  if (detail.isPending && acceptedDetail === undefined) {
    return (
      <div role="status" aria-label={t.loading}>
        <SkeletonText lines={5} />
      </div>
    );
  }
  if (acceptedDetail === undefined) {
    return (
      <AlertBanner
        variant="error"
        title={ownerMismatch ? t.ownerMismatch : t.failed}
        action={retry}
      />
    );
  }
  const refreshIssue = ownerMismatch
    ? { title: t.ownerMismatch, description: t.staleDescription, action: retry }
    : detail.isError
      ? { title: t.staleTitle, description: t.staleDescription, action: retry }
      : hasNewerDetail
        ? {
            title: t.changedTitle,
            description: t.changedDescription,
            action: (
              <Button
                size="sm"
                variant="outlined"
                onClick={() => {
                  if (exactDetail !== undefined) applyDetail(exactDetail);
                }}
              >
                {messages.conflict.reloadAction}
              </Button>
            ),
          }
        : null;

  return (
    <>
      {refreshIssue !== null && (
        <AlertBanner variant="error" title={refreshIssue.title} action={refreshIssue.action}>
          {refreshIssue.description}
        </AlertBanner>
      )}
      <WorkOrderAssignmentEditorSession
        key={`${String(props.workOrderId)}:${String(reloadKey)}`}
        {...props}
        workOrder={acceptedDetail}
        blockedReason={
          refreshIssue === null
            ? (props.blockedReason ?? null)
            : hasNewerDetail
              ? t.changedBlocked
              : t.staleBlocked
        }
        onSaved={(saved) => {
          if (!activeRef.current) return false;
          const supersededDetail = exactDetail ?? acceptedDetailRef.current;
          supersededDetailRef.current =
            supersededDetail === undefined
              ? undefined
              : { detail: supersededDetail, dataUpdatedAt: detail.dataUpdatedAt };
          acceptedDetailRef.current = saved;
          return true;
        }}
        onReload={() =>
          void detail.refetch().then((result) => {
            if (
              activeRef.current &&
              canApplyWorkOrderReload(props.workOrderId, result) &&
              result.data !== undefined
            ) {
              applyDetail(result.data);
            }
          })
        }
      />
    </>
  );
};

export const WorkOrderAssignmentEditor = (props: WorkOrderAssignmentEditorProps) => (
  <WorkOrderAssignmentEditorOwner key={String(props.workOrderId)} {...props} />
);
