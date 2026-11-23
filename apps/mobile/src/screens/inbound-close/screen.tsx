import { AlertBanner, Tabs, useToast } from '@crefle/web-ui';
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
import { Words } from '../../patterns/words';
import {
  formatQty,
  fullWhen,
  isStateLocked,
  isVersionConflict,
  lotTail,
  openBlockerAfterConflict,
  openBlockerOf,
  reopenBlockersOf,
  type OpenBlocker,
  reopenReasonOf,
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
import '../../patterns/item-sheet.css';
import './screen.css';

const t = messages.inboundClose;

/**
 * 마감 취소 · 막힘 창의 이름표 칸 — 무엇을 취소하는지 이름표를 붙여 적는다(사용자 지시 2026-11-23 「명시적으로 항목
 * 타이틀」, 가운데 점으로 잇지 않는다). 품목 시트와 같은 모양이다.
 */
const LotFacts = ({ lot }: { lot: InboundLot }) => (
  <dl className="sheet-facts">
    <dt>{t.sheet.fields.itemCode}</dt>
    <dd className="sheet-facts__code">{lot.itemCode}</dd>
    <dt>{t.sheet.fields.itemName}</dt>
    <dd>
      <Words text={lot.itemName} />
    </dd>
    <dt>{t.sheet.fields.supplier}</dt>
    <dd>{lot.supplierName}</dd>
    <dt>{t.sheet.fields.qty}</dt>
    <dd>{t.sheet.summary(lot.lotCount, formatQty(lot.receivedQty, lot.uomCode))}</dd>
    <dt>{t.sheet.fields.closedAt}</dt>
    <dd>{fullWhen(lot.receivedClosedAt)}</dd>
  </dl>
);

/** 자재 관리 LOT 수의 합 — [전체 마감]의 이름 · 확인 창. */
const lotsOf = (lots: readonly InboundLot[]): number =>
  lots.reduce((sum, lot) => sum + lot.lotCount, 0);

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
  | { kind: 'closeAll' }
  | { kind: 'reopen'; target: InboundLot }
  | { kind: 'blocked'; target: InboundLot; codes: string[]; openLot: OpenBlocker | null }
  | null;

/**
 * `M-01-03` 입하 마감(PDA · 005 · omf-all-around#254 · screens/M-01-03.md).
 *
 * ```
 * ←  입하 마감
 * [ 입하 중 | 입하 완료 ]                 ← 탭
 * 입하 중:                    [전체 마감]   ← closable=true — No · 스캔 시각 · 품목 · LOT 수 · 수량, 줄을 누르면 상세
 * 입하 완료:                                ← reopenable=true — No · 마감 시각 · 품목 · 개수 · 수량 · [취소]
 * ```
 *
 * ⭐ 입하 중 · 입하 완료는 탭으로 가른다 — 한 화면에 이으면 입하 중이 많을 때 입하 완료가 밑에 깔린다(사용자 지시
 *    2026-11-23). 건수 · 「마감 대상」 · 「마감 취소 가능」은 적지 않는다.
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
  const [tab, setTab] = useState<'open' | 'done'>('open');
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

  /** [전체 마감] — 입하 중인 품목을 차례로. 하나라도 막히면 거기서 멈추고 까닭을 보인다(마감된 것은 목록이 보인다). */
  const confirmCloseAll = (targets: readonly InboundLot[]): void => {
    void run(async (workerNo) => {
      for (const lot of targets) {
        await closeReceipt(client, lot.inboundLotId, lot.versionNo, workerNo);
      }

      setDialog(null);
      await refresh();
      setJustClosedId(null);
      toast.show({ variant: 'success', description: t.closeAllDialog.done(targets.length) });
    });
  };

  const confirmReopen = (target: InboundLot): void => {
    void run(
      async (workerNo) => {
        await reopenReceipt(client, target.inboundLotId, target.versionNo, workerNo);
        setDialog(null);
        await refresh();
        toast.show({
          variant: 'success',
          description: t.reopenDialog.done(target.itemCode, target.itemName),
        });
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

  const openPanel = (
    <section className="inbound-close__section" aria-label={t.open.heading}>
      {receiving.length === 0 ? null : (
        <div className="inbound-close__tools">
          <Button
            variant="outlined"
            size="sm"
            className="inbound-close__close-all"
            aria-label={t.open.closeAllLabel(receiving.length, lotsOf(receiving))}
            disabled={lockReason !== null || saving}
            onClick={() => {
              setActionError(null);
              setDialog({ kind: 'closeAll' });
            }}
          >
            {t.open.closeAll}
          </Button>
        </div>
      )}
      {closable.data !== undefined && receiving.length === 0 ? (
        <p className="inbound-close__dim">{t.open.empty}</p>
      ) : null}
      {receiving.length === 0 ? null : <OpenTable lots={receiving} onOpen={openDetail} />}
    </section>
  );

  const donePanel = (
    <section className="inbound-close__section" aria-label={t.done.heading}>
      {reopenable.data !== undefined && done.length === 0 ? (
        <p className="inbound-close__dim">{t.done.empty}</p>
      ) : null}
      {done.length === 0 ? null : (
        <DoneTable
          lots={done}
          currentId={justClosedId}
          locked={lockReason !== null}
          onReopen={askReopen}
        />
      )}
    </section>
  );

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

      <Tabs
        aria-label={t.tabsLabel}
        value={tab}
        onChange={(value) => {
          setTab(value === 'done' ? 'done' : 'open');
        }}
        items={[
          { value: 'open', label: t.open.heading, content: tab === 'open' ? openPanel : null },
          { value: 'done', label: t.done.heading, content: tab === 'done' ? donePanel : null },
        ]}
      />

      {sheetPart}

      {dialog?.kind === 'closeAll' ? (
        <ConfirmDialog
          open
          title={t.closeAllDialog.title}
          cancelLabel={t.closeAllDialog.cancel}
          proceedLabel={t.closeAllDialog.proceed}
          onCancel={() => {
            setDialog(null);
          }}
          onProceed={() => {
            confirmCloseAll(receiving);
          }}
        >
          <p className="inbound-close__text">
            {`${t.closeAllDialog.summary(receiving.length, lotsOf(receiving))} ${t.closeAllDialog.body}`}
          </p>
        </ConfirmDialog>
      ) : null}

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
          <LotFacts lot={dialog.target} />
          <AlertBanner
            variant={reopenReasonOf(dialog.target) === 'IQC_SKIPPED' ? 'warning' : 'info'}
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

/** 마감 취소 막힘 창 — 무엇이 막혔는지 이름표 칸과 까닭. 같은 공급사·품목 입하 중이면 그것을 열 단추를 둔다. */
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
    if (code === 'OPEN_RECEIPT_EXISTS') return [t.blockedDialog.openReceipt];

    const text = t.blockedDialog.codes[code];

    return text === undefined ? [] : [text];
  });

  return (
    <ConfirmDialog
      open
      title={t.blockedDialog.title}
      cancelLabel={t.blockedDialog.close}
      proceedLabel={
        openLot?.inboundLotId == null ? t.blockedDialog.close : t.blockedDialog.openReceiving
      }
      onCancel={onClose}
      onProceed={() => {
        if (openLot?.inboundLotId == null) onClose();
        else onOpen(openLot.inboundLotId);
      }}
    >
      <LotFacts lot={target} />
      {(lines.length === 0 ? [t.blockedDialog.other] : lines).map((line) => (
        <AlertBanner key={line} variant="warning" title={line} />
      ))}
    </ConfirmDialog>
  );
};
