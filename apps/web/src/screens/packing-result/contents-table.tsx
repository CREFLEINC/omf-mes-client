import { Button, type Column, EmptyState, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { packedTotal, remainingTotal } from './packing-draft';
import type { PackedLine } from './types';

const t = messages.packingResult;

/**
 * ③ 포장 구성 표 — **담긴 것만** 보인다.
 *
 * ⭐ **LOT 을 분절해 보인다**(공유계약 E-2). 34자리 식별자를 붙여 쓰면 실물 라벨과 눈으로
 * 대조할 수 없다 — **저장은 원문, 표시만 그룹핑**이다.
 *
 * ⚠ 이 화면은 세로 예산이 슬랙 0이라(스펙 §3-1) 줄이 넘치면 **이 구획 안에서** 스크롤한다.
 * 화면 전체가 스크롤하면 액션바가 밀려 확정 버튼이 사라진다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 표시용 분절. 저장값은 건드리지 않는다 — 되돌릴 수 있게 **보이기만** 바꾼다. */
export const segmentLotNo = (lotNo: string, size = 6): string => {
  if (lotNo.length <= size) return lotNo;

  const parts: string[] = [];
  for (let index = 0; index < lotNo.length; index += size) {
    parts.push(lotNo.slice(index, index + size));
  }

  return parts.join(' · ');
};

export interface ContentsTableProps {
  lines: PackedLine[];
  onRemove: (shipmentLotAllocationId: number) => void;
}

const renderQty = (value: number): ReactNode => String(value);

export const ContentsTable = ({ lines, onRemove }: ContentsTableProps) => {
  const columns: Column<PackedLine>[] = [
    { key: 'itemCode', header: t.contents.columns.itemCode, render: (row) => row.itemCode },
    { key: 'lotNo', header: t.contents.columns.lotNo, render: (row) => segmentLotNo(row.lotNo) },
    {
      key: 'qty',
      header: t.contents.columns.qty,
      align: 'end',
      render: (row) => renderQty(row.qty),
    },
    {
      key: 'remove',
      header: '',
      align: 'end',
      render: (row) => (
        /*
         * ⛔ **되돌릴 수 있는 조작이라 72px 을 걸지 않는다.** 모든 버튼을 키우면 정작 큰 것
         * (확정)이 눈에 띄지 않아 크기가 뜻을 잃는다.
         */
        <Button
          type="button"
          variant="text"
          size="sm"
          onClick={() => {
            onRemove(row.shipmentLotAllocationId);
          }}
        >
          {t.contents.remove}
        </Button>
      ),
    },
  ];

  return (
    <div className="packing-contents">
      <Table
        density="comfortable"
        columns={columns}
        rows={lines}
        /*
         * 지정하지 않으면 인덱스가 React key 가 되어, 앞 줄을 빼는 순간 그 자리의 DOM 노드가
         * 대신 지워진다 — 수량이 남의 줄로 옮겨 붙어 보인다.
         */
        getRowId={(row) => String(row.shipmentLotAllocationId)}
        empty={<EmptyState size="sm" title={t.contents.empty} />}
      />

      <p className="packing-total">{t.contents.total(packedTotal(lines), remainingTotal(lines))}</p>
    </div>
  );
};
