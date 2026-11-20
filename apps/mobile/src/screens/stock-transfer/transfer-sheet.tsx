import { Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { Button } from '../../patterns/button';
import { Words } from '../../patterns/words';
import type { DraftLine } from './transfer';
import '../../patterns/item-sheet.css';

const t = messages.stockTransfer;

interface TransferSheetProps {
  line: DraftLine;
  item: { itemCode: string; itemName: string };
  fromWarehouse: string | null;
  uom: string;
  onRemove: () => void;
  onDismiss: () => void;
}

/**
 * 반출 LOT 시트 — 표의 줄을 누르면 아래에서 올라온다(사용자 지시 2026-11-20). LOT 전체 번호 · 출발 · 재고를 이름표와
 * 함께 보이고, 줄마다 있던 「빼기」는 여기에만 둔다.
 */
export const TransferSheet = ({
  line,
  item,
  fromWarehouse,
  uom,
  onRemove,
  onDismiss,
}: TransferSheetProps) => (
  <Dialog open onClose={onDismiss} title={t.sheet.title} size="sm" className="item-sheet">
    <section className="transfer-sheet" aria-label={line.lotNo}>
      <dl className="sheet-facts">
        <dt>{t.sheet.fields.itemCode}</dt>
        <dd className="sheet-facts__code">{item.itemCode}</dd>
        <dt>{t.sheet.fields.itemName}</dt>
        <dd>
          <Words text={item.itemName} />
        </dd>
        <dt>{t.sheet.fields.lot}</dt>
        <dd className="sheet-facts__code transfer-sheet__lot">{line.lotNo}</dd>
        {fromWarehouse === null ? null : (
          <>
            <dt>{t.sheet.fields.from}</dt>
            <dd>{fromWarehouse}</dd>
          </>
        )}
        <dt>{t.sheet.fields.onHand}</dt>
        <dd>{`${String(line.onHandQty)} ${uom}`}</dd>
        <dt>{t.sheet.fields.qty}</dt>
        <dd>{line.qty === '' ? '-' : `${line.qty} ${uom}`}</dd>
      </dl>
      <Button variant="outlined" className="transfer-sheet__remove" onClick={onRemove}>
        {t.sheet.remove}
      </Button>
    </section>
  </Dialog>
);
