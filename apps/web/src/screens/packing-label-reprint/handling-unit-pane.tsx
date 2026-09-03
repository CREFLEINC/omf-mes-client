import { AlertBanner, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { isMixedLot, type HandlingUnit, type PackingContentRow } from './types';

const t = messages.packingLabelReprint.handlingUnit;

export interface HandlingUnitPaneProps {
  handlingUnit: HandlingUnit;
  rows: readonly PackingContentRow[];
  /** 이름 조회가 실패했다 — 빈 칸의 사유를 말한다 */
  namesFailed: boolean;
}

/**
 * 좌단 《포장 단위》 — 무엇이 담긴 포장인지.
 *
 * ⭐ **혼적을 눈에 띄게 세운다**(스펙 §3·§6). 한 포장에 LOT 이 둘 이상이면 붙일 라벨이
 * 갈리는데, 작업자는 상자를 보고는 그것을 알 수 없다.
 *
 * ⛔ **`List` 컴포넌트가 디자인 시스템에 없다**(착수 이슈 · 이 저장소 #141). `Table` 로 세운다.
 */
export const HandlingUnitPane = ({ handlingUnit, rows, namesFailed }: HandlingUnitPaneProps) => {
  const columns: Column<PackingContentRow>[] = [
    {
      key: 'lotNo',
      header: t.lotColumn,
      render: (row) => row.lotNo ?? t.unknownValue,
    },
    {
      key: 'itemCode',
      header: t.itemColumn,
      width: '96px',
      render: (row) => row.itemCode ?? t.unknownValue,
    },
    {
      key: 'qty',
      header: t.qtyColumn,
      align: 'end',
      width: '96px',
      /* 단위를 못 받았으면 수량만 낸다 — 단위 없는 수량은 참이고, 지어낸 단위는 거짓이다. */
      render: (row) =>
        row.uomCode === null ? String(row.qty) : `${String(row.qty)} ${row.uomCode}`,
    },
  ];

  const lotCount = new Set(rows.map((row) => row.lotId)).size;

  return (
    <>
      <p className="pop-reprint-hu-no">{handlingUnit.handlingUnitNo}</p>
      <p className="field-note">{`${t.typeLabel} ${handlingUnit.handlingUnitTypeCode}`}</p>

      <h3 className="pane-title">{t.contentsLabel}</h3>
      <Table
        columns={columns}
        rows={[...rows]}
        getRowId={(row) => String(row.handlingUnitContentId)}
        density="compact"
        empty={t.empty}
      />

      {namesFailed && <p className="field-error">{t.namesFailed}</p>}

      {isMixedLot(rows) && (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.mixedLot(lotCount)}>
            {t.mixedLotBody}
          </AlertBanner>
        </div>
      )}
    </>
  );
};
