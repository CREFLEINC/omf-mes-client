import { Dialog, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { popTouchClass } from '../../patterns/pop-touch';
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
      /*
       * ⛔ **선택 칸을 따로 두지 않는다.** 다른 POP 목록과 같이 **줄 전체가 누르는 자리**다 —
       * 132px 짜리 버튼 열이 붙으면 34자리 번호가 설 폭이 그만큼 줄고, 목록마다 고르는 방법이
       * 달라지면 작업자가 화면마다 다시 배운다.
       */
      render: (lot) => {
        const isSelected = lot.lotId === selectedLotId;

        return (
          <button
            type="button"
            className={`pop-row-select pop-lot-row ${popTouchClass('normal')}${
              isSelected ? ' pop-row-select-on' : ''
            }`}
            aria-pressed={isSelected}
            aria-label={`${lot.lotNo} ${t.lot.select}`}
            onClick={() => {
              onSelect(lot.lotId);
            }}
          >
            <span className="pop-result-lot-no" title={lot.lotNo}>
              {formatLotNo(lot.lotNo)}
            </span>
          </button>
        );
      },
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} title={t.lot.sectionLabel} size="lg">
      {isLoadFailed ? (
        <p className="field-error">{t.lot.loadFailed}</p>
      ) : (
        /*
         * ⛔ **표시 규칙을 설명하는 문장을 두지 않는다.** §3-3 이 요구한 것은 34자리를 «끊어
         * 보이는 것»이고, 그것을 설명하는 안내문은 스펙에 없다. 고르는 창에서 매번 읽히는
         * 상주 문장이라 정작 골라야 할 목록보다 먼저 눈에 든다(사용자 지적).
         */
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
            columns={columns}
            rows={[...lots]}
            getRowId={(lot) => String(lot.lotId)}
            density="comfortable"
            empty={t.lot.empty}
          />
        </div>
      )}
    </Dialog>
  );
};
