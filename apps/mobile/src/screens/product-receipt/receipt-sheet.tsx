import { Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { Words } from '../../patterns/words';
import type { DraftLine } from './receipt';
import '../../patterns/item-sheet.css';

const t = messages.productReceipt;

interface ReceiptSheetProps {
  line: DraftLine;
  item: { itemCode: string; itemName: string };
  lotNo: string;
  manufacturedAt: string | null;
  expiryDate: string | null;
  onDismiss: () => void;
}

/**
 * 인수 대상 시트 — 표의 줄을 누르면 아래에서 올라온다. 입고할 때 거의 보지 않는 제조일 · 유효기간 · 양품 실적(인식표
 * 수량)을 줄에서 빼 여기에 둔다(사용자 결정 2026-11-20).
 */
export const ReceiptSheet = ({
  line,
  item,
  lotNo,
  manufacturedAt,
  expiryDate,
  onDismiss,
}: ReceiptSheetProps) => (
  <Dialog open onClose={onDismiss} title={t.sheet.title} size="sm" className="item-sheet">
    <section aria-label={lotNo}>
      <dl className="sheet-facts">
        <dt>{t.sheet.fields.itemCode}</dt>
        <dd className="sheet-facts__code">{item.itemCode}</dd>
        <dt>{t.sheet.fields.itemName}</dt>
        <dd>
          <Words text={item.itemName} />
        </dd>
        <dt>{t.sheet.fields.lot}</dt>
        <dd className="sheet-facts__code receipt-sheet__lot">{lotNo}</dd>
        <dt>{line.from === 'lot' ? t.sheet.fields.expectedGood : t.sheet.fields.expectedUnit}</dt>
        <dd>{String(line.expectedQty)}</dd>
        {manufacturedAt === null ? null : (
          <>
            <dt>{t.sheet.fields.manufactured}</dt>
            <dd>{manufacturedAt.slice(0, 10)}</dd>
          </>
        )}
        {expiryDate === null ? null : (
          <>
            <dt>{t.sheet.fields.expiry}</dt>
            <dd>{expiryDate}</dd>
          </>
        )}
      </dl>
    </section>
  </Dialog>
);
