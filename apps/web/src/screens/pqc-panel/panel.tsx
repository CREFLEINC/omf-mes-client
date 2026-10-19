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
import { pqcPanelKeys, useDraftRound, useRoundMeasurements } from './queries';
import { ResultForm } from './result-form';
import { PanelTargetHeader } from './target-header';

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
}: PqcPanelProps) => {
  const detail = useInspectionRequestDetail(inspectionRequestId);
  const itemSpecs = useInspectionItemSpecs(detail.data?.inspectionPlanVersionId ?? null);
  /* 작성중 회차가 있으면 칸을 되살린다 — 다음 저장도 `POST` 이고 서버가 그 회차를 덮는다(장부 P-49). */
  const draftRound = useDraftRound(inspectionRequestId);
  const savedRound = draftRound.data ?? null;
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

  const { clearRejection, rejection, rejectedStatusCode, sentCount } = submitter;

  /* 서버가 받았으면 의뢰를 다시 부른다 — 확정이면 의뢰가 완료로 바뀌어 칸이 잠긴다. */
  const queryClient = useQueryClient();
  useEffect(() => {
    if (sentCount === 0) return;
    void queryClient.invalidateQueries({ queryKey: pqcInspectionKeys.detail(inspectionRequestId) });
    void queryClient.invalidateQueries({ queryKey: pqcPanelKeys.rounds(inspectionRequestId) });
  }, [sentCount, queryClient, inspectionRequestId]);

  /* 거부가 돌아오면 「담았다」 표시를 거둔다 — 확정이 거부됐으면 확정 표시도. */
  useEffect(() => {
    if (rejection === null) return;
    setIsSaved(false);
    if (rejectedStatusCode !== RESULT_STATUS.confirmed) return;
    setIsJustConfirmed(false);
  }, [rejection, rejectedStatusCode]);

  const storedInspectedQty = detail.data?.targetQty ?? 0;

  /* 대상이 바뀌면 초안을 비운다 — 앞 의뢰의 값이 다음 의뢰로 넘어가면 되돌릴 수 없는 판정이 나간다. */
  useEffect(() => {
    setIsSaved(false);
    setIsJustConfirmed(false);
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
  }, [inspectionRequestId, storedInspectedQty, clearRejection]);

  /*
   * 작성중 회차를 칸에 되살린다. ⭐ 위 초기화 «뒤»에 선다 — 의뢰 상세가 늦게 와 초기화가 다시 돌아도 저장된 값이
   * 이긴다. 같은 회차·같은 판이면 한 번만 — 그 사이 사람이 고친 값을 재조회가 덮지 않는다.
   */
  const restoredKey = useRef<string | null>(null);
  const savedKey =
    savedRound === null
      ? null
      : `${String(savedRound.inspectionResultId)}:${String(savedRound.versionNo ?? 0)}:${String(storedInspectedQty)}`;
  useEffect(() => {
    if (savedRound === null || savedKey === null || restoredKey.current === savedKey) return;
    restoredKey.current = savedKey;
    const rejected = String(savedRound.rejectedQty);
    setInspectedDraft(String(savedRound.inspectedQty));
    setDraft({ accepted: String(savedRound.acceptedQty), rejected, held: String(savedRound.heldQty) });
    setDisposition((current) => settleDisposition(current, toMicro(rejected)));
    setJudgment(savedRound.overallJudgmentCode ?? '');
    setRemarks(savedRound.remarks ?? '');
  }, [savedRound, savedKey]);

  const rowKeys = rows.map((row) => row.key).join('|');
  const savedMeasurementsData = savedMeasurements.data;
  useEffect(() => {
    setDrafts(toMeasurementDrafts(rows));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowKeys, savedMeasurementsData]);

  const changeInspected = (raw: string): void => {
    setIsSaved(false);
    setInspectedDraft(raw);
  };
  const changeDraft = (next: QuantityDraft): void => {
    setIsSaved(false);
    setDraft(next);
    setDisposition((current) => settleDisposition(current, toMicro(next.rejected)));
  };
  const changeMeasurementValue = (key: string, value: string): void => {
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
    submitter.hasPendingConfirm(inspectionRequestId);
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
  /* 모르면(조회 전·실패) 막지 않는다 — 서버가 같은 규칙으로 막는다. */
  const lockedReason = !isConfirmed && producedQty === 0 ? t.result.noProductionResult : null;

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
    if (isConfirmed) return;
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

  return (
    <div className="pqc-panel">
      <PanelTargetHeader detail={target} />

      {planVersionId === null ? (
        <FreeInputPanel remarks={remarks} onRemarksChange={setRemarks} isLocked={isConfirmed} />
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

      <ResultForm
        inspectedDraft={inspectedDraft}
        onInspectedChange={changeInspected}
        inspectedQty={inspectedQty}
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
