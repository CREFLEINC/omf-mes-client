import {
  AlertBanner,
  Button,
  Chip,
  DatePicker,
  Dialog,
  IconButton,
  Icon,
  Radio,
  RadioGroup,
  Tabs,
  TextArea,
  TextField,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { InspectionDrawingImages } from '../../patterns/inspection-drawings';
import { SaveErrorBanner } from '../../patterns/master';
import { Select } from '../../patterns/select';
import { FieldLabel } from '../iqc-inspection/field-label';
import { AttachmentPanel, useAttachments } from '../inspection-documents/attachment-panel';
import { formatPlantDateTime, plantNowLocal, PLANT_UTC_OFFSET } from '../../patterns/plant-time';
import { useSession } from '../../patterns/session';
import { toWebAccess } from '../../patterns/web-access';
import { TimeField, type TimeFieldLabels } from '../../patterns/time-field';
import {
  iqcInspectionKeys,
  useDefectCodes,
  useInspectionItemSpecs,
  useInspectionRequestDetail,
  useInspectionRounds,
  useRejectedLotFollowUp,
  useMeasurements,
} from '../iqc-inspection/queries';
import { RejectedLotGuide } from '../iqc-inspection/rejected-lot-guide';
import { useItemNames, useLotNumbers } from '../iqc-inspection/reference-lookup';
import { sampleQtyOf } from '../iqc-inspection/sample-qty';
import { latestRound } from '../iqc-inspection/types';
import { WorkerConnectDialog } from '../iqc-inspection/worker-connect-dialog';
import { DefectMultiSelect } from './defect-multi-select';
import { DefectQtyTable } from './defect-qty-table';
import { InspectionHistory } from './history';
import { PlanDialog } from './plan-dialog';
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
import { ItemNameCell, MeasurementTable, rowStateOf } from './measurement-table';
import {
  partsIqcKeys,
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
const tResult = messages.iqcInspection.result;
/** 검사 기준 화면 — 기준이 없을 때 「검사기준 설정」이 이 주소로 그 화면의 「기준 추가」 창을 유형 · 품목을 채워 연다(`new` · `newItem`). */
const STANDARD_PATH = '/master-data/inspection-standard';
const DEFECT_CODE_PATH = '/master-data/defect-cause-code';

const TIME_LABELS: TimeFieldLabels = {
  field: t.lot.inspectedTime,
  hourList: t.lot.inspectedHour,
  minuteList: t.lot.inspectedMinute,
  hourHead: t.lot.hourHead,
  minuteHead: t.lot.minuteHead,
  placeholder: t.lot.timePlaceholder,
};

const toOffset = (local: string): string => `${local}:00${PLANT_UTC_OFFSET}`;
/** 비고 글자 수 — 사용자 시안(0/200). 서버 칸에는 길이 제한이 없다. */
const REMARKS_MAX = 200;

export interface InspectionDetailProps {
  inspectionRequestId: number;
  onSubmitted: () => void;
  /** 입력이 있는가 — 목록에서 다른 의뢰를 고르거나 닫을 때 화면이 한 번 묻는다. */
  onDirtyChange: (dirty: boolean) => void;
}

/**
 * 부품 공장 IQC 수입검사 상세(omf-all-around#211 · 레퍼런스 화면) — 로트 → 치수 측정 → 외관·XRF → 기타 검사 항목 → 판정 → 기준서 도면 → 비고.
 * [제출]은 측정값과 함께 임시 저장하고, XRF 성적서를 올린 뒤 확정한다(`useSubmitInspection`).
 */
export const InspectionDetail = ({
  inspectionRequestId,
  onSubmitted,
  onDirtyChange,
}: InspectionDetailProps) => {
  const { session } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  /*
   * 재검사(OA 화면과 같다 · 사용자 지시 2026-11-09) — 확정된 회차를 두고 새 회차를 쌓는다. 회차가 바뀌면(제출됨) 저절로 풀린다.
   * 불량 LOT 은 처분으로, 검사 대기가 아닌 LOT 은 사유로 잇는다 — 서버가 받지 않는 길을 열지 않는다.
   */
  const latestRoundId = round?.inspectionResultId ?? null;
  const [reinspectingFrom, setReinspectingFrom] = useState<number | null>(null);
  const isReinspecting = reinspectingFrom !== null && reinspectingFrom === latestRoundId;
  const confirmed = round !== null && round.statusCode === 'CONFIRMED' && !isReinspecting;
  const followUp = useRejectedLotFollowUp(detail.data?.lotId ?? null, confirmed);
  /* 첨부 파일 탭 건수 — OA 화면과 같은 LOT 첨부(#247). LOT 이 없는 의뢰는 부르지 않는다. */
  const lotId = detail.data?.lotId ?? null;
  const attachments = useAttachments('LOT', lotId ?? 0, lotId !== null);

  const loading =
    detail.isPending ||
    rounds.isPending ||
    (versionId !== null && (version.isPending || specs.isPending));
  const failed = detail.isError || rounds.isError || version.isError || specs.isError;

  const body = () => {
    if (loading) return <p className="field-note">{t.dialog.loading}</p>;
    if (failed || detail.data === undefined)
      return <AlertBanner variant="error">{t.dialog.loadFailed}</AlertBanner>;
    /* 생략으로 닫힌 의뢰는 입력할 것이 없다 — 받은 정보만 읽기 전용으로 보인다(사용자 지시 2026-11-02 · #225). */
    if (detail.data.statusCode === 'SKIPPED') {
      return (
        <SkippedSummary
          skipBasisCode={detail.data.skipBasisCode ?? null}
          itemParts={items.partsOf(detail.data.itemId)}
          planLabel={plan.data?.inspectionPlanCode ?? '-'}
          planName={plan.data?.inspectionPlanName ?? '-'}
          lotNo={lots.labelOf(detail.data.lotId)}
          qtyLabel={withUom(String(detail.data.targetQty), uoms.codeOf(detail.data.uomId))}
          inbound={inbound.data}
        />
      );
    }
    if (confirmed) {
      return (
        <AlertBanner variant="info">
          {t.dialog.confirmed(
            t.judgment[round?.overallJudgmentCode ?? ''] ?? round?.overallJudgmentCode,
          )}
        </AlertBanner>
      );
    }
    if (versionId === null || version.data === undefined || specs.data === undefined) {
      /* 검사 기준 화면에서 이 품목의 IQC 기준 등록 창을 바로 연다(#225) — 그 화면 권한이 없으면 단추를 두지 않는다. */
      const setPlan = toWebAccess(session?.permissions).allows(STANDARD_PATH) ? (
        <Button
          variant="outlined"
          size="sm"
          onClick={() => navigate(`${STANDARD_PATH}?new=IQC&newItem=${String(detail.data.itemId)}`)}
        >
          {t.dialog.setPlan}
        </Button>
      ) : undefined;
      /* 단추는 문구와 같은 줄에 둔다 — 띠의 action 자리는 문구 아래 줄로 내려간다(#225). */
      return (
        <AlertBanner variant="warning">
          <span className="parts-iqc-no-plan">
            <span>{t.dialog.noPlan}</span>
            {setPlan}
          </span>
        </AlertBanner>
      );
    }
    return (
      <InspectionForm
        key={`${String(inspectionRequestId)}-${String(isReinspecting)}-${String(draftRound?.inspectionResultId ?? 0)}-${measurements.isSuccess ? 'm' : '-'}`}
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
        /* 불량 코드가 없으면 그 화면으로 옮겨 바로 등록한다(사용자 지시 2026-11-04 — 새 창이 아니라 화면 이동). */
        onRegisterDefectCode={
          toWebAccess(session?.permissions).allows(DEFECT_CODE_PATH)
            ? () => {
                /* 등록하고 돌아오면 목록을 다시 받는다. */
                void queryClient.invalidateQueries({ queryKey: iqcInspectionKeys.defectCodes });
                navigate(
                  `${DEFECT_CODE_PATH}?mode=create${(defectCodes.data ?? []).length === 0 ? '&as=category' : ''}`,
                );
              }
            : undefined
        }
        inspector={session?.worker ?? null}
        appUserId={session?.userId ?? null}
        previousResultId={isReinspecting ? (round?.inspectionResultId ?? null) : null}
        draft={
          draftRound === null
            ? null
            : {
                inspectionResultId: draftRound.inspectionResultId,
                inspectedQty: draftRound.inspectedQty,
                measured: measurements.data ?? [],
              }
        }
        onSubmitted={onSubmitted}
        onDirtyChange={onDirtyChange}
      />
    );
  };

  /* 고른 탭은 의뢰마다 처음부터. 확정이 끝난 의뢰는 「검사 진행」 탭을 두지 않고 이력만 보인다(사용자 지시 2026-11-04). */
  const [picked, setPicked] = useState<{ requestId: number; tab: string } | null>(null);
  /* 확정된 의뢰는 이력에서 시작하고, 첨부 파일 탭은 고를 수 있다(#247). */
  const pickedTab = picked?.requestId === inspectionRequestId ? picked.tab : null;
  const tab = confirmed
    ? pickedTab === 'documents'
      ? 'documents'
      : 'history'
    : (pickedTab ?? 'input');

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
        {isReinspecting ? (
          <Button
            variant="outlined"
            size="sm"
            className="parts-iqc-reinspect"
            onClick={() => {
              setReinspectingFrom(null);
              onDirtyChange(false);
            }}
          >
            {tResult.reinspectCancel}
          </Button>
        ) : (
          confirmed &&
          followUp.data?.isInspectionPending === true && (
            <Button
              variant="outlined"
              size="sm"
              className="parts-iqc-reinspect"
              onClick={() => {
                setReinspectingFrom(latestRoundId);
                setPicked({ requestId: inspectionRequestId, tab: 'input' });
              }}
            >
              {tResult.reinspect}
            </Button>
          )
        )}
      </div>
      {confirmed && followUp.data?.isDefective === true && (
        <RejectedLotGuide nonconformanceId={followUp.data.nonconformanceId} />
      )}
      {confirmed && followUp.data?.isDefective === false && !followUp.data.isInspectionPending && (
        <p className="iqc-inspection-action-note" data-tone="info">
          <Icon name="info" size={14} aria-hidden />
          {tResult.reinspectLotNotPending}
        </p>
      )}
      {isReinspecting && <p className="field-note">{t.dialog.reinspectNote}</p>}
      {/* IQC 생략은 OA 화면처럼 목록 「생략」 칸으로 옮겼다(omf-all-around#225). */}
      {/* 검사 진행 · 첨부 파일 · 검사 이력 순(#247 · 사용자 지시 2026-11-10) — 이력은 이 의뢰의 회차를 읽기 전용으로 */}
      <Tabs
        className="parts-iqc-detail-tabs"
        size="md"
        aria-label={t.dialog.title}
        value={tab}
        onChange={(next) => setPicked({ requestId: inspectionRequestId, tab: next })}
        items={[
          ...(confirmed
            ? []
            : [{ value: 'input', label: t.tabs.input, content: tab === 'input' ? body() : null }]),
          /* 첨부 파일 — OA 화면 「첨부 파일」 탭과 같은 LOT 첨부(시험성적서 등 · #247 · 사용자 지시 2026-11-10). */
          ...(lotId === null
            ? []
            : [
                {
                  value: 'documents',
                  label: messages.inspectionDocuments.heading,
                  badge:
                    attachments.data === undefined || attachments.data.length === 0 ? undefined : (
                      <span className="parts-iqc-muted">{attachments.data.length}</span>
                    ),
                  content:
                    tab === 'documents' ? (
                      <AttachmentPanel
                        key={lotId}
                        targetTypeCode="LOT"
                        targetId={lotId}
                        scrollX
                        paged
                        bulkDownload
                        toolbarStart={
                          <span className="iqc-inspection-head-badge iqc-inspection-docs-help">
                            <Icon name="attach_file" size={16} aria-hidden />
                            <span>
                              {messages.inspectionDocuments.help
                                .split(/(\d+\s*MB)/)
                                .map((part, index) =>
                                  /^\d+\s*MB$/.test(part) ? (
                                    <strong key={index} className="iqc-inspection-docs-limit">
                                      {part}
                                    </strong>
                                  ) : (
                                    part
                                  ),
                                )}
                            </span>
                          </span>
                        }
                      />
                    ) : null,
                },
              ]),
          {
            value: 'history',
            label: t.tabs.history,
            badge:
              rounds.data === undefined || rounds.data.length === 0 ? undefined : (
                <span className="parts-iqc-muted">{rounds.data.length}</span>
              ),
            content:
              tab === 'history' ? (
                <InspectionHistory
                  inspectionRequestId={inspectionRequestId}
                  specs={[...(specs.data ?? [])].sort((a, b) => a.sequenceNo - b.sequenceNo)}
                  defectCodes={(defectCodes.data ?? []) as DefectCode[]}
                />
              ) : null,
          },
        ]}
      />
    </div>
  );
};

/** 생략된 의뢰의 읽기 전용 요약 — 검사 대상 · LOT 정보를 입력 화면과 같은 짜임으로 보인다(#225). */
const SkippedSummary = (props: {
  skipBasisCode: string | null;
  itemParts: { code: string; name: string } | null;
  planLabel: string;
  planName: string;
  lotNo: string;
  qtyLabel: string;
  inbound: { supplierLabel: string | null; receivedAt: string | null } | undefined;
}) => (
  <>
    <AlertBanner variant="info">
      {t.skipped.notice(
        props.skipBasisCode === null ? null : (t.skipped.basis[props.skipBasisCode] ?? null),
      )}
    </AlertBanner>
    <section className="parts-iqc-block" aria-label={t.target.heading}>
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
      </dl>
      <div className="parts-iqc-lot-box" role="group" aria-label={t.lot.heading}>
        <h4>{t.lot.heading}</h4>
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
      </div>
    </section>
  </>
);

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
  /** 불량 코드가 하나도 없을 때 「불량 코드 등록」 단추 — 그 화면 권한이 없으면 undefined */
  onRegisterDefectCode?: () => void;
  inspector: { workerName: string } | null;
  /** 재검사면 앞 회차, 아니면 `null` */
  previousResultId: number | null;
  /** 작업자 연결 창이 이을 계정 — 세션이 없으면 버튼을 두지 않는다. */
  appUserId: number | null;
  draft: {
    inspectionResultId: number;
    inspectedQty: number;
    measured: {
      inspectionItemSpecId: number;
      sampleNo: number;
      numericValue?: number | null;
      booleanValue?: boolean | null;
      textValue?: string | null;
      judgmentCode?: string | null;
    }[];
  } | null;
  onSubmitted: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

/** 기준서 도면 — 품질 기준 정보 「도면」 탭과 같은 보기(한 장씩 좌우로 넘김 · 사용자 지시 2026-10-30). */
const DrawingImages = ({ drawings }: { drawings: { attachmentId: number; blob: Blob }[] }) => (
  <section className="parts-iqc-card" aria-label={t.drawing.heading}>
    <div className="parts-iqc-block-head">
      <h3>{t.drawing.heading}</h3>
      {drawings.length === 0 && <span className="parts-iqc-muted">{t.drawing.none}</span>}
    </div>
    {drawings.length === 0 ? null : (
      <InspectionDrawingImages
        drawings={drawings}
        altOf={t.drawing.alt}
        labels={{ prev: t.drawing.prev, next: t.drawing.next }}
      />
    )}
  </section>
);

const InspectionForm = (props: FormProps) => {
  const { request, version, specs, draft } = props;
  const versionAcceptance = version.acceptanceNumber ?? null;
  const dimensions = specs.filter((s) => kindOf(s) === 'dimension');
  const visualItems = specs.filter((s) => kindOf(s) === 'visual');
  const xrfItems = specs.filter((s) => kindOf(s) === 'xrf');
  const checkItems = specs.filter((s) => kindOf(s) === 'check');
  /* 텍스트 항목이 있으면 기타 검사 항목 표에 글 칸 열을 둔다(#247 · 사용자 지시 2026-11-10). */
  const hasTextChecks = checkItems.some((s) => s.dataTypeCode === 'TEXT');
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
      else if (kind === 'check') {
        /* 텍스트 항목은 적은 글과 판정으로 남는다(#247). */
        if (m.textValue != null) form.texts[spec.inspectionItemSpecId] = m.textValue;
        if (m.booleanValue != null)
          form.checks[spec.inspectionItemSpecId] = m.booleanValue ? 'ACCEPTED' : 'REJECTED';
        else if (m.judgmentCode === 'ACCEPTED' || m.judgmentCode === 'REJECTED')
          form.checks[spec.inspectionItemSpecId] = m.judgmentCode;
      }
    }
    return form;
  }, [draft, specs, defaultQty]);

  const [history, dispatch] = useReducer(historyReducer, initial, startHistory);
  const form = history.present;
  const change = (next: PartsIqcForm) => dispatch({ type: 'change', next });
  /* 글을 적으면 판정이 비어 있을 때 OK로 채운다 — OA 화면과 같은 규칙(#247). 고른 판정은 덮지 않는다. */
  const changeText = (item: ItemSpec, text: string) => {
    const id = item.inspectionItemSpecId;
    const judged = form.checks[id] ?? null;
    change({
      ...form,
      texts: { ...form.texts, [id]: text },
      checks:
        judged === null && text.trim() !== '' ? { ...form.checks, [id]: 'ACCEPTED' } : form.checks,
    });
  };
  const inspectedAtId = useId();
  const [inspectedDate = '', inspectedTimeRaw = ''] = form.inspectedAt.split('T');
  const inspectedTime = inspectedTimeRaw.slice(0, 5);
  const changeInspectedAt = (date: string, time: string) =>
    change({ ...form, inspectedAt: date === '' ? '' : `${date}T${time === '' ? '00:00' : time}` });
  const [chosen, setChosen] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [xrfReports, setXrfReports] = useState<File[]>([]);
  const [ask, setAsk] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
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
  /* 불량 수량 합계 = 불합격 수량(omf-all-around#205 · 서버 장부 P-156) — 서버가 확정에서 같은 합계를 대조한다. */
  const defectTarget = rejectedQty;
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
  /*
   * 불량이 있으면 불량 유형이 필수다 — 불합격 판정이거나, 합격·보류여도 불합격 수량이 있다(#205 · 사용자 결정 2026-10-30).
   * 고른 유형은 합계까지 맞아야 낸다.
   */
  const defectsRequired = overall === 'REJECTED' || rejectedQty > 0;
  const defectsSent = defectsRequired;
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
      if (j == null) return;
      if (item.dataTypeCode !== 'TEXT') {
        bool(item, j === 'ACCEPTED');
        return;
      }
      /* 텍스트 항목은 적은 글을 싣는다 — 글이 없으면 판정만(#247 · 사용자 지시 2026-11-10). */
      const text = (form.texts[item.inspectionItemSpecId] ?? '').trim();
      out.push({
        inspectionItemSpecId: item.inspectionItemSpecId,
        sampleNo: 1,
        ...(text === '' ? {} : { textValue: text }),
        judgmentCode: j,
        measuredAt,
      });
    });
    return out;
  };

  const blocked =
    props.inspector === null ||
    overall === null ||
    inspectedQty === null ||
    inspectedQty <= 0 ||
    visualDefectQty === null ||
    (defectsSent && 'blocked' in defectResult) ||
    (needsReason && reason.trim() === '');

  const onSubmit = () => {
    setAsk(false);
    if (blocked || overall === null || inspectedQty === null) return;
    submit.write({
      inspectionRequestId: request.inspectionRequestId,
      draftResultId: draft?.inspectionResultId ?? null,
      previousResultId: props.previousResultId,
      uomId: request.uomId,
      inspectedAt: toOffset(form.inspectedAt),
      inspectedQty,
      rejectedQty: overall === 'ACCEPTED' ? Math.min(rejectedQty, inspectedQty) : rejectedQty,
      overallJudgmentCode: overall,
      measurements: measurementsOf(),
      defects:
        defectsSent && 'rows' in defectResult
          ? defectResult.rows.map((row) => ({ ...row, defectDescription: null }))
          : [],
      ...(needsReason ? { judgmentChangeReason: reason.trim() } : {}),
      remarks: form.remarks,
      xrfReports,
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
        <AlertBanner variant="warning">
          {/* 버튼은 문구와 같은 줄 오른쪽 끝(사용자 지시 2026-10-30) — DS `action` 자리는 문구 아래 줄이라 쓰지 않는다. 테두리는 둔다(버튼으로 보이게). */}
          <div className="parts-iqc-worker-alert">
            <span>{t.dialog.workerMissing}</span>
            {props.appUserId !== null && (
              <Button variant="outlined" size="sm" onClick={() => setConnectOpen(true)}>
                {messages.usersRoles.workerLink.connect}
              </Button>
            )}
          </div>
        </AlertBanner>
      )}
      {/* 경고 안에서 바로 사번을 잇는다(사용자 지시 2026-10-30) — OA 화면의 연결 창과 같다. 성공하면 세션을 다시 읽어 경고가 걷힌다. */}
      {planOpen && (
        <PlanDialog
          planCode={props.planLabel}
          planName={props.planName}
          itemLabel={
            props.itemParts === null ? '-' : `${props.itemParts.code} · ${props.itemParts.name}`
          }
          version={version}
          specs={specs}
          drawings={<DrawingImages drawings={props.drawings} />}
          onClose={() => setPlanOpen(false)}
        />
      )}
      {connectOpen && props.appUserId !== null && (
        <WorkerConnectDialog appUserId={props.appUserId} onClose={() => setConnectOpen(false)} />
      )}

      <section className="parts-iqc-block" aria-label={t.target.heading}>
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
            <dd className="parts-iqc-plan-cell">
              {props.planLabel}
              {/* 검사 기준 조회 팝업(사용자 지시 2026-10-30) */}
              <Button variant="outlined" size="sm" onClick={() => setPlanOpen(true)}>
                {t.plan.open}
              </Button>
            </dd>
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
            {/* 시각은 입고 화면과 같은 시·분 고르기(공용 패턴) — 글자 입력 대신 DS 모양으로(사용자 지시 2026-10-29). */}
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
            {/* 검사 수량 — 이 회차에 실제로 검사한 수(사용자 지시 2026-10-30). 기본은 검사기준의 시료 수, 고칠 수 있다.
                검사일시와 한 줄, 칸 이름은 위에(검사일시와 같은 모양 · 사용자 지시 2026-10-30). */}
            <div className="field-cell parts-iqc-inspected-qty">
              <FieldLabel htmlFor="parts-iqc-inspected-qty" label={t.lot.inspectedQty} required />
              <TextField
                id="parts-iqc-inspected-qty"
                inputMode="numeric"
                value={form.visualInspectedQty}
                trailingIcon={<span>{t.visual.unit}</span>}
                error={
                  form.visualInspectedQty !== '' && (inspectedQty === null || inspectedQty <= 0)
                    ? t.lot.invalidInspectedQty
                    : undefined
                }
                onChange={(event) => change({ ...form, visualInspectedQty: event.target.value })}
              />
            </div>
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
        {/* 외관 불량 수(왼쪽) · 외관 불량 유형(오른쪽)을 좌우로(사용자 지시 2026-11-04). */}
        <div className="parts-iqc-visual-row">
          <div className="parts-iqc-visual-line">
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
                /* 앞자리 0 은 떼어 「01」처럼 서지 않게 한다(사용자 지시 2026-11-04). */
                onChange={(event) =>
                  change({ ...form, visualDefectQty: event.target.value.replace(/^0+(?=\d)/, '') })
                }
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

          {/* 불량이 있을 때만 불량 유형을 고른다 — 불합격 판정이거나 불합격 수량이 있을 때. 외관 불량 수 오른쪽에 둔다(사용자 지시 2026-11-04). */}
          {defectsRequired && (
            <div className="parts-iqc-visual-defects">
              {/*
               * 한 줄 — 「외관 불량 유형 *」(외관 불량 수와 같은 이름표) · 불량 코드 등록 · 목록(사용자 지시 2026-11-04).
               * 「하나 이상 선택하세요」 글은 두지 않는다 — 제출이 막혀 있다. 수량 · 합계 오류는 남긴다.
               */}
              <div
                className="parts-iqc-defect-line"
                role="group"
                aria-labelledby="parts-iqc-defect-type"
              >
                <span className="field-label" id="parts-iqc-defect-type">
                  {t.visual.defectType}
                  <span className="required-mark" aria-hidden="true">
                    {' *'}
                  </span>
                </span>
                {!props.defectCodesFailed &&
                  leafCodes.length === 0 &&
                  props.onRegisterDefectCode !== undefined && (
                    <Button variant="outlined" onClick={props.onRegisterDefectCode}>
                      {t.visual.defectCodeRegister}
                    </Button>
                  )}
                {props.defectCodesFailed ? (
                  <p className="field-note">{t.visual.defectCodesFailed}</p>
                ) : leafCodes.length === 0 ? (
                  /* 안내는 정보 아이콘 + 파란 바탕 한 줄(사용자 지시 2026-11-04 — 라벨 형식). */
                  <span className="iqc-inspection-action-note" data-tone="info">
                    <Icon name="info" size={14} aria-hidden />
                    {t.visual.defectCodesEmpty}
                  </span>
                ) : (
                  /* 검색되는 선택칸에서 닫지 않고 여러 개 넣고 뺀다(사용자 지시 2026-11-04 — 체크란 대신). 둘 이상이면 아래 표의 휴지통으로도 뺀다. */
                  <div className="parts-iqc-defect-options">
                    <DefectMultiSelect
                      aria-labelledby="parts-iqc-defect-type"
                      options={leafCodes.map((code) => ({
                        value: String(code.defectCodeId),
                        label: code.defectName,
                      }))}
                      values={form.defectCodeIds.map(String)}
                      placeholder={t.visual.defectTypePlaceholder}
                      pickedLabel={t.visual.defectTypePicked}
                      searchLabel={t.visual.defectTypeSearch}
                      emptyText={t.visual.defectTypeNoMatch}
                      invalid={form.defectCodeIds.length === 0}
                      onChange={(values) => change({ ...form, defectCodeIds: values.map(Number) })}
                    />
                  </div>
                )}
                {/* 빈 칸 · 유형 수량 누락 · 합계 어긋남 글은 두지 않는다 — 합계는 수량 표 오른쪽 라벨이 맡는다(사용자 지시 2026-11-04). */}
                {/* 서버가 불량 유형을 거부한 까닭(합계 불일치 등) — 화면 검사를 지나 온 경우다(#205). */}
                {submit.fieldErrors.defects !== undefined && (
                  <p className="parts-iqc-hint parts-iqc-hint-inline" role="alert">
                    <Icon name="error" />
                    {submit.fieldErrors.defects}
                  </p>
                )}
              </div>
              {/* 둘 이상 고르면 유형마다 수량을 표로 — 합계가 불합격 수량과 같아야 한다(#205 · 사용자 지시 2026-11-04). 하나면 외관 불량 수가 그 수량이다. */}
              {form.defectCodeIds.length > 1 && (
                <DefectQtyTable
                  rows={form.defectCodeIds.map((id) => ({
                    defectCodeId: id,
                    name:
                      leafCodes.find((code) => code.defectCodeId === id)?.defectName ?? String(id),
                  }))}
                  qtys={form.defectQtys}
                  target={defectTarget}
                  onRemove={(id) =>
                    change({
                      ...form,
                      defectCodeIds: form.defectCodeIds.filter((kept) => kept !== id),
                    })
                  }
                  onChange={(id, value) =>
                    change({ ...form, defectQtys: { ...form.defectQtys, [id]: value } })
                  }
                />
              )}
            </div>
          )}
        </div>
        {xrfItems.length > 0 && (
          <div className="parts-iqc-file">
            <div className="parts-iqc-file-text">
              <span className="parts-iqc-file-title">{t.visual.xrfReport}</span>
              {xrfReports.length === 0 ? (
                <span className="parts-iqc-muted">{t.visual.noFile}</span>
              ) : (
                /* 여러 건(사용자 지시 2026-10-30) — 파일마다 이름과 빼기 */
                <ul className="parts-iqc-file-list">
                  {xrfReports.map((file, index) => (
                    <li key={`${file.name}-${String(file.size)}-${String(file.lastModified)}`}>
                      <span>{file.name}</span>
                      <IconButton
                        icon="close"
                        size="sm"
                        aria-label={t.visual.removeFile(file.name)}
                        disabled={submit.isSaving}
                        onClick={() => setXrfReports(xrfReports.filter((_, i) => i !== index))}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              hidden
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.doc,.docx,.csv,.txt"
              onChange={(event) => {
                const picked = Array.from(event.target.files ?? []);
                /* 같은 파일을 다시 고르면 한 번만 둔다. 칸을 비워 같은 파일을 빼고 다시 고를 수 있게 한다. */
                const same = (a: File, b: File) =>
                  a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
                setXrfReports([
                  ...xrfReports,
                  ...picked.filter((file) => !xrfReports.some((kept) => same(kept, file))),
                ]);
                event.target.value = '';
              }}
            />
            <Button
              variant="outlined"
              leadingIcon={<Icon name="upload" />}
              disabled={submit.isSaving}
              onClick={() => fileRef.current?.click()}
            >
              {t.visual.pickFile}
            </Button>
          </div>
        )}
      </section>

      {/* 기타 검사 항목 — 표(No. · 검사 내용 · 측정 결과 · 판정). 비고는 기준서 도면 아래 제 칸으로(#247 · 사용자 지시 2026-11-10). */}
      {checkItems.length > 0 && (
        <section className="parts-iqc-card" aria-labelledby="parts-iqc-checks">
          <div className="parts-iqc-block-head">
            <h3 id="parts-iqc-checks">{t.visual.checks}</h3>
            {/* 치수 측정처럼 「판정한 항목 / 전체」(#247 · 사용자 지시 2026-11-10). */}
            <span className="parts-iqc-muted">
              {t.dimension.progress(
                checkItems.filter(
                  (item) => (form.checks[item.inspectionItemSpecId] ?? null) !== null,
                ).length,
                checkItems.length,
              )}
            </span>
          </div>
          <div className="parts-iqc-grid-scroll">
            {/* 치수 측정 표와 같은 모양 · 같은 머리 이름(#247 · 사용자 지시 2026-11-10). */}
            <table className="parts-iqc-grid">
              <thead>
                <tr>
                  <th scope="col" className="parts-iqc-item">
                    {t.visual.checkNo}
                  </th>
                  <th scope="col" className="parts-iqc-name">
                    {t.dimension.content}
                  </th>
                  {hasTextChecks && <th scope="col">{t.visual.checkValue}</th>}
                  <th scope="col" className="parts-iqc-verdict-head">
                    {t.dimension.judgment}
                  </th>
                </tr>
              </thead>
              <tbody>
                {checkItems.map((item, index) => (
                  <tr key={item.inspectionItemSpecId}>
                    <td>{index + 1}</td>
                    <td className="parts-iqc-name">
                      <ItemNameCell item={item} />
                    </td>
                    {hasTextChecks && (
                      <td className="parts-iqc-check-value">
                        {item.dataTypeCode === 'TEXT' && (
                          <TextField
                            fullWidth
                            aria-label={t.visual.checkValueLabel(item.inspectionItemName)}
                            value={form.texts[item.inspectionItemSpecId] ?? ''}
                            maxLength={200}
                            onChange={(event) => changeText(item, event.target.value)}
                          />
                        )}
                      </td>
                    )}
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
        </section>
      )}

      {/* 종합 판정 — 기타 검사 항목 아래(#247 · 사용자 지시 2026-11-10). 왼쪽 자동 판정 결과 상자 · 세로선 · 오른쪽 종합 판정 고르기(사용자 시안 2026-10-29) */}
      <section className="parts-iqc-card" aria-labelledby="parts-iqc-verdict">
        <h3 id="parts-iqc-verdict" className="parts-iqc-sub-title">
          {t.verdict.overall}
        </h3>
        <div className="parts-iqc-verdict-line">
          <div
            className={`parts-iqc-auto-box${suggested === 'REJECTED' ? ' is-ng' : suggested === 'ACCEPTED' ? ' is-ok' : ''}`}
          >
            <span className="parts-iqc-auto-label">{t.verdict.suggested}</span>
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

      <DrawingImages drawings={props.drawings} />

      {/* 비고 — 맨 아래(#247 · 사용자 지시 2026-11-10). */}
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

      {ask &&
        (() => {
          const judgment = t.judgment[overall ?? ''] ?? '';
          const outOfSpec = dimensionStates.filter((st) => st === 'err').length;
          const missing = dimensionStates.filter((st) => st === 'empty' || st === 'wait').length;
          const defects = visualDefectQty ?? 0;
          const verdict = (ok: boolean) => (
            <span className="parts-iqc-confirm-verdict" data-tone={ok ? 'ok' : 'check'}>
              {ok ? t.confirm.ok : t.confirm.check}
            </span>
          );
          return (
            <Dialog
              open
              size="md"
              showCloseButton={false}
              closeOnBackdropClick={false}
              title={t.confirm.title(judgment)}
              onClose={() => setAsk(false)}
              footer={
                <>
                  <Button variant="outlined" onClick={() => setAsk(false)}>
                    {t.confirm.back}
                  </Button>
                  <Button variant="filled" onClick={onSubmit}>
                    {t.confirm.action(judgment)}
                  </Button>
                </>
              }
            >
              {/* 내기 전에 무엇으로 나가는지 한 번 더 본다 — 규격 밖·덜 적은 항목이 여기서 드러난다(사용자 시안 2026-11-04). */}
              <div className="parts-iqc-confirm">
                <p className="parts-iqc-confirm-note">{t.confirm.note}</p>
                <dl className="parts-iqc-confirm-rows">
                  <div>
                    <dt>{t.confirm.target}</dt>
                    <dd>{props.itemParts?.name ?? props.itemParts?.code ?? '-'}</dd>
                  </div>
                  <div>
                    <dt>{t.confirm.lot}</dt>
                    <dd>{props.lotNo}</dd>
                  </div>
                  <div>
                    <dt>{t.confirm.supplier}</dt>
                    <dd>{props.inbound?.supplierLabel ?? '-'}</dd>
                  </div>
                </dl>
                <div className="parts-iqc-confirm-cards">
                  <section className="parts-iqc-confirm-card">
                    <h4>{t.confirm.dimension}</h4>
                    <strong>{t.confirm.dimensionValue(outOfSpec, missing)}</strong>
                    {verdict(outOfSpec === 0 && missing === 0)}
                  </section>
                  <section className="parts-iqc-confirm-card">
                    <h4>{t.confirm.visual}</h4>
                    <strong>{t.confirm.visualValue(defects)}</strong>
                    {verdict(defects === 0)}
                  </section>
                </div>
                <dl className="parts-iqc-confirm-rows">
                  <div>
                    <dt>{t.confirm.xrf}</dt>
                    <dd>{xrfItems.length === 0 ? '-' : t.visual.xrf[form.xrf]}</dd>
                  </div>
                </dl>
              </div>
            </Dialog>
          );
        })()}
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
            setXrfReports([]);
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
