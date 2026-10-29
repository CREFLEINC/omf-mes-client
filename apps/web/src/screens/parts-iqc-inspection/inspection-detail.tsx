import {
  AlertBanner,
  Button,
  Checkbox,
  Chip,
  Dialog,
  IconButton,
  Icon,
  Radio,
  RadioGroup,
  TextArea,
  TextField,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { Select } from '../../patterns/select';
import { DateTimeField } from '../../patterns/date-time-field';
import { FieldLabel } from '../iqc-inspection/field-label';
import { formatPlantDateTime, plantNowLocal, PLANT_UTC_OFFSET } from '../../patterns/plant-time';
import { useSession } from '../../patterns/session';
import {
  useDefectCodes,
  useInspectionItemSpecs,
  useInspectionRequestDetail,
  useInspectionRounds,
  useMeasurements,
} from '../iqc-inspection/queries';
import { useItemNames, useLotNumbers } from '../iqc-inspection/reference-lookup';
import { sampleQtyOf } from '../iqc-inspection/sample-qty';
import { latestRound } from '../iqc-inspection/types';
import { useUomLookup, withUom } from '../iqc-inspection/uom-lookup';
import {
  countOf,
  emptyForm,
  historyReducer,
  numberOf,
  startHistory,
  withValue,
  type PartsIqcForm,
} from './form-state';
import {
  acceptanceOf,
  judgeDimension,
  kindOf,
  rejectedQtyOf,
  resolveDefectRows,
  serverExpectedOf,
  suggestedJudgmentOf,
  type ItemJudgment,
  type XrfResult,
} from './judgment';
import { MeasurementTable, rowStateOf } from './measurement-table';
import {
  useDrawings,
  useInboundInfo,
  useInspectionPlan,
  usePlanVersion,
  useSubmitInspection,
  type SubmitVariables,
} from './queries';

type ItemSpec = components['schemas']['InspectionItemSpec'];
type DefectCode = {
  defectCodeId: number;
  defectCode: string;
  defectName: string;
  parentDefectCodeId?: number | null;
  isActive?: boolean;
};

const t = messages.partsIqcInspection;

const toOffset = (local: string): string => `${local}:00${PLANT_UTC_OFFSET}`;
/** 비고 글자 수 — 사용자 시안(0/200). 서버 칸에는 길이 제한이 없다. */
const REMARKS_MAX = 200;

export interface InspectionDetailProps {
  inspectionRequestId: number;
  onClose: () => void;
  onSubmitted: () => void;
  /** 입력이 있는가 — 목록에서 다른 의뢰를 고르거나 닫을 때 화면이 한 번 묻는다. */
  onDirtyChange: (dirty: boolean) => void;
}

/**
 * 부품 공장 IQC 수입검사 상세(omf-all-around#211 · 레퍼런스 화면) — 검사 대상 → 로트 → 치수 측정 → 기준서 도면 → 외관·XRF → 판정.
 * [제출]은 측정값과 함께 임시 저장하고, XRF 성적서를 올린 뒤 확정한다(`useSubmitInspection`).
 */
export const InspectionDetail = ({
  inspectionRequestId,
  onClose,
  onSubmitted,
  onDirtyChange,
}: InspectionDetailProps) => {
  const { session } = useSession();
  const detail = useInspectionRequestDetail(inspectionRequestId);
  const rounds = useInspectionRounds(inspectionRequestId);
  const versionId = detail.data?.inspectionPlanVersionId ?? null;
  const version = usePlanVersion(versionId);
  const specs = useInspectionItemSpecs(versionId);
  const plan = useInspectionPlan(version.data?.inspectionPlanId ?? null);
  const drawings = useDrawings(versionId);
  const inbound = useInboundInfo(inspectionRequestId);
  const defectCodes = useDefectCodes(true);
  const items = useItemNames([detail.data?.itemId]);
  const lots = useLotNumbers([detail.data?.lotId]);
  const uoms = useUomLookup();

  const round = latestRound(rounds.data ?? []);
  const draftRound = round !== null && round.statusCode === 'DRAFT' ? round : null;
  const measurements = useMeasurements(draftRound?.inspectionResultId ?? null);

  const loading =
    detail.isPending ||
    rounds.isPending ||
    (versionId !== null && (version.isPending || specs.isPending));
  const failed = detail.isError || rounds.isError || version.isError || specs.isError;

  const body = () => {
    if (loading) return <p className="field-note">{t.dialog.loading}</p>;
    if (failed || detail.data === undefined)
      return <AlertBanner variant="error">{t.dialog.loadFailed}</AlertBanner>;
    if (round !== null && round.statusCode === 'CONFIRMED') {
      return (
        <AlertBanner variant="info">
          {t.dialog.confirmed(t.judgment[round.overallJudgmentCode] ?? round.overallJudgmentCode)}
        </AlertBanner>
      );
    }
    if (versionId === null || version.data === undefined || specs.data === undefined) {
      return <AlertBanner variant="warning">{t.dialog.noPlan}</AlertBanner>;
    }
    return (
      <InspectionForm
        key={`${String(inspectionRequestId)}-${String(draftRound?.inspectionResultId ?? 0)}-${measurements.isSuccess ? 'm' : '-'}`}
        request={detail.data}
        version={version.data}
        specs={[...specs.data].sort((a, b) => a.sequenceNo - b.sequenceNo)}
        planLabel={plan.data === undefined ? '-' : plan.data.inspectionPlanCode}
        planName={plan.data?.inspectionPlanName ?? '-'}
        itemParts={items.partsOf(detail.data.itemId)}
        lotNo={lots.labelOf(detail.data.lotId)}
        qtyLabel={withUom(String(detail.data.targetQty), uoms.codeOf(detail.data.uomId))}
        inbound={inbound.data}
        drawings={drawings.data ?? []}
        defectCodes={(defectCodes.data ?? []) as DefectCode[]}
        defectCodesFailed={defectCodes.isError}
        inspector={session?.worker ?? null}
        draft={
          draftRound === null
            ? null
            : {
                inspectionResultId: draftRound.inspectionResultId,
                inspectedQty: draftRound.inspectedQty,
                measured: measurements.data ?? [],
              }
        }
        onClose={onClose}
        onSubmitted={onSubmitted}
        onDirtyChange={onDirtyChange}
      />
    );
  };

  /* 목록 아래(또는 옆) 상세 구획에 선다 — 기존 검사 조회·판정과 같은 배치(팝업이 아니다 · 사용자 지시 2026-10-29). */
  return (
    <div className="parts-iqc-detail-body">
      <div className="parts-iqc-detail-head">
        <h2 className="pane-title">{t.dialog.title}</h2>
        {detail.data !== undefined && t.requestStatus[detail.data.statusCode] !== undefined && (
          <Chip size="sm" status={detail.data.statusCode === 'IN_PROGRESS' ? 'info' : 'idle'}>
            {t.requestStatus[detail.data.statusCode]}
          </Chip>
        )}
      </div>
      {body()}
    </div>
  );
};

interface FormProps {
  request: {
    inspectionRequestId: number;
    itemId: number;
    lotId: number | null;
    targetQty: number;
    uomId: number;
  };
  version: components['schemas']['InspectionPlanVersion'];
  specs: ItemSpec[];
  planLabel: string;
  planName: string;
  itemParts: { code: string; name: string } | null;
  lotNo: string;
  qtyLabel: string;
  inbound: { supplierLabel: string | null; receivedAt: string | null } | undefined;
  drawings: { attachmentId: number; blob: Blob }[];
  defectCodes: DefectCode[];
  defectCodesFailed: boolean;
  inspector: { workerName: string } | null;
  draft: {
    inspectionResultId: number;
    inspectedQty: number;
    measured: {
      inspectionItemSpecId: number;
      sampleNo: number;
      numericValue?: number | null;
      booleanValue?: boolean | null;
    }[];
  } | null;
  onClose: () => void;
  onSubmitted: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

const DrawingImages = ({ drawings }: { drawings: { attachmentId: number; blob: Blob }[] }) => {
  /* 주소는 효과 안에서 만들고 거둔다 — 렌더에서 만들면 개발 모드의 효과 두 번 실행이 그 주소를 먼저 거둬 그림이 깨진다. */
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const made = drawings.map((d) => URL.createObjectURL(d.blob));
    setUrls(made);
    return () => made.forEach((url) => URL.revokeObjectURL(url));
  }, [drawings]);
  return (
    <section className="parts-iqc-block" aria-label={t.drawing.heading}>
      <div className="parts-iqc-block-head">
        <h3>{t.drawing.heading}</h3>
        {urls.length === 0 && <span className="parts-iqc-muted">{t.drawing.none}</span>}
      </div>
      {urls.length === 0 ? null : (
        <div className="parts-iqc-drawings">
          {urls.map((url, index) => (
            <img key={url} src={url} alt={t.drawing.alt(index + 1)} />
          ))}
        </div>
      )}
    </section>
  );
};

const InspectionForm = (props: FormProps) => {
  const { request, version, specs, draft } = props;
  const versionAcceptance = version.acceptanceNumber ?? null;
  const dimensions = specs.filter((s) => kindOf(s) === 'dimension');
  const visualItems = specs.filter((s) => kindOf(s) === 'visual');
  const xrfItems = specs.filter((s) => kindOf(s) === 'xrf');
  const checkItems = specs.filter((s) => kindOf(s) === 'check');
  const defaultQty = String(
    sampleQtyOf(request.targetQty, {
      samplingMethodCode: version.samplingMethodCode,
      samplingRatio: version.samplingRatio ?? null,
      samplingQty: version.samplingQty ?? null,
    }),
  );

  const initial = useMemo((): PartsIqcForm => {
    const form = emptyForm(plantNowLocal());
    form.visualInspectedQty = draft === null ? defaultQty : String(draft.inspectedQty);
    for (const m of draft?.measured ?? []) {
      const spec = specs.find((s) => s.inspectionItemSpecId === m.inspectionItemSpecId);
      if (spec === undefined) continue;
      const kind = kindOf(spec);
      if (kind === 'dimension' && m.numericValue != null) {
        const row = [...(form.values[spec.inspectionItemSpecId] ?? [])];
        row[m.sampleNo - 1] = String(m.numericValue);
        form.values[spec.inspectionItemSpecId] = row;
      } else if (kind === 'xrf' && m.booleanValue != null) form.xrf = m.booleanValue ? 'OK' : 'NG';
      else if (kind === 'check' && m.booleanValue != null)
        form.checks[spec.inspectionItemSpecId] = m.booleanValue ? 'ACCEPTED' : 'REJECTED';
    }
    return form;
  }, [draft, specs, defaultQty]);

  const [history, dispatch] = useReducer(historyReducer, initial, startHistory);
  const form = history.present;
  const change = (next: PartsIqcForm) => dispatch({ type: 'change', next });
  const [chosen, setChosen] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [xrfReport, setXrfReport] = useState<File | null>(null);
  const [ask, setAsk] = useState(false);
  const submit = useSubmitInspection(props.onSubmitted);

  const inspectedQty = countOf(form.visualInspectedQty);
  const defectQtyRaw = countOf(form.visualDefectQty);
  const defectOver = inspectedQty !== null && defectQtyRaw !== null && defectQtyRaw > inspectedQty;
  const visualDefectQty = defectOver ? null : defectQtyRaw;
  const dimensionResults = dimensions.map((item) =>
    judgeDimension(
      Array.from({ length: item.measurementCount }, (_, i) =>
        numberOf(form.values[item.inspectionItemSpecId]?.[i]),
      ),
      item,
      versionAcceptance,
    ),
  );
  const checks: ItemJudgment[] = checkItems.map(
    (item) => form.checks[item.inspectionItemSpecId] ?? null,
  );
  const input = {
    inspectedQty,
    visualDefectQty,
    dimensions: dimensionResults,
    xrf: { required: xrfItems.length > 0, result: form.xrf },
    checks,
  };
  const suggested = suggestedJudgmentOf(input);
  const rejectedQty = rejectedQtyOf(input);
  const defectTarget = (visualDefectQty ?? 0) > 0 ? (visualDefectQty ?? 0) : rejectedQty;
  const defectResult = resolveDefectRows(form.defectCodeIds, form.defectQtys, defectTarget);
  const dimensionStates = dimensions.map((item, index) =>
    rowStateOf(
      (form.values[item.inspectionItemSpecId] ?? []).filter((text) => numberOf(text) !== null)
        .length,
      item.measurementCount,
      dimensionResults[index]?.outCount ?? 0,
      acceptanceOf(item, versionAcceptance),
    ),
  );
  const overall = chosen ?? suggested;
  const expected = serverExpectedOf(rejectedQty, versionAcceptance);
  const needsReason = overall !== null && expected !== null && overall !== expected;
  const leafCodes = props.defectCodes.filter(
    (code) =>
      code.isActive !== false &&
      !props.defectCodes.some(
        (other) => other.parentDefectCodeId === code.defectCodeId && other.isActive !== false,
      ),
  );
  const maxN = Math.max(0, ...dimensions.map((d) => d.measurementCount));

  const measurementsOf = (): SubmitVariables['measurements'] => {
    const measuredAt = toOffset(form.inspectedAt);
    const out: SubmitVariables['measurements'] = [];
    dimensions.forEach((item) => {
      for (let i = 0; i < item.measurementCount; i += 1) {
        const value = numberOf(form.values[item.inspectionItemSpecId]?.[i]);
        if (value === null) continue;
        const lower = item.lowerLimit ?? -Infinity;
        const upper = item.upperLimit ?? Infinity;
        out.push({
          inspectionItemSpecId: item.inspectionItemSpecId,
          sampleNo: i + 1,
          numericValue: value,
          judgmentCode: value < lower || value > upper ? 'REJECTED' : 'ACCEPTED',
          measuredAt,
        });
      }
    });
    const bool = (item: ItemSpec, ok: boolean) =>
      out.push({
        inspectionItemSpecId: item.inspectionItemSpecId,
        sampleNo: 1,
        booleanValue: ok,
        judgmentCode: ok ? 'ACCEPTED' : 'REJECTED',
        measuredAt,
      });
    if (visualDefectQty !== null) visualItems.forEach((item) => bool(item, visualDefectQty === 0));
    if (form.xrf !== 'NOT_DONE') xrfItems.forEach((item) => bool(item, form.xrf === 'OK'));
    checkItems.forEach((item) => {
      const j = form.checks[item.inspectionItemSpecId];
      if (j != null) bool(item, j === 'ACCEPTED');
    });
    return out;
  };

  const blocked =
    props.inspector === null ||
    overall === null ||
    inspectedQty === null ||
    inspectedQty <= 0 ||
    visualDefectQty === null ||
    (overall === 'REJECTED' && 'blocked' in defectResult) ||
    (needsReason && reason.trim() === '');

  const onSubmit = () => {
    setAsk(false);
    if (blocked || overall === null || inspectedQty === null) return;
    submit.write({
      inspectionRequestId: request.inspectionRequestId,
      draftResultId: draft?.inspectionResultId ?? null,
      uomId: request.uomId,
      inspectedAt: toOffset(form.inspectedAt),
      inspectedQty,
      rejectedQty: overall === 'ACCEPTED' ? Math.min(rejectedQty, inspectedQty) : rejectedQty,
      overallJudgmentCode: overall,
      measurements: measurementsOf(),
      defects:
        overall === 'REJECTED' && 'rows' in defectResult
          ? defectResult.rows.map((row) => ({ ...row, defectDescription: null }))
          : [],
      ...(needsReason ? { judgmentChangeReason: reason.trim() } : {}),
      remarks: form.remarks,
      xrfReport,
    });
  };

  const dirty = history.past.length > 0;
  const { onDirtyChange } = props;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const xrfState =
    form.xrf === 'OK'
      ? { status: 'success' as const, label: t.visual.xrfState.OK }
      : form.xrf === 'NG'
        ? { status: 'error' as const, label: t.visual.xrfState.NG }
        : { status: 'warning' as const, label: t.visual.xrfState.NOT_DONE };

  return (
    <div className="parts-iqc-form">
      {props.inspector === null && (
        <AlertBanner variant="warning">{t.dialog.workerMissing}</AlertBanner>
      )}

      <section className="parts-iqc-block" aria-labelledby="parts-iqc-target">
        {/* 검사 대상 — 칸 이름 아래 테두리 상자에 자재 코드, 오른쪽 끝에 [변경](사용자 시안 2026-10-29) */}
        <div className="field-cell">
          <span className="field-label" id="parts-iqc-target">
            {t.target.heading}
          </span>
          <div className="parts-iqc-target-box">
            <strong>{props.itemParts?.code ?? '-'}</strong>
            <Button variant="text" size="sm" onClick={props.onClose}>
              {t.target.change}
            </Button>
          </div>
        </div>
        {/* 기본 정보 — OQC 상세의 기본 정보와 같은 짜임: 테두리 상자 안에 칸을 나란히, 칸 사이 세로선(사용자 시안 2026-10-29) */}
        <dl className="parts-iqc-facts">
          <div className="parts-iqc-fact">
            <dt className="field-label">{t.target.itemName}</dt>
            <dd className="parts-iqc-fact-key">
              {props.itemParts?.name ?? '-'}
              {props.itemParts !== null && (
                <span className="parts-iqc-fact-sub">{props.itemParts.code}</span>
              )}
            </dd>
          </div>
          <div className="parts-iqc-fact">
            <dt className="field-label">{t.target.plan}</dt>
            <dd>{props.planLabel}</dd>
          </div>
          <div className="parts-iqc-fact">
            <dt className="field-label">{t.target.planName}</dt>
            <dd>{props.planName}</dd>
          </div>
          {dimensions.length > 0 && (
            <>
              <div className="parts-iqc-fact">
                <dt className="field-label">{t.target.condition}</dt>
                <dd>{version.aqlValue == null ? '-' : t.target.conditionAql(version.aqlValue)}</dd>
              </div>
              <div className="parts-iqc-fact">
                <dt className="field-label">{t.target.sample}</dt>
                <dd>{t.target.sampleValue(maxN, versionAcceptance ?? 0)}</dd>
              </div>
            </>
          )}
          <div className="parts-iqc-fact">
            <dt className="field-label">{t.target.xrf}</dt>
            <dd>{xrfItems.length > 0 ? t.target.xrfRequired : t.target.xrfNone}</dd>
          </div>
          <div className="parts-iqc-fact">
            <dt className="field-label">{t.target.inspector}</dt>
            <dd>{props.inspector?.workerName ?? '-'}</dd>
          </div>
        </dl>

        <div className="parts-iqc-lot-box" role="group" aria-labelledby="parts-iqc-lot">
          <h4 id="parts-iqc-lot">{t.lot.heading}</h4>
          {/* 받은 값(LOT · 공급업체 · 수량 · 입고) 두 줄, 구분선 아래에 적는 값(검사일시) — 사용자 시안 2026-10-29 */}
          <dl className="parts-iqc-kv">
            <div>
              <dt>{t.lot.lotNo}</dt>
              <dd className="parts-iqc-lot-no">{props.lotNo}</dd>
            </div>
            <div>
              <dt>{t.lot.supplier}</dt>
              <dd>{props.inbound?.supplierLabel ?? '-'}</dd>
            </div>
            <div>
              <dt>{t.lot.qty}</dt>
              <dd>{props.qtyLabel}</dd>
            </div>
            <div>
              <dt>{t.lot.receivedAt}</dt>
              <dd>{formatPlantDateTime(props.inbound?.receivedAt ?? null) ?? '-'}</dd>
            </div>
          </dl>
          <div className="parts-iqc-lot-inspected">
            <DateTimeField
              required
              label={t.lot.inspectedAt}
              value={form.inspectedAt}
              onChange={(value) => change({ ...form, inspectedAt: value })}
            />
          </div>
        </div>
      </section>

      <MeasurementTable
        items={dimensions}
        values={form.values}
        versionAcceptance={versionAcceptance}
        disabled={submit.isSaving}
        onChange={(itemId, index, text) => change(withValue(form, itemId, index, text))}
      />

      <DrawingImages drawings={props.drawings} />

      {/* 외관 · XRF — 한 줄에 수량 둘 · 세로선 · XRF 결과, 구분선 아래 XRF 성적서(사용자 시안 2026-10-29) */}
      <section className="parts-iqc-card" aria-labelledby="parts-iqc-visual">
        <div className="parts-iqc-block-head">
          <h3 id="parts-iqc-visual">{t.visual.heading}</h3>
          {xrfItems.length > 0 && (
            <span className={`parts-iqc-badge parts-iqc-badge-${xrfState.status}`}>
              {xrfState.label}
            </span>
          )}
        </div>
        <div className="parts-iqc-visual-line">
          <div className="parts-iqc-inline-field">
            <FieldLabel htmlFor="parts-iqc-visual-qty" label={t.visual.inspectedQty} required />
            <TextField
              id="parts-iqc-visual-qty"
              inputMode="numeric"
              value={form.visualInspectedQty}
              trailingIcon={<span>{t.visual.unit}</span>}
              error={
                form.visualInspectedQty !== '' && inspectedQty === null
                  ? t.visual.invalidQty
                  : undefined
              }
              onChange={(event) => change({ ...form, visualInspectedQty: event.target.value })}
            />
          </div>
          <div className="parts-iqc-inline-field">
            <FieldLabel htmlFor="parts-iqc-visual-defect" label={t.visual.defectQty} required />
            <TextField
              id="parts-iqc-visual-defect"
              inputMode="numeric"
              value={form.visualDefectQty}
              trailingIcon={<span>{t.visual.unit}</span>}
              error={
                defectQtyRaw === null
                  ? t.visual.invalidQty
                  : defectOver
                    ? t.visual.overQty
                    : undefined
              }
              onChange={(event) => change({ ...form, visualDefectQty: event.target.value })}
            />
          </div>
          {xrfItems.length > 0 && (
            <div className="field-cell parts-iqc-xrf-cell">
              <span className="field-label" id="parts-iqc-xrf">
                {t.visual.xrfResult}
                <span className="required-mark" aria-hidden="true">
                  {' *'}
                </span>
              </span>
              <RadioGroup
                name="parts-iqc-xrf"
                orientation="horizontal"
                aria-labelledby="parts-iqc-xrf"
                value={form.xrf}
                onChange={(value) => change({ ...form, xrf: value as XrfResult })}
              >
                {(['NOT_DONE', 'OK', 'NG'] as XrfResult[]).map((value) => (
                  <Radio key={value} value={value}>
                    {t.visual.xrfChoice[value]}
                  </Radio>
                ))}
              </RadioGroup>
            </div>
          )}
        </div>

        {xrfItems.length > 0 && (
          <div className="parts-iqc-file">
            <div className="parts-iqc-file-text">
              <span className="parts-iqc-file-title">{t.visual.xrfReport}</span>
              <span className="parts-iqc-muted">
                {xrfReport === null ? t.visual.noFile : xrfReport.name}
              </span>
            </div>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.doc,.docx,.csv,.txt"
              onChange={(event) => setXrfReport(event.target.files?.[0] ?? null)}
            />
            {xrfReport === null ? (
              <Button
                variant="outlined"
                className="app-button-neutral"
                leadingIcon={<Icon name="upload" />}
                onClick={() => fileRef.current?.click()}
              >
                {t.visual.pickFile}
              </Button>
            ) : (
              <Button variant="text" onClick={() => setXrfReport(null)}>
                {t.visual.clearFile}
              </Button>
            )}
          </div>
        )}
      </section>

      {/* 기타 검사 항목 — 표(No. · 검사 항목 · 판정), 같은 상자에 외관 불량 유형 · 비고(사용자 시안 2026-10-29) */}
      <section className="parts-iqc-card" aria-labelledby="parts-iqc-checks">
        {checkItems.length > 0 && (
          <>
            <div className="parts-iqc-block-head">
              <h3 id="parts-iqc-checks">
                {t.visual.checks}
                <span className="required-mark" aria-hidden="true">
                  {' *'}
                </span>
              </h3>
              <span className="parts-iqc-muted">{t.visual.checkCount(checkItems.length)}</span>
            </div>
            <div className="parts-iqc-grid-scroll">
              <table className="parts-iqc-check-table">
                <thead>
                  <tr>
                    <th scope="col">{t.visual.checkNo}</th>
                    <th scope="col">{t.visual.checkItem}</th>
                    <th scope="col">{t.dimension.judgment}</th>
                  </tr>
                </thead>
                <tbody>
                  {checkItems.map((item, index) => (
                    <tr key={item.inspectionItemSpecId}>
                      <td>{index + 1}</td>
                      <td>{item.inspectionItemName}</td>
                      <td>
                        <div
                          className="parts-iqc-check-row"
                          role="group"
                          aria-label={item.inspectionItemName}
                        >
                          {(['ACCEPTED', 'REJECTED'] as const).map((value) => (
                            <Chip
                              key={value}
                              variant="filter"
                              data-judgment={value}
                              aria-pressed={form.checks[item.inspectionItemSpecId] === value}
                              selected={form.checks[item.inspectionItemSpecId] === value}
                              onSelectedChange={(on) =>
                                change({
                                  ...form,
                                  checks: {
                                    ...form.checks,
                                    [item.inspectionItemSpecId]: on ? value : null,
                                  },
                                })
                              }
                            >
                              {value === 'ACCEPTED' ? t.ok : t.ng}
                            </Chip>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className={checkItems.length > 0 ? 'parts-iqc-card-split' : undefined}>
          <div className="parts-iqc-defect-head">
            <h3 id="parts-iqc-defect-type">
              {t.visual.defectType}
              {overall === 'REJECTED' && (
                <span className="required-mark" aria-hidden="true">
                  {' *'}
                </span>
              )}
            </h3>
            {(visualDefectQty ?? 0) > 0 && form.defectCodeIds.length > 0 && (
              <span className="parts-iqc-badge parts-iqc-badge-success">
                {t.visual.defectPicked(form.defectCodeIds.length)}
              </span>
            )}
          </div>
          <div
            className="parts-iqc-defect-line"
            role="group"
            aria-labelledby="parts-iqc-defect-type"
          >
            {props.defectCodesFailed ? (
              <p className="field-note">{t.visual.defectCodesFailed}</p>
            ) : leafCodes.length === 0 ? (
              <p className="field-note">{t.visual.defectCodesEmpty}</p>
            ) : (
              <div className="parts-iqc-defect-options">
                {leafCodes.map((code) => (
                  <Checkbox
                    key={code.defectCodeId}
                    checked={form.defectCodeIds.includes(code.defectCodeId)}
                    onChange={(event) =>
                      change({
                        ...form,
                        defectCodeIds: event.target.checked
                          ? [...form.defectCodeIds, code.defectCodeId]
                          : form.defectCodeIds.filter((id) => id !== code.defectCodeId),
                      })
                    }
                  >
                    {code.defectName}
                  </Checkbox>
                ))}
              </div>
            )}
            {overall === 'REJECTED' && 'blocked' in defectResult && (
              <p className="parts-iqc-hint parts-iqc-hint-inline">
                <Icon name="error" />
                {defectResult.blocked === 'required'
                  ? t.visual.defectTypeHint
                  : defectResult.blocked === 'qty'
                    ? t.visual.defectQtyRequired
                    : t.visual.defectSumMismatch(defectTarget)}
              </p>
            )}
          </div>
          {/* 둘 이상 고르면 유형마다 수량 — 합계가 외관 불량 수(없으면 불합격 수량)와 같아야 한다 */}
          {form.defectCodeIds.length > 1 && (
            <div className="parts-iqc-defect-qtys">
              {form.defectCodeIds.map((id) => {
                const code = leafCodes.find((c) => c.defectCodeId === id);
                return (
                  <div key={id} className="field-cell parts-iqc-stretch">
                    <FieldLabel
                      htmlFor={`parts-iqc-defect-qty-${String(id)}`}
                      label={code?.defectName ?? String(id)}
                      required
                    />
                    <TextField
                      id={`parts-iqc-defect-qty-${String(id)}`}
                      fullWidth
                      size="sm"
                      inputMode="numeric"
                      value={form.defectQtys[id] ?? ''}
                      trailingIcon={<span>{t.visual.unit}</span>}
                      onChange={(event) =>
                        change({
                          ...form,
                          defectQtys: { ...form.defectQtys, [id]: event.target.value },
                        })
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="field-cell parts-iqc-stretch">
          <h3 className="parts-iqc-sub-title">
            <label htmlFor="parts-iqc-remarks">{t.visual.remarks}</label>
          </h3>
          <TextArea
            id="parts-iqc-remarks"
            fullWidth
            placeholder={t.visual.remarksPlaceholder}
            value={form.remarks}
            rows={3}
            maxLength={REMARKS_MAX}
            showCount
            onChange={(event) => change({ ...form, remarks: event.target.value })}
          />
        </div>
      </section>

      {/* 종합 판정 — 왼쪽 자동 판정 결과 상자 · 세로선 · 오른쪽 종합 판정 고르기(사용자 시안 2026-10-29) */}
      <section className="parts-iqc-card" aria-labelledby="parts-iqc-verdict">
        <h3 id="parts-iqc-verdict" className="parts-iqc-sub-title">
          {t.verdict.overall}
        </h3>
        <div className="parts-iqc-verdict-line">
          <div
            className={`parts-iqc-auto-box${suggested === 'REJECTED' ? ' is-ng' : suggested === 'ACCEPTED' ? ' is-ok' : ''}`}
          >
            <span className="parts-iqc-auto-label">
              {t.verdict.suggested}
              <Icon name="info" aria-label={t.verdict.suggestedHint} />
            </span>
            {suggested === null ? (
              <span className="parts-iqc-muted">{t.verdict.pending}</span>
            ) : (
              <span className="parts-iqc-auto-value">
                <strong>{t.judgment[suggested] ?? suggested}</strong>
                {` ${t.verdict.rejectedQty(rejectedQty)}`}
              </span>
            )}
          </div>
          <div className="parts-iqc-inline-field parts-iqc-overall">
            <span className="field-label" id="parts-iqc-overall">
              {t.verdict.overall}
              <span className="required-mark" aria-hidden="true">
                {' *'}
              </span>
            </span>
            <Select
              aria-labelledby="parts-iqc-overall"
              value={overall}
              disabled={suggested === null}
              options={['ACCEPTED', 'REJECTED', 'HELD'].map((value) => ({
                value,
                label: t.judgment[value] ?? value,
              }))}
              onChange={(value) => setChosen(value)}
            />
          </div>
        </div>
        {needsReason && (
          <div className="field-cell parts-iqc-stretch">
            <FieldLabel htmlFor="parts-iqc-reason" label={t.verdict.reason} required />
            <TextArea
              id="parts-iqc-reason"
              fullWidth
              helperText={t.verdict.reasonHint}
              value={reason}
              maxLength={500}
              rows={2}
              error={submit.fieldErrors.judgmentChangeReason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        )}
      </section>

      {ask && (
        <Dialog
          open
          size="sm"
          showCloseButton={false}
          closeOnBackdropClick={false}
          title={t.footer.confirmSubmit(t.judgment[overall ?? ''] ?? '')}
          onClose={() => setAsk(false)}
          footer={
            <>
              <Button variant="text" onClick={() => setAsk(false)}>
                {t.footer.review}
              </Button>
              <Button variant="filled" onClick={onSubmit}>
                {t.footer.submit}
              </Button>
            </>
          }
        >
          {/* 내기 전에 무엇으로 나가는지 한 번 더 본다 — 규격 밖·덜 적은 항목이 여기서 드러난다(참고: omf-dx-vina 수입검사) */}
          <ul className="parts-iqc-confirm">
            <li>
              {[
                props.itemParts?.name ?? props.itemParts?.code ?? '-',
                `LOT ${props.lotNo}`,
                props.inbound?.supplierLabel ?? '-',
              ].join(' · ')}
            </li>
            <li>
              {t.footer.summaryDimension(
                dimensions.length,
                dimensionStates.filter((st) => st === 'err').length,
                dimensionStates.filter((st) => st === 'empty' || st === 'wait').length,
              )}
            </li>
            <li>
              {t.footer.summaryVisual(
                visualDefectQty ?? 0,
                xrfItems.length === 0 ? '-' : t.visual.xrf[form.xrf],
              )}
            </li>
          </ul>
        </Dialog>
      )}
      <SaveErrorBanner error={submit.error} />

      {/* 아래 줄은 레퍼런스 화면 그대로다 — 왼쪽 되돌리기 · 다시 실행, 오른쪽 비우기 · 제출(사용자 확인 2026-10-29) */}
      <div className="parts-iqc-footer">
        <Button
          variant="text"
          leadingIcon={<Icon name="undo" />}
          disabled={history.past.length === 0 || submit.isSaving}
          onClick={() => dispatch({ type: 'undo' })}
        >
          {t.footer.undo}
        </Button>
        <IconButton
          className="parts-iqc-redo"
          aria-label={t.footer.redo}
          icon="redo"
          disabled={history.future.length === 0 || submit.isSaving}
          onClick={() => dispatch({ type: 'redo' })}
        />
        <span className="parts-iqc-footer-gap" />
        <Button
          variant="text"
          disabled={submit.isSaving}
          onClick={() => {
            const cleared = emptyForm(form.inspectedAt);
            cleared.visualInspectedQty = defaultQty;
            change(cleared);
            setChosen(null);
            setReason('');
            setXrfReport(null);
          }}
        >
          {t.footer.clear}
        </Button>
        <Button
          variant="filled"
          className="parts-iqc-submit"
          loading={submit.isSaving}
          disabled={blocked || submit.isSaving}
          onClick={() => setAsk(true)}
        >
          {submit.isSaving ? t.footer.submitting : t.footer.submit}
        </Button>
      </div>
    </div>
  );
};
