import {
  AlertBanner,
  Button,
  DatePicker,
  Dialog,
  Icon,
  IconButton,
  TextField,
} from '@crefle/web-ui';
import type {
  components,
  InspectionLotForward,
  InspectionResultSummaryForward,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useReducer, useRef, useState } from 'react';

import { InfoTip } from '../../patterns/info-tip';
import { InspectionGuideNotice } from '../../patterns/inspection-guide';
import { SaveErrorBanner } from '../../patterns/master';
import { formatQty } from '../../patterns/package-qty';
import { plantNowLocal, PLANT_UTC_OFFSET, toPlantDateTimeParts } from '../../patterns/plant-time';
import { Select } from '../../patterns/select';
import { useSession } from '../../patterns/session';
import { TimeField } from '../../patterns/time-field';
import { FieldLabel } from '../iqc-inspection/field-label';
import { useInspectionItemSpecs, useMeasurements } from '../iqc-inspection/queries';
import { useUomLookup } from '../iqc-inspection/uom-lookup';
import {
  emptyForm,
  historyReducer,
  numberOf,
  sameForm,
  startHistory,
  withValue,
  type FormSnapshot,
  type PartsIqcForm,
} from '../parts-iqc-inspection/form-state';
import { PlanNote, TIME_LABELS } from '../parts-iqc-inspection/inspection-detail';
import {
  kindOf,
  rejectedQtyOf,
  suggestedJudgmentOf,
  type JudgmentInput,
} from '../parts-iqc-inspection/judgment';
import { overriddenLotsOf } from '../parts-iqc-inspection/lot-judgment';
import { LotMatchField } from '../parts-iqc-inspection/lot-match-field';
import {
  judgmentInputOf as sharedJudgmentInputOf,
  measurementsOf as sharedMeasurementsOf,
  restoreMeasured,
} from '../parts-iqc-inspection/measurement-inputs';
import { isManualDimension, MeasurementTable } from '../parts-iqc-inspection/measurement-table';
import { DrawingImages, PlanDialog } from '../parts-iqc-inspection/plan-dialog';
import { useDrawings, useInspectionPlan, usePlanVersion } from '../parts-iqc-inspection/queries';
import { ReinspectionReasonField } from '../parts-iqc-inspection/reinspection-reason-field';
import { SerialJudgments } from './serial-judgments';
import { toSerialInputs, type SerialRow } from './serials';
import { ruleCodeOf, type PickedLotView } from './shipment-oqc';
import { LotJudgmentChip } from './shipment-oqc-parts';
import { useSaveShipmentResult, type SaveShipmentResultVariables } from './shipment-oqc-queries';

type ItemSpec = components['schemas']['InspectionItemSpec'];
type PlanVersion = components['schemas']['InspectionPlanVersion'];
type MeasurementInput = components['schemas']['InspectionMeasurementInput'];
type Measured = components['schemas']['InspectionMeasurement'];

const s = messages.oqcInspection.shipment;
const d = s.drawer;
/** IQC 결과 서랍과 같은 칸 이름 · 판정 문구를 쓴다(omf-all-around#356 — 모양 · 동작을 IQC 와 같게). */
const t = messages.partsIqcInspection;

/** 닫힘 움직임 길이 — CSS `.iqc-inbound-drawer.is-closing` 과 같은 값(IQC 결과 서랍과 같다). */
const CLOSE_MS = 240;

/** 판정 셋 — 합격 · 불합격 · 보류(계약 `overallJudgmentCode`). POP 도 쓴다. */
export const SHIPMENT_JUDGMENTS = ['ACCEPTED', 'REJECTED', 'HELD'] as const;

const toOffset = (local: string): string => `${local}:00${PLANT_UTC_OFFSET}`;

export interface ShipmentResultDrawerProps {
  inspectionRequestId: number;
  itemId: number;
  /** 품목 이름 · 코드 — 맨 위 요약 줄(IQC 결과 서랍의 「자재명」 자리). 못 풀었으면 `null`. */
  itemParts: { code: string; name: string } | null;
  uomId: number;
  uomCode: string;
  /** 의뢰의 검사 기준 버전 — 있으면 검사 항목 측정 표를 둔다(FR-009 · T052). */
  planVersionId: number | null | undefined;
  /** 매칭 후보 — 지금 피킹된(살아 있는) LOT. 교체된 LOT 은 빠진다(US3-5). */
  views: readonly PickedLotView[];
  results: readonly InspectionResultSummaryForward[];
  /** 고칠 결과 — 새로 더하면 `null`. */
  editing: InspectionResultSummaryForward | null;
  /** 제목의 순번 — 고칠 때는 그 결과의 순번, 더할 때는 다음 순번. */
  seqNo: number;
  /** 새 결과의 미리 고른 LOT — 미검사 LOT(시안 W0403 ②). */
  preselectedLotIds: readonly number[];
  onClose: () => void;
  onSaved: (seqNo: number, edited: boolean) => void;
}

/**
 * W-04-03 결과 추가 · 수정 드로어 — IQC 결과 서랍(`parts-iqc-inspection/result-drawer.tsx` + `InspectionForm` 드로어 모드)과 같은
 * 모양 · 동작(omf-all-around#356 · 사용자 승인 설계): 제목 줄 · X 없이 오른쪽에서 열리고, 닫을 때 밀려 나가며, 입력 중이면 한 번 묻는다.
 * 순서 — 요약 줄 → 피킹 LOT 매칭(재검 사유) → 검사일시 · 검사 수량 → 검사 항목 → 종합 판정 → 시리얼별 검사 결과 → 도면 · 안내 →
 * [되돌리기][다시하기] … [비우기][취소][제출].
 *
 * 저장 값은 그대로다 — 매칭 · 판정 · 재검 사유 · 검사일시 · 측정치 · 시리얼. ⛔ 판정 변경 사유 · 비고는 싣지 않는다(이 흐름 서버가
 * 판정 변경 사유를 받지 않는다). 검사 수량은 서버가 매칭한 피킹 LOT 수량의 합으로 채우므로 읽기 전용으로 보인다.
 * 결과는 작성중으로 쌓이고 출하 완료 때 확정된다. 시리얼은 결과를 더할 때만(서버가 작성중 저장에서 받는다).
 */
export const ShipmentResultDrawer = (props: ShipmentResultDrawerProps) => {
  const { inspectionRequestId, editing, seqNo, onClose, onSaved, planVersionId } = props;
  const resultId = editing?.inspectionResultId ?? null;
  const versionId = planVersionId ?? null;
  const version = usePlanVersion(versionId);
  const specs = useInspectionItemSpecs(versionId);
  const plan = useInspectionPlan(version.data?.inspectionPlanId ?? null);
  const drawings = useDrawings(versionId);
  const measured = useMeasurements(versionId === null ? null : resultId);
  const save = useSaveShipmentResult(inspectionRequestId, () => onSaved(seqNo, editing !== null));

  const [dirty, setDirty] = useState(false);
  const [asking, setAsking] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    },
    [],
  );
  /* 들어올 때와 반대로 오른쪽으로 밀려 나가며 닫는다 — 움직임을 줄인 환경은 곧바로 닫는다(IQC 와 같다). */
  const closeAnimated = () => {
    if (closing) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduced) {
      onClose();
      return;
    }
    setClosing(true);
    closeTimer.current = window.setTimeout(onClose, CLOSE_MS);
  };
  const requestClose = () => {
    if (save.isSaving) return;
    if (dirty) setAsking(true);
    else closeAnimated();
  };

  const title = editing === null ? d.addTitle(seqNo) : d.editTitle(seqNo);
  const loading =
    versionId !== null &&
    (version.isPending || specs.isPending || (resultId !== null && measured.isPending));
  const failed = versionId !== null && (version.isError || specs.isError || measured.isError);

  return (
    <>
      <Dialog
        open
        placement="right"
        size="lg"
        className={
          closing
            ? 'iqc-inbound-drawer oqc-shipment-drawer is-closing'
            : 'iqc-inbound-drawer oqc-shipment-drawer'
        }
        closeOnBackdropClick={false}
        /* 제목 줄 · X 없이(IQC 결과 서랍과 같다) — 닫기는 아래 [취소] · Esc. 이름은 화면 읽기용으로만. */
        showCloseButton={false}
        aria-label={title}
        onClose={requestClose}
      >
        {loading ? (
          <p className="field-note">{d.loading}</p>
        ) : failed ? (
          <AlertBanner variant="error">{t.dialog.loadFailed}</AlertBanner>
        ) : (
          <ShipmentResultForm
            {...props}
            version={version.data ?? null}
            specs={[...(specs.data ?? [])].sort((a, b) => a.sequenceNo - b.sequenceNo)}
            planLabel={plan.data?.inspectionPlanCode ?? '-'}
            planName={plan.data?.inspectionPlanName ?? '-'}
            drawings={drawings.data ?? []}
            measured={resultId === null ? [] : (measured.data ?? [])}
            save={save}
            onDirtyChange={setDirty}
            onCancel={requestClose}
          />
        )}
      </Dialog>
      {asking && (
        <Dialog
          open
          size="sm"
          showCloseButton={false}
          closeOnBackdropClick={false}
          title={title}
          onClose={() => setAsking(false)}
          footer={
            <>
              <Button variant="outlined" onClick={() => setAsking(false)}>
                {d.discardStay}
              </Button>
              <Button
                onClick={() => {
                  setAsking(false);
                  closeAnimated();
                }}
              >
                {d.discardLeave}
              </Button>
            </>
          }
        >
          <p className="dialog-text">{d.discardBody}</p>
        </Dialog>
      )}
    </>
  );
};

interface FormProps extends ShipmentResultDrawerProps {
  version: PlanVersion | null;
  specs: ItemSpec[];
  planLabel: string;
  planName: string;
  drawings: { attachmentId: number; blob: Blob }[];
  measured: readonly Measured[];
  save: ReturnType<typeof useSaveShipmentResult>;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
}

const ShipmentResultForm = ({
  inspectionRequestId,
  itemId,
  itemParts,
  uomId,
  uomCode,
  views,
  results,
  editing,
  seqNo,
  preselectedLotIds,
  version,
  specs,
  planLabel,
  planName,
  drawings,
  measured,
  save,
  onDirtyChange,
  onCancel,
}: FormProps) => {
  const uoms = useUomLookup();
  const { session } = useSession();
  const inspector = session?.worker ?? null;
  const resultId = editing?.inspectionResultId ?? null;
  const noPlan = version === null;
  const versionAcceptance = version?.acceptanceNumber ?? null;
  const dimensions = specs.filter((spec) => kindOf(spec) === 'dimension');
  const checkItems = specs.filter((spec) => kindOf(spec) === 'check');
  const maxN = Math.max(0, ...dimensions.map((item) => item.measurementCount));

  const lots: InspectionLotForward[] = views.map((view) => view.lot);
  const activeIds = lots.map((lot) => lot.lotId);
  const [initialMatch] = useState(() =>
    (editing?.matchedLotIds ?? preselectedLotIds).filter((id) => activeIds.includes(id)),
  );
  const initialReason = editing?.reinspectionReasonCode ?? null;
  const [reason, setReason] = useState<string | null>(initialReason);
  const [serialRows, setSerialRows] = useState<SerialRow[]>([]);
  const [planOpen, setPlanOpen] = useState(false);
  const inspectedAtId = useId();
  const inspectedQtyId = useId();
  const overallId = useId();
  const verdictId = useId();

  /* 검사 수량 — 서버가 매칭한 피킹 LOT 수량의 합으로 채운다(이 흐름은 수량을 받지 않는다). */
  const qtyOf = (lotIds: readonly number[]): number =>
    lots.filter((lot) => lotIds.includes(lot.lotId)).reduce((sum, lot) => sum + lot.lotQty, 0);

  /* IQC 결과 양식과 같은 자동 판정 입력 — 출하 OQC 는 AQL 불량 수가 없다. */
  const judgmentInputOf = (f: PartsIqcForm, qty: number): JudgmentInput =>
    sharedJudgmentInputOf(f, { dimensions, checkItems }, versionAcceptance, {
      inspectedQty: qty > 0 ? qty : null,
      checkDefects: checkItems.map(() => null),
      aqlAcceptance: null,
    });

  const [initial] = useState((): PartsIqcForm => {
    const saved = toPlantDateTimeParts(editing?.inspectedAt ?? null);
    /* 저장된 측정치를 IQC 양식 값으로 되살린다 — 불합격 줄이 하나라도 있으면 NG, 적은 글은 처음 것. */
    return restoreMeasured(
      emptyForm(saved === null ? plantNowLocal() : `${saved.date}T${saved.time}`),
      specs,
      measured,
      { aqlDefects: false, keepRejected: true },
    );
  });
  /* 피킹 LOT 매칭도 같은 되돌리기 기록에 쌓는다 — [되돌리기]가 LOT 바꿈부터 되돌린다(IQC 와 같다 · omf-all-around#356). */
  const [history, dispatch] = useReducer(
    historyReducer<FormSnapshot>,
    { form: initial, lots: initialMatch },
    startHistory,
  );
  const form = history.present.form;
  const matched = history.present.lots;
  const change = (next: PartsIqcForm) => {
    if (next === form) return;
    dispatch({ type: 'change', next: { form: next, lots: matched } });
  };
  const setMatched = (lotIds: number[]) =>
    dispatch({ type: 'change', next: { form, lots: lotIds } });
  const inspectedQty = qtyOf(matched);

  /* 고친 결과의 판정이 자동 판정과 같으면 자동 판정을 따르게 둔다(IQC 와 같다). */
  const [initialChosen] = useState<string | null>(() => {
    const stored = editing?.overallJudgmentCode ?? '';
    if (stored === '') return null;
    return noPlan || stored !== suggestedJudgmentOf(judgmentInputOf(initial, qtyOf(initialMatch)))
      ? stored
      : null;
  });
  const [chosen, setChosen] = useState<string | null>(initialChosen);

  const input = judgmentInputOf(form, inspectedQty);
  const suggested = noPlan ? null : suggestedJudgmentOf(input);
  const rejectedQty = rejectedQtyOf(input);
  const overall = chosen ?? suggested;

  const [inspectedDate = '', inspectedTimeRaw = ''] = form.inspectedAt.split('T');
  const inspectedTime = inspectedTimeRaw.slice(0, 5);
  const changeInspectedAt = (date: string, time: string) =>
    change({ ...form, inspectedAt: date === '' ? '' : `${date}T${time === '' ? '00:00' : time}` });

  /* 자동 판정이 꺼진 항목에 값만 적고 판정을 고르지 않았으면 저장을 막는다 — 판정 없는 측정값은 서버가 받지 않는다. */
  const manualUnjudged = dimensions.filter(
    (item) =>
      isManualDimension(item) &&
      (form.checks[item.inspectionItemSpecId] ?? null) === null &&
      (form.values[item.inspectionItemSpecId] ?? []).some((text) => numberOf(text) !== null),
  );

  const overridden = overriddenLotsOf({
    results,
    editingResultId: resultId,
    seqNo,
    matchedLotIds: matched,
    judgmentCode: overall,
  });
  const needsReason = overridden.length > 0;
  const ruleCode = ruleCodeOf(save.error);
  const matchError = ruleCode === 'MATCHED_LOT_REQUIRED' ? d.ruleErrors.MATCHED_LOT_REQUIRED : null;
  const reasonError =
    ruleCode === 'REINSPECTION_REASON_REQUIRED' ? d.ruleErrors.REINSPECTION_REASON_REQUIRED : null;
  const lotNoOf = (lotId: number): string =>
    lots.find((lot) => lot.lotId === lotId)?.lotNo ?? String(lotId);

  const matchDirty =
    matched.length !== initialMatch.length || matched.some((id) => !initialMatch.includes(id));
  const dirty =
    !sameForm(form, initial) ||
    matchDirty ||
    reason !== initialReason ||
    chosen !== initialChosen ||
    serialRows.length > 0;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  /* 측정치 — IQC 결과 서랍과 같은 값으로 싣는다(수치는 시료마다, 그 밖은 판정한 항목 한 줄). */
  const measurementsOf = (measuredAt: string): MeasurementInput[] =>
    sharedMeasurementsOf(form, { dimensions, checkItems }, measuredAt);

  /* 필수 칸(피킹 LOT 매칭 · 검사일시 · 검사 수량 · 종합 판정 · 재검 사유 · 측정 판정)이 다 차야 [제출]이 눌린다(#356). */
  const blocked =
    save.isSaving ||
    matched.length === 0 ||
    inspectedQty <= 0 ||
    form.inspectedAt === '' ||
    overall === null ||
    /* 기준 항목이 있으면 필수 항목이 다 차 자동 판정이 나와야 한다 — 판정만 골라 제출하지 못한다. */
    (suggested === null && !noPlan) ||
    manualUnjudged.length > 0 ||
    (needsReason && reason === null);

  const submit = () => {
    if (blocked || overall === null) return;
    const inspectedAt = toOffset(form.inspectedAt);
    const variables: SaveShipmentResultVariables = {
      inspectionRequestId,
      uomId,
      judgmentCode: overall,
      matchedLotIds: matched,
      reinspectionReasonCode: reason,
      inspectedAt,
      /* 검사 기준 · 항목이 없으면 싣지 않는다 — 서버가 그대로 둔다(고칠 때 빈 배열은 저장된 측정치를 지운다). */
      measurements: specs.length === 0 ? undefined : measurementsOf(inspectedAt),
      serials: toSerialInputs(serialRows),
      editing:
        editing === null
          ? null
          : { inspectionResultId: editing.inspectionResultId, versionNo: editing.versionNo },
    };
    save.write(variables);
  };

  /* 비우기 — 적은 값 · 판정을 처음으로. 검사일시 · 매칭한 LOT · 재검 사유 · 스캔한 시리얼은 남긴다(IQC 와 같다). */
  const clearForm = () => {
    change(emptyForm(form.inspectedAt));
    setChosen(null);
  };

  /* 규칙 오류는 칸 옆에 문구로 — 나머지만 띠로(서버 원문을 삼키지 않는다). */
  const bannerError =
    ruleCode === 'MATCHED_LOT_REQUIRED' || ruleCode === 'REINSPECTION_REASON_REQUIRED'
      ? null
      : save.error;

  return (
    <div className="parts-iqc-form">
      {planOpen && version !== null && (
        <PlanDialog
          planCode={planLabel}
          itemParts={itemParts}
          version={version}
          specs={specs}
          uomCodeOf={uoms.codeOf}
          seqNo={seqNo}
          drawings={<DrawingImages drawings={drawings} />}
          onClose={() => setPlanOpen(false)}
        />
      )}

      <section className="parts-iqc-block" aria-label={t.target.heading}>
        <dl className="parts-iqc-facts">
          {/* 품목은 품목코드 · 품목명 두 칸(품목 표기 분리 · #358). */}
          <div className="parts-iqc-fact">
            <dt className="field-label">{s.facts.itemCode}</dt>
            <dd className="parts-iqc-fact-key">{itemParts?.code ?? '-'}</dd>
          </div>
          <div className="parts-iqc-fact">
            <dt className="field-label">{s.facts.itemName}</dt>
            <dd>{itemParts?.name ?? '-'}</dd>
          </div>
          <div className="parts-iqc-fact">
            <dt className="field-label">{t.target.plan}</dt>
            <dd className="parts-iqc-plan-cell">
              {planLabel}
              {!noPlan && (
                <Button variant="outlined" size="sm" onClick={() => setPlanOpen(true)}>
                  {t.plan.open}
                </Button>
              )}
            </dd>
          </div>
          <div className="parts-iqc-fact">
            <dt className="field-label">{t.target.planName}</dt>
            <dd>{planName}</dd>
          </div>
          {dimensions.length > 0 && (
            <>
              <div className="parts-iqc-fact">
                <dt className="field-label">{t.target.condition}</dt>
                <dd>
                  {version?.aqlValue == null
                    ? t.target.conditionNone
                    : t.target.conditionAql(version.aqlValue)}
                </dd>
              </div>
              <div className="parts-iqc-fact">
                <dt className="field-label">{t.target.sample}</dt>
                <dd>{t.target.sampleValue(maxN, versionAcceptance ?? 0)}</dd>
              </div>
            </>
          )}
          <div className="parts-iqc-fact">
            <dt className="field-label">{t.target.inspector}</dt>
            <dd>{inspector?.workerName ?? '-'}</dd>
          </div>
        </dl>

        {/* 피킹 LOT 매칭 — IQC 의 자재 관리 LOT 매칭 자리(요약 줄 아래). 판정이 LOT 판정을 바꾸면 재검 사유가 선다. */}
        <LotMatchField
          lots={lots}
          otherResults={results.filter((result) => result.inspectionResultId !== resultId)}
          uomCode={uomCode}
          value={matched}
          error={matchError}
          disabled={save.isSaving}
          onChange={setMatched}
          text={d}
          renderExtra={(lot) => {
            const view = views.find((each) => each.lot.lotId === lot.lotId);
            return view === undefined ? null : <LotJudgmentChip code={view.judgmentCode} />;
          }}
        />
        {needsReason && overall !== null ? (
          <ReinspectionReasonField
            overridden={overridden}
            lotNoOf={lotNoOf}
            judgmentCode={overall}
            value={reason}
            error={reasonError}
            disabled={save.isSaving}
            onChange={setReason}
            text={d}
            lotLabel={(lotNo) => lotNo}
          />
        ) : reasonError !== null ? (
          /* 화면 셈은 덮지 않는다는데 서버가 사유를 요구했다 — 문구만 세운다(서버가 정본). */
          <p className="field-error" role="alert">
            {reasonError}
          </p>
        ) : null}

        <div className="parts-iqc-lot-box oqc-shipment-inspected-box">
          <div className="parts-iqc-lot-inspected">
            <div className="field-cell date-time-field">
              <label className="field-label" htmlFor={inspectedAtId}>
                {t.lot.inspectedAt}
                <span className="required-mark" aria-hidden="true">
                  {' *'}
                </span>
              </label>
              <div className="date-time-field-controls">
                <DatePicker
                  id={inspectedAtId}
                  value={inspectedDate === '' ? null : inspectedDate}
                  onChange={(next) => changeInspectedAt(next, inspectedTime)}
                />
                <TimeField
                  labels={TIME_LABELS}
                  hour={inspectedTime.slice(0, 2)}
                  minute={inspectedTime.slice(3, 5)}
                  disabled={false}
                  invalid={false}
                  onChange={(hour, minute) => changeInspectedAt(inspectedDate, `${hour}:${minute}`)}
                />
              </div>
            </div>
            <div className="field-cell parts-iqc-inspected-qty">
              <span className="info-label">
                <FieldLabel htmlFor={inspectedQtyId} label={t.lot.inspectedQty} required />
                <InfoTip text={d.inspectedQtyHint} />
              </span>
              <TextField
                id={inspectedQtyId}
                readOnly
                value={formatQty(inspectedQty)}
                trailingIcon={<span>{uomCode}</span>}
              />
            </div>
          </div>
        </div>
      </section>

      {!noPlan && (
        <MeasurementTable
          headNote={specs.length > 0 ? <PlanNote text={d.planVersionNote} /> : null}
          items={dimensions}
          uomCodeOf={uoms.codeOf}
          values={form.values}
          versionAcceptance={versionAcceptance}
          judgments={form.checks}
          disabled={save.isSaving}
          onChange={(id, index, text) => change(withValue(form, id, index, text))}
          onJudge={(id, judgment) =>
            change({ ...form, checks: { ...form.checks, [id]: judgment } })
          }
          blockedNote={
            manualUnjudged.length > 0 ? messages.iqcInspection.measurements.blockedIncomplete : null
          }
          checkItems={checkItems}
          texts={form.texts}
          onText={(item, text) =>
            change({ ...form, texts: { ...form.texts, [item.inspectionItemSpecId]: text } })
          }
        />
      )}

      {noPlan && (
        <div className="parts-iqc-no-plan">
          <PlanNote text={d.noPlan} />
        </div>
      )}

      {/* 종합 판정 — 왼쪽 자동 판정 결과 상자 · 오른쪽 종합 판정 고르기(IQC 와 같다). */}
      <section className="parts-iqc-card" aria-labelledby={verdictId}>
        <h3 id={verdictId} className="parts-iqc-sub-title">
          {t.verdict.overall}
        </h3>
        <div className="parts-iqc-verdict-line">
          <div
            className={`parts-iqc-auto-box${suggested === 'REJECTED' ? ' is-ng' : suggested === 'ACCEPTED' ? ' is-ok' : ''}`}
          >
            <span className="parts-iqc-auto-label">{t.verdict.suggested}</span>
            {suggested === null ? (
              <span className="parts-iqc-muted">
                {noPlan ? t.verdict.noPlan : t.verdict.pending}
              </span>
            ) : (
              <span className="parts-iqc-auto-value">
                <strong>{t.judgment[suggested] ?? suggested}</strong>
                {` ${t.verdict.rejectedQty(rejectedQty)}`}
              </span>
            )}
          </div>
          <div className="parts-iqc-inline-field parts-iqc-overall">
            <span className="field-label" id={overallId}>
              {t.verdict.overall}
              <span className="required-mark" aria-hidden="true">
                {' *'}
              </span>
            </span>
            {/* 필수 항목이 다 차 자동 판정이 나와야 고를 수 있다 — 기준이 없으면 바로 고른다(IQC 와 같다 · omf-all-around#356). */}
            <Select
              aria-labelledby={overallId}
              value={overall}
              disabled={save.isSaving || (suggested === null && !noPlan)}
              options={SHIPMENT_JUDGMENTS.map((value) => ({
                value,
                label: t.judgment[value] ?? value,
              }))}
              onChange={(value) => setChosen(value)}
            />
          </div>
        </div>
      </section>

      {/* 시리얼별 OK/NG — 출하 검사에만 있다. 고침(PUT)은 시리얼을 받지 않아 더할 때만. */}
      {editing === null ? (
        <SerialJudgments
          inspectionRequestId={inspectionRequestId}
          itemId={itemId}
          rows={serialRows}
          onChange={setSerialRows}
          disabled={save.isSaving}
        />
      ) : null}

      <DrawingImages drawings={drawings} />
      <InspectionGuideNotice inspectionRequestId={inspectionRequestId} />

      {bannerError === null ? null : ruleCode === 'CONFIRMED_BY_SHIPMENT_COMPLETION' ? (
        <AlertBanner variant="error">{d.confirmedByShipment}</AlertBanner>
      ) : (
        <SaveErrorBanner error={bannerError} />
      )}

      <div className="parts-iqc-footer parts-iqc-drawer-footer">
        <Button
          variant="text"
          leadingIcon={<Icon name="undo" />}
          disabled={history.past.length === 0 || save.isSaving}
          onClick={() => dispatch({ type: 'undo' })}
        >
          {t.footer.undo}
        </Button>
        <IconButton
          className="parts-iqc-redo"
          aria-label={t.footer.redo}
          icon="redo"
          disabled={history.future.length === 0 || save.isSaving}
          onClick={() => dispatch({ type: 'redo' })}
        />
        <span className="parts-iqc-footer-gap" />
        <Button variant="text" disabled={save.isSaving} onClick={clearForm}>
          {t.footer.clear}
        </Button>
        {/* 창에 X 가 없어 닫는 단추는 여기 하나. */}
        <Button variant="outlined" disabled={save.isSaving} onClick={onCancel}>
          {d.cancel}
        </Button>
        <Button
          variant="filled"
          className="parts-iqc-submit"
          loading={save.isSaving}
          disabled={blocked}
          onClick={submit}
        >
          {d.save}
        </Button>
      </div>
    </div>
  );
};
