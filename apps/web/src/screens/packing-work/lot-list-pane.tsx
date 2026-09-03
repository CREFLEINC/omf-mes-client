import { Button, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { Lot } from './types';

const t = messages.packingWork;

export interface LotListPaneProps {
  lots: readonly Lot[];
  selectedLotId: number | null;
  onSelect: (lot: Lot) => void;
}

/**
 * 좌단 《포장 대상》 — 이 작업지시의 완료된 생산LOT.
 *
 * ⛔ **「잔여」 열을 세우지 않는다.** 스펙 §3 은 행마다 잔여를 그리지만, 이미 포장된 수량을
 * 뺀 값을 계약이 내려 주지 않는다(설계 회신 대기). `initialQty` 를 잔여 자리에 놓으면 두 번
 * 포장한 LOT 이 아직 다 남은 것처럼 보인다 — **이름을 바꿔 최초 수량으로 보이고** 잔여가
 * 아직 없다는 것을 아래에 말한다.
 *
 * ⚠ 말없이 비우지 않는다 — 비어 있으면 「잔여가 0」으로 읽힌다.
 */
export const LotListPane = ({ lots, selectedLotId, onSelect }: LotListPaneProps) => {
  /*
   * ⛔ **번호 열이 남은 폭을 다 가져가게 두지 않는다.** LOT 번호가 길어 표가 내용대로 폭을
   * 잡으면 행이 옆으로 늘어나 **선택 버튼이 표 밖으로 밀려난다**(전례 `P-02-05` 실측).
   * 뒤 두 열의 너비를 못박아 남는 폭이 번호 열이 되게 한다.
   */
  const columns: Column<Lot>[] = [
    {
      key: 'lotNo',
      header: t.lotList.lotNoColumn,
      render: (lot) => (
        <span className="packing-lot-no" title={lot.lotNo}>
          {lot.lotNo}
        </span>
      ),
    },
    {
      key: 'initialQty',
      header: t.lotList.initialQtyColumn,
      align: 'end',
      width: '96px',
      render: (lot) => String(lot.initialQty),
    },
    {
      key: 'select',
      header: '',
      align: 'end',
      width: '116px',
      render: (lot) => (
        <Button
          variant={lot.lotId === selectedLotId ? 'filled' : 'outlined'}
          size="xl"
          aria-pressed={lot.lotId === selectedLotId}
          aria-label={`${lot.lotNo} ${t.lotList.select}`}
          onClick={() => {
            onSelect(lot);
          }}
        >
          {lot.lotId === selectedLotId ? t.lotList.selected : t.lotList.select}
        </Button>
      ),
    },
  ];

  return (
    <>
      <Table
        className="packing-lot-table"
        columns={columns}
        rows={[...lots]}
        getRowId={(lot) => String(lot.lotId)}
        density="comfortable"
        empty={t.lotList.empty}
      />
      <p className="field-note">{t.lotList.remainingPending}</p>
      <p className="pop-notice">{t.lotList.completedOnlyNotice}</p>
    </>
  );
};
