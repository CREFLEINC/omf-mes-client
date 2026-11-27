import {
  EquipmentAssignmentPicker,
  EquipmentOccupancy,
  EquipmentStatus,
} from './equipment-occupancy';
import { useEquipmentOccupancy } from './equipment-occupancy-query';
import { allocationStatus } from './equipment-occupancy-model';
import { plantToday } from '../../../patterns/plant-time';
import { useProductionPlanDetail } from '../../production-plan/queries';
import { useRoutingOperations } from '../../routing/queries';
import { useWarehouseArrival } from './arrival-location';
import type { ProductionOrderFact } from '../types';
import { AlertBanner, Button, Chip, SkeletonText, Tooltip, useToast } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { DateTimeField } from '../../../patterns/date-time-field';
import { locationOptionLabel } from '../../../patterns/location-label';
import { ReferenceField, type ReferenceRow } from '../../../patterns/reference-picker';
import { PagedSelect } from '../../../patterns/select';
import { SaveErrorBanner } from '../../../patterns/master';
import {
  useWorkOrderEquipment,
  useWorkOrderLocations,
  useWorkOrderProductionLines,
  useWorkOrderShifts,
} from '../../work-order/resource-queries';
import { useWorkOrderMold, useWorkOrderWorker } from '../../work-order/people-tool-queries';
import {
  plannedWindowLocal,
  REQUIRED_ASSIGNMENT_FIELDS,
  toWorkOrderAssignmentUpdate,
  validateWorkOrderAssignmentDraft,
  workOrderAssignmentDraftFrom,
  type WorkOrderAssignmentDraft,
} from '../../work-order/assignment-model';
import { useUpdateWorkOrder } from '../../work-order/mutations';
import {
  useWorkOrderDetail,
  useWorkOrderResourceRecommendations,
  useWorkOrderValidation,
  type WorkOrderFact,
} from '../../work-order/queries';
import {
  toRecommendationChips,
  type ResourceRecommendationChip,
} from '../../work-order/resource-recommendation';
import { workOrderDraftEquals, workOrderFieldErrorMessage } from '../../work-order/screen-model';
import { invalidateFlow } from '../release-runner';
import { readableFinding } from './finding-text';
import {
  useEquipmentSource,
  useLineSource,
  useLocationSource,
  useMoldSource,
} from './reference-sources';

/**
 * 4M 배정 편집 영역(T-W-C 「대상 안의 하위 항목」, C-20 재사용 부품 점검 반영).
 * 업무 로직(초안, 검증, 저장, 추천, 교대에 따른 계획 시각)은 기존 W-02-03 모델을 쓰고 표시만 규범대로 바꿨다.
 * - 3열 격자, 상자 안 상자 없음, 묶음 소제목(설비, 작업자, 위치, 계획)
 * - 라인, 설비, 금형, 작업자, 위치는 참조 선택 팝업(C-12), 교대는 Select, 계획 시각은 DateTimeField
 * - 채움 버튼 없음. [저장]은 테두리이고 주 동작은 하단 바다(C-3, C-19)
 * - 자동으로 채워지는 값(라인 기본 위치, 교대 기준 계획 시각)은 요약 한 줄과 [변경]으로 접는다. 값을 정하는 칸
 *   (생산 라인, 계획 교대)을 고른 뒤에도 비었거나, 오류가 있거나, 점검이 그 값을 막으면 펼친다(T-W-C 높이가 모자랄 때 ①).
 *   우선순위는 계획 묶음과 함께 접는다.
 */
const t = messages.erpWorkOrderFlow.process.assign;

type IdField = Exclude<
  keyof WorkOrderAssignmentDraft,
  'plannedStartAtLocal' | 'plannedEndAtLocal' | 'priorityNo'
>;

const idOrNull = (value: string): number | null =>
  /^[1-9]\d*$/.test(value) ? Number(value) : null;

const LOCATION_FIELDS = ['defaultFgLocationId'] as const;
const isLocationField = (field: string): field is (typeof LOCATION_FIELDS)[number] =>
  (LOCATION_FIELDS as readonly string[]).includes(field);
const PLAN_FIELDS = ['plannedStartAtLocal', 'plannedEndAtLocal', 'priorityNo'] as const;
/* 점검 지적의 칸 이름으로 접힌 묶음을 펼칠지 정한다. */
const LOCATION_FINDING = /location/i;
const PLAN_FINDING = /planned(start|end)|priority/i;

const dateTimeText = (value: string): string => value.replace('T', ' ');

interface FoldPair {
  label: string;
  value: string;
  unset?: boolean;
}

/**
 * 접힌 묶음의 요약과 [변경](T-W-C 높이가 모자랄 때 ①). 값은 지난 단계 요약 형식처럼 「라벨 값」 쌍으로 쓰고,
 * 한 줄에 다 들어가지 않으면 쌍 단위로 줄을 바꾼다(쌍 안에서는 줄바꿈하지 않는다). 고른 값을 자르지 않는다.
 */
const FoldLine = ({
  label,
  pairs,
  disabled,
  onExpand,
}: {
  label: string;
  pairs: FoldPair[];
  disabled: boolean;
  onExpand: () => void;
}) => (
  <div className="assign-fold">
    <span className="assign-fold-label">{label}</span>
    <dl className="assign-fold-pairs">
      {pairs.map((pair) => (
        <div key={pair.label} className="assign-fold-pair">
          {pair.label !== '' && <dt>{pair.label}</dt>}
          <dd className={pair.unset === true ? 'is-unset' : undefined}>{pair.value}</dd>
        </div>
      ))}
    </dl>
    <Button
      size="sm"
      variant="outlined"
      disabled={disabled}
      aria-label={t.fold.changeLabel(label)}
      onClick={onExpand}
    >
      {t.fold.change}
    </Button>
  </div>
);

const RecommendationLinks = ({
  label,
  chips,
  value,
  disabled,
  onPick,
}: {
  label: string;
  chips: ResourceRecommendationChip[];
  value: string;
  disabled: boolean;
  onPick: (chip: ResourceRecommendationChip) => void;
}) => {
  const candidates = chips.filter((chip) => chip.value !== value);
  if (candidates.length === 0) return null;
  return (
    <span className="assign-recommend" role="group" aria-label={t.recommend.group(label)}>
      {candidates.slice(0, 2).map((chip) => (
        <Button
          key={chip.value}
          size="sm"
          variant="outlined"
          disabled={disabled}
          title={chip.label}
          aria-label={t.recommend.apply(label, chip.label)}
          onClick={() => onPick(chip)}
        >
          {t.recommend.chip(chip.code)}
        </Button>
      ))}
    </span>
  );
};

/** 표의 한 줄로 그릴 때 줄 앞쪽에 쓰는 값과 줄 고르기(시안 B · 사용자 결정 2026-11-27). */
export interface AssignRowInfo {
  workOrderNo: string;
  operationName: string;
  planDate: string;
  quantity: string;
  lineName?: string;
  selected: boolean;
  /** 읽기 전용(배포 뒤)에서 점검 대신 보일 상태 칩. */
  status?: ReactNode;
  columnCount: number;
  onFocus: () => void;
}

/** 표 아래 단추가 줄마다 부르는 동작. */
export interface AssignRowHandle {
  save: () => Promise<void>;
  reset: () => void;
  check: () => void;
}

/**
 * 표 칸의 일시 — 「11-27 08:00」 한 칸으로 보이고, 누르면 날짜 · 시각을 고르는 판이 열린다(사용자 지시 2026-11-27).
 * 판은 `body` 에 고정 위치로 그린다 — 표가 넘치는 칸을 자르기 때문이다. 표 안의 다른 곳을 누르거나 Esc 로 닫는다.
 * 달력 · 시각 목록은 판 밖(`body`)에 펼쳐질 수 있어, 「판 밖을 눌렀다」가 아니라 「화면 본문을 눌렀다」로 닫는다.
 */
const DateTimeCell = ({
  label,
  value,
  disabled,
  invalid,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  invalid: boolean;
  onChange: (value: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent): void => {
      if (!(event.target instanceof Element)) return;
      if (panelRef.current?.contains(event.target) || buttonRef.current?.contains(event.target))
        return;
      if (event.target.closest('.process-page, .action-bar') !== null) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onScroll = (event: Event): void => {
      if (event.target instanceof Node && panelRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="erp-wo-assign-datetime"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => {
          const rect = buttonRef.current?.getBoundingClientRect();
          if (rect !== undefined)
            setAt({
              top: rect.bottom + 4,
              left: Math.max(8, Math.min(rect.left, window.innerWidth - 320)),
            });
          setOpen((current) => !current);
        }}
      >
        {value === '' ? (
          <span className="erp-wo-assign-datetime-empty">선택</span>
        ) : (
          dateTimeText(value).slice(5)
        )}
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="erp-wo-assign-datetime-panel"
            role="dialog"
            aria-label={label}
            style={{ top: at.top, left: at.left }}
          >
            <DateTimeField
              minDate={plantToday()}
              timePicker
              size="md"
              label={label}
              value={value}
              invalid={invalid}
              onChange={onChange}
            />
            <Button size="sm" variant="outlined" onClick={() => setOpen(false)}>
              {messages.common.close}
            </Button>
          </div>,
          document.body,
        )}
    </>
  );
};

interface EditorSessionProps {
  /** 주면 편집 영역 대신 표의 한 줄(`<tr>`)로 그린다. 편집 로직은 같다. */
  row?: AssignRowInfo;
  onRegister?: (handle: AssignRowHandle | null) => void;
  readOnly?: boolean;
  actionTargetId?: string;
  summary?: string;
  /** 편집 중인 W/O(번호와 공정). 편집 영역 제목이다. */
  title: string;
  workOrder: WorkOrderFact;
  plantId: number | null;
  erpStorage?: Pick<ProductionOrderFact, 'erpStorageLocationCode' | 'erpStorageWarehouse'>;
  planDate: string | null;
  onDirtyChange: (dirty: boolean) => void;
  /** 저장이 끝나고 점검을 다시 받은 뒤. `ready`는 배포 가능 판정(필수 칸과 점검 차단 없음)이다. */
  onSaved: (ready: boolean) => void;
}

const EditorSession = ({
  row,
  onRegister,
  readOnly = false,
  actionTargetId,
  summary,
  title,
  workOrder,
  plantId,
  erpStorage,
  planDate,
  onDirtyChange,
  onSaved,
}: EditorSessionProps) => {
  const [actionTarget, setActionTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setActionTarget(actionTargetId === undefined ? null : document.getElementById(actionTargetId));
  }, [actionTargetId]);
  const toast = useToast();
  const seeded = workOrderAssignmentDraftFrom(workOrder);
  const [baseline, setBaseline] = useState(seeded);
  const [draft, setDraft] = useState(seeded);
  /* 팝업과 추천에서 방금 고른 값의 이름. 「칸:번호」로 둔다(값이 바뀌면 자연히 쓰이지 않는다). */
  const occupancy = useEquipmentOccupancy(
    idOrNull(draft.plannedEquipmentId),
    workOrder.workOrderId,
  );
  const [checkingOccupancy, setCheckingOccupancy] = useState(false);
  const [occupancyError, setOccupancyError] = useState('');
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [revealErrors, setRevealErrors] = useState(false);
  const [locationOpen, setLocationOpen] = useState(true);
  /* 라인 기본 위치를 채울지 판단을 마쳤는가. 마치기 전에는 비어 보여도 펼치지 않는다. */
  const [prefillSettled, setPrefillSettled] = useState(false);
  const [planOpen, setPlanOpen] = useState(true);
  const errorIdPrefix = useId();
  const headingId = useId();
  const lines = useWorkOrderProductionLines(plantId, 1);
  const shifts = useWorkOrderShifts(plantId, 1);
  const locations = useWorkOrderLocations(plantId);
  const equipment = useWorkOrderEquipment(idOrNull(draft.plannedEquipmentId));
  const mold = useWorkOrderMold(idOrNull(draft.plannedMoldId));
  const worker = useWorkOrderWorker(idOrNull(draft.responsibleWorkerId));
  const recommendations = useWorkOrderResourceRecommendations(workOrder.workOrderId);
  const validation = useWorkOrderValidation(workOrder.workOrderId);
  const lineSource = useLineSource(plantId);
  const equipmentSource = useEquipmentSource(plantId, idOrNull(draft.productionLineId));
  const moldSource = useMoldSource(plantId);
  const appliedLocation = locations.items.find(
    (item) => item.locationId === workOrder.defaultFgLocationId,
  );
  const fgSource = useLocationSource(plantId, '', {
    erpCode: workOrder.fgWarehouseDiffersFromErp
      ? workOrder.fgWarehouseCode
      : erpStorage?.erpStorageLocationCode,
    warehouseId: workOrder.fgWarehouseDiffersFromErp
      ? appliedLocation?.warehouseId
      : erpStorage?.erpStorageWarehouse?.id,
  });
  const arrival = useWarehouseArrival(
    erpStorage?.erpStorageLocationCode ? erpStorage.erpStorageWarehouse?.id : undefined,
  );
  useEffect(() => {
    if (readOnly) return;
    const location = arrival.data?.location;
    if (!location || !erpStorage?.erpStorageLocationCode || baseline.defaultFgLocationId !== '')
      return;
    setDraft((current) =>
      current.defaultFgLocationId === ''
        ? { ...current, defaultFgLocationId: String(location.locationId) }
        : current,
    );
  }, [
    readOnly,
    arrival.data,
    erpStorage?.erpStorageLocationCode,
    baseline.defaultFgLocationId,
    draft.defaultFgLocationId,
  ]);
  const dirty = !readOnly && !workOrderDraftEquals(baseline, draft);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const queryClient = useQueryClient();
  const update = useUpdateWorkOrder({
    workOrderId: workOrder.workOrderId,
    onSuccess: (saved) => {
      /* 4M을 저장하면 서버 칩 판정(처리 화면 머리, 작업함, 칩 건수)이 바뀔 수 있다. 저장 경로는 W/O만 무효화하므로 흐름 전체를 다시 읽는다. */
      void invalidateFlow(queryClient);
      const next = workOrderAssignmentDraftFrom(saved);
      setBaseline(next);
      setDraft(next);
      setRevealErrors(false);
      toast.show({ variant: 'success', description: messages.common.saved });
      void validation.refetch().then((result) => {
        const report = result.data;
        onSaved(
          REQUIRED_ASSIGNMENT_FIELDS.every((field) => saved[field] !== null) &&
            report !== undefined &&
            report.passed &&
            !report.findings.some((finding) => finding.severity === 'BLOCK'),
        );
      });
    },
  });

  const lineOf = (id: string) =>
    lines.data?.items.find((item) => String(item.productionLineId) === id);
  /*
   * 라인이 정해진 W/O의 빈 위치만 라인 기본값으로 채운다. 저장된 입고 위치는 보존한다.
   * 라인을 고를 때 채우는 기존 4M 규칙과 같은 값이고, 사용자는 요약을 보고 [저장]만 누르면 된다(T-W-C 높이가 모자랄 때 ①).
   * 저장 전이므로 저장하지 않은 변경으로 다룬다.
   */
  const linesLoaded = lines.data !== undefined || lines.isError;
  useEffect(() => {
    if (readOnly || prefillSettled || !linesLoaded) return;
    setPrefillSettled(true);
    if (baseline.productionLineId === '') {
      return;
    }
    const line = lines.data?.items.find(
      (item) => String(item.productionLineId) === baseline.productionLineId,
    );
    if (line === undefined) return;
    const filled: Partial<WorkOrderAssignmentDraft> = {
      ...(!erpStorage?.erpStorageLocationCode
        ? {
            defaultFgLocationId:
              line.defaultFgLocationId == null ? '' : String(line.defaultFgLocationId),
          }
        : {}),
    };
    if (Object.values(filled).every((value) => value === '')) return;
    setDraft((current) => ({
      ...current,
      ...Object.fromEntries(
        Object.entries(filled).filter(
          ([field]) => current[field as keyof WorkOrderAssignmentDraft] === '',
        ),
      ),
    }));
  }, [
    readOnly,
    baseline,
    lines.data,
    linesLoaded,
    prefillSettled,
    erpStorage?.erpStorageLocationCode,
  ]);
  const patch = (next: Partial<WorkOrderAssignmentDraft>) => {
    if (readOnly) return;
    update.reset();
    setDraft((current) => {
      const merged = { ...current, ...next };
      /* 완제품 입고 목적지는 라인 변경으로 덮어쓰지 않는다. */
      if (
        next.productionLineId !== undefined &&
        next.productionLineId !== current.productionLineId
      ) {
        merged.plannedEquipmentId = next.plannedEquipmentId ?? '';
      }
      if (
        next.plannedShiftId !== undefined &&
        next.plannedShiftId !== current.plannedShiftId &&
        planDate !== null
      ) {
        Object.assign(
          merged,
          plannedWindowLocal(planDate, next.plannedShiftId, shifts.data?.items ?? []),
        );
      }
      return merged;
    });
  };
  const pick = (
    field: IdField,
    picked: ReferenceRow,
    extra: Partial<WorkOrderAssignmentDraft> = {},
  ) => {
    setLabels((current) => ({
      ...current,
      /* 위치는 「코드 · 별칭」(#267) — 고르기 표의 이름 칸이 이미 별칭 → 이름이다(`reference-sources.ts`). */
      [`${field}:${String(picked.id)}`]: isLocationField(field)
        ? locationOptionLabel({ locationCode: picked.code, locationName: picked.name })
        : field === 'productionLineId' && row !== undefined
          ? picked.name
          : named(picked.name, picked.code),
    }));
    patch({ ...extra, [field]: String(picked.id) });
  };

  const validationResult = validateWorkOrderAssignmentDraft(draft);
  const errorOf = (field: keyof WorkOrderAssignmentDraft): string | undefined => {
    const error = validationResult.fieldErrors[field] ?? undefined;
    const server = update.fieldErrors[field];
    if (server !== undefined) return server;
    if (error === undefined) return undefined;
    if (error === 'REQUIRED' && !revealErrors) return undefined;
    return workOrderFieldErrorMessage(error);
  };
  const locationLabel = (id: string) => {
    const item = locations.items.find((entry) => String(entry.locationId) === id);
    return item === undefined ? '' : locationOptionLabel(item);
  };
  const labelOf = (field: IdField): string => {
    const value = draft[field];
    if (value === '') return '';
    const known = labels[`${field}:${value}`];
    if (known !== undefined) return known;
    switch (field) {
      case 'productionLineId': {
        const line = lineOf(value);
        /* 표에서는 생산 라인을 이름만 쓴다 — 코드는 붙이지 않는다(사용자 지시 2026-11-27). */
        return line === undefined
          ? ''
          : row !== undefined
            ? line.lineName
            : named(line.lineName, line.lineCode);
      }
      case 'plannedEquipmentId':
        return equipment.data === undefined
          ? ''
          : named(equipment.data.equipmentName, equipment.data.equipmentCode);
      case 'plannedMoldId':
        return mold.data === undefined ? '' : named(mold.data.moldName, mold.data.moldCode);
      case 'responsibleWorkerId':
        return worker.data === undefined ? '' : named(worker.data.workerName, worker.data.workerNo);
      default:
        return locationLabel(value);
    }
  };
  const chips = toRecommendationChips(recommendations.data, {
    slotChanged:
      draft.plannedEquipmentId !== baseline.plannedEquipmentId ||
      draft.plannedShiftId !== baseline.plannedShiftId ||
      draft.plannedStartAtLocal !== baseline.plannedStartAtLocal,
  });
  const plan = useProductionPlanDetail(workOrder.productionPlanId);
  const operations = useRoutingOperations(plan.data?.routingId ?? null);
  const operation = operations.data?.items.find(
    (item) => item.routingOperationId === workOrder.routingOperationId,
  );
  const resourceRequired = (field: string) =>
    field === 'plannedEquipmentId'
      ? operation?.equipmentRequired === true
      : field === 'plannedMoldId'
        ? operation?.moldRequired === true
        : field !== 'responsibleWorkerId' && field !== 'plannedShiftId';
  const saving = update.isSaving || checkingOccupancy;
  const required = (field: string) =>
    (REQUIRED_ASSIGNMENT_FIELDS as readonly string[]).includes(field) ||
    ((field === 'plannedEquipmentId' || field === 'plannedMoldId') && resourceRequired(field));
  const errorLine = (field: keyof WorkOrderAssignmentDraft): ReactNode => {
    const error = errorOf(field);
    return error === undefined ? null : (
      <span id={`${errorIdPrefix}-${field}`} className="field-error">
        {error}
      </span>
    );
  };
  const reference = (
    field: IdField,
    label: string,
    source: ReturnType<typeof useLineSource>,
    options: {
      chips?: ResourceRecommendationChip[];
      onPick?: (row: ReferenceRow) => void;
      addon?: ReactNode;
    } = {},
  ) =>
    !resourceRequired(field) ? null : (
      <ReferenceField
        wrapValue
        hideLabel={row !== undefined}
        renderPicker={
          field === 'plannedEquipmentId'
            ? (props) => (
                <EquipmentAssignmentPicker
                  {...props}
                  selfId={workOrder.workOrderId}
                  start={draft.plannedStartAtLocal}
                  end={draft.plannedEndAtLocal}
                />
              )
            : undefined
        }
        size="sm"
        label={label}
        valueLabel={labelOf(field)}
        source={source}
        required={required(field)}
        disabled={saving || readOnly}
        invalid={errorOf(field) !== undefined}
        aria-describedby={errorOf(field) === undefined ? undefined : `${errorIdPrefix}-${field}`}
        labelAddon={
          <>
            {options.addon}
            {options.chips !== undefined && (
              <RecommendationLinks
                label={label}
                chips={options.chips}
                value={draft[field]}
                disabled={saving || readOnly}
                onPick={(chip) => {
                  setLabels((current) => ({ ...current, [`${field}:${chip.value}`]: chip.label }));
                  patch(
                    chip.productionLineId === null
                      ? { [field]: chip.value }
                      : { productionLineId: chip.productionLineId, [field]: chip.value },
                  );
                }}
              />
            )}
          </>
        }
        onPick={options.onPick ?? ((row) => pick(field, row))}
        onClear={() => patch({ [field]: '' })}
      >
        {errorLine(field)}
      </ReferenceField>
    );

  /* 표의 선택 칸이 받아 온 행 — 고른 값의 이름과 설비의 소속 라인을 여기서 찾는다. */
  const fetchedRows = useRef(new Map<string, ReferenceRow>());
  const optionLabel = (field: IdField, found: ReferenceRow): string =>
    isLocationField(field)
      ? locationOptionLabel({ locationCode: found.code, locationName: found.name })
      : field === 'productionLineId'
        ? found.name
        : named(found.name, found.code);
  /**
   * 표 칸의 선택 — 펼치면 검색창이 있고, 찾기 창과 같은 조회를 쓴다(사용자 지시 2026-11-27).
   * 필수가 아닌 칸은 맨 앞 「미지정」으로 비운다.
   */
  const selectCell = (
    field: IdField,
    label: string,
    source: ReturnType<typeof useLineSource>,
    onPickRow?: (found: ReferenceRow) => void,
  ) =>
    !resourceRequired(field) ? null : (
      <PagedSelect
        size="sm"
        aria-label={label}
        aria-required={required(field) || undefined}
        aria-describedby={errorOf(field) === undefined ? undefined : `${errorIdPrefix}-${field}`}
        placeholder="선택"
        queryKey={['production-order', 'assign-row-select', field, ...(source?.key ?? [])]}
        fetchPage={async (query, page) => {
          if (source === null) return { options: [], total: 0 };
          const found = await source.search(query, page, '');
          found.items.forEach((item) =>
            fetchedRows.current.set(`${field}:${String(item.id)}`, item),
          );
          return {
            options: found.items.map((item) => ({
              value: String(item.id),
              label: optionLabel(field, item),
            })),
            total: found.total,
          };
        }}
        leadingOptions={required(field) ? undefined : [{ value: '', label: t.fold.unset }]}
        value={draft[field] === '' ? null : draft[field]}
        selectedOption={draft[field] === '' ? null : { value: draft[field], label: labelOf(field) }}
        disabled={saving || readOnly || source === null}
        invalid={errorOf(field) !== undefined}
        onChange={(value) => {
          if (value === '') {
            patch({ [field]: '' });
            return;
          }
          const found = fetchedRows.current.get(`${field}:${value}`);
          if (found === undefined) patch({ [field]: value });
          else (onPickRow ?? ((picked: ReferenceRow) => pick(field, picked)))(found);
        }}
      />
    );

  const report = validation.data;
  const blocking = report?.findings.find((finding) => finding.severity === 'BLOCK');
  const warning = report?.findings.find((finding) => finding.severity === 'WARN');
  const checkTone =
    report === undefined
      ? 'idle'
      : blocking !== undefined || !report.passed
        ? 'error'
        : warning !== undefined
          ? 'warning'
          : 'success';
  const checkLabel =
    report === undefined
      ? t.check.loading
      : blocking !== undefined || !report.passed
        ? t.check.blocked
        : warning !== undefined
          ? t.check.warning
          : t.check.passed;

  const finding = blocking ?? warning;
  const findingText =
    finding === undefined
      ? null
      : readableFinding(finding.message, {
          equipment:
            equipment.data === undefined
              ? null
              : named(equipment.data.equipmentName, equipment.data.equipmentCode),
          mold: mold.data === undefined ? null : named(mold.data.moldName, mold.data.moldCode),
          worker:
            worker.data === undefined ? null : named(worker.data.workerName, worker.data.workerNo),
        });

  /* 접힌 묶음: 값을 정하는 칸을 고른 뒤에도 비었거나, 오류가 있거나, 점검이 막으면 펼치고, 한 번 펼치면 이 W/O 안에서는 펼친 채 둔다. */
  const blockingFields = (report?.findings ?? [])
    .filter((item) => item.severity === 'BLOCK')
    .map((item) => item.field ?? '');
  const locationNeedsInput =
    (draft.productionLineId !== '' || LOCATION_FIELDS.some((field) => draft[field] !== '')) &&
    draft.defaultFgLocationId === '';
  const planNeedsInput =
    draft.plannedShiftId !== '' &&
    (draft.plannedStartAtLocal === '' || draft.plannedEndAtLocal === '');
  const locationNeedsOpen =
    (prefillSettled && locationNeedsInput) ||
    LOCATION_FIELDS.some((field) => errorOf(field) !== undefined) ||
    blockingFields.some((field) => LOCATION_FINDING.test(field));
  const planNeedsOpen =
    planNeedsInput ||
    PLAN_FIELDS.some((field) => errorOf(field) !== undefined) ||
    blockingFields.some((field) => PLAN_FINDING.test(field));
  if (locationNeedsOpen && !locationOpen) setLocationOpen(true);
  if (planNeedsOpen && !planOpen) setPlanOpen(true);
  const line = lineOf(draft.productionLineId);
  const fromLine =
    line !== undefined &&
    LOCATION_FIELDS.every(
      (field) => draft[field] === (line[field] == null ? '' : String(line[field])),
    );
  const locationNames = {
    defaultFgLocationId: '생산품 입고 창고',
  };
  const locationPairs: FoldPair[] =
    draft.productionLineId === '' && LOCATION_FIELDS.every((field) => draft[field] === '')
      ? [{ label: '', value: t.fold.afterLine }]
      : (['defaultFgLocationId'] as const).map((field) =>
          draft[field] === ''
            ? { label: locationNames[field], value: t.fold.unset, unset: true }
            : {
                label: locationNames[field],
                value:
                  field === 'defaultFgLocationId'
                    ? erpStorage?.erpStorageWarehouse
                      ? `${erpStorage.erpStorageWarehouse.name} (${erpStorage.erpStorageWarehouse.code})`
                      : (locations.items.find(
                          (item) => String(item.locationId) === draft.defaultFgLocationId,
                        )?.warehouseName ?? t.fold.unset)
                    : labelOf(field),
              },
        );
  const shiftWindow =
    draft.plannedShiftId === '' || planDate === null
      ? null
      : plannedWindowLocal(planDate, draft.plannedShiftId, shifts.data?.items ?? []);
  const fromShift =
    shiftWindow !== null &&
    shiftWindow.plannedStartAtLocal === draft.plannedStartAtLocal &&
    shiftWindow.plannedEndAtLocal === draft.plannedEndAtLocal;
  const timePair = (label: string, value: string): FoldPair =>
    value === ''
      ? { label, value: t.fold.unset, unset: true }
      : { label, value: dateTimeText(value) };
  const planPairs: FoldPair[] = [
    timePair(t.fold.start, draft.plannedStartAtLocal),
    timePair(t.fold.end, draft.plannedEndAtLocal),
    { label: t.fold.priority, value: draft.priorityNo },
  ];

  const save = async (): Promise<void> => {
    setRevealErrors(true);
    setOccupancyError('');
    const body = toWorkOrderAssignmentUpdate(draft);
    if (readOnly || body === null) return;
    if (draft.plannedEquipmentId !== '') {
      setCheckingOccupancy(true);
      const latest = await occupancy.refetch();
      setCheckingOccupancy(false);
      if (latest.isError || !latest.data) {
        setOccupancyError('설비 배정 내역을 조회하지 못했습니다. 다시 확인하세요.');
        return;
      }
      const status = allocationStatus(
        latest.data,
        draft.plannedStartAtLocal,
        draft.plannedEndAtLocal,
      );
      if (status !== '중복 없음') {
        setOccupancyError(status);
        return;
      }
    }
    update.write(body);
  };
  const reset = (): void => {
    setDraft(baseline);
    setRevealErrors(false);
    setOccupancyError('');
    update.reset();
  };
  /* 표 아래 단추가 부를 동작을 올려 둔다 — 늘 지금 초안으로 동작하게 참조로 감싼다. */
  const handle = useRef<AssignRowHandle>({ save, reset, check: () => undefined });
  handle.current = { save, reset, check: () => void validation.refetch() };
  useEffect(() => {
    if (onRegister === undefined) return;
    onRegister({
      save: () => handle.current.save(),
      reset: () => handle.current.reset(),
      check: () => handle.current.check(),
    });
    return () => onRegister(null);
    // 줄이 서고 사라질 때 한 번씩만 올린다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveAction = (
    <Button
      size="sm"
      variant={actionTargetId === undefined ? 'outlined' : undefined}
      loading={saving}
      disabled={
        readOnly ||
        !dirty ||
        (draft.plannedEquipmentId !== '' &&
          (occupancy.isPending ||
            occupancy.isError ||
            allocationStatus(
              occupancy.data ?? [],
              draft.plannedStartAtLocal,
              draft.plannedEndAtLocal,
            ) !== '중복 없음'))
      }
      aria-describedby={!dirty ? `${headingId}-save-note` : undefined}
      onClick={() => void save()}
    >
      {t.actions.save}
    </Button>
  );

  if (row !== undefined) {
    const warehouseText = workOrder.fgWarehouseDiffersFromErp
      ? `${appliedLocation?.warehouseName ?? workOrder.fgWarehouseCode} (${workOrder.fgWarehouseCode})`
      : erpStorage?.erpStorageLocationCode
        ? erpStorage.erpStorageWarehouse
          ? `${erpStorage.erpStorageWarehouse.name} (${erpStorage.erpStorageWarehouse.code})`
          : `${erpStorage.erpStorageLocationCode} · 창고 연결 확인 필요`
        : (locations.items.find((item) => String(item.locationId) === draft.defaultFgLocationId)
            ?.warehouseName ?? t.fold.unset);
    const arrivalMissing =
      erpStorage?.erpStorageWarehouse !== undefined &&
      erpStorage.erpStorageWarehouse !== null &&
      (arrival.isError || (arrival.isSuccess && !arrival.data.location));
    const equipmentCell = selectCell(
      'plannedEquipmentId',
      t.fields.plannedEquipmentId,
      equipmentSource,
      (picked) =>
        pick(
          'plannedEquipmentId',
          picked,
          picked.parentId === null ||
            picked.parentId === undefined ||
            String(picked.parentId) === draft.productionLineId
            ? {}
            : { productionLineId: String(picked.parentId) },
        ),
    );
    const moldCell = selectCell('plannedMoldId', t.fields.plannedMoldId, moldSource);
    const recommend = (field: 'plannedEquipmentId' | 'plannedMoldId', label: string) => (
      <RecommendationLinks
        label={label}
        chips={chips[field]}
        value={draft[field]}
        disabled={saving || readOnly}
        onPick={(chip) => {
          setLabels((current) => ({ ...current, [`${field}:${chip.value}`]: chip.label }));
          patch(
            chip.productionLineId === null
              ? { [field]: chip.value }
              : { productionLineId: chip.productionLineId, [field]: chip.value },
          );
        }}
      />
    );
    /* 줄 아래에 붙는 알림 — 저장 오류, 설비 중복, 점검이 막은 까닭. 고른 줄이면 설비 배정 내역도 함께. */
    const notes =
      update.error !== null && update.error !== undefined
        ? true
        : occupancyError !== '' || plan.isError || operations.isError || findingText !== null;
    const showOccupancy =
      row.selected && resourceRequired('plannedEquipmentId') && draft.plannedEquipmentId !== '';
    return (
      <>
        <tr
          className="erp-wo-assign-row"
          data-selected={row.selected || undefined}
          data-dirty={dirty || undefined}
          aria-label={`${row.workOrderNo} ${row.operationName}`}
          onFocusCapture={row.onFocus}
          onClick={row.onFocus}
        >
          <th scope="row" className="nowrap-cell">
            {row.workOrderNo}
          </th>
          <td className="nowrap-cell">{row.operationName}</td>
          <td className="nowrap-cell erp-wo-assign-qty">{row.quantity}</td>
          <td title={labelOf('productionLineId') || undefined}>
            {selectCell('productionLineId', t.fields.productionLineId, lineSource)}
            {errorLine('productionLineId')}
          </td>
          <td>
            {equipmentCell === null ? (
              <span className="erp-wo-assign-none">—</span>
            ) : (
              <div className="erp-wo-assign-cell">
                {equipmentCell}
                {idOrNull(draft.plannedEquipmentId) !== null && (
                  <EquipmentStatus
                    id={Number(draft.plannedEquipmentId)}
                    selfId={workOrder.workOrderId}
                    start={draft.plannedStartAtLocal}
                    end={draft.plannedEndAtLocal}
                  />
                )}
                {recommend('plannedEquipmentId', t.fields.plannedEquipmentId)}
              </div>
            )}
          </td>
          <td>
            {moldCell === null ? (
              <span className="erp-wo-assign-none">—</span>
            ) : (
              <div className="erp-wo-assign-cell">
                {moldCell}
                {recommend('plannedMoldId', t.fields.plannedMoldId)}
              </div>
            )}
          </td>
          {/*
           * 입고 위치는 창고까지만 보인다(사용자 지시 2026-11-27) — 위치는 창고의 입고 위치나 라인 기본 위치로 채워지고,
           * 칸에 올리면 채워진 위치가 나타난다. 채워지지 않았을 때만 위치를 고르는 선택 칸을 연다.
           */}
          <td
            className="nowrap-cell"
            title={draft.defaultFgLocationId === '' ? undefined : labelOf('defaultFgLocationId')}
          >
            {draft.defaultFgLocationId !== '' || workOrder.fgWarehouseDiffersFromErp
              ? warehouseText
              : selectCell('defaultFgLocationId', '입고 위치', fgSource)}
            {errorLine('defaultFgLocationId')}
          </td>
          <td>
            <DateTimeCell
              label={t.fields.plannedStartAtLocal}
              value={draft.plannedStartAtLocal}
              disabled={saving || readOnly}
              invalid={errorOf('plannedStartAtLocal') !== undefined}
              onChange={(value) => patch({ plannedStartAtLocal: value })}
            />
          </td>
          <td>
            <DateTimeCell
              label={t.fields.plannedEndAtLocal}
              value={draft.plannedEndAtLocal}
              disabled={saving || readOnly}
              invalid={errorOf('plannedEndAtLocal') !== undefined}
              onChange={(value) => patch({ plannedEndAtLocal: value })}
            />
            {errorLine('plannedEndAtLocal')}
          </td>
          <td className="nowrap-cell">
            {row.status ?? (
              <Chip variant="status" size="sm" status={checkTone}>
                {checkLabel}
              </Chip>
            )}
          </td>
        </tr>
        {(notes || showOccupancy || arrivalMissing || workOrder.fgWarehouseDiffersFromErp) && (
          <tr className="erp-wo-assign-row-notes" data-selected={row.selected || undefined}>
            <td colSpan={row.columnCount}>
              <div className="erp-wo-assign-notes">
                {findingText !== null && (
                  <p className="assign-check">
                    <span className="assign-check-text">{findingText}</span>
                  </p>
                )}
                {workOrder.fgWarehouseDiffersFromErp && (
                  <p>ERP 입고 창고와 다름: {workOrder.erpStorageLocationCode}</p>
                )}
                {arrivalMissing && <p role="alert">입고 위치 기준정보 확인 필요</p>}
                <SaveErrorBanner error={update.error} />
                {occupancyError && <AlertBanner variant="error" title={occupancyError} />}
                {(plan.isError || operations.isError) && (
                  <AlertBanner variant="error">
                    공정 필수 배정 항목을 조회하지 못했습니다. 다시 조회하세요.
                  </AlertBanner>
                )}
                {showOccupancy && (
                  <EquipmentOccupancy
                    equipmentId={idOrNull(draft.plannedEquipmentId)}
                    selfId={workOrder.workOrderId}
                    start={draft.plannedStartAtLocal}
                    end={draft.plannedEndAtLocal}
                    label={labelOf('plannedEquipmentId')}
                  />
                )}
              </div>
            </td>
          </tr>
        )}
      </>
    );
  }

  return (
    <section className="assign-editor" aria-labelledby={headingId}>
      <div className="assign-editor-head">
        <h2 id={headingId} className="section-title">
          {t.editorHeading}
        </h2>
        <div className="assign-editor-actions">
          <Button
            size="sm"
            variant="outlined"
            disabled={saving || readOnly}
            onClick={() => void validation.refetch()}
          >
            {t.actions.check}
          </Button>
          <Button
            size="sm"
            variant="outlined"
            disabled={readOnly || !dirty || saving}
            onClick={reset}
          >
            {t.actions.reset}
          </Button>
          {actionTarget === null ? saveAction : createPortal(saveAction, actionTarget)}
        </div>
      </div>
      <span id={`${headingId}-save-note`} className="visually-hidden">
        {t.actions.noChanges}
      </span>
      <div className="erp-wo-assign-selected-target" role="group" aria-label="작업지시 정보">
        <h3 className="field-label">작업지시 정보</h3>
        <p>{title}</p>
        {summary && <p className="erp-wo-assign-summary">{summary}</p>}
      </div>
      <p className="assign-check">
        <Chip variant="status" size="sm" status={checkTone}>
          {checkLabel}
        </Chip>
        {findingText !== null && <span className="assign-check-text">{findingText}</span>}
      </p>
      <SaveErrorBanner error={update.error} />
      {occupancyError && <AlertBanner variant="error" title={occupancyError} />}
      <h3 className="section-title erp-wo-assignment-input-title">배정 입력</h3>
      {(plan.isError || operations.isError) && (
        <AlertBanner variant="error">
          공정 필수 배정 항목을 조회하지 못했습니다. 다시 조회하세요.
        </AlertBanner>
      )}

      <div className="assign-form">
        <h3 className="assign-group-title">{t.groups.equipmentAndMold}</h3>
        <div className="erp-wo-assign-line-control">
          {reference('productionLineId', t.fields.productionLineId, lineSource, {
            addon: (
              <Tooltip content={t.lineHint}>
                <button type="button" className="info-mark" aria-label={t.lineHintLabel}>
                  ⓘ
                </button>
              </Tooltip>
            ),
          })}
        </div>
        {reference('plannedEquipmentId', t.fields.plannedEquipmentId, equipmentSource, {
          chips: chips.plannedEquipmentId,
          addon:
            idOrNull(draft.plannedEquipmentId) !== null ? (
              <EquipmentStatus
                id={Number(draft.plannedEquipmentId)}
                selfId={workOrder.workOrderId}
                start={draft.plannedStartAtLocal}
                end={draft.plannedEndAtLocal}
              />
            ) : undefined,
          onPick: (row) =>
            pick(
              'plannedEquipmentId',
              row,
              row.parentId === null ||
                row.parentId === undefined ||
                String(row.parentId) === draft.productionLineId
                ? {}
                : { productionLineId: String(row.parentId) },
            ),
        })}
        {reference('plannedMoldId', t.fields.plannedMoldId, moldSource, {
          chips: chips.plannedMoldId,
        })}
        <span className="assign-empty" aria-hidden="true" />
        {locationOpen ? (
          <>
            <h3 className="assign-group-title">{t.groups.location}</h3>
            <div className="field-cell">
              <span className="field-label">생산품 입고 창고</span>
              <span>
                {workOrder.fgWarehouseDiffersFromErp
                  ? `${appliedLocation?.warehouseName ?? workOrder.fgWarehouseCode} (${workOrder.fgWarehouseCode})`
                  : erpStorage?.erpStorageLocationCode
                    ? erpStorage.erpStorageWarehouse
                      ? `${erpStorage.erpStorageWarehouse.name} (${erpStorage.erpStorageWarehouse.code})`
                      : `${erpStorage.erpStorageLocationCode} · 창고 연결 확인 필요`
                    : (locations.items.find(
                        (item) => String(item.locationId) === draft.defaultFgLocationId,
                      )?.warehouseName ?? '미지정')}
              </span>
              {workOrder.fgWarehouseDiffersFromErp && (
                <span>ERP 입고 창고와 다름: {workOrder.erpStorageLocationCode}</span>
              )}
              {erpStorage?.erpStorageWarehouse && arrival.isPending ? (
                <span className="field-note">입고 위치 확인 중</span>
              ) : null}
              {erpStorage?.erpStorageWarehouse &&
              (arrival.isError || (arrival.isSuccess && !arrival.data.location)) ? (
                <span role="alert">입고 위치 기준정보 확인 필요</span>
              ) : null}
            </div>
            {reference(
              'defaultFgLocationId',
              '입고 위치',
              workOrder.fgWarehouseDiffersFromErp ? null : fgSource,
            )}
            <span className="assign-empty" aria-hidden="true" />
          </>
        ) : (
          <FoldLine
            label={fromLine ? t.fold.lineLocations : t.fold.locations}
            pairs={locationPairs}
            disabled={saving || readOnly}
            onExpand={() => setLocationOpen(true)}
          />
        )}
        {planOpen ? (
          <>
            <h3 className="assign-group-title">{t.groups.plan}</h3>
            <div className="assign-plan-row">
              <DateTimeField
                minDate={plantToday()}
                timePicker
                size="md"
                label={t.fields.plannedStartAtLocal}
                value={draft.plannedStartAtLocal}
                disabled={saving || readOnly}
                invalid={errorOf('plannedStartAtLocal') !== undefined}
                onChange={(value) => patch({ plannedStartAtLocal: value })}
              />
              <DateTimeField
                minDate={plantToday()}
                timePicker
                size="md"
                label={t.fields.plannedEndAtLocal}
                value={draft.plannedEndAtLocal}
                disabled={saving || readOnly}
                invalid={errorOf('plannedEndAtLocal') !== undefined}
                onChange={(value) => patch({ plannedEndAtLocal: value })}
              />
              {errorLine('plannedEndAtLocal')}
            </div>
          </>
        ) : (
          <FoldLine
            label={fromShift ? t.fold.shiftPlan : t.fold.plan}
            pairs={planPairs}
            disabled={saving || readOnly}
            onExpand={() => setPlanOpen(true)}
          />
        )}
      </div>
      {resourceRequired('plannedEquipmentId') && (
        <EquipmentOccupancy
          equipmentId={idOrNull(draft.plannedEquipmentId)}
          selfId={workOrder.workOrderId}
          start={draft.plannedStartAtLocal}
          end={draft.plannedEndAtLocal}
          label={labelOf('plannedEquipmentId')}
        />
      )}
    </section>
  );
};

export interface AssignEditorProps {
  row?: AssignRowInfo;
  onRegister?: (handle: AssignRowHandle | null) => void;
  readOnly?: boolean;
  actionTargetId?: string;
  summary?: string;
  /** 편집 중인 W/O(번호와 공정) */
  title: string;
  workOrderId: number;
  plantId: number | null;
  erpStorage?: Pick<ProductionOrderFact, 'erpStorageLocationCode' | 'erpStorageWarehouse'>;
  planDate: string | null;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (ready: boolean) => void;
}

export const AssignEditor = ({
  row,
  onRegister,
  readOnly = false,
  actionTargetId,
  summary,
  title,
  workOrderId,
  plantId,
  erpStorage,
  planDate,
  onDirtyChange,
  onSaved,
}: AssignEditorProps) => {
  const detail = useWorkOrderDetail(workOrderId);
  if (row !== undefined && (detail.isPending || detail.data === undefined)) {
    return (
      <tr className="erp-wo-assign-row" aria-label={`${row.workOrderNo} ${row.operationName}`}>
        <th scope="row" className="nowrap-cell">
          {row.workOrderNo}
        </th>
        <td colSpan={row.columnCount - 1}>
          {detail.isPending ? (
            <SkeletonText lines={1} />
          ) : (
            <span className="erp-wo-assign-load-failed">
              {t.loadFailed}{' '}
              <Button size="sm" variant="outlined" onClick={() => void detail.refetch()}>
                {messages.common.retry}
              </Button>
            </span>
          )}
        </td>
      </tr>
    );
  }
  if (detail.isPending) return <SkeletonText lines={6} />;
  if (detail.data === undefined) {
    return (
      <AlertBanner
        variant="error"
        title={t.loadFailed}
        action={
          <Button size="sm" variant="outlined" onClick={() => void detail.refetch()}>
            {messages.common.retry}
          </Button>
        }
      />
    );
  }
  return (
    <EditorSession
      row={row}
      onRegister={onRegister}
      readOnly={readOnly}
      actionTargetId={actionTargetId}
      summary={summary}
      title={title}
      key={`${String(workOrderId)}:${String(detail.dataUpdatedAt)}`}
      workOrder={detail.data}
      plantId={plantId}
      erpStorage={erpStorage}
      planDate={planDate}
      onDirtyChange={onDirtyChange}
      onSaved={onSaved}
    />
  );
};
