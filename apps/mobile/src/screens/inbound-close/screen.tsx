import { AlertBanner, Chip, Icon, IconButton, useToast } from '@crefle/web-ui';
import type {
  InboundLot,
  InboundLotClosed,
  InboundLotDetail,
  InboundLotMaterialLot,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { Fragment, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { useBackStep } from '../../patterns/back-step';
import { BottomActionBar } from '../../patterns/bottom-action-bar';
import { Button } from '../../patterns/button';
import { ConfirmDialog } from '../../patterns/confirm-dialog';
import { FailureBanner } from '../../patterns/failure-banner';
import { useLoadFailure } from '../../patterns/load-failure';
import { shortLotNos } from '../../patterns/lot-short-no';
import { useOnlineStatus } from '../../patterns/online-status';
import { currentPlantId } from '../../patterns/plant';
import { plantClock } from '../../patterns/plant-time';
import { toApiError } from '../../patterns/request';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import {
  formatQty,
  fullWhen,
  inboundTail,
  isStateLocked,
  isVersionConflict,
  lotTail,
  openBlockerAfterConflict,
  openBlockerOf,
  packageNameOf,
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
import '../../patterns/lot-table.css';
import './screen.css';

const t = messages.inboundClose;

/** 마감 줄 — 「날짜 바뀜 자동 마감 11-11 00:00 · IQC-…」. */
const closedText = (lot: InboundLot): string => {
  const when = shortWhen(lot.receivedClosedAt);
  const closed = lot.closedAutomatically ? t.done.closedAuto(when) : t.done.closed(when);

  return lot.iqc?.requestNo == null ? closed : t.card.withIqc(closed, lot.iqc.requestNo);
};

type View =
  | { kind: 'list' }
  | { kind: 'detail'; inboundLotId: number }
  | { kind: 'result'; closed: InboundLotClosed };

type Dialog =
  | { kind: 'unregister'; lot: InboundLotMaterialLot }
  | { kind: 'close' }
  | { kind: 'reopen'; target: InboundLot }
  | { kind: 'blocked'; target: InboundLot; codes: string[]; openLot: OpenBlocker | null }
  | null;

/**
 * 카드 안 이름표 붙은 칸 — 공급사 · 품목 · LOT 수 · 전체 수량 …(사용자 지시 2026-11-18 「명시적인 타이틀」).
 * 누르는 카드(단추) 안에도 들어가야 해서 `dl` 대신 `span` 으로 그린다. 넓은 칸(`wide`)은 한 줄을 다 쓰고, 값은 한 줄 말줄임.
 */
const CardFacts = ({
  rows,
}: {
  rows: readonly (readonly [label: string, value: string, wide?: boolean])[];
}) => (
  <span className="inbound-close__card-facts">
    {rows.map(([label, value, wide]) => (
      <Fragment key={label}>
        <span className="inbound-close__card-label">{label}</span>
        <span
          className={
            wide === true ? 'inbound-close__card-value is-wide' : 'inbound-close__card-value'
          }
        >
          {value}
        </span>
      </Fragment>
    ))}
  </span>
);

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
      setView({ kind: 'result', closed });
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

  if (view.kind === 'result') {
    const { closed } = view;
    const headline = !closed.inspectionRequired
      ? t.result.noInspection
      : closed.iqc?.requestNo == null
        ? t.result.withIqcNoNumber
        : t.result.withIqc(closed.iqc.requestNo);

    return (
      <div className="inbound-close">
        <div className="inbound-close__result" role="status">
          <Icon name="task_alt" size={28} />
          <strong>{headline}</strong>
        </div>
        <dl className="inbound-close__facts">
          <dt>{t.detail.inboundLot}</dt>
          <dd className="inbound-close__mono">{closed.inboundLotNo}</dd>
          <dt>{t.detail.lotCount}</dt>
          <dd>{t.card.lotCount(closed.lotCount)}</dd>
          <dt>{t.detail.totalQty}</dt>
          <dd>{formatQty(closed.receivedQty, closed.uomCode)}</dd>
        </dl>
        {closed.inspectionRequired ? <AlertBanner variant="info" title={t.result.notice} /> : null}
        <BottomActionBar
          primary={{
            label: t.result.back,
            onClick: () => {
              setView({ kind: 'list' });
            },
          }}
        />
      </div>
    );
  }

  if (view.kind === 'detail') {
    const target = detail.data;
    const isOpen = target?.statusCode === 'RECEIVING';
    const lots = target?.lots ?? [];
    const shortNos = shortLotNos(lots.map((lot) => lot.lotNo));

    return (
      <div className="inbound-close">
        {notices}
        {detail.isError ? (
          <FailureBanner variant="error" title={failureText(detail.error, t.errors.loadFailed)} />
        ) : null}
        {detail.isPending ? <p role="status">{t.detail.loading}</p> : null}
        {target !== undefined && !isOpen ? (
          <AlertBanner variant="warning" title={t.detail.gone} />
        ) : null}
        {target === undefined || !isOpen ? null : (
          <>
            <dl className="inbound-close__facts">
              <dt>{t.detail.inboundLot}</dt>
              <dd className="inbound-close__mono">{target.inboundLotNo}</dd>
              <dt>{t.detail.status}</dt>
              <dd>{t.detail.statusValue}</dd>
              <dt>{t.detail.supplier}</dt>
              <dd>
                {target.supplierName}{' '}
                <span className="inbound-close__mono inbound-close__dim">
                  {target.supplierCode}
                </span>
              </dd>
              <dt>{t.detail.item}</dt>
              <dd>
                <span className="inbound-close__mono">{target.itemCode}</span> {target.itemName}
              </dd>
              <dt>{t.detail.lotCount}</dt>
              <dd>{t.card.lotCount(target.lots.length)}</dd>
              <dt>{t.detail.totalQty}</dt>
              <dd>{formatQty(target.receivedQty, target.uomCode)}</dd>
              {target.inboundReceiptNo === null ? null : (
                <>
                  <dt>{t.detail.receiptNo}</dt>
                  <dd className="inbound-close__mono">{target.inboundReceiptNo}</dd>
                </>
              )}
              <dt>{t.detail.firstAt}</dt>
              <dd>{fullWhen(target.firstRegisteredAt)}</dd>
            </dl>
            {/* 품질(검사 대기 · 보류) 칩은 두지 않는다(사용자 지시 2026-11-18). */}
            <h2 className="inbound-close__heading">{t.detail.lots(target.lots.length)}</h2>
            {/*
             * 자재 관리 LOT 은 제목 아래 한 줄짜리 표 — 줄마다 테두리 상자를 두지 않는다(사용자 지시 2026-11-18 「목록과 계층으로
             * 깔끔하게」). 번호 칸은 번호 전체 대신 이 입하 LOT 안에서 가를 수 있는 끝 조각(보통 일련번호) — 번호 전체는 ✕ 를
             * 누르면 뜨는 확인 창에 있다. 예전에는 번호를 줄 폭 전체로 접어 썼다(G2 L20).
             */}
            <table className="lot-table" aria-label={t.detail.lots(target.lots.length)}>
              <thead>
                <tr>
                  <th scope="col">{t.detail.columns.no}</th>
                  <th scope="col">{t.detail.columns.qty}</th>
                  <th scope="col">{t.detail.columns.registered}</th>
                  <th scope="col" aria-label={t.detail.unregister} />
                </tr>
              </thead>
              <tbody>
                {target.lots.map((lot) => (
                  <tr key={lot.lotId}>
                    <td className="lot-table__no">{shortNos.get(lot.lotNo) ?? lot.lotNo}</td>
                    <td>
                      {formatQty(lot.lotQty, target.uomCode)}
                      {lot.package === null
                        ? ''
                        : t.detail.package(packageNameOf(lot.package), lot.package.count)}
                    </td>
                    <td className="lot-table__muted">{plantClock(lot.registeredAt)}</td>
                    <td className="lot-table__x">
                      <IconButton
                        icon="close"
                        size="md"
                        aria-label={t.detail.unregister}
                        disabled={lockReason !== null}
                        onClick={() => {
                          setActionError(null);
                          setDialog({ kind: 'unregister', lot });
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <BottomActionBar
              primary={{
                label: t.detail.close,
                busy: saving,
                disabled: lockReason !== null,
                ...(lockReason === null ? {} : { lockReason }),
                onClick: () => {
                  setActionError(null);
                  setDialog({ kind: 'close' });
                },
              }}
            />
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
        {blockedDialog}
      </div>
    );
  }

  if (plantId === null) {
    return (
      <div className="inbound-close">
        <AlertBanner variant="warning" title={t.noPlant} />
      </div>
    );
  }

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
        <ul className="inbound-close__cards">
          {receiving.map((lot) => (
            <li key={lot.inboundLotId}>
              <button
                type="button"
                className="inbound-close__card"
                onClick={() => {
                  openDetail(lot.inboundLotId);
                }}
              >
                <span className="inbound-close__row">
                  <strong className="inbound-close__mono">{lot.inboundLotNo}</strong>
                  <Chip status={lot.reopened ? 'error' : 'info'}>
                    {lot.reopened ? t.open.reopened : t.open.receiving}
                  </Chip>
                </span>
                <CardFacts
                  rows={[
                    [t.card.facts.supplier, lot.supplierName, true],
                    [t.card.facts.item, `${lot.itemCode} ${lot.itemName}`, true],
                    [t.card.facts.lotCount, t.card.lotCount(lot.lotCount)],
                    [t.card.facts.totalQty, formatQty(lot.receivedQty, lot.uomCode)],
                    [t.card.facts.firstAt, shortWhen(lot.firstRegisteredAt), true],
                  ]}
                />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="inbound-close__section" aria-label={t.done.heading(done.length)}>
        <h2 className="inbound-close__heading">{t.done.heading(done.length)}</h2>
        {reopenable.data !== undefined && done.length === 0 ? (
          <p className="inbound-close__dim">{t.done.empty}</p>
        ) : null}
        <ul className="inbound-close__cards">
          {done.map((lot) => {
            const reason = t.done.reason[reopenReasonOf(lot)];
            const blocker = openBlockerOf(lot, receiving);

            return (
              <li
                key={lot.inboundLotId}
                className="inbound-close__card inbound-close__card--static"
              >
                <span className="inbound-close__row">
                  <strong className="inbound-close__mono">{lot.inboundLotNo}</strong>
                  <span className="inbound-close__chips">
                    {lot.closedAutomatically ? <Chip>{t.done.autoChip}</Chip> : null}
                    <Chip status="info">{reason.chip}</Chip>
                  </span>
                </span>
                <CardFacts
                  rows={[
                    [t.card.facts.supplier, lot.supplierName, true],
                    [t.card.facts.item, `${lot.itemCode} ${lot.itemName}`, true],
                    [t.card.facts.lotCount, t.card.lotCount(lot.lotCount)],
                    [t.card.facts.totalQty, formatQty(lot.receivedQty, lot.uomCode)],
                    [t.card.facts.quality, reason.sub, true],
                  ]}
                />
                {blocker === null ? null : (
                  <span className="inbound-close__blocked">
                    <Icon name="lock" size={18} />
                    {t.done.blocked(blocker.inboundLotNo)}
                  </span>
                )}
                <span className="inbound-close__row inbound-close__row--one">
                  <span className="inbound-close__dim inbound-close__small">{closedText(lot)}</span>
                  <Button
                    variant="outlined"
                    size="lg"
                    disabled={lockReason !== null}
                    onClick={() => {
                      askReopen(lot);
                    }}
                  >
                    {t.done.reopen}
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

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
