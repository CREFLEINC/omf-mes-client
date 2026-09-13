import { AlertBanner, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { toLookupDisplayState, type LookupSource } from '../../patterns/lookup-display';
import { lotCount, type HandlingUnit, type PackingContentRow } from './types';

const t = messages.repackLabelIssue.handlingUnit;

export interface HandlingUnitPaneProps {
  handlingUnit: HandlingUnit;
  rows: readonly PackingContentRow[];
  /** 이름 조회가 실패했다 — 빈 칸의 사유를 말한다 */
  namesFailed: boolean;
  /** 포장 유형의 표시명. 칸에 코드가 그대로 서지 않게 한다(#1045). */
  types: LookupSource;
}

/**
 * 유형 칸에 세울 글자 — **코드가 아니라 표시명이다**(#1045).
 *
 * ⛔ 이름을 지어내지 않는다. 아직 받는 중인 것과 못 받은 것, 목록에 없는 것을 각각 다르게
 * 말한다 — 셋을 뭉치면 「이름이 없다」로 해 두었다가 이름으로 바뀌는 칸이 된다.
 */
export const typeText = (types: LookupSource, typeCode: string): string => {
  const state = toLookupDisplayState(types, typeCode);

  switch (state.kind) {
    case 'named':
      return state.label;
    case 'loading':
      return t.typeLoading;
    case 'failed':
      return t.typeFailed;
    case 'empty':
      return t.unknownValue;
    case 'unknown':
      return t.typeUnknown(typeCode);
  }
};

const columns: Column<PackingContentRow>[] = [
  /* 값은 열 가운데에 선다 — 다른 POP 목록과 같다(사용자 지시 2026-09-07 · 전례 `P-04-02`). */
  {
    key: 'lotNo',
    header: t.lotColumn,
    align: 'center',
    /*
     * ⚠ **폭을 비율로 나눈다**(사용자 지시 2026-09-11). 폭을 글자에 맡기면 첫 열이 남는
     *   자리를 통째로 먹어 품목과 수량이 오른쪽 끝에 몰려 붙는다.
     */
    width: '34%',
    render: (row) => row.lotNo ?? t.unknownValue,
  },
  {
    key: 'itemCode',
    header: t.itemColumn,
    align: 'center',
    width: '33%',
    render: (row) => row.itemCode ?? t.unknownValue,
  },
  {
    key: 'qty',
    header: t.qtyColumn,
    align: 'center',
    width: '33%',
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
export const HandlingUnitPane = ({
  handlingUnit,
  rows,
  namesFailed,
  types,
}: HandlingUnitPaneProps) => (
  <>
    <dl className="pop-repack-facts">
      <dt>{t.noLabel}</dt>
      <dd>{handlingUnit.handlingUnitNo}</dd>
      <dt>{t.typeLabel}</dt>
      <dd>{typeText(types, handlingUnit.handlingUnitTypeCode)}</dd>
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
      // ⛔ 표에 이름표(caption)를 다시 달지 않는다 — 바로 위 「내용물 · LOT n건」이 같은 말이다.
      <Table
        /*
         * ⛔ **긴 LOT 이 품목·수량 열을 밀어내지 못하게 한다**(#1092 — 출고 QR·포장 라벨
         *    재출력과 같은 사유·같은 처리). 겨냥할 이름이 있어야 폭을 못박을 수 있다.
         */
        className="pop-repack-contents"
        columns={columns}
        rows={[...rows]}
        getRowId={(row) => String(row.handlingUnitContentId)}
        density="compact"
      />
    )}
  </>
);
