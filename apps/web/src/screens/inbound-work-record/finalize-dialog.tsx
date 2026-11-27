import { AlertBanner, Button, Checkbox, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import type { FinalizeBlocker, WorkRecordDetail, WorkRecordLot } from './forward-contract';
import { classifyFailure, finalizeInboundLot } from './mutations';
import { blockersText, formatQty } from './types';

const t = messages.inboundWorkRecord;
const tf = t.finalizeDialog;

type Failure = { text: string; reload: boolean } | null;

/**
 * 최종 마감 확인 창(screens/W-01-16.md 「최종 마감 확인 창」, 560). P/O 없음이 남으면 「그 수량은 ERP 로 가지 않습니다」를
 * 확인해야 [최종 마감]이 풀린다 → `acknowledgeUnallocated=true`(FR-049 — 시안에 없던 확인란).
 * 409 막힘이면 이유를 띄우고 상세를 다시 읽는다(`onReload` 가 새 막힘을 돌려준다).
 */
export const FinalizeDialog = ({
  detail,
  onClose,
  onFinalized,
  onReload,
}: {
  detail: WorkRecordDetail;
  onClose: () => void;
  onFinalized: (finalized: WorkRecordLot) => void;
  onReload: () => Promise<FinalizeBlocker[] | undefined>;
}) => {
  const { client } = useApiClient();
  const [acknowledged, setAcknowledged] = useState(false);
  const [unallocatedQty, setUnallocatedQty] = useState(detail.unallocatedQty);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure>(null);

  const needsAck = unallocatedQty > 0;
  const locked = needsAck && !acknowledged;

  const submit = async (): Promise<void> => {
    if (locked) return;
    setBusy(true);
    setFailure(null);
    try {
      const finalized = await finalizeInboundLot(
        client,
        detail.inboundLotId,
        detail.versionNo,
        needsAck && acknowledged,
      );
      onFinalized(finalized);
    } catch (cause) {
      const result = classifyFailure(cause);
      if (result.kind === 'unallocated') {
        /* 그사이 P/O 없음이 생겼다 — 같은 확인 줄을 띄우고 다시 확인받는다. */
        setUnallocatedQty(result.details?.unallocatedQty ?? Math.max(unallocatedQty, 1));
        setAcknowledged(false);
      } else if (result.kind === 'blocked') {
        const fresh = await onReload();
        const withLots = result.blockers.some((blocker) => blocker.lotNos.length > 0);
        const reason =
          blockersText(withLots ? result.blockers : fresh) ??
          blockersText(result.blockers) ??
          t.list.blockedUnknown;
        setFailure({ text: tf.blocked(reason), reload: false });
      } else if (result.kind === 'conflict') setFailure({ text: t.errors.conflict, reload: true });
      else if (result.kind === 'stateLocked')
        setFailure({ text: t.errors.stateLocked, reload: true });
      else setFailure({ text: tf.failed, reload: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      size="md"
      className="iwr-finalize-dialog"
      title={tf.title}
      onClose={onClose}
      footer={
        <div className="iwr-dialog-actions">
          <Button variant="outlined" disabled={busy} onClick={onClose}>
            {tf.cancel}
          </Button>
          <Button disabled={locked} loading={busy} onClick={() => void submit()}>
            {tf.confirm}
          </Button>
        </div>
      }
    >
      <div className="iwr-finalize-body">
        {/* 사용자 시안 2026-11-27 — LOT 번호 / 공급사 · 품목 / 수량 사실 상자 / 경고 하나(두 문장) / 상자 밖 체크칸. */}
        <p>
          <strong className="iwr-code iwr-finalize-lot">{detail.inboundLotNo}</strong>
        </p>
        <p>
          {detail.supplierName} <span className="iwr-code">{detail.itemCode}</span>{' '}
          {detail.itemName}
        </p>
        <dl className="confirm-facts">
          <div>
            <dt>{tf.receivedQty}</dt>
            <dd>{tf.qty(formatQty(detail.receivedQty), detail.uomCode)}</dd>
          </div>
          <div>
            <dt>{tf.goodsReceivedQty}</dt>
            <dd>{tf.qty(formatQty(detail.goodsReceivedQty), detail.uomCode)}</dd>
          </div>
        </dl>
        <AlertBanner variant="warning">
          {needsAck && (
            <>
              <span>{tf.unallocatedWarning(formatQty(unallocatedQty), detail.uomCode)}</span>
              <br />
            </>
          )}
          <span>{tf.warning}</span>
        </AlertBanner>
        {needsAck && (
          <Checkbox
            checked={acknowledged}
            disabled={busy}
            onChange={(event) => setAcknowledged(event.target.checked)}
          >
            {tf.acknowledge}
          </Checkbox>
        )}
        {failure !== null && (
          <AlertBanner
            variant="error"
            action={
              failure.reload ? (
                <Button
                  variant="text"
                  size="sm"
                  onClick={() => {
                    void onReload();
                    onClose();
                  }}
                >
                  {t.errors.reload}
                </Button>
              ) : undefined
            }
          >
            {failure.text}
          </AlertBanner>
        )}
      </div>
    </Dialog>
  );
};
