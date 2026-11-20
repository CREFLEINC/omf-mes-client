import { Button, Chip, Icon } from '@crefle/web-ui';
import type { components, InspectionResultSummaryForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { formatPackage, formatQty } from '../../patterns/package-qty';
import {
  PuActionBar,
  PuBand,
  PuButton,
  PuChip,
  PuCount,
  PuField,
  PuIcon,
  PuNote,
  PuPager,
  PuSection,
  PuSeg,
  PuTiles,
  useClientPage,
  useFitPages,
  type PuFitRef,
  type PuBandItem,
  type PuChipTone,
} from '../../patterns/pop-uniform';
import { toApiError } from '../../patterns/request';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { overriddenLotsOf } from '../parts-iqc-inspection/lot-judgment';
import { ReinspectionReasonField } from '../parts-iqc-inspection/reinspection-reason-field';
import { useOqcSerialRecords } from '../oqc-inspection/queries';
import { toSerialInputs, type SerialRow } from '../oqc-inspection/serials';
import {
  defaultMatchOf,
  OPEN_STATUSES,
  overviewOfViews,
  pickedLotViewsOf,
  ruleCodeOf,
  type PickedLotView,
} from '../oqc-inspection/shipment-oqc';
import { LotJudgmentChip, portionsText, replacedText } from '../oqc-inspection/shipment-oqc-parts';
import {
  useSaveShipmentResult,
  useShipmentOqcRequest,
  useShipmentRequestRef,
  type ShipmentRequestRef,
} from '../oqc-inspection/shipment-oqc-queries';
import { QueueLoadErrorBanner } from '../oqc-inspection/load-error-banner';
import {
  ShipmentMeasurementSection,
  useShipmentMeasurements,
  type ShipmentMeasurements,
} from '../oqc-inspection/shipment-measurements';
import { SHIPMENT_JUDGMENTS } from '../oqc-inspection/shipment-result-drawer';
import type { InspectionRequestResponse } from '../oqc-inspection/types';

type ShipmentRequestLot = components['schemas']['ShipmentRequestLot'];
import { formatDateTime } from '../oqc-inspection/types';
import { withUom } from '../oqc-inspection/uom-lookup';
import { judgeOf } from './judgment';
import { shipmentStateChip } from './queue-list';
import { useInspectionGuide } from '../../patterns/inspection-guide';
import { usePlanVersion } from '../parts-iqc-inspection/queries';
import { describeSpec } from '../pqc-panel/web-item-table';
import { useUomLookup } from '../oqc-inspection/uom-lookup';
import { bandLabel, PopPlanDialog } from './request-summary';
import { PopSerialDialog } from './serial-step';

const pop = messages.popOqcInspection;
const ps = messages.popOqcInspection.shipment;
const s = messages.oqcInspection.shipment;
const serialText = messages.oqcInspection.serials;
type OqcSerialRecord = components['schemas']['OqcSerialRecord'];
const itemsText = messages.pqcInspectionRegister.web.items;
const measureText = messages.pqcInspection.measurements;

/**
 * P-04-06 출하 OQC 새 흐름(피처 010 · 시안 P0406-After · decisions #47) — 결과 «추가»만 한다(고치기는 관리웹 W-04-03, 잘못 넣으면
 * 새 결과로 덮는다 — 마지막 결과 규칙). 저장 확인 창이 없고(확정이 아니다), 새 결과는 미검사 LOT 만 미리 체크한다.
 * 화면 상태는 이 훅 하나가 들고, 상세(`PopShipmentDetail`)와 바닥 띠(`PopShipmentBar`)가 나눠 그린다.
 */
export const usePopShipmentForm = (inspectionRequestId: number | null, workerNo: string | null) => {
  const query = useShipmentOqcRequest(inspectionRequestId);
  const request = query.data;
  const ref = useShipmentRequestRef(request?.targetId ?? null, request?.itemId ?? 0);
  const views = request === undefined ? null : pickedLotViewsOf(request);
  const results = request?.results ?? [];

  const [matched, setMatched] = useState<number[]>([]);
  const [judgment, setJudgment] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [serialRows, setSerialRows] = useState<SerialRow[]>([]);
  /* [시리얼 검사 기록] 창 — 단추는 바닥 띠, 창은 상세가 그린다(사용자 지시 2026-11-20). */
  const [serialOpen, setSerialOpen] = useState(false);
  const [savedSeq, setSavedSeq] = useState<number | null>(null);
  /*
   * [재검사]로 연 결과 등록(사용자 지시 2026-11-20) — 판정을 마친 열린 의뢰는 결과 등록을 닫아 두고 [재검사]로 연다.
   * 다른 의뢰를 고르면 닫고, 새로고침은 그대로 둔다. [취소]는 닫으면서 적던 값을 버린다(`draftGen` 으로 다시 연다).
   */
  const [reinspecting, setReinspecting] = useState(false);
  const [draftGen, setDraftGen] = useState(0);

  /* 의뢰가 바뀌거나 결과가 늘면(또는 [취소]) 새 결과를 빈 판정 · 미검사 LOT 체크로 다시 연다. */
  const resetKey =
    request === undefined
      ? null
      : `${String(request.inspectionRequestId)}#${String(results.length)}#${String(draftGen)}`;
  useEffect(() => {
    if (resetKey === null || views === null) return;
    setMatched(defaultMatchOf(views.active));
    setJudgment(null);
    setReason(null);
    setSerialRows([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);
  useEffect(() => {
    setSavedSeq(null);
    setReinspecting(false);
  }, [inspectionRequestId]);
  /* 검사 항목 측정(FR-009 · T052) — POP 은 결과를 더하기만 하므로 늘 빈 칸에서 시작한다(결과가 늘면 다시 연다). */
  const measurements = useShipmentMeasurements({
    planVersionId: request?.inspectionPlanVersionId,
    resultId: null,
    resetKey: resetKey ?? '',
  });

  const seqNo =
    request?.nextResultSeqNo ?? results.reduce((max, result) => Math.max(max, result.seqNo), 0) + 1;
  const save = useSaveShipmentResult(
    inspectionRequestId,
    () => {
      setSavedSeq(seqNo);
      setReinspecting(false);
    },
    workerNo ?? undefined,
  );

  const overridden = overriddenLotsOf({
    results,
    editingResultId: null,
    seqNo,
    matchedLotIds: matched,
    judgmentCode: judgment,
  });
  const needsReason = overridden.length > 0;

  const blockedReason: string | null = (() => {
    if (request === undefined || views === null) return pop.bar.blocked.loading;
    if (request.statusCode === 'SKIPPED') return ps.bar.blocked.skipped;
    if (!OPEN_STATUSES.includes(request.statusCode)) return ps.bar.blocked.completed;
    if (views.active.length === 0) return ps.bar.blocked.noLots;
    if (workerNo === null) return pop.bar.blocked.worker;
    if (matched.length === 0) return ps.bar.blocked.match;
    if (judgment === null) return ps.bar.blocked.judgment;
    if (needsReason && reason === null) return ps.bar.blocked.reason;
    if (measurements.hasError) return ps.bar.blocked.measurement;
    return null;
  })();

  const writable =
    request !== undefined &&
    views !== null &&
    OPEN_STATUSES.includes(request.statusCode) &&
    views.active.length > 0;
  /* 판정을 마친 열린 의뢰 — 목록 「판정 완료」 탭과 같은 조건(`isJudgedOpen`): 살아 있는 피킹 LOT 이 모두 판정을 가졌다. */
  const judgedOpen =
    writable && views.active.every((view) => view.judgmentCode !== 'NOT_INSPECTED');
  /* 결과 등록을 보이는가 — 판정 대기는 바로, 판정 완료는 [재검사]를 누른 뒤에만. 저장 몸통 · 규칙은 그대로다. */
  const entryOpen = writable && (!judgedOpen || reinspecting);

  const submit = () => {
    if (blockedReason !== null || request === undefined || judgment === null) return;
    setSavedSeq(null);
    const inspectedAt = new Date().toISOString();
    save.write({
      inspectionRequestId: request.inspectionRequestId,
      uomId: request.uomId,
      judgmentCode: judgment,
      matchedLotIds: matched,
      reinspectionReasonCode: needsReason ? reason : null,
      inspectedAt,
      measurements: measurements.inputs(inspectedAt),
      serials: toSerialInputs(serialRows),
      editing: null,
    });
  };

  return {
    query,
    request,
    ref: ref.data,
    views,
    results,
    seqNo,
    matched,
    setMatched,
    judgment,
    setJudgment,
    reason,
    setReason,
    serialRows,
    setSerialRows,
    serialOpen,
    setSerialOpen,
    /* 결과를 더할 수 있는 의뢰 — 열린 상태이고 피킹 LOT 이 있다. */
    writable,
    entryOpen,
    judgedOpen,
    reinspect: () => {
      setSavedSeq(null);
      setReinspecting(true);
    },
    cancelReinspect: () => {
      setReinspecting(false);
      setDraftGen((gen) => gen + 1);
    },
    measurements,
    overridden,
    needsReason,
    blockedReason,
    savedSeq,
    save,
    submit,
  };
};

export type PopShipmentForm = ReturnType<typeof usePopShipmentForm>;

/** 머리 품목 칸 — 의뢰 응답의 코드·이름, 없으면 지시서 라인, 그래도 없으면 품목 번호. */
const itemText = (
  request: InspectionRequestResponse,
  refData: ShipmentRequestRef | undefined,
): string => {
  const code = request.itemCode ?? refData?.itemCode ?? null;
  if (code === null || code === '') return pop.detail.idValue(request.itemId);
  return ps.itemValue(code, request.itemName ?? refData?.itemName ?? '');
};

/** 교체로 빠진 LOT 줄 — 「2회차 불합격 · PDA 교체 11-18 11:02 작업자 · 부적합 NC-…」(시안 P0406). */
const popReplacedText = (lot: ShipmentRequestLot | null): string => {
  const replacement = lot?.replacement ?? null;
  if (replacement === null) return replacedText(lot);
  const names: Readonly<Record<string, string>> = s.judgments;
  const judgment =
    replacement.judgment === null
      ? s.judgments.REJECTED
      : (names[replacement.judgment] ?? replacement.judgment);
  return ps.replacedLine(
    replacement.resultRound,
    judgment,
    formatPlantDateTime(replacement.replacedAt) ?? replacement.replacedAt,
    replacement.worker?.workerName ?? '',
    replacement.nonconformanceNo,
  );
};

/**
 * 머리 — 지시서 번호 아래 정보 띠. 옛 흐름의 의뢰 정보 띠(`PopRequestBand` · `oqc-band`, 공통 `PuBand` 격자 ·
 * 이름을 값 위에 작게)와 같은 모양이다. 수량은 출하 완료(P-04-07)와 같은 말(지시량 · 피킹량 · 초과량)과 단위로 쓴다.
 */
/** 보조 정보 값 — 주요 정보(지시서 · 상태 · 품목 · 수량)보다 작고 옅게(2026-11-20). */
const sub = (value: ReactNode): ReactNode => <span className="pop-oqc-sub">{value}</span>;

const Summary = ({
  request,
  refData,
  uom,
  state,
  measurements,
}: {
  request: InspectionRequestResponse;
  refData: ShipmentRequestRef | undefined;
  uom: string;
  /** 검사 상태 칩 — 목록 카드와 같은 말·색. */
  state: { text: string; tone: PuChipTone };
  /** 검사 기준 창에 보일 그 기준의 검사 항목(결과 입력이 이미 읽은 것). */
  measurements: ShipmentMeasurements;
}) => {
  const [planOpen, setPlanOpen] = useState(false);
  const planId = request.inspectionPlanVersionId ?? null;
  const planVersion = usePlanVersion(planId).data;
  const guides = useInspectionGuide(request.inspectionRequestId).data ?? [];
  /* 버전을 아직 못 읽었으면 번호(#id)로 둔다 — 옛 흐름 정보 띠와 같다. */
  const planLabel =
    planId === null
      ? ''
      : planVersion === undefined
        ? pop.detail.idValue(planId)
        : pop.detail.planVersion(planVersion.planVersion);
  const qty = (value: number | undefined): string =>
    value === undefined ? '—' : withUom(formatQty(value), uom || null);
  /*
   * 지시서 번호도 칸 하나(출하 완료 머리 띠와 같다 · 2026-11-20). 품목은 길어 한 줄 전체를 쓰고, 격자를 빈틈없이
   * 채우도록(`dense`) 뒤 칸이 첫 줄을 먼저 채운다.
   */
  const items: PuBandItem[] = [
    {
      label: bandLabel('file', ps.refs.shipmentRequest),
      value: (
        <span className="pu-mono">
          {request.shipmentRequestNo ?? refData?.shipmentRequestNo ?? '—'}
        </span>
      ),
    },
    {
      label: bandLabel('shield', ps.refs.status),
      value: <PuChip tone={state.tone}>{state.text}</PuChip>,
    },
    {
      label: bandLabel('box', pop.detail.fields.item),
      value: itemText(request, refData),
      wide: true,
    },
    { label: bandLabel('check', ps.target), value: qty(refData?.targetQty) },
    { label: bandLabel('check', ps.picked), value: qty(refData?.pickedQty) },
    ...(refData !== undefined && refData.overQty > 0
      ? [{ label: bandLabel('check', ps.over), value: qty(refData.overQty) }]
      : []),
    {
      label: bandLabel('file', ps.refs.request),
      value: sub(<span className="pu-mono">{request.inspectionRequestNo}</span>),
    },
    { label: bandLabel('list', ps.refs.customer), value: sub(refData?.customerName ?? '—') },
    { label: bandLabel('list', ps.refs.shipTo), value: sub(refData?.shipToName ?? '—') },
    {
      label: bandLabel('file', ps.refs.plan),
      wide: true,
      /* [기준 조회] — 옛 흐름 정보 띠와 같은 자리 · 같은 작은 단추(사용자 지시 2026-11-20). */
      value: (
        <span className="oqc-vrow">
          {sub(planId == null ? pop.detail.noPlanVersion : pop.detail.planValue(planLabel))}
          {(planId != null || guides.length > 0) && (
            <PuButton
              size="sm"
              onClick={() => {
                setPlanOpen(true);
              }}
            >
              {pop.detail.viewPlan}
            </PuButton>
          )}
        </span>
      ),
    },
    {
      label: bandLabel('clock', ps.refs.requestedAt),
      value: sub(formatDateTime(request.requestedAt)),
    },
  ];

  return (
    <section className="pop-oqc-summary" aria-label={request.inspectionRequestNo}>
      <div className="oqc-band pu-band-stack is-fluid">
        <PuBand grid={4} items={items} label={ps.bandLabel} />
      </div>
      {planOpen && (
        <PopPlanDialog
          inspectionTypeCode={request.inspectionTypeCode}
          planId={planId}
          planLabel={planLabel}
          guides={guides}
          title={ps.refs.plan}
          items={<PlanItems form={measurements} />}
          onClose={() => {
            setPlanOpen(false);
          }}
        />
      )}
    </section>
  );
};

const LotLine = ({
  view,
  refData,
  uom,
}: {
  view: PickedLotView;
  refData: ShipmentRequestRef | undefined;
  uom: string;
}) => {
  const portions = portionsText(refData?.lotOf(view.lot.lotId) ?? null, ps.staging, uom);

  return (
    <li className="pop-oqc-shipment-lot">
      {/* LOT 번호·수량은 한 줄(단위 포함), 창고 몫만 줄을 바꾼다(출하 완료 표 규칙과 같다). */}
      <span className="pop-oqc-shipment-lot__no">
        <strong className="pop-oqc-nowrap">{view.lot.lotNo}</strong>{' '}
        <span className="pop-oqc-nowrap">{withUom(formatQty(view.lot.lotQty), uom || null)}</span>
      </span>
      <span className="pop-oqc-shipment-lot__judgment">
        <LotJudgmentChip code={view.judgmentCode} size="md" />
        <span className="pop-oqc-shipment-muted">
          {view.appliedSeqNo !== null
            ? s.lots.applied(view.appliedSeqNo)
            : view.judgmentCode === 'SKIPPED'
              ? ''
              : ps.appliedNone}
        </span>
        {view.judgmentCode === 'REJECTED' ? (
          <span className="pop-oqc-shipment-muted">{s.lots.replaceHint}</span>
        ) : null}
      </span>
      {portions === '' ? null : <span className="pop-oqc-shipment-muted">{portions}</span>}
    </li>
  );
};

const ResultLine = ({
  result,
  lotNoOf,
  replacedIds,
  serials,
}: {
  result: InspectionResultSummaryForward;
  lotNoOf: (lotId: number) => string;
  replacedIds: readonly number[];
  /** 이 회차가 마지막으로 쓴 시리얼 기록(서버는 시리얼당 한 줄 — 재검 회차가 고치면 그 회차로 옮겨 간다). */
  serials: readonly OqcSerialRecord[];
}) => (
  <li className="pop-oqc-shipment-result">
    <span className="pop-oqc-shipment-result__seq">{s.results.seq(result.seqNo)}</span>
    <span className="pop-oqc-shipment-result__body">
      {result.overallJudgmentCode === null ? null : (
        <LotJudgmentChip
          code={
            result.overallJudgmentCode === 'ACCEPTED' ||
            result.overallJudgmentCode === 'REJECTED' ||
            result.overallJudgmentCode === 'HELD'
              ? result.overallJudgmentCode
              : 'NOT_INSPECTED'
          }
        />
      )}
      {result.matchedLotIds.map((lotId) => (
        <Chip
          key={lotId}
          size="sm"
          title={lotNoOf(lotId)}
          className={replacedIds.includes(lotId) ? 'iqc-inbound-chip-inactive' : undefined}
        >
          {lotNoOf(lotId)}
        </Chip>
      ))}
      {(result.reinspectionReasonName ?? result.reinspectionReasonCode) ? (
        <span className="pop-oqc-shipment-muted">
          {s.results.reason(result.reinspectionReasonName ?? result.reinspectionReasonCode ?? '')}
        </span>
      ) : null}
      {serials.length > 0 && (
        <span className="pop-oqc-result-serials" aria-label={ps.results.serials(serials.length)}>
          <span className="pop-oqc-shipment-muted">{ps.results.serials(serials.length)}</span>
          {serials.map((record) => (
            <span key={record.serialNumberId} className="pop-oqc-result-serial">
              <b className="pu-mono">{record.serialNo}</b>
              <PuChip tone={record.finalJudgmentCode === 'OK' ? 'ok' : 'bad'}>
                {record.finalJudgmentCode === 'OK' ? serialText.ok : serialText.ng}
              </PuChip>
            </span>
          ))}
        </span>
      )}
    </span>
    <span className="pop-oqc-shipment-muted">
      {[
        result.inspectorName ?? '—',
        formatPlantDateTime(result.inspectedAt) ?? result.inspectedAt,
      ].join(
        ' · ', // ui-check-ignore: C-13 시안 P0406 결과 줄 「검사자 · 시각」
      )}
    </span>
  </li>
);

/** 상세 — 왼쪽: 요약 · 안내 · 피킹 LOT · 검사 결과, 오른쪽: 결과 입력(매칭 · 판정 · 재검 사유 · 시리얼). */
export const PopShipmentDetail = ({
  form,
  uomCode,
}: {
  form: PopShipmentForm;
  uomCode: string | null;
}) => {
  const { request, views } = form;
  /* 피킹 LOT 현황 · 검사 결과 탭 — 다른 의뢰를 고르면 처음(피킹 LOT 현황)으로, 새로고침은 그대로 둔다. */
  const [tab, setTab] = useState<'lots' | 'results'>('lots');
  const requestId = request?.inspectionRequestId ?? null;
  /* 결과 등록 안 두 구획 — ① 검사 대상 LOT · 판정, ② 검사 항목(있을 때만). 다른 의뢰를 고르면 ①로. 입력값은 그대로 남는다. */
  const [entrySeg, setEntrySeg] = useState<'match' | 'items'>('match');
  useEffect(() => {
    setTab('lots');
    setEntrySeg('match');
  }, [requestId]);
  /* 서버가 ①의 칸(검사 대상 LOT · 재검 사유)을 짚어 거절하면 ①을 보인다 — 그 칸 아래 오류가 선다. */
  const savedRuleCode = ruleCodeOf(form.save.error);
  useEffect(() => {
    if (
      savedRuleCode === 'MATCHED_LOT_REQUIRED' ||
      savedRuleCode === 'REINSPECTION_REASON_REQUIRED'
    ) {
      setEntrySeg('match');
    }
  }, [savedRuleCode]);
  /* 칸에 드는 줄만 한 쪽으로(바깥 · 안쪽 스크롤 없음). 쪽 넘김은 각 카드 제목 줄 오른쪽에 둔다(줄 칸을 더 쓰게). */
  const lotsFit = useFitPage(views?.active ?? [], false, requestId);
  const resultsFit = useFitPage(
    [...form.results].sort((a, b) => a.seqNo - b.seqNo),
    false,
    requestId,
  );
  const matchFit = useFitPage(views?.active ?? [], false, requestId);
  const itemsFit = useFitPage(form.measurements.rows, true, requestId);
  /* 저장된 시리얼 기록 — 검사 결과 탭에서 회차마다 보인다. 창에 적고 아직 저장 안 한 것은 넣지 않는다. */
  const serialRecords = useOqcSerialRecords(requestId, true).data ?? [];
  if (request === undefined || views === null) {
    return <p className="field-note">{pop.detail.loading}</p>;
  }

  /* 단위는 의뢰 응답의 코드를 먼저 쓴다 — POP 은 단위 마스터를 못 읽을 수 있다. */
  const uom = request.uomCode ?? uomCode ?? '';
  const refData = form.ref;
  const lots = request.lots ?? [];
  const lotNoOf = (lotId: number): string =>
    lots.find((lot) => lot.lotId === lotId)?.lotNo ?? String(lotId);
  const replacedIds = views.replaced.map((lot) => lot.lotId);
  const overview = overviewOfViews(request.statusCode, views.active);
  const pickedTotal = views.active.reduce((sum, view) => sum + view.lot.lotQty, 0);
  const skipped = request.statusCode === 'SKIPPED';
  const ruleCode = savedRuleCode;
  const tabLabel = `${ps.lotsTitle} · ${s.results.title}`;
  const itemCount = form.measurements.rows.filter((row) => row.sampleNo === 1).length;
  /* ② 검사 항목은 항목이 있거나 못 읽었을 때만(0개면 구획째 없음 — 사용자 지시 2026-11-20). */
  const hasItemsSeg = itemCount > 0 || form.measurements.loadError !== null;
  const seg = hasItemsSeg ? entrySeg : 'match';
  const entryTitle = form.judgedOpen
    ? ps.form.reinspectHeading(form.seqNo)
    : ps.form.heading(form.seqNo);
  const matchSegLabel = `${ps.form.match.matchHeading} · ${s.drawer.judgmentHeading}`;

  return (
    <div className="pop-oqc-shipment">
      {/* 정보 띠는 상세 맨 위에 두 단을 가로질러 넓게(4열 · 1024 는 3열 — 사용자 지시 2026-11-20). */}
      <Summary
        request={request}
        refData={refData}
        uom={uom}
        state={shipmentStateChip(request.statusCode, overview)}
        measurements={form.measurements}
      />
      {/* 긴 안내 문단은 두지 않는다(POP 통일 · 사용자 지시 2026-11-20) — OQC 생략으로 닫힌 의뢰만 그 사실을 알린다. */}
      {skipped && (
        <p className="field-note pop-oqc-shipment-note">
          <Icon name="fast_forward" size={20} aria-hidden />
          <span>{`${s.skipped} ${s.skippedMore}`}</span>
        </p>
      )}
      {/*
       * 피킹 LOT 현황 · 검사 결과는 한 카드에서 탭으로 바꿔 본다(사용자 지시 2026-11-20). 탭은 목록의 판정 대기/완료와 같은
       * 공통 `PuSeg`, 건수는 빨간 원(0 이면 숨김). 처음엔 피킹 LOT 현황 — 다른 의뢰를 고르면 다시 그리로, 새로고침은 그대로.
       */}
      <section className="pop-oqc-shipment-box pop-oqc-shipment__col" aria-label={tabLabel}>
        <div className="pop-oqc-shipment-box__head">
          <PuSeg
            label={tabLabel}
            value={tab}
            onChange={setTab}
            options={[
              {
                value: 'lots',
                label: (
                  <>
                    {ps.lotsTitle}
                    {views.active.length > 0 && (
                      <>
                        {' '}
                        <PuCount tone="primary">{views.active.length}</PuCount>
                      </>
                    )}
                  </>
                ),
              },
              {
                value: 'results',
                label: (
                  <>
                    {s.results.title}
                    {form.results.length > 0 && (
                      <>
                        {' '}
                        <PuCount tone="primary">{form.results.length}</PuCount>
                      </>
                    )}
                  </>
                ),
              },
            ]}
          />
          <span className="pop-oqc-shipment-gap" />
          {tab === 'lots' && views.active.length > 0 && (
            <span className="pop-oqc-shipment-muted">
              {s.lots.total(withUom(formatQty(pickedTotal), uom || null))}
            </span>
          )}
          {tab === 'lots' ? lotsFit.pager(ps.lotsTitle) : resultsFit.pager(s.results.title)}
        </div>
        {tab === 'lots' ? (
          <>
            {views.active.length === 0 && views.replaced.length === 0 ? (
              /* 판정 대기인데 LOT 이 없으면 결과를 기록할 수 없다 — 그 까닭 한 줄(출하 완료 막힘 사유와 같은 안내 모양). */
              OPEN_STATUSES.includes(request.statusCode) ? (
                <PuNote tone="warn">{ps.form.noLots}</PuNote>
              ) : (
                <p className="pop-oqc-empty-row">{ps.lotsEmpty}</p>
              )
            ) : (
              <ul ref={lotsFit.fitRef} className="pop-oqc-shipment-lots pu-fit">
                {lotsFit.items.map((view) => (
                  <LotLine key={view.lot.lotId} view={view} refData={refData} uom={uom} />
                ))}
              </ul>
            )}
            {views.replaced.length === 0 ? null : (
              <>
                <p className="pop-oqc-shipment-muted pop-oqc-shipment-replaced-head">
                  <Icon name="swap_horiz" size={20} aria-hidden />
                  {ps.lotsReplacedHeading}
                </p>
                <ul className="pop-oqc-shipment-lots pop-oqc-shipment-lots--replaced">
                  {views.replaced.map((lot) => (
                    <li key={lot.lotId} className="pop-oqc-shipment-lot">
                      <span className="pop-oqc-shipment-lot__no">
                        <s className="pop-oqc-nowrap">{lot.lotNo}</s>{' '}
                        <span className="pop-oqc-nowrap">
                          {withUom(formatQty(lot.lotQty), uom || null)}
                        </span>
                      </span>
                      <Chip size="md">{s.lots.replaced}</Chip>
                      <span className="pop-oqc-shipment-muted">
                        {popReplacedText(refData?.lotOf(lot.lotId) ?? null)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        ) : form.results.length === 0 ? (
          <p className="pop-oqc-empty-row">{s.results.empty}</p>
        ) : (
          <ul ref={resultsFit.fitRef} className="pop-oqc-shipment-results pu-fit">
            {resultsFit.items.map((result) => (
              <ResultLine
                key={result.inspectionResultId}
                result={result}
                lotNoOf={lotNoOf}
                replacedIds={replacedIds}
                serials={serialRecords.filter(
                  (record) => record.inspectionResultId === result.inspectionResultId,
                )}
              />
            ))}
          </ul>
        )}
      </section>

      {form.entryOpen ? (
        /*
         * 결과 등록 — 옛 흐름 판정 단계 · 다른 POP 입력 카드와 같은 짜임(PuSection 제목 + PuField 이름 위 · 필수 빨간 *).
         * 흐름: 검사 대상 LOT → 검사 항목 → 판정 → (재검 사유 · 시리얼) → 아래 [결과 저장](사용자 지시 2026-11-20).
         */
        <PuSection
          title={entryTitle}
          label={entryTitle}
          className="pop-oqc-entry-card"
          meta={
            seg === 'items'
              ? itemsFit.pager(itemsText.heading)
              : matchFit.pager(ps.form.match.matchHeading)
          }
          head={
            hasItemsSeg ? (
              <PuSeg
                label={entryTitle}
                value={seg}
                onChange={setEntrySeg}
                options={[
                  { value: 'match', label: matchSegLabel },
                  {
                    value: 'items',
                    label: (
                      <>
                        {itemsText.heading} <PuCount>{itemCount}</PuCount>
                      </>
                    ),
                  },
                ]}
              />
            ) : undefined
          }
        >
          {/*
           * 상세는 화면 높이 안에 다 든다(바깥 스크롤 없음 · 사용자 지시 2026-11-20). 결과 등록은 두 구획을 같은 `PuSeg` 로 바꿔 본다:
           * ① 왼쪽 검사 대상 LOT · 오른쪽 판정(→ 재검 사유), ② 검사 항목 표 전폭. 목록 · 표는 칸에 드는 만큼 쪽으로 나눈다.
           */}
          {seg === 'items' ? (
            <PopMeasurements
              form={form.measurements}
              locked={form.save.isSaving}
              page={itemsFit.items}
              fitRef={itemsFit.fitRef}
            />
          ) : (
            <div className="pop-oqc-entry">
              <PopLotMatch
                views={views.active}
                page={matchFit.items}
                fitRef={matchFit.fitRef}
                results={form.results}
                uom={uom}
                value={form.matched}
                disabled={form.save.isSaving}
                error={
                  ruleCode === 'MATCHED_LOT_REQUIRED'
                    ? s.drawer.ruleErrors.MATCHED_LOT_REQUIRED
                    : null
                }
                onChange={form.setMatched}
              />
              <div className="pop-oqc-entry__col">
                {/* 판정은 옛 흐름과 같은 공통 고르기 타일(`PuTiles` · 단일 선택 · 판정 색). */}
                <PuField label={s.drawer.judgmentHeading} required>
                  <PuTiles
                    label={s.drawer.judgmentHeading}
                    cols={3}
                    value={form.judgment}
                    disabled={form.save.isSaving}
                    options={SHIPMENT_JUDGMENTS.map((code) => ({
                      value: code,
                      label: s.judgments[code],
                      judge: judgeOf(code),
                    }))}
                    onChange={form.setJudgment}
                  />
                </PuField>
                {form.needsReason && form.judgment !== null ? (
                  <ReinspectionReasonField
                    overridden={form.overridden}
                    lotNoOf={lotNoOf}
                    judgmentCode={form.judgment}
                    value={form.reason}
                    error={
                      ruleCode === 'REINSPECTION_REASON_REQUIRED'
                        ? s.drawer.ruleErrors.REINSPECTION_REASON_REQUIRED
                        : null
                    }
                    disabled={form.save.isSaving}
                    onChange={form.setReason}
                    text={s.drawer}
                    lotLabel={(lotNo) => lotNo}
                  />
                ) : null}
              </div>
            </div>
          )}
          {form.serialOpen && (
            <PopSerialDialog
              inspectionRequestId={request.inspectionRequestId}
              itemId={request.itemId}
              rows={form.serialRows}
              onChange={form.setSerialRows}
              disabled={form.save.isSaving}
              onClose={() => {
                form.setSerialOpen(false);
              }}
            />
          )}
        </PuSection>
      ) : null}
    </div>
  );
};

/**
 * 검사 기준 창의 검사 항목 — No. · 검사 내용 · 규격 · 샘플 수 · 자동 판정. 결과 입력과 같은 데이터·같은 구분을 쓴다:
 * 못 읽었으면 오류 띠, 읽었는데 0개면 칸째 두지 않는다(사용자 지시 2026-11-20).
 */
const PlanItems = ({ form }: { form: ShipmentMeasurements }) => {
  const uoms = useUomLookup();
  const items = form.rows.filter((row) => row.sampleNo === 1);
  /* 항목이 없으면(또는 아직 읽는 중이면) 칸째 두지 않는다 — 결과 입력과 같은 규칙(사용자 지시 2026-11-20). */
  if (form.loadError === null && items.length === 0) return null;
  return (
    <PuField label={itemsText.heading}>
      {form.loadError !== null ? (
        <QueueLoadErrorBanner error={toApiError(form.loadError)} onRetry={form.retry} />
      ) : (
        /* 창 안 스크롤 대신 쪽 넘김(다른 POP 표와 같다). */
        <Paged list={items} size={PLAN_PAGE} label={itemsText.heading}>
          {(page) => (
            <div className="pu-table-wrap">
              <table className="pu-table" aria-label={itemsText.heading}>
                <thead>
                  <tr>
                    <th scope="col" className="fit num">
                      {itemsText.columns.no}
                    </th>
                    <th scope="col">{itemsText.columns.item}</th>
                    <th scope="col" className="fit">
                      {itemsText.columns.spec}
                    </th>
                    <th scope="col" className="fit num">
                      {measureText.columns.sample}
                    </th>
                    <th scope="col" className="fit">
                      {itemsText.autoJudgment}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {page.map((row) => (
                    <tr key={row.inspectionItemSpecId}>
                      <td className="fit num">{row.displayNo}</td>
                      <td className="pop-oqc-wrap">{row.itemName}</td>
                      <td className="fit">
                        {describeSpec(row.spec, uoms.codeOf(row.spec.uomId ?? undefined))}
                      </td>
                      <td className="fit num">{row.sampleCount}</td>
                      <td className="fit">{row.automaticJudgment ? <PuIcon name="ok" /> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Paged>
      )}
    </PuField>
  );
};

/** 검사 기준 창 항목 표 한 쪽 줄 수(1024 창 높이에도 드는 만큼). */
const PLAN_PAGE = 5;

/** 칸 높이에 드는 줄만 한 쪽으로(공통 `useFitPages`) + 카드 제목 줄 오른쪽 쪽 넘김. */
const useFitPage = <T,>(list: readonly T[], table: boolean, resetKey: unknown) => {
  const fit = useFitPages(list, { table, resetKey });
  return {
    fitRef: fit.fitRef,
    items: fit.items,
    /** 건수는 탭 · 구획 이름 옆에 있어 「총 N건」은 두지 않는다. */
    pager: (label: string) => (
      <PuPager
        total={fit.total}
        page={fit.page}
        pages={fit.pages}
        onPage={fit.setPage}
        label={label}
        showTotal={false}
      />
    ),
  };
};

/** 받은 목록을 쪽으로 나눠 그리고 아래에 공통 쪽 넘김(「총 N건 ‹ n/m ›」). 의뢰가 바뀌면 `key` 로 1쪽부터. */
const Paged = <T,>({
  list,
  size,
  label,
  children,
}: {
  list: readonly T[];
  size: number;
  label: string;
  children: (page: T[]) => ReactNode;
}) => {
  const paged = useClientPage(list, size);
  return (
    <>
      {children(paged.items)}
      <PuPager
        total={paged.total}
        page={paged.page}
        pages={paged.pages}
        onPage={paged.setPage}
        label={label}
      />
    </>
  );
};

/**
 * 검사 대상 LOT — 결과를 걸 피킹 LOT 고르기. 다른 POP 고르기 목록과 같은 체크 줄(`pu-check`)과 [전체 선택] · [선택 해제].
 * 동작은 공용 `LotMatchField` 와 같다 — 체크한 LOT 은 피킹 순서대로 담고, 다른 회차에 걸린 LOT 은 그 회차를 적는다.
 */
const PopLotMatch = ({
  views,
  page,
  fitRef,
  results,
  uom,
  value,
  disabled,
  error,
  onChange,
}: {
  views: readonly PickedLotView[];
  /** 지금 쪽에 보일 줄(칸에 드는 만큼). */
  page: readonly PickedLotView[];
  fitRef: PuFitRef;
  results: readonly InspectionResultSummaryForward[];
  uom: string;
  value: readonly number[];
  disabled: boolean;
  error: string | null;
  onChange: (next: number[]) => void;
}) => {
  const ids = views.map((view) => view.lot.lotId);

  return (
    <PuField
      label={ps.form.match.matchHeading}
      required
      aside={
        <span className="pop-oqc-match-actions">
          <PuButton
            size="sm"
            disabled={disabled || value.length === ids.length}
            onClick={() => onChange(ids)}
          >
            {ps.form.match.selectAll}
          </PuButton>
          <PuButton
            size="sm"
            disabled={disabled || value.length === 0}
            onClick={() => onChange([])}
          >
            {ps.form.match.selectNone}
          </PuButton>
        </span>
      }
    >
      <ul ref={fitRef} className="pop-oqc-match pu-fit">
        {page.map((view) => {
          const { lot } = view;
          const checked = value.includes(lot.lotId);
          const also = results
            .filter((result) => result.matchedLotIds.includes(lot.lotId))
            .map((result) => String(result.seqNo));
          return (
            <li key={lot.lotId}>
              <label className="pu-check">
                <input
                  type="checkbox"
                  aria-label={lot.lotNo}
                  checked={checked}
                  disabled={disabled}
                  onChange={() =>
                    onChange(
                      checked
                        ? value.filter((id) => id !== lot.lotId)
                        : ids.filter((id) => id === lot.lotId || value.includes(id)),
                    )
                  }
                />
                <b className="pu-mono pop-oqc-lotno">{lot.lotNo}</b>
                <span className="pop-oqc-nowrap">
                  {withUom(formatQty(lot.lotQty), uom || null)}
                </span>
                {lot.package != null && (
                  <span className="pop-oqc-shipment-muted">{formatPackage(lot.package)}</span>
                )}
              </label>
              <LotJudgmentChip code={view.judgmentCode} />
              {also.length > 0 && (
                <span className="pop-oqc-shipment-muted">
                  {s.drawer.alsoMatched(also.join(', '))}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {error !== null && <PuNote tone="bad">{error}</PuNote>}
    </PuField>
  );
};

/**
 * 검사 항목 — 항목이 있으면 지금 표 그대로. 다 읽었는데 항목이 없으면 칸을 두지 않고,
 * 못 읽었으면 오류 띠(다시 시도). 두 경우를 섞지 않는다(사용자 지시 2026-11-20). 항목이 없어도 저장은 막지 않는다(지금 규칙).
 */
const PopMeasurements = ({
  form,
  locked,
  page,
  fitRef,
}: {
  form: ShipmentMeasurements;
  locked: boolean;
  /** 지금 쪽에 보일 줄(칸에 드는 만큼). 넣은 값은 쪽을 넘겨도 남는다(값은 폼이 든다). */
  page: ShipmentMeasurements['rows'];
  fitRef: PuFitRef;
}) => {
  if (form.rows.length > 0) {
    return (
      <div ref={fitRef} className="pu-fit pop-oqc-items">
        <ShipmentMeasurementSection form={form} locked={locked} visibleRows={page} />
      </div>
    );
  }
  if (!form.hasPlan || form.isLoading) {
    return <ShipmentMeasurementSection form={form} locked={locked} />;
  }
  /* 다 읽었는데 항목이 없으면 「검사 항목」 칸째 두지 않는다(제목 · 안내 없음 · 사용자 지시 2026-11-20). */
  if (form.loadError === null) return null;
  return (
    <PuField label={itemsText.heading}>
      <QueueLoadErrorBanner error={toApiError(form.loadError)} onRetry={form.retry} />
    </PuField>
  );
};

/** 바닥 띠 — 저장할 수 있는지와 그 이유, [결과 저장] 하나(확인 창 없음). */
export const PopShipmentBar = ({ form }: { form: PopShipmentForm }) => {
  const { blockedReason, save, savedSeq } = form;
  const ruleCode = ruleCodeOf(save.error);
  const canSave = blockedReason === null && !save.isSaving;
  const noteId = useId();

  const note = save.isSaving ? (
    <p className="pop-oqc-bar-note">{ps.bar.saving}</p>
  ) : savedSeq !== null ? (
    <p className="pop-oqc-bar-note pop-oqc-bar-note--success">
      <Icon name="check_circle" size={24} aria-hidden />
      <span>{ps.bar.saved(savedSeq)}</span>
    </p>
  ) : ruleCode === 'CONFIRMED_BY_SHIPMENT_COMPLETION' ? (
    <p className="pop-oqc-bar-note pop-oqc-bar-note--blocked">
      <Icon name="error" size={24} aria-hidden />
      <span>{s.drawer.confirmedByShipment}</span>
    </p>
  ) : ruleCode === 'MATCHED_LOT_REQUIRED' || ruleCode === 'REINSPECTION_REASON_REQUIRED' ? (
    <p className="pop-oqc-bar-note pop-oqc-bar-note--blocked">
      <Icon name="error" size={24} aria-hidden />
      <span>{s.drawer.ruleErrors[ruleCode]}</span>
    </p>
  ) : save.error !== null ? (
    <SaveErrorBanner error={save.error} onReload={() => void form.query.refetch()} />
  ) : blockedReason !== null ? (
    <p className="pop-oqc-bar-note pop-oqc-bar-note--blocked">
      <Icon name="info" size={24} aria-hidden />
      <span>{blockedReason}</span>
    </p>
  ) : (
    <p className="pop-oqc-bar-note pop-oqc-bar-note--ready">
      <Icon name="check_circle" size={24} aria-hidden />
      <span>{ps.bar.ready}</span>
    </p>
  );

  /*
   * 판정을 마친 열린 의뢰는 결과 등록을 닫아 두고 [재검사] 하나만 둔다(사용자 지시 2026-11-20). 띠 글은 방금 저장한 회차만.
   */
  if (form.writable && !form.entryOpen) {
    return (
      <PuActionBar
        lead={
          <div className="pop-action-note" aria-live="polite">
            {savedSeq === null ? null : (
              <p className="pop-oqc-bar-note pop-oqc-bar-note--success">
                <Icon name="check_circle" size={24} aria-hidden />
                <span>{ps.bar.saved(savedSeq)}</span>
              </p>
            )}
          </div>
        }
      >
        <PuButton onClick={form.reinspect}>{ps.bar.reinspect}</PuButton>
      </PuActionBar>
    );
  }

  /* #295 — 공통 작업 줄(`PuActionBar`)에 선다: 왼쪽 띠 글, 오른쪽 [결과 저장]. */
  return (
    <PuActionBar
      lead={
        <div id={noteId} className="pop-action-note" aria-live="polite">
          {note}
        </div>
      }
    >
      {/* [재검사]로 연 결과 등록만 [취소] — 닫으면서 적던 값을 버린다. */}
      {form.judgedOpen && (
        <PuButton disabled={save.isSaving} onClick={form.cancelReinspect}>
          {messages.common.cancel}
        </PuButton>
      )}
      {/* [시리얼 검사 기록] — [결과 저장] 바로 왼쪽. 적은 대수는 단추의 건수(0 이면 숨김), NG 대수는 창 안에 있다. */}
      {form.writable && (
        <PuButton
          disabled={save.isSaving}
          onClick={() => {
            form.setSerialOpen(true);
          }}
        >
          {pop.serial.open}
          {form.serialRows.length > 0 && <PuCount>{form.serialRows.length}</PuCount>}
        </PuButton>
      )}
      {/* 잠긴 까닭은 바로 옆 띠 글이다(C-4). */}
      <PuButton
        variant="primary"
        disabled={!canSave}
        aria-describedby={canSave ? undefined : noteId}
        onClick={form.submit}
      >
        {save.isSaving ? ps.bar.saving : ps.bar.save}
      </PuButton>
    </PuActionBar>
  );
};
