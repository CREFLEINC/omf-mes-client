import { Button, Dialog, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { formatLotNo } from './lot-display';
import type { Lot } from './types';

const t = messages.productionResult;

export interface LotPickerProps {
  open: boolean;
  lots: readonly Lot[];
  selectedLotId: number | null;
  isLoadFailed: boolean;
  onSelect: (lotId: number) => void;
  onClose: () => void;
}

/**
 * 《대상 LOT》을 고르는 자리.
 *
 * ⭐ **목록을 본문에 상시 펼치지 않는다.** 좌단 세로 예산이 616px 이고 슬랙이 0 이라(스펙
 * §3-1·§3-3), 목록을 늘 세우면 양품수량 칸과 키패드가 함께 서지 못한다. 스펙 §3-2 의 배치도
 * 「대상 LOT … [변경]」 한 줄이다 — 목록은 그 버튼을 눌렀을 때 나온다.
 */
export const LotPicker = ({
  open,
  lots,
  selectedLotId,
  isLoadFailed,
  onSelect,
  onClose,
}: LotPickerProps) => {
  const columns: Column<Lot>[] = [
    {
      key: 'lotNo',
      header: t.lot.lotLabel,
      render: (lot) => (
        <span className="pop-result-lot-no" title={lot.lotNo}>
          {formatLotNo(lot.lotNo)}
        </span>
      ),
    },
    {
      key: 'select',
      header: '',
      align: 'end',
      width: '132px',
      render: (lot) => (
        <Button
          variant={lot.lotId === selectedLotId ? 'filled' : 'outlined'}
          size="2xl"
          aria-pressed={lot.lotId === selectedLotId}
          aria-label={`${lot.lotNo} ${t.lot.select}`}
          onClick={() => {
            onSelect(lot.lotId);
          }}
        >
          {lot.lotId === selectedLotId ? t.lot.selected : t.lot.select}
        </Button>
      ),
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} title={t.lot.sectionLabel} size="lg">
      {isLoadFailed ? (
        <p className="field-error">{t.lot.loadFailed}</p>
      ) : (
        <>
          <Table
            columns={columns}
            rows={[...lots]}
            getRowId={(lot) => String(lot.lotId)}
            density="comfortable"
            empty={t.lot.empty}
          />
          <p className="field-note">{t.lot.groupedNote}</p>
        </>
      )}
    </Dialog>
  );
};
