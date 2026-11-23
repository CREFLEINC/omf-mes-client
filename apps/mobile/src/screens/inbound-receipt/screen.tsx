import { Icon, IconButton } from '@crefle/web-ui';
import type {
  ApiError,
  InboundLotDetail,
  InboundLotMaterialLot,
  InboundLotReceiveResult,
} from '@omf-mes/api-client';
import { createIdempotencyKey } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { useBackStep } from '../../patterns/back-step';
import { ConfirmDialog } from '../../patterns/confirm-dialog';
import { playErrorTone } from '../../patterns/error-tone';
import { useOnlineStatus } from '../../patterns/online-status';
import { useOutbox } from '../../patterns/outbox';
import { ApiRequestError, toApiError } from '../../patterns/request';
import { signal } from '../../patterns/scan-feedback';
import { ScanZone } from '../../patterns/scan-zone';
import { useScreenTitle } from '../../patterns/screen-title';
import { useScanField } from '../../patterns/use-scan-field';
import { useWorkerSession } from '../../patterns/worker-session';
import { ItemLots } from './item-lots';
import { LastScan } from './last-scan';
import { qtyText } from './lot-format';
import {
  closeReceipt,
  inboundLotKeys,
  receiveLot,
  saveSupplierLotNo,
  unregisterLots,
  useInboundLotDetails,
} from './queries';
import {
  RECEIVE_LABEL,
  applyReceive,
  businessDateOf,
  hasErrorCode,
  isReceiving,
  lotTail,
  pendingCountFor,
  queuedLotNoOf,
  registeredInOf,
  rejectionCodeOf,
  serverMessageOf,
  tallyOf,
  tallyRowOfLot,
  toReceiveDraft,
  type CardState,
  type ScanLine,
} from './receipt';
import { ReceiptTally } from './receipt-tally';
import { SupplierLotSheet } from './supplier-lot-sheet';
import './screen.css';

const t = messages.inboundReceipt;

let lineSeq = 0;
const nextLineId = (): string => {
  lineSeq += 1;

  return `line-${String(lineSeq)}`;
};

/** 오프라인으로 담은 건 — 연결되면 결과를 이 키로 찾는다. */
interface Tracked {
  key: string;
  lotNo: string;
}

/**
 * M-01-01 입하 등록(005 · omf-all-around#254 · screens/M-01-01.md) — **스캔마다 하나씩 바로 등록**.
 *
 * ```
 * ←  입하 등록                       [온라인] 사번
 * ▦ SCAN
 * ┌ ✓ 등록됨               [취소] ✕ ┐   ← 방금 찍은 라벨 하나(다음 스캔 · 알림이 덮는다, ✕ 로 내린다)
 * │ 품목코드 / 품목명 / 큰 수량       │
 * └ 공급사 · …|번호 끝                ┘
 * (전송 대기 띠)
 * YY.MM.DD 입하 N건 Scan — 공급사 머리 줄 › 품목 줄(No · 품목코드 · 품목 · 개수 · 수량), 줄을 누르면 그 품목의 LOT
 * [모두 입하 마감 (n품목 m개)]
 * ```
 *
 * ⭐ 작업자에게 중요한 것만 남긴다(사용자 지시 2026-11-20) — 방금 찍은 라벨이 맞는지, 지금까지 몇 개를 찍었는지.
 *    입하 LOT 번호 · 상태 칩 · 등록 시각 · IQC 요청 번호 · 직접 입력 단추는 두지 않는다.
 * ⭐ 결과는 소리로도 가른다 — 등록 높은 음 두 번 · 품목이 바뀜 · 이미 찍음은 가운데 음 · 거부는 낮은 음(scan-feedback).
 * ⭐ 입하 표에 이미 있는 라벨은 서버에 보내지 않고 회색 「이미 찍은 라벨」로 몇 번 줄인지 알린다.
 * ⭐ 하나씩 빼기 · 공급사 LOT 번호 · 이 품목만 마감은 품목 화면에서, 모두 마감은 바닥 단추로.
 *
 * ⛔ 없앤 것(기존 화면 디자인 변경): P/O 고르기 · 단계 · 수량 칸 · 초과 판정 · 「LOT 번호 없음」 대체 사유 · 입하 LOT
 *    고르기 · 스캔 목록 · 결과 화면 · [나중에 마감](설계 변경 1·2·6, FR-036).
 */
export const InboundReceiptScreen = () => {
  useScreenTitle(t.title);
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const outbox = useOutbox();
  const { worker } = useWorkerSession();
  const workerNo = worker?.workerNo ?? null;

  const [cards, setCards] = useState<CardState[]>([]);
  /** 품목 화면으로 연 입하 LOT — null 이면 스캔 화면. 앱바 ← 가 닫는다. */
  const [viewId, setViewId] = useState<number | null>(null);
  /** 바로 앞 등록이 들어간 입하 LOT — 다르면 경고음(품목이 바뀌었다). */
  const lastOkId = useRef<number | null>(null);
  /* 결과 줄과 알림은 한 자리다 — 하나를 세우면 다른 하나는 내린다. */
  const [line, setLine] = useState<ScanLine | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tracked, setTracked] = useState<Tracked[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  /** 마감 확인 창 — 모두 또는 품목 하나. */
  const [closing, setClosing] = useState<
    { kind: 'all' } | { kind: 'one'; detail: InboundLotDetail } | null
  >(null);
  const [sheet, setSheet] = useState<{
    detail: InboundLotDetail;
    lot: InboundLotMaterialLot;
  } | null>(null);
  const [sheetSaving, setSheetSaving] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  /* 같은 틱의 두 번 스캔을 막는다 — 상태는 다음 그리기에서야 바뀐다. */
  const inFlight = useRef(false);

  const details = useInboundLotDetails(cards.map((card) => card.inboundLotId));
  const pending = outbox.loaded ? outbox.pendingOf(RECEIVE_LABEL) : [];
  const detailOf = (inboundLotId: number): InboundLotDetail | undefined =>
    details.get(inboundLotId)?.data;
  const groups = tallyOf(cards, detailOf);
  const rows = groups.flatMap((group) => group.rows);
  const total = rows.reduce((sum, row) => sum + row.detail.lotCount, 0);
  const receivingRows = rows.filter((row) => isReceiving(row.detail));
  const viewed = viewId === null ? undefined : detailOf(viewId);

  useBackStep(viewId !== null, () => {
    setViewId(null);
  });

  const pairPendingOf = (detail: InboundLotDetail): number =>
    pendingCountFor(pending, { itemCode: detail.itemCode, supplierCode: detail.supplierCode });

  const pushLine = (next: ScanLine): void => {
    setLine(next);
    setNotice(null);
  };

  const showNotice = (text: string): void => {
    setNotice(text);
    setLine(null);
  };

  /* 알림 줄 오른쪽 ✕ — 그 줄을 지운다(사용자 지시 2026-11-18). */
  const dismiss = (
    <IconButton
      className="receive__dismiss"
      icon="close"
      size="sm"
      aria-label={t.scan.dismiss}
      onClick={() => {
        setNotice(null);
      }}
    />
  );

  const refreshCard = (inboundLotId: number): void => {
    void queryClient.invalidateQueries({ queryKey: inboundLotKeys.detail(inboundLotId) });
  };

  /**
   * 받기 결과를 화면에 — 표 · 방금 찍은 칸(날짜 자동 마감도 이 칸에). 전송 대기에서 나간 건(`queued`)은 칸을 세우지
   * 않는다 — 몇 개가 나갔는지 알림 한 줄로 센다.
   */
  const apply = (result: InboundLotReceiveResult, lotNo: string, queued = false): void => {
    setCards((previous) => applyReceive(previous, result));

    for (const lot of result.inboundLots) {
      refreshCard(lot.inboundLotId);

      if (lot.autoClosedInboundLotNo !== null) {
        const closed = cards.find((card) => card.inboundLotNo === lot.autoClosedInboundLotNo);
        if (closed !== undefined) refreshCard(closed.inboundLotId);
      }
    }

    const first = result.inboundLots[0];

    if (first === undefined || queued) return;

    const newItem = lastOkId.current !== null && lastOkId.current !== first.inboundLotId;
    const lot = first.lots.find((each) => each.lotNo === lotNo) ?? null;
    lastOkId.current = first.inboundLotId;

    signal(newItem ? 'warn' : 'confirm');
    setViewId(null);
    pushLine({
      kind: 'ok',
      id: nextLineId(),
      lotNo,
      inboundLotId: first.inboundLotId,
      lotId: lot?.lotId ?? null,
      qty: lot?.lotQty ?? null,
      autoClosed: result.inboundLots.some((each) => each.autoClosedInboundLotNo !== null),
    });
  };

  /** 입하 표에 이미 있는 라벨 — 거부가 아니라 회색 알림(가운데 음). */
  const duplicate = (lotNo: string, row: number): void => {
    signal('warn');
    setViewId(null);
    pushLine({ kind: 'duplicate', id: nextLineId(), lotNo, row });
  };

  /**
   * 거부 줄의 이유 — 서버 `rejectedLots[].reasonCode` 로 가른다(screens/M-01-01.md 「거부 줄」). 둘째 줄은 제목에 없는
   * 사실(들어가 있는 입하 LOT)만 적는다 — 「~를 스캔하세요」 같은 지시는 두지 않는다.
   * 그 칸이 없는 거부(라벨 형식 · 코드 불일치 400 등)는 서버 문구 그대로.
   */
  const rejectLineOf = (lotNo: string, error: ApiError): ScanLine => {
    const code = rejectionCodeOf(error);
    const base = { kind: 'reject' as const, id: nextLineId(), lotNo };

    if (code === 'VOIDED') {
      return { ...base, reason: t.reject.voided, body: null };
    }
    if (code === 'ALREADY_RECEIVED') {
      const where = registeredInOf(
        [...details.values()].map((each) => each.data),
        lotNo,
        error,
      );

      return {
        ...base,
        reason: t.reject.alreadyReceived,
        body: where === null ? null : t.reject.alreadyReceivedIn(where.receiving),
      };
    }
    if (code === 'NOT_MATERIAL_LOT') {
      return { ...base, reason: t.reject.notMaterialLot, body: null };
    }

    return { ...base, reason: t.reject.refused, body: serverMessageOf(error) ?? t.reject.failed };
  };

  const reject = (lotNo: string, cause: unknown): void => {
    const error = toApiError(cause);
    const row =
      rejectionCodeOf(error) === 'ALREADY_RECEIVED' ? tallyRowOfLot(groups, lotNo) : null;

    if (row !== null) {
      duplicate(lotNo, row);

      return;
    }
    playErrorTone();
    setViewId(null);
    pushLine(rejectLineOf(lotNo, error));
  };

  /** 오프라인 — 등록하지 않고 전송 대기에 둔다(같은 키로 나중에 나간다). */
  const queue = async (lotNo: string, key: string, now: Date): Promise<void> => {
    if (workerNo === null) return;

    try {
      await outbox.enqueue(toReceiveDraft(lotNo, now, key, workerNo));
      setTracked((previous) => [...previous, { key, lotNo }]);
      pushLine({ kind: 'offline', id: nextLineId(), lotNo });
    } catch {
      playErrorTone();
      pushLine({
        kind: 'reject',
        id: nextLineId(),
        lotNo,
        reason: t.reject.refused,
        body: t.offline.queueFailed,
      });
    }
  };

  const scan = async (raw: string): Promise<void> => {
    const lotNo = raw.trim();

    if (lotNo === '' || workerNo === null || inFlight.current) return;

    const row = tallyRowOfLot(groups, lotNo);

    if (row !== null) {
      duplicate(lotNo, row);

      return;
    }

    if (pending.some((entry) => queuedLotNoOf(entry) === lotNo)) {
      playErrorTone();
      pushLine({
        kind: 'reject',
        id: nextLineId(),
        lotNo,
        reason: t.reject.alreadyQueued,
        body: null,
      });

      return;
    }

    const key = createIdempotencyKey();
    const now = new Date();

    if (!online) {
      await queue(lotNo, key, now);

      return;
    }

    inFlight.current = true;
    try {
      apply(await receiveLot(client, lotNo, now, key, workerNo), lotNo);
    } catch (cause) {
      /* 연결이 끊겼다 — 같은 키로 전송 대기에 담는다(서버가 받았으면 같은 결과가 돌아온다). */
      if (cause instanceof ApiRequestError && cause.apiError.kind === 'network') {
        await queue(lotNo, key, now);
      } else {
        reject(lotNo, cause);
      }
    } finally {
      inFlight.current = false;
    }
  };

  const scanField = useScanField({
    onScan: (value) => {
      void scan(value);
    },
  });

  /*
   * 전송 대기에서 빠진 건 — 아웃박스가 연결되자 저절로 보낸 것이다. 응답으로 카드를 채우고, 결과는 한 줄로 센다
   * (「전송 대기 N개를 보냈습니다 · 등록 N · 거부 N」). 거부된 건의 까닭은 셸의 전송 실패 화면에 남는다 — 여기에
   * 건마다 거부 줄을 세우지 않는다. 이 줄이 결과 줄 자리를 덮으니 보낸 라벨의 「오프라인」 줄도 함께 내려간다.
   */
  const pendingKeys = new Set(pending.map((entry) => entry.idempotencyKey));
  const settled = outbox.loaded ? tracked.filter((each) => !pendingKeys.has(each.key)) : [];
  const settledSignature = settled.map((each) => each.key).join(',');

  useEffect(() => {
    if (settled.length === 0) return;

    let registered = 0;
    let rejected = 0;

    for (const each of settled) {
      const response = outbox.responseOf(each.key) as InboundLotReceiveResult | undefined;

      if (response !== undefined) {
        registered += 1;
        apply(response, each.lotNo, true);
      } else if (outbox.isRejected(each.key)) {
        rejected += 1;
      }
    }

    const done = new Set(settled.map((each) => each.key));
    setTracked((previous) => previous.filter((each) => !done.has(each.key)));
    if (registered + rejected > 0) {
      showNotice(t.offline.flushed(registered + rejected, registered, rejected));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 빠진 건의 열쇠가 바뀔 때만 돈다
  }, [settledSignature]);

  const unregister = async (
    detail: InboundLotDetail,
    lot: InboundLotMaterialLot,
  ): Promise<void> => {
    if (workerNo === null) return;

    setBusyId(detail.inboundLotId);
    try {
      const after = await unregisterLots(
        client,
        detail.inboundLotId,
        [lot.lotId],
        detail.versionNo,
        workerNo,
      );

      if (after.statusCode === 'VOIDED') {
        setCards((previous) =>
          previous.filter((card) => card.inboundLotId !== detail.inboundLotId),
        );
        setViewId((previous) => (previous === detail.inboundLotId ? null : previous));
        showNotice(t.unregistered.lastToast(detail.itemName));
      } else {
        showNotice(
          t.unregistered.toast(lotTail(lot.lotNo), qtyText(after.receivedQty, detail.uomCode)),
        );
      }
    } catch (cause) {
      reject(lot.lotNo, cause);
    } finally {
      setBusyId(null);
      refreshCard(detail.inboundLotId);
    }
  };

  /** 방금 찍은 칸의 [취소] — 그 라벨 하나를 푼다. */
  const undo = (inboundLotId: number, lotId: number): void => {
    const detail = detailOf(inboundLotId);
    const lot = detail?.lots.find((each) => each.lotId === lotId);

    if (detail !== undefined && lot !== undefined) void unregister(detail, lot);
  };

  const closeFailed = (lotNo: string, cause: unknown): void => {
    playErrorTone();
    pushLine({
      kind: 'reject',
      id: nextLineId(),
      lotNo,
      reason: t.reject.refused,
      body: serverMessageOf(toApiError(cause)) ?? t.closeDialog.failed,
    });
  };

  const close = async (detail: InboundLotDetail): Promise<void> => {
    if (workerNo === null) return;

    setClosing(null);
    setBusyId(detail.inboundLotId);
    try {
      await closeReceipt(client, detail.inboundLotId, detail.versionNo, workerNo);
      showNotice(t.closeDialog.toastOne(detail.itemName));
    } catch (cause) {
      setViewId(null);
      closeFailed(detail.itemCode, cause);
    } finally {
      setBusyId(null);
      refreshCard(detail.inboundLotId);
    }
  };

  /** 모두 마감 — 입하 중인 품목을 차례로. 하나라도 막히면 거기서 멈추고 까닭을 보인다. */
  const closeAll = async (): Promise<void> => {
    if (workerNo === null) return;

    const targets = receivingRows.map((row) => row.detail);

    setClosing(null);
    setBusyId(-1);
    let done = 0;
    try {
      for (const detail of targets) {
        await closeReceipt(client, detail.inboundLotId, detail.versionNo, workerNo);
        done += 1;
      }
      showNotice(t.closeDialog.toastAll(done));
    } catch (cause) {
      closeFailed(targets[done]?.itemCode ?? '', cause);
    } finally {
      setBusyId(null);
      for (const detail of targets) refreshCard(detail.inboundLotId);
    }
  };

  const saveSheet = async (lotIds: number[], supplierLotNo: string | null): Promise<void> => {
    if (sheet === null || workerNo === null) return;

    const { detail, lot } = sheet;

    setSheetSaving(true);
    setSheetError(null);
    try {
      await saveSupplierLotNo(client, detail.inboundLotId, lotIds, supplierLotNo, workerNo);
      setSheet(null);
      showNotice(
        supplierLotNo === null
          ? t.sheet.cleared(lotTail(lot.lotNo), lotIds.length - 1)
          : t.sheet.saved(supplierLotNo, lotIds.length),
      );
      refreshCard(detail.inboundLotId);
    } catch (cause) {
      const error = toApiError(cause);

      if (hasErrorCode(error, 'RANGE')) {
        setSheetError(t.sheet.tooLong);
      } else if (error.kind === 'stateLocked') {
        /* 그사이 마감됐다 — 시트를 닫고 거부 줄, 카드를 마감 상태로 다시 그린다. */
        setSheet(null);
        playErrorTone();
        setViewId(null);
        pushLine({ kind: 'closed', id: nextLineId(), lotNo: lot.lotNo });
        refreshCard(detail.inboundLotId);
      } else {
        setSheetError(serverMessageOf(error) ?? t.sheet.failed);
      }
    } finally {
      setSheetSaving(false);
    }
  };

  const pendingLotNos = pending.flatMap((entry) => {
    const lotNo = queuedLotNoOf(entry);

    return lotNo === null ? [] : [lotNo];
  });

  const allLock = !online
    ? t.close.blockedOffline
    : pending.length > 0
      ? t.close.blockedPending(pending.length)
      : null;
  const viewedLock =
    viewed === undefined
      ? null
      : !online
        ? t.close.blockedOffline
        : pairPendingOf(viewed) > 0
          ? t.close.blockedPending(pairPendingOf(viewed))
          : null;
  const working = busyId !== null;
  const lineDetail = line?.kind === 'ok' ? detailOf(line.inboundLotId) : undefined;

  return (
    <div className="receive">
      {/*
       * 스캔 칸은 늘 낮은 띠(사용자 지시 2026-11-20 「상단에 높이가 낮은 스캔칸 유지」) — 결과는 바로 아래 큰 칸이 말한다.
       */}
      <ScanZone field={scanField} label={t.scan.label} prompt={t.scan.prompt} standby />

      {/* 방금 찍은 라벨 · 알림 자리 — 늘 하나다(다음 스캔 · 알림이 덮는다). */}
      <div className="receive__result" role="status" aria-label={t.scan.results}>
        {notice !== null ? (
          <p className="receive__notice">
            <span>{notice}</span>
            {dismiss}
          </p>
        ) : line === null ? null : (
          <LastScan
            key={line.id}
            line={line}
            detail={lineDetail}
            canUndo={
              line.kind === 'ok' &&
              line.lotId !== null &&
              lineDetail !== undefined &&
              isReceiving(lineDetail) &&
              online &&
              !working
            }
            onUndo={() => {
              if (line.kind === 'ok' && line.lotId !== null) undo(line.inboundLotId, line.lotId);
            }}
            onDismiss={() => {
              setLine(null);
            }}
          />
        )}
      </div>

      {pendingLotNos.length === 0 ? null : (
        <section className="receive__pending" aria-label={t.offline.title(pendingLotNos.length)}>
          <p className="receive__pending-head">
            <strong>{t.offline.title(pendingLotNos.length)}</strong>
          </p>
          <ul>
            {pendingLotNos.map((lotNo) => (
              <li key={lotNo}>
                <span className="receive__pending-no">{lotNo}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ReceiptTally
        date={businessDateOf(new Date())}
        groups={groups}
        total={total}
        currentId={line?.kind === 'ok' ? line.inboundLotId : null}
        duplicateNo={line?.kind === 'duplicate' ? line.row : null}
        focusKey={line?.kind === 'ok' || line?.kind === 'duplicate' ? line.id : null}
        onOpen={(inboundLotId) => {
          setNotice(null);
          setViewId(inboundLotId);
        }}
        receiving={{
          items: receivingRows.length,
          lots: receivingRows.reduce((sum, row) => sum + row.detail.lotCount, 0),
        }}
        closeLock={allLock}
        closing={busyId === -1}
        onCloseAll={() => {
          setClosing({ kind: 'all' });
        }}
      />

      {/* 품목 시트 — 공급사 LOT 시트 · 마감 확인 창이 떠 있는 동안은 내린다(창이 겹치지 않게). 닫히면 다시 선다. */}
      {viewed === undefined || sheet !== null || closing !== null ? null : (
        <ItemLots
          detail={viewed}
          editable={isReceiving(viewed) && viewedLock === null && !working}
          closeLock={viewedLock}
          closing={busyId === viewed.inboundLotId}
          onUnregister={(lot) => {
            void unregister(viewed, lot);
          }}
          onEditSupplierLot={(lot) => {
            setSheetError(null);
            setSheet({ detail: viewed, lot });
          }}
          onCloseItem={() => {
            setClosing({ kind: 'one', detail: viewed });
          }}
          onDismiss={() => {
            setViewId(null);
          }}
        />
      )}

      <ConfirmDialog
        open={closing !== null}
        title={
          closing === null
            ? ''
            : closing.kind === 'all'
              ? t.closeDialog.titleAll
              : t.closeDialog.titleOne(closing.detail.itemName)
        }
        cancelLabel={t.closeDialog.cancel}
        proceedLabel={t.closeDialog.confirm}
        onCancel={() => {
          setClosing(null);
        }}
        onProceed={() => {
          if (closing === null) return;
          if (closing.kind === 'all') void closeAll();
          else void close(closing.detail);
        }}
      >
        {closing === null ? null : closing.kind === 'all' ? (
          <>
            <p>
              {t.closeDialog.summaryAll(
                receivingRows.length,
                receivingRows.reduce((sum, row) => sum + row.detail.lotCount, 0),
              )}
            </p>
            <p>{t.closeDialog.body}</p>
          </>
        ) : (
          <>
            <p>{closing.detail.supplierName}</p>
            <p>
              {t.closeDialog.summaryOne(
                closing.detail.lotCount,
                qtyText(closing.detail.receivedQty, closing.detail.uomCode),
              )}
            </p>
            <p>
              {/* 「검사 생략」으로 남는 것은 기본 생략 기준이 걸릴 때만(G2 L15 · US2-7). */}
              {closing.detail.inspectionRequired
                ? t.closeDialog.body
                : closing.detail.iqcDefaultSkipApplies === true
                  ? t.closeDialog.bodyNoInspection
                  : t.closeDialog.bodyNoIqcRecord}
            </p>
          </>
        )}
      </ConfirmDialog>

      {sheet === null ? null : (
        <SupplierLotSheet
          detail={sheet.detail}
          lot={sheet.lot}
          saving={sheetSaving}
          fieldError={sheetError}
          onCancel={() => {
            setSheet(null);
          }}
          onSave={(lotIds, value) => {
            void saveSheet(lotIds, value);
          }}
        />
      )}
    </div>
  );
};
