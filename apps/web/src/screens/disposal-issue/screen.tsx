import { Breadcrumb, Button, EmptyState, PageHeader, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import {
  DEFECT_WAREHOUSE_TYPE_CODES,
  isDefectWarehouseTypePending,
  narrowToDefectWarehouses,
  PLACEHOLDER_DISPOSAL_ISSUE_CODES,
  toCodeOptionSets,
} from './code-options';
import { describeDisposalSelection, toDisposalLineRows } from './disposal-selection';
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
import type { ReceiptLineView, ReceiptView, SelectOption, WarehouseEntry } from './types';

const t = messages.disposalIssue;

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
const toSelectOptions = (entries: readonly WarehouseEntry[]): SelectOption[] =>
  entries.map((entry) => ({
    value: entry.value,
    label: entry.isActive ? entry.label : `${entry.label}${t.values.inactiveSuffix}`,
  }));

/**
 * W-01-06 컨테이너 — **폐기할 자재가 들어 있는 입고 전표를 고르는 화면**이다.
 *
 * 배치는 상하로 쌓는다 — 위: 조건 줄과 대상 입고 전표 목록 / 아래: 고른 전표의 제목줄과 라인 표.
 * 조회 조건과 고른 전표는 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 *
 * **이 회차에도 쓰기가 없다**(완료 조건 C30). 폐기 정보·품의 등록·상신·기타출고 처리는
 * 뒤따르는 회차에서 이 컨테이너에 붙는다. 그때까지 이 화면은 **라우트에도 사이드바에도
 * 등록되지 않는다** — 폐기 품의를 올릴 수 없는 「폐기 품의·기타출고」를 노출하면 승인까지
 * 받아 놓고 아무것도 할 수 없는 화면을 사용자에게 내보이는 것이다.
 *
 * **대상의 원천이 입고 전표인 이유**(계획 결정 2): 계약이 요구하는 출고 라인 다섯(품목·
 * 자재 LOT·수량·단위·출발 위치)을 재고 잔액은 축 하나만 채워 내려 만들 수 없고, 입고 라인은
 * 그대로 준다. 재고 잔액은 **수량 상한**을 만드는 데만 쓴다(`on-hand.ts`).
 *
 * **두 표가 2단으로 대상을 말한다**(승인 기록 정정 2). 위 표(6열)가 원천·입고일·창고로 전표
 * 한 건을 고르고, 아래 표(7열)가 그 전표의 **품목·자재 LOT·보유 수량**을 낸다 — 계약에 입고
 * 라인의 전역 목록 경로가 없어 한 표로는 그 다섯을 함께 낼 수 없다.
 *
 * **「불량창고」를 화면이 판정하지 않는다**(계획 결정 2·8). 창고 유형의 값 목록이 확정되지
 * 않아 「이 창고가 그 창고인가」를 물을 수 없다 — 사용자가 창고를 고르고, 값 목록이 채워지면
 * 선택지가 그 유형으로 좁혀지며 안내가 사라진다. **그 좁힘은 선택지 하나에만 걸린다** —
 * 아래 구획의 위치 이름과 잔액은 **고른 전표의 창고**로 조회한다(조건 줄의 창고가 아니다).
 *
 * ### 단계 전이 표 (계획 결정 3)
 *
 * **화면이 단계를 `statusCode` 값으로 판정하지 않는다.** 값 목록이 확정되지 않았고 공유계약이
 * 값 분기를 금지한다 — 계약도 「화면은 서버가 내려주는 값을 그대로 표시하고 값 자체로
 * 분기하지 않는다」고 적었다.
 *
 * | 단계 | 화면이 이 단계를 아는 근거 | 보이는 것 | 할 수 있는 것 | 주소 |
 * | :-: | --- | --- | --- | --- |
 * | **S0** 고르기 전 | `gr`이 없다 | 조건 줄 · 목록 · 쪽 · **고르기 전 안내** | 조회 · 초기화 · 쪽 이동 · 고르기 | `?wh&from&to&ty&st&q&page` |
 * | **S1** 전표를 골랐다 | `gr`이 있고 **상세가 200** | 위 + 제목줄 · 라인 표 | 위 + 줄 고르기 · 폐기 수량 | `+&gr` |
 * | **S2** 보낼 것이 갖춰졌다 | 줄이 하나 이상 골라졌고 전 검증 통과 | 위 + **요약이 「보낼 수 있다」로 바뀐다** | 위 + 품의 등록 — **다음 회차** | 같음 |
 * | **S3** 이번 세션에서 등록했다 | 등록 성공 결과 | — | — | **다음 회차** |
 * | **S4** 그 전표가 없다 | **상세가 404** | 안내 「고른 입고 전표를 찾을 수 없습니다」 | `gr`를 주소에서 정리한다 | `gr` 제거 |
 *
 * **이 회차가 서는 단계는 S0·S1·S2·S4다.** S2의 「할 수 있는 것」인 품의 등록은 아직 없고,
 * 그 자리는 **요약과 사유**가 맡는다 — 판정은 여기서 서고 버튼만 뒤에 온다. 버튼 없는 판정을
 * 만드는 것이 죽은 가지가 아닌 이유는, 그 판정이 **표 아래 요약과 사유로 실제로 보이기**
 * 때문이다(무엇이 모자라 못 보내는지 사용자가 지금도 읽는다).
 *
 * **화면이 모르는 것을 밝힌다.** 이미 폐기됐거나 취소된 전표를 골라도 화면은 막지 않는다.
 * 값 목록이 정해지면 그때 막아도 늦지 않고, 지금 막으면 **값이 정해질 때 조용히 틀린다.**
 *
 * **S1의 근거를 목록 소속이 아니라 상세 200으로 두는 이유**: `gr`는 경로 조각이라 목록과
 * 무관하게 상세를 부를 수 있다. 목록 소속으로 판정하면 **조건이 좁아 목록에 없는 전표를 고른
 * 상태가 조용히 지워진다**(W-01-07 Minor의 형태).
 */
export const DisposalIssueScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * ### 수명 표 (계획 결정 12) — 무엇이 바뀔 때 무엇을 비우는가
   *
   * 「비운다」와 「비우지 않는다」를 이 표 한 곳에 모은다. 규칙이 흩어지면 한쪽만 고쳐져
   * 비대칭이 생긴다(조건을 바꾸면 아래 구획이 닫히는데 쪽을 옮기면 안 닫히는 식).
   *
   * **뒤 일곱 열은 이 회차에 아직 없다.** 열을 지우지 않고 남겨 두는 이유는, 표에 오르지 않은
   * 상태가 규칙이 닿지 않는 사각이 되기 때문이다 — 창·배너가 생길 때 **행을 다시 세는
   * 대신 그 열만 채운다.** 같은 이유로 뒤 회차에만 일어나는 조작(9~26행)도 남겨 둔다.
   *
   * 열 이름: 조건 = 대상 조건 6종 · `gr` = 고른 입고 전표 · 줄 = 줄·수량 초안 ·
   * 폐기 = 폐기 정보 초안 · 이력 = 이력 조건 · `gi` = 고른 품의 · 사유 = 상신 사유 초안 ·
   * 등록 = 등록 결과 · 처리 = 처리 결과 · 창 = 열린 창 · 배너 = 실패 배너
   *
   * | # | 조작 | 조건 | `gr` | 줄 | 폐기 | 이력 | `gi` | 사유 | 등록 | 처리 | 창 | 배너 |
   * | :-: | --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
   * | 1 | 대상 조건 변경·조회 | 바뀐다 | **비운다** | 비운다 | 유지 | 유지 | 유지 | 유지 | 비운다 | 유지 | 닫는다 | 등록분만 비운다 |
   * | 2 | 대상 초기화 | **비운다** | 비운다 | 비운다 | 유지 | 유지 | 유지 | 유지 | 비운다 | 유지 | 닫는다 | 등록분만 비운다 |
   * | 3 | 대상 쪽 이동 | 유지 | **비운다** | 비운다 | 유지 | 유지 | 유지 | 유지 | 비운다 | 유지 | 닫는다 | 등록분만 비운다 |
   * | 4 | 입고 전표 고르기·해제 | 유지 | 넣고 뺀다 | **비운다** | 유지 | 유지 | 유지 | 유지 | 비운다 | 유지 | 닫는다 | 등록분만 비운다 |
   * | 5 | **입고 상세가 404** | 유지 | **비운다** | 비운다 | 유지 | 유지 | 유지 | 유지 | 비운다 | 유지 | 닫는다 | 등록분만 비운다 |
   * | 6 | 줄 고르기·수량 입력 | 유지 | 유지 | 바뀐다 | 유지 | 유지 | 유지 | 유지 | **유지** | 유지 | 유지 | **유지** |
   * | 7 | 폐기 정보 입력 | 유지 | 유지 | 유지 | 바뀐다 | 유지 | 유지 | 유지 | **유지** | 유지 | 유지 | **유지** |
   * | 8 | **탭 전환** | 유지 | **유지** | **유지** | **유지** | 유지 | **유지** | **유지** | **유지** | **유지** | **닫는다** | 유지 |
   * | 9 | 이력 조건 변경·조회·초기화·쪽 | 유지 | 유지 | 유지 | 유지 | 바뀐다 | **비운다** | **비운다** | 유지 | **비운다** | 닫는다 | 상신·처리분만 비운다 |
   * | 10 | 품의 고르기·해제 | 유지 | 유지 | 유지 | 유지 | 유지 | 넣고 뺀다 | **비운다** | 유지 | **비운다** | 닫는다 | 상신·처리분만 비운다 |
   * | 11 | **출고 상세가 404** | 유지 | 유지 | 유지 | 유지 | 유지 | **비운다** | 비운다 | 유지 | 비운다 | 닫는다 | 상신·처리분만 비운다 |
   * | 12 | 사유 입력 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 바뀐다 | 유지 | 유지 | 유지 | **유지** |
   * | 13 | 목록·상세·참조·잔액·승인 요청 응답 도착 | 유지 | 유지 | **건드리지 않는다** | **건드리지 않는다** | 유지 | 유지 | **건드리지 않는다** | 유지 | 유지 | 유지 | 유지 |
   * | 14 | **다시 조회**(새로고침) | 유지 | 유지 | **유지** | **유지** | 유지 | 유지 | **유지** | 유지 | 유지 | 유지 | 유지 |
   * | 15 | 창 열기 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | **연다** | **유지** |
   * | 16 | 창 닫기(취소·Escape·스크림) | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | **닫는다** | **유지** |
   * | 17 | **등록 성공** | 유지 | **유지** | **비운다** | **비운다** | 유지 | **채운다** | 유지 | **채운다** | 유지 | 닫는다 | 비운다 |
   * | 18 | 등록 실패 | 유지 | 유지 | **유지** | **유지** | 유지 | 유지 | 유지 | 비운다 | 유지 | 닫는다 | **세운다** |
   * | 19 | **상신 성공** | 유지 | 유지 | 유지 | 유지 | 유지 | **유지** | **비운다** | 유지 | 유지 | 닫는다 | 비운다 |
   * | 20 | 상신 실패 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | **유지** | 유지 | 유지 | 닫는다 | **세운다** |
   * | 21 | **처리 성공** | 유지 | 유지 | 유지 | 유지 | 유지 | **유지** | 유지 | 유지 | **채운다** | 닫는다 | 비운다 |
   * | 22 | 처리 실패 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 비운다 | 닫는다 | **세운다** |
   * | 23 | 초안 파기(취소) | 유지 | 유지 | **비운다** | **비운다** | 유지 | 유지 | **비운다** | 비운다 | 비운다 | 닫는다 | **비운다** |
   * | 24 | **전송 중** | 잠긴다 | 잠긴다 | 잠긴다 | 잠긴다 | 잠긴다 | 잠긴다 | 잠긴다 | 유지 | 유지 | 유지 | 유지 |
   * | 25 | **상세를 더는 읽을 수 없다** | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | **닫는다** | 유지 |
   * | 26 | **승인 요청 조회 실패** | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | **유지** | 유지 | **유지** | **유지** | **유지** |
   *
   * **이 회차가 실제로 지키는 것은 1~6·13·14행의 「조건」·`gr`·「줄」 세 열이다.**
   *
   * - **1~3행이 `gr`를 비우는 이유**: 조건·쪽이 바뀌면 고른 전표가 새 결과에 없을 수 있다.
   *   `toSearchParams`가 **`gr`를 만들지 않으므로** 이 세 행이 한 자리에서 함께 지켜진다.
   * - **4행이 쪽을 유지하는 이유**: 보이는 행이 그대로다. 3쪽에서 하나 골랐다고 1쪽으로 튀면 안 된다.
   * - **1~5행이 줄 초안을 함께 비우는 이유**: 앞 전표에서 고른 줄과 친 수량은 새 전표에서 뜻을
   *   잃는다. 다섯 행이 전부 **`gr`가 달라지는 자리**이므로 되돌림은 **`gr` 하나에 매인 effect**
   *   한 곳이 맡는다 — 조작마다 손으로 비우면 뒤로가기·주소 편집 경로가 통째로 샌다.
   * - **5·11행이 클릭 핸들러가 아니라 상세 응답에 묶일 이유**: 뒤로가기·앞으로가기·주소 직접
   *   편집은 핸들러를 거치지 않고 `gr`·`gi`만 바꾸므로, 핸들러에 두면 그 경로가 통째로 샌다.
   * - **6행이 등록 결과·배너를 유지하는 이유**: 줄을 고치는 것은 대상을 바꾸는 것이 아니다.
   *   이 회차에는 그 두 열이 아직 없어 지킬 것이 없지만, 행은 미리 서 있다.
   * - **13행이 이 화면의 `omf-mes#43` 자리다**(감지기 M30): 응답 도착이 초안을 되돌리면
   *   「치던 값이 사라진다」가 재현된다. 초안 되돌림 effect의 의존성은 **`gr` 하나뿐**이고
   *   라인·참조·잔액 응답 배열이나 `useMemo` 파생 객체를 넣지 않는다.
   * - **14행이 목록만이 아니라 상세를 함께 부를 이유**: W-01-07의 Major 지적 그대로다 —
   *   목록만 다시 부르면 **갱신된 값과 갱신되지 않은 값이 한 화면에 섞인다.** 이 화면에서 그
   *   어긋남은 비싸다: 낡은 줄로 폐기 품의를 올리면 **이미 없어진 자재를 폐기하려 한다.**
   *   그리고 **초안은 지우지 않는다** — 사라진 줄의 초안은 표에 없는 줄이라 세지 않는다
   *   (`disposal-selection.ts`).
   */
  /*
   * **주소가 바뀔 때만 새 참조를 만든다.** 렌더마다 새 객체를 만들면 내용이 같아도 참조가 달라,
   * 이 값을 되돌림 기준으로 삼는 조건 줄이 **부모가 다시 그려질 때마다** 입력을 덮어쓴다
   * (`omf-mes#43`). `searchParams`는 주소가 바뀔 때만 새 참조다.
   */
  const filters = useMemo<ReceiptFilters>(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const selectedReceiptId = readSelectedReceiptId(searchParams);

  /*
   * **조건이 하나도 없어도 조회한다.** 들어오자마자 폐기할 수 있는 입고가 보여야 무엇을
   * 고를 수 있는지 안다 — 빈 화면으로 시작하면 조건을 먼저 정해야 하는 줄 안다.
   *
   * **기본 기간도 기본 창고도 심지 않는다** — 첫 요청에 조건이 하나도 실리지 않는다.
   */
  const listQuery = { ...toFilterQuery(filters), ...(page > 1 ? { page } : {}) };

  const list = useGoodsReceipts(listQuery);
  const rows = list.data?.items ?? EMPTY_ROWS;
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  /* 창고는 첫 진입에 받는다 — 조건 줄과 목록 표가 첫 화면부터 이 이름을 쓴다. */
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
   * 재고 잔액은 **폐기 수량의 상한**을 만드는 데만 쓴다. 위치와 같은 조건(그 전표의 창고)으로
   * 부르고, 라인이 가리키는 **품목마다 한 번씩** 받아 자재 LOT으로 맞춘다(`on-hand.ts`).
   *
   * **조건 줄의 창고를 쓰지 않는다.** 그 값은 비어 있을 수 있고, 값 목록이 확정되면 선택지가
   * 폐기 대상 유형으로 좁혀진다 — 좁힌 조건을 축으로 쓰면 좁힘 밖 창고의 전표를 골랐을 때
   * **남의 창고 잔액이 상한이 된다.**
   */
  const balances = useOnHandBalances(
    detailData?.receipt.warehouseId ?? null,
    lineRows.map((line) => line.itemId),
  );

  /**
   * 줄 선택과 폐기 수량 초안 — **아직 보내지 않은 입력**이다(수명 표의 「줄」 열).
   *
   * **주소에 싣지 않는다.** 글자마다 뒤로가기 기록이 쌓이고, 화면이 조회 조건과 입력을 같은
   * 통로로 다루게 된다.
   */
  const [lineDraft, setLineDraft] = useState<LineDraft>(EMPTY_LINE_DRAFT);

  /*
   * **고른 전표가 바뀌면 초안을 비운다**(수명 표 1~5행). 앞 전표에서 고른 줄과 친 수량은
   * 새 전표에서 뜻을 잃는다 — 그대로 두면 남의 전표의 수량이 실린다.
   *
   * **의존성은 `gr` 하나뿐이다**(`omf-mes#43` · 감지기 M30). 라인·참조·잔액 응답이나
   * `useMemo`로 만든 파생 객체를 넣으면 갱신이 도착할 때마다 **치던 값이 사라진다.**
   */
  useEffect(() => {
    setLineDraft(EMPTY_LINE_DRAFT);
  }, [selectedReceiptId]);

  /**
   * 방금 고른 전표가 **없었다**는 사실(수명 표 5행).
   *
   * 주소에서 `gr`를 지우고 나면 화면은 그 사정을 말할 근거를 잃는다 — 「아직 고르지 않았다」와
   * 글자가 같아지므로 사용자는 자기가 무엇을 눌렀는지 되짚을 수 없다.
   */
  const [hasNotFoundNotice, setNotFoundNotice] = useState(false);

  /**
   * 조건·쪽을 적용한다. **주소를 한 번만 갱신한다** — 조건과 쪽을 따로 갱신하면 뒤로가기
   * 기록이 두 칸 늘어 사용자가 뒤로 눌렀는데 같은 자리로 돌아온 것처럼 보인다.
   *
   * `toSearchParams`가 `gr`를 만들지 않으므로 조건·쪽이 바뀌면 고른 전표가 함께 풀린다
   * (수명 표 1~3행).
   */
  const applyQuery = (nextFilters: ReceiptFilters, nextPage = 1): void => {
    setSearchParams(toSearchParams(nextFilters, nextPage));
  };

  /** 고르고 푸는 것은 **보이는 행을 바꾸지 않는다**(수명 표 4행). */
  const toggleSelectReceipt = (goodsReceiptId: number): void => {
    const next = toSearchParams(filters, page);

    if (goodsReceiptId !== selectedReceiptId) {
      next.set(SELECTION_KEYS.goodsReceipt, String(goodsReceiptId));
    }

    setNotFoundNotice(false);
    setSearchParams(next);
  };

  /*
   * **상세가 404면 고른 전표를 주소에서 정리한다**(수명 표 5행 · 완료 조건 C20).
   *
   * **클릭 핸들러가 아니라 고른 식별자와 상세 응답에 묶는다.** 뒤로가기·앞으로가기·주소 직접
   * 편집은 핸들러를 거치지 않고 `gr`만 바꾸므로, 핸들러에 두면 그 경로가 통째로 샌다.
   *
   * 조건·쪽은 하나도 바꾸지 않는다 — 없어진 전표 하나 때문에 사용자가 좁혀 둔 조건까지
   * 되돌리면 처음부터 다시 찾아야 한다.
   */
  useEffect(() => {
    if (!isDetailNotFound) return;

    setNotFoundNotice(true);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);

      next.delete(SELECTION_KEYS.goodsReceipt);

      return next;
    });
  }, [isDetailNotFound, setSearchParams]);

  /**
   * **화면이 보고 있는 조회를 전부 다시 한다**(수명 표 14행 · 감지기 M18).
   *
   * **목록만 다시 부르지 않는다** — 그러면 아래 구획이 낡은 채로 남아 **갱신된 값과 갱신되지
   * 않은 값이 한 화면에 섞인다**(W-01-07의 Major 지적). 이 화면에서 그 어긋남은 비싸다:
   * 낡은 줄로 폐기 품의를 올리면 **이미 없어진 자재를 폐기하려 한다.**
   *
   * **참조(이름)는 다시 부르지 않는다.** 기준정보는 이 조작으로 달라지지 않고, 못 받았을
   * 때의 복구는 각 구획의 「다시 시도」가 따로 갖는다. **잔액은 다시 부른다** — 이름이 아니라
   * **화면이 그 값으로 막고 푸는** 값이다.
   *
   * **고르지 않은 것은 부르지 않는다.** 설치본의 `refetch()`는 `enabled`를 보지 않아 비활성
   * 쿼리에서도 `queryFn`을 실행한다 — 지금은 `queryFn`이 던져서 요청이 나가지 않지만 그것은
   * **가드가 막는 것**이지 훅이 무동작인 것이 아니다.
   *
   * 조건·쪽·선택·초안은 하나도 바꾸지 않는다.
   */
  const refreshAll = (): void => {
    void list.refetch();

    if (selectedReceiptId !== null) void detail.refetch();

    /*
     * 잔액에는 가드가 따로 없다 — 고르기 전에는 라인이 없어 **만들어진 조회 자체가 0건**이라
     * 순회할 것이 없다. 「고르지 않았으면 부르지 않는다」가 자료 구조로 지켜지는 자리다.
     */
    balances.refetch();
  };

  /**
   * 참조 실패의 복구 경로 — **이름이 보이는 자리마다 하나씩** 둔다.
   * 안내 문구가 적은 대상과 다시 부르는 대상이 어긋나면, 눌러도 한쪽은 실패인 채로 남는데
   * 문구는 둘 다 고쳐질 것처럼 말한다.
   */
  const retryReferences = (): void => {
    warehouses.refetch();
  };

  const retryLineReferences = (): void => {
    items.refetch();
    uoms.refetch();
    lots.refetch();
    locations.refetch();
  };

  const warehouseReference = toReference(
    warehouses,
    filters.warehouse === '' ? null : Number(filters.warehouse),
  );

  /**
   * 창고 선택지. **좁힘을 화면이 한다**(계획 결정 2·8).
   *
   * 지금은 폐기 대상 창고 유형의 값 목록이 비어 있어 전체가 그대로 넘어가고, 배열이 채워지는
   * 순간 그 유형만 남는다. **목록 표의 이름 풀이에는 좁히지 않은 참조를 쓴다** — 창고 조건
   * 없이 조회하면 다른 창고의 입고가 함께 오고, 좁힌 목록으로 이름을 풀면 그 전표의 창고가
   * **「목록에 없음」으로 찍힌다**(`omf-mes#47`이 금지한 표기).
   *
   * 좁힘이 살아난 뒤 주소를 손으로 고쳐 좁힘 밖 창고를 조건으로 걸면 선택칸에는 그 값이 서지
   * 않는다 — 그래도 **조건은 걸려 있고 조건 칩이 그 사실을 이름으로 말한다.**
   */
  const warehouseOptions = toSelectOptions(
    narrowToDefectWarehouses(warehouses.entries, DEFECT_WAREHOUSE_TYPE_CODES),
  );

  /**
   * 창고 선택칸의 한계 안내. **못 불러온 것이 먼저다** — 목록을 받지도 못했는데 「좁히지
   * 못했다」를 말하면 사용자가 원인을 잘못 읽는다. 좁힘이 살아나면 마지막 갈래가 사라진다.
   */
  const warehouseNote =
    lookupNote(warehouses) ??
    (isDefectWarehouseTypePending(DEFECT_WAREHOUSE_TYPE_CODES)
      ? t.filters.warehouseTypePending
      : undefined);

  /**
   * 값 목록이 확정되지 않은 코드의 선택지. **화면이 만들어 조건 줄에 넘긴다** —
   * 배열이 차는 순간 화면이 달라지는 것을 화면 수준에서 잴 수 있게 하기 위해서다.
   */
  const codeOptions = toCodeOptionSets(PLACEHOLDER_DISPOSAL_ISSUE_CODES);

  /**
   * 표가 그릴 줄. **판정을 여기서 만들지 않는다**(감지기 M24·M31) — 고를 수 있는가·골라졌는가·
   * 상한을 넘었는가는 전부 `disposal-selection.ts` 한 곳에서 나오고, 표와 요약이 같은 결과를 본다.
   *
   * **지금 표에 있는 줄만 만든다.** 초안에 남아 있어도 사라진 줄은 여기 나타나지 않으므로
   * 요약에도 뒤따르는 회차의 요청에도 실리지 않는다.
   */
  const lineTableRows = toDisposalLineRows(lineRows, lineDraft, balances);

  /**
   * 무엇을 얼마나 폐기할 것인가. **화면이 한 번만 부르고 아래로 나눠 준다**(감지기 M31).
   *
   * 라인 표의 요약도, 뒤 회차의 「품의 등록」 활성 판정도, 확인 창의 줄 목록도, 요청 조립의
   * 입력도 전부 이 한 결과에서 나온다 — 부르는 자리가 둘이면 같은 함수라도 **한쪽 인자만
   * 바뀌었을 때 표와 버튼이 서로 다른 말을 한다.**
   */
  const selection = describeDisposalSelection(lineTableRows);

  /**
   * 고른 전표의 창고 이름. **좁히지 않은 참조로 푼다** — 좁힘은 선택지 하나에만 걸린다
   * (좁힌 목록으로 풀면 좁힘 밖 창고의 전표에서 정상 값이 「알 수 없음」으로 찍힌다).
   */
  const detailWarehouseName = describeReference(
    toReference(warehouses, detailData?.receipt.warehouseId ?? null),
  );

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
          warehouseOptions={warehouseOptions}
          warehouseNote={warehouseNote}
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
              onRetryReferences={retryReferences}
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

      {/*
       * 아래 구획 — **네 갈래를 가른다**: 없음 안내(S4) · 고르기 전(S0) · 불러오는 중 · 고른 뒤(S1·S2).
       *
       * 「없음」이 「고르기 전」보다 앞선다 — 404로 `gr`를 정리하고 나면 주소가 같아져, 순서를
       * 뒤집으면 사용자가 **자기가 무엇을 눌렀는지 되짚을 수 없다.**
       *
       * **상세 실패의 다른 갈래를 여기서 가르지 않는다.** 계약의 입고 상세 응답은 200과 404
       * 둘뿐이고(실측) **403이 없다** — 만들면 닿을 수 없는 가지가 된다. 네트워크 끊김은
       * 골격이 서 있는 동안 화면이 조용히 기다리고, 사용자가 「다시 조회」로 되살린다.
       */}
      <section className="pane" aria-label={t.panes.lines}>
        {hasNotFoundNotice && selectedReceiptId === null && (
          <EmptyState
            size="sm"
            live
            title={t.empty.notFoundTitle}
            description={t.empty.notFoundDescription}
          />
        )}

        {!hasNotFoundNotice && selectedReceiptId === null && (
          <EmptyState
            size="sm"
            title={t.empty.noSelectionTitle}
            description={t.empty.noSelectionDescription}
          />
        )}

        {selectedReceiptId !== null && detailData === undefined && (
          <div role="status" aria-label={t.loading.detail}>
            <SkeletonText lines={3} />
          </div>
        )}

        {detailData !== undefined && (
          <>
            <ReceiptSummaryPane
              receipt={detailData.receipt}
              warehouseName={detailWarehouseName}
            />

            <GrLineTable
              rows={lineTableRows}
              itemLookup={items}
              uomLookup={uoms}
              lotLookup={lots}
              locationLookup={locations}
              hasBalanceError={balances.isError}
              hasBalanceTruncated={balances.truncated}
              /* 이 회차에는 쓰기가 없어 전체 잠금이 걸리는 자리가 없다 — 뒤 회차가 채운다. */
              isLocked={false}
              selection={selection}
              onToggleSelect={(goodsReceiptLineId) => {
                setLineDraft((prev) => toggleLineSelection(prev, goodsReceiptLineId));
              }}
              onChangeQty={(goodsReceiptLineId, text) => {
                setLineDraft((prev) => setDraftQty(prev, goodsReceiptLineId, text));
              }}
              onRetryReferences={retryLineReferences}
              onRetryBalances={() => {
                balances.refetch();
              }}
            />
          </>
        )}
      </section>
    </>
  );
};
