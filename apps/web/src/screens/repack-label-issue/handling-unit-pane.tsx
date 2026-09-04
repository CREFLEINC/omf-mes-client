import { AlertBanner, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { lotCount, type HandlingUnit, type PackingContentRow } from './types';

const t = messages.repackLabelIssue.handlingUnit;

export interface HandlingUnitPaneProps {
  handlingUnit: HandlingUnit;
  rows: readonly PackingContentRow[];
  /** 이름 조회가 실패했다 — 빈 칸의 사유를 말한다 */
  namesFailed: boolean;
}

const columns: Column<PackingContentRow>[] = [
  {
    key: 'lotNo',
    header: t.lotColumn,
    render: (row) => row.lotNo ?? t.unknownValue,
  },
  {
    key: 'itemCode',
    header: t.itemColumn,
    render: (row) => row.itemCode ?? t.unknownValue,
  },
  {
    key: 'qty',
    header: t.qtyColumn,
    align: 'end',
    render: (row) => `${String(row.qty)} ${row.uomCode ?? t.unknownValue}`,
  },
];

/**
 * 《대상 포장》 — 무엇에 붙일 라벨인가.
 *
 * ⭐ **LOT 이 여럿이어도 라벨은 한 장이다**(스펙 §4-B — 대상은 포장 단위이고 `lot_id` 는 비운다).
 * `P-02-09` 는 같은 자리에서 혼적을 ⚠ 로 세우는데, 그쪽은 **LOT 마다 라벨이 갈리는** 화면이라
 * 그렇다. 여기서는 갈리지 않으므로 **경고가 아니라 사실**로만 적는다 — 경고를 옮겨 오면 사용자가
 * 있지도 않은 선택을 찾는다.
 */
export const HandlingUnitPane = ({ handlingUnit, rows, namesFailed }: HandlingUnitPaneProps) => (
  <>
    <dl className="pop-repack-facts">
      <dt>{t.noLabel}</dt>
      <dd>{handlingUnit.handlingUnitNo}</dd>
      <dt>{t.typeLabel}</dt>
      <dd>{handlingUnit.handlingUnitTypeCode}</dd>
      <dt>{t.contentsLabel}</dt>
      <dd>{t.mixedLot(lotCount(rows))}</dd>
    </dl>

    {namesFailed && (
      <div className="banner-slot">
        <AlertBanner variant="warning" title={t.namesFailed} />
      </div>
    )}

    {rows.length === 0 ? (
      <p className="pop-empty-note">{t.empty}</p>
    ) : (
      <Table
        columns={columns}
        rows={[...rows]}
        getRowId={(row) => String(row.handlingUnitContentId)}
        density="compact"
        caption={t.contentsLabel}
      />
    )}
  </>
);
