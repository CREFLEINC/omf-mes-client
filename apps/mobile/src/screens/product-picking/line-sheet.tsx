import { Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { Words } from '../../patterns/words';
import { LotRow, ReplacedRow, type CodeFieldState } from './lot-row';
import {
  activeLots,
  lineTiles,
  replacedLots,
  warehouseTagOf,
  type ShipmentRequestLine,
  type ShipmentRequestLot,
} from './picking';
import '../../patterns/item-sheet.css';

const t = messages.productPicking;

interface LineSheetProps {
  line: ShipmentRequestLine;
  item: { itemCode: string; itemName: string };
  uomOf: (uomId: number) => string;
  codeStateOf: (lot: ShipmentRequestLot) => CodeFieldState;
  onReplace: (lot: ShipmentRequestLot) => void;
  onCodeEdit: (lot: ShipmentRequestLot) => void;
  onCodeDraft: (lot: ShipmentRequestLot, value: string) => void;
  onCodeCancel: () => void;
  onCodeSave: (lot: ShipmentRequestLot) => void;
  onDismiss: () => void;
  /** 두 창고에 걸쳐 줄 창고 몫만 집은 LOT 의 다른 창고 남은 수량(피처 012 Edge · 이 회차에 피킹한 것만 안다). */
  otherQtyOf?: (lot: ShipmentRequestLot) => number | undefined;
}

/**
 * 피킹 라인 시트 — 표의 라인 줄을 누르면 아래에서 올라온다(사용자 지시 2026-11-20, 입하 등록 「입하 품목」 시트와 같은
 * 모양). 이름표 칸(품목코드 · 품목명 · 피킹 · 출하검사 · 고객 요구) 아래 그 라인의 LOT. 교체 · 출하 관리 코드처럼 드문
 * 일은 여기에만 둔다.
 */
export const LineSheet = ({
  line,
  item,
  uomOf,
  codeStateOf,
  onReplace,
  onCodeEdit,
  onCodeDraft,
  onCodeCancel,
  onCodeSave,
  onDismiss,
  otherQtyOf,
}: LineSheetProps) => {
  const tiles = lineTiles(line);
  const uom = uomOf(line.uomId);
  const live = activeLots(line);
  const gone = replacedLots(line);
  const requirement = line.customerLotRequirement?.trim() ?? '';

  return (
    <Dialog open onClose={onDismiss} title={t.sheet.title} size="sm" className="item-sheet">
      <section className="picking-sheet" aria-label={t.sheet.lots}>
        <dl className="sheet-facts">
          <dt>{t.sheet.fields.itemCode}</dt>
          <dd className="sheet-facts__code">{item.itemCode}</dd>
          <dt>{t.sheet.fields.itemName}</dt>
          <dd>
            <Words text={item.itemName} />
          </dd>
          <dt>{t.sheet.fields.warehouse}</dt>
          <dd>{warehouseTagOf(line, t.warehouse)}</dd>
          <dt>{t.sheet.fields.picked}</dt>
          <dd>
            {t.sheet.pickedOfTarget(String(tiles.picked), String(tiles.target), uom)}
            {tiles.kind === 'over' && tiles.value > 0
              ? `, ${t.sheet.over(String(tiles.value))}`
              : ''}
          </dd>
          <dt>{t.sheet.fields.inspection}</dt>
          <dd>{line.shippingInspectionRequired ? t.sheet.inspection : t.sheet.noInspection}</dd>
          {requirement === '' ? null : (
            <>
              <dt>{t.sheet.fields.requirement}</dt>
              <dd>{requirement}</dd>
            </>
          )}
          {line.minimumRemainingShelfLifeDays === null ||
          line.minimumRemainingShelfLifeDays === undefined ? null : (
            <>
              <dt>{t.sheet.fields.shelfLife}</dt>
              <dd>{t.sheet.shelfLife(line.minimumRemainingShelfLifeDays)}</dd>
            </>
          )}
        </dl>

        {live.length === 0 && gone.length === 0 ? (
          <p className="picking__note">{t.line.noLots}</p>
        ) : (
          <ul className="picking-sheet__lots">
            {live.map((lot) => (
              <LotRow
                key={lot.shipmentRequestLotId}
                lot={lot}
                uom={uomOf(lot.uomId)}
                otherWarehouseQty={otherQtyOf?.(lot)}
                code={codeStateOf(lot)}
                onReplace={() => {
                  onReplace(lot);
                }}
                onCodeEdit={() => {
                  onCodeEdit(lot);
                }}
                onCodeDraft={(value) => {
                  onCodeDraft(lot, value);
                }}
                onCodeCancel={onCodeCancel}
                onCodeSave={() => {
                  onCodeSave(lot);
                }}
              />
            ))}
            {gone.map((lot) => (
              <ReplacedRow key={lot.shipmentRequestLotId} lot={lot} uom={uomOf(lot.uomId)} />
            ))}
          </ul>
        )}
      </section>
    </Dialog>
  );
};
