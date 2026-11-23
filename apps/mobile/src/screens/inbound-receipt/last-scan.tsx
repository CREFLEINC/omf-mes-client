import { Icon, IconButton } from '@crefle/web-ui';
import type { InboundLotDetail } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { Button } from '../../patterns/button';
import { parseMaterialLotNo } from '../../patterns/material-lot-no';
import { qtyNumber } from './lot-format';
import type { ScanLine } from './receipt';
import '../../patterns/scan-result.css';
import { FitName } from '../../patterns/fit-name';

const t = messages.inboundReceipt;

export interface LastScanProps {
  line: ScanLine;
  /** 성공 줄 · 이미 찍은 줄의 입하 LOT — 품목코드 · 품목명을 여기서 읽는다(불러오는 중이면 undefined). */
  detail: InboundLotDetail | undefined;
  /** [취소]를 누를 수 있는가 — 입하 중 · 온라인 · 일하는 중 아님. */
  canUndo: boolean;
  onUndo: () => void;
  /** 머리 오른쪽 ✕ — 칸을 내린다. 등록 · 거부 결과는 그대로다. */
  onDismiss: () => void;
}

/**
 * 방금 찍은 라벨(사용자 지시 2026-11-20 「방금 찍은 바코드가 정말 맞는지」) — 품목코드 · 품목명 · 수량을 크게,
 * 번호 끝은 작게. 결과마다 바탕이 바뀐다: 등록 초록 · 이미 찍음 회색 · 전송 대기 노랑 · 거부 빨강.
 * 잘못 찍었으면 이 칸의 [취소] 한 번으로 되돌린다. 머리 오른쪽 끝 ✕ 가 칸을 내린다(사용자 지시 2026-11-23).
 * 「새 품목」 칩은 두지 않는다(사용자 지시 2026-11-23) — 품목이 바뀐 것은 경고음이 알린다.
 */
export const LastScan = ({ line, detail, canUndo, onUndo, onDismiss }: LastScanProps) => {
  const close = (
    <IconButton
      className="last-scan__close"
      icon="close"
      size="sm"
      aria-label={t.last.dismiss}
      onClick={onDismiss}
    />
  );

  if (line.kind === 'ok') {
    const parsed = parseMaterialLotNo(line.lotNo);
    const itemCode = detail?.itemCode ?? parsed?.itemCode ?? null;
    const uom = detail?.uomCode ?? '';

    return (
      <section className="last-scan" data-kind="ok" aria-label={t.last.ok}>
        <p className="last-scan__bar">
          <Icon name="check_circle" size={20} />
          <span>{t.last.ok}</span>
          <Button
            className="last-scan__undo"
            variant="outlined"
            size="sm"
            aria-label={t.last.undoLabel(line.lotNo)}
            disabled={!canUndo}
            onClick={onUndo}
          >
            {t.last.undo}
          </Button>
          {close}
        </p>
        <div className="last-scan__body">
          {itemCode === null ? null : <p className="last-scan__code">{itemCode}</p>}
          <p className="last-scan__name">
            {detail === undefined ? t.last.loading : <FitName text={detail.itemName} min={13} />}
          </p>
          {/* 수량은 크게 — 공급사는 표의 머리 줄에 있다(사용자 지시 2026-11-20 시안 A). */}
          {line.qty === null ? null : (
            <p className="last-scan__qty">
              {qtyNumber(line.qty)}
              <small>{uom}</small>
            </p>
          )}
          {/* 번호는 줄이지 않고 수량 아래 줄에 전체를 — 라벨과 대조한다(사용자 지시 2026-11-20). */}
          <p className="last-scan__lot">{line.lotNo}</p>
          {line.autoClosed ? <p className="last-scan__note">{t.last.autoClosed}</p> : null}
        </div>
      </section>
    );
  }

  /* 이미 찍은 라벨은 품목코드 품목명만 — 몇 번 줄인지 · 번호는 적지 않는다(사용자 지시 2026-11-23). 표의 그 줄이 회색으로 짚인다. */
  if (line.kind === 'duplicate') {
    return (
      <section className="last-scan" data-kind="duplicate" aria-label={t.last.duplicate}>
        <p className="last-scan__bar">
          <Icon name="info" size={20} />
          <span>{t.last.duplicate}</span>
          {close}
        </p>
        <div className="last-scan__body">
          <p className="last-scan__why">
            {detail === undefined ? line.lotNo : `${detail.itemCode} ${detail.itemName}`}
          </p>
        </div>
      </section>
    );
  }

  const [title, reason, body] =
    line.kind === 'offline'
      ? [t.last.offline, t.last.offlineBody, null]
      : line.kind === 'closed'
        ? [t.last.closed, t.last.closedBody, null]
        : [t.last.rejected, line.reason, line.body];

  return (
    <section className="last-scan" data-kind={line.kind} aria-label={title}>
      <p className="last-scan__bar">
        <Icon name={line.kind === 'offline' ? 'cloud_off' : 'block'} size={20} />
        <span>{title}</span>
        {close}
      </p>
      <div className="last-scan__body">
        <p className="last-scan__why">{reason}</p>
        {body === null ? null : <p className="last-scan__sub">{body}</p>}
        <p className="last-scan__lot">{line.lotNo}</p>
      </div>
    </section>
  );
};
