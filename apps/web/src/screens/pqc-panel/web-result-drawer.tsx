import { Button, DatePicker, Dialog, Icon, IconButton, TextField } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { InfoTip } from '../../patterns/info-tip';
import { SaveErrorBanner } from '../../patterns/master';
import {
  formatPlantDateTime,
  plantNowLocal,
  PLANT_UTC_OFFSET,
  toPlantDateTimeParts,
} from '../../patterns/plant-time';
import { useSession } from '../../patterns/session';
import { TimeField, type TimeFieldLabels } from '../../patterns/time-field';
import { PlanViewLauncher } from '../iqc-inspection/plan-view-launcher';
import { historyReducer, startHistory, type FormHistory } from '../parts-iqc-inspection/form-state';
import type { CodeOption } from '../pqc-inspection/code-options';
import { toConfirmBlockedReason } from '../pqc-inspection/confirm-gate';
import { EMPTY_COVERAGE_DRAFT } from '../pqc-inspection/coverage';
import { settleDisposition, type DispositionState } from '../pqc-inspection/disposition';
import {
  EMPTY_MEASUREMENT_DRAFT,
  hasValueError,
  isAllJudged,
  toMeasurementDrafts,
  toMeasurementInputs,
  withJudgment,
  withMeasuredValue,
  type MeasurementDrafts,
} from '../pqc-inspection/measurement-draft';
import type { MeasurementRow } from '../pqc-inspection/measurement-rows';
import { RESULT_STATUS, toResultBody, type PlanVersionView } from '../pqc-inspection/queries';
import {
  EMPTY_QUANTITY_DRAFT,
  hasQuantityError,
  toMicro,
  toSendableNumber,
  toTotals,
  validateQuantities,
  type QuantityDraft,
} from '../pqc-inspection/quantity-draft';
import type { InspectionRequestDetail } from '../pqc-inspection/types';
import { useItem } from '../production-result/flow-queries';
import { useWorkOrder } from '../production-result/queries';
import type { InspectionResultResponse } from './queries';
import { PqcWebSteps } from './web-steps';

type InspectionResultCreate = components['schemas']['InspectionResultCreate'];

const t = messages.pqcInspectionRegister.web;
const tPqc = messages.pqcInspection;
const tIqc = messages.partsIqcInspection;
const td = messages.iqcInboundLot.drawer;
const empty = tPqc.emptyValue;

/** 닫힘 움직임 길이 — CSS `.iqc-inbound-drawer.is-closing` 과 같은 값(IQC 결과 창과 같다). */
const CLOSE_MS = 240;

const TIME_LABELS: TimeFieldLabels = {
  field: tIqc.lot.inspectedTime,
  hourList: tIqc.lot.inspectedHour,
  minuteList: tIqc.lot.inspectedMinute,
  hourHead: tIqc.lot.hourHead,
  minuteHead: tIqc.lot.minuteHead,
  placeholder: tIqc.lot.timePlaceholder,
};

/** 창이 적는 값 전부 — 되돌리기 · 다시 실행이 이 묶음 단위로 오간다. */
interface DrawerForm {
  /** 공장 시각 「YYYY-MM-DDTHH:mm」 — 비우면 `''`. */
  inspectedAt: string;
  draft: QuantityDraft;
  drafts: MeasurementDrafts;
  judgment: string;
  disposition: DispositionState;
  remarks: string;
}

const toOffset = (local: string): string => `${local}:00${PLANT_UTC_OFFSET}`;

/** 새 결과 — 합격 수량에 총 검사 수량을 넣어 둔다(관리웹 새 회차 규칙 그대로 · 사용자 지시 2026-11-09). */
const newDraftOf = (targetQty: number): QuantityDraft =>
  targetQty > 0 ? { ...EMPTY_QUANTITY_DRAFT, accepted: String(targetQty) } : EMPTY_QUANTITY_DRAFT;

const blankRowsOf = (rows: readonly MeasurementRow[]): MeasurementRow[] =>
  rows.map((row) => ({ ...row, measured: null }));

export interface PqcWebResultDrawerProps {
  target: InspectionRequestDetail;
  planVersion: PlanVersionView | null;
  /** 고칠 작성중 결과 — 새로 더하면 `null`. */
  editing: InspectionResultResponse | null;
  /** 제목의 회차 — 고칠 때는 그 결과의 회차, 더할 때는 다음 회차. */
  round: number;
  /** 검사 항목 줄 — 고칠 때는 저장된 측정치가 들어 있다. */
  rows: MeasurementRow[];
  itemsLoading: boolean;
  itemJudgmentOptions: CodeOption[];
  judgmentOptions: CodeOption[];
  uomCodeOf: (uomId: number | null) => string | null;
  /** 보내는 중 — 단추를 잠근다. */
  isSending: boolean;
  /** 서버가 돌려준 저장 거부(작성중 저장만). */
  fieldErrors: Record<string, string>;
  saveError: Parameters<typeof SaveErrorBanner>[0]['error'];
  onSubmit: (body: InspectionResultCreate) => void;
  onDirtyChange: (dirty: boolean) => void;
  onClose: () => void;
}

/**
 * W-03-11 관리웹 결과 추가 · 수정 창(omf-all-around#356) — IQC 결과 창(`parts-iqc-inspection/result-drawer.tsx`)과 같은 짜임:
 * 오른쪽 창 · X 없음 · 닫을 때 오른쪽으로 밀려 나감 · 적던 것이 있으면 한 번 묻는다. 위 요약 줄 → 검사 정보(검사일시 · 수량) →
 * 검사 항목 → 종합 판정, 아래 줄 [되돌리기][다시 실행] … [비우기][취소][제출].
 *
 * ⭐ [제출]은 지금까지의 [임시 저장]과 같은 본문(작성중 · `POST` — 서버가 작성중 1회차를 덮는다 · 장부 P-49)을 보낸다. 필수 칸
 *    (검사일시 · 수량 · 항목별 판정 · 종합 판정)이 다 차야 눌린다 — 판정 확정과 같은 조건이다(omf-all-around#356).
 */
export const PqcWebResultDrawer = ({
  target,
  planVersion,
  editing,
  round,
  rows,
  itemsLoading,
  itemJudgmentOptions,
  judgmentOptions,
  uomCodeOf,
  isSending,
  fieldErrors,
  saveError,
  onSubmit,
  onDirtyChange,
  onClose,
}: PqcWebResultDrawerProps) => {
  const { session } = useSession();
  const item = useItem(target.itemId);
  const workOrder = useWorkOrder(target.workOrderId);
  const inspectedAtId = useId();
  const remarksId = useId();

  /* 처음 값 — 고칠 때는 저장된 회차, 더할 때는 빈 칸(합격 수량만 총 검사 수량). 창이 열릴 때 한 번 정한다. */
  const [initial] = useState<DrawerForm>(() => {
    if (editing === null) {
      return {
        inspectedAt: plantNowLocal(),
        draft: newDraftOf(target.targetQty),
        drafts: toMeasurementDrafts(rows),
        judgment: '',
        disposition: null,
        remarks: '',
      };
    }
    const saved = toPlantDateTimeParts(editing.inspectedAt);
    const rejected = String(editing.rejectedQty);
    return {
      inspectedAt: saved === null ? plantNowLocal() : `${saved.date}T${saved.time}`,
      draft: { accepted: String(editing.acceptedQty), rejected, held: String(editing.heldQty) },
      drafts: toMeasurementDrafts(rows),
      judgment: editing.overallJudgmentCode ?? '',
      disposition: settleDisposition(null, toMicro(rejected)),
      remarks: editing.remarks ?? '',
    };
  });
  /* 검사 수량은 입력받지 않는다 — 고칠 때는 그 회차의 값, 더할 때는 의뢰 수량(종전 그대로 · #197). */
  const inspectedQty = editing === null ? target.targetQty : editing.inspectedQty;

  /* 되돌리기 · 다시 실행은 IQC 결과 창과 같은 칸 쌓기(`historyReducer`)다 — 여기서는 한 입력 묶음만 더한다. */
  const [history, setHistory] = useState<FormHistory<DrawerForm>>(() => startHistory(initial));
  const form = history.present;
  /*
   * 한 번의 입력이 여러 값을 바꾸면(수량 → 자동 판정) 되돌리기 한 칸으로 묶는다. 묶음 표시는 갱신 함수 «밖»에서 정한다 —
   * StrictMode 가 갱신 함수를 두 번 불러도 결과가 같아야 한다.
   */
  const batching = useRef(false);
  const change = (update: (current: DrawerForm) => DrawerForm): void => {
    const coalesce = batching.current;
    if (!coalesce) {
      batching.current = true;
      queueMicrotask(() => {
        batching.current = false;
      });
    }
    setHistory((current) => {
      const next = update(current.present);
      if (!coalesce) return historyReducer(current, { type: 'change', next });
      return next === current.present ? current : { ...current, present: next };
    });
  };
  const undo = (): void => setHistory((current) => historyReducer(current, { type: 'undo' }));
  const redo = (): void => setHistory((current) => historyReducer(current, { type: 'redo' }));

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  /* 닫을 때 오른쪽으로 밀려 나간다 — IQC 결과 창과 같다(움직임을 줄인 환경은 곧바로 닫힌다). */
  const [closing, setClosing] = useState(false);
  const [asking, setAsking] = useState(false);
  const closeTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    },
    [],
  );
  const closeAnimated = (): void => {
    if (closing) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduced) {
      onClose();
      return;
    }
    setClosing(true);
    closeTimer.current = window.setTimeout(onClose, CLOSE_MS);
  };
  const requestClose = (): void => {
    if (isSending) return;
    if (dirty) setAsking(true);
    else closeAnimated();
  };

  const findRow = (key: string): MeasurementRow | undefined =>
    rows.find((candidate) => candidate.key === key);
  const changeValue = (key: string, value: string): void =>
    change((current) => ({
      ...current,
      drafts: {
        ...current.drafts,
        [key]: withMeasuredValue(
          findRow(key),
          current.drafts[key] ?? EMPTY_MEASUREMENT_DRAFT,
          value,
        ),
      },
    }));
  const changeItemJudgment = (key: string, next: string): void =>
    change((current) => ({
      ...current,
      drafts: {
        ...current.drafts,
        [key]: withJudgment(findRow(key), current.drafts[key] ?? EMPTY_MEASUREMENT_DRAFT, next),
      },
    }));
  const changeDraft = (next: QuantityDraft): void =>
    change((current) => ({
      ...current,
      draft: next,
      disposition: settleDisposition(current.disposition, toMicro(next.rejected)),
    }));

  const [inspectedDate = '', inspectedTimeRaw = ''] = form.inspectedAt.split('T');
  const inspectedTime = inspectedTimeRaw.slice(0, 5);
  const changeInspectedAt = (date: string, time: string): void =>
    change((current) => ({
      ...current,
      inspectedAt: date === '' ? '' : `${date}T${time === '' ? '00:00' : time}`,
    }));

  /* 비우기 — 적은 값 · 판정을 처음으로. 검사일시 · 기본 합격 수량은 남긴다(IQC 와 같다). */
  const clearForm = (): void =>
    change((current) => ({
      inspectedAt: current.inspectedAt,
      draft: newDraftOf(inspectedQty),
      drafts: toMeasurementDrafts(blankRowsOf(rows)),
      judgment: '',
      disposition: null,
      remarks: '',
    }));

  /* [제출] 잠금 — 종전 [임시 저장]과 같은 조건(확정 조건 · 수량 · 값 오류)에 검사일시를 더했다. */
  const blockedReason = toConfirmBlockedReason({
    isConfirmed: false,
    canInputInspection: true,
    totals: toTotals(form.draft, inspectedQty),
    judgment: form.judgment,
    isAllJudged: isAllJudged(rows, form.drafts),
  });
  const submitBlocked =
    isSending ||
    form.inspectedAt === '' ||
    blockedReason !== null ||
    hasQuantityError(validateQuantities(form.draft)) ||
    hasValueError(rows, form.drafts);

  const submit = (): void => {
    if (submitBlocked) return;
    const inspectedAt = toOffset(form.inspectedAt);
    onSubmit(
      toResultBody({
        inspectionRequestId: target.inspectionRequestId,
        inspectedQty: toSendableNumber(String(inspectedQty)),
        acceptedQty: toSendableNumber(form.draft.accepted),
        rejectedQty: toSendableNumber(form.draft.rejected),
        heldQty: toSendableNumber(form.draft.held),
        uomId: target.uomId,
        overallJudgmentCode: form.judgment,
        inspectedAt,
        remarks: form.remarks,
        statusCode: RESULT_STATUS.draft,
        coverage: EMPTY_COVERAGE_DRAFT,
        measurements: toMeasurementInputs(rows, form.drafts, inspectedAt),
      }),
    );
  };

  const title = editing === null ? td.addTitle(round) : td.editTitle(round);
  const uomCode = uomCodeOf(target.uomId);
  const planVersionId = target.inspectionPlanVersionId;
  const itemName = item.data?.itemName;
  const itemCode = item.data?.itemCode ?? workOrder.data?.itemCode;
  const condition =
    planVersion === null
      ? null
      : planVersion.samplingRatio !== null
        ? tPqc.detail.sample(planVersion.samplingRatio)
        : planVersion.samplingQty !== null
          ? tPqc.detail.sampleQty(planVersion.samplingQty)
          : null;
  const targetQty =
    uomCode === null ? String(target.targetQty) : `${String(target.targetQty)} ${uomCode}`;

  const facts: { key: string; label: string; value: ReactNode }[] = [
    /* 품목은 품목코드 · 품목명 두 칸(품목 표기 분리 · #358). */
    {
      key: 'itemCode',
      label: t.summary.itemCode,
      value: <span className="parts-iqc-fact-key">{itemCode ?? empty}</span>,
    },
    { key: 'itemName', label: t.summary.itemName, value: itemName ?? empty },
    {
      key: 'plan',
      label: tIqc.target.plan,
      value: (
        <span className="parts-iqc-plan-cell">
          {planVersionId === null
            ? t.summary.noPlan
            : planVersion === null
              ? empty
              : `${planVersion.planCode} · ${messages.iqcInspection.detail.planVersion(planVersion.planVersion)}`}
          {/* 검사 기준 조회 — IQC 결과 창의 [기준 조회]와 같은 창(#353). 기준이 없으면 열 것이 없다. */}
          {planVersionId !== null && (
            <PlanViewLauncher
              size="sm"
              inspectionPlanVersionId={planVersionId}
              label={messages.iqcInspection.detail.openPlan}
            />
          )}
        </span>
      ),
    },
    ...(condition === null
      ? []
      : [{ key: 'condition', label: tIqc.target.condition, value: condition }]),
    { key: 'inspector', label: tIqc.target.inspector, value: session?.worker?.workerName ?? '-' },
  ];

  return (
    <>
      <Dialog
        open
        placement="right"
        size="lg"
        className={closing ? 'iqc-inbound-drawer is-closing' : 'iqc-inbound-drawer'}
        closeOnBackdropClick={false}
        /* 제목 줄 · X 없이(IQC 결과 창과 같다) — 닫기는 아래 [취소] · Esc. 이름은 화면 읽기용으로만. */
        showCloseButton={false}
        aria-label={title}
        onClose={requestClose}
      >
        <div className="parts-iqc-form pqc-web-drawer">
          <dl className="parts-iqc-facts">
            {facts.map((fact) => (
              <div className="parts-iqc-fact" key={fact.key}>
                <dt className="field-label">{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>

          {/* 창 본문 — 아래 단추 줄과의 여백을 이 묶음이 쥔다(단추 줄은 창 맨 아래로 내려간다). */}
          <div className="pqc-web-drawer-body">
            <PqcWebSteps
              rows={rows}
              drafts={form.drafts}
              onValueChange={changeValue}
              onItemJudgmentChange={changeItemJudgment}
              itemJudgmentOptions={itemJudgmentOptions}
              uomCodeOf={uomCodeOf}
              itemsLoading={itemsLoading}
              inspectionPlanVersionId={planVersionId}
              inspectedQty={inspectedQty}
              inspectionRound={null}
              uomCode={uomCode}
              draft={form.draft}
              onChange={changeDraft}
              fieldErrors={fieldErrors}
              showErrors
              judgmentOptions={judgmentOptions}
              judgment={form.judgment}
              onJudgmentChange={(code) => change((current) => ({ ...current, judgment: code }))}
              disposition={form.disposition}
              onDispositionChange={(choice) =>
                change((current) => ({ ...current, disposition: choice }))
              }
              isLocked={false}
              infoTop={
                <>
                  <h4>{t.drawer.infoBox}</h4>
                  {/* 받은 값 — 작업지시 · 의뢰 · 총 검사량 · 의뢰 일시(IQC 의 LOT 정보 자리). */}
                  <dl className="parts-iqc-kv">
                    <div>
                      <dt>{t.summary.workOrder}</dt>
                      <dd>{workOrder.data?.workOrderNo ?? empty}</dd>
                    </div>
                    <div>
                      <dt>{t.summary.inspectionRequestNo}</dt>
                      <dd>{target.inspectionRequestNo}</dd>
                    </div>
                    <div>
                      <dt>{t.summary.targetQty}</dt>
                      <dd>{targetQty}</dd>
                    </div>
                    <div>
                      <dt>{t.summary.requestedAt}</dt>
                      <dd>{formatPlantDateTime(target.requestedAt) ?? target.requestedAt}</dd>
                    </div>
                  </dl>
                </>
              }
              inspectedAtField={
                <div className="field-cell date-time-field">
                  <label className="field-label" htmlFor={inspectedAtId}>
                    {tIqc.lot.inspectedAt}
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
                      onChange={(hour, minute) =>
                        changeInspectedAt(inspectedDate, `${hour}:${minute}`)
                      }
                    />
                  </div>
                </div>
              }
              judgmentBelow={
                planVersionId === null ? (
                  /* 검사기준이 없을 때만 「검사 내용」 칸 — 종전 그대로(#135). */
                  <div className="field-cell pqc-web-remarks-field">
                    <span className="field-label">
                      <label htmlFor={remarksId}>{tPqc.noStandard.remarks}</label>
                      {/* 검사기준이 없다는 안내는 이름 옆 ⓘ 로(omf-all-around#360). */}
                      <InfoTip text={t.noStandardNote} />
                    </span>
                    <TextField
                      id={remarksId}
                      fullWidth
                      placeholder={t.remarksPlaceholder}
                      value={form.remarks}
                      onChange={(event) => {
                        const remarks = event.target.value;
                        change((current) => ({ ...current, remarks }));
                      }}
                    />
                  </div>
                ) : undefined
              }
            />

            <SaveErrorBanner error={saveError} />
          </div>

          {/* 아래 줄 — 왼쪽 되돌리기 · 다시 실행, 오른쪽 비우기 · 취소 · 제출(IQC 결과 창과 같다). */}
          <div className="parts-iqc-footer parts-iqc-drawer-footer">
            <Button
              variant="text"
              leadingIcon={<Icon name="undo" />}
              disabled={history.past.length === 0 || isSending}
              onClick={undo}
            >
              {tIqc.footer.undo}
            </Button>
            <IconButton
              className="parts-iqc-redo"
              aria-label={tIqc.footer.redo}
              icon="redo"
              disabled={history.future.length === 0 || isSending}
              onClick={redo}
            />
            <span className="parts-iqc-footer-gap" />
            <Button variant="text" disabled={isSending} onClick={clearForm}>
              {tIqc.footer.clear}
            </Button>
            {/* 창에 X 가 없어 닫는 단추는 여기 하나. */}
            <Button variant="outlined" disabled={isSending} onClick={requestClose}>
              {td.cancel}
            </Button>
            <Button
              variant="filled"
              className="parts-iqc-submit"
              loading={isSending}
              disabled={submitBlocked}
              title={blockedReason ?? undefined}
              onClick={submit}
            >
              {td.save}
            </Button>
          </div>
        </div>
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
                {td.discardStay}
              </Button>
              <Button
                onClick={() => {
                  setAsking(false);
                  closeAnimated();
                }}
              >
                {td.discardLeave}
              </Button>
            </>
          }
        >
          <p className="dialog-text">{td.discardBody}</p>
        </Dialog>
      )}
    </>
  );
};
