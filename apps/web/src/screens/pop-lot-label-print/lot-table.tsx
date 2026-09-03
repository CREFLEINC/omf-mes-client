import { Button, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { LotRow } from './types';

const t = messages.popLotLabelPrint;

export interface LotTableProps {
  rows: readonly LotRow[];
  selectedLotId: number | null;
  onSelect: (lotId: number) => void;
  /** 발행 현황 조회가 실패했는가. 회차 열 전체가 「모른다」가 된 사유를 말해야 한다. */
  isIssueCountUnavailable: boolean;
}

/**
 * 좌단 《완료 LOT》.
 *
 * ⚠ **「상태」·「양품」 열을 채우지 못한다.** 목록 조회가 생산 진척을 함께 내리지 않아 값이
 * 없다(`queries.ts`). **비워 두고 사유를 말한다** — 말없이 비우면 「미달이 없다」·「양품이 0」
 * 으로 읽히고, 행마다 상세를 따로 부르는 것은 설계가 정한 방식이 아니다.
 *
 * 열 자체는 남긴다. 지웠다가 값이 도착하면 표의 폭과 순서가 다시 흔들린다.
 *
 * ⛔ **번호 열이 남은 폭을 다 가져가게 두지 않는다.** LOT 번호는 34자리라, 표가 내용대로 폭을
 * 잡으면 행이 옆으로 늘어나 선택 버튼이 표 밖으로 밀려난다(전례 `P-02-05` 실측). 뒤 세 열의
 * 너비를 못박아 남는 폭을 번호 열에 준다.
 */
export const LotTable = ({
  rows,
  selectedLotId,
  onSelect,
  isIssueCountUnavailable,
}: LotTableProps) => {
  const columns: Column<LotRow>[] = [
    {
      key: 'lotNo',
      header: t.lotList.lotNoColumn,
      render: (row) => (
        <span className="pop-lot-no" title={row.lotNo}>
          {row.lotNo}
        </span>
      ),
    },
    {
      key: 'status',
      header: t.lotList.statusColumn,
      width: '72px',
      render: () => t.lotList.valuePending,
    },
    {
      key: 'goodQty',
      header: t.lotList.goodQtyColumn,
      align: 'end',
      width: '72px',
      render: () => t.lotList.valuePending,
    },
    {
      key: 'issueCount',
      header: t.lotList.issueCountColumn,
      align: 'end',
      width: '88px',
      /*
       * 셋을 가른다 — 「한 번도 안 찍힘」 · 「N회 찍힘」 · 「모른다」.
       * ⛔ 모르는 것을 미출력으로 그리지 않는다. 이미 찍은 라벨을 다시 찍게 된다.
       */
      render: (row) => {
        if (row.issueCount === null) return t.lotList.valuePending;

        return row.issueCount === 0 ? t.lotList.notIssued : t.lotList.issuedCount(row.issueCount);
      },
    },
    {
      key: 'select',
      header: '',
      align: 'end',
      width: '116px',
      render: (row) => (
        <Button
          variant={row.lotId === selectedLotId ? 'filled' : 'outlined'}
          size="xl"
          aria-pressed={row.lotId === selectedLotId}
          aria-label={`${row.lotNo} ${t.lotList.select}`}
          onClick={() => {
            onSelect(row.lotId);
          }}
        >
          {row.lotId === selectedLotId ? t.lotList.selected : t.lotList.select}
        </Button>
      ),
    },
  ];

  return (
    <>
      <Table
        className="pop-lot-table"
        columns={columns}
        rows={[...rows]}
        getRowId={(row) => String(row.lotId)}
        density="comfortable"
        empty={t.lotList.empty}
      />
      <p className="field-note">{t.lotList.progressPending}</p>
      {isIssueCountUnavailable ? <p className="field-note">{t.lotList.issueCountUnknown}</p> : null}
      {/* 2단 출력의 나머지 한 단은 다른 화면에 있다 — 합치지 않고 안내만 한다(스펙 §5-3). */}
      <p className="pop-notice">{t.lotList.tagNotice}</p>
    </>
  );
};
