import { Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { popTouchClass } from '../../patterns/pop-touch';
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
 * 좌단 《완료 LOT》 — **스펙 §3 의 네 칸이다: LOT 번호 · 상태 · 양품 · 발행.**
 *
 * ⛔ **선택 칸을 따로 두지 않는다.** 스펙 §3 의 목록에 그런 칸이 없고 §7 도 `Table` 하나만
 * 적는다. 앞선 판이 줄마다 `[ 선택 ]` 버튼을 세웠는데, 116px 짜리 열이 남은 폭을 가져가
 * **LOT 번호가 「PLOT-20…」 로 잘렸다**(실측). 번호를 못 읽으면 목록이 목록 구실을 못 한다.
 *
 * 대신 **줄 전체가 누르는 자리**다 — 자재LOT 화면(`P-01-01`)이 같은 이유로 이미 그렇게 섰고,
 * 장갑 낀 손을 전제하므로(G-5) 타겟을 칸 하나로 좁히지 않는다. 조작은 첫 칸의 버튼 하나가
 * 가져 한 줄에 탭 정지가 하나만 생기고, 다른 칸을 누르면 그 줄의 버튼을 대신 누른다.
 *
 * ⚠ **「상태」·「양품」 열을 채우지 못한다.** 목록 조회가 생산 진척을 함께 내리지 않아 값이
 * 없다(`queries.ts`). 열 자체는 스펙이 정한 것이라 남기고 값 자리에 「—」를 둔다 — 지웠다가
 * 값이 도착하면 표의 폭과 순서가 다시 흔들린다.
 *
 * ⛔ **번호 열이 남은 폭을 다 가져가게 두지 않는다.** LOT 번호는 34자리라, 표가 내용대로 폭을
 * 잡으면 행이 옆으로 늘어난다. 뒤 세 열의 너비를 못박아 남는 폭을 번호 열에 준다.
 *
 * ⚠ **그 못을 넉넉히 박지 않는다.** 1024 에서 이 구획 안쪽은 410px 뿐이라, 뒤 세 열이 232 를
 * 가져가면 번호 칸에 122 밖에 남지 않아 번호가 잘렸다(실측 「PLOT-202…」). 세 열이 담는 것은
 * 「—」·「미출력」 정도라 60·60·80 으로 충분하다.
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
      align: 'center',
      header: t.lotList.lotNoColumn,
      render: (row) => {
        const isSelected = row.lotId === selectedLotId;

        return (
          <button
            type="button"
            className={`pop-row-select pop-lot-row ${popTouchClass('normal')}${
              isSelected ? ' pop-row-select-on' : ''
            }`}
            aria-pressed={isSelected}
            aria-label={`${row.lotNo} ${t.lotList.select}`}
            onClick={() => {
              onSelect(row.lotId);
            }}
          >
            <span className="pop-lot-no" title={row.lotNo}>
              {row.lotNo}
            </span>
          </button>
        );
      },
    },
    {
      key: 'status',
      align: 'center',
      header: t.lotList.statusColumn,
      width: '60px',
      render: () => t.lotList.valuePending,
    },
    {
      key: 'goodQty',
      header: t.lotList.goodQtyColumn,
      align: 'center',
      width: '60px',
      render: () => t.lotList.valuePending,
    },
    {
      key: 'issueCount',
      header: t.lotList.issueCountColumn,
      align: 'center',
      width: '80px',
      /*
       * 셋을 가른다 — 「한 번도 안 찍힘」 · 「N회 찍힘」 · 「모른다」.
       * ⛔ 모르는 것을 미출력으로 그리지 않는다. 이미 찍은 라벨을 다시 찍게 된다.
       */
      render: (row) => {
        if (row.issueCount === null) return t.lotList.valuePending;

        return row.issueCount === 0 ? t.lotList.notIssued : t.lotList.issuedCount(row.issueCount);
      },
    },
  ];

  return (
    <>
      {/*
       * 줄의 어느 칸을 눌러도 그 줄의 버튼을 대신 누른다. DS `Table` 은 행 클릭을 받지 않아
       * 눌린 자리에서 «위로» 행을 찾는다 — 자재LOT 화면과 같은 방식이다.
       */}
      <div
        role="presentation"
        className="pop-row-target"
        onClick={(event) => {
          const from = event.target as HTMLElement;

          // 버튼을 직접 눌렀으면 그쪽이 이미 처리한다.
          if (from.closest('.pop-row-select') !== null) return;

          from.closest('tr')?.querySelector<HTMLButtonElement>('.pop-row-select')?.click();
        }}
      >
        <Table
          className="pop-lot-table"
          columns={columns}
          rows={[...rows]}
          getRowId={(row) => String(row.lotId)}
          density="comfortable"
          empty={t.lotList.empty}
        />
      </div>
      {isIssueCountUnavailable ? <p className="field-note">{t.lotList.issueCountUnknown}</p> : null}
      {/* 2단 출력의 나머지 한 단은 다른 화면에 있다 — 합치지 않고 안내만 한다(스펙 §3 ⓘ · §5-3). */}
      <p className="pop-notice">{t.lotList.tagNotice}</p>
    </>
  );
};
