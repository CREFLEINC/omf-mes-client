import { Button, Chip, EmptyState, Icon } from '@crefle/web-ui';
import type { InspectionResultSummaryForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { formatQty } from '../../patterns/package-qty';
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
import { SHIPMENT_JUDGMENTS } from '../oqc-inspection/shipment-result-drawer';
import type { InspectionRequestResponse } from '../oqc-inspection/types';
import { formatDateTime } from '../oqc-inspection/types';
import { PopSerialStep } from './serial-step';

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
    return null;
  })();

  const submit = () => {
    if (blockedReason !== null || request === undefined || judgment === null) return;
    setSavedSeq(null);
    save.write({
      inspectionRequestId: request.inspectionRequestId,
      uomId: request.uomId,
      judgmentCode: judgment,
      matchedLotIds: matched,
      reinspectionReasonCode: needsReason ? reason : null,
      inspectedAt: new Date().toISOString(),
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
    overridden,
    needsReason,
    blockedReason,
    savedSeq,
    save,
    submit,
  };
};

export type PopShipmentForm = ReturnType<typeof usePopShipmentForm>;

const Summary = ({
  request,
  refData,
  uom,
}: {
  request: InspectionRequestResponse;
  refData: ShipmentRequestRef | undefined;
  uom: string;
}) => {
  const refs = [
    { key: 'req', label: ps.refs.request, value: request.inspectionRequestNo },
    { key: 'cust', label: ps.refs.customer, value: refData?.customerName ?? '—' },
    { key: 'dest', label: ps.refs.shipTo, value: refData?.shipToName ?? '—' },
    {
      key: 'plan',
      label: ps.refs.plan,
      value:
        request.inspectionPlanVersionId == null
          ? pop.detail.noPlanVersion
          : pop.detail.planValue(request.inspectionPlanVersionId),
    },
    { key: 'at', label: ps.refs.requestedAt, value: formatDateTime(request.requestedAt) },
  ];

  return (
    <section className="pop-oqc-summary" aria-label={request.inspectionRequestNo}>
      <div className="pop-oqc-summary__key">
        <p className="pop-oqc-summary__no">
          {request.shipmentRequestNo ?? refData?.shipmentRequestNo ?? '—'}
        </p>
        <dl className="pop-oqc-summary__figures">
          <div>
            <dt>{pop.detail.fields.item}</dt>
            <dd>{pop.detail.idValue(request.itemId)}</dd>
          </div>
          <div>
            <dt>{ps.target}</dt>
            <dd className="pop-oqc-num">
              {refData === undefined ? '—' : `${formatQty(refData.targetQty)} ${uom}`.trim()}
            </dd>
          </div>
          <div>
            <dt>{ps.picked}</dt>
            <dd className="pop-oqc-num">
              {refData === undefined ? '—' : `${formatQty(refData.pickedQty)} ${uom}`.trim()}
              {refData !== undefined && refData.overQty > 0 ? (
                <Chip size="sm" status="info">
                  {s.over(formatQty(refData.overQty))}
                </Chip>
              ) : null}
            </dd>
          </div>
        </dl>
      </div>
      <dl className="pop-oqc-summary__ref">
        {refs.map((item) => (
          <div key={item.key}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
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
  const portions = portionsText(refData?.lotOf(view.lot.lotId) ?? null);

  return (
    <li className="pop-oqc-shipment-lot">
      <span className="pop-oqc-shipment-lot__no">
        <strong>{view.lot.lotNo}</strong>{' '}
        <span>{`${formatQty(view.lot.lotQty)} ${uom}`.trim()}</span>
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
  if (request === undefined || views === null) {
    return <p className="field-note">{pop.detail.loading}</p>;
  }

  const uom = uomCode ?? '';
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
        <Summary request={request} refData={refData} uom={uom} />
        <p className="field-note pop-oqc-shipment-note">
          <Icon name={skipped ? 'fast_forward' : 'info'} size={20} aria-hidden />
          <span>{skipped ? `${s.skipped} ${s.skippedMore}` : s.note}</span>
        </p>

        <section className="pop-oqc-shipment-box" aria-label={s.lots.heading(views.active.length)}>
          <div className="pop-oqc-shipment-box__head">
            <h2>{s.lots.title}</h2>
            <span className="pop-oqc-shipment-muted">{s.lots.count(views.active.length)}</span>
            <span className="pop-oqc-shipment-gap" />
            <OverviewChip overview={overview} size="md" />
            <span className="pop-oqc-shipment-muted">
              {s.lots.total(`${formatQty(pickedTotal)} ${uom}`.trim())}
            </span>
          </div>
          {views.active.length === 0 && views.replaced.length === 0 ? (
            <EmptyState
              size="sm"
              icon={<Icon name="inventory_2" size={24} />}
              title={s.lots.emptyTitle}
              description={s.lots.emptyDescription}
            />
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
                      <s>{lot.lotNo}</s> <span>{`${formatQty(lot.lotQty)} ${uom}`.trim()}</span>
                    </span>
                    <Chip size="md">{s.lots.replaced}</Chip>
                    <span className="pop-oqc-shipment-muted">
                      {replacedText(refData?.lotOf(lot.lotId) ?? null)}
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
            <p className="pop-oqc-step__hint">{ps.form.judgmentHint}</p>
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
          <PopSerialStep
            inspectionRequestId={request.inspectionRequestId}
            itemId={request.itemId}
            rows={form.serialRows}
            onChange={form.setSerialRows}
            disabled={form.save.isSaving}
          />
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

  return (
    <div className="pop-action-bar">
      <div className="pop-action-note" aria-live="polite">
        {note}
      </div>
      <Button type="button" size="2xl" variant="filled" disabled={!canSave} onClick={form.submit}>
        {save.isSaving ? ps.bar.saving : ps.bar.save}
      </Button>
    </div>
  );
};
