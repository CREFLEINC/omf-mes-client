import { AlertBanner, Button, Chip, Dialog, Icon, Skeleton } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { LoadErrorAlert } from '../../patterns/load-error-banner';
import { AllocationSection } from './allocation-editor';
import type { WorkRecordDetail } from './forward-contract';
import { useWorkRecordDetail } from './queries';
import { formatAt, formatQty, materialLotStatus, reasonOf, viewOf, type View } from './types';

const t = messages.inboundWorkRecord;
const td = t.detail;

const StatusChips = ({ detail }: { detail: WorkRecordDetail }) => {
  const view = viewOf(detail);
  return (
    <span className="iwr-chips">
      {view === 'final' ? (
        <Chip size="sm" status="idle" leadingIcon={<Icon name="lock" size={14} aria-hidden />}>
          {td.status.final}
        </Chip>
      ) : view === 'ready' ? (
        <Chip size="sm" status="success">
          {td.status.ready}
        </Chip>
      ) : (
        <Chip size="sm" status="warning">
          {td.status.prog}
        </Chip>
      )}
      {detail.closedAutomatically && (
        <Chip size="sm" status="idle">
          {t.list.autoClosed}
        </Chip>
      )}
    </span>
  );
};

/** 머리 아래 사실 칸(공급사 · 품목 · 입하일 · 입하 마감 · 입하 수량 · 입고 수량). */
const Facts = ({ detail }: { detail: WorkRecordDetail }) => {
  const closedAt = formatAt(detail.receivedClosedAt);
  return (
    <dl className="iwr-facts">
      <dt>{td.supplier}</dt>
      <dd>
        {detail.supplierName} <span className="iwr-code">{detail.supplierCode}</span>
      </dd>
      <dt>{td.itemCode}</dt>
      <dd>
        <span className="iwr-code">{detail.itemCode}</span>
      </dd>
      <dt>{td.itemName}</dt>
      <dd>{detail.itemName}</dd>
      <dt>{td.receivingDate}</dt>
      <dd>{detail.receivingDate}</dd>
      <dt>{td.receiptClosed}</dt>
      <dd>
        {closedAt === null ? (
          <span className="field-note">{td.notClosed}</span>
        ) : (
          `${closedAt}${detail.closedAutomatically ? td.autoClosedSuffix : ''}`
        )}
      </dd>
      <dt>{td.receivedQty}</dt>
      <dd>{td.receivedValue(formatQty(detail.receivedQty), detail.uomCode, detail.lotCount)}</dd>
      <dt>{td.goodsReceivedQty}</dt>
      <dd>
        {formatQty(detail.goodsReceivedQty)} {detail.uomCode}
      </dd>
    </dl>
  );
};

const LotsSection = ({ detail }: { detail: WorkRecordDetail }) => (
  <section className="iwr-section" aria-label={td.lotsLabel}>
    <h3 className="iwr-section-title">{td.lotsTitle(detail.lots.length)}</h3>
    <div className="iwr-table-scroll">
      <table className="iwr-table" aria-label={td.lotsLabel}>
        <thead>
          <tr>
            <th scope="col">{td.lotColumns.lotNo}</th>
            <th scope="col" className="is-number">
              {td.lotColumns.qty}
            </th>
            <th scope="col">{td.lotColumns.status}</th>
          </tr>
        </thead>
        <tbody>
          {detail.lots.map((lot) => {
            const status = materialLotStatus(lot, detail.statusCode, detail.finalizeBlockers ?? []);
            return (
              <tr key={lot.lotId}>
                <td className="iwr-code">{lot.lotNo}</td>
                <td className="is-number">
                  {formatQty(lot.lotQty)} <span className="iwr-unit">{detail.uomCode}</span>
                </td>
                <td>
                  <Chip size="sm" status={status.status}>
                    {status.label}
                  </Chip>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </section>
);

const footerOf = (
  view: View,
  editing: boolean,
  lockId: string,
  onClose: () => void,
  onFinalize: () => void,
) => (
  <div className="iwr-drawer-foot">
    {/* 진행 중의 막힘 이유는 본문 머리 띠가 이미 말한다 — 바닥에 같은 말을 또 적지 않는다. */}
    {view === 'ready' && editing && (
      <span id={lockId} className="field-note">
        {td.finalizeLockedByEdit}
      </span>
    )}
    <span className="iwr-drawer-foot-actions">
      <Button variant="outlined" onClick={onClose}>
        {td.close}
      </Button>
      {view === 'ready' && (
        <Button
          disabled={editing}
          aria-describedby={editing ? lockId : undefined}
          leadingIcon={<Icon name="lock" size={18} aria-hidden />}
          onClick={onFinalize}
        >
          {td.finalize}
        </Button>
      )}
    </span>
  </div>
);

/**
 * 입하 LOT 상세(오른쪽 덮개 · screens/W-01-16.md 「상세」). 최종 마감이면 읽기 전용(🔒 문구), 진행 중이면 막힘 이유,
 * 마감 승인 대기면 [최종 마감]. ⛔ 「ERP 구매입고: …」 표시와 [ERP 반영] 흉내는 두지 않는다(#265).
 */
export const DetailPanel = ({
  inboundLotId,
  onClose,
  onFinalize,
}: {
  inboundLotId: number;
  onClose: () => void;
  onFinalize: (detail: WorkRecordDetail) => void;
}) => {
  const detail = useWorkRecordDetail(inboundLotId);
  const lockId = useId();
  const [editing, setEditing] = useState(false);

  const data = detail.data;
  const view = data === undefined ? null : viewOf(data);

  const body = () => {
    if (detail.isError)
      return <LoadErrorAlert error={detail.error} onRetry={() => void detail.refetch()} />;
    if (data === undefined) return <Skeleton variant="rect" height="16rem" />;
    const finalizedAt = formatAt(data.finalizedAt) ?? '—';
    return (
      <div className="iwr-drawer-body">
        <StatusChips detail={data} />
        <Facts detail={data} />
        {view === 'final' && (
          <AlertBanner variant="info" icon="lock" className="iwr-lock-banner">
            {data.finalizedByName == null
              ? td.finalizedNoName(finalizedAt)
              : td.finalized(finalizedAt, data.finalizedByName)}
          </AlertBanner>
        )}
        {view === 'prog' && (
          <AlertBanner
            variant="warning"
            icon="hourglass_top"
            title={td.blocked(reasonOf(data, data.finalizeBlockers))}
          />
        )}
        <AllocationSection key={data.versionNo} detail={data} onEditingChange={setEditing} />
        <LotsSection detail={data} />
      </div>
    );
  };

  return (
    <Dialog
      open
      placement="right"
      size="lg"
      className="detail-drawer iwr-drawer"
      title={<span className="iwr-code">{data?.inboundLotNo ?? ''}</span>}
      /*
       * X 닫기 단추는 두지 않는다(사용자 지시 2026-11-27) — 단추 줄의 [닫기] · Esc 로 닫는다. 단추 줄이 아직 없는
       * 동안(불러오는 중 · 실패)만 닫을 길이 사라지지 않게 X 를 남긴다.
       */
      showCloseButton={data === undefined || view === null}
      onClose={onClose}
      footer={
        data === undefined || view === null
          ? undefined
          : footerOf(view, editing, lockId, onClose, () => onFinalize(data))
      }
    >
      {body()}
    </Dialog>
  );
};
