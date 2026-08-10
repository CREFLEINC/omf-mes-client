import {
  Breadcrumb,
  Button,
  EmptyState,
  PageHeader,
  SkeletonText,
  Tabs,
  type TabItem,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { formatAsOf } from './as-of';
import { BalanceFilterBar } from './balance-filter-bar';
import { BalanceTable } from './balance-table';
import {
  defaultBusinessPeriod,
  resolveBusinessPeriod,
  type BusinessPeriod,
} from './business-period';
import {
  PLACEHOLDER_INVENTORY_STATUS_CODES,
  PLACEHOLDER_OWNERSHIP_TYPE_CODES,
  PLACEHOLDER_QUALITY_STATUS_CODES,
  toCodeOptions,
} from './code-options';
import {
  EMPTY_FILTERS,
  readFilters,
  readHistoryPage,
  readHistoryPeriod,
  readPage,
  readSelectedLotId,
  readSelectedTransaction,
  resolveFilters,
  readSortParam,
  readViewParam,
  SELECTION_KEYS,
  toBalanceFilterQuery,
  toSearchParams,
  toTransactionParam,
  type BalanceFilters,
} from './filters';
import { LoadErrorBanner } from './load-error-banner';
import {
  describeReference,
  lookupNote,
  toReference,
  useItemOptions,
  useLocationOptions,
  useLotOptions,
  usePartnerOptions,
  useUomOptions,
  useWarehouseOptions,
  type LookupResult,
} from './lookups';
import { LotDetailPane } from './lot-detail-pane';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import {
  useBalanceList,
  useLotDetail,
  useTransactionDetail,
  useTransactionList,
  type BalanceListQuery,
  type TransactionListQuery,
} from './queries';
import { defaultSortKey, nextSortKey, readSortKey, toSortQuery, type SortKey } from './sort';
import { TransactionLineTable } from './transaction-line-table';
import { TransactionPane } from './transaction-pane';
import type { BalanceView, SelectOption, TransactionView } from './types';
import {
  readViewAxis,
  resolveViewAxis,
  toGroupByQuery,
  VIEW_AXES,
  type ViewAxis,
} from './view-axis';

const t = messages.stockStatus;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: BalanceView[] = [];
const EMPTY_TRANSACTIONS: TransactionView[] = [];

/**
 * 참조 목록을 선택지로 옮긴다.
 *
 * **미사용 값을 빼지 않고 표식만 붙인다.** 참조를 `includeInactive=true`로 받는 이유는
 * 미사용 값을 참조하는 과거 재고의 이름을 풀기 위해서인데, 그 재고를 **조건으로 찾으려면**
 * 선택지에도 있어야 한다. 표식은 저장소 관례를 따른다(W-CO-02의 「(미사용)」).
 *
 * **표 칸에는 붙이지 않는다** — `ReferenceState`가 사용 여부를 나르지 않고, 표는 그 값의
 * 이름만 말하면 된다. 표식이 필요한 자리는 「고를 때」다.
 */
const toSelectOptions = (lookup: LookupResult): SelectOption[] =>
  lookup.entries.map((entry) => ({
    value: entry.value,
    label: entry.isActive ? entry.label : `${entry.label}${t.values.inactiveSuffix}`,
  }));

/** 조건 문자열을 참조 조회에 쓸 번호로 옮긴다. 비어 있으면 그 참조를 부르지 않는다. */
const toLookupId = (value: string): number | null => (value === '' ? null : Number(value));

/**
 * W-01-07 컨테이너 — **묶는 축을 바꿔 가며 보는 목록**이다.
 *
 * 조회 전용이라 편집 폼이 없다. 배치는 상하 1단이다(작업 1 기준) — 조건 줄 + 보기 탭 + 잔액 표.
 * 조회 조건·보기·정렬·쪽은 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 *
 * **W-01-09(`inbound-schedule`)의 골격을 따르되 세 가지가 정반대다.** 베끼면 틀린다:
 *
 * | | W-01-09 | 이 화면 |
 * | --- | --- | --- |
 * | 조건 | 하나도 없어도 조회한다 | **창고가 필수다** — 없으면 요청이 0회 |
 * | 정렬 | 표가 현재 쪽 안에서 정렬한다 | **서버가 전체를 정렬**하고 정렬 변경이 쪽을 되돌린다 |
 * | 참조 | 넷을 조건 없이 늘 부른다 | **둘이 조건에 매달린다**(위치←창고, LOT←품목+보기) |
 */
export const StockStatusScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * **주소 키의 수명 — 무엇이 바뀔 때 무엇을 비우는가.**
   *
   * 이 화면 최대의 위험 자리다. 「비운다」와 「비우지 않는다」를 이 표 한 곳에 모은다 —
   * 규칙이 흩어지면 한쪽만 고쳐져 비대칭이 생긴다(보기를 바꾸면 선택이 풀리는데 쪽을 옮기면
   * 안 풀리는 식).
   *
   * | # | 조작 | `view` | 조건 8종 | `sort` | `page` | `sel` | `hfrom`·`hto` | `hpage` | `tx` | 조건 줄 초안 |
   * | :-: | --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
   * | 1 | **보기 전환** | 바뀐다 | **유지** | **보기 기본값으로** | **첫 쪽** | **비운다** | 비운다 | 비운다 | 비운다 | **유지** |
   * | 2 | 조건 변경·조회 | 유지 | 바뀐다 | 유지 | **첫 쪽** | **비운다** | 비운다 | 비운다 | 비운다 | (적용됨) |
   * | 3 | 초기화 | 유지 | **비운다**(창고 포함) | **비운다** | 첫 쪽 | 비운다 | 비운다 | 비운다 | 비운다 | 비운다 |
   * | 4 | 정렬 열 변경·해제 | 유지 | 유지 | 바뀐다 | **첫 쪽** | **비운다** | 비운다 | 비운다 | 비운다 | 유지 |
   * | 5 | 쪽 이동 | 유지 | 유지 | 유지 | 옮긴 쪽 | **비운다** | 비운다 | 비운다 | 비운다 | 유지 |
   * | 6 | LOT 고르기·해제 | 유지 | 유지 | 유지 | **유지** | 넣고 뺀다 | **기본 1개월로 채운다** | 첫 쪽 | 비운다 | 유지 |
   * | 7 | 갱신 결과에 고른 LOT 없음 | 유지 | 유지 | 유지 | 유지 | **비운다** | 비운다 | 비운다 | 비운다 | 유지 |
   * | 8 | **새로고침**(재조회) | 유지 | 유지 | 유지 | 유지 | **유지** | **유지** | **유지** | **유지** | 유지 |
   * | 9 | 이력 기간 변경·조회 | 유지 | 유지 | 유지 | 유지 | 유지 | 바뀐다 | **첫 쪽** | **비운다** | (적용됨) |
   * | 10 | 거래 고르기·해제 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 넣고 뺀다 | 유지 |
   * | 11 | **이력 쪽 이동** | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 옮긴 쪽 | **비운다** | 유지 |
   *
   * **왜 이렇게 정했는가**
   *
   * - **1행의 `sort`가 「유지」가 아닌 이유**: 정렬 열은 보기마다 있고 없다. 위치별 보기의
   *   `locationCode` 정렬을 품목별로 가져가면 계약은 받지만 표에 그 열이 없어 **정렬 표시가
   *   어디에도 나타나지 않는 상태**가 된다.
   * - **1행의 조건이 「유지」인 이유**: 계약 실측상 조건 전부가 세 `groupBy` 값에서 동일하게
   *   받아들여진다. 축을 바꿨다고 조건을 버리면 사용자가 방금 좁힌 범위가 사라진다.
   * - **4행이 첫 쪽으로 되돌아가는 이유**: 이 화면의 정렬은 **서버 정렬**이라 전체 순서가 바뀐다
   *   (W-01-09와 반대다 — 그쪽은 쪽 안 정렬이라 쪽을 건드리지 않았다). 3쪽의 뜻이 달라진다.
   * - **3행의 `sort`가 1행과 다른 이유**(검증 1회차 F2로 정정): 초기화는 **첫 진입과 같은
   *   상태로 되돌리는 것**이다. 보기 기본 열을 주소에 써 넣으면 첫 진입으로는 만들 수 없는
   *   상태가 생기고, 창고가 비어 **요청이 0회인 표**에 「정렬됨」이 보조기술로 읽힌다.
   *   「기본값은 주소에 적지 않는다」는 `filters.ts`의 자기 규칙과도 어긋난다.
   *   1행(보기 전환)은 정정 대상이 아니다 — 그쪽은 조회가 이어지고, 열이 없는 정렬을
   *   끌고 가지 않기 위해 그 보기의 기본 열이 필요하다.
   * - **8행이 아무것도 비우지 않는 이유**: 새로고침은 **같은 조회를 다시 하는 것**이다.
   *   무언가를 비우면 새로고침이 조건 변경으로 둔갑한다.
   * - **9·11행이 `tx`를 비우는 이유**: 고른 거래는 지금 보고 있는 이력 목록의 한 줄이다.
   *   기간이나 쪽이 바뀌면 그 줄이 목록에 없을 수 있는데, 남겨 두면 아래 라인 표가
   *   **위에 보이지 않는 거래**를 가리킨 채 열려 있다.
   * - **11행이 이 표의 열한째 줄인 이유**: 이력 쪽은 잔액 쪽(`page`)과 **다른 조회**라
   *   따로 센다. 조작이 하나 늘었으므로 규칙을 정하기 전에 이 표에 줄부터 더했다 —
   *   그것이 이 표가 지시하는 순서다.
   *
   * **구현 규칙 둘** — 이 둘이 표를 코드로 지킨다.
   *
   * 1. `toSearchParams(view, filters, sort, page)`가 **`SELECTION_KEYS`의 다섯을 만들지 않는다.**
   *    1~5행이 함께 지켜진다. 고르는 쪽만 덧붙인다.
   * 2. 7행은 **고른 식별자에 묶인 effect 한 곳**이 한다. 클릭 핸들러에 두면
   *    뒤로가기·앞으로가기·주소 직접 편집이 통째로 샌다.
   *
   * **비우는 자리는 이 열한 줄뿐이고, 열두째가 생기면 이 표에 행을 먼저 더한다.**
   */
  /*
   * **주소가 바뀔 때만 새 참조를 만든다.** 렌더마다 새 객체를 만들면 내용이 같아도 참조가 달라,
   * 이 값을 되돌림 기준으로 삼는 조건 줄이 **부모가 다시 그려질 때마다** 입력을 덮어쓴다(#43).
   * 조회 응답이 도착하는 순간(대기 → 성공)이 실제로 그 자리이며, 사용자에게는
   * 「고르던 값이 갑자기 사라졌다」로 나타난다. `searchParams`는 주소가 바뀔 때만 새 참조다.
   */
  /*
   * **읽으면서 뜻을 잃은 종속 조건을 걷어낸다**(`resolveFilters`) — 부모가 빠진 LOT·위치는
   * 요청에도 칩에도 남지 않는다. 보기를 조건에서 파생시키는 것과 같은 갈래다.
   */
  const filters = useMemo<BalanceFilters>(
    () => resolveFilters(readFilters(searchParams)),
    [searchParams],
  );

  const warehouseId = toLookupId(filters.warehouse);
  const itemId = toLookupId(filters.item);

  /*
   * **보기를 조건보다 뒤에 읽는다.** LOT별 보기가 품목에 매달리므로(계획 결정 11) 어느 보기를
   * 열 수 있는지는 조건이 정한다 — 품목이 없으면 `view=lot`을 품목별로 읽는다.
   * 파생이라 effect가 필요 없다: `itemId`도 같은 주소에서 나온 값이라 같은 렌더에서 정해진다.
   */
  const view = resolveViewAxis(readViewParam(searchParams), itemId !== null);
  const sortKey = readSortKey(readSortParam(searchParams), view);
  const page = readPage(searchParams);

  /*
   * **고른 LOT도 읽는 자리에서 뜻을 판정한다**(`resolveFilters`·`resolveViewAxis`와 같은 갈래).
   * 가리킬 줄이 있으려면 **둘 다** 있어야 한다.
   *
   * - **LOT별 보기여야 한다.** 다른 보기의 줄은 LOT을 가리키지 않는다 — 그러지 않으면
   *   `?view=item&sel=…` 주소에서 화면에 없는 LOT의 상세를 한 번 부르고 나서 지운다.
   * - **창고가 있어야 한다.** 없으면 목록 요청이 0회라(결정 5) 고른 줄이 **영영 오지 않는다** —
   *   상세만 한 번 부르고 구획이 스켈레톤에 갇히며, 정리 effect는 목록 응답이 없어 돌아서므로
   *   `sel`도 지워지지 않는다. 회복은 창고를 고르는 순간 자동으로 일어나지만, 그때까지
   *   화면이 오지 않을 것을 기다리는 표기를 낸다.
   *
   * 두 잣대 모두 이 화면이 이미 쓰는 형태다 — `?wh=0`·`sel=0`을 버리는 것과 같은 갈래다.
   *
   * **주소는 고쳐 쓰지 않는다.** 보기·창고를 되돌리면 그 선택이 되살아나야 하고, 조회·보기 전환은
   * `toSearchParams`가 `sel`을 만들지 않으므로 어긋남이 쌓이지 않는다.
   */
  const selectedLotId =
    view === 'lot' && warehouseId !== null ? readSelectedLotId(searchParams) : null;

  /*
   * **창고를 고르기 전에는 조회하지 않는다**(계획 결정 5). 계약은 「창고·품목·LOT 중 적어도
   * 하나」를 요구하지만 이 화면은 그보다 좁게 창고를 필수로 둔다 —
   * **창고 필수는 이 화면의 규칙이지 계약의 규칙이 아니다.** 현장 단말(M-01-04)은 LOT만 들고
   * 같은 API로 들어오므로, 다음 화면이 이 코드를 보고 계약을 잘못 읽지 않게 여기에 적어 둔다.
   */
  const listQuery: BalanceListQuery | null =
    warehouseId === null
      ? null
      : {
          ...toGroupByQuery(view),
          ...toBalanceFilterQuery(filters),
          ...toSortQuery(sortKey),
          warehouseId,
          ...(page > 1 ? { page } : {}),
        };

  const list = useBalanceList(listQuery);
  const rows = list.data?.items ?? EMPTY_ROWS;
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  /**
   * 고른 줄. **목록 응답에서 찾는다** — 상세 구획의 수량 다섯이 이 줄에서 온다.
   * 계약의 LOT 상세는 만들어질 때의 초기 수량만 갖고, 지금 남은 양은 잔액 응답이 나른다.
   */
  const selectedRow = rows.find((row) => row.lotId === selectedLotId) ?? null;

  const lotDetail = useLotDetail(selectedLotId);

  /*
   * **이력의 기간·쪽·고른 거래도 읽는 자리에서 판정한다**(`selectedLotId`와 같은 갈래).
   * 셋 다 **고른 LOT에 매달린 값**이라, LOT이 없으면 가리킬 대상이 없다 —
   * 판정을 여기 두지 않으면 `?hfrom=…&tx=…`만 남은 주소에서 이력과 라인을 한 번씩 부르고
   * 나서 구획도 없이 버린다(사용자에게는 아무 일도 없는데 요청만 는다).
   *
   * **기간은 걸러 내지 않고 그대로 읽는다.** 성한지는 `business-period.ts`가 한 곳에서
   * 정하고 그 판정이 곧 사용자에게 낼 사유가 된다 — 여기서 지우면 「왜 조회가 안 되는가」를
   * 말할 근거가 사라진다.
   */
  const historyPeriod = readHistoryPeriod(searchParams);
  const historyPage = readHistoryPage(searchParams);
  const resolvedPeriod = resolveBusinessPeriod(historyPeriod);

  /**
   * 이력 구획이 서는 자리 — **고른 LOT과 그 LOT을 찾은 창고가 함께** 있어야 한다.
   *
   * 창고는 `selectedLotId`가 이미 보장하지만(위 판정), 라인 표가 **위치 이름을 풀 수 있는
   * 범위**로 창고 번호를 쓴다. 둘을 한 값으로 묶어 두면 그 번호를 「없을 수도 있는 값」으로
   * 다시 다루지 않아도 되고, 없을 때의 자리표시 번호를 지어낼 일도 없다.
   */
  const historyScope =
    selectedLotId !== null && warehouseId !== null ? { lotId: selectedLotId, warehouseId } : null;

  const historyQuery: TransactionListQuery | null =
    historyScope === null || resolvedPeriod.kind === 'blocked'
      ? null
      : {
          ...resolvedPeriod.query,
          lotId: historyScope.lotId,
          ...(historyPage > 1 ? { page: historyPage } : {}),
        };

  const history = useTransactionList(historyQuery);
  const historyRows = history.data?.items ?? EMPTY_TRANSACTIONS;
  const historyPageView = toPageView(
    history.data?.page ?? { page: historyPage, size: 0, total: 0 },
    historyRows.length,
  );

  /*
   * 고른 거래. **이력을 조회하고 있을 때만 뜻이 있다** — 기간이 없으면 위 목록이 비어 있어
   * 라인 표만 홀로 열린 상태가 된다.
   */
  const selectedTransaction = historyQuery === null ? null : readSelectedTransaction(searchParams);
  const transactionDetail = useTransactionDetail(selectedTransaction);

  /*
   * **기준 시각은 응답이 도착한 시각이다.** 렌더 시각을 쓰면 아무것도 안 했는데 시각이
   * 계속 바뀌어, 사용자가 자료가 갱신되고 있다고 읽는다.
   *
   * 이 값은 표기만이 아니라 **유효기한 판정의 「오늘」**이기도 하다(아래 `detailPane`) —
   * 화면이 스스로를 「조회 시점 스냅샷」이라 말했으므로 그 안의 판정도 같은 시각을 봐야 한다.
   * 렌더 시각을 따로 쓰면 머리글은 어제 시각을 말하는데 표식만 오늘로 갈린다.
   */
  const asOf = formatAsOf(list.data === undefined ? null : list.dataUpdatedAt);

  /*
   * **LOT별 보기는 품목을 고른 뒤에만 연다**(계획 결정 11). 품목이 LOT 이름을 풀 범위를 정한다 —
   * 열어 두면 표의 LOT 칸이 거의 전부 「알 수 없음」이 되어 정상 값이 잘못된 값으로 보인다(#47).
   *
   * 위치 선택칸이 창고에 매달리는 것(결정 5)과 **같은 갈래의 규칙**이다.
   */
  const canUseLotView = itemId !== null;

  const warehouses = useWarehouseOptions();
  /* 매달림은 `enabled`로만 표현한다 — 화면이 조건을 다시 계산하면 두 곳이 어긋난다. */
  const locations = useLocationOptions(warehouseId);
  const items = useItemOptions();
  /*
   * **LOT 이름을 내는 자리가 있으면 부른다.** 「쓰지 않으면 부르지 않는다」의 뒷면이며,
   * 한쪽만 지키면 부르지 않는 참조의 이름을 「알 수 없음」으로 확정 표시하게 된다.
   * 자리는 둘이다 — LOT별 보기의 LOT 열, 그리고 **보기와 무관한 LOT 조건 칩**.
   */
  const isLotNameShown = view === 'lot' || filters.lot !== '';
  const lots = useLotOptions(itemId, isLotNameShown);
  const uoms = useUomOptions();
  const partners = usePartnerOptions();

  /*
   * LOT 선택칸 아래 안내. **훅을 켜는 값과 같은 값을 본다** — 다르면 선택지는 채워졌는데
   * 「고르면 채워집니다」라고 말하는 어긋남이 생긴다.
   *
   * `isLotNameShown`이면 품목이 있다 — `resolveViewAxis`와 `resolveFilters`가 각각 보장하므로
   * 품목 유무를 여기서 다시 묻지 않는다(물으면 늘 참인 죽은 가지가 된다).
   */
  const lotNote = isLotNameShown ? lookupNote(lots) : t.filters.lotNeedsItem;

  /**
   * 조건을 주소에 반영한다. 주소가 정본이라 조회는 주소가 바뀐 결과로 일어난다.
   *
   * **주소 갱신은 한 번이다** — 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 늘어
   * 사용자가 뒤로 눌렀는데 같은 자리로 돌아온 것처럼 보인다.
   */
  const apply = (
    nextView: ViewAxis,
    nextFilters: BalanceFilters,
    nextSort: SortKey | null,
    nextPage = 1,
  ): void => {
    setSearchParams(toSearchParams(nextView, nextFilters, nextSort, nextPage));
  };

  /**
   * 보기 전환(수명 표 1행).
   *
   * 조건은 그대로 두고 **정렬을 그 보기의 기본값으로, 쪽을 첫 쪽으로** 되돌린다.
   * `toSearchParams`가 `sel`을 만들지 않으므로 고른 LOT도 함께 풀린다(작업 2).
   */
  const changeView = (nextValue: string): void => {
    const nextView = readViewAxis(nextValue);

    if (nextView === view) return;

    apply(nextView, filters, defaultSortKey(nextView));
  };

  /**
   * 정렬 열 변경·해제(수명 표 4행).
   *
   * **첫 쪽으로 되돌린다** — 서버가 전체 결과를 다시 정렬해 쪽을 나누므로 지금 쪽 번호의 뜻이
   * 달라진다. 그대로 두면 사용자가 보던 것과 무관한 행이 온다.
   */
  const changeSort = (next: Parameters<typeof nextSortKey>[1]): void => {
    apply(view, filters, nextSortKey(sortKey, next, view));
  };

  /**
   * LOT 고르기·해제(수명 표 6행).
   *
   * **보이는 줄을 바꾸지 않는다** — 조건·보기·정렬·쪽을 그대로 두고 `sel`만 넣고 뺀다.
   * 고를 때 첫 쪽으로 튀면 사용자가 3쪽에서 고른 LOT의 상세를 보는 동안 목록은 1쪽이 된다.
   */
  const toggleSelectLot = (lotId: number): void => {
    const next = toSearchParams(view, filters, sortKey, page);

    if (lotId !== selectedLotId) {
      next.set(SELECTION_KEYS.lot, String(lotId));

      /*
       * **이력 기간을 함께 채운다**(수명 표 6행). 영업일 범위 없이는 수불 이력을 부를 수
       * 없으므로(계획 결정 14), 비워 두면 LOT을 고를 때마다 사용자가 두 칸을 채워야 한다.
       *
       * 「오늘」은 여기서 정한다 — 기본 기간을 만드는 함수를 순수하게 두어야 테스트가
       * 실행 환경의 시각을 검사하지 않는다.
       */
      const period = defaultBusinessPeriod(new Date());

      next.set(SELECTION_KEYS.historyFrom, period.from);
      next.set(SELECTION_KEYS.historyTo, period.to);
    }

    setSearchParams(next);
  };

  /**
   * 이력 조건을 주소에 반영한다(수명 표 9행).
   *
   * **고른 거래를 비운다** — 기간이 바뀌면 그 거래가 새 목록에 없을 수 있는데, 남기면
   * 아래 라인 표가 위에 보이지 않는 거래를 가리킨 채 열려 있다. 이력 쪽도 첫 쪽으로
   * 되돌린다(조건이 바뀌면 3쪽의 뜻이 달라진다 — 잔액 목록과 같은 규칙이다).
   *
   * **잔액 쪽 조건은 하나도 건드리지 않는다.** 이력은 고른 LOT에 대한 다른 질문이다.
   */
  const applyHistory = (period: BusinessPeriod, nextPage = 1): void => {
    if (selectedLotId === null) return;

    const next = toSearchParams(view, filters, sortKey, page);

    next.set(SELECTION_KEYS.lot, String(selectedLotId));
    next.set(SELECTION_KEYS.historyFrom, period.from);
    next.set(SELECTION_KEYS.historyTo, period.to);

    if (nextPage > 1) next.set(SELECTION_KEYS.historyPage, String(nextPage));

    setSearchParams(next);
  };

  /**
   * 거래 고르기·해제(수명 표 10행).
   *
   * **보이는 이력 줄을 바꾸지 않는다** — 기간·쪽을 그대로 두고 `tx`만 넣고 뺀다.
   * 영업일과 번호를 함께 싣는다: 계약이 영업일을 식별자의 일부로 둔다.
   */
  const toggleSelectTransaction = (row: TransactionView): void => {
    if (selectedLotId === null) return;

    const ref = { businessDate: row.businessDate, transactionId: row.inventoryTransactionId };
    const isSelected =
      selectedTransaction !== null &&
      selectedTransaction.businessDate === ref.businessDate &&
      selectedTransaction.transactionId === ref.transactionId;

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);

      if (isSelected) next.delete(SELECTION_KEYS.transaction);
      else next.set(SELECTION_KEYS.transaction, toTransactionParam(ref));

      return next;
    });
  };

  /*
   * 갱신된 결과에 고른 LOT이 없으면 `sel`을 주소에서 뗀다(수명 표 7행).
   * 남겨 두면 아래 구획이 화면에 없는 LOT을 가리킨 채 주소만 남는다.
   *
   * **정리를 클릭 핸들러가 아니라 고른 식별자에 묶는다.** 뒤로가기·앞으로가기·주소 직접
   * 편집은 핸들러를 거치지 않고 `sel`만 바꾸므로, 핸들러에 두면 그 경로가 통째로 샌다.
   *
   * **받은 결과가 있을 때만 판정한다.** 조회를 기다리는 동안에는 줄이 비어 있어, 가드가 없으면
   * 「고른 LOT이 사라졌다」로 읽혀 상세가 깜빡 닫힌다.
   *
   * `replace`로 바꿔 정리가 뒤로가기 기록을 늘리지 않게 한다 — 사용자가 한 조작이 아니다.
   */
  useEffect(() => {
    if (selectedLotId === null) return;
    if (list.data === undefined) return;
    if (list.data.items.some((row) => row.lotId === selectedLotId)) return;

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);

        /*
         * **고른 LOT에 매달린 키를 함께 뗀다.** 이력 기간·쪽·고른 거래는 그 LOT의 이력을
         * 가리키는 값이라, `sel`만 지우면 아무도 읽지 않는 상태가 주소에 남는다.
         */
        for (const key of Object.values(SELECTION_KEYS)) next.delete(key);

        return next;
      },
      { replace: true },
    );
  }, [selectedLotId, list.data, setSearchParams]);

  /**
   * 참조 실패의 복구 경로 — **이름이 보이는 자리마다 하나씩** 둔다.
   *
   * 나누는 기준은 「그 이름이 어느 구획에서 보이는가」다. 실패 안내와 「다시 시도」는
   * 그 이름이 실제로 실패로 보이는 자리에 있어야 사용자가 무엇을 되살리는지 알 수 있고,
   * **안내 문구가 적은 대상과 다시 부르는 대상이 어긋나지 않는다** — 어긋나면 눌러도
   * 한쪽은 실패인 채로 남는데 문구는 둘 다 고쳐질 것처럼 말한다.
   *
   * | 참조 | 언제 부르나 | 이름이 보이는 자리 | 복구 |
   * | --- | --- | --- | --- |
   * | 창고 | 항상 | 조건 줄 선택칸 · 조건 칩 · **거래 라인의 출발·도착 창고** | **조건 줄 · 라인 표** |
   * | 위치 | **창고를 고른 뒤** | 조건 줄 · 위치별 보기의 그룹 헤더·열 · **거래 라인의 출발·도착 위치** | **조건 줄 · 라인 표** |
   * | 품목 | 항상 | 조건 줄 · 세 보기의 품목 열·그룹 헤더 · **거래 라인의 품목** | **조건 줄 · 라인 표** |
   * | LOT | **품목 + LOT별 보기** | 조건 줄 · LOT별 보기의 LOT 열 · **거래 라인의 LOT** | **조건 줄 · 라인 표** |
   * | 단위 | 항상 | 세 보기의 단위 열 · LOT 상세의 수량·보류 · **거래 라인의 단위** | **목록 · 상세 · 라인 표** |
   * | 소유처 | 항상 | 세 보기의 소유 열 · **LOT 상세의 발급처** | **목록 구획 · 상세 구획** |
   *
   * 앞 넷이 조건 줄인 이유가 이 표의 요점이다 — 넷 다 **선택칸에 이름이 실린다.**
   * 뒤 둘은 조건에 없어 표에서만 보이므로 목록 구획이 소유한다.
   *
   * 복구가 **여러 자리에 있는 이유**: 같은 참조가 여러 구획에서 이름을 낸다. 규칙은
   * 「그 이름이 실제로 실패로 보이는 자리에 둔다」이므로, 아래 구획을 읽는 사람이 실패를
   * 보면서 위 구획까지 올라가 버튼을 찾게 두지 않는다. **각 버튼이 부르는 대상은 그 구획의
   * 문구가 적은 대상과 정확히 같다** — 그래야 눌렀을 때 문구가 말한 것만큼 고쳐진다.
   *
   * 이력 목록(헤더)에는 **참조가 하나도 없다** — 코드와 날짜뿐이라 복구할 이름이 없다.
   * 이름을 내는 것은 그 아래 라인 표다.
   *
   * **일곱째 참조가 생기면 이 표에 먼저 줄을 더한다.**
   */
  const filterReferences = [warehouses, locations, items, lots];
  const listReferences = [uoms, partners];
  const lineReferences = [items, lots, warehouses, locations, uoms];

  const retryFilterReferences = (): void => {
    for (const reference of filterReferences) reference.refetch();
  };

  const retryListReferences = (): void => {
    for (const reference of listReferences) reference.refetch();
  };

  const retryLineReferences = (): void => {
    for (const reference of lineReferences) reference.refetch();
  };

  /**
   * 보기 탭. **활성 보기의 `content`에만 표를 담는다** — `Tabs`는 패널을 전부 렌더하고
   * 비활성만 감추므로, 세 패널에 표를 두면 같은 자료가 세 번 그려지고 접근성 트리에
   * 표가 셋이 된다.
   *
   * **조회에 실패하면 표를 그리지 않는다.** 행이 0건인 표는 「결과가 없습니다」를 내는데,
   * 실패를 그렇게 말하면 사용자가 자료가 없는 줄 알고 조건을 넓힌다 — 무엇을 해도 결과가 같다.
   * 배너가 사유와 「다시 시도」를 이미 내고 있다. 조건 줄과 보기 탭은 남긴다 —
   * 조건을 고칠 수단까지 사라지면 안 된다.
   */
  const balancePane = list.isError ? null : (
    <>
      <BalanceTable
        view={view}
        rows={rows}
        isLoading={list.isPending && listQuery !== null}
        hasQuery={listQuery !== null}
        isBeyondLast={pageView.isBeyondLast}
        sortKey={sortKey}
        selectedLotId={selectedLotId}
        onSortChange={changeSort}
        onFirstPage={() => {
          apply(view, filters, sortKey);
        }}
        onToggleSelect={toggleSelectLot}
        itemLookup={items}
        lotLookup={lots}
        locationLookup={locations}
        uomLookup={uoms}
        partnerLookup={partners}
        onRetryReferences={retryListReferences}
      />
      {listQuery !== null && !list.isPending && (
        <PageNav
          view={pageView}
          onChange={(nextPage) => {
            apply(view, filters, sortKey, nextPage);
          }}
        />
      )}
    </>
  );

  const tabItems: TabItem[] = VIEW_AXES.map((axis) => ({
    value: axis,
    label: t.views[axis],
    /* LOT별만 잠긴다. 사유는 탭 아래 안내가 밝힌다 — 잠긴 탭은 포커스를 받지 못한다. */
    disabled: axis === 'lot' && !canUseLotView,
    content: axis === view ? balancePane : null,
  }));

  /**
   * 아래 구획. 넷 중 하나만 낸다 — 사용자가 할 조치가 서로 다르다.
   *
   * **상세가 실패해도 위 목록은 그대로 둔다.** 배너를 이 구획 안에만 내는 것이 그 규칙을
   * 코드로 지키는 형태다 — 화면 전체를 덮으면 사용자가 목록까지 못 쓰게 되는데,
   * 실패한 것은 고른 LOT 한 벌뿐이다.
   */
  const detailPane = (): ReactNode => {
    if (selectedLotId === null) {
      return (
        <EmptyState
          size="sm"
          title={t.empty.noSelectionTitle}
          description={t.empty.noSelectionDescription}
        />
      );
    }

    if (lotDetail.isError) {
      return (
        <LoadErrorBanner
          error={lotDetail.error}
          onRetry={() => {
            void lotDetail.refetch();
          }}
        />
      );
    }

    /*
     * 고른 번호는 있는데 그 줄이나 상세가 아직 없다 — 기다리는 중이다.
     * **정리 effect가 결과를 보고 판정할 때까지 「고르지 않았다」로 되돌리지 않는다** —
     * 되돌리면 응답이 오는 사이에 구획이 깜빡 닫힌다.
     */
    if (selectedRow === null || lotDetail.data === undefined) {
      return (
        <div role="status" aria-label={t.loading.lotDetail}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <LotDetailPane
        row={selectedRow}
        detail={lotDetail.data}
        /*
         * **유효기한 판정의 「오늘」도 기준 시각이다.** 목록 응답이 도착한 시각을 쓴다 —
         * 이 구획의 수량이 그 응답에서 왔고 머리글의 「기준 …」이 그 시각을 말한다.
         * 렌더 시각을 쓰면 근거가 둘로 갈린다(자정을 넘겨 열어 둔 화면에서 실제로 갈린다).
         *
         * 여기까지 왔으면 `selectedRow`가 목록 응답에서 나온 줄이라 `dataUpdatedAt`은 0이
         * 아니다 — 0을 가르는 가지를 따로 두면 닿을 수 없는 죽은 가지가 된다.
         */
        today={new Date(list.dataUpdatedAt)}
        uomLookup={uoms}
        partnerLookup={partners}
        /* 이 구획이 이름을 내는 참조는 목록 구획과 같은 둘이다(위 표) — 같은 둘을 다시 부른다. */
        onRetryReferences={retryListReferences}
      />
    );
  };

  /**
   * 이력 구획의 **아랫단** — 고른 거래의 라인. 넷 중 하나만 낸다.
   *
   * **라인 조회가 실패해도 위 이력 목록은 그대로 둔다.** 배너를 이 자리에만 내는 것이 그
   * 규칙을 코드로 지키는 형태다 — 실패한 것은 고른 거래 한 벌뿐이다.
   * 같은 이유로 이력 조회 실패는 LOT 상세와 잔액 목록을 가리지 않는다(각 구획이 자기 배너를 낸다).
   */
  const transactionLinePane = (scopeWarehouseId: number): ReactNode => {
    if (selectedTransaction === null) {
      return (
        <EmptyState
          size="sm"
          title={t.history.empty.noSelectionTitle}
          description={t.history.empty.noSelectionDescription}
        />
      );
    }

    if (transactionDetail.isError) {
      return (
        <LoadErrorBanner
          error={transactionDetail.error}
          onRetry={() => {
            void transactionDetail.refetch();
          }}
        />
      );
    }

    if (transactionDetail.data === undefined) {
      return (
        <div role="status" aria-label={t.loading.transactionLines}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <TransactionLineTable
        lines={transactionDetail.data.lines}
        /* **위치 이름을 풀 수 있는 범위**다 — 이 구획을 여는 자리(`historyScope`)가 정한다. */
        scopeWarehouseId={scopeWarehouseId}
        itemLookup={items}
        lotLookup={lots}
        warehouseLookup={warehouses}
        locationLookup={locations}
        uomLookup={uoms}
        onRetryReferences={retryLineReferences}
      />
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
        actions={
          <>
            {/*
             * 조회 시점 스냅샷임을 밝힌다 — 이 화면은 자동으로 갱신되지 않는다.
             * 조회하기 전에는 가리킬 시각이 없어 내지 않는다.
             *
             * **live 영역으로 두지 않는다**(`<output>`은 암묵적으로 `role="status"`다).
             * 쪽 이동·정렬 변경·새로고침마다 낭독되는데, 이 화면은 다른 자리에서도
             * 같은 사정이 두 번 읽히지 않게 `live`를 일부러 붙이지 않았다 —
             * 조회가 끝났음은 표의 빈 상태가 이미 알린다.
             */}
            {asOf !== null && (
              <span data-testid="as-of" className="field-note">
                {t.asOf(asOf)}
              </span>
            )}
            <Button
              variant="outlined"
              size="sm"
              disabled={listQuery === null}
              onClick={() => {
                /*
                 * **화면이 보고 있는 조회를 전부 다시 한다.** 목록만 다시 부르면 상세 구획에
                 * 갱신된 수량(고른 잔액 줄에서 온다)과 갱신되지 않은 보류·유효기한이 섞이고,
                 * 그 위의 「기준 {시각}」이 화면 일부에 대해 거짓이 된다. 이 화면은 스스로를
                 * 「조회 시점 스냅샷」으로 선언했고 기준 시각이 그 선언의 유일한 표시다.
                 *
                 * **고른 LOT이 없으면 부르지 않는다.** 설치본(`@tanstack/query-core@5.101.4`)의
                 * `Query.fetch`는 `enabled`를 보지 않는다 — `refetch()`는 비활성 쿼리에서도
                 * `queryFn`을 실행한다. 지금은 `queryFn`이 던져서 요청이 나가지 않지만,
                 * 그것은 **가드가 막는 것**이지 훅이 무동작인 것이 아니다. 뜻을 던지기에
                 * 기대지 않고 여기서 밝힌다.
                 *
                 * 조건·보기·정렬·쪽·선택은 하나도 바꾸지 않는다(수명 표 8행).
                 */
                void list.refetch();

                if (selectedLotId !== null) void lotDetail.refetch();
                /* 이력도 같은 이유로 함께 부른다 — 기간이 없으면 부를 것이 없다. */
                if (historyQuery !== null) void history.refetch();
                if (selectedTransaction !== null) void transactionDetail.refetch();
              }}
            >
              {t.actions.refresh}
            </Button>
          </>
        }
      />

      {/* 조회 실패는 빈 상태로 오인시키지 않는다 — 「없습니다」로 내면 자료가 없는 줄 안다. */}
      {list.isError && (
        <LoadErrorBanner
          error={list.error}
          onRetry={() => {
            void list.refetch();
          }}
        />
      )}

      <section className="pane" aria-label={t.panes.list}>
        {/* 결과가 없어도 조건 줄은 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
        <BalanceFilterBar
          appliedFilters={filters}
          warehouseOptions={toSelectOptions(warehouses)}
          itemOptions={toSelectOptions(items)}
          lotOptions={toSelectOptions(lots)}
          locationOptions={toSelectOptions(locations)}
          qualityStatusOptions={toCodeOptions(
            PLACEHOLDER_QUALITY_STATUS_CODES,
            rows,
            (row) => row.qualityStatusCode,
            filters.qualityStatus,
          )}
          inventoryStatusOptions={toCodeOptions(
            PLACEHOLDER_INVENTORY_STATUS_CODES,
            rows,
            (row) => row.inventoryStatusCode,
            filters.inventoryStatus,
          )}
          ownershipOptions={toCodeOptions(
            PLACEHOLDER_OWNERSHIP_TYPE_CODES,
            rows,
            (row) => row.ownershipTypeCode,
            filters.ownership,
          )}
          chipNames={{
            warehouse: describeReference(toReference(warehouses, warehouseId)),
            item: describeReference(toReference(items, itemId)),
            lot: describeReference(toReference(lots, toLookupId(filters.lot))),
            location: describeReference(toReference(locations, toLookupId(filters.location))),
          }}
          warehouseNote={lookupNote(warehouses)}
          itemNote={lookupNote(items)}
          /* 매달린 조건이 비어 선택지가 없는 것을 「그런 값이 없다」로 읽지 않게 한다. */
          lotNote={lotNote}
          locationNote={
            warehouseId === null ? t.filters.locationNeedsWarehouse : lookupNote(locations)
          }
          referencesFailed={filterReferences.some((reference) => reference.isError)}
          onRetryReferences={retryFilterReferences}
          onSearch={(nextFilters) => {
            apply(view, nextFilters, sortKey);
          }}
          onRemoveFilter={(key) => {
            apply(view, { ...filters, [key]: key === 'includeZero' ? false : '' }, sortKey);
          }}
          /*
           * **초기화는 정렬도 없앤다**(수명 표 3행 — 검증 1회차 F2 정정).
           * 첫 진입과 같은 상태로 되돌린다: 주소에 `sort`가 없는 것이 곧 「정렬 없음」이다.
           */
          onReset={() => {
            apply(view, EMPTY_FILTERS, null);
          }}
        />

        <Tabs aria-label={t.views.label} items={tabItems} value={view} onChange={changeView} />

        {/* 잠긴 탭은 포커스를 받지 못해 사유를 자기 안에 담을 수 없다. 탭 밖에 둔다. */}
        {!canUseLotView && <p className="field-note">{t.reasons.lotViewNeedsItem}</p>}
      </section>

      {/*
       * **LOT별 보기에서만 낸다.** 다른 두 보기에는 고를 대상 자체가 없어, 구획을 두면
       * 「고르세요」가 할 수 없는 일을 시키는 안내가 된다.
       *
       * **목록이 실패하면 내지 않는다** — 상세의 수량 다섯이 목록의 줄에서 오므로 낼 것이 없고,
       * 배너가 이미 사유와 「다시 시도」를 냈다. 반대 방향(상세 실패)은 위 목록을 가리지 않는다.
       */}
      {view === 'lot' && !list.isError && (
        <section className="pane" aria-label={t.panes.detail}>
          {detailPane()}
        </section>
      )}

      {/*
       * **셋째 구획 — 고른 LOT을 골랐을 때만 낸다.** 이력은 「이 LOT이 언제 얼마나
       * 움직였나」라는 물음이라 가리킬 LOT이 없으면 물음 자체가 성립하지 않는다.
       * 상세 구획처럼 「고르세요」를 두지 않는 이유가 그것이다 — 그 안내는 위 구획이 이미 낸다.
       *
       * **상세가 실패해도 낸다.** 이력은 고른 LOT 번호에만 매달리고 상세 응답을 쓰지 않는다 —
       * 한쪽이 실패했다고 다른 쪽을 감추면 사용자가 쓸 수 있는 것까지 잃는다.
       */}
      {historyScope !== null && !list.isError && (
        <section className="pane" aria-label={t.panes.history}>
          {/* 이력 조회 실패는 이 구획 안에만 낸다 — 위 목록과 LOT 상세를 가리지 않는다. */}
          {history.isError && (
            <LoadErrorBanner
              error={history.error}
              onRetry={() => {
                void history.refetch();
              }}
            />
          )}

          {!history.isError && (
            <TransactionPane
              appliedPeriod={historyPeriod}
              rows={historyRows}
              isLoading={history.isPending && historyQuery !== null}
              hasQuery={historyQuery !== null}
              pageView={historyPageView}
              selected={selectedTransaction}
              onSearch={(nextPeriod) => {
                applyHistory(nextPeriod);
              }}
              onToggleSelect={toggleSelectTransaction}
              /* 이력 쪽 이동(수명 표 11행) — 기간은 그대로 두고 고른 거래를 비운다. */
              onChangePage={(nextPage) => {
                applyHistory(historyPeriod, nextPage);
              }}
            />
          )}

          {/*
           * 라인은 이력 목록이 실패하면 낼 것이 없다 — 고를 줄이 화면에 없다.
           * 반대 방향(라인 실패)은 위 이력 목록을 가리지 않는다.
           */}
          {!history.isError && transactionLinePane(historyScope.warehouseId)}
        </section>
      )}
    </>
  );
};
