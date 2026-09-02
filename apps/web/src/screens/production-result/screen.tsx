import { AlertBanner, Button, Card, Chip, Dialog, NumberPad, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { usePopIdentity } from '../../patterns/pop-identity';
import { SaveErrorBanner } from '../../patterns/master';
import { canWrite, useResultEntry } from './entry-context';
import { formatLotNo } from './lot-display';
import { LotPicker } from './lot-picker';
import { useOutbox } from './outbox';
import { usePendingPqc, useTargetLots, useWorkOrder } from './queries';
import {
  GOOD_QTY_MAX_LENGTH,
  QUICK_ADD_STEPS,
  addQuickStep,
  exceedsRemaining,
  formatQty,
  parseGoodQty,
  remainingQty,
  saveBlockReason,
  type BlockReason,
  type SaveGuard,
} from './quantity-draft';
import { buildSaveBody } from './save-request';
import { useTerminalGate, type GateVerdict } from './terminal-gating';
import { emptyResultDraft, type ResultDraft } from './types';

const t = messages.productionResult;

/** 저장 뒤 화면이 무엇을 말하는가. `null` 이면 아무 말도 하지 않는다. */
type SaveOutcome = 'continue' | 'lotDone' | null;

const gateMessage = (verdict: GateVerdict): string | null => {
  switch (verdict) {
    case 'allowed':
      return null;
    case 'checking':
      return t.gate.checking;
    case 'denied':
      return t.gate.denied;
    case 'unavailable':
      return t.gate.unavailable;
    case 'unidentified':
      return t.gate.unidentified;
  }
};

const blockMessage = (reason: BlockReason): string | null => {
  switch (reason) {
    case 'noWorkOrder':
      return t.entry.missingWorkOrder;
    case 'noWorker':
      return t.entry.missingWorker;
    case 'noLot':
      return t.lot.unselected;
    case 'emptyQty':
      return t.quantity.empty;
    case 'zeroQty':
      return t.quantity.zero;
    /* 게이팅·검사 선행은 각자 자기 배너가 이미 말한다 — 두 번 말하지 않는다. */
    case 'gate':
    case 'pendingPqc':
      return null;
  }
};

/**
 * P-02-04 — POP(1024×768 터치)에서 대상 LOT 을 고르고 **양품수량만** 쳐 넣어 작업실적을 남긴다.
 *
 * **이 화면이 받지 않는 것이 절반의 설계다.** 불량·보류·스크랩·재작업은 받지 않고(R50 — 불량은
 * 생산불량LOT 으로 갈라진다), 작업자·단말·교대·타발수도 보내지 않는다(서버 파생 · `P-05-01`
 * 소관). 남는 칸이 하나라서 좌우 2단 배치가 성립한다(스펙 §3-2).
 *
 * ⛔ **셸(`AppShell`)을 쓰지 않는다.** POP 은 사이드바로 옮겨 다니는 화면이 아니라 작업지시
 * 하나에 매인 태스크 화면이고, 세로 예산이 액션바까지 정해져 있다(헤더 64 + 본문 616 + 액션바
 * 88 = 768, **슬랙 0**). 관리웹 셸의 상단 바가 위에 얹히면 그 자리에서 본문 아래가 잘린다.
 *
 * ⭐ **저장은 통신을 기다리지 않는다.** 로컬 큐에 담기는 순간이 성공이고, 미전송 건수를 머리에
 * 상시 보인다(공유계약 C-1). ⛔ `202` 분기를 만들지 않는다 — 오프라인이면 요청 자체가 나가지
 * 않아 서버가 그 응답을 보낼 수 없다(변경 통지 #97).
 */
export const ProductionResultScreen = () => {
  const titleId = useId();
  const goodQtyId = useId();

  const entry = useResultEntry();
  const identity = usePopIdentity();
  const navigate = useNavigate();

  const gate = useTerminalGate(identity.terminalId, identity.processId);
  const workOrder = useWorkOrder(entry.workOrderId);
  const lots = useTargetLots(entry.workOrderId);
  const pendingPqc = usePendingPqc(entry.workOrderId);
  const outbox = useOutbox();

  const [draft, setDraft] = useState<ResultDraft>(emptyResultDraft);
  const [selectedLotId, setSelectedLotId] = useState<number | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isOverrunAsked, setIsOverrunAsked] = useState(false);
  const [outcome, setOutcome] = useState<SaveOutcome>(null);

  /**
   * 이 입력이 언제 일어났는가. **한 번 정하면 큐에 담길 때까지 붙든다.**
   *
   * ⛔ **누를 때마다 새로 만들면 안 된다.** 발생 시각이 본문에 실리므로 값이 매번 달라지고,
   * 오프라인 지연이 실적 시각을 왜곡한다 — 조항이 그 둘을 나눈 이유가 여기다(C-1 #3).
   */
  const occurredAtRef = useRef<string | null>(null);

  /*
   * 고른 LOT 이 목록에 아직 있는지 매번 확인한다 — 목록이 다시 불려 오면 사라졌을 수 있고,
   * 없는 LOT 으로 저장하면 서버가 거부한다.
   */
  const selectedLot = lots.data?.find((lot) => lot.lotId === selectedLotId) ?? null;
  const remaining = remainingQty(workOrder.data);
  const hasPendingPqc = pendingPqc.data !== undefined && pendingPqc.data.length > 0;

  const guard: SaveGuard = {
    isGateAllowed: gate.verdict === 'allowed',
    hasWorkOrder: workOrder.data !== undefined,
    hasWorker: canWrite(entry),
    hasLot: selectedLot !== null,
    /* ⛔ 조회에 실패했으면 「대상이 아니다」로 접지 않는다 — 모르는 것을 통과로 처리하지 않는다. */
    hasPendingPqc: hasPendingPqc || pendingPqc.isError || pendingPqc.isPending,
    draft,
  };

  const blockReason = saveBlockReason(guard);
  const gateNotice = gateMessage(gate.verdict);
  const blockNotice = blockReason === null ? null : blockMessage(blockReason);

  const changeDraft = (patch: Partial<ResultDraft>): void => {
    setDraft((prev) => ({ ...prev, ...patch }));
    /* 값이 바뀌면 다른 쓰기다 — 붙들고 있던 발생 시각과 앞 시도의 진술을 함께 버린다. */
    occurredAtRef.current = null;
    setOutcome(null);
    outbox.clearRejection();
  };

  /** 실제로 큐에 담는다. 초과 확인이 필요한 경우는 확인을 받은 뒤 이 함수로 들어온다. */
  const commit = (): void => {
    const goodQty = parseGoodQty(draft.goodQty);

    if (blockReason !== null || selectedLot === null || goodQty === null) return;
    if (entry.workOrderId === null || entry.workerNo === null) return;

    occurredAtRef.current ??= new Date().toISOString();

    outbox.enqueue(
      entry.workerNo,
      buildSaveBody({
        workOrderId: entry.workOrderId,
        lotId: selectedLot.lotId,
        /* 단위는 품목 기본 단위다 — 화면이 고르는 값이 아니다(스펙 §4). */
        uomId: selectedLot.uomId,
        draft,
        goodQty,
        occurredAt: occurredAtRef.current,
      }),
    );

    /*
     * 저장 후 분기(스펙 §5-2). **방금 담은 몫을 잔여에서 뺀 값으로 판정한다** — 서버 응답을
     * 기다리면 오프라인에서는 영영 오지 않고, 화면은 이미 성공을 말한 뒤다.
     */
    const nextRemaining = remaining === null ? null : remaining - goodQty;
    setOutcome(nextRemaining !== null && nextRemaining <= 0 ? 'lotDone' : 'continue');

    /* 이어서 입력할 수 있게 수량만 비운다 — 고른 LOT 은 남긴다(연속 입력이 이 화면의 흐름이다). */
    setDraft(emptyResultDraft);
    occurredAtRef.current = null;
    /* 잔여수량을 다시 받는다 — 온라인이면 서버가 더한 누계가 곧 도착한다. */
    void workOrder.refetch();
  };

  const save = (): void => {
    /*
     * 초과 생산은 **막지 않는다** — 확정된 허용이고 초과분은 추가 생산LOT 으로 간다(QA #27).
     * 화면이 하는 일은 확인을 한 번 받는 것이다(스펙 §6).
     */
    if (exceedsRemaining(draft.goodQty, remaining)) {
      setIsOverrunAsked(true);

      return;
    }

    commit();
  };

  const cancel = (): void => {
    setDraft(emptyResultDraft);
    occurredAtRef.current = null;
    setOutcome(null);
    outbox.clearRejection();
  };

  const goInspect = (): void => {
    const request = pendingPqc.data?.[0];
    if (request === undefined) return;

    void navigate(`/pop/pqc-inspection?ir=${String(request.inspectionRequestId)}`);
  };

  const enteredQty = parseGoodQty(draft.goodQty);

  return (
    <main className="pop-shell" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        <div className="pop-context-right">
          {entry.workOrderId !== null && (
            <span>{`${t.entry.workOrderLabel} ${workOrder.data?.workOrderNo ?? String(entry.workOrderId)}`}</span>
          )}
          {workOrder.data?.itemCode !== undefined && (
            <span>{`${t.entry.itemLabel} ${workOrder.data.itemCode}`}</span>
          )}
          {entry.workerNo !== null && <span>{`${t.entry.workerLabel} ${entry.workerNo}`}</span>}
          {/* 연결 표시는 셸이 이미 쓰는 것과 같은 말·같은 색을 쓴다. */}
          <Chip status={outbox.isOnline ? 'success' : 'warning'}>
            {outbox.isOnline
              ? messages.common.connection.online
              : messages.common.connection.offline}
          </Chip>
          {/* ⭐ 미전송 건수는 «즉시 성공»의 전제다 — 없으면 서버에 닿지 않은 사실을 알 길이 없다. */}
          {outbox.pendingCount > 0 && (
            <Chip status="warning">{t.sync.pending(outbox.pendingCount)}</Chip>
          )}
        </div>
      </header>

      {gateNotice !== null && (
        <div className="banner-slot">
          <AlertBanner
            variant={gate.verdict === 'unavailable' ? 'error' : 'warning'}
            title={gateNotice}
          >
            {/* ⛔ 「확인할 수 없다」에만 다시 시도를 준다 — 「권한이 없다」는 눌러도 달라지지 않는다. */}
            {gate.verdict === 'unavailable' && (
              <Button variant="outlined" size="2xl" onClick={gate.retry}>
                {t.gate.retry}
              </Button>
            )}
          </AlertBanner>
        </div>
      )}

      {workOrder.isError && (
        <div className="banner-slot">
          <AlertBanner variant="error" title={t.entry.loadFailed} />
        </div>
      )}

      {/* R54 — PQC 대상인데 아직 안 했으면 실적을 먼저 넣지 않는다(스펙 §6). */}
      {hasPendingPqc && (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.pqc.blockedTitle}>
            {t.pqc.blockedBody}
            <Button size="2xl" onClick={goInspect}>
              {t.pqc.goInspect}
            </Button>
          </AlertBanner>
        </div>
      )}
      {pendingPqc.isError && (
        <div className="banner-slot">
          <AlertBanner variant="error" title={t.pqc.loadFailed} />
        </div>
      )}

      {/* 서버가 «받지 않기로» 판정한 건만 여기 온다 — 못 보낸 것은 미전송 건수가 말한다. */}
      {outbox.rejection !== null && (
        <div className="banner-slot">
          <SaveErrorBanner error={outbox.rejection.error} />
        </div>
      )}

      {outcome !== null && (
        <div className="banner-slot">
          <AlertBanner
            variant={outcome === 'lotDone' ? 'info' : 'success'}
            title={outcome === 'lotDone' ? t.save.lotDoneTitle : t.save.successTitle}
          >
            {outcome === 'lotDone' ? t.save.lotDoneBody : t.save.continueBody}
            {!outbox.isOnline && <p className="field-note">{t.save.queuedBody}</p>}
          </AlertBanner>
        </div>
      )}

      <div className="pop-result-panes">
        {/* 좌단 — 대상과 입력. 스펙 §3-2 가 정한 순서 그대로다. */}
        <Card bordered className="pop-section" aria-label={t.quantity.sectionLabel}>
          <Card.Body>
            <dl className="pop-result-target">
              <div>
                <dt>{t.lot.lotLabel}</dt>
                <dd>
                  <span className="pop-result-lot-no">
                    {selectedLot === null ? '—' : formatLotNo(selectedLot.lotNo)}
                  </span>
                  <Button
                    variant="outlined"
                    size="2xl"
                    onClick={() => {
                      setIsPickerOpen(true);
                    }}
                  >
                    {t.lot.change}
                  </Button>
                </dd>
              </div>
              <div>
                {/*
                 * ⭐ **제품은 고르는 칸이 아니다.** W/O 품목 하나에 매여 있고 LOT 에 종속된다
                 * (스펙 §4) — 표시만 한다.
                 */}
                <dt>{t.lot.itemLabel}</dt>
                <dd>{workOrder.data?.itemCode ?? '—'}</dd>
              </div>
            </dl>

            <TextField
              id={goodQtyId}
              label={t.quantity.goodQtyLabel}
              /* ⚠ 입력류는 `xl`(60px)이 최대다 — 핵심 등급 72px 은 부품이 아직 못 낸다. */
              size="xl"
              fullWidth
              inputMode="numeric"
              value={draft.goodQty}
              error={outbox.rejection?.fieldErrors.goodQty}
              onChange={(event) => {
                changeDraft({ goodQty: event.target.value.replace(/\D/gu, '') });
              }}
            />

            <div className="pop-result-quick">
              {QUICK_ADD_STEPS.map((step) => (
                <Button
                  key={step}
                  variant="tonal"
                  size="2xl"
                  onClick={() => {
                    changeDraft({ goodQty: addQuickStep(draft.goodQty, step) });
                  }}
                >
                  {t.quantity.quickAdd(step)}
                </Button>
              ))}
            </div>

            <TextField
              label={t.quantity.remarksLabel}
              size="xl"
              fullWidth
              value={draft.remarks}
              error={outbox.rejection?.fieldErrors.remarks}
              onChange={(event) => {
                changeDraft({ remarks: event.target.value });
              }}
            />

            <p className="pop-result-remaining">
              <span>{t.quantity.remaining}</span>
              <strong>
                {remaining === null || workOrder.data === undefined
                  ? t.quantity.remainingUnknown
                  : t.quantity.remainingValue(
                      formatQty(remaining),
                      formatQty(workOrder.data.orderQty),
                    )}
              </strong>
            </p>
          </Card.Body>
        </Card>

        {/* 우단 — 숫자 키패드. 화면 안에 고정한다(OS 터치 키보드가 입력칸을 덮는다). */}
        <Card bordered className="pop-section" aria-label={t.quantity.keypadLabel}>
          <Card.Body>
            <NumberPad
              aria-label={t.quantity.keypadLabel}
              maxLength={GOOD_QTY_MAX_LENGTH}
              value={draft.goodQty}
              onChange={(value) => {
                changeDraft({ goodQty: value });
              }}
            />
          </Card.Body>
        </Card>
      </div>

      <div className="pop-actions">
        <Button variant="outlined" size="2xl" onClick={cancel}>
          {t.actions.cancel}
        </Button>
        <Button size="2xl" disabled={blockReason !== null} onClick={save}>
          {t.actions.save}
        </Button>
        {blockNotice !== null && <p className="field-note">{blockNotice}</p>}
      </div>

      <LotPicker
        open={isPickerOpen}
        lots={lots.data ?? []}
        selectedLotId={selectedLotId}
        isLoadFailed={lots.isError}
        onSelect={(lotId) => {
          setSelectedLotId(lotId);
          setIsPickerOpen(false);
          setOutcome(null);
        }}
        onClose={() => {
          setIsPickerOpen(false);
        }}
      />

      <Dialog
        open={isOverrunAsked}
        onClose={() => {
          setIsOverrunAsked(false);
        }}
        title={t.overrun.title}
        size="sm"
        closeOnBackdropClick={false}
        footer={
          <>
            <Button
              variant="outlined"
              size="2xl"
              onClick={() => {
                setIsOverrunAsked(false);
              }}
            >
              {t.overrun.cancel}
            </Button>
            <Button
              size="2xl"
              onClick={() => {
                setIsOverrunAsked(false);
                commit();
              }}
            >
              {t.overrun.confirm}
            </Button>
          </>
        }
      >
        {t.overrun.body(
          enteredQty === null ? '—' : formatQty(enteredQty),
          remaining === null ? '—' : formatQty(remaining),
        )}
      </Dialog>
    </main>
  );
};
