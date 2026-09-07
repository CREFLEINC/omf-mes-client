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
   * 폭을 잡으면 행이 옆으로 늘어나 **선택 버튼이 표 밖으로 밀려난다**(실측 — 가로로 밀어야
   * 나왔다). 누를 것이 보이지 않는 목록은 목록이 아니다.
   *
   * 그래서 표를 **고정 폭**으로 두고(`.pop-lot-table`) 뒤 두 열의 너비를 못박는다 — 남는
   * 폭이 번호 열이고, 넘치는 번호는 잘린다. 잘린 번호 전체는 마우스를 올리면 보이고, 고른
   * 뒤에는 오른쪽 《발행》이 온전히 다시 보인다.
   */
  /*
   * ⚠ **세 열 모두 가운데로 세운다**(사용자 지시). 설계는 이 표의 정렬을 정하지 않았다 —
   * `P-02-05` 에 「정렬」을 말하는 조항이 없고, §3 도면의 좌단은 표가 아니라 두 값짜리 목록이다.
   */
  const columns: Column<Lot>[] = [
    {
      key: 'lotNo',
      header: t.lotList.lotNoColumn,
      align: 'center',
      render: (lot) => (
        <span className="pop-lot-no" title={lot.lotNo}>
          {lot.lotNo}
        </span>
      ),
    },
    {
      key: 'goodQty',
      header: t.lotList.goodQtyColumn,
      align: 'center',
      width: '72px',
      render: () => t.lotList.goodQtyPlaceholder,
    },
    {
      key: 'select',
      header: '',
      align: 'center',
      width: '116px',
      render: (lot) => (
        <Button
          /*
           * ⚠ **두 상태의 크기가 같아야 한다.** 글자 수가 다르고(「선택」·「선택됨」) 채움과
           * 테두리라 폭이 서로 다르게 잡혀, 고른 줄만 버튼이 커 보였다(실측). 크기가 상태를
           * 말하면 목록이 들썩이고, 무엇이 골라졌는지는 «색»이 이미 말한다.
           */
          className="pop-lot-select"
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

      {/* 설계 §3 도면이 목록 아래에 그린 문구다(R69·R70). ⛔ 지우지 않는다. */}
      <p className="pop-notice">{t.lotList.goodOnlyNotice}</p>
    </>
  );
};
