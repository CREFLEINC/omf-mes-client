import { AlertBanner, useToast } from '@crefle/web-ui';
import type {
  InboundLot,
  InboundLotClosed,
  InboundLotDetail,
  InboundLotMaterialLot,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { keepHyphens } from '../../patterns/keep-hyphens';
import { useBackStep } from '../../patterns/back-step';
import { Button } from '../../patterns/button';
import { ConfirmDialog } from '../../patterns/confirm-dialog';
import { FailureBanner } from '../../patterns/failure-banner';
import { useLoadFailure } from '../../patterns/load-failure';
import { useOnlineStatus } from '../../patterns/online-status';
import { currentPlantId } from '../../patterns/plant';
import { toApiError } from '../../patterns/request';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import {
  formatQty,
  inboundTail,
  isStateLocked,
  isVersionConflict,
  lotTail,
  openBlockerAfterConflict,
  openBlockerOf,
  reopenBlockersOf,
  type OpenBlocker,
  reopenReasonOf,
  shortWhen,
} from './close';
import {
  closeReceipt,
  inboundCloseKeys,
  reopenReceipt,
  unregisterLots,
  useClosableLots,
  useInboundLotDetail,
  useReopenableLots,
} from './queries';
import { CloseSheet } from './close-sheet';
import { DoneTable, OpenTable } from './close-tables';
import './screen.css';

const t = messages.inboundClose;

/** 마감 줄 — 「날짜 바뀜 자동 마감 11-11 00:00 · IQC-…」. */
const closedText = (lot: InboundLot): string => {
  /* 날짜와 시각 사이에서 줄이 꺾이지 않게(「11-11」 / 「00:00」). */
  const when = keepHyphens(shortWhen(lot.receivedClosedAt)).replace(' ', '\u00a0');
  const closed = lot.closedAutomatically ? t.done.closedAuto(when) : t.done.closed(when);

  return lot.iqc?.requestNo == null ? closed : t.card.withIqc(closed, lot.iqc.requestNo);
};

/** 목록 위에 「입하 품목」 시트를 띄웠나. 마감 결과 화면은 없앴다 — 알림 한 줄과 표의 초록 줄로 대신한다(사용자 결정 2026-11-20). */
type View = { kind: 'list' } | { kind: 'detail'; inboundLotId: number };

/** 마감 결과 한 줄 — 「입하 완료 — IQC 요청이 생겼습니다(…)」. */
const closedHeadline = (closed: InboundLotClosed): string =>
  !closed.inspectionRequired
    ? t.result.noInspection
    : closed.iqc?.requestNo == null
      ? t.result.withIqcNoNumber
      : t.result.withIqc(closed.iqc.requestNo);

type Dialog =
  | { kind: 'unregister'; lot: InboundLotMaterialLot }
  | { kind: 'close' }
  | { kind: 'reopen'; target: InboundLot }
  | { kind: 'blocked'; target: InboundLot; codes: string[]; openLot: OpenBlocker | null }
  | null;

/**
 * `M-01-03` 입하 마감(PDA · 005 · omf-all-around#254 · screens/M-01-03.md).
 *
 * ```
 * ←  입하 마감
 * 입하 중 (마감 대상) N          ← closable=true — 누르면 상세(LOT · 해제 · 마감)
 * 입하 완료 · 마감 취소 가능 N    ← reopenable=true — [마감 취소]
 * ```
 *
 * ⭐ 온라인에서만 쓴다 — 마감 · 해제 · 마감 취소 모두 바로 부르는 API 다(아웃박스에 담지 않는다).
 * ⭐ 부분 입하 사유는 묻지 않는다. P/O 매칭 결과는 작업자에게 보이지 않는다(설계 변경 1 · 3).
 * ⭐ 경과일 강조는 없다 — 공장 날짜가 바뀌면 시스템이 자동 마감한다(「자동 마감」 칩).
 */
export const InboundCloseScreen = () => {
  useScreenTitle(t.title);
  const failureText = useLoadFailure();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { client } = useApiClient();
  const { worker } = useWorkerSession();
  const online = useOnlineStatus();
  const plantId = currentPlantId();

  const [view, setView] = useState<View>({ kind: 'list' });
  const [dialog, setDialog] = useState<Dialog>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  /* 같은 틱에 두 번 누른 것을 막는다 — 상태는 다음 그리기에서야 바뀐다. */
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  /** 방금 마감한 입하 LOT — 「마감 취소 가능」 표의 그 줄을 초록으로. */
  const [justClosedId, setJustClosedId] = useState<number | null>(null);

  const closable = useClosableLots(plantId);
  const reopenable = useReopenableLots(plantId);
  const detail = useInboundLotDetail(view.kind === 'detail' ? view.inboundLotId : null);

  const lockReason = !online ? t.offline : worker === null ? t.noWorker : null;
  const receiving = closable.data ?? [];

  useBackStep(view.kind !== 'list', () => {
    setView({ kind: 'list' });
    setDialog(null);
  });

  const refresh = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: inboundCloseKeys.all });
  };

  /** 쓰기 하나를 돌린다 — 실패는 그 자리에서 말하고 목록을 다시 받는다. */
  const run = async (
    task: (workerNo: string) => Promise<void>,
    onError?: (error: ReturnType<typeof toApiError>) => boolean,
  ): Promise<void> => {
    if (worker === null || !online || busy.current) return;

    busy.current = true;
    setSaving(true);
    setActionError(null);
    try {
      await task(worker.workerNo);
    } catch (cause) {
      const error = toApiError(cause);

      if (onError?.(error) !== true) {
        setDialog(null);
        setActionError(
          isVersionConflict(error)
            ? t.errors.conflict
            : isStateLocked(error)
              ? t.errors.stateLocked
              : t.errors.failed,
        );
      }

      await refresh();
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const confirmUnregister = (target: InboundLotDetail, lot: InboundLotMaterialLot): void => {
    void run(async (workerNo) => {
      const after = await unregisterLots(
        client,
        target.inboundLotId,
        { lotIds: [lot.lotId], versionNo: target.versionNo },
        workerNo,
      );

      setDialog(null);
      await refresh();

      if (after.statusCode === 'VOIDED') {
        setView({ kind: 'list' });
        toast.show({
          variant: 'success',
          description: t.unregisterDialog.lastDone(target.inboundLotNo),
        });
      } else {
        toast.show({
          variant: 'success',
          description: t.unregisterDialog.done(lotTail(lot.lotNo)),
        });
      }
    });
  };

  const confirmClose = (target: InboundLotDetail): void => {
    void run(async (workerNo) => {
      const closed = await closeReceipt(client, target.inboundLotId, target.versionNo, workerNo);

      setDialog(null);
      await refresh();
      setView({ kind: 'list' });
      setJustClosedId(closed.inboundLotId);
      toast.show({ variant: 'success', description: closedHeadline(closed) });
    });
  };

  const confirmReopen = (target: InboundLot): void => {
    void run(
      async (workerNo) => {
        await reopenReceipt(client, target.inboundLotId, target.versionNo, workerNo);
        setDialog(null);
        await refresh();
        toast.show({ variant: 'success', description: t.reopenDialog.done(target.inboundLotNo) });
      },
      (error) => {
        const codes = reopenBlockersOf(error);

        if (codes.length === 0) return false;

        setDialog({
          kind: 'blocked',
          target,
          codes,
          openLot: openBlockerAfterConflict(target, receiving),
        });

        return true;
      },
    );
  };

  /** [마감 취소] — 같은 공급사·품목이 입하 중이면 묻지 않고 막힘 창을 연다(목록에서 이미 안다). */
  const askReopen = (target: InboundLot): void => {
    const blocker = openBlockerOf(target, receiving);

    setActionError(null);
    setDialog(
      blocker === null
        ? { kind: 'reopen', target }
        : { kind: 'blocked', target, codes: ['OPEN_RECEIPT_EXISTS'], openLot: blocker },
    );
  };

  const openDetail = (inboundLotId: number): void => {
    setActionError(null);
    setDialog(null);
    setJustClosedId(null);
    setView({ kind: 'detail', inboundLotId });
  };

  const notices = (
    <>
      {online ? null : <AlertBanner variant="warning" title={t.offline} />}
      {actionError === null ? null : <AlertBanner variant="error" title={actionError} />}
    </>
  );

  const blockedDialog =
    dialog?.kind === 'blocked' ? (
      <BlockedDialog
        dialog={dialog}
        onClose={() => {
          setDialog(null);
        }}
        onOpen={(id) => {
          openDetail(id);
        }}
      />
    ) : null;

  if (plantId === null) {
    return (
      <div className="inbound-close">
        <AlertBanner variant="warning" title={t.noPlant} />
      </div>
    );
  }

  const target = view.kind === 'detail' ? detail.data : undefined;
  const isOpen = target?.statusCode === 'RECEIVING';

  const sheetPart =
    view.kind !== 'detail' ? null : (
      <>
        {detail.isError ? (
          <FailureBanner variant="error" title={failureText(detail.error, t.errors.loadFailed)} />
        ) : null}
        {detail.isPending ? <p role="status">{t.detail.loading}</p> : null}
        {target !== undefined && !isOpen ? (
          <AlertBanner variant="warning" title={t.detail.gone} />
        ) : null}
        {target === undefined || !isOpen ? null : (
          <>
            {dialog === null ? (
              <CloseSheet
                target={target}
                lockReason={lockReason}
                saving={saving}
                onUnregister={(lot) => {
                  setActionError(null);
                  setDialog({ kind: 'unregister', lot });
                }}
                onClose={() => {
                  setActionError(null);
                  setDialog({ kind: 'close' });
                }}
                onDismiss={() => {
                  setView({ kind: 'list' });
                }}
              />
            ) : null}
            <ConfirmDialog
              open={dialog?.kind === 'close'}
              title={t.closeDialog.title(target.inboundLotNo)}
              cancelLabel={t.closeDialog.cancel}
              proceedLabel={t.closeDialog.proceed}
              onCancel={() => {
                setDialog(null);
              }}
              onProceed={() => {
                confirmClose(target);
              }}
            >
              <p className="inbound-close__text">
                {`${t.closeDialog.total(target.lots.length, formatQty(target.receivedQty, target.uomCode))} ${
                  /* 「검사 생략」으로 남는 것은 기본 생략 기준이 걸릴 때만(G2 L15 · US2-7). */
                  target.inspectionRequired
                    ? t.closeDialog.withIqc
                    : target.iqcDefaultSkipApplies === true
                      ? t.closeDialog.withoutIqc
                      : t.closeDialog.withoutIqcRecord
                }${t.closeDialog.rest}`}
              </p>
            </ConfirmDialog>
            {dialog?.kind === 'unregister' ? (
              <ConfirmDialog
                open
                title={t.unregisterDialog.title}
                cancelLabel={t.unregisterDialog.cancel}
                proceedLabel={t.unregisterDialog.proceed}
                onCancel={() => {
                  setDialog(null);
                }}
                onProceed={() => {
                  confirmUnregister(target, dialog.lot);
                }}
              >
                <p className="inbound-close__mono">{dialog.lot.lotNo}</p>
                <p className="inbound-close__text">
                  {t.unregisterDialog.body(formatQty(dialog.lot.lotQty, target.uomCode))}
                </p>
                {target.lots.length === 1 ? (
                  <AlertBanner variant="warning" title={t.unregisterDialog.last} />
                ) : null}
              </ConfirmDialog>
            ) : null}
          </>
        )}
      </>
    );

  const done = reopenable.data ?? [];
  const loadError = closable.error ?? reopenable.error;

  return (
    <div className="inbound-close">
      {notices}
      {loadError === null ? null : (
        <FailureBanner variant="error" title={failureText(loadError, t.errors.loadFailed)}>
          <Button variant="outlined" size="lg" onClick={() => void refresh()}>
            {t.errors.retry}
          </Button>
        </FailureBanner>
      )}

      <section className="inbound-close__section" aria-label={t.open.heading(receiving.length)}>
        <h2 className="inbound-close__heading">{t.open.heading(receiving.length)}</h2>
        {closable.data !== undefined && receiving.length === 0 ? (
          <p className="inbound-close__dim">{t.open.empty}</p>
        ) : null}
        {receiving.length === 0 ? null : <OpenTable lots={receiving} onOpen={openDetail} />}
      </section>

      <section className="inbound-close__section" aria-label={t.done.heading(done.length)}>
        <h2 className="inbound-close__heading">{t.done.heading(done.length)}</h2>
        {reopenable.data !== undefined && done.length === 0 ? (
          <p className="inbound-close__dim">{t.done.empty}</p>
        ) : null}
        {done.length === 0 ? null : (
          <DoneTable
            lots={done}
            currentId={justClosedId}
            reasonOf={(lot) => t.done.reason[reopenReasonOf(lot)].chip}
            closedTextOf={closedText}
            blockerOf={(lot) => {
              const blocker = openBlockerOf(lot, receiving);

              return blocker === null ? null : t.done.blocked(blocker.inboundLotNo);
            }}
            locked={lockReason !== null}
            onReopen={askReopen}
          />
        )}
      </section>

      {sheetPart}

      {dialog?.kind === 'reopen' ? (
        <ConfirmDialog
          open
          title={t.reopenDialog.title}
          cancelLabel={t.reopenDialog.cancel}
          proceedLabel={t.reopenDialog.proceed}
          onCancel={() => {
            setDialog(null);
          }}
          onProceed={() => {
            confirmReopen(dialog.target);
          }}
        >
          <p className="inbound-close__mono">
            {t.card.lotItem(
              dialog.target.inboundLotNo,
              `${dialog.target.itemCode} ${dialog.target.itemName}`,
            )}
          </p>
          <AlertBanner
            variant="info"
            title={t.reopenDialog.effect[reopenReasonOf(dialog.target)](
              dialog.target.iqc?.requestNo ?? '',
            )}
          />
        </ConfirmDialog>
      ) : null}
      {blockedDialog}
    </div>
  );
};

/** 마감 취소 막힘 창 — 같은 공급사·품목 입하 중이면 그것을 열 단추를 둔다. */
const BlockedDialog = ({
  dialog,
  onClose,
  onOpen,
}: {
  dialog: Extract<Dialog, { kind: 'blocked' }>;
  onClose: () => void;
  onOpen: (inboundLotId: number) => void;
}) => {
  const { target, codes, openLot } = dialog;
  const lines = codes.flatMap((code) => {
    if (code === 'OPEN_RECEIPT_EXISTS') {
      return openLot === null
        ? []
        : [t.blockedDialog.openReceipt(target.supplierName, target.itemCode, openLot.inboundLotNo)];
    }

    const text = t.blockedDialog.codes[code];

    return text === undefined ? [] : [text];
  });

  return (
    <ConfirmDialog
      open
      title={t.blockedDialog.title}
      cancelLabel={t.blockedDialog.close}
      proceedLabel={
        openLot?.inboundLotId == null
          ? t.blockedDialog.close
          : t.card.open(inboundTail(openLot.inboundLotNo))
      }
      onCancel={onClose}
      onProceed={() => {
        if (openLot?.inboundLotId == null) onClose();
        else onOpen(openLot.inboundLotId);
      }}
    >
      <p className="inbound-close__mono">
        {t.card.lotItem(target.inboundLotNo, `${target.itemCode} ${target.itemName}`)}
      </p>
      {(lines.length === 0 ? [t.blockedDialog.other] : lines).map((line) => (
        <AlertBanner key={line} variant="warning" title={line} />
      ))}
    </ConfirmDialog>
  );
};
