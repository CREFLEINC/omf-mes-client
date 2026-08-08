import {
  Button,
  Chip,
  type Column,
  EmptyState,
  SkeletonText,
  Table,
  type SortState,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { formatTransactionAt } from './as-of';
import { describeReference, toReference, type ReferenceSource } from './lookups';
import { sortableKeysOf, toSortState, type SortKey } from './sort';
import { toGroupKey, toRowKey, type BalanceView } from './types';
import { groupAxisOf, type ViewAxis } from './view-axis';

const t = messages.stockStatus;

/**
 * 열 폭 예산.
 *
 * **모든 열이 폭을 지정한다.** 디자인 시스템 `Table`은 `table-layout: fixed`이고 폭을
 * `<colgroup>`에 싣는다(번들 실측) — 고정 배치에서 **폭을 지정하지 않은 열은 남는 폭의
 * 잔여분**을 받는다. 지정 합이 표 폭에 가까우면 그 열에 남는 것이 사실상 없다.
 *
 * 이것이 브라우저 확인 F-B2의 원인이다: 지정 합 924px에 `.wide-table` 하한 928px이라
 * 미지정이던 품목 열에 4px만 남았고, 실렌더 82px에서 「ABC-123 · 하우징 커버 A」가
 * **네 줄로 쪼개졌다.** 주 식별자 열이라 표를 훑을 수 없게 된다.
 *
 * **합과 하한의 관계가 뒤집혀 있다.** `.wide-table`은 `min-width`라 **바닥이지 천장이 아니다** —
 * 합이 하한보다 **작으면** 고정 배치가 남는 폭을 나눠 넣어 선언과 실렌더가 어긋나고,
 * 합이 하한 **이상이면** 각 열이 선언한 폭 그대로 렌더되고 모자란 폭은
 * 디자인 시스템의 `overflow-x` 상자가 가로 스크롤로 처리한다(브라우저 확인 B6의 통과 기준이
 * 「좁으면 가로 스크롤이 생긴다」이다). **그래서 합을 하한 아래로 누르지 않는다.**
 *
 * 값은 `docs/layout-conventions.md`의 방법으로 도출한다 — `--type-body-sm` 14px ·
 * ASCII 자폭 약 7.5px · 한글 14px · 셀 여백 32px · 칩 안쪽 여백 24px.
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 축 열(품목 · 위치) | **200px** | 「코드 · 이름」이 한 줄에 들어가는 폭. W-06-02 「항목」·W-01-09 흡수 예산과 같은 값 |
 * | LOT | 144px | `LOT-2026-000045` 15자 113px + 셀 여백 32px |
 * | 보유 | 120px | 수 아래 「음수 보유」 칩(4한글 56 + 공백 4 + 칩 여백 24 = 84) + 32 |
 * | 가용 | 88px | 여섯 자리 수 45 + 32. 아래에 쌓이는 것이 없다 |
 * | 보류 | 136px | 수 아래 「보류 LOT n건」 칩(80 + 칩 여백 24 = 104) + 32 |
 * | 단위 | 96px | **단위 코드만** 낸다(전체 이름은 상세에서) — 8자 60 + 32 |
 * | 품질 상태 · 재고 상태 | 각 120px | 코드 배지 하나(8자 60 + 24 = 84) + 32 |
 * | 소유 | 128px | 「(자사 소유)」 또는 거래처명 아래에 소유 구분 코드 배지가 쌓인다 |
 * | 최근 거래 | 124px | **`MM-DD HH:mm`** 11자 83 + 32(`as-of.ts`가 그 형태로 줄인다) |
 *
 * | 보기 | 축 열 | 합 |
 * | --- | --- | ---: |
 * | 품목별 | 품목 | **1,132px** |
 * | LOT별 | 품목 · LOT | **1,276px** |
 * | 위치별 | 위치 · 품목 | **1,332px** |
 *
 * **세 합이 모두 928px을 넘는다.** 열이 9~10개인 표를 928px에 넣으려면 열마다 66~91px이라
 * 칩 하나도 한 줄에 들어가지 않는다 — 이 표는 그 하한에 들어가지 않는다.
 * `docs/layout-conventions.md`가 예고한 「세 번째 화면이 하한을 넘겨야 하는」 자리이며,
 * 문서가 권하는 첫 수단(**열을 줄인다**)은 계획 §5.4가 정한 열 구성을 바꾸는 일이라
 * 실행 담당이 단독으로 정하지 않는다(실행 보고에 판단 요청으로 남긴다).
 */
const WIDTH = {
  axis: '200px',
  lot: '144px',
  onHandQty: '120px',
  availableQty: '88px',
  blocked: '136px',
  uom: '96px',
  code: '120px',
  ownership: '128px',
  lastTransactionAt: '124px',
} as const;

export interface BalanceColumnDeps {
  view: ViewAxis;
  itemLookup: ReferenceSource;
  lotLookup: ReferenceSource;
  locationLookup: ReferenceSource;
  uomLookup: ReferenceSource;
  partnerLookup: ReferenceSource;
}

/** 값이 없는 칸은 비워 두지 않는다 — 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string | null): ReactNode => value ?? t.values.empty;

/**
 * 값 목록이 확정되지 않은 코드의 배지.
 *
 * **중립 변형 하나로만 쓴다**(계획 결정 12). 값 집합을 모르는 채 색을 가르면 뜻을 지어내는
 * 것이고, 나중에 값이 확정됐을 때 화면이 이미 틀린 뜻을 말하고 있게 된다.
 * 서버가 준 코드를 **번역하지 않고 그대로** 낸다.
 */
const codeChip = (code: string | null): ReactNode =>
  code === null || code === '' ? (
    t.values.empty
  ) : (
    <Chip variant="status" size="sm">
      {code}
    </Chip>
  );

/** 수량은 우측 정렬한다 — 자릿수가 맞아야 크기를 눈으로 견줄 수 있다. */
const QTY_ALIGN = 'end' as const;

/**
 * 보기마다의 열 구성. **부품 밖으로 내보내 열 폭 합과 정렬 가능한 열을 값으로 검사한다.**
 *
 * 세 보기가 뒤쪽 여덟 열을 공유하고 앞쪽 축 열만 다르다 — 품목별 하나, LOT별·위치별 둘이라
 * 열이 9~10개가 된다.
 */
export const buildBalanceColumns = ({
  view,
  itemLookup,
  lotLookup,
  locationLookup,
  uomLookup,
  partnerLookup,
}: BalanceColumnDeps): Column<BalanceView>[] => {
  /*
   * **번호를 문자열로 바꾸는 자리가 없다**(#44). 이름으로 풀 수 없는 세 갈래(미도착·목록에
   * 없음·실패)는 전부 문구로 갈리며, 어느 갈래에도 원시 번호가 담기지 않는다.
   */
  const itemColumn: Column<BalanceView> = {
    /*
     * **열 `key`를 계약의 정렬 열거값과 같게 둔다.** 제어 정렬이 `SortState.key`로 열을 가리키고
     * 디자인 시스템이 그 키로 `aria-sort`를 붙이므로, 표시용 이름을 키로 쓰면 정렬 표시가
     * 어느 머리글에도 붙지 않는다. 정렬되지 않는 열만 뜻이 읽히는 이름을 쓴다.
     */
    key: 'itemCode',
    header: t.table.item,
    width: WIDTH.axis,
    render: (row) => describeReference(toReference(itemLookup, row.itemId)),
  };

  const lotColumn: Column<BalanceView> = {
    key: 'lotNo',
    header: t.table.lot,
    width: WIDTH.lot,
    /*
     * **`null`이 확정된 뜻을 갖는 자리다**(계획 결정 10) — `toReference`에 그냥 넘기면
     * 「알 수 없음」이 되어 *값이 잘못됐다*는 뜻으로 뒤집힌다. 넘기기 전에 갈라낸다.
     */
    render: (row) =>
      row.lotId === null ? t.values.noLot : describeReference(toReference(lotLookup, row.lotId)),
  };

  const locationColumn: Column<BalanceView> = {
    key: 'locationCode',
    header: t.table.location,
    width: WIDTH.axis,
    /*
     * 위치별 보기에서는 계약이 늘 채워 준다. 비는 것은 정상 형태가 아니므로
     * 「(LOT 무관)」 같은 고유 표기를 만들지 않고 대시로 둔다 — 뜻을 지어내지 않는다.
     */
    render: (row) =>
      row.locationId === null
        ? t.values.empty
        : describeReference(toReference(locationLookup, row.locationId)),
  };

  /** 축 열 — 보기가 정한다. 「코드 · 이름」이 한 줄에 들어가는 폭을 **지정한다**(위 표). */
  const axisColumns: Column<BalanceView>[] = {
    item: [itemColumn],
    lot: [itemColumn, lotColumn],
    location: [locationColumn, itemColumn],
  }[view];

  const columns: Column<BalanceView>[] = [
    ...axisColumns,
    {
      key: 'onHandQty',
      header: t.table.onHandQty,
      width: WIDTH.onHandQty,
      align: QTY_ALIGN,
      render: (row) => (
        <div className="field-cell">
          <span>{row.onHandQty}</span>
          {/*
           * **오류로 부르지 않는다.** 음수를 허용하는 품목인지 알 수 있는 필드가 계약에 없어
           * 「잘못됐다」고 말할 근거가 없다 — 「음수」라는 사실만 표시한다.
           */}
          {row.onHandQty < 0 && (
            <Chip variant="status" status="warning" size="sm">
              {t.values.negativeOnHand}
            </Chip>
          )}
        </div>
      ),
    },
    {
      key: 'availableQty',
      header: t.table.availableQty,
      width: WIDTH.availableQty,
      align: QTY_ALIGN,
      /*
       * **서버가 계산해 내려준 값을 그대로 그린다**(계약에서 `readonly`). 보유−예약−피킹−보류를
       * 화면이 다시 빼면 서버와 다른 답을 낼 수 있다 — 이슈 #21 §6의 금지 항목이다.
       */
      render: (row) => row.availableQty,
    },
    {
      key: 'blockedQty',
      header: t.table.blockedQty,
      width: WIDTH.blocked,
      align: QTY_ALIGN,
      render: (row) => (
        <div className="field-cell">
          <span>{row.blockedQty}</span>
          {/*
           * 계약이 「화면이 보류를 따로 세지 않게 한다」며 내려준 값이다 — 세지 말고 그대로 쓴다.
           * 0과 「없음」을 함께 감춘다: 0은 보류가 없다는 뜻이고 없음은 세어 주지 않은 것이라,
           * 어느 쪽도 밝힐 것이 없다.
           */}
          {row.heldLotCount !== null && row.heldLotCount > 0 && (
            <Chip variant="status" status="warning" size="sm">
              {t.values.heldLotCount(row.heldLotCount)}
            </Chip>
          )}
        </div>
      ),
    },
    {
      key: 'uom',
      header: t.table.uom,
      width: WIDTH.uom,
      render: (row) => describeReference(toReference(uomLookup, row.uomId)),
    },
    {
      key: 'qualityStatusCode',
      header: t.table.qualityStatus,
      width: WIDTH.code,
      render: (row) => codeChip(row.qualityStatusCode),
    },
    {
      key: 'inventoryStatusCode',
      header: t.table.inventoryStatus,
      width: WIDTH.code,
      render: (row) => codeChip(row.inventoryStatusCode),
    },
    {
      key: 'ownership',
      header: t.table.ownership,
      width: WIDTH.ownership,
      render: (row) => (
        <div className="field-cell">
          {/*
           * **`null`이 확정된 뜻을 갖는 둘째 자리다**(계획 결정 10) — 계약이 소유처를
           * 「소유가 자사가 아닐 때의 거래처」로 두어 비는 것이 곧 자사 소유다.
           * 대시로 두면 자료 누락으로 읽힌다.
           */}
          <span>
            {row.ownerPartnerId === null
              ? t.values.ownedBySelf
              : describeReference(toReference(partnerLookup, row.ownerPartnerId))}
          </span>
          {codeChip(row.ownershipTypeCode)}
        </div>
      ),
    },
    {
      key: 'lastTransactionAt',
      header: t.table.lastTransactionAt,
      width: WIDTH.lastTransactionAt,
      render: (row) => orEmptyMark(formatTransactionAt(row.lastTransactionAt)),
    },
  ];

  /*
   * **정렬 가능 여부를 열마다 적지 않고 한 곳에서 파생시킨다**(이슈 #21 §6 「임의 열 정렬을
   * 열지 마세요」). 열 정의가 스스로 `sortable`을 켜면 계약 열거값 목록과 정본이 둘이 되어
   * 한쪽만 고쳐지고, 표에는 정렬 버튼이 보이는데 눌러도 요청에 실리지 않는 열이 생긴다.
   *
   * `sortableKeysOf`가 유일한 정본이다 — 요청에 실을 열을 고르는 `sort.ts`와 같은 자리를 본다.
   */
  const sortable = new Set<string>(sortableKeysOf(view));

  return columns.map((column) => ({ ...column, sortable: sortable.has(column.key) }));
};

export interface BalanceTableProps extends BalanceColumnDeps {
  rows: BalanceView[];
  isLoading: boolean;
  /**
   * 조회가 실제로 나갔는가. **거짓이면 「결과가 없다」로 말하지 않는다** —
   * 창고를 고르기 전에는 요청 자체가 나가지 않는데, 그때 결과 없음을 내면
   * 사용자가 자료가 없는 줄 알고 조건을 더 넓힌다(무엇을 해도 결과가 같다).
   */
  hasQuery: boolean;
  /** 결과는 있는데 이 쪽에는 없다. 「결과가 없다」와 다른 안내를 낸다. */
  isBeyondLast: boolean;
  sortKey: SortKey | null;
  onSortChange: (next: SortState | null) => void;
  onFirstPage: () => void;
  /** 이 구획이 소유하는 참조(단위·소유처)의 복구. 조건 줄의 참조는 조건 줄이 소유한다. */
  onRetryReferences: () => void;
}

/**
 * 재고 잔액 표 — **같은 목록의 세 보기**를 한 부품이 그린다.
 *
 * 보기를 부품 셋으로 나누지 않는 이유: 뒤쪽 여덟 열이 같고 빈 상태·정렬·안내가 전부 같아,
 * 나누면 같은 규칙이 세 벌로 복제되어 한쪽만 고쳐진다.
 *
 * **1단 그룹 헤더만 만든다**(이슈 #21 §4 미결 4). `groupAxisOf`가 축을 하나만 돌려주므로
 * 중첩 그룹을 만들 자리가 구조적으로 없다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const BalanceTable = ({
  view,
  rows,
  isLoading,
  hasQuery,
  isBeyondLast,
  sortKey,
  onSortChange,
  onFirstPage,
  onRetryReferences,
  itemLookup,
  lotLookup,
  locationLookup,
  uomLookup,
  partnerLookup,
}: BalanceTableProps) => {
  const lookups = { itemLookup, lotLookup, locationLookup, uomLookup, partnerLookup };
  const columns = buildBalanceColumns({ view, ...lookups });
  const groupAxis = groupAxisOf(view);

  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading.balances}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  /**
   * 조회 전 → 범위 밖 쪽 → 결과 없음 순서로 하나만 낸다. 셋은 사용자가 할 조치가 서로 다르다.
   *
   * **조회 전이 맨 앞이다.** 요청을 보내지 않은 상태를 「결과가 없다」로 말하면
   * 안내가 시키는 조치(조건을 줄여라)가 실제 원인(창고를 안 골랐다)과 어긋난다.
   * 사유는 조건 줄의 잠긴 버튼이 이미 밝히고 있으므로 여기서는 `live`를 붙이지 않는다 —
   * 붙이면 같은 사정이 보조기술에 두 번 읽힌다.
   */
  const emptySlot = (): ReactNode => {
    if (!hasQuery) {
      return (
        <EmptyState
          size="sm"
          title={t.empty.notQueriedTitle}
          description={t.empty.notQueriedDescription}
        />
      );
    }

    if (isBeyondLast) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.empty.beyondLastTitle}
          description={t.empty.beyondLastDescription}
          action={
            <Button variant="outlined" onClick={onFirstPage}>
              {t.actions.goFirstPage}
            </Button>
          }
        />
      );
    }

    return (
      <EmptyState
        size="sm"
        live
        title={t.empty.noResultTitle}
        description={t.empty.noResultDescription}
      />
    );
  };

  /**
   * 그룹 키. **이름이 아니라 축의 식별자로 묶는다** — 이름으로 묶으면 아직 못 푼 줄들이
   * 「알 수 없음」 한 덩어리로 잘못 뭉쳐, 서로 다른 품목이 한 그룹으로 보인다.
   *
   * 식별자를 문자열로 옮기는 자리는 `types.ts`의 `toIdentityKey` 하나뿐이다(행 키와 공유) —
   * **표시되는 값으로 옮기는 자리가 아니다.**
   */
  const groupKeyOf = (row: BalanceView): string =>
    toGroupKey(row, groupAxis === 'item' ? 'item' : 'location');

  /**
   * 그룹 헤더의 내용. **키를 되짚어 풀지 않고 그 그룹의 첫 줄에서 푼다** —
   * 키는 식별용이고 표시용이 아니다(문자열을 다시 숫자로 되돌리는 자리를 만들지 않는다).
   */
  const groupHeaderOf = (_key: string, groupRows: readonly BalanceView[]): ReactNode => {
    const first = groupRows[0];

    if (first === undefined) return null;

    return groupAxis === 'item'
      ? t.groupHeader.item(describeReference(toReference(itemLookup, first.itemId)))
      : t.groupHeader.location(describeReference(toReference(locationLookup, first.locationId)));
  };

  /*
   * 이 구획이 이름을 내는 참조 둘. **문구가 적은 대상과 「다시 시도」가 다시 부르는 대상이
   * 같아야 한다** — 조건 줄이 소유하는 참조(창고·위치·품목·LOT)는 여기서 말하지 않는다.
   */
  const listReferencesFailed = uomLookup.isError || partnerLookup.isError;

  return (
    <>
      {/*
       * `.wide-table`이 표에 최소 폭을 준다 — 폭이 모자라면 짓누르는 대신 가로로 넘긴다.
       * 스크롤 상자는 디자인 시스템 `Table`이 이미 갖고 있어 우리가 만들지 않는다.
       */}
      <div className="wide-table">
        <Table
          density="compact"
          columns={columns}
          rows={rows}
          /*
           * `inventoryBalanceId`가 묶인 줄에는 없어 행을 가르는 축 전부를 이어 키를 만든다.
           * **이 문자열은 화면에 나오지 않는다** — React key로만 쓰인다(#44).
           */
          getRowId={toRowKey}
          /*
           * **제어 정렬이다.** 계약의 `sort`가 전체 결과를 정렬해 쪽을 다시 나눠 주므로
           * 표가 현재 쪽 안에서 다시 정렬하면 서버가 준 순서를 덮어써 표시와 내용이 어긋난다.
           * `sort`를 주면 디자인 시스템이 내부 재정렬을 쓰지 않는다(실측).
           *
           * W-01-09는 정반대다 — 그 계약에는 정렬 파라미터가 없어 `defaultSort`만 준다.
           */
          sort={toSortState(sortKey)}
          onSortChange={onSortChange}
          groupBy={groupAxis === null ? undefined : groupKeyOf}
          renderGroupHeader={groupAxis === null ? undefined : groupHeaderOf}
          empty={emptySlot()}
        />
      </div>

      {/*
       * **밝히지 않으면 사용자가 쪽 안 정렬로 읽는다.** 서버가 전체를 정렬해 쪽을 나눠 주며,
       * 계약이 방향을 받지 않아 한 방향뿐이라는 사실도 함께 적는다.
       */}
      <p className="field-note">{t.notes.sortScope}</p>

      {/*
       * 묶는 보기에서만 낸다 — 묶지 않는 보기에서는 가리킬 그룹이 없어 안내가 뜻을 잃는다.
       * 밝히지 않으면 사용자가 「이 품목의 LOT은 이게 전부」로 읽는다.
       */}
      {groupAxis !== null && <p className="field-note">{t.notes.groupScope}</p>}

      {listReferencesFailed && (
        <div className="field-cell">
          <span className="field-note">{t.reasons.listReferencesFailed}</span>
          <Button variant="outlined" size="sm" onClick={onRetryReferences}>
            {messages.common.retry}
          </Button>
        </div>
      )}
    </>
  );
};
