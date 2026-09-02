import { Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { lookupDisplayLabel, lookupDisplayLabelWithInactive } from '../../patterns/lookup-display';
import type { LookupSource } from '../../patterns/lookup-display';
import { popTouchClass } from '../../patterns/pop-touch';
import { formatReceiptDate, type TargetRow } from './types';

const t = messages.popMaterialLotLabel.receipts;

export interface ReceiptTableProps {
  rows: TargetRow[];
  supplierLookup: LookupSource;
  itemLookup: LookupSource;
  uomLookup: LookupSource;
  selectedId: number | null;
  onToggleSelect: (inboundReceiptLineId: number) => void;
  /** 결과가 없을 때 그 자리에 보일 안내. 「없음」과 「이 쪽에 없음」이 갈린다. */
  empty: string;
}

/**
 * 입하 목록 — **스펙 §3 의 세 칸이다: 입하 · 품목 · 수량.**
 *
 * ⛔ **선택 칸을 따로 두지 않는다.** 스펙의 목록에 그런 칸이 없고, §5-1 도 「입하 건 선택」을
 * 액션으로만 적는다. 앞선 판이 관리웹(`W-01-10`)의 선택 버튼 열을 가져왔는데, 그쪽은 마우스로
 * 쓰는 화면이라 터치 단말에 같은 모양이 맞다는 근거가 없었다 — 실기에서 「선택이 뭘 뜻하는지
 * 모르겠다」가 나왔다.
 *
 * 대신 **줄 전체가 누르는 자리**다. 스펙 §3 의 목록이 한 줄을 상자 하나로 그리고, 장갑 낀
 * 손을 전제하므로(G-5) 타겟을 칸 하나로 좁히지 않는다.
 *
 * ⚠ **조작은 첫 칸의 버튼 하나가 갖는다.** 칸마다 버튼을 두면 한 줄에 탭 정지가 셋 생기고
 * 읽어 주는 이름도 셋이 된다. 다른 칸을 누르면 **그 줄의 버튼을 대신 누른다** — 그래서 손으로는
 * 줄 전체가 눌리고, 키보드·읽어 주는 도구에는 줄마다 조작이 하나로 보인다.
 *
 * 밀도를 `comfortable`로 둔다. 장갑 낀 손으로 누르는 표라 `compact`는 행이 서로 붙는다.
 *
 * ⛔ **정렬을 켜지 않는다.** 서버가 쪽 단위로 잘라 주므로 화면이 정렬하면 **보이는 쪽 안에서만**
 * 정렬돼 「전체가 정렬된 것」으로 오해된다.
 */
export const ReceiptTable = ({
  rows,
  supplierLookup,
  itemLookup,
  uomLookup,
  selectedId,
  onToggleSelect,
  empty,
}: ReceiptTableProps) => {
  const columns: Column<TargetRow>[] = [
    {
      key: 'receipt',
      header: t.columns.receipt,
      render: (row) => {
        const isSelected = row.inboundReceiptLineId === selectedId;
        const itemName = lookupDisplayLabel(itemLookup, row.itemId);

        return (
          <button
            type="button"
            className={`pop-row-select ${popTouchClass('normal')}${
              isSelected ? ' pop-row-select-on' : ''
            }`}
            aria-pressed={isSelected}
            aria-label={
              isSelected
                ? t.deselectRow(row.inboundReceiptNo, itemName)
                : t.selectRow(row.inboundReceiptNo, itemName)
            }
            onClick={() => {
              onToggleSelect(row.inboundReceiptLineId);
            }}
          >
            <span>{row.inboundReceiptNo}</span>
            <span>{lookupDisplayLabelWithInactive(supplierLookup, row.supplierId)}</span>
          </button>
        );
      },
    },
    {
      key: 'item',
      header: t.columns.item,
      render: (row) => lookupDisplayLabel(itemLookup, row.itemId),
    },
    {
      key: 'quantity',
      header: t.columns.quantity,
      align: 'end',
      width: '140px',
      render: (row) => (
        // 칸이 오른쪽 정렬이라 쌓는 줄도 오른쪽에 맞춘다 — 기본값은 왼쪽에 붙는다.
        <span className="stacked-cell pop-stacked-end">
          <span>
            {row.receivedQty} {lookupDisplayLabel(uomLookup, row.uomId)}
          </span>
          <span>{formatReceiptDate(row.receiptDatetime)}</span>
        </span>
      ),
    },
  ];

  return (
    /*
     * 줄의 어느 칸을 눌러도 그 줄의 버튼을 대신 누른다.
     *
     * 디자인 시스템의 `Table` 은 행 클릭을 받지 않고 행에 식별자도 남기지 않는다. 그래서
     * 눌린 자리에서 «위로» 행을 찾아 그 안의 버튼을 누른다 — 행 순서와 데이터 색인을 맞추는
     * 방식은 정렬·그룹이 켜지면 어긋나지만, 이쪽은 무엇이 켜져도 같은 행 안에서만 움직인다.
     */
    <div
      role="presentation"
      className="pop-row-target"
      onClick={(event) => {
        const from = event.target as HTMLElement;

        // 버튼을 직접 눌렀으면 그쪽이 이미 처리한다 — 여기서 또 누르면 선택이 두 번 뒤집힌다.
        if (from.closest('.pop-row-select') !== null) return;

        from.closest('tr')?.querySelector<HTMLButtonElement>('.pop-row-select')?.click();
      }}
    >
      <Table
        caption={t.caption}
        columns={columns}
        rows={rows}
        density="comfortable"
        empty={<p className="field-note pop-empty-note">{empty}</p>}
        getRowId={(row) => String(row.inboundReceiptLineId)}
      />
    </div>
  );
};
