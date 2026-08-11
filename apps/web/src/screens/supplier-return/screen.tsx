import { Breadcrumb, Button, EmptyState, PageHeader, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { PLACEHOLDER_SUPPLIER_RETURN_CODES, toCodeOptionSets } from './code-options';
import {
  clearFilter,
  DEFAULT_FILTERS,
  readFilters,
  readPage,
  readSelectedReceiptId,
  SELECTION_KEYS,
  toFilterQuery,
  toSearchParams,
  type ReceiptFilters,
  type RemovableChipKey,
} from './filters';
import { GrFilterBar } from './gr-filter-bar';
import { GrLineTable } from './gr-line-table';
import { GrTable } from './gr-table';
import {
  EMPTY_LINE_DRAFT,
  setDraftQty,
  toggleLineSelection,
  type LineDraft,
} from './line-draft';
import { LoadErrorBanner } from './load-error-banner';
import {
  describeReference,
  lookupNote,
  toReference,
  useItemOptions,
  useLocationOptions,
  useLotOptions,
  useUomOptions,
  useWarehouseOptions,
  type LookupResult,
} from './lookups';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import {
  isReceiptNotFound,
  useGoodsReceiptDetail,
  useGoodsReceipts,
  useOnHandBalances,
} from './queries';
import { ReceiptSummaryPane } from './receipt-summary-pane';
import { toReturnLineRows } from './return-selection';
import type { ReceiptLineView, ReceiptView, SelectOption } from './types';

const t = messages.supplierReturn;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: ReceiptView[] = [];
const EMPTY_LINES: ReceiptLineView[] = [];

/**
 * 참조 목록을 선택지로 옮긴다.
 *
 * **미사용 값을 빼지 않고 표식만 붙인다.** 창고를 `includeInactive=true`로 받는 이유는
 * 미사용 창고로 들어온 과거 입고의 이름을 풀기 위해서인데, 그 입고들을 **조건으로 찾으려면**
 * 선택지에도 있어야 한다.
 */
const toSelectOptions = (lookup: LookupResult): SelectOption[] =>
  lookup.entries.map((entry) => ({
    value: entry.value,
    label: entry.isActive ? entry.label : `${entry.label}${t.values.inactiveSuffix}`,
  }));

/**
 * W-01-05 컨테이너 — **되돌려 보낼 자재를 고르는 화면**이다.
 *
 * 배치는 상하로 쌓는다 — 위: 조건 줄과 대상 입고 전표 목록 / 아래: 고른 전표의 제목줄과
 * 라인 표. 조회 조건과 고른 전표는 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은
 * 결과를 낸다.
 *
 * **이 회차에도 쓰기가 없다.** 무엇을 얼마나 되돌려 보낼지 정하는 데까지이고, 반품 정보·확인
 * 창·처리·결과는 뒤따르는 회차에서 이 컨테이너에 붙는다. 그때까지 이 화면은 **라우트에도
 * 사이드바에도 등록되지 않는다** — 반품할 수 없는 「공급사 반품 처리」를 노출하면 미완성 기능을
 * 사용자에게 내보이는 것이다.
 *
 * **대상의 원천이 입고 전표인 이유**(계획 결정 2): 계약이 요구하는 반품 라인 다섯(품목·
 * 자재 LOT·수량·단위·출발 위치)을 재고 잔액은 축 하나만 채워 내려 만들 수 없고, 입고 라인은
 * 그대로 준다. 재고 잔액은 **수량 상한**을 만드는 데만 쓴다(`on-hand.ts`).
 *
 * ### 단계 전이 표 (계획 결정 3)
 *
 * **화면이 단계를 `statusCode` 값으로 판정하지 않는다.** 값 목록이 확정되지 않았고 공유계약이
 * 값 분기를 금지한다 — 계약도 「화면은 서버가 내려주는 값을 그대로 표시하고 값 자체로
 * 분기하지 않는다」고 적었다.
 *
 * | 단계 | 화면이 이 단계를 아는 근거 | 보이는 것 | 할 수 있는 것 | 주소 |
 * | :-: | --- | --- | --- | --- |
 * | **S0** 고르기 전 | `gr`이 없다 | 조건 줄 · 목록 · 쪽 | 조회 · 초기화 · 쪽 이동 · 고르기 | `?wh&from&to&ty&st&q&page` |
 * | **S1** 전표를 골랐다 | `gr`이 있고 **상세가 200** | 위 + 제목줄 · 라인 표 | 위 + **줄 고르기 · 반품 수량 입력** | `+&gr` |
 * | **S2** 보낼 것이 갖춰졌다 | **줄이 하나 이상 골라졌고 전 검증을 통과했다** | 위 + 「갈 수 있다」 | (다음 회차) 반품 처리 | 같음 |
 * | **S3** 이번 세션에서 처리했다 | 처리 성공 결과 | — | — | **다음 회차** |
 * | **S4** 그 전표가 없다 | **상세가 404** | 안내 「고른 입고 전표를 찾을 수 없습니다」 | 다시 고르기 | `gr` 제거 |
 *
 * **화면이 모르는 것을 밝힌다.** 이미 취소됐거나 반품이 끝난 전표를 골라도 화면은 S1로
 * 보인다. 값 목록이 정해지면 그때 막아도 늦지 않고, 지금 막으면 **값이 정해질 때 조용히 틀린다.**
 *
 * **S1의 근거를 목록 소속이 아니라 상세 200으로 두는 이유**: `gr`는 경로 조각이라 목록과
 * 무관하게 상세를 부를 수 있다. 목록 소속으로 판정하면 **조건이 좁아 목록에 없는 전표를 고른
 * 상태가 조용히 지워진다**(W-01-04 결정 2 · W-01-07 Minor의 형태).
 */
export const SupplierReturnScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * ### 수명 표 (계획 결정 4) — 무엇이 바뀔 때 무엇을 비우는가
   *
   * 「비운다」와 「비우지 않는다」를 이 표 한 곳에 모은다. 규칙이 흩어지면 한쪽만 고쳐져
   * 비대칭이 생긴다(조건을 바꾸면 아래 구획이 닫히는데 쪽을 옮기면 안 닫히는 식).
   *
   * **뒤 세 열은 이 회차에 아직 없다.** 열을 지우지 않고 남겨 두는 이유는, 표에 오르지 않은
   * 상태가 규칙이 닿지 않는 사각이 되기 때문이다 — 창·배너가 생길 때 **행을 다시 세는
   * 대신 그 열만 채운다.** 이번 회차에 **「초안」 열이 실제 상태가 됐다**(줄 선택·반품 수량).
   *
   * | # | 조작 | 조건 5종 | `page` | `gr` | **404 안내** | **초안** | 결과 구획 | 열린 창 | 실패 배너 |
   * | :-: | --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
   * | 1 | 조건 변경·조회 | 바뀐다 | **첫 쪽** | **비운다** | **비운다** | 비운다 | 비운다 | 닫는다 | 비운다 |
   * | 2 | 초기화 | **비운다** | 첫 쪽 | 비운다 | **비운다** | 비운다 | 비운다 | 닫는다 | 비운다 |
   * | 3 | 쪽 이동 | 유지 | 옮긴 쪽 | **비운다** | **비운다** | 비운다 | 비운다 | 닫는다 | 비운다 |
   * | 4 | 전표 고르기·해제 | 유지 | **유지** | 넣고 뺀다 | **비운다** | 비운다 | 비운다 | 닫는다 | 비운다 |
   * | 5 | **상세가 404** | 유지 | 유지 | **비운다** | **세운다** | 비운다 | 비운다 | 닫는다 | 비운다 |
   * | 6 | 줄 고르기·해제 | 유지 | 유지 | 유지 | 유지 | 바뀐다 | 유지 | 유지 | 유지 |
   * | 7 | 반품 수량 입력 | 유지 | 유지 | 유지 | 유지 | 바뀐다 | 유지 | 유지 | 유지 |
   * | 8 | 반품 정보 입력 | 유지 | 유지 | 유지 | 유지 | 바뀐다 | 유지 | 유지 | 유지 |
   * | 9 | 목록·상세·참조 응답 도착 | 유지 | 유지 | 유지 | 유지 | **건드리지 않는다** | 유지 | 유지 | 유지 |
   * | 10 | **다시 조회** | 유지 | 유지 | 유지 | 유지 | **유지** | 유지 | 유지 | 유지 |
   * | 11 | 처리 성공 | 유지 | 유지 | **유지** | 유지 | 비운다 | 채운다 | 닫혀 있다 | 비운다 |
   * | 12 | 처리 실패 | 유지 | 유지 | 유지 | 유지 | **유지** | 비운다 | 닫혀 있다 | **세운다** |
   * | 13 | 취소(초안 파기) | 유지 | 유지 | 유지 | 유지 | 비운다 | 비운다 | 닫는다 | 비운다 |
   * | 14 | 전송 중 | 잠긴다 | 잠긴다 | 잠긴다 | 유지 | 잠긴다 | 유지 | 유지 | 유지 |
   *
   * **왜 이렇게 정했는가**(이 회차가 실제로 지키는 것)
   *
   * - **1~3행이 `gr`를 비우는 이유**: 조건·쪽이 바뀌면 고른 전표가 새 결과에 없을 수 있다.
   *   `toSearchParams`가 **`gr`를 만들지 않으므로** 이 세 행이 한 자리에서 함께 지켜진다.
   * - **4행이 쪽을 유지하는 이유**: 보이는 행이 그대로다. 3쪽에서 하나 골랐다고 1쪽으로 튀면 안 된다.
   * - **5행이 클릭 핸들러가 아니라 상세 응답에 묶이는 이유**: 뒤로가기·앞으로가기·주소 직접
   *   편집은 핸들러를 거치지 않고 `gr`만 바꾸므로, 핸들러에 두면 그 경로가 통째로 샌다.
   * - **5행의 「404 안내」가 열인 이유**: 주소에서 `gr`를 지우고 나면 화면은 그 사정을 말할
   *   근거를 잃는다 — 「아직 고르지 않았다」와 글자가 같아져 사용자가 자기가 무엇을 눌렀는지
   *   되짚을 수 없다.
   * - **9행이 이 화면의 #43 자리다**: 응답 도착이 입력을 되돌리면 「치던 값이 사라진다」가
   *   재현된다. 조건 줄의 되돌림은 **값이 실제로 달라졌을 때만** 돌고(`gr-filter-bar.tsx`),
   *   **줄 초안의 되돌림 의존성은 `gr` 하나뿐**이라 라인·참조·잔액 응답에 반응하지 않는다.
   * - **10행이 초안을 유지하는 이유**: 「다시 조회」는 값을 버리려고 누르는 것이 아니다.
   *   라인 집합이 바뀌어 없어진 줄의 초안은 **표에 있는 줄만 세는 것**으로 걸러진다
   *   (`return-selection.ts`) — 지우지 않아도 요약에도 요청에도 실리지 않는다.
   * - **10행이 목록만이 아니라 상세를 함께 부르는 이유**: W-01-07의 Major 지적 그대로다 —
   *   목록만 다시 부르면 **갱신된 값과 갱신되지 않은 값이 한 화면에 섞인다.**
   */
  /*
   * **주소가 바뀔 때만 새 참조를 만든다.** 렌더마다 새 객체를 만들면 내용이 같아도 참조가 달라,
   * 이 값을 되돌림 기준으로 삼는 조건 줄이 **부모가 다시 그려질 때마다** 입력을 덮어쓴다(#43).
   * `searchParams`는 주소가 바뀔 때만 새 참조다.
   */
  const filters = useMemo<ReceiptFilters>(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const selectedReceiptId = readSelectedReceiptId(searchParams);

  /*
   * **조건이 하나도 없어도 조회한다.** 들어오자마자 되돌려 보낼 수 있는 입고가 보여야
   * 무엇을 고를 수 있는지 안다 — 빈 화면으로 시작하면 조건을 먼저 정해야 하는 줄 안다.
   *
   * **기본 기간을 심지 않는다** — 첫 요청에 날짜 조건이 실리지 않는다.
   */
  const listQuery = { ...toFilterQuery(filters), ...(page > 1 ? { page } : {}) };

  const list = useGoodsReceipts(listQuery);
  const rows = list.data?.items ?? EMPTY_ROWS;
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  /* 창고만 미리 받는다 — 조건 줄과 목록 표가 첫 화면부터 이 이름을 쓴다(`lookups.ts`의 표). */
  const warehouses = useWarehouseOptions();

  const detail = useGoodsReceiptDetail(selectedReceiptId);
  const detailData = detail.data;
  const lineRows = detailData?.lines ?? EMPTY_LINES;
  const isDetailNotFound = detail.isError && isReceiptNotFound(detail.error);

  /*
   * 품목·단위·자재 LOT·위치는 **라인 표가 그려질 때** 쓴다 — 그 표는 상세 응답을 기다리므로
   * 미리 받아 둘 이득이 없고, 고르기 전에 부르면 첫 진입의 요청 수만 이유 없이 는다.
   */
  const hasSelection = selectedReceiptId !== null;
  const items = useItemOptions(hasSelection);
  const uoms = useUomOptions(hasSelection);

  /*
   * 자재 LOT은 **라인이 가리키는 품목마다** 받는다 — 번호 여러 개로 한 번에 조회하는 수단이
   * 계약에 없다. 라인이 오기 전에는 품목이 없어 요청도 없다.
   */
  const lots = useLotOptions(
    lineRows.map((line) => line.itemId),
    hasSelection,
  );

  /*
   * 위치는 **그 전표의 창고**로 조회한다 — 계약이 창고를 필수 조건으로 두었다.
   * 상세가 오기 전에는 창고 번호가 없어 요청도 없다. `?? 0` 같은 대체값으로 메우면
   * **없는 창고의 조건으로 요청이 나간다.**
   */
  const locations = useLocationOptions(detailData?.receipt.warehouseId ?? null);

  /*
   * 재고 잔액은 **반품 수량의 상한**을 만드는 데만 쓴다. 위치와 같은 조건(그 전표의 창고)으로
   * 부르고, 라인이 가리키는 **품목마다 한 번씩** 받아 자재 LOT으로 맞춘다(`on-hand.ts`).
   * 상세가 오기 전에는 창고 번호가 없어 요청도 없다.
   */
  const balances = useOnHandBalances(
    detailData?.receipt.warehouseId ?? null,
    lineRows.map((line) => line.itemId),
  );

  /**
   * 줄 선택과 반품 수량 초안 — **아직 보내지 않은 입력**이다(수명 표의 「초안」 열).
   *
   * **주소에 싣지 않는다.** 글자마다 뒤로가기 기록이 쌓이고, 화면이 조회 조건과 입력을 같은
   * 통로로 다루게 된다.
   */
  const [lineDraft, setLineDraft] = useState<LineDraft>(EMPTY_LINE_DRAFT);

  /*
   * **고른 전표가 바뀌면 초안을 비운다**(수명 표 1~5행). 앞 전표에서 고른 줄과 친 수량은
   * 새 전표에서 뜻을 잃는다 — 그대로 두면 남의 전표의 수량이 실린다.
   *
   * **의존성은 `gr` 하나뿐이다**(#43 · 감지기 M27). 라인·참조·잔액 응답이나 `useMemo`로 만든
   * 파생 객체를 넣으면 갱신이 도착할 때마다 **치던 값이 사라진다.**
   */
  useEffect(() => {
    setLineDraft(EMPTY_LINE_DRAFT);
  }, [selectedReceiptId]);

  /**
   * 표가 그릴 줄. **판정을 여기서 만들지 않는다** — 고를 수 있는가·골라졌는가·상한을 넘었는가는
   * 전부 `return-selection.ts` 한 곳에서 나오고, 표와 요약이 같은 결과를 본다(완료 조건 C31).
   *
   * **지금 표에 있는 줄만 만든다**(계획 결정 8). 초안에 남아 있어도 사라진 줄은 여기 나타나지
   * 않으므로 요약에도 뒤따르는 회차의 요청에도 실리지 않는다.
   */
  const lineTableRows = toReturnLineRows(lineRows, lineDraft, balances);

  /**
   * 방금 고른 전표가 **없었다**는 사실(수명 표 5행의 「404 안내」 열).
   *
   * 주소에서 `gr`를 지우고 나면 화면은 그 사정을 말할 근거를 잃는다 — 「아직 고르지 않았다」와
   * 글자가 같아지므로 사용자는 자기가 무엇을 눌렀는지 되짚을 수 없다.
   */
  const [hasNotFoundNotice, setHasNotFoundNotice] = useState(false);

  /*
   * **상세가 404면 고른 전표를 주소에서 정리한다**(수명 표 5행).
   *
   * **클릭 핸들러가 아니라 고른 식별자와 상세 응답에 묶는다.** 뒤로가기·앞으로가기·주소 직접
   * 편집은 핸들러를 거치지 않고 `gr`만 바꾸므로, 핸들러에 두면 그 경로가 통째로 샌다.
   *
   * replace로 바꿔 정리가 뒤로가기 기록을 늘리지 않게 한다 — 늘리면 뒤로 눌렀을 때 없는
   * 전표를 가리키는 주소로 되돌아가 같은 정리가 되풀이된다.
   */
  useEffect(() => {
    if (selectedReceiptId === null) return;
    if (!isDetailNotFound) return;

    setHasNotFoundNotice(true);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(SELECTION_KEYS.goodsReceipt);

        return next;
      },
      { replace: true },
    );
  }, [selectedReceiptId, isDetailNotFound, setSearchParams]);

  /*
   * 다시 고르면 앞의 안내를 거둔다 — 남으면 새로 고른 전표의 제목줄 옆에 「찾을 수 없습니다」가
   * 함께 서 있게 된다. **고른 식별자가 생기는 순간에만** 반응한다.
   */
  useEffect(() => {
    if (selectedReceiptId !== null) setHasNotFoundNotice(false);
  }, [selectedReceiptId]);

  /**
   * 조건·쪽을 적용한다. **주소를 한 번만 갱신한다** — 조건과 쪽을 따로 갱신하면 뒤로가기
   * 기록이 두 칸 늘어 사용자가 뒤로 눌렀는데 같은 자리로 돌아온 것처럼 보인다.
   *
   * `toSearchParams`가 `gr`를 만들지 않으므로 조건·쪽이 바뀌면 고른 전표가 함께 풀린다
   * (수명 표 1~3행).
   */
  const applyQuery = (nextFilters: ReceiptFilters, nextPage = 1): void => {
    setHasNotFoundNotice(false);
    setSearchParams(toSearchParams(nextFilters, nextPage));
  };

  /** 고르고 푸는 것은 **보이는 행을 바꾸지 않는다**(수명 표 4행). */
  const toggleSelectReceipt = (goodsReceiptId: number): void => {
    setHasNotFoundNotice(false);

    const next = toSearchParams(filters, page);

    if (goodsReceiptId !== selectedReceiptId) {
      next.set(SELECTION_KEYS.goodsReceipt, String(goodsReceiptId));
    }

    setSearchParams(next);
  };

  /**
   * **화면이 보고 있는 조회를 전부 다시 한다**(수명 표 10행).
   *
   * 목록만 다시 부르면 제목줄과 라인 표가 낡은 채로 남아 **갱신된 값과 갱신되지 않은 값이
   * 한 화면에 섞인다**(W-01-07의 Major 지적). 이 화면에서 그 어긋남은 비싸다 — 다른 사람이
   * 먼저 반품하거나 전표가 고쳐지면 화면의 줄 집합이 낡는데, 낡은 줄로 반품을 보내면
   * **없어진 자재를 되돌려 보내려 한다.**
   *
   * **고르지 않은 것은 부르지 않는다.** 설치본의 `refetch()`는 `enabled`를 보지 않아 비활성
   * 쿼리에서도 `queryFn`을 실행한다 — 지금은 `queryFn`이 던져서 요청이 나가지 않지만 그것은
   * **가드가 막는 것**이지 훅이 무동작인 것이 아니다.
   *
   * 조건·쪽·선택은 하나도 바꾸지 않는다.
   */
  const refreshAll = (): void => {
    void list.refetch();

    if (selectedReceiptId !== null) void detail.refetch();
  };

  /**
   * 참조 실패의 복구 경로 — **이름이 보이는 자리마다 하나씩** 둔다(계획 결정 17).
   * 안내 문구가 적은 대상과 다시 부르는 대상이 어긋나면, 눌러도 한쪽은 실패인 채로 남는데
   * 문구는 둘 다 고쳐질 것처럼 말한다.
   */
  const retryTopReferences = (): void => {
    warehouses.refetch();
  };

  const retryLineReferences = (): void => {
    items.refetch();
    uoms.refetch();
    lots.refetch();
    locations.refetch();
  };

  /**
   * 잔액의 복구 경로는 **참조와 갈라 둔다.** 안내 문구가 적은 대상과 다시 부르는 대상이
   * 어긋나면 눌러도 한쪽은 실패인 채로 남는데 문구는 둘 다 고쳐질 것처럼 말한다 — 이름을
   * 못 받은 것과 수량을 못 받은 것은 사용자가 할 판단도 다르다.
   */
  const retryBalances = (): void => {
    balances.refetch();
  };

  const warehouseReference = toReference(
    warehouses,
    filters.warehouse === '' ? null : Number(filters.warehouse),
  );

  /**
   * 값 목록이 확정되지 않은 코드의 선택지. **화면이 만들어 조건 줄에 넘긴다** —
   * 배열이 차는 순간 화면이 달라지는 것을 화면 수준에서 잴 수 있게 하기 위해서다.
   */
  const codeOptions = toCodeOptionSets(PLACEHOLDER_SUPPLIER_RETURN_CODES);

  /**
   * 아래 구획. **다섯 중 하나만 낸다** — 사용자가 할 조치가 서로 다르다.
   *
   * 404를 맨 앞에 둔다: 그 갈래는 `gr`를 지우고 나면 「아직 고르지 않았다」와 구분되지 않으므로,
   * 지우기 전(상세가 404인 렌더)과 지운 뒤(안내 상태)가 **같은 화면**을 내야 한다.
   */
  const detailPane = (): ReactNode => {
    if (hasNotFoundNotice || isDetailNotFound) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.empty.notFoundTitle}
          description={t.empty.notFoundDescription}
        />
      );
    }

    if (selectedReceiptId === null) {
      return (
        <EmptyState
          size="sm"
          title={t.empty.noSelectionTitle}
          description={t.empty.noSelectionDescription}
        />
      );
    }

    /* 404가 아닌 실패는 다시 시도로 풀릴 수 있다 — 배너와 복구 경로를 함께 낸다. */
    if (detail.isError) {
      return (
        <LoadErrorBanner
          error={detail.error}
          onRetry={() => {
            void detail.refetch();
          }}
        />
      );
    }

    if (detailData === undefined) {
      return (
        <div role="status" aria-label={t.loading.detail}>
          <SkeletonText lines={2} />
        </div>
      );
    }

    return (
      <>
        <ReceiptSummaryPane
          receipt={detailData.receipt}
          /*
           * 창고는 **위 구획이 실패 안내와 복구를 소유**하므로 이름만 넘긴다.
           * 제목줄에 번호를 문자열로 만드는 자리는 어느 쪽에도 없다.
           */
          warehouseName={describeReference(
            toReference(warehouses, detailData.receipt.warehouseId),
          )}
        />

        <GrLineTable
          rows={lineTableRows}
          /*
           * 품목·단위·LOT·위치는 **이름이 아니라 참조 자체**를 넘긴다 — 이 구획이 실패·잘림
           * 안내와 다시 시도를 소유하므로 그 사실을 함께 알아야 한다.
           */
          itemLookup={items}
          uomLookup={uoms}
          lotLookup={lots}
          locationLookup={locations}
          /*
           * 잔액은 **줄마다의 사정**(상한을 확인했는가)이 이미 줄에 실려 있으므로, 구획이
           * 알아야 하는 것은 안내와 복구 버튼을 세울지뿐이다.
           */
          hasBalanceError={balances.isError}
          hasBalanceTruncated={balances.truncated}
          onToggleSelect={(goodsReceiptLineId) => {
            setLineDraft((prev) => toggleLineSelection(prev, goodsReceiptLineId));
          }}
          onChangeQty={(goodsReceiptLineId, text) => {
            setLineDraft((prev) => setDraftQty(prev, goodsReceiptLineId, text));
          }}
          onRetryReferences={retryLineReferences}
          onRetryBalances={retryBalances}
        />
      </>
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
        actions={
          <Button variant="outlined" size="sm" onClick={refreshAll}>
            {t.actions.refresh}
          </Button>
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
        <GrFilterBar
          appliedFilters={filters}
          warehouseOptions={toSelectOptions(warehouses)}
          warehouseNote={lookupNote(warehouses)}
          receiptTypeOptions={codeOptions.receiptType}
          statusOptions={codeOptions.status}
          chipNames={{ warehouse: describeReference(warehouseReference) }}
          onSearch={(nextFilters) => {
            applyQuery(nextFilters);
          }}
          onRemoveFilter={(key: RemovableChipKey) => {
            applyQuery(clearFilter(filters, key));
          }}
          onReset={() => {
            applyQuery(DEFAULT_FILTERS);
          }}
        />

        {!list.isError && (
          <>
            <GrTable
              rows={rows}
              isLoading={list.isPending}
              isBeyondLast={pageView.isBeyondLast}
              selectedReceiptId={selectedReceiptId}
              warehouseLookup={warehouses}
              onFirstPage={() => {
                applyQuery(filters);
              }}
              onToggleSelect={toggleSelectReceipt}
              onRetryReferences={retryTopReferences}
            />
            {!list.isPending && (
              <PageNav
                view={pageView}
                onChange={(nextPage) => {
                  applyQuery(filters, nextPage);
                }}
              />
            )}
          </>
        )}
      </section>

      <section className="pane" aria-label={t.panes.lines}>
        {detailPane()}
      </section>
    </>
  );
};
