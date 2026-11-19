import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState } from 'react';

import { usePopIdentity } from '../../patterns/pop-identity';
import {
  PuActionBar,
  PuButton,
  PuChip,
  PuCols,
  PuEmpty,
  PuFlow,
  PuKeypad,
  PuNote,
  PuPager,
  PuScreen,
  PuSection,
  PuSeg,
  PuCount,
  applyKeypadKey,
  pageOf,
  puToast,
  useFitCount,
} from '../../patterns/pop-uniform';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { SaveErrorBanner } from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import { useWorkerSession } from '../../patterns/worker-session';
import { CODE_GROUPS, labelOfCode, toCodeOptions } from '../oqc-inspection/code-options';
import { FIXED_AXES } from '../oqc-inspection/filters';
import { QueueLoadErrorBanner } from '../oqc-inspection/load-error-banner';
import {
  EMPTY_QUANTITY_DRAFT,
  canConfirm,
  hasQuantityError,
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
import { serialBlockedReason, toSerialInputs, type SerialRow } from '../oqc-inspection/serials';
import {
  formatDateTime,
  latestRound,
  orderedRounds,
  type InspectionResultRound,
} from '../oqc-inspection/types';
import { targetSignatureOf, type WriteTargetSignature } from '../oqc-inspection/write-target';
import {
  PopConfirmDialog,
  PopJudgmentStep,
  PopQtySummary,
  PopQuantityStep,
  judgmentTone,
  usePopJudgment,
} from './judgment';
import { PopQueueList } from './queue-list';
import { PopRequestBand } from './request-summary';
import { PopSerialDialog, PopSerialSummary } from './serial-step';
import './uniform.css';

const t = messages.popOqcInspection;

type Step = 'quantity' | 'judgment';

/** 판정 결과(회차별) 한 줄 — 최근 회차가 위. */
const RoundResult = ({
  round,
  latest,
  judgmentOptions,
}: {
  round: InspectionResultRound;
  latest: boolean;
  judgmentOptions: Parameters<typeof labelOfCode>[0];
}) => (
  <div className={latest ? 'oqc-res' : 'oqc-res is-old'}>
    <div className="oqc-res-top">
      <span className="oqc-res-r">{t.result.round(round.inspectionRound)}</span>
      <PuChip tone={judgmentTone(round.overallJudgmentCode)}>
        {labelOfCode(judgmentOptions, round.overallJudgmentCode)}
      </PuChip>
      {round.confirmedAt !== null && (
        <span className="oqc-res-at">
          {t.result.confirmedAt(formatDateTime(round.confirmedAt))}
        </span>
      )}
    </div>
    <PopQtySummary
      inspected={String(round.inspectedQty)}
      accepted={String(round.acceptedQty)}
      rejected={String(round.rejectedQty)}
      held={String(round.heldQty)}
    />
  </div>
);

/**
 * P-04-06 OQC 출하검사 판정(POP · omf-all-around#109 · #295 POP 통일).
 *
 * 관리웹 W-04-03 과 **같은 판정**을 현장 단말에서 낸다. 조회·저장·계산은 그 화면의 부품을 그대로
 * 쓰고, 보이는 부품(목록·정보 띠·단계·확인 창)은 POP 전용이다(`judgment.tsx` — 판정 규칙은 그 화면과
 * 같다). ⭐ 편집 초안과 서버 조회가 만나는 규칙 R1~R4 도 그 화면(`oqc-inspection/screen.tsx`)과 같다
 * — 고칠 때 함께 고친다.
 *
 * 화면 안 흐름(#295 시안): 판정 전 의뢰는 1 수량 입력 › 2 최종 판정 두 단계, 판정을 마친 의뢰는
 * 회차별 결과만 보인다. 단계는 화면 안 표시일 뿐 — 저장 조건·확인 창·저장 값은 그대로다.
 *
 * ⛔ 저장은 사번이 있어야 나간다 — 서버가 `X-Worker-No` 로 검사자를 정한다(PQC 와 같다).
 */
export const PopOqcInspectionScreen = () => {
  const formId = useId();
  const identity = usePopIdentity();
  const workerSession = useWorkerSession();
  const workerNo = identity.workerNo?.trim() || workerSession?.worker.workerNo?.trim() || null;

  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [folded, setFolded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  /* 한 쪽 건수 = 구획 높이에 들어가는 만큼(#295 규칙 1). 조건·정렬은 그대로. */
  const pageSize = useFitCount(listRef, { fallback: 5 });

  /*
   * 판정 대기 / 판정 완료를 탭으로 골라 본다(사용자 지시 2026-11-17 · #291). 두 탭의 건수가 늘 보이도록
   * 두 목록을 함께 읽고, 고른 탭의 줄만 보인다.
   */
  const [view, setView] = useState<'pending' | 'done'>('pending');
  const pendingQueue = useInspectionQueue({
    inspectionTypeCode: FIXED_AXES.inspectionTypeCode,
    pendingOnly: true,
    page: view === 'pending' ? page : 1,
    size: pageSize,
  });
  const doneQueue = useInspectionQueue({
    inspectionTypeCode: FIXED_AXES.inspectionTypeCode,
    pendingOnly: false,
    statusCode: 'COMPLETED',
    page: view === 'done' ? page : 1,
    size: pageSize,
  });
  const queue = view === 'pending' ? pendingQueue : doneQueue;
  const detail = useInspectionRequestDetail(selectedId);
  const rounds = useInspectionRounds(selectedId);
  const round = latestRound(rounds.data ?? []);

  /* 한 쪽 건수가 바뀌면 첫 쪽부터 — 넘친 쪽 번호가 빈 쪽을 부르지 않게. */
  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  const [isReinspecting, setIsReinspecting] = useState(false);
  const previousResultId = isReinspecting ? (round?.inspectionResultId ?? null) : null;
  const isReinspectingNow = previousResultId !== null;

  const [isJustSaved, setIsJustSaved] = useState(false);
  const [draft, setDraft] = useState<QuantityDraft>(EMPTY_QUANTITY_DRAFT);
  const [step, setStep] = useState<Step>('quantity');
  const [keypadTarget, setKeypadTarget] = useState<keyof QuantityDraft>('accepted');
  const [serialOpen, setSerialOpen] = useState(false);

  const judgmentValues = useCodeValues(CODE_GROUPS.overallJudgment);
  const judgmentOptions = toCodeOptions(judgmentValues.data ?? []);
  const [judgment, setJudgment] = useState('');
  /* 검사한 시리얼(omf-all-around#68) — 의뢰를 바꾸거나 저장에 성공하거나 재검사를 열고 닫으면 비운다. */
  const [serialRows, setSerialRows] = useState<SerialRow[]>([]);

  /* R3 — 누를 때 겨눈 대상을 적어 두고 돌아와 대조한다. */
  const writeTargetRef = useRef<WriteTargetSignature | null>(null);
  const writeTarget = selectedId === null ? null : targetSignatureOf(selectedId, previousResultId);
  /* 저장 결과 알림에 쓸 말 — 누른 순간의 의뢰번호·판정 이름. */
  const savedToastRef = useRef<string | null>(null);

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
    /* 다른 의뢰·새 회차면 1단계부터. */
    setStep('quantity');
    setKeypadTarget('accepted');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, roundId, acceptedQty, rejectedQty, heldQty, storedJudgment]);

  useEffect(() => {
    writeTargetRef.current = null;
    setIsJustSaved(false);
    setSerialRows([]);
    setSerialOpen(false);
  }, [selectedId]);

  /* 저장 결과는 작업 줄 위 알림으로(#295 규칙 13). */
  useEffect(() => {
    if (!isJustSaved || savedToastRef.current === null) return;
    puToast(savedToastRef.current);
    savedToastRef.current = null;
  }, [isJustSaved]);

  const rows = queue.data?.rows ?? [];

  /* 재검사는 의뢰를 다시 검사한다 — 합계의 오른쪽 변은 의뢰의 대상 수량이다. */
  const inspectedQty = isReinspectingNow
    ? (detail.data?.targetQty ?? 0)
    : (round?.inspectedQty ?? detail.data?.targetQty ?? 0);

  const saveResult = (inspectionRequestId: number, uomId: number, inspectedAt: string): void => {
    if (writeTarget === null || workerNo === null) return;

    setIsJustSaved(false);
    writeTargetRef.current = writeTarget;
    savedToastRef.current = t.bar.saved(
      detail.data?.inspectionRequestNo ?? '',
      labelOfCode(judgmentOptions, judgment),
    );
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
    setStep('quantity');
    setKeypadTarget('accepted');
    setIsReinspecting(true);
  };

  const cancelReinspection = (): void => {
    setIsReinspecting(false);
    setDraft(draftOf(round));
    setJudgment(storedJudgment);
    setSerialRows([]);
    setStep('quantity');
  };

  /* 판정을 마친 회차가 있는 의뢰(재검사 아님)는 결과만 보인다. 고르기 전에는 고른 탭을 따른다. */
  const showResult = selectedId === null ? view === 'done' : formReady && judgmentState.isLocked;
  const editable = formReady && !judgmentState.isLocked;
  const inQuantity = !showResult && step === 'quantity';
  /* [저장](1단계 → 2단계)과 단계 줄 「2 최종 판정」은 같은 조건 — 수량 합계 = 검사 수량. */
  const nextReason: string | null = !formReady
    ? selectedId === null
      ? t.bar.blocked.noSelection
      : t.bar.blocked.loading
    : !canConfirm(judgmentState.totals) || hasQuantityError(judgmentState.errors)
      ? t.bar.blocked.totals
      : null;
  const goJudgment = (): void => {
    if (nextReason === null) setStep('judgment');
  };
  const keypadOn = editable && inQuantity && !save.isSaving;
  const isShipment = detail.data?.targetTypeCode === 'SHIPMENT_REQUEST';
  const ngSerials = serialRows.filter((row) => row.judgment === 'NG').length;

  const resultRef = useRef<HTMLDivElement>(null);
  const resultSize = useFitCount(resultRef, { fallback: 3 });
  const [resultPage, setResultPage] = useState(1);
  useEffect(() => {
    setResultPage(1);
  }, [selectedId]);
  const results = pageOf(orderedRounds(rounds.data ?? []).reverse(), resultPage, resultSize);

  const title = showResult
    ? t.result.resultTitle
    : inQuantity
      ? t.result.quantityTitle
      : t.result.judgmentTitle;

  const roundChip =
    selectedId === null || !formReady ? undefined : isReinspectingNow ? (
      <PuChip tone="info">{t.result.reinspectRound((rounds.data?.length ?? 0) + 1)}</PuChip>
    ) : (
      <PuChip>{t.result.round(round?.inspectionRound ?? 1)}</PuChip>
    );

  const workBody = (() => {
    if (selectedId === null) {
      return (
        <PuEmpty
          icon="file"
          title={t.detail.nothingSelectedTitle}
          hint={view === 'done' ? t.detail.nothingSelectedDone : t.detail.nothingSelected}
        />
      );
    }
    if (detail.isError) {
      return (
        <QueueLoadErrorBanner
          error={toApiError(detail.error)}
          onRetry={() => void detail.refetch()}
        />
      );
    }
    if (detail.data === undefined) return <PuNote>{t.detail.loading}</PuNote>;

    const band = (
      <PopRequestBand
        detail={detail.data}
        history={isReinspectingNow ? (rounds.data ?? []) : undefined}
        judgmentOptions={judgmentOptions}
        wide={!inQuantity}
      />
    );

    if (rounds.isError) {
      return (
        <>
          {band}
          <QueueLoadErrorBanner
            error={toApiError(rounds.error)}
            onRetry={() => void rounds.refetch()}
          />
        </>
      );
    }
    if (rounds.isPending) {
      return (
        <>
          {band}
          <PuNote>{t.result.loading}</PuNote>
        </>
      );
    }

    if (showResult) {
      return (
        <>
          {band}
          {!judgmentState.isConfirmed && <PuNote tone="warn">{t.result.draftElsewhere}</PuNote>}
          <div ref={resultRef} className="oqc-res-list pu-fit">
            {results.items.map((item, index) => (
              <RoundResult
                key={item.inspectionResultId}
                round={item}
                latest={results.page === 1 && index === 0}
                judgmentOptions={judgmentOptions}
              />
            ))}
          </div>
          <PuPager
            total={results.total}
            page={results.page}
            pages={results.pages}
            label={t.result.resultTitle}
            showTotal={false}
            onPage={setResultPage}
          />
        </>
      );
    }

    const flow = (
      <PuFlow
        label={t.result.flowLabel}
        current={inQuantity ? 0 : 1}
        steps={[
          {
            label: t.result.quantityTitle,
            done: !inQuantity,
            onGo: () => {
              setStep('quantity');
            },
          },
          {
            label: t.result.judgmentTitle,
            onGo: () => {
              if (nextReason === null) goJudgment();
              else puToast(nextReason, 'info');
            },
          },
        ]}
      />
    );

    return (
      <>
        {flow}
        {band}
        {inQuantity ? (
          <PopQuantityStep
            formId={formId}
            draft={draft}
            onChange={setDraft}
            disabled={!keypadOn}
            target={keypadOn ? keypadTarget : null}
            onTarget={setKeypadTarget}
            fieldErrors={save.fieldErrors}
          />
        ) : (
          <PopJudgmentStep
            formId={formId}
            state={judgmentState}
            reinspectRound={isReinspectingNow ? (rounds.data?.length ?? 0) + 1 : null}
            inspectedQty={inspectedQty}
            judgmentOptions={judgmentOptions}
            judgment={judgment}
            onJudgmentChange={setJudgment}
            disabled={!editable || save.isSaving}
            hasLot={detail.data.lotId !== null}
            fieldErrors={save.fieldErrors}
            serials={
              isShipment ? (
                <PopSerialSummary
                  rows={serialRows}
                  disabled={save.isSaving}
                  onOpen={() => {
                    setSerialOpen(true);
                  }}
                />
              ) : undefined
            }
          />
        )}
      </>
    );
  })();

  const listEmpty = queue.isError ? (
    <QueueLoadErrorBanner error={toApiError(queue.error)} onRetry={() => void queue.refetch()} />
  ) : queue.isPending ? (
    <PuNote>{t.queue.loading}</PuNote>
  ) : (
    <PuEmpty icon="list" title={view === 'pending' ? t.queue.empty : t.queue.doneEmpty} />
  );

  const actionBar = (
    <PuActionBar>
      {showResult ? (
        selectedId !== null && <PuButton onClick={startReinspection}>{t.bar.reinspect}</PuButton>
      ) : (
        <>
          {!inQuantity && (
            <PuButton
              disabled={save.isSaving}
              onClick={() => {
                setStep('quantity');
              }}
            >
              {t.bar.prev}
            </PuButton>
          )}
          {isReinspectingNow && (
            <PuButton disabled={save.isSaving} onClick={cancelReinspection}>
              {t.bar.reinspectCancel}
            </PuButton>
          )}
          {inQuantity ? (
            /*
             * ⛔ 두 단추에 다른 `key` — 같은 DOM 단추를 다시 쓰면 [저장](2단계로)을 누른 순간 그 단추가
             *    제출 단추로 바뀌어 같은 누름이 판정 저장 확인 창까지 연다.
             */
            <PuButton
              key="next"
              variant="primary"
              disabled={nextReason !== null}
              title={nextReason ?? undefined}
              onClick={goJudgment}
            >
              {t.bar.next}
            </PuButton>
          ) : (
            <PuButton
              key="save"
              type="submit"
              form={formId}
              variant="primary"
              disabled={judgmentState.blockedReason !== null || save.isSaving}
              title={judgmentState.blockedReason ?? undefined}
            >
              {save.isSaving ? t.bar.saving : t.bar.save}
            </PuButton>
          )}
        </>
      )}
    </PuActionBar>
  );

  return (
    <PuScreen className="oqc-u" actionBar={actionBar}>
      <PuCols variant={inQuantity ? 'lk' : 'list'}>
        <PuSection
          className="oqc-list-card"
          head={
            <PuSeg
              label={t.queue.viewLabel}
              value={view}
              onChange={(key) => {
                if (view === key || save.isSaving) return;
                /* 탭을 바꾸면 고른 것을 놓는다 — 다른 목록의 의뢰가 오른쪽에 남으면 어긋난다. */
                setSelectedId(null);
                setPage(1);
                setView(key);
              }}
              options={[
                {
                  value: 'pending',
                  label: (
                    <>
                      {t.queue.heading} <PuCount>{pendingQueue.data?.page.total ?? 0}</PuCount>
                    </>
                  ),
                },
                {
                  value: 'done',
                  label: (
                    <>
                      {t.queue.doneHeading} <PuCount>{doneQueue.data?.page.total ?? 0}</PuCount>
                    </>
                  ),
                },
              ]}
            />
          }
          fold={{ label: t.queue.listName, folded, onChange: setFolded }}
          split
        >
          {rows.length === 0 ? (
            listEmpty
          ) : (
            <PopQueueList
              rows={rows}
              selectedId={selectedId}
              listRef={listRef}
              onSelect={(id) => {
                if (!save.isSaving) setSelectedId(id);
              }}
            />
          )}
          <PuPager
            total={queue.data?.page.total ?? null}
            page={page}
            pages={Math.max(
              1,
              Math.ceil((queue.data?.page.total ?? 0) / Math.max(1, queue.data?.page.size ?? 1)),
            )}
            label={t.queue.pageNav}
            onPage={(next) => {
              if (save.isSaving) return;
              /* 쪽을 넘기면 고른 것을 놓는다 — 다른 쪽의 의뢰가 오른쪽에 남으면 어긋난다. */
              setSelectedId(null);
              setPage(next);
            }}
          />
        </PuSection>

        {/* 단계 이름은 단계 줄이 이미 보인다 — 구획 제목으로 겹쳐 쓰지 않는다(사용자 지시 2026-11-19). */}
        <PuSection
          title={showResult ? title : undefined}
          label={title}
          meta={roundChip}
          className="oqc-work"
        >
          <PopWorkerMissingBanner workerNo={workerNo} />
          {save.error !== null && judgmentState.openedAt === null && (
            <SaveErrorBanner error={save.error} onReload={() => void rounds.refetch()} />
          )}
          {workBody}
        </PuSection>

        {inQuantity && (
          <PuSection title={t.result.keypadTitle}>
            <PuKeypad
              targetLabel={keypadOn ? t.result.fields[keypadTarget] : null}
              disabled={!keypadOn}
              onKey={(key) => {
                setDraft((prev) => ({
                  ...prev,
                  [keypadTarget]: applyKeypadKey(prev[keypadTarget], key, { maxDecimals: 6 }),
                }));
              }}
              onClearAll={() => {
                setDraft((prev) => ({ ...prev, [keypadTarget]: '' }));
              }}
            />
          </PuSection>
        )}
      </PuCols>

      {serialOpen && selectedId !== null && detail.data !== undefined && (
        <PopSerialDialog
          inspectionRequestId={selectedId}
          itemId={detail.data.itemId}
          rows={serialRows}
          onChange={setSerialRows}
          serverError={save.fieldErrors.serials}
          disabled={save.isSaving}
          onClose={() => {
            setSerialOpen(false);
          }}
        />
      )}

      {judgmentState.openedAt !== null && selectedId !== null && detail.data !== undefined && (
        <PopConfirmDialog
          inspectionRequestNo={detail.data.inspectionRequestNo}
          judgmentOptions={judgmentOptions}
          judgment={judgment}
          inspectedQty={inspectedQty}
          preview={judgmentState.preview}
          hasLot={detail.data.lotId !== null}
          serialSummary={isShipment ? t.serial.count(serialRows.length, ngSerials) : undefined}
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
    </PuScreen>
  );
};
