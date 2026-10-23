import { EmptyState } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState } from 'react';

import { usePopIdentity } from '../../patterns/pop-identity';
import { PopPageNav, pageBoundaryOf } from '../../patterns/pop-page-nav';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { PopWorkerTag } from '../../patterns/pop-worker-tag';
import { toApiError } from '../../patterns/request';
import { useWorkerSession } from '../../patterns/worker-session';
import { CODE_GROUPS, toCodeOptions } from '../oqc-inspection/code-options';
import { FIXED_AXES, PAGE_SIZE } from '../oqc-inspection/filters';
import { QueueLoadErrorBanner } from '../oqc-inspection/load-error-banner';
import {
  EMPTY_QUANTITY_DRAFT,
  toSendableNumber,
  type QuantityDraft,
} from '../oqc-inspection/quantity-draft';
import {
  useCodeValues,
  useInspectionQueue,
  useInspectionRequestDetail,
  useInspectionRounds,
  useSaveInspectionResult,
} from '../oqc-inspection/queries';
import { RoundHistory } from '../oqc-inspection/round-history';
import { serialBlockedReason, toSerialInputs, type SerialRow } from '../oqc-inspection/serials';
import { latestRound } from '../oqc-inspection/types';
import { targetSignatureOf, type WriteTargetSignature } from '../oqc-inspection/write-target';
import { PopConfirmDialog, PopJudgmentBar, PopJudgmentForm, usePopJudgment } from './judgment';
import { PopQueueList } from './queue-list';
import { PopRequestSummary } from './request-summary';
import { PopSerialStep } from './serial-step';

const t = messages.popOqcInspection;

/**
 * P-04-06 OQC 출하검사 판정(POP · omf-all-around#109).
 *
 * 관리웹 W-04-03 과 **같은 판정**을 현장 단말에서 낸다. 조회·저장·계산·회차 이력은 그 화면의
 * 부품을 그대로 쓰고, 보이는 부품(목록·의뢰 요약·판정 입력·바닥 저장 띠·확인 창)은 POP 전용이다
 * (`judgment.tsx` — 판정 규칙은 그 화면과 같다). ⭐ 편집 초안과 서버
 * 조회가 만나는 규칙 R1~R4 도 그 화면(`oqc-inspection/screen.tsx`)과 같다 — 고칠 때 함께 고친다.
 *
 * ⚠ **목록은 판정 대기(요청·진행)만 본다.** 조건 막대를 두지 않는다 — 단말 앞의 일은 «지금 판정할
 * 것»이고, 지난 판정을 찾는 것은 관리웹의 몫이다.
 *
 * ⛔ 저장은 사번이 있어야 나간다 — 서버가 `X-Worker-No` 로 검사자를 정한다(PQC 와 같다).
 */
export const PopOqcInspectionScreen = () => {
  const titleId = useId();
  const formId = useId();
  const identity = usePopIdentity();
  const workerSession = useWorkerSession();
  const workerNo = identity.workerNo?.trim() || workerSession?.worker.workerNo?.trim() || null;

  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const queue = useInspectionQueue({
    inspectionTypeCode: FIXED_AXES.inspectionTypeCode,
    pendingOnly: true,
    page,
    size: PAGE_SIZE,
  });
  const detail = useInspectionRequestDetail(selectedId);
  const rounds = useInspectionRounds(selectedId);
  const round = latestRound(rounds.data ?? []);

  const [isReinspecting, setIsReinspecting] = useState(false);
  const previousResultId = isReinspecting ? (round?.inspectionResultId ?? null) : null;
  const isReinspectingNow = previousResultId !== null;

  const [isJustSaved, setIsJustSaved] = useState(false);
  const [draft, setDraft] = useState<QuantityDraft>(EMPTY_QUANTITY_DRAFT);

  const judgmentValues = useCodeValues(CODE_GROUPS.overallJudgment);
  const judgmentOptions = toCodeOptions(judgmentValues.data ?? []);
  const [judgment, setJudgment] = useState('');
  /* 검사한 시리얼(omf-all-around#68) — 의뢰를 바꾸거나 저장에 성공하거나 재검사를 열고 닫으면 비운다. */
  const [serialRows, setSerialRows] = useState<SerialRow[]>([]);

  /* R3 — 누를 때 겨눈 대상을 적어 두고 돌아와 대조한다. */
  const writeTargetRef = useRef<WriteTargetSignature | null>(null);
  const writeTarget = selectedId === null ? null : targetSignatureOf(selectedId, previousResultId);

  const save = useSaveInspectionResult(
    selectedId,
    () => {
      if (writeTargetRef.current === null || writeTargetRef.current !== writeTarget) return;

      writeTargetRef.current = null;
      setIsJustSaved(true);
      setSerialRows([]);
    },
    workerNo ?? undefined,
  );

  const roundId = round?.inspectionResultId ?? null;
  const { acceptedQty, rejectedQty, heldQty } = round ?? {
    acceptedQty: 0,
    rejectedQty: 0,
    heldQty: 0,
  };
  const storedJudgment = round?.overallJudgmentCode ?? '';

  const draftOf = (
    source: { acceptedQty: number; rejectedQty: number; heldQty: number } | null,
  ): QuantityDraft =>
    source === null
      ? EMPTY_QUANTITY_DRAFT
      : {
          accepted: String(source.acceptedQty),
          rejected: String(source.rejectedQty),
          held: String(source.heldQty),
        };

  /* R1·R2 — 값으로 되돌리고, 의존성에 `selectedId` 가 반드시 든다(회차 없는 의뢰끼리 옮길 때). */
  useEffect(() => {
    setIsReinspecting(false);
    setJudgment(storedJudgment);
    setDraft(draftOf(roundId === null ? null : { acceptedQty, rejectedQty, heldQty }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, roundId, acceptedQty, rejectedQty, heldQty, storedJudgment]);

  useEffect(() => {
    writeTargetRef.current = null;
    setIsJustSaved(false);
    setSerialRows([]);
  }, [selectedId]);

  const rows = queue.data?.rows ?? [];

  const emptyContent = queue.isError ? (
    <p className="field-note">{t.queue.unavailable}</p>
  ) : queue.isPending ? (
    <p className="field-note">{t.queue.loading}</p>
  ) : (
    <EmptyState size="sm" title={t.queue.empty} />
  );

  /* 재검사는 의뢰를 다시 검사한다 — 합계의 오른쪽 변은 의뢰의 대상 수량이다. */
  const inspectedQty = isReinspectingNow
    ? (detail.data?.targetQty ?? 0)
    : (round?.inspectedQty ?? detail.data?.targetQty ?? 0);

  const saveResult = (inspectionRequestId: number, uomId: number, inspectedAt: string): void => {
    if (writeTarget === null || workerNo === null) return;

    setIsJustSaved(false);
    writeTargetRef.current = writeTarget;
    save.write({
      inspectionRequestId,
      inspectedQty,
      acceptedQty: toSendableNumber(draft.accepted),
      rejectedQty: toSendableNumber(draft.rejected),
      heldQty: toSendableNumber(draft.held),
      uomId,
      /* R4 — 고른 판정을 몸통에 싣는다. */
      overallJudgmentCode: judgment,
      inspectedAt,
      previousResultId,
      serials: toSerialInputs(serialRows),
    });
  };

  /* 입력 구획이 서는 조건 — 의뢰와 회차를 다 받았다. */
  const formReady =
    selectedId !== null && detail.data !== undefined && !rounds.isError && !rounds.isPending;
  const formRound = isReinspectingNow ? null : round;

  const judgmentState = usePopJudgment({
    active: formReady,
    idleReason: selectedId === null ? t.bar.blocked.noSelection : t.bar.blocked.loading,
    resetKey: selectedId,
    round: formRound,
    inspectedQty,
    draft,
    judgmentOptions,
    judgment,
    isSaving: save.isSaving,
    isJustSaved,
    workerNo,
    serialBlockedReason: serialBlockedReason(serialRows, inspectedQty, draft.rejected),
  });

  const startReinspection = (): void => {
    setIsJustSaved(false);
    setDraft(EMPTY_QUANTITY_DRAFT);
    setJudgment('');
    setSerialRows([]);
    setIsReinspecting(true);
  };

  const detailContent =
    selectedId === null ? (
      <div className="pop-oqc-idle">
        <EmptyState
          size="md"
          title={t.detail.nothingSelectedTitle}
          description={t.detail.nothingSelected}
        />
      </div>
    ) : detail.isError ? (
      <QueueLoadErrorBanner
        error={toApiError(detail.error)}
        onRetry={() => void detail.refetch()}
      />
    ) : detail.data === undefined ? (
      <p className="field-note">{t.detail.loading}</p>
    ) : (
      <>
        <PopRequestSummary detail={detail.data} />

        {rounds.isError ? (
          <QueueLoadErrorBanner
            error={toApiError(rounds.error)}
            onRetry={() => void rounds.refetch()}
          />
        ) : rounds.isPending ? (
          <p className="field-note">{t.result.loading}</p>
        ) : (
          <PopJudgmentForm
            formId={formId}
            state={judgmentState}
            isReinspecting={isReinspectingNow}
            round={formRound}
            inspectedQty={inspectedQty}
            draft={draft}
            onChange={setDraft}
            judgmentOptions={judgmentOptions}
            judgment={judgment}
            onJudgmentChange={setJudgment}
            isSaving={save.isSaving}
            fieldErrors={save.fieldErrors}
            hasLot={detail.data.lotId !== null}
            serialStep={
              detail.data.targetTypeCode === 'SHIPMENT_REQUEST' ? (
                <PopSerialStep
                  inspectionRequestId={selectedId}
                  itemId={detail.data.itemId}
                  rows={serialRows}
                  onChange={setSerialRows}
                  serverError={save.fieldErrors.serials}
                  disabled={save.isSaving}
                />
              ) : undefined
            }
          >
            <RoundHistory
              rounds={rounds.data ?? []}
              currentResultId={isReinspectingNow ? null : roundId}
              isReinspecting={isReinspectingNow}
              judgmentOptions={judgmentOptions}
            />
          </PopJudgmentForm>
        )}
      </>
    );

  return (
    <main className="pop-shell pop-ui pop-oqc" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        {detail.data !== undefined && selectedId !== null && (
          <p className="pop-context">{detail.data.inspectionRequestNo}</p>
        )}
        <div className="pop-context-right">
          <PopWorkerTag workerNo={workerNo} />
        </div>
      </header>

      <PopWorkerMissingBanner workerNo={workerNo} />

      <div className="pop-panes pop-oqc-panes">
        <section className="pane" aria-label={t.queue.heading}>
          <div className="pop-oqc-pane-head">
            <h2 className="pane-title">{t.queue.heading}</h2>
            {queue.data !== undefined && (
              <span className="pop-oqc-count">{t.queue.count(queue.data.page.total)}</span>
            )}
          </div>
          {queue.isError && (
            <QueueLoadErrorBanner
              error={toApiError(queue.error)}
              onRetry={() => void queue.refetch()}
            />
          )}
          <PopQueueList
            rows={rows}
            selectedId={selectedId}
            onSelect={setSelectedId}
            empty={emptyContent}
          />
          <PopPageNav
            boundary={pageBoundaryOf(queue.data?.page)}
            label={t.queue.pageNav}
            onChange={(next) => {
              if (save.isSaving) return;
              /* 쪽을 넘기면 고른 것을 놓는다 — 다른 쪽의 의뢰가 오른쪽에 남으면 어긋난다. */
              setSelectedId(null);
              setPage(next);
            }}
          />
        </section>

        <section className="pane pop-oqc-detail-pane" aria-label={t.detail.paneLabel}>
          {detailContent}
        </section>
      </div>

      <PopJudgmentBar
        formId={formId}
        state={judgmentState}
        isSaving={save.isSaving}
        isJustSaved={isJustSaved}
        saveError={save.error}
        onReload={() => void rounds.refetch()}
        isReinspecting={isReinspectingNow}
        onStartReinspection={startReinspection}
        onCancelReinspection={() => {
          setIsReinspecting(false);
          setDraft(draftOf(round));
          setJudgment(storedJudgment);
          setSerialRows([]);
        }}
      />

      {judgmentState.openedAt !== null && selectedId !== null && detail.data !== undefined && (
        <PopConfirmDialog
          inspectionRequestNo={detail.data.inspectionRequestNo}
          judgmentOptions={judgmentOptions}
          judgment={judgment}
          inspectedQty={inspectedQty}
          preview={judgmentState.preview}
          hasLot={detail.data.lotId !== null}
          saveError={save.error}
          onReload={() => void rounds.refetch()}
          isSaving={save.isSaving}
          onClose={judgmentState.closeDialog}
          onConfirm={() => {
            const openedAt = judgmentState.openedAt;
            if (openedAt === null || detail.data === undefined) return;
            saveResult(selectedId, detail.data.uomId, openedAt);
          }}
        />
      )}
    </main>
  );
};
