import { AlertBanner, Icon, IconButton } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { BottomActionBar } from '../../patterns/bottom-action-bar';
import { createIdempotencyKey } from '../../patterns/outbox';
import { plantShortDateTime } from '../../patterns/plant-time';
import { toApiError } from '../../patterns/request';
import { signal } from '../../patterns/scan-feedback';
import { ScanZone } from '../../patterns/scan-zone';
import { useScreenTitle } from '../../patterns/screen-title';
import { useScanField } from '../../patterns/use-scan-field';
import { useWorkerSession } from '../../patterns/worker-session';
import { confirmFailureOf, lotOf, roleOf, type SplitRole } from './confirm';
import { useConfirmSplit, useFindSplit, type ProductLotSplit } from './queries';
import './screen.css';

const t = messages.productLotSplitConfirm;

/** 결과 띠 — 한 번에 하나. */
type Notice =
  | { kind: 'half'; scanned: SplitRole }
  | { kind: 'done' }
  | { kind: 'wrong'; lotNo: string }
  | { kind: 'already'; split: ProductLotSplit | null }
  | { kind: 'none'; lotNo: string }
  | { kind: 'offline'; retry: () => void }
  | { kind: 'failed' };

/**
 * `M-04-05` LOT 분리 확인 (PDA · 피처 013 · omf-all-around#303 · 시안 M0405 승인 2026-11-20).
 *
 * 라벨 하나를 스캔하면 그 분리의 원래 · 새 LOT 두 칸이 서고, 남은 한 장을 스캔하면 `:confirm` 한 번으로 확인된다.
 * 순서는 상관없다. 한 장만 스캔한 중간 상태는 서버에 남기지 않는다 — 나가면 처음부터 한다.
 *
 * ⭐ 첫 스캔이 이미 확인된 분리면 바로 「이미 확인된 분리입니다」(시각 · 작업자).
 * ⭐ 같은 라벨을 두 번 스캔하면 무시한다. 짝이 아닌 라벨은 알리고 진행은 그대로 둔다.
 * ⛔ 온라인 전용 — 끊기면 [다시 시도]가 같은 멱등 키로 다시 보낸다.
 */
export const ProductLotSplitConfirmScreen = () => {
  useScreenTitle(t.title);

  const navigate = useNavigate();
  const { worker } = useWorkerSession();
  const find = useFindSplit();
  const confirm = useConfirmSplit();

  const [split, setSplit] = useState<ProductLotSplit | null>(null);
  const [scanned, setScanned] = useState<SplitRole | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  /* 보내는 동안 잠근다 — 스캐너가 같은 값을 잇달아 보내도 한 건만 나간다. */
  const inFlight = useRef(false);
  /* 확인 한 건에 키 하나. 응답을 받으면 버리고, 연결이 끊겼을 때만 같은 키로 다시 보낸다. */
  const confirmKey = useRef<{ splitId: number; key: string } | null>(null);

  const isSettled = notice?.kind === 'done' || notice?.kind === 'already';
  const inPair = split !== null && scanned !== null && !isSettled;

  const reset = (): void => {
    setSplit(null);
    setScanned(null);
    setNotice(null);
    confirmKey.current = null;
  };

  const keyFor = (target: ProductLotSplit): string => {
    if (confirmKey.current?.splitId !== target.productLotSplitId) {
      confirmKey.current = { splitId: target.productLotSplitId, key: createIdempotencyKey() };
    }
    return confirmKey.current.key;
  };

  const sendConfirm = async (target: ProductLotSplit, lotNo: string): Promise<void> => {
    if (worker === null || inFlight.current) return;

    inFlight.current = true;
    try {
      const result = await confirm.mutateAsync({
        split: target,
        lotIds: [target.parentLot.lotId, target.childLot.lotId],
        workerNo: worker.workerNo,
        idempotencyKey: keyFor(target),
      });
      confirmKey.current = null;
      setSplit(result);
      setNotice({ kind: 'done' });
      signal('confirm');
    } catch (error) {
      const failure = confirmFailureOf(toApiError(error));

      if (failure === 'offline') {
        setNotice({ kind: 'offline', retry: () => void sendConfirm(target, lotNo) });
        signal('reject');
        return;
      }
      confirmKey.current = null;
      if (failure === 'already') {
        setNotice({ kind: 'already', split: null });
        signal('warn');
      } else if (failure === 'wrong') {
        setNotice({ kind: 'wrong', lotNo });
        signal('reject');
      } else {
        setNotice({ kind: 'failed' });
        signal('reject');
      }
    } finally {
      inFlight.current = false;
    }
  };

  const lookup = async (lotNo: string): Promise<void> => {
    if (inFlight.current) return;

    inFlight.current = true;
    reset();
    try {
      const found = await find.mutateAsync(lotNo);
      const role = found === null ? null : roleOf(found, lotNo);

      if (found === null || role === null) {
        setNotice({ kind: 'none', lotNo });
        signal('reject');
      } else if (found.status === 'CONFIRMED') {
        setSplit(found);
        setNotice({ kind: 'already', split: found });
        signal('warn');
      } else {
        setSplit(found);
        setScanned(role);
        setNotice({ kind: 'half', scanned: role });
        signal('confirm');
      }
    } catch (error) {
      if (toApiError(error).kind === 'network') {
        setNotice({ kind: 'offline', retry: () => void lookup(lotNo) });
      } else {
        setNotice({ kind: 'failed' });
      }
      signal('reject');
    } finally {
      inFlight.current = false;
    }
  };

  const accept = (value: string): void => {
    const lotNo = value.trim();
    if (lotNo === '' || worker === null) return;

    if (!inPair) {
      void lookup(lotNo);
      return;
    }

    const role = roleOf(split, lotNo);
    /* 같은 라벨을 또 읽었다 — 아무것도 바꾸지 않는다. */
    if (role === scanned) return;
    if (role === null) {
      setNotice({ kind: 'wrong', lotNo });
      signal('reject');
      return;
    }
    void sendConfirm(split, lotNo);
  };

  const scanField = useScanField({ onScan: accept });
  const busy = find.isPending || confirm.isPending;

  const exit = { label: t.actions.exit, onClick: () => void navigate('/') };
  const bar =
    notice?.kind === 'offline' ? (
      <BottomActionBar
        primary={{ label: t.actions.retry, onClick: notice.retry, busy }}
        secondary={exit}
      />
    ) : isSettled ? (
      <BottomActionBar primary={{ label: t.actions.next, onClick: reset }} secondary={exit} />
    ) : inPair ? (
      <BottomActionBar secondary={{ label: t.actions.reset, onClick: reset, disabled: busy }} />
    ) : (
      <BottomActionBar secondary={exit} />
    );

  return (
    <div className="split-confirm">
      <div className="split-confirm__body">
        <p className="split-confirm__guide">{t.guide}</p>
        <ScanZone
          field={scanField}
          label={t.scan.label}
          prompt={t.scan.hint}
          standby={isSettled}
          tools={
            <IconButton
              icon={scanField.manual ? 'keyboard_return' : 'keyboard'}
              size="lg"
              aria-label={scanField.manual ? t.scan.manualSubmit : t.scan.manualLabel}
              onClick={scanField.manual ? scanField.submitManual : scanField.openManual}
            />
          }
        />
        <div role="status" className="split-confirm__status">
          {find.isPending ? <p>{t.scan.looking(find.variables)}</p> : null}
          {confirm.isPending ? <p>{t.scan.confirming}</p> : null}
        </div>
        {notice === null ? null : <NoticeBanner notice={notice} split={split} />}
        {split === null ? null : (
          <PairCard
            split={split}
            scanned={scanned}
            confirmed={isSettled || split.status === 'CONFIRMED'}
          />
        )}
      </div>
      {bar}
    </div>
  );
};

const qtyText = (qty: number, uomCode: string): string => `${String(qty)} ${uomCode}`;

const NoticeBanner = ({ notice, split }: { notice: Notice; split: ProductLotSplit | null }) => {
  const n = t.notice;

  switch (notice.kind) {
    case 'half': {
      if (split === null) return null;
      const uom = split.item.uomCode;
      return notice.scanned === 'child' ? (
        <AlertBanner variant="info" title={n.needParentTitle}>
          {n.needParent(qtyText(split.parentLot.qty, uom))}
        </AlertBanner>
      ) : (
        <AlertBanner variant="info" title={n.needChildTitle}>
          {n.needChild(qtyText(split.childLot.qty, uom))}
        </AlertBanner>
      );
    }
    case 'done':
      return (
        <AlertBanner variant="success" title={n.doneTitle}>
          {n.done}
        </AlertBanner>
      );
    case 'wrong':
      return (
        <AlertBanner variant="error" title={n.wrongTitle}>
          {n.wrong(notice.lotNo)}
        </AlertBanner>
      );
    case 'already':
      return (
        <AlertBanner variant="info" title={n.alreadyTitle}>
          {notice.split?.confirmedAt == null
            ? n.alreadyNoDetail
            : n.already(
                plantShortDateTime(notice.split.confirmedAt),
                notice.split.confirmedWorkerNo,
              )}
        </AlertBanner>
      );
    case 'none':
      return (
        <AlertBanner variant="error" title={n.noneTitle}>
          {n.none(notice.lotNo)}
        </AlertBanner>
      );
    case 'offline':
      return (
        <AlertBanner variant="warning" title={n.offlineTitle}>
          {n.offline}
        </AlertBanner>
      );
    case 'failed':
      return (
        <AlertBanner variant="error" title={n.failedTitle}>
          {n.failed}
        </AlertBanner>
      );
  }
};

/** 분리 두 칸 — 스캔한 쪽은 ✓ 와 「스캔함」, 남은 쪽은 「스캔 기다림」. 확인됐으면 둘 다 ✓. */
const PairCard = ({
  split,
  scanned,
  confirmed,
}: {
  split: ProductLotSplit;
  scanned: SplitRole | null;
  confirmed: boolean;
}) => {
  const p = t.pair;
  const uom = split.item.uomCode;
  const slots: { role: SplitRole; label: string }[] = [
    { role: 'parent', label: p.parent },
    { role: 'child', label: p.child },
  ];

  return (
    <section className="split-confirm__pair" aria-label={p.label}>
      <p className="split-confirm__pair-head">
        <span>{p.head(plantShortDateTime(split.splitAt), split.location.locationCode)}</span>
        <span>{split.item.itemCode}</span>
      </p>
      <ul className="split-confirm__slots">
        {slots.map(({ role, label }) => {
          const lot = lotOf(split, role);
          const isDone = confirmed || scanned === role;

          return (
            <li
              key={role}
              className="split-confirm__slot"
              data-done={isDone ? 'true' : 'false'}
              aria-label={`${label} ${isDone ? p.scanned : p.waiting}`}
            >
              <span className="split-confirm__mark" aria-hidden="true">
                <Icon name={isDone ? 'check' : 'inventory_2'} size={20} />
              </span>
              <span className="split-confirm__lot">
                <b>{label}</b>
                <span className="split-confirm__chip">{isDone ? p.scanned : p.waiting}</span>
                <span className="split-confirm__no">{lot.lotNo}</span>
              </span>
              <span className="split-confirm__qty">{qtyText(lot.qty, uom)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
