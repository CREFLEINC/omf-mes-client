import { Button, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { lookupDisplayLabelWithInactive, type LookupSource } from '../../patterns/lookup-display';
import { popTouchClass } from '../../patterns/pop-touch';
import { formatReceiptDate, type ReceiptView } from './types';

const t = messages.popMaterialLotLabel.receipts;

export interface ReceiptTableProps {
  rows: ReceiptView[];
  supplierLookup: LookupSource;
  selectedId: number | null;
  onToggleSelect: (inboundReceiptId: number) => void;
  /** 결과가 없을 때 그 자리에 보일 안내. 「없음」과 「이 쪽에 없음」이 갈린다. */
  empty: string;
}

/**
 * 입하 건 목록 — **고르는 표다.**
 *
 * 밀도를 `comfortable`로 둔다. 장갑 낀 손으로 누르는 표라 `compact`는 행이 서로 붙는다.
 *
 * ⛔ **정렬을 켜지 않는다.** 서버가 쪽 단위로 잘라 주므로 화면이 정렬하면 **보이는 쪽 안에서만**
 * 정렬돼 「전체가 정렬된 것」으로 오해된다.
 *
 * ⭐ **고른 것을 눈에 보이게 만든다.** 앞선 판에서는 `aria-pressed`만 바꾸고 시각 변화를 두지
 * 않아 **누른 사람이 골랐는지 알 수 없었다**(실기 확인에서 드러났다). 화면 읽기 프로그램에만
 * 전달되고 눈에는 아무 일도 일어나지 않는 상태는 「표시했다」가 아니다.
 *
 * 선택을 **버튼 열로 둔다** — 정상품 입하 처리(`W-01-10`)가 세운 전례이며, 누르는 자리가
 * 분명하고 라벨이 상태를 글자로 말한다. DS `Table`의 선택 열(`selectable`)은 쓰지 않는다:
 * 확인칸은 여럿 고르는 조작으로 읽히는데 이 화면은 **한 건만** 고른다.
 */
export const ReceiptTable = ({
  rows,
  supplierLookup,
  selectedId,
  onToggleSelect,
  empty,
}: ReceiptTableProps) => {
  const columns: Column<ReceiptView>[] = [
    {
      key: 'select',
      header: t.columns.select,
      width: '128px',
      render: (row) => {
        const isSelected = row.inboundReceiptId === selectedId;

        return (
          <Button
            className={popTouchClass('normal')}
            variant={isSelected ? 'filled' : 'outlined'}
            size="xl"
            aria-pressed={isSelected}
            aria-label={
              isSelected ? t.deselectRow(row.inboundReceiptNo) : t.selectRow(row.inboundReceiptNo)
            }
            onClick={() => {
              onToggleSelect(row.inboundReceiptId);
            }}
          >
            {isSelected ? t.selected : t.select}
          </Button>
        );
      },
    },
    { key: 'inboundReceiptNo', header: t.columns.inboundReceiptNo },
    {
      key: 'supplier',
      header: t.columns.supplier,
      render: (row) => lookupDisplayLabelWithInactive(supplierLookup, row.supplierId),
    },
    {
      key: 'receiptDate',
      header: t.columns.receiptDate,
      width: '120px',
      render: (row) => formatReceiptDate(row.receiptDatetime),
    },
  ];

  return (
    <Table
      caption={t.caption}
      columns={columns}
      rows={rows}
      density="comfortable"
      empty={<p className="field-note">{empty}</p>}
      getRowId={(row) => String(row.inboundReceiptId)}
    />
  );
};
