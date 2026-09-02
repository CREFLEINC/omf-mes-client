import { Button, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

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
 * 같은 사유로 설계 회신을 기다린다) 값이 없다. **비워 두고 사유를 말한다** — 말없이 비우면
 * 「양품이 없다」로 읽히고, 행마다 상세를 따로 부르는 것은 설계가 정한 방식이 아니다.
 *
 * 열 자체는 남긴다. 지웠다가 값이 도착하면 표의 폭과 순서가 다시 흔들린다.
 */
export const LotListPane = ({ lots, selectedLotId, onSelect }: LotListPaneProps) => {
  /*
   * ⛔ **번호 열이 남은 폭을 다 가져가게 두지 않는다.** LOT 번호는 34자리라, 표가 내용대로
   * 폭을 잡으면 행이 옆으로 늘어나 **선택 버튼이 표 밖으로 밀려난다**(실측 — 가로로 밀어야
   * 나왔다). 누를 것이 보이지 않는 목록은 목록이 아니다.
   *
   * 그래서 표를 **고정 폭**으로 두고(`.pop-lot-table`) 뒤 두 열의 너비를 못박는다 — 남는
   * 폭이 번호 열이고, 넘치는 번호는 잘린다. 잘린 번호 전체는 마우스를 올리면 보이고, 고른
   * 뒤에는 오른쪽 《발행》이 온전히 다시 보인다.
   */
  const columns: Column<Lot>[] = [
    {
      key: 'lotNo',
      header: t.lotList.lotNoColumn,
      render: (lot) => (
        <span className="pop-lot-no" title={lot.lotNo}>
          {lot.lotNo}
        </span>
      ),
    },
    {
      key: 'goodQty',
      header: t.lotList.goodQtyColumn,
      align: 'end',
      width: '72px',
      render: () => t.lotList.goodQtyPlaceholder,
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
            onSelect(lot.lotId);
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
        className="pop-lot-table"
        columns={columns}
        rows={[...lots]}
        getRowId={(lot) => String(lot.lotId)}
        density="comfortable"
        empty={t.lotList.empty}
      />
      <p className="field-note">{t.lotList.goodQtyPending}</p>
      <p className="pop-notice">{t.lotList.goodOnlyNotice}</p>
    </>
  );
};
