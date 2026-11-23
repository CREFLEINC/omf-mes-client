import { messages } from '@omf-mes/i18n';

import { FitName } from '../../patterns/fit-name';
import { rowNumberStyle } from '../../patterns/row-number';
import { lotTailOf } from './transfer-tally';
import type { StockTransferLine } from './transfer';

const t = messages.stockTransfer;

interface ArriveLotsProps {
  lines: readonly StockTransferLine[];
  itemOf: (line: StockTransferLine) => { itemCode: string; itemName: string };
  lotNoOf: (line: StockTransferLine) => string | null;
  uomOf: (uomId: number) => string;
}

/**
 * 도착할 LOT 표(읽기만) — No · 품목코드 · LOT 끝 / 품목명 · 반출 수량. 전에는 도착 화면에 무엇을 옮기는지가 없었다
 * (사용자 지시 2026-11-20, 반출 LOT 표와 같은 모양).
 */
export const ArriveLots = ({ lines, itemOf, lotNoOf, uomOf }: ArriveLotsProps) => (
  <section className="transfer-tally" aria-label={t.arrive.lots}>
    <h2 className="transfer-tally__title">
      {t.arrive.lots} <span className="transfer-tally__total">{t.tally.total(lines.length)}</span>
    </h2>
    <div className="transfer-tally__box">
      <table className="transfer-tally__table" style={rowNumberStyle(lines.length)}>
        <colgroup>
          <col className="transfer-tally__col-no" />
          <col />
          <col className="transfer-tally__col-qty" />
        </colgroup>
        <tbody>
          {[...lines]
            .sort((a, b) => a.lineNo - b.lineNo)
            .map((line, index) => {
              const item = itemOf(line);
              const lotNo = lotNoOf(line);

              return (
                <tr key={line.stockTransferLineId}>
                  <td className="transfer-tally__no">{index + 1}</td>
                  <td className="transfer-tally__item transfer-tally__item--static">
                    <span className="transfer-tally__code">
                      {item.itemCode}
                      {lotNo === null ? null : (
                        <span className="transfer-tally__lot">{lotTailOf(lotNo)}</span>
                      )}
                    </span>
                    <FitName
                      className="transfer-tally__name"
                      text={item.itemName}
                      min={7}
                      lines={1}
                      whole
                    />
                  </td>
                  <td className="transfer-tally__num">
                    {String(line.shippedQty)}
                    <small>{uomOf(line.uomId)}</small>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  </section>
);
