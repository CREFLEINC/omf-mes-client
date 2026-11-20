import { Button, Chip, Icon } from '@crefle/web-ui';
import type { components, InspectionResultSummaryForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { formatQty } from '../../patterns/package-qty';
import {
  PuActionBar,
  PuBand,
  PuButton,
  PuCount,
  type PuBandItem,
} from '../../patterns/pop-uniform';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { overriddenLotsOf } from '../parts-iqc-inspection/lot-judgment';
import { LotMatchField } from '../parts-iqc-inspection/lot-match-field';
import { ReinspectionReasonField } from '../parts-iqc-inspection/reinspection-reason-field';
import { toSerialInputs, type SerialRow } from '../oqc-inspection/serials';
import {
  defaultMatchOf,
  OPEN_STATUSES,
  overviewOfViews,
  pickedLotViewsOf,
  ruleCodeOf,
  type PickedLotView,
} from '../oqc-inspection/shipment-oqc';
import {
  LotJudgmentChip,
  OverviewChip,
  portionsText,
  replacedText,
} from '../oqc-inspection/shipment-oqc-parts';
import {
  useSaveShipmentResult,
  useShipmentOqcRequest,
  useShipmentRequestRef,
  type ShipmentRequestRef,
} from '../oqc-inspection/shipment-oqc-queries';
import {
  ShipmentMeasurementSection,
  useShipmentMeasurements,
} from '../oqc-inspection/shipment-measurements';
import { SHIPMENT_JUDGMENTS } from '../oqc-inspection/shipment-result-drawer';
import type { InspectionRequestResponse } from '../oqc-inspection/types';

type ShipmentRequestLot = components['schemas']['ShipmentRequestLot'];
import { formatDateTime } from '../oqc-inspection/types';
import { withUom } from '../oqc-inspection/uom-lookup';
import { bandLabel } from './request-summary';
import { PopSerialDialog, PopSerialSummary } from './serial-step';

const pop = messages.popOqcInspection;
const ps = messages.popOqcInspection.shipment;
const s = messages.oqcInspection.shipment;

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
  const [savedSeq, setSavedSeq] = useState<number | null>(null);

  /* 의뢰가 바뀌거나 결과가 늘면 새 결과를 빈 판정 · 미검사 LOT 체크로 다시 연다. */
  const resetKey =
    request === undefined
      ? null
      : `${String(request.inspectionRequestId)}#${String(results.length)}`;
  useEffect(() => {
    if (resetKey === null || views === null) return;
    setMatched(defaultMatchOf(views.active));
    setJudgment(null);
    setReason(null);
    setSerialRows([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);
  useEffect(() => setSavedSeq(null), [inspectionRequestId]);
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
    () => setSavedSeq(seqNo),
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
const Summary = ({
  request,
  refData,
  uom,
  wide,
}: {
  request: InspectionRequestResponse;
  refData: ShipmentRequestRef | undefined;
  uom: string;
  /** 결과 입력 칸이 없어 상세가 한 단일 때 — 한 줄에 넷씩. */
  wide: boolean;
}) => {
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
      label: bandLabel('box', pop.detail.fields.item),
      value: itemText(request, refData),
      wide: true,
    },
    {
      label: bandLabel('file', ps.refs.request),
      value: <span className="pu-mono">{request.inspectionRequestNo}</span>,
    },
    { label: bandLabel('list', ps.refs.customer), value: refData?.customerName ?? '—' },
    { label: bandLabel('list', ps.refs.shipTo), value: refData?.shipToName ?? '—' },
    {
      label: bandLabel('file', ps.refs.plan),
      value:
        request.inspectionPlanVersionId == null
          ? pop.detail.noPlanVersion
          : pop.detail.planValue(pop.detail.idValue(request.inspectionPlanVersionId)),
    },
    { label: bandLabel('clock', ps.refs.requestedAt), value: formatDateTime(request.requestedAt) },
    { label: bandLabel('check', ps.target), value: qty(refData?.targetQty) },
    { label: bandLabel('check', ps.picked), value: qty(refData?.pickedQty) },
    ...(refData !== undefined && refData.overQty > 0
      ? [{ label: bandLabel('check', ps.over), value: qty(refData.overQty) }]
      : []),
  ];

  return (
    <section className="pop-oqc-summary" aria-label={request.inspectionRequestNo}>
      <div className={wide ? 'oqc-band pu-band-stack is-wide' : 'oqc-band pu-band-stack'}>
        <PuBand grid={wide ? 4 : 3} items={items} label={ps.bandLabel} />
      </div>
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
}: {
  result: InspectionResultSummaryForward;
  lotNoOf: (lotId: number) => string;
  replacedIds: readonly number[];
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
  const judgmentHintId = useId();
  /* 시리얼 기록은 옛 흐름과 같은 창으로 적는다(#295 — 요약 줄 + [시리얼 검사 기록] 창). */
  const [serialOpen, setSerialOpen] = useState(false);
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
  const writable = OPEN_STATUSES.includes(request.statusCode) && views.active.length > 0;
  const ruleCode = ruleCodeOf(form.save.error);

  return (
    <div className="pop-oqc-shipment">
      <div className="pop-oqc-shipment__col">
        <Summary request={request} refData={refData} uom={uom} wide={!writable} />
        {/* 긴 안내 문단은 두지 않는다(POP 통일 · 사용자 지시 2026-11-20) — OQC 생략으로 닫힌 의뢰만 그 사실을 알린다. */}
        {skipped && (
          <p className="field-note pop-oqc-shipment-note">
            <Icon name="fast_forward" size={20} aria-hidden />
            <span>{`${s.skipped} ${s.skippedMore}`}</span>
          </p>
        )}

        <section className="pop-oqc-shipment-box" aria-label={s.lots.heading(views.active.length)}>
          <div className="pop-oqc-shipment-box__head">
            <h2>{s.lots.title}</h2>
            {/* 건수는 빨간 원 숫자만(출하 완료와 같다) — 화면 탭 건수처럼 0 이면 두지 않는다. */}
            {views.active.length > 0 && <PuCount tone="primary">{views.active.length}</PuCount>}
            {/* LOT 이 없으면 요약 칩·합계를 두지 않는다 — 아래 빈 줄이 같은 말을 한다(중복 표시 제거). */}
            {views.active.length > 0 && (
              <>
                <span className="pop-oqc-shipment-gap" />
                <OverviewChip overview={overview} size="md" />
                <span className="pop-oqc-shipment-muted">
                  {s.lots.total(withUom(formatQty(pickedTotal), uom || null))}
                </span>
              </>
            )}
          </div>
          {views.active.length === 0 && views.replaced.length === 0 ? (
            <p className="pop-oqc-empty-row">{ps.lotsEmpty}</p>
          ) : (
            <ul className="pop-oqc-shipment-lots">
              {views.active.map((view) => (
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
        </section>

        <section
          className="pop-oqc-shipment-box"
          aria-label={s.results.heading(form.results.length)}
        >
          <div className="pop-oqc-shipment-box__head">
            <h2>{s.results.title}</h2>
            <span className="pop-oqc-shipment-muted">{s.results.count(form.results.length)}</span>
          </div>
          {form.results.length === 0 ? (
            <p className="field-note">{s.results.empty}</p>
          ) : (
            <ul className="pop-oqc-shipment-results">
              {[...form.results]
                .sort((a, b) => a.seqNo - b.seqNo)
                .map((result) => (
                  <ResultLine
                    key={result.inspectionResultId}
                    result={result}
                    lotNoOf={lotNoOf}
                    replacedIds={replacedIds}
                  />
                ))}
            </ul>
          )}
        </section>
      </div>

      {writable ? (
        <div className="pop-oqc-shipment__col pop-oqc-shipment-form">
          <h2 className="pop-oqc-shipment-form__title">{ps.form.heading(form.seqNo)}</h2>
          <p className="pop-oqc-shipment-muted">{ps.form.matchHint}</p>
          <LotMatchField
            lots={views.active.map((view) => view.lot)}
            otherResults={form.results}
            uomCode={uom}
            value={form.matched}
            disabled={form.save.isSaving}
            error={
              ruleCode === 'MATCHED_LOT_REQUIRED' ? s.drawer.ruleErrors.MATCHED_LOT_REQUIRED : null
            }
            onChange={form.setMatched}
            text={s.drawer}
            renderExtra={(lot) => {
              const view = views.active.find((each) => each.lot.lotId === lot.lotId);
              return view === undefined ? null : <LotJudgmentChip code={view.judgmentCode} />;
            }}
          />
          <section className="pop-oqc-step" aria-label={s.drawer.judgmentHeading}>
            <p className="pop-oqc-step__title">
              {s.drawer.judgmentHeading}{' '}
              <span className="required-mark" aria-hidden="true">
                *
              </span>
            </p>
            <p id={judgmentHintId} className="pop-oqc-step__hint">
              {ps.form.judgmentHint}
            </p>
            <div
              className="pop-oqc-shipment-judgments"
              role="group"
              aria-label={s.drawer.judgmentHeading}
            >
              {SHIPMENT_JUDGMENTS.map((code) => (
                <Button
                  key={code}
                  type="button"
                  size="xl"
                  variant={form.judgment === code ? 'filled' : 'outlined'}
                  aria-pressed={form.judgment === code}
                  disabled={form.save.isSaving}
                  aria-describedby={judgmentHintId}
                  onClick={() => form.setJudgment(code)}
                >
                  {s.judgments[code]}
                </Button>
              ))}
            </div>
          </section>
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
          {/* 검사 항목 측정 — 지금 검사 기준대로(FR-009 · 시안 P0406-After 메모 E 「지금처럼」). */}
          <ShipmentMeasurementSection form={form.measurements} locked={form.save.isSaving} />
          <PopSerialSummary
            rows={form.serialRows}
            disabled={form.save.isSaving}
            onOpen={() => {
              setSerialOpen(true);
            }}
          />
          {serialOpen && (
            <PopSerialDialog
              inspectionRequestId={request.inspectionRequestId}
              itemId={request.itemId}
              rows={form.serialRows}
              onChange={form.setSerialRows}
              disabled={form.save.isSaving}
              onClose={() => {
                setSerialOpen(false);
              }}
            />
          )}
        </div>
      ) : null}
    </div>
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

  /* #295 — 공통 작업 줄(`PuActionBar`)에 선다: 왼쪽 띠 글, 오른쪽 [결과 저장]. */
  return (
    <PuActionBar
      lead={
        <div id={noteId} className="pop-action-note" aria-live="polite">
          {note}
        </div>
      }
    >
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
