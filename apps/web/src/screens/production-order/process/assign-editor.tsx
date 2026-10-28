import {
  AlertBanner,
  Button,
  Chip,
  SkeletonText,
  TextField,
  Tooltip,
  useToast,
} from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState, type ReactNode } from 'react';

import { DateTimeField } from '../../../patterns/date-time-field';
import { ReferenceField, type ReferenceRow } from '../../../patterns/reference-picker';
import { SaveErrorBanner } from '../../../patterns/master';
import { Select } from '../../../patterns/select';
import {
  LINE_LOCATION_WAREHOUSE_TYPES,
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
  useWorkerSource,
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

const LOCATION_FIELDS = [
  'defaultWipLocationId',
  'defaultFgLocationId',
  'defaultScrapLocationId',
] as const;
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

interface EditorSessionProps {
  /** 편집 중인 W/O(번호와 공정). 편집 영역 제목이다. */
  title: string;
  workOrder: WorkOrderFact;
  plantId: number | null;
  planDate: string | null;
  onDirtyChange: (dirty: boolean) => void;
  /** 저장이 끝나고 점검을 다시 받은 뒤. `ready`는 배포 가능 판정(필수 칸과 점검 차단 없음)이다. */
  onSaved: (ready: boolean) => void;
}

const EditorSession = ({
  title,
  workOrder,
  plantId,
  planDate,
  onDirtyChange,
  onSaved,
}: EditorSessionProps) => {
  const toast = useToast();
  const seeded = workOrderAssignmentDraftFrom(workOrder);
  const [baseline, setBaseline] = useState(seeded);
  const [draft, setDraft] = useState(seeded);
  /* 팝업과 추천에서 방금 고른 값의 이름. 「칸:번호」로 둔다(값이 바뀌면 자연히 쓰이지 않는다). */
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [revealErrors, setRevealErrors] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  /* 라인 기본 위치를 채울지 판단을 마쳤는가. 마치기 전에는 비어 보여도 펼치지 않는다. */
  const [prefillSettled, setPrefillSettled] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
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
  const workerSource = useWorkerSource(plantId);
  const wipSource = useLocationSource(plantId, LINE_LOCATION_WAREHOUSE_TYPES.defaultWipLocationId);
  const fgSource = useLocationSource(plantId, LINE_LOCATION_WAREHOUSE_TYPES.defaultFgLocationId);
  const scrapSource = useLocationSource(
    plantId,
    LINE_LOCATION_WAREHOUSE_TYPES.defaultScrapLocationId,
  );
  const dirty = !workOrderDraftEquals(baseline, draft);
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
   * 라인은 정해졌는데 기본 위치 셋이 모두 비어 있으면(자동 계획이 라인만 정한 W/O) 그 라인 기본 위치로 초안을 채운다.
   * 라인을 고를 때 채우는 기존 4M 규칙과 같은 값이고, 사용자는 요약을 보고 [저장]만 누르면 된다(T-W-C 높이가 모자랄 때 ①).
   * 저장 전이므로 저장하지 않은 변경으로 다룬다.
   */
  const linesLoaded = lines.data !== undefined || lines.isError;
  useEffect(() => {
    if (prefillSettled || !linesLoaded) return;
    setPrefillSettled(true);
    if (
      baseline.productionLineId === '' ||
      LOCATION_FIELDS.some((field) => baseline[field] !== '')
    ) {
      return;
    }
    const line = lines.data?.items.find(
      (item) => String(item.productionLineId) === baseline.productionLineId,
    );
    if (line === undefined) return;
    const filled = Object.fromEntries(
      LOCATION_FIELDS.map((field) => [field, line[field] == null ? '' : String(line[field])]),
    ) as Pick<WorkOrderAssignmentDraft, (typeof LOCATION_FIELDS)[number]>;
    if (LOCATION_FIELDS.every((field) => filled[field] === '')) return;
    setDraft((current) => ({ ...current, ...filled }));
  }, [baseline, lines.data, linesLoaded, prefillSettled]);
  const patch = (next: Partial<WorkOrderAssignmentDraft>) => {
    update.reset();
    setDraft((current) => {
      const merged = { ...current, ...next };
      /* 라인을 바꾸면 기본 위치 셋을 그 라인 기본값으로 바꾼다(기존 4M 규칙). 추천 설비가 라인을 함께 가져오면 설비는 둔다. */
      if (
        next.productionLineId !== undefined &&
        next.productionLineId !== current.productionLineId
      ) {
        const line = lineOf(next.productionLineId);
        const text = (id: number | null | undefined) => (id == null ? '' : String(id));
        merged.plannedEquipmentId = next.plannedEquipmentId ?? '';
        merged.defaultWipLocationId = text(line?.defaultWipLocationId);
        merged.defaultFgLocationId = text(line?.defaultFgLocationId);
        merged.defaultScrapLocationId = text(line?.defaultScrapLocationId);
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
    row: ReferenceRow,
    extra: Partial<WorkOrderAssignmentDraft> = {},
  ) => {
    setLabels((current) => ({
      ...current,
      [`${field}:${String(row.id)}`]: named(row.name, row.code),
    }));
    patch({ ...extra, [field]: String(row.id) });
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
    return item === undefined ? '' : named(item.locationName, item.locationCode);
  };
  const labelOf = (field: IdField): string => {
    const value = draft[field];
    if (value === '') return '';
    const known = labels[`${field}:${value}`];
    if (known !== undefined) return known;
    switch (field) {
      case 'productionLineId': {
        const line = lineOf(value);
        return line === undefined ? '' : named(line.lineName, line.lineCode);
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
  const saving = update.isSaving;
  const required = (field: string) =>
    (REQUIRED_ASSIGNMENT_FIELDS as readonly string[]).includes(field);
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
  ) => (
    <ReferenceField
      size="sm"
      label={label}
      valueLabel={labelOf(field)}
      source={source}
      required={required(field)}
      disabled={saving}
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
              disabled={saving}
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
  const shiftId = useId();

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
    LOCATION_FIELDS.some((field) => draft[field] === '');
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
    defaultWipLocationId: t.fold.wip,
    defaultFgLocationId: t.fold.fg,
    defaultScrapLocationId: t.fold.scrap,
  };
  const locationPairs: FoldPair[] =
    draft.productionLineId === '' && LOCATION_FIELDS.every((field) => draft[field] === '')
      ? [{ label: '', value: t.fold.afterLine }]
      : LOCATION_FIELDS.map((field) =>
          draft[field] === ''
            ? { label: locationNames[field], value: t.fold.unset, unset: true }
            : { label: locationNames[field], value: labelOf(field) },
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

  return (
    <section className="assign-editor" aria-labelledby={headingId}>
      <div className="assign-editor-head">
        <h2 id={headingId} className="section-title">
          {title}
        </h2>
        <div className="assign-editor-actions">
          <Button
            size="sm"
            variant="outlined"
            disabled={saving}
            onClick={() => void validation.refetch()}
          >
            {t.actions.check}
          </Button>
          <Button
            size="sm"
            variant="outlined"
            disabled={!dirty || saving}
            onClick={() => {
              setDraft(baseline);
              setRevealErrors(false);
              update.reset();
            }}
          >
            {t.actions.reset}
          </Button>
          <Button
            size="sm"
            variant="outlined"
            loading={saving}
            disabled={!dirty}
            onClick={() => {
              setRevealErrors(true);
              const body = toWorkOrderAssignmentUpdate(draft);
              if (body !== null) update.write(body);
            }}
          >
            {t.actions.save}
          </Button>
        </div>
      </div>
      <p className="assign-check">
        <Chip variant="status" size="sm" status={checkTone}>
          {checkLabel}
        </Chip>
        {findingText !== null && <span className="assign-check-text">{findingText}</span>}
      </p>
      <SaveErrorBanner error={update.error} />
      <div className="assign-form">
        <h3 className="assign-group-title">{t.groups.equipmentAndMold}</h3>
        {reference('productionLineId', t.fields.productionLineId, lineSource, {
          addon: (
            <Tooltip content={t.lineHint}>
              <button type="button" className="info-mark" aria-label={t.lineHintLabel}>
                ⓘ
              </button>
            </Tooltip>
          ),
        })}
        {reference('plannedEquipmentId', t.fields.plannedEquipmentId, equipmentSource, {
          chips: chips.plannedEquipmentId,
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
        <h3 className="assign-group-title">{t.groups.workerAndShift}</h3>
        {reference('responsibleWorkerId', t.fields.responsibleWorkerId, workerSource, {
          chips: chips.responsibleWorkerId,
        })}
        <div className="field-cell reference-field">
          <label className="field-label" htmlFor={shiftId}>
            {t.fields.plannedShiftId}
          </label>
          <Select
            id={shiftId}
            size="sm"
            value={draft.plannedShiftId}
            disabled={saving}
            placeholder={t.shiftPlaceholder}
            options={[
              { value: '', label: t.shiftNone },
              ...(shifts.data?.items ?? []).map((shift) => ({
                value: String(shift.shiftId),
                label: t.shiftOption(
                  named(shift.shiftName, shift.shiftCode),
                  shift.startTime.slice(0, 5),
                  shift.endTime.slice(0, 5),
                ),
              })),
            ]}
            onChange={(value) => patch({ plannedShiftId: value })}
          />
        </div>
        {locationOpen ? (
          <>
            <h3 className="assign-group-title">{t.groups.location}</h3>
            {reference('defaultWipLocationId', t.fields.defaultWipLocationId, wipSource)}
            {reference('defaultFgLocationId', t.fields.defaultFgLocationId, fgSource)}
            {reference('defaultScrapLocationId', t.fields.defaultScrapLocationId, scrapSource)}
            <span className="assign-empty" aria-hidden="true" />
          </>
        ) : (
          <FoldLine
            label={fromLine ? t.fold.lineLocations : t.fold.locations}
            pairs={locationPairs}
            disabled={saving}
            onExpand={() => setLocationOpen(true)}
          />
        )}
        {planOpen ? (
          <>
            <h3 className="assign-group-title">{t.groups.plan}</h3>
            <div className="assign-plan-row">
              <DateTimeField
                size="sm"
                label={t.fields.plannedStartAtLocal}
                value={draft.plannedStartAtLocal}
                disabled={saving}
                invalid={errorOf('plannedStartAtLocal') !== undefined}
                onChange={(value) => patch({ plannedStartAtLocal: value })}
              />
              <DateTimeField
                size="sm"
                label={t.fields.plannedEndAtLocal}
                value={draft.plannedEndAtLocal}
                disabled={saving}
                invalid={errorOf('plannedEndAtLocal') !== undefined}
                onChange={(value) => patch({ plannedEndAtLocal: value })}
              />
              <TextField
                size="sm"
                label={t.fields.priorityNo}
                inputMode="numeric"
                value={draft.priorityNo}
                disabled={saving}
                error={errorOf('priorityNo')}
                fullWidth
                onChange={(event) => patch({ priorityNo: event.target.value })}
              />
              {errorLine('plannedEndAtLocal')}
            </div>
          </>
        ) : (
          <FoldLine
            label={fromShift ? t.fold.shiftPlan : t.fold.plan}
            pairs={planPairs}
            disabled={saving}
            onExpand={() => setPlanOpen(true)}
          />
        )}
      </div>
    </section>
  );
};

export interface AssignEditorProps {
  /** 편집 중인 W/O(번호와 공정) */
  title: string;
  workOrderId: number;
  plantId: number | null;
  planDate: string | null;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (ready: boolean) => void;
}

export const AssignEditor = ({
  title,
  workOrderId,
  plantId,
  planDate,
  onDirtyChange,
  onSaved,
}: AssignEditorProps) => {
  const detail = useWorkOrderDetail(workOrderId);
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
      title={title}
      key={`${String(workOrderId)}:${String(detail.dataUpdatedAt)}`}
      workOrder={detail.data}
      plantId={plantId}
      planDate={planDate}
      onDirtyChange={onDirtyChange}
      onSaved={onSaved}
    />
  );
};
