import { AlertBanner, Button, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { Lot } from './types';

const t = messages.productionLotComplete;

export interface LotListPaneProps {
  lots: readonly Lot[];
  selectedLotId: number | null;
  onSelect: (lotId: number) => void;
  /** 작업지시를 받았는가. 빈 목록의 사유가 갈린다. */
  hasWorkOrder: boolean;
  /** 서버가 말한 미완료 LOT «전체» 수. 안내 문구는 받은 행 수가 아니라 이것을 쓴다. */
  total: number;
  /** 한 쪽에 다 담기지 않았는가. 담기지 않았으면 그 사실을 말한다. */
  truncated: boolean;
}

/**
 * 좌단 《LOT 목록》.
 *
 * ⚠ **양품 열을 채우지 못한다.** 목록 조회가 생산 진척을 함께 내리지 않는다(`omf-mes#269` 잔여 ·
 * 이 저장소 #143 · 검토 요청 `omf-mes#399` 3번). **비워 두고 사유를 말한다** — 말없이 비우면
 * 「양품이 없다」로 읽히고, 행마다 상세를 따로 부르는 것은 설계가 정한 방식이 아니다.
 *
 * 열 자체는 남긴다. 지웠다가 값이 도착하면 표의 폭과 순서가 다시 흔들린다.
 */
export const LotListPane = ({
  lots,
  selectedLotId,
  onSelect,
  hasWorkOrder,
  total,
  truncated,
}: LotListPaneProps) => {
  /*
   * ⛔ **번호 열이 남은 폭을 다 가져가게 두지 않는다.** LOT 번호는 34자리라, 표가 내용대로 폭을
   * 잡으면 선택 버튼이 표 밖으로 밀려난다(전례 `P-02-05` 실측). 뒤 두 열의 너비를 못박아 남는
   * 폭을 번호 열이 갖게 한다.
   */
  const columns: Column<Lot>[] = [
    {
      key: 'lotNo',
      header: t.lotList.lotNoColumn,
      render: (lot) => (
        <span className="pop-lotdone-no" title={lot.lotNo}>
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
        className="pop-lotdone-table"
        columns={columns}
        rows={[...lots]}
        getRowId={(lot) => String(lot.lotId)}
        density="comfortable"
        empty={hasWorkOrder ? t.lotList.empty : t.lotList.emptyNoWorkOrder}
      />
      <p className="field-note">{t.lotList.goodQtyPending}</p>
      {/*
        슬롯 안내는 스펙 §7 이 `AlertBanner`(info) 로 못박았다 — 문단으로 두지 않는다.
        ⛔ 셀 것이 없으면 내지 않는다 — 「0개 있습니다」는 안내가 아니라 잡음이다.
      */}
      {total > 0 && (
        <div className="pop-lotdone-notice">
          <AlertBanner variant="info">
            {t.lotList.slotNotice(total)}
            {truncated ? ` ${t.lotList.truncated(lots.length)}` : ''}
          </AlertBanner>
        </div>
      )}
    </>
  );
};
