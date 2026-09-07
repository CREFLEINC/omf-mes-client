import { AlertBanner, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { isMixedLot, type HandlingUnit, type PackingContentRow } from './types';

const t = messages.packingLabelReprint.handlingUnit;

export interface HandlingUnitPaneProps {
  handlingUnit: HandlingUnit;
  /** 포장 유형의 «이름». 못 받았으면 `null` — 그때는 코드를 그대로 낸다. */
  typeName: string | null;
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
export const HandlingUnitPane = ({
  handlingUnit,
  typeName,
  rows,
  namesFailed,
}: HandlingUnitPaneProps) => {
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
      {/*
       * 번호와 유형을 **한 줄로** 세운다(설계 §3 —「HU-…0007  박스」). 둘은 「이 포장이
       * 무엇인가」를 함께 말하는 한 덩어리다.
       *
       * ⛔ **코드를 그대로 내지 않는다.** 도면이 「박스」로 그린 자리다 — `CARTON` 은 현장에서
       *    읽는 말이 아니다. 이름을 못 받았을 때만 코드로 물러선다(지어내지 않는다).
       */}
      <p className="pop-reprint-hu-no">
        {handlingUnit.handlingUnitNo}
        <span className="pop-reprint-hu-type">
          {typeName ?? handlingUnit.handlingUnitTypeCode}
        </span>
      </p>

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
