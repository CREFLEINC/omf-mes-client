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
  const columns: Column<Lot>[] = [
    { key: 'lotNo', header: t.lotList.lotNoColumn, render: (lot) => lot.lotNo },
    {
      key: 'goodQty',
      header: t.lotList.goodQtyColumn,
      align: 'end',
      render: () => t.lotList.goodQtyPlaceholder,
    },
    {
      key: 'select',
      header: '',
      align: 'end',
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
        columns={columns}
        rows={[...lots]}
        getRowId={(lot) => String(lot.lotId)}
        density="comfortable"
        caption={t.lotList.sectionLabel}
        empty={t.lotList.empty}
      />
      <p className="field-note">{t.lotList.goodQtyPending}</p>
      <p className="pop-notice">{t.lotList.goodOnlyNotice}</p>
    </>
  );
};
