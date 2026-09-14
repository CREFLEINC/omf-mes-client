import { AlertBanner, Chip, Table, type Column } from '@crefle/web-ui';
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
    /*
     * ⭐ **칸을 가운데로 맞춘다**(사용자 지시 2026-09-10 · 자재LOT 등록 화면의 표와 같은 규칙).
     * 줄이 짧은 표라 왼쪽 정렬이면 열 사이가 벌어져 눈이 가로로 오간다.
     */
    /*
     * ⚠ **열 폭을 비율로 나눈다**(사용자 지시 2026-09-10). LOT 이 남는 폭을 다 먹고 품목·수량이
     *   96 에 묶여, 값은 짧은데 열 이름과 값이 서로 멀었다.
     */
    {
      key: 'lotNo',
      header: t.lotColumn,
      align: 'center',
      width: '44%',
      render: (row) => row.lotNo ?? t.unknownValue,
    },
    {
      key: 'itemCode',
      header: t.itemColumn,
      align: 'center',
      width: '28%',
      render: (row) => row.itemCode ?? t.unknownValue,
    },
    {
      key: 'qty',
      header: t.qtyColumn,
      align: 'center',
      width: '28%',
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
        <span className="pop-reprint-hu-value">{handlingUnit.handlingUnitNo}</span>
        {/*
         * ⭐ **유형은 칩으로 세운다**(사용자 지시 2026-09-10). 번호는 글자, 유형은 알약 —
         * 모양이 다르면 「번호와 그 성격」이 한눈에 갈린다.
         *
         * ⛔ 색을 쓰지 않는다(`idle`) — 상태가 아니라 분류라, 초록·노랑은 없는 뜻을 만든다.
         */}
        <Chip size="sm" status="idle">
          {typeName ?? handlingUnit.handlingUnitTypeCode}
        </Chip>
      </p>

      <h3 className="pane-title">{t.contentsLabel}</h3>
      <Table
        /*
         * ⛔ **겨냥할 이름이 있어야 폭을 못박을 수 있다**(#1092). 이름이 없어 CSS 가 이 표에
         *    닿지 못했고, 열의 `%` 폭이 기본 배치에서 희망값에 그쳐 긴 LOT 이 품목·수량 열을
         *    눌렀다.
         */
        className="pop-reprint-contents"
        columns={columns}
        rows={[...rows]}
        getRowId={(row) => String(row.handlingUnitContentId)}
        /*
         * ⚠ **다른 POP 표와 같은 밀도다**(사용자 지적 2026-09-10). `compact` 는 관리웹 밀도라
         *   줄 높이가 36 으로 앉아, 장갑 낀 손이 읽기에도 누르기에도 좁았다.
         */
        density="comfortable"
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
