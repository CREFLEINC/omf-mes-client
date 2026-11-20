import { Icon } from '@crefle/web-ui';
import type { InboundLotDetail } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { Button } from '../../patterns/button';
import { parseMaterialLotNo } from '../../patterns/material-lot-no';
import { qtyNumber } from './lot-format';
import { lotTail, type ScanLine } from './receipt';
import { FitName } from './fit-name';

const t = messages.inboundReceipt;

export interface LastScanProps {
  line: ScanLine;
  /** 성공 줄의 입하 LOT — 품목명 · 공급사를 여기서 읽는다(불러오는 중이면 undefined). */
  detail: InboundLotDetail | undefined;
  /** [취소]를 누를 수 있는가 — 입하 중 · 온라인 · 일하는 중 아님. */
  canUndo: boolean;
  onUndo: () => void;
}

/**
 * 방금 찍은 라벨(사용자 지시 2026-11-20 「방금 찍은 바코드가 정말 맞는지」) — 품목코드 · 품목명 · 수량을 크게,
 * 번호 끝은 작게. 결과마다 바탕이 바뀐다: 등록 초록 · 이미 찍음 회색 · 전송 대기 노랑 · 거부 빨강.
 * 잘못 찍었으면 이 칸의 [취소] 한 번으로 되돌린다.
 */
export const LastScan = ({ line, detail, canUndo, onUndo }: LastScanProps) => {
  if (line.kind === 'ok') {
    const parsed = parseMaterialLotNo(line.lotNo);
    const itemCode = detail?.itemCode ?? parsed?.itemCode ?? null;
    const uom = detail?.uomCode ?? '';

    return (
      <section className="last-scan" data-kind="ok" aria-label={t.last.ok}>
        <p className="last-scan__bar">
          <Icon name="check_circle" size={20} />
          <span>{t.last.ok}</span>
          {line.newItem ? <span className="last-scan__tag">{t.last.newItem}</span> : null}
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
        </p>
        <div className="last-scan__body">
          {itemCode === null ? null : <p className="last-scan__code">{itemCode}</p>}
          <p className="last-scan__name">
            {detail === undefined ? t.last.loading : <FitName text={detail.itemName} min={13} />}
          </p>
          {/* 수량은 크게, 번호 끝은 같은 줄 오른쪽에 작게 — 공급사는 표의 머리 줄에 있다(사용자 지시 2026-11-20 시안 A). */}
          <p className="last-scan__qty">
            {line.qty === null ? null : (
              <span>
                {qtyNumber(line.qty)}
                <small>{uom}</small>
              </span>
            )}
            <span className="last-scan__tail">{lotTail(line.lotNo)}</span>
          </p>
          {line.autoClosed ? <p className="last-scan__note">{t.last.autoClosed}</p> : null}
        </div>
      </section>
    );
  }

  const [title, reason, body] =
    line.kind === 'duplicate'
      ? [t.last.duplicate, t.last.duplicateRow(line.row), null]
      : line.kind === 'offline'
        ? [t.last.offline, t.last.offlineBody, null]
        : line.kind === 'closed'
          ? [t.last.closed, t.last.closedBody, null]
          : [t.last.rejected, line.reason, line.body];

  return (
    <section className="last-scan" data-kind={line.kind} aria-label={title}>
      <p className="last-scan__bar">
        <Icon
          name={line.kind === 'duplicate' ? 'info' : line.kind === 'offline' ? 'cloud_off' : 'block'}
          size={20}
        />
        <span>{title}</span>
      </p>
      <div className="last-scan__body">
        <p className="last-scan__why">{reason}</p>
        {body === null ? null : <p className="last-scan__sub">{body}</p>}
        <p className="last-scan__lot">{line.lotNo}</p>
      </div>
    </section>
  );
};
