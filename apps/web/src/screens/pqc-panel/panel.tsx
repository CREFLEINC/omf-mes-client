import { AlertBanner, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import { CODE_GROUPS, toCodeOptions } from '../pqc-inspection/code-options';
import { toConfirmBlockedReason } from '../pqc-inspection/confirm-gate';
import { EMPTY_COVERAGE_DRAFT } from '../pqc-inspection/coverage';
import { settleDisposition, type DispositionState } from '../pqc-inspection/disposition';
import { FreeInputPanel } from '../pqc-inspection/free-input-panel';
import { ItemPanel } from '../pqc-inspection/item-panel';
import { KeypadPanel } from '../pqc-inspection/keypad-panel';
import { QueueLoadErrorBanner } from '../pqc-inspection/load-error-banner';
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
import { toMeasurementRows } from '../pqc-inspection/measurement-rows';
import type { Outbox } from '../pqc-inspection/outbox';
import {
  RESULT_STATUS,
  pqcInspectionKeys,
  toResultBody,
  useCodeValues,
  useInspectionItemSpecs,
  useInspectionPlanVersion,
  useInspectionRequestDetail,
  useUoms,
} from '../pqc-inspection/queries';
import {
  EMPTY_QUANTITY_DRAFT,
  hasQuantityError,
  toMicro,
  toSendableNumber,
  toTotals,
  validateQuantities,
  type QuantityDraft,
} from '../pqc-inspection/quantity-draft';
import { useWorkOrder } from '../production-result/queries';
import { PanelActions } from './panel-actions';
import { pqcPanelKeys, useLatestRound, useRoundMeasurements } from './queries';
import { ResultForm } from './result-form';
import { SplitResultForm } from './split-result-form';
import { PanelTargetHeader } from './target-header';
import { WebActions } from './web-actions';
import { WebItemTable } from './web-item-table';
import { WebSummary } from './web-summary';

const t = messages.pqcInspection;

const REQUEST_COMPLETED = 'COMPLETED';
const EMPTY_FIELD_ERRORS: Record<string, string> = {};

/**
 * 결과를 내보내는 자리. POP 은 오프라인 큐(`useOutbox`), 관리웹은 바로 저장(`useDirectSubmitter`)이다 —
 * 패널은 어느 쪽인지 모른다.
 */
export type PqcSubmitter = Pick<
  Outbox,
  | 'enqueue'
  | 'rejection'
  | 'rejectedStatusCode'
  | 'clearRejection'
  | 'hasPendingConfirm'
  | 'sentCount'
>;

type PadField =
  | { key: keyof QuantityDraft | 'inspected'; label: string }
  | { key: 'measurement'; rowKey: string; label: string };

export interface PqcPanelProps {
  inspectionRequestId: number;
  submitter: PqcSubmitter;
  /**
   * 결과에 귀속할 사번. ⭐ POP 은 필수라 `null` 이면 저장을 막는다. 관리웹은 계정 세션이 주체라
   * `requiresWorker=false` 로 두고 빈 값을 넘긴다.
   */
  workerNo: string | null;
  requiresWorker: boolean;
  /** 화면 키패드를 둘 것인가. POP 키오스크는 운영체제 키보드가 없어 필수다. */
  withKeypad: boolean;
  /**
   * 배치. `split` 은 POP 생산 실적 분할 화면(#107 UI/UX — 수량 넷 한 줄 · 잠긴 이유를 맨 위에), `web` 은 관리웹
   * W-03-11 이다(웹 UI/UX 는 하지 않기로 했다 · 사용자 결정 2026-10-19). 판정·저장 규칙은 같다.
   */
  variant: 'split' | 'web';
  /**
   * 저장하지 않은 입력이 있는가를 알린다(관리웹 · omf-all-around#135) — 목록으로 떠날 때 한 번 묻는 데 쓴다.
   * 입력을 고치면 참, 서버가 저장·확정을 받았으면 거짓이다.
   */
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * PQC 제품 검사 1단 패널 — POP 생산 실적 분할 화면(P-02-04)과 관리웹 W-03-11 이 함께 쓴다
 * (omf-all-around#107).
 *
 * ⭐ 판정·저장 규칙은 POP 단독 화면 `pqc-inspection/screen.tsx`(P-02-13)와 **같다** — 그 화면은
 * 건드리지 않기로 해(사용자 결정 2026-10-16) 상태 규칙을 이쪽에 옮겨 적었다. 한쪽을 고치면 다른
 * 쪽도 함께 고친다. 다른 점은 배치뿐이다: 항목 → 결과 → 단추를 한 줄로 쌓고, 키패드는 칸을
 * 눌렀을 때만 그 아래에 선다.
 */
export const PqcPanel = ({
  inspectionRequestId,
  submitter,
  workerNo,
  requiresWorker,
  withKeypad,
  variant,
  onDirtyChange,
}: PqcPanelProps) => {
  const detail = useInspectionRequestDetail(inspectionRequestId);
  const itemSpecs = useInspectionItemSpecs(detail.data?.inspectionPlanVersionId ?? null);
  /*
   * 마지막 회차를 칸에 되살린다 — 작성중이면 이어 쓰고(다음 저장도 `POST` 이고 서버가 그 회차를 덮는다 · 장부 P-49),
   * 의뢰가 끝났으면 확정 결과를 읽기 전용으로 보인다. 의뢰가 열려 있는데 마지막 회차가 확정이면(재검사 대기) 되살리지 않는다.
   */
  const latestRoundQuery = useLatestRound(inspectionRequestId);
  const latestRound = latestRoundQuery.data ?? null;
  const savedRound =
    latestRound !== null &&
    (latestRound.statusCode === RESULT_STATUS.draft ||
      detail.data?.statusCode === REQUEST_COMPLETED)
      ? latestRound
      : null;
  const savedMeasurements = useRoundMeasurements(savedRound?.inspectionResultId ?? null);
  const rows = toMeasurementRows(itemSpecs.data ?? [], savedMeasurements.data ?? []);
  /* 업무 순서는 «실적 입력 → PQC» 다(사용자 결정 2026-10-19). 실적 수는 W/O 진척(양품·불량·보류·폐기·재작업 합)으로 본다. */
  const workOrder = useWorkOrder(detail.data?.workOrderId ?? null);
  const overallOptions = toCodeOptions(useCodeValues(CODE_GROUPS.overallJudgment).data ?? []);
  const itemJudgmentOptions = toCodeOptions(
    useCodeValues(CODE_GROUPS.measurementJudgment).data ?? [],
  );
  const uoms = useUoms();
  const planVersion = useInspectionPlanVersion(detail.data?.inspectionPlanVersionId ?? null);

  const [draft, setDraft] = useState<QuantityDraft>(EMPTY_QUANTITY_DRAFT);
  const [inspectedDraft, setInspectedDraft] = useState('');
  const [drafts, setDrafts] = useState<MeasurementDrafts>({});
  const [disposition, setDisposition] = useState<DispositionState>(null);
  const [judgment, setJudgment] = useState('');
  const [padField, setPadField] = useState<PadField | null>(null);
  const [remarks, setRemarks] = useState('');
  const lastTargetId = useRef<number | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isJustConfirmed, setIsJustConfirmed] = useState(false);
  /* 저장하지 않은 입력 — 고치면 참, 서버가 받았거나 대상이 바뀌면 거짓(#135). */
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const { clearRejection, rejection, rejectedStatusCode, sentCount } = submitter;

  /*
   * 관리웹은 바로 보내므로 «서버가 받았다»를 듣고서야 저장·확정 표시를 낸다(리뷰 m5). 보내는 동안은 두 단추를 잠근다.
   * POP 오프라인 큐는 담는 순간이 성공이라(공유계약 C-1 #2) 이 기다림이 없다.
   */
  const waitsForServer = variant === 'web';
  const [awaiting, setAwaiting] = useState<string | null>(null);
  /* 서버 응답 효과가 «무엇을 보냈었나»를 읽는 자리 — 상태 갱신 함수 안에서 다른 상태를 건드리지 않으려고 둔다. */
  const awaitingRef = useRef<string | null>(null);
  const waitFor = (statusCode: string | null): void => {
    awaitingRef.current = statusCode;
    setAwaiting(statusCode);
  };

  /* 서버가 받았으면 의뢰·회차·측정치를 다시 부른다 — 확정이면 의뢰가 완료로 바뀌어 칸이 잠긴다. */
  const queryClient = useQueryClient();
  useEffect(() => {
    if (sentCount === 0) return;
    void queryClient.invalidateQueries({ queryKey: pqcInspectionKeys.detail(inspectionRequestId) });
    void queryClient.invalidateQueries({ queryKey: pqcPanelKeys.rounds(inspectionRequestId) });
    void queryClient.invalidateQueries({ queryKey: pqcPanelKeys.allMeasurements });
    setDirty(false);
    if (awaitingRef.current === RESULT_STATUS.draft) setIsSaved(true);
    if (awaitingRef.current === RESULT_STATUS.confirmed) setIsJustConfirmed(true);
    awaitingRef.current = null;
    setAwaiting(null);
  }, [sentCount, queryClient, inspectionRequestId]);

  /* 거부가 돌아오면 「담았다」 표시를 거둔다 — 확정이 거부됐으면 확정 표시도. */
  useEffect(() => {
    if (rejection === null) return;
    awaitingRef.current = null;
    setAwaiting(null);
    setIsSaved(false);
    if (rejectedStatusCode !== RESULT_STATUS.confirmed) return;
    setIsJustConfirmed(false);
  }, [rejection, rejectedStatusCode]);

  const storedInspectedQty = detail.data?.targetQty ?? 0;
  const restoredKey = useRef<string | null>(null);
  const measurementsRestoredKey = useRef<string | null>(null);

  /* 대상이 바뀌면 초안을 비운다 — 앞 의뢰의 값이 다음 의뢰로 넘어가면 되돌릴 수 없는 판정이 나간다. */
  useEffect(() => {
    setIsSaved(false);
    setIsJustConfirmed(false);
    setDirty(false);
    setShowErrors(false);
    setJudgment('');
    setDraft(EMPTY_QUANTITY_DRAFT);
    setDisposition(null);
    setPadField(null);
    clearRejection();
    if (lastTargetId.current !== inspectionRequestId) setDrafts({});
    lastTargetId.current = inspectionRequestId;
    setRemarks('');
    setInspectedDraft(String(storedInspectedQty));
    /* 초기화가 다시 돌면(재마운트 · StrictMode 재실행) 작성중 회차도 다시 되살린다 — 아래 복원이 이 표시를 본다. */
    restoredKey.current = null;
    measurementsRestoredKey.current = null;
  }, [inspectionRequestId, storedInspectedQty, clearRejection]);

  /*
   * 작성중 회차를 칸에 되살린다. ⭐ 위 초기화 «뒤»에 선다 — 의뢰 상세가 늦게 와 초기화가 다시 돌아도 저장된 값이
   * 이긴다. 같은 회차면 한 번만 — 저장 뒤 재조회(판이 오른다)가 그 사이 사람이 고친 값을 되돌리지 않는다(리뷰 m1).
   */
  const savedKey =
    savedRound === null
      ? null
      : `${String(savedRound.inspectionResultId)}:${String(storedInspectedQty)}`;
  useEffect(() => {
    if (savedRound === null || savedKey === null || restoredKey.current === savedKey) return;
    restoredKey.current = savedKey;
    const rejected = String(savedRound.rejectedQty);
    setInspectedDraft(String(savedRound.inspectedQty));
    setDraft({
      accepted: String(savedRound.acceptedQty),
      rejected,
      held: String(savedRound.heldQty),
    });
    setDisposition((current) => settleDisposition(current, toMicro(rejected)));
    setJudgment(savedRound.overallJudgmentCode ?? '');
    setRemarks(savedRound.remarks ?? '');
  }, [savedRound, savedKey]);

  /*
   * 측정치 칸도 «한 번만» 되살린다(리뷰 M1) — 항목·회차가 같으면 재조회가 사람이 친 값을 덮지 않는다. 되살릴 회차가
   * 있으면 그 측정치가 온 뒤에 채운다.
   */
  const rowKeys = rows.map((row) => row.key).join('|');
  const measurementsReady = savedRound === null || savedMeasurements.isSuccess;
  const measurementsKey = measurementsReady
    ? `${rowKeys}#${String(savedRound?.inspectionResultId ?? 'none')}`
    : null;
  useEffect(() => {
    if (measurementsKey === null || measurementsRestoredKey.current === measurementsKey) return;
    measurementsRestoredKey.current = measurementsKey;
    setDrafts(toMeasurementDrafts(rows));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measurementsKey]);

  const changeInspected = (raw: string): void => {
    setDirty(true);
    setIsSaved(false);
    setInspectedDraft(raw);
  };
  const changeDraft = (next: QuantityDraft): void => {
    setDirty(true);
    setIsSaved(false);
    setDraft(next);
    setDisposition((current) => settleDisposition(current, toMicro(next.rejected)));
  };
  const changeMeasurementValue = (key: string, value: string): void => {
    setDirty(true);
    setIsSaved(false);
    setDrafts((current) => ({
      ...current,
      [key]: withMeasuredValue(
        rows.find((candidate) => candidate.key === key),
        current[key] ?? EMPTY_MEASUREMENT_DRAFT,
        value,
      ),
    }));
  };
  const changeMeasurementJudgment = (key: string, next: string): void => {
    setDirty(true);
    setIsSaved(false);
    setDrafts((current) => ({
      ...current,
      [key]: withJudgment(
        rows.find((candidate) => candidate.key === key),
        current[key] ?? EMPTY_MEASUREMENT_DRAFT,
        next,
      ),
    }));
  };

  const inspectedQty = toMicro(inspectedDraft) === null ? 0 : Number(inspectedDraft);
  const totals = toTotals(draft, inspectedQty);
  const isConfirmed =
    detail.data?.statusCode === REQUEST_COMPLETED ||
    isJustConfirmed ||
    (!waitsForServer && submitter.hasPendingConfirm(inspectionRequestId));
  const workerMissing = requiresWorker && workerNo === null;
  const progress = workOrder.data?.progress;
  const producedQty =
    progress === undefined
      ? null
      : progress.goodQty +
        (progress.defectQty ?? 0) +
        (progress.holdQty ?? 0) +
        (progress.scrapQty ?? 0) +
        (progress.reworkQty ?? 0);
  /*
   * 저장된 회차를 다 읽기 전에는 잠근다(리뷰 M1) — 덜 읽은 칸으로 저장하면 서버가 그 회차를 덮어 저장된 값이 사라진다.
   * 실적 수는 모르면(조회 전·실패) 막지 않는다 — 서버가 같은 규칙으로 막는다.
   */
  const roundLoadFailed =
    latestRoundQuery.isError || (savedRound !== null && savedMeasurements.isError);
  const roundLoading =
    latestRoundQuery.isPending || (savedRound !== null && savedMeasurements.isPending);
  const lockedReason = isConfirmed
    ? null
    : roundLoadFailed
      ? messages.httpError
          .description /* 띄우지 않는다 — 아래 오류 띠가 이유와 [다시 시도]를 낸다 */
      : roundLoading
        ? t.panel.roundLoading
        : producedQty === 0
          ? t.result.noProductionResult
          : null;

  const confirmBlockedReason = toConfirmBlockedReason({
    isConfirmed,
    canInputInspection: true,
    totals,
    judgment,
    isAllJudged: isAllJudged(rows, drafts),
  });
  const saveBlockedReason =
    showErrors && (hasQuantityError(validateQuantities(draft)) || hasValueError(rows, drafts))
      ? t.result.saveBlockedByInvalid
      : null;

  const saveResult = (
    uomId: number,
    statusCode: (typeof RESULT_STATUS)[keyof typeof RESULT_STATUS],
  ): void => {
    if (isConfirmed || lockedReason !== null || awaiting !== null) return;
    setShowErrors(true);
    if (workerMissing || hasQuantityError(validateQuantities(draft)) || hasValueError(rows, drafts))
      return;

    setIsSaved(false);
    setIsJustConfirmed(false);
    const inspectedAt = new Date().toISOString();
    submitter.enqueue(
      workerNo ?? '',
      toResultBody({
        inspectionRequestId,
        inspectedQty: toSendableNumber(inspectedDraft),
        acceptedQty: toSendableNumber(draft.accepted),
        rejectedQty: toSendableNumber(draft.rejected),
        heldQty: toSendableNumber(draft.held),
        uomId,
        overallJudgmentCode: judgment,
        inspectedAt,
        remarks,
        statusCode,
        coverage: EMPTY_COVERAGE_DRAFT,
        measurements: toMeasurementInputs(rows, drafts, inspectedAt),
      }),
    );
    if (waitsForServer) {
      waitFor(statusCode);
      return;
    }
    setIsSaved(statusCode === RESULT_STATUS.draft);
    setIsJustConfirmed(statusCode === RESULT_STATUS.confirmed);
  };

  if (detail.isError) {
    return (
      <QueueLoadErrorBanner
        error={toApiError(detail.error)}
        onRetry={() => void detail.refetch()}
      />
    );
  }

  if (detail.data === undefined) return <p className="field-note">{t.detail.loading}</p>;

  const target = detail.data;
  const planVersionId = target.inspectionPlanVersionId;
  const uomCodeOf = (uomId: number | null): string | null =>
    uomId === null ? null : (uoms.data?.find((uom) => uom.uomId === uomId)?.uomCode ?? null);
  const pickPad = withKeypad ? setPadField : () => undefined;
  const FormOf = variant === 'split' ? SplitResultForm : ResultForm;

  if (variant === 'web') {
    /* 관리웹(W-03-11 · omf-all-around#135) — IQC 판정 화면(#133)과 같은 짜임. 상태·저장 규칙은 위 그대로다. */
    function edited<T>(set: (value: T) => void): (value: T) => void {
      return (value) => {
        setDirty(true);
        setIsSaved(false);
        set(value);
      };
    }
    const tNoStandard = t.noStandard;

    return (
      <div className="pqc-web">
        <WebSummary
          detail={target}
          planVersion={planVersion.data ?? null}
          uomCode={uomCodeOf(target.uomId)}
        />

        {roundLoadFailed && (
          <QueueLoadErrorBanner
            error={toApiError(latestRoundQuery.error ?? savedMeasurements.error)}
            onRetry={() => {
              void latestRoundQuery.refetch();
              if (savedRound !== null) void savedMeasurements.refetch();
            }}
          />
        )}

        {planVersionId !== null && (
          <WebItemTable
            rows={rows}
            drafts={drafts}
            onValueChange={changeMeasurementValue}
            onJudgmentChange={changeMeasurementJudgment}
            judgmentOptions={itemJudgmentOptions}
            uomCodeOf={uomCodeOf}
            isLoading={itemSpecs.isLoading}
            isLocked={isConfirmed}
          />
        )}

        {/*
         * 검사기준이 없으면 따로 「검사 판정」 구획을 두지 않고 「판정」 안에 합친다(#135 · 담당자 지시) —
         * 왜 항목표가 없는지는 판정 제목 아래, 「검사 내용」은 판정 칸 아래에 선다.
         */}
        <ResultForm
          inspectedDraft={inspectedDraft}
          onInspectedChange={changeInspected}
          inspectedQty={inspectedQty}
          targetQty={storedInspectedQty}
          inspectionRound={savedRound?.inspectionRound ?? null}
          uomCode={uomCodeOf(target.uomId)}
          draft={draft}
          onChange={changeDraft}
          fieldErrors={rejection?.fieldErrors ?? EMPTY_FIELD_ERRORS}
          errorBanner={<SaveErrorBanner error={rejection?.error ?? null} />}
          showErrors={showErrors}
          judgmentOptions={overallOptions}
          judgment={judgment}
          onJudgmentChange={edited(setJudgment)}
          disposition={disposition}
          onDispositionChange={edited(setDisposition)}
          onPadFieldChange={() => undefined}
          isLocked={isConfirmed}
          judgmentNote={
            planVersionId === null ? <p className="field-note">{tNoStandard.note}</p> : undefined
          }
          judgmentBelow={
            planVersionId === null ? (
              <TextField
                fullWidth
                label={tNoStandard.remarks}
                placeholder={tNoStandard.remarksPlaceholder}
                value={remarks}
                disabled={isConfirmed}
                onChange={(event) => edited(setRemarks)(event.target.value)}
              />
            ) : undefined
          }
        />

        <WebActions
          isConfirmed={isConfirmed}
          isJustConfirmed={isJustConfirmed}
          isSaved={isSaved}
          lockedReason={lockedReason}
          showLockedNote={!roundLoadFailed}
          confirmBlockedReason={confirmBlockedReason}
          saveBlockedReason={saveBlockedReason}
          isSending={awaiting !== null}
          onSave={() => saveResult(target.uomId, RESULT_STATUS.draft)}
          onConfirm={() => saveResult(target.uomId, RESULT_STATUS.confirmed)}
        />
      </div>
    );
  }

  return (
    <div className="pqc-panel">
      <PanelTargetHeader detail={target} />

      {roundLoadFailed && (
        <QueueLoadErrorBanner
          error={toApiError(latestRoundQuery.error ?? savedMeasurements.error)}
          onRetry={() => {
            void latestRoundQuery.refetch();
            if (savedRound !== null) void savedMeasurements.refetch();
          }}
        />
      )}

      {variant === 'split' && lockedReason !== null && !roundLoadFailed && (
        /* 잠긴 이유가 먼저 눈에 들어오게 PQC 맨 위에 둔다(사용자 지시 2026-10-19). */
        <AlertBanner variant="warning" title={lockedReason} />
      )}

      {planVersionId === null ? (
        <FreeInputPanel remarks={remarks} onRemarksChange={setRemarks} isLocked={isConfirmed} />
      ) : variant === 'split' && itemSpecs.isSuccess && rows.length === 0 ? (
        /* 항목이 없는 기준은 빈 카드 대신 한 줄로 말한다(#107 UI/UX). */
        <p className="field-note pqc-panel-noitems">
          {planVersion.data == null
            ? t.panel.noItems
            : `${t.detail.planLabel(planVersion.data.planCode, planVersion.data.planVersion)} · ${t.panel.noItems}`}
        </p>
      ) : (
        <ItemPanel
          uomCodeOf={uomCodeOf}
          inspectionPlanVersionId={planVersionId}
          planVersion={planVersion.data ?? null}
          rows={rows}
          drafts={drafts}
          onValueChange={changeMeasurementValue}
          onValuePick={(rowKey, label) => pickPad({ key: 'measurement', rowKey, label })}
          onJudgmentChange={changeMeasurementJudgment}
          judgmentOptions={itemJudgmentOptions}
          isLoading={itemSpecs.isLoading}
          isLocked={isConfirmed}
        />
      )}

      <FormOf
        inspectedDraft={inspectedDraft}
        onInspectedChange={changeInspected}
        inspectedQty={inspectedQty}
        targetQty={storedInspectedQty}
        uomCode={uomCodeOf(target.uomId)}
        draft={draft}
        onChange={changeDraft}
        fieldErrors={rejection?.fieldErrors ?? EMPTY_FIELD_ERRORS}
        errorBanner={<SaveErrorBanner error={rejection?.error ?? null} />}
        showErrors={showErrors}
        judgmentOptions={overallOptions}
        judgment={judgment}
        onJudgmentChange={setJudgment}
        disposition={disposition}
        onDispositionChange={setDisposition}
        onPadFieldChange={(next) => pickPad(next)}
        isLocked={isConfirmed}
      />

      {withKeypad && padField !== null && (
        <KeypadPanel
          label={padField.label}
          value={
            padField.key === 'measurement'
              ? (drafts[padField.rowKey]?.value ?? '')
              : padField.key === 'inspected'
                ? inspectedDraft
                : draft[padField.key]
          }
          onChange={(next) => {
            if (padField.key === 'measurement') changeMeasurementValue(padField.rowKey, next);
            else if (padField.key === 'inspected') changeInspected(next);
            else changeDraft({ ...draft, [padField.key]: next });
          }}
          isLocked={isConfirmed}
          allowSignAndDecimal={padField.key === 'measurement'}
        />
      )}

      <PanelActions
        isConfirmed={isConfirmed}
        lockedReason={lockedReason}
        showLockedNote={false}
        isSending={awaiting !== null}
        confirmBlockedReason={confirmBlockedReason}
        workerMissing={workerMissing}
        saveBlockedReason={saveBlockedReason}
        isSaved={isSaved}
        isJustConfirmed={isJustConfirmed}
        onSave={() => saveResult(target.uomId, RESULT_STATUS.draft)}
        onConfirm={() => saveResult(target.uomId, RESULT_STATUS.confirmed)}
      />
    </div>
  );
};
