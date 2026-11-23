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
  useFitTableRows,
} from '../../patterns/pop-uniform';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { ListOrderFoot, type ListOrder } from '../../patterns/pop-list-order';
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
import { formatDateTime, latestRound, orderedRounds } from '../oqc-inspection/types';
import { useUomLookup, withUom } from '../oqc-inspection/uom-lookup';
import { targetSignatureOf, type WriteTargetSignature } from '../oqc-inspection/write-target';
import {
  PopConfirmDialog,
  PopJudgmentStep,
  PopQuantityStep,
  judgmentTone,
  usePopJudgment,
} from './judgment';
import { isUnjudgeable, PopQueueList } from './queue-list';
import { PopRequestBand } from './request-summary';
import { PopSerialDialog, PopSerialSummary } from './serial-step';
import { PopShipmentBar, PopShipmentDetail, usePopShipmentForm } from './shipment';
import { isJudgedOpen, isShipmentOqc } from '../oqc-inspection/shipment-oqc';
import './uniform.css';

/** 판정 대기 목록은 한 번에 읽는다 — 판정을 마친 열린 의뢰를 「판정 완료」로 가르려면 다 있어야 한다(서버 상한 200). */
const PENDING_SIZE = 200;

const t = messages.popOqcInspection;

type Step = 'quantity' | 'judgment';

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
    page: 1,
    size: PENDING_SIZE,
  });
  /*
   * 「판정 완료」 탭 앞쪽 쪽들은 판정을 마친 열린 의뢰(`judgedRows`, 화면에서 자름), 그 뒤 쪽들은 서버의 완료 의뢰다.
   * 한 쪽에 둘을 섞어 칸을 넘기지 않는다(목록 칸 안 스크롤 · 잘림 없음 — 사용자 지시 2026-11-20).
   */
  const judgedOpenRows = (pendingQueue.data?.rows ?? []).filter(isJudgedOpen);
  const judgedPages = Math.ceil(judgedOpenRows.length / Math.max(1, pageSize));
  const doneQueue = useInspectionQueue({
    inspectionTypeCode: FIXED_AXES.inspectionTypeCode,
    pendingOnly: false,
    statusCode: 'COMPLETED',
    page: view === 'done' ? Math.max(1, page - judgedPages) : 1,
    size: pageSize,
  });
  const queue = view === 'pending' ? pendingQueue : doneQueue;
  /*
   * 출하 OQC 새 흐름(피처 010 · 2026-11-18 결정) — 열린 의뢰라도 피킹 LOT 이 모두 판정을 가지면 「판정 완료」 탭에 선다
   * (확정은 출하 완료 때라 상태가 진행으로 남는다). 미검사가 있거나 피킹 LOT 이 없으면 「판정 대기」.
   */
  const pendingRows = pendingQueue.data?.rows ?? [];
  /*
   * 판정할 수 있는 의뢰 먼저, 「판정 불가」(피킹 LOT 없음)는 맨 아래(사용자 지시 2026-11-20 · 출하 포장 #329 와 같다).
   * 각 묶음 안은 받은 순서 그대로. ⭐ 한 번에 읽은 목록을 화면에서 쪽으로 나누므로 «자르기 전에» 줄 세운다.
   * 고른 의뢰는 번호로 기억하므로 순서가 바뀌어도 그대로다.
   */
  const unsortedWaiting = pendingRows.filter((row) => !isJudgedOpen(row));
  const waitingRows = [
    ...unsortedWaiting.filter((row) => !isUnjudgeable(row)),
    ...unsortedWaiting.filter(isUnjudgeable),
  ];
  const judgedRows = judgedOpenRows;
  const viewCount = {
    pending: waitingRows.length,
    done: judgedRows.length + (doneQueue.data?.page.total ?? 0),
  };
  const detail = useInspectionRequestDetail(selectedId);
  const isNewFlow = detail.data !== undefined && isShipmentOqc(detail.data);
  const shipmentForm = usePopShipmentForm(isNewFlow ? selectedId : null, workerNo);
  /* 수량 옆 단위 코드(표시 전용) — 못 받으면 숫자만 둔다. */
  const uoms = useUomLookup();
  const uomCode = uoms.codeOf(detail.data?.uomId);
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
  /* 종합 판정을 화면이 스스로 「합격」으로 넣었는가 — 수량이 바뀌면 그것만 되돌린다. */
  const autoJudgmentRef = useRef(false);
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
    autoJudgmentRef.current = false;
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

  useEffect(() => {
    if (!autoJudgmentRef.current) return;
    if (draft.accepted.trim() !== '' && Number(draft.accepted) === inspectedQty) return;
    autoJudgmentRef.current = false;
    setJudgment('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.accepted]);

  /*
   * 판정 대기는 한 번에 읽은 줄(200)을 화면에서 쪽으로 나눠 보인다. 판정 완료는 서버 쪽 읽기 그대로이고,
   * 판정을 마친 열린 의뢰(`judgedRows`)는 앞쪽 쪽들에 선다(피처 010 · 한 쪽은 칸에 드는 만큼).
   */
  const pendingPage = pageOf(waitingRows, page, pageSize);
  const rows =
    view === 'pending'
      ? pendingPage.items
      : page <= judgedPages
        ? pageOf(judgedRows, page, pageSize).items
        : (doneQueue.data?.rows ?? []);
  const listPager =
    view === 'pending'
      ? { total: pendingPage.total, pages: pendingPage.pages }
      : {
          total:
            doneQueue.data === undefined
              ? judgedRows.length > 0
                ? judgedRows.length
                : null
              : judgedRows.length + doneQueue.data.page.total,
          pages: Math.max(
            1,
            judgedPages +
              Math.ceil(
                (doneQueue.data?.page.total ?? 0) / Math.max(1, doneQueue.data?.page.size ?? 1),
              ),
          ),
        };

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
  /* 오른쪽 입력(키패드) 칸 — 옛 흐름에서 의뢰를 골라 수량을 적을 때만. 고르기 전·판정 결과·새 흐름은 두지 않고
     상세가 그 폭을 쓴다(사용자 지시 2026-11-20). */
  const showKeypad = inQuantity && !isNewFlow && selectedId !== null;
  /* [저장](1단계 → 2단계)과 단계 줄 「2 최종 판정」은 같은 조건 — 수량 합계 = 검사 수량. */
  const nextReason: string | null = !formReady
    ? selectedId === null
      ? t.bar.blocked.noSelection
      : t.bar.blocked.loading
    : !canConfirm(judgmentState.totals) || hasQuantityError(judgmentState.errors)
      ? t.bar.blocked.totals
      : null;
  /*
   * 합격 수량 = 검사 수량이면 2단계에 들어갈 때 종합 판정을 「합격」으로 미리 고른다(시안 · 사용자 지적
   * 2026-11-19). 다른 판정으로 바꿀 수 있고, 수량을 바꿔 전부 합격이 아니게 되면 자동으로 넣은 합격만 지운다.
   */
  const allAccepted =
    draft.accepted.trim() !== '' && Number(draft.accepted) === inspectedQty && inspectedQty > 0;
  const goJudgment = (): void => {
    if (nextReason !== null) return;
    if (judgment === '' && allAccepted && judgmentOptions.some((o) => o.value === 'ACCEPTED')) {
      setJudgment('ACCEPTED');
      autoJudgmentRef.current = true;
    }
    setStep('judgment');
  };
  const keypadOn = editable && inQuantity && !save.isSaving;
  const isShipment = detail.data?.targetTypeCode === 'SHIPMENT_REQUEST';
  const ngSerials = serialRows.filter((row) => row.judgment === 'NG').length;

  const resultRef = useRef<HTMLDivElement>(null);
  /* 회차 결과는 표 — 한 쪽 줄 수는 구획 높이만큼(사용자 지시 2026-11-19). */
  const resultSize = useFitTableRows(resultRef, { fallback: 5 });
  const [resultPage, setResultPage] = useState(1);
  useEffect(() => {
    setResultPage(1);
  }, [selectedId]);
  /*
   * 회차 결과 [최신순 | 오래된순](사용자 지시 2026-11-19) — 처음은 지금처럼 최근 회차가 위. 회차는 확정 일시 차례로
   * 붙으므로 회차 번호로 줄 세운다(아직 확정 안 된 회차도 제 자리에 선다).
   */
  const [resultOrder, setResultOrder] = useState<ListOrder>('newest');
  const ordered = orderedRounds(rounds.data ?? []);
  const results = pageOf(
    resultOrder === 'newest' ? ordered.reverse() : ordered,
    resultPage,
    resultSize,
  );

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

  /* 단계 줄은 구획 제목 줄(회차 칩과 같은 줄)에 선다(사용자 지시 2026-11-19). */
  const showFlow =
    selectedId !== null &&
    detail.data !== undefined &&
    !detail.isError &&
    !rounds.isError &&
    !rounds.isPending &&
    !showResult;
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
          disabled: nextReason !== null,
          onGo: goJudgment,
        },
      ]}
    />
  );

  const workBody = (() => {
    if (selectedId === null) {
      return (
        /* 제목 한 줄만 — 설명 문장은 두지 않는다(불필요 문구 제거 · 사용자 지시 2026-11-20). */
        <PuEmpty icon="file" title={t.detail.nothingSelectedTitle} />
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
        uom={uomCode}
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
          {/* 회차 결과 표(사용자 지시 2026-11-19) — 합격 초록 · 불합격 빨강 · 보류 노랑. 최근 회차가 위. */}
          {/* 표 전체 가운데 정렬(사용자 지시 2026-11-19). */}
          <div ref={resultRef} className="oqc-res-table pu-fit">
            <div className="pu-table-wrap">
              <table className="pu-table">
                <thead>
                  <tr>
                    <th className="mid">{t.result.columns.round}</th>
                    <th className="mid">{t.result.columns.judgment}</th>
                    <th className="mid">{t.result.summary.inspectedQty}</th>
                    <th className="mid">{t.result.summary.accepted}</th>
                    <th className="mid">{t.result.summary.rejected}</th>
                    <th className="mid">{t.result.summary.held}</th>
                    <th className="fit mid">{t.result.columns.confirmedAt}</th>
                  </tr>
                </thead>
                <tbody>
                  {results.items.map((item) => (
                    <tr key={item.inspectionResultId}>
                      <td className="mid">{t.result.round(item.inspectionRound)}</td>
                      <td className="mid">
                        <PuChip tone={judgmentTone(item.overallJudgmentCode)}>
                          {labelOfCode(judgmentOptions, item.overallJudgmentCode)}
                        </PuChip>
                      </td>
                      <td className="mid">{withUom(String(item.inspectedQty), uomCode)}</td>
                      <td className="mid oqc-q-ok">{withUom(String(item.acceptedQty), uomCode)}</td>
                      <td className="mid oqc-q-bad">
                        {withUom(String(item.rejectedQty), uomCode)}
                      </td>
                      <td className="mid oqc-q-warn">{withUom(String(item.heldQty), uomCode)}</td>
                      <td className="fit mid">
                        {item.confirmedAt === null ? '—' : formatDateTime(item.confirmedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <ListOrderFoot
            order={resultOrder}
            onOrder={(next) => {
              setResultOrder(next);
              setResultPage(1);
            }}
          >
            <PuPager
              total={results.total}
              page={results.page}
              pages={results.pages}
              label={t.result.resultTitle}
              showTotal={false}
              onPage={setResultPage}
            />
          </ListOrderFoot>
        </>
      );
    }

    return (
      <>
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
            uom={uomCode}
          />
        ) : (
          <PopJudgmentStep
            formId={formId}
            state={judgmentState}
            reinspectRound={isReinspectingNow ? (rounds.data?.length ?? 0) + 1 : null}
            inspectedQty={inspectedQty}
            uom={uomCode}
            judgmentOptions={judgmentOptions}
            judgment={judgment}
            onJudgmentChange={(code) => {
              autoJudgmentRef.current = false;
              setJudgment(code);
            }}
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
    <PuScreen
      className="oqc-u"
      actionBar={isNewFlow ? <PopShipmentBar form={shipmentForm} /> : actionBar}
    >
      <PuCols variant={showKeypad ? 'lk' : 'list'}>
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
                      {t.queue.heading} <PuCount>{viewCount.pending}</PuCount>
                    </>
                  ),
                },
                {
                  value: 'done',
                  label: (
                    <>
                      {t.queue.doneHeading} <PuCount>{viewCount.done}</PuCount>
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
              uomOf={uoms.codeOf}
              onSelect={(id) => {
                if (!save.isSaving) setSelectedId(id);
              }}
            />
          )}
          <PuPager
            total={listPager.total}
            page={view === 'pending' ? pendingPage.page : page}
            pages={listPager.pages}
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
        {isNewFlow ? (
          /* 출하 OQC 새 흐름 — 피킹 LOT 매칭 · 판정만 · 결과 추가만(피처 010 · decisions #47). */
          <PuSection label={t.detail.bandLabel} className="oqc-work">
            <PopWorkerMissingBanner workerNo={workerNo} />
            <PopShipmentDetail form={shipmentForm} uomCode={uomCode} />
          </PuSection>
        ) : (
          <PuSection
            title={showResult ? title : undefined}
            label={title}
            head={showFlow ? flow : undefined}
            meta={roundChip}
            className="oqc-work"
          >
            <PopWorkerMissingBanner workerNo={workerNo} />
            {save.error !== null && judgmentState.openedAt === null && (
              <SaveErrorBanner error={save.error} onReload={() => void rounds.refetch()} />
            )}
            {workBody}
          </PuSection>
        )}

        {showKeypad && (
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

      {!isNewFlow && serialOpen && selectedId !== null && detail.data !== undefined && (
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

      {!isNewFlow &&
        judgmentState.openedAt !== null &&
        selectedId !== null &&
        detail.data !== undefined && (
          <PopConfirmDialog
            inspectionRequestNo={detail.data.inspectionRequestNo}
            judgmentOptions={judgmentOptions}
            judgment={judgment}
            inspectedQty={inspectedQty}
            uom={uomCode}
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
