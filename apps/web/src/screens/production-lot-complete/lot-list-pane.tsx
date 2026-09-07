import { AlertBanner, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { popTouchClass } from '../../patterns/pop-touch';
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
 * 이 저장소 #143 · 검토 요청 `omf-mes#399` 3번). **「—」로 비워 둔다.**
 *
 * ⛔ 사유를 문단으로 덧붙이지 않는다 — 스펙 §3·§7 에 그런 안내가 없다(사용자 지시 2026-09-07).
 * 값은 LOT 을 고르면 오른쪽 《완료 판정》에 나온다.
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
   * 잡으면 행이 옆으로 늘어난다. 뒤 열의 너비를 못박아 남는 폭을 번호 열이 갖게 한다.
   */
  const columns: Column<Lot>[] = [
    {
      key: 'lotNo',
      /*
       * ⭐ **번호 열은 왼쪽에서 시작한다**(사용자 결정 2026-09-07).
       *
       * 이 표는 열이 둘뿐이고 뒤 열이 72px 로 못박혀 있어 **번호 열이 남는 폭을 거의 다
       * 가져간다.** 가운데로 두면 넓은 칸 한복판에 번호가 떠 왼쪽이 통째로 빈다.
       *
       * ⚠ 다른 POP 표는 가운데 정렬이다(같은 회차의 결정) — 그쪽은 열이 셋이라 각 열이 좁아
       *   가운데가 곧 그 열의 자리다. 여기만 다른 이유가 그것이다.
       */
      align: 'start',
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
            <span className="pop-lotdone-no" title={lot.lotNo}>
              {lot.lotNo}
            </span>
          </button>
        );
      },
    },
    {
      key: 'goodQty',
      header: t.lotList.goodQtyColumn,
      /* 두 열을 같은 쪽에 맞춘다 — 한쪽만 가운데면 표가 두 규칙으로 읽힌다(사용자 결정). */
      align: 'start',
      width: '72px',
      render: () => t.lotList.goodQtyPlaceholder,
    },
  ];

  return (
    <>
      {/*
       * ⛔ **선택 칸을 따로 두지 않는다.** 스펙 §3 의 목록에 그런 칸이 없고 §7 도 `Table` 하나만
       * 적는다. 116px 열이 남은 폭을 가져가 34자리 LOT 번호를 잘랐다. 대신 **줄 전체가 누르는
       * 자리**다 — 자재LOT·LOT 라벨 출력 화면과 같은 방식이고, 장갑 낀 손을 전제하므로 타겟을
       * 칸 하나로 좁히지 않는다. 다른 칸을 누르면 그 줄의 버튼을 대신 누른다.
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
          className="pop-lotdone-table"
          columns={columns}
          rows={[...lots]}
          getRowId={(lot) => String(lot.lotId)}
          density="comfortable"
          empty={hasWorkOrder ? t.lotList.empty : t.lotList.emptyNoWorkOrder}
        />
      </div>
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
