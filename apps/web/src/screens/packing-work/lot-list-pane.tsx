import { Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { popTouchClass } from '../../patterns/pop-touch';
import type { Lot } from './types';

const t = messages.packingWork;

export interface LotListPaneProps {
  lots: readonly Lot[];
  selectedLotId: number | null;
  /** 단위 코드를 찾는 자리. 아직 안 왔으면 `null` — 지어낸 단위를 붙이지 않는다. */
  uomCodeOf: (uomId: number) => string | null;
  onSelect: (lot: Lot) => void;
}

/**
 * 좌단 《포장 대상》 — 이 작업지시의 완료된 생산LOT.
 *
 * ⛔ **「잔여」 열을 세우지 않는다.** 스펙 §3 은 행마다 잔여를 그리지만, 이미 포장된 수량을
 * 뺀 값을 계약이 내려 주지 않는다(설계 회신 대기). `initialQty` 를 잔여 자리에 놓으면 두 번
 * 포장한 LOT 이 아직 다 남은 것처럼 보인다 — **열 이름을 「최초 수량」으로 바꿔** 다른 값임을
 * 이름이 말하게 한다.
 *
 * ⛔ **그 사정을 목록 아래에 적지 않는다.** 스펙 §3 의 좌단 《포장 대상》은 LOT 과 수량 두
 * 조각뿐이고, 늘 떠 있는 두 문단이 «포장 대상» 목록을 화면 밖으로 밀고 있었다(실측 164px).
 * 열 이름이 이미 다른 값이라고 말한다.
 */
export const LotListPane = ({ lots, selectedLotId, uomCodeOf, onSelect }: LotListPaneProps) => {
  /*
   * ⛔ **번호 열이 남은 폭을 다 가져가게 두지 않는다.** LOT 번호가 길어 표가 내용대로 폭을
   * 잡으면 행이 옆으로 늘어난다. 뒤 열의 너비를 못박아 남는 폭이 번호 열이 되게 한다.
   */
  const columns: Column<Lot>[] = [
    {
      key: 'lotNo',
      align: 'center',
      header: t.lotList.lotNoColumn,
      render: (lot) => {
        const isSelected = lot.lotId === selectedLotId;

        return (
          <button
            type="button"
            className={`pop-row-select pop-lot-row ${popTouchClass('normal')}${
              isSelected ? ' pop-row-select-on' : ''
            }`}
            aria-pressed={isSelected}
            aria-label={`${lot.lotNo} ${t.lotList.select}`}
            onClick={() => {
              onSelect(lot);
            }}
          >
            <span className="pack-work-lot-no" title={lot.lotNo}>
              {lot.lotNo}
            </span>
          </button>
        );
      },
    },
    {
      key: 'initialQty',
      header: t.lotList.initialQtyColumn,
      align: 'center',
      width: '96px',
      /* 스펙 §3 이 이 자리를 「잔여 380 EA」로 그린다 — 수는 단위와 함께 읽힌다. */
      render: (lot) => {
        const uomCode = uomCodeOf(lot.uomId);

        return uomCode === null ? String(lot.initialQty) : `${String(lot.initialQty)} ${uomCode}`;
      },
    },
  ];

  return (
    <>
      {/*
       * ⛔ **선택 칸을 따로 두지 않는다.** 스펙 §3 의 목록에 그런 칸이 없고 §7 도 `Table` 하나만
       * 적는다. 대신 **줄 전체가 누르는 자리**다 — 다른 POP 목록과 같은 방식이고, 다른 칸을
       * 누르면 그 줄의 버튼을 대신 누른다.
       */}
      <div
        role="presentation"
        className="pop-row-target"
        onClick={(event) => {
          const from = event.target as HTMLElement;

          if (from.closest('.pop-row-select') !== null) return;

          from.closest('tr')?.querySelector<HTMLButtonElement>('.pop-row-select')?.click();
        }}
      >
        <Table
          className="pack-work-lot-table"
          columns={columns}
          rows={[...lots]}
          getRowId={(lot) => String(lot.lotId)}
          density="comfortable"
          empty={t.lotList.empty}
        />
      </div>
    </>
  );
};
