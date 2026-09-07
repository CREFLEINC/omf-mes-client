import { Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { popTouchClass } from '../../patterns/pop-touch';
import type { Lot } from './types';

const t = messages.identificationTagIssue;

export interface LotListPaneProps {
  lots: readonly Lot[];
  selectedLotId: number | null;
  onSelect: (lotId: number) => void;
}

/**
 * 좌단 《대상 LOT》.
 *
 * ⚠ **양품 열을 채우지 못한다.** 목록 조회가 생산 진척을 함께 내리지 않아(이 저장소 #143 이
 * 같은 사유로 설계 회신을 기다린다) 값이 없다. 열 자체는 남긴다 — 지웠다가 값이 도착하면
 * 표의 폭과 순서가 다시 흔들린다.
 *
 * ⛔ **사유를 목록 옆에 적지 않는다**(사용자 지시). 설계에 없는 문구였고, 고른 뒤 오른쪽
 * 《발행》이 양품 수를 온전히 말한다 — 같은 말을 두 자리에서 하지 않는다.
 *
 * ⚠ 아래 「양품 개체마다 1장」은 **설계 §3 도면에 있는 문구**라 그대로 둔다. 둘을 같이
 * 걷지 않는다 — 하나는 우리 것이고 하나는 설계 것이다.
 */
export const LotListPane = ({ lots, selectedLotId, onSelect }: LotListPaneProps) => {
  /*
   * ⛔ **번호 열이 남은 폭을 다 가져가게 두지 않는다.** LOT 번호는 34자리라, 표가 내용대로
   * 폭을 잡으면 행이 옆으로 늘어난다. 표를 **고정 폭**으로 두고(`.pop-lot-table`) 뒤 열의
   * 너비를 못박는다 — 남는 폭이 번호 열이고, 넘치는 번호는 잘린다. 잘린 번호 전체는 마우스를
   * 올리면 보이고, 고른 뒤에는 오른쪽 《발행》이 온전히 다시 보인다.
   */
  /*
   * ⚠ **번호 열의 가운데 맞춤이 풀렸다.** 앞서 사용자 지시로 세 열을 가운데로 세웠는데, 그때는
   * 선택 버튼이 열 하나를 차지하던 판이었다. 지금은 번호 칸 자체가 누르는 자리이고 **다른 POP
   * 목록이 모두 왼쪽 정렬**이라, 여기만 가운데로 두면 화면마다 목록이 다르게 보인다.
   * 「양품」 열은 지시대로 가운데를 지킨다.
   */
  const columns: Column<Lot>[] = [
    {
      key: 'lotNo',
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
              onSelect(lot.lotId);
            }}
          >
            <span className="pop-lot-no" title={lot.lotNo}>
              {lot.lotNo}
            </span>
          </button>
        );
      },
    },
    {
      key: 'goodQty',
      header: t.lotList.goodQtyColumn,
      align: 'center',
      width: '72px',
      render: () => t.lotList.goodQtyPlaceholder,
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
          className="pop-lot-table"
          columns={columns}
          rows={[...lots]}
          getRowId={(lot) => String(lot.lotId)}
          density="comfortable"
          empty={t.lotList.empty}
        />
      </div>

      {/* 설계 §3 도면이 목록 아래에 그린 문구다(R69·R70). ⛔ 지우지 않는다. */}
      <p className="pop-notice">{t.lotList.goodOnlyNotice}</p>
    </>
  );
};
