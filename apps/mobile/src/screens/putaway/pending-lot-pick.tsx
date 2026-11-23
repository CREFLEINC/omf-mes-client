import { Chip, Dialog, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { shortLotNos } from '../../patterns/lot-short-no';
import { Words } from '../../patterns/words';
import type { PendingLot, PendingLotGroup } from './direct';
import '../../patterns/item-sheet.css';
import '../../patterns/lot-table.css';

const d = messages.putaway.direct;

/** 수량 — 천 단위 쉼표. 줄 하나 = LOT 하나: 번호 끝 · 수량 · 판정 · ›. */
const qtyText = (lot: PendingLot): string =>
  `${lot.qty.toLocaleString('ko-KR', { maximumFractionDigits: 6 })} ${lot.uomCode}`;

/**
 * 적치할 LOT 고르기 — 적치 대기 표의 한 줄(입하 LOT · 품목)에 적치 대기 LOT 이 여럿일 때 아래에서 올라온다(사용자 지시
 * 2026-11-23). 손에 든 라벨과 같은 LOT 을 누르면 그 LOT 을 스캔한 것과 같다 — 위치 스캔으로 간다. 번호는 줄 사이에서
 * 가를 수 있는 끝 조각(보통 일련번호)만.
 */
export const PendingLotPick = ({
  group,
  onPick,
  onDismiss,
}: {
  group: PendingLotGroup;
  onPick: (lot: PendingLot) => void;
  onDismiss: () => void;
}) => {
  const shortNos = shortLotNos(group.lots.map((lot) => lot.lotNo));
  /*
   * 줄 사이를 가르는 끝 조각 — MES 형식이면 가를 수 있는 가장 짧은 조각, 아니면 끝 두 칸(「…|SUP01|0001」). 번호 전체는
   * 이름(낭독)에 있다.
   */
  const tailOf = (lotNo: string): string => {
    const short = shortNos.get(lotNo);
    if (short !== undefined && short !== lotNo) return short;
    const parts = lotNo.split('|');
    return parts.length <= 2 ? lotNo : `…|${parts.slice(-2).join('|')}`;
  };

  return (
    <Dialog open onClose={onDismiss} title={d.pick.title} size="sm" className="item-sheet">
      <section className="putaway-pick">
        <dl className="sheet-facts">
          <dt>{d.pick.itemCode}</dt>
          <dd className="sheet-facts__code">{group.itemCode}</dd>
          <dt>{d.pick.itemName}</dt>
          <dd>
            <Words text={group.itemName} />
          </dd>
        </dl>
        <ul className="putaway-pick__list" aria-label={d.pick.title}>
          {group.lots.map((lot) => (
            <li key={lot.lotId}>
              <button
                type="button"
                className="putaway-pick__row"
                aria-label={d.pick.open(lot.lotNo)}
                onClick={() => {
                  onPick(lot);
                }}
              >
                <span className="lot-table__no putaway-pick__no">{tailOf(lot.lotNo)}</span>
                <span className="putaway-pick__qty">{qtyText(lot)}</span>
                <span className="putaway-pick__status">
                  {lot.lotStatusCode === 'DEFECTIVE' ? (
                    <Chip status="error">{d.defective}</Chip>
                  ) : (
                    d.normal
                  )}
                </span>
                <Icon name="chevron_right" size={20} className="putaway-pick__chevron" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </Dialog>
  );
};
