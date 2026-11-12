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
import { ConfirmDialog } from '../../patterns/confirm-dialog';
import { playErrorTone } from '../../patterns/error-tone';
import { useOnlineStatus } from '../../patterns/online-status';
import { useOutbox } from '../../patterns/outbox';
import { ApiRequestError, toApiError } from '../../patterns/request';
import { ScanZone } from '../../patterns/scan-zone';
import { useScreenTitle } from '../../patterns/screen-title';
import { useScanField } from '../../patterns/use-scan-field';
import { useWorkerSession } from '../../patterns/worker-session';
import { InboundLotCard, qtyText } from './inbound-lot-card';
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
  cardLockOf,
  hasErrorCode,
  lotTail,
  pendingCountFor,
  queuedLotNoOf,
  registeredInOf,
  rejectionCodeOf,
  serverMessageOf,
  toReceiveDraft,
  type CardState,
  type ScanLine,
} from './receipt';
import { SupplierLotSheet } from './supplier-lot-sheet';
import './screen.css';

const t = messages.inboundReceipt;

/** 거부 줄은 쌓이되 너무 길어지지 않게 — 최근 것부터 이만큼. */
const MAX_LINES = 8;

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
 * (날짜 자동 마감 띠)
 * ▦ 자재 관리 LOT 라벨을 스캔하세요 — 스캔하면 바로 등록
 * ✓ 등록됨 · …|0002 → 새 입하 LOT IL-… 생성      ← 마지막 결과
 * ⛔ 거부 줄(쌓임)
 * (전송 대기 띠)
 * 이번에 받은 입하 LOT N   — 카드(공급사·품목마다 한 장): 줄 · [해제] · 공급사 LOT · [입하 마감]
 * ```
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
  const [lines, setLines] = useState<ScanLine[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [autoClosed, setAutoClosed] = useState<string | null>(null);
  const [tracked, setTracked] = useState<Tracked[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [closedHere, setClosedHere] = useState<ReadonlySet<number>>(new Set());
  const [closing, setClosing] = useState<InboundLotDetail | null>(null);
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

  const pushLine = (line: ScanLine): void => {
    setLines((previous) => {
      /* 성공 · 오프라인 줄은 마지막 하나만, 거부 줄은 쌓는다. */
      const kept =
        line.kind === 'reject' || line.kind === 'closed'
          ? previous
          : previous.filter((each) => each.kind === 'reject' || each.kind === 'closed');

      return [line, ...kept].slice(0, MAX_LINES);
    });
  };

  const refreshCard = (inboundLotId: number): void => {
    void queryClient.invalidateQueries({ queryKey: inboundLotKeys.detail(inboundLotId) });
  };

  /** 받기 결과를 화면에 — 카드 · 결과 줄 · 자동 마감 띠. */
  const apply = (result: InboundLotReceiveResult, lotNo: string): void => {
    setCards((previous) => applyReceive(previous, result));

    for (const lot of result.inboundLots) {
      refreshCard(lot.inboundLotId);

      if (lot.autoClosedInboundLotNo !== null) {
        setAutoClosed(lot.autoClosedInboundLotNo);
        const closed = cards.find((card) => card.inboundLotNo === lot.autoClosedInboundLotNo);
        if (closed !== undefined) refreshCard(closed.inboundLotId);
      }
    }

    const first = result.inboundLots[0];

    if (first === undefined) return;

    /* 성공은 결과 줄 하나로만 알린다 — 알림 줄에 같은 문구를 또 띄우지 않는다(G1 360 폭). */
    pushLine({
      kind: 'ok',
      id: nextLineId(),
      lotNo,
      inboundLotNo: first.inboundLotNo,
      created: first.created,
      count: first.lotCount,
      fromSupplierLabel: first.lots.some((each) => each.fromSupplierLabel),
    });
  };

  /**
   * 거부 줄의 이유 · 설명 — 서버 `rejectedLots[].reasonCode` 로 가른다(screens/M-01-01.md 「거부 줄」).
   * 그 칸이 없는 거부(라벨 형식 · 코드 불일치 400 등)는 서버 문구 그대로.
   */
  const rejectLineOf = (lotNo: string, error: ApiError): ScanLine => {
    const code = rejectionCodeOf(error);
    const base = { kind: 'reject' as const, id: nextLineId(), lotNo };

    if (code === 'VOIDED') {
      return { ...base, reason: t.reject.voided, body: t.reject.voidedBody };
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
        body:
          where === null
            ? t.reject.alreadyReceivedBody
            : t.reject.alreadyReceivedIn(where.inboundLotNo, where.receiving),
      };
    }
    if (code === 'NOT_MATERIAL_LOT') {
      return { ...base, reason: t.reject.notMaterialLot, body: t.reject.notMaterialLotBody };
    }

    return { ...base, reason: t.reject.refused, body: serverMessageOf(error) ?? t.reject.failed };
  };

  const reject = (lotNo: string, cause: unknown): void => {
    playErrorTone();
    pushLine(rejectLineOf(lotNo, toApiError(cause)));
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

    /* 새 스캔이면 앞선 알림(해제 · 마감 · 전송)은 내린다 — 결과 줄과 겹쳐 남지 않게. */
    setNotice(null);

    if (pending.some((entry) => queuedLotNoOf(entry) === lotNo)) {
      playErrorTone();
      pushLine({
        kind: 'reject',
        id: nextLineId(),
        lotNo,
        reason: t.reject.alreadyQueued,
        body: t.reject.alreadyQueuedBody,
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
   * 전송 대기에서 빠진 건 — 아웃박스가 연결되자 저절로 보낸 것이다. 응답으로 카드를, 되돌아온 것은 거부 줄로.
   * 다 보냈으면 한 줄로 센다(「연결됨 — 전송 대기 N개를 보냈습니다 · 등록 N · 거부 N」).
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
        apply(response, each.lotNo);
      } else if (outbox.isRejected(each.key)) {
        rejected += 1;
        const record = outbox.rejected.find((item) => item.entry.idempotencyKey === each.key);
        pushLine(
          record === undefined
            ? {
                kind: 'reject',
                id: nextLineId(),
                lotNo: each.lotNo,
                reason: t.reject.refused,
                body: t.reject.failed,
              }
            : rejectLineOf(each.lotNo, record.error),
        );
      }
    }

    /* 보낸 라벨의 「오프라인」 · 「이미 전송 대기」 줄은 이제 사실이 아니다 — 내린다(G1). */
    const sentLotNos = new Set(settled.map((each) => each.lotNo));
    setLines((previous) =>
      previous.filter(
        (line) =>
          !sentLotNos.has(line.lotNo) ||
          !(
            line.kind === 'offline' ||
            (line.kind === 'reject' && line.reason === t.reject.alreadyQueued)
          ),
      ),
    );

    const done = new Set(settled.map((each) => each.key));
    setTracked((previous) => previous.filter((each) => !done.has(each.key)));
    if (registered + rejected > 0) {
      setNotice(t.offline.flushed(registered + rejected, registered, rejected));
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
        setNotice(t.unregistered.lastToast(detail.inboundLotNo));
      } else {
        setNotice(
          t.unregistered.toast(
            lotTail(lot.lotNo),
            detail.inboundLotNo,
            qtyText(after.receivedQty, detail.uomCode),
          ),
        );
      }
    } catch (cause) {
      reject(lot.lotNo, cause);
    } finally {
      setBusyId(null);
      refreshCard(detail.inboundLotId);
    }
  };

  const close = async (detail: InboundLotDetail): Promise<void> => {
    if (workerNo === null) return;

    setClosing(null);
    setBusyId(detail.inboundLotId);
    try {
      const closed = await closeReceipt(client, detail.inboundLotId, detail.versionNo, workerNo);

      setClosedHere((previous) => new Set([...previous, detail.inboundLotId]));
      setNotice(
        t.closeDialog.toast(
          detail.inboundLotNo,
          detail.inspectionRequired ? (closed.iqc?.requestNo ?? null) : null,
        ),
      );
    } catch (cause) {
      playErrorTone();
      pushLine({
        kind: 'reject',
        id: nextLineId(),
        lotNo: detail.inboundLotNo,
        reason: t.reject.refused,
        body: serverMessageOf(toApiError(cause)) ?? t.closeDialog.failed,
      });
    } finally {
      setBusyId(null);
      refreshCard(detail.inboundLotId);
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
      setNotice(
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
        pushLine({
          kind: 'closed',
          id: nextLineId(),
          lotNo: lot.lotNo,
          inboundLotNo: detail.inboundLotNo,
        });
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

  return (
    <div className="receive">
      {autoClosed === null ? null : (
        <p className="receive__banner" role="status">
          <Icon name="event" size={18} />
          {t.autoClosed(autoClosed)}
        </p>
      )}

      <ScanZone
        field={scanField}
        label={t.scan.label}
        prompt={t.scan.prompt}
        tools={
          <IconButton
            icon={scanField.manual ? 'keyboard_return' : 'keyboard'}
            size="lg"
            aria-label={scanField.manual ? t.scan.manualSubmit : t.scan.manual}
            onClick={scanField.manual ? scanField.submitManual : scanField.openManual}
          />
        }
      />

      {notice === null ? null : (
        <p className="receive__notice" role="status">
          {notice}
        </p>
      )}

      {lines.length === 0 ? null : (
        <ul className="receive__lines" aria-label={t.scan.results}>
          {lines.map((line) => (
            <li key={line.id} className="receive-line" data-kind={line.kind}>
              {line.kind === 'ok' ? (
                <>
                  <Icon name="check_circle" size={18} />
                  <span>
                    {t.result.registered(lotTail(line.lotNo))} →{' '}
                    {line.created
                      ? t.result.created(line.inboundLotNo)
                      : t.result.added(line.inboundLotNo, line.count)}
                    {line.fromSupplierLabel ? (
                      <span className="receive-line__sub">{t.result.supplierLabel}</span>
                    ) : null}
                  </span>
                </>
              ) : line.kind === 'offline' ? (
                <>
                  <Icon name="cloud_off" size={18} />
                  <span>
                    <strong>{lotTail(line.lotNo)}</strong>
                    <span className="receive-line__sub">{t.offline.scanned}</span>
                  </span>
                </>
              ) : line.kind === 'closed' ? (
                <>
                  <Icon name="block" size={18} />
                  <span>
                    <strong>{t.reject.closedTitle(lotTail(line.lotNo))}</strong>
                    <span className="receive-line__sub">
                      {t.reject.closedBody(line.inboundLotNo)}
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <Icon name="block" size={18} />
                  <span>
                    <strong>{t.reject.title(line.reason, lotTail(line.lotNo))}</strong>
                    <span className="receive-line__sub">{line.body}</span>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {pendingLotNos.length === 0 ? null : (
        <section className="receive__pending" aria-label={t.offline.title(pendingLotNos.length)}>
          <p className="receive__pending-head">
            <strong>{t.offline.title(pendingLotNos.length)}</strong> {t.offline.sub}
          </p>
          <ul>
            {pendingLotNos.map((lotNo) => (
              <li key={lotNo}>
                <span className="receive-lot__no">{lotNo}</span> <span>{t.offline.chip}</span>
              </li>
            ))}
          </ul>
          <p className="receive-card__note">{t.offline.note}</p>
        </section>
      )}

      <section className="receive__cards" aria-label={t.cards.title(cards.length)}>
        <h2 className="receive__cards-head">
          {t.cards.title(cards.length)} <small>{t.cards.sub}</small>
        </h2>
        {cards.length === 0 ? <p className="receive-card__note">{t.cards.empty}</p> : null}
        {cards.map((card) => {
          const detail = details.get(card.inboundLotId);
          const data = detail?.data;
          const pairCount =
            data === undefined
              ? 0
              : pendingCountFor(pending, {
                  itemCode: data.itemCode,
                  supplierCode: data.supplierCode,
                });

          return (
            <InboundLotCard
              key={card.inboundLotId}
              card={card}
              detail={detail}
              lock={cardLockOf(online, pairCount)}
              pendingCount={pairCount}
              busy={busyId === card.inboundLotId}
              closedHere={closedHere.has(card.inboundLotId)}
              onUnregister={(lot) => {
                if (data !== undefined) void unregister(data, lot);
              }}
              onEditSupplierLot={(lot) => {
                if (data === undefined) return;
                setSheetError(null);
                setSheet({ detail: data, lot });
              }}
              onClose={() => {
                if (data !== undefined) setClosing(data);
              }}
            />
          );
        })}
        <p className="receive-card__note">{t.cards.splitHint}</p>
        <p className="receive-card__note">{t.cards.stayHint}</p>
      </section>

      <ConfirmDialog
        open={closing !== null}
        title={closing === null ? '' : t.closeDialog.title(closing.inboundLotNo)}
        cancelLabel={t.closeDialog.cancel}
        proceedLabel={t.closeDialog.confirm}
        onCancel={() => {
          setClosing(null);
        }}
        onProceed={() => {
          if (closing !== null) void close(closing);
        }}
      >
        {closing === null ? null : (
          <>
            <p>
              {t.closeDialog.summary(
                closing.supplierName,
                `${closing.itemCode} ${closing.itemName}`,
                closing.lotCount,
                qtyText(closing.receivedQty, closing.uomCode),
              )}
            </p>
            <p>
              {/* 「검사 생략」으로 남는 것은 기본 생략 기준이 걸릴 때만(G2 L15 · US2-7). */}
              {closing.inspectionRequired
                ? t.closeDialog.body
                : closing.iqcDefaultSkipApplies === true
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
