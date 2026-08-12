import { Breadcrumb, Button, EmptyState, PageHeader, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { SaveErrorBanner } from '../../patterns/master';
import {
  isRequiredCodeListPending,
  PLACEHOLDER_SUPPLIER_RETURN_CODES,
  toCodeOptionSets,
} from './code-options';
import { DiscardConfirmDialog } from './discard-confirm-dialog';
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
  toBusinessDate,
  toGoodsIssueRequest,
  toIssuedLocal,
  toReturnLines,
} from './issue-request';
import {
  EMPTY_LINE_DRAFT,
  hasAnyLineDraftValue,
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
  usePartnerOptions,
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
  useSupplierReturnPost,
} from './queries';
import { ReceiptSummaryPane } from './receipt-summary-pane';
import { ResultPane, type ResultLineSummary } from './result-pane';
import { ReturnForm } from './return-form';
import { describeReturnSelection, toReturnLineRows } from './return-selection';
import { SubmitConfirmDialog, type SubmitLineSummary } from './submit-confirm-dialog';
import {
  EMPTY_RETURN_DRAFT,
  formatDateTime,
  hasAnyReturnDraftValue,
  toReturnResultView,
  type ReceiptLineView,
  type ReceiptView,
  type ReturnCodeKey,
  type ReturnDraft,
  type ReturnResultView,
  type SelectOption,
} from './types';
import { returnBlockReason, validateReturnDraft } from './validation';

const t = messages.supplierReturn;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: ReceiptView[] = [];
const EMPTY_LINES: ReceiptLineView[] = [];
const NO_FIELD_ERRORS: Record<string, string> = {};

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
 * **쓰기는 하나이고 되돌릴 수 없다.** 「반품 처리」 한 번이 출고 전표를 만들고 **곧바로
 * 전기해 재고를 차감한다**(착수 이슈 §6 — 두 번 호출로 나누지 않는다). 계약의 출고 취소는
 * 승인을 타며 다른 화면 소관이라 **이 화면에는 되돌릴 수단이 없다** — 확인 창이 그 사실을
 * 그대로 말하고, 결과 구획은 **화면이 확인한 것만** 말한다.
 *
 * **이 회차에서 화면이 열린다** — 라우트와 사이드바에 등록된다. 앞 회차들이 노출을 미룬 것은
 * 반품할 수 없는 「공급사 반품 처리」가 미완성 기능으로 보이기 때문이었다.
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
 * | **S1** 전표를 골랐다 | `gr`이 있고 **상세가 200** | 위 + 제목줄 · 라인 표 · **반품 정보 구획** | 위 + **줄 고르기 · 반품 수량 입력 · 반품 정보 입력** | `+&gr` |
 * | **S2** 보낼 것이 갖춰졌다 | **줄이 하나 이상 골라졌고 전 검증을 통과했다** | 위 + 「반품 처리」 활성 | 위 + **반품 처리** | 같음 |
 * | **S3** 이번 세션에서 처리했다 | **이 화면의 처리 성공 결과** | 위 + **결과 구획** | 조회 · 다시 고르기(초안은 비었다) | `gr` 유지 |
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
   * **이 회차에 마지막 세 열이 실제 상태가 됐다** — 결과 구획·열린 창·실패 배너. 앞 회차가
   * 열을 미리 세워 둔 덕분에 **행을 다시 세지 않고 그 열만 채웠다.**
   *
   * **초안 열은 둘이고 합치지 않는다.** 매인 대상이 다르기 때문이다 — 줄·수량은 **그 전표의
   * 줄**에 매이고, 반품 정보는 **반품이라는 행위**(누구에게·무엇으로·언제)에 매인다. 그래서
   * 1~5행에서 한쪽만 비워진다. 한 열로 합치면 그 구분이 표에서 사라지고, 곧 코드에서도 사라진다.
   *
   * | # | 조작 | 조건 5종 | `page` | `gr` | **404 안내** | **줄·수량 초안** | **반품 정보 초안** | 결과 구획 | 열린 창 | 실패 배너 |
   * | :-: | --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
   * | 1 | 조건 변경·조회 | 바뀐다 | **첫 쪽** | **비운다** | **비운다** | **비운다** | **유지** | **비운다** | **닫는다** | **비운다** |
   * | 2 | 초기화 | **비운다** | 첫 쪽 | 비운다 | **비운다** | **비운다** | **유지** | **비운다** | **닫는다** | **비운다** |
   * | 3 | 쪽 이동 | 유지 | 옮긴 쪽 | **비운다** | **비운다** | **비운다** | **유지** | **비운다** | **닫는다** | **비운다** |
   * | 4 | 전표 고르기·해제 | 유지 | **유지** | 넣고 뺀다 | **비운다** | **비운다** | **유지** | **비운다** | **닫는다** | **비운다** |
   * | 5 | **상세가 404** | 유지 | 유지 | **비운다** | **세운다** | **비운다** | **유지** | **비운다** | **닫는다** | **비운다** |
   * | 6 | 줄 고르기·해제 | 유지 | 유지 | 유지 | 유지 | 바뀐다 | 유지 | **유지** | 유지 | **유지** |
   * | 7 | 반품 수량 입력 | 유지 | 유지 | 유지 | 유지 | 바뀐다 | 유지 | **유지** | 유지 | **유지** |
   * | 8 | 반품 정보 입력 | 유지 | 유지 | 유지 | 유지 | 유지 | 바뀐다 | **유지** | 유지 | **유지** |
   * | 9 | 목록·상세·참조·잔액 응답 도착 | 유지 | 유지 | 유지 | 유지 | **건드리지 않는다** | **건드리지 않는다** | 유지 | 유지 | 유지 |
   * | 10 | **다시 조회** | 유지 | 유지 | 유지 | 유지 | **유지** | **유지** | 유지 | 유지 | 유지 |
   * | 11 | **처리 성공** | 유지 | 유지 | **유지** | 유지 | **비운다** | **비운다** | **채운다** | 닫혀 있다 | 비운다 |
   * | 12 | 처리 실패 | 유지 | 유지 | 유지 | 유지 | **유지** | **유지** | **비운다** | 닫혀 있다 | **세운다** |
   * | 13 | 입력 지우기(초안 파기) | 유지 | 유지 | 유지 | 유지 | **비운다** | **비운다** | **비운다** | 닫는다 | **비운다** |
   * | 14 | **전송 중** | 잠긴다 | 잠긴다 | 잠긴다 | 유지 | 잠긴다 | 잠긴다 | 유지 | 유지 | 유지 |
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
   * - **1~5행이 창을 닫는 이유**: 확인 창이 열린 채 주소가 바뀌면 **사용자가 확인한 것과
   *   나가는 것이 갈린다.** 뒤로가기·앞으로가기·주소 직접 편집은 클릭 핸들러를 거치지 않으므로
   *   창 닫기는 **고른 식별자에 묶인 effect**가 한다.
   * - **1~5행이 실패 배너를 비우는 이유**: **배너는 자기 대상보다 오래 살지 않는다.** 이
   *   화면의 실패는 「이 입고 전표에서 이 줄들을 이만큼 반품하려 했는데 거절당했다」는 사실이라
   *   매인 대상이 `gr`다 — 없어지면 배너가 가리킬 것이 없다.
   * - **6~8행이 배너를 유지하는 이유**: 같은 대상에 대한 사실이 아직 유효하다. 사용자가 거절
   *   사유를 읽으며 값을 고치는 중이다 — 여기서 지우면 무엇이 거절됐는지 모르는 채 다시 보낸다.
   * - **1~5행이 반품 정보 초안을 유지하는 이유**: 매인 대상이 전표가 아니라 **반품이라는
   *   행위**다. 같은 공급사에 여러 전표를 잇달아 되돌려 보내는 것이 흔한 쓰임인데, 전표를
   *   옮길 때마다 공급사·코드 넷·일시를 다시 치게 하면 사용자는 값을 잃지 않으려고 전표를
   *   한 번에 하나씩만 다루게 된다. 줄·수량은 반대다 — 앞 전표의 줄 번호는 새 전표에서 뜻이 없다.
   * - **11행이 `gr`를 유지하면서 초안을 비우는 이유**: 방금 무엇으로부터 반품했는지 화면에
   *   남아 있어야 결과를 읽을 수 있다. 그러나 **같은 줄이 그대로 골라져 있으면 한 번 더 누르는
   *   사고가 생긴다** — 멱등 키가 호출마다 새로 만들어져 그 한 번이 전표 두 벌이 된다.
   *   **이때는 반품 정보도 함께 비운다**: 1~5행과 달리 그 반품 행위 자체가 끝났다.
   * - **12행이 초안을 비우지 않는 이유**: 실패했는데 입력을 지우면 처음부터 다시 친다.
   * - **14행이 대상을 바꾸는 길까지 잠그는 이유**: 열어 두면 사용자가 다른 전표로 옮긴 뒤
   *   **앞 요청의 결과가 지금 보는 맥락에 나타난다.**
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

  /*
   * 거래처는 **반품 정보 구획이 그려질 때** 쓴다 — 그 구획도 상세 응답을 기다리므로 미리 받아
   * 둘 이득이 없다. 앞 참조 다섯과 달리 **고르는 값**이라 미사용 거래처를 함께 받지 않는다.
   */
  const partners = usePartnerOptions(hasSelection);

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
   * 반품 정보 초안 — 누구에게·무엇으로·언제 되돌려 보내는가(수명 표의 「초안 2벌」 중 둘째).
   *
   * **줄 초안과 갈라 둔다.** 하나로 묶으면 「줄만 비우고 정보는 남긴다」 같은 갈래를 만들 수
   * 없고, 무엇보다 **되돌림 축이 같아야 한다는 사실이 자료 구조에서 사라진다** — 둘 다 `gr`에
   * 매여 있고 그 사실을 아래 두 effect가 각각 지킨다.
   */
  const [returnDraft, setReturnDraft] = useState<ReturnDraft>(EMPTY_RETURN_DRAFT);

  /** 만들어진 반품 전표. `null`이면 아직 처리하지 않았거나 마지막 시도가 실패했다 */
  const [result, setResult] = useState<ReturnResultView | null>(null);

  /**
   * 보내기 전에 화면이 잡은 오류. **「반품 처리」를 누른 뒤에만 세운다** —
   * 치는 도중에 붉은 글씨를 띄우면 아직 넣지도 않은 칸이 잘못된 것처럼 보인다.
   */
  const [localFieldErrors, setLocalFieldErrors] = useState<Record<string, string>>(NO_FIELD_ERRORS);

  /** 반품 처리 확인 창이 열려 있는가. **확인하기 전에는 요청이 나가지 않는다** */
  const [isConfirmOpen, setConfirmOpen] = useState(false);

  /** 초안 파기 확인 창이 열려 있는가. 두 초안을 **함께** 버린다 */
  const [isDiscardOpen, setDiscardOpen] = useState(false);

  const post = useSupplierReturnPost({
    goodsReceiptId: selectedReceiptId,
    onSuccess: (data) => {
      setResult(toReturnResultView(data.goodsIssue, data.lines));
      /*
       * **초안 두 벌을 비운다**(수명 표 11행 · 중복 전송 완화의 한 층). 같은 줄이 그대로
       * 골라져 있으면 한 번 더 누르는 사고가 생기는데, 멱등 키가 호출마다 새로 만들어져
       * (이 저장소 이슈로 추적 중) 그 한 번이 **전표 두 벌**이 된다.
       *
       * 재조회에 얹지 않는 이유는 같은 응답이 오면 캐시가 참조를 그대로 유지해 되돌림 effect가
       * 깨어나지 않기 때문이다 — 그러면 처리에 성공했는데 입력이 남는다.
       */
      setLineDraft(EMPTY_LINE_DRAFT);
      setReturnDraft(EMPTY_RETURN_DRAFT);
      setLocalFieldErrors(NO_FIELD_ERRORS);
    },
  });

  /**
   * 전송 중인가 — **첫째 겹의 원천이다.**
   *
   * 이 값 하나가 컨트롤 전부(조회·초기화·쪽 이동·전표 선택·줄 선택·수량·반품 정보·두 버튼)를
   * 닫고, **잠금을 받지 않는 컨트롤**(조건 칩의 ×)은 핸들러 가드(둘째 겹)가 막는다.
   */
  const isLocked = post.isSaving;

  /*
   * **대상이 바뀌면 그 대상에 매인 것만 거둔다**(수명 표 1~5행).
   *
   * 결과 구획과 창 둘이 여기 있다. **반품 정보 초안은 여기 없다** — 매인 대상이 다르기
   * 때문이다:
   *
   * | 초안 | 무엇에 매여 있나 | 대상이 바뀌면 |
   * | --- | --- | :-: |
   * | 줄 선택·반품 수량 | **그 전표의 줄** — 앞 전표의 9401번 줄은 새 전표에서 뜻이 없다 | **비운다**(위 effect) |
   * | 반품 정보 | **반품이라는 행위** — 누구에게·무엇으로·언제 되돌려 보내는가 | **유지한다** |
   *
   * 같은 공급사에 **여러 전표를 잇달아 되돌려 보내는 것이 이 화면의 흔한 쓰임**이다. 전표를
   * 옮길 때마다 공급사·코드 넷·출고 일자·시각을 다시 치게 하면, 사용자는 값을 잃지 않으려고
   * 전표를 한 번에 하나씩만 다루게 된다. 배너를 `gr`에 매다는 것과 **같은 문법**이다 —
   * 매인 대상이 사라진 것만 거둔다.
   *
   * 화면이 잡은 필드 오류도 남긴다. 그 오류는 **유지되는 초안에서 나온 것**이라(코드 길이)
   * 대상이 바뀌어도 여전히 참이다. 서버가 준 필드 오류는 `gr`에 매여 아래 effect가 거둔다.
   *
   * 창이 여기 있어야 하는 이유는, 확인 창이 「지금 고른 전표에서 이 줄들을 이만큼 보낸다」는
   * 확인이기 때문이다 — 대상이 바뀌면 그 확인은 뜻을 잃는데 열린 채로 두면 **사용자가 확인한
   * 것과 실제로 나가는 것이 갈린다.** 그 길은 클릭 핸들러의 잠금·가드가 닿지 않는다
   * (뒤로가기·앞으로가기·주소 직접 편집).
   *
   * **의존성은 `gr` 하나뿐이다**(#43). 라인·참조·잔액 응답이나 `useMemo` 파생 객체를 넣으면
   * 갱신이 도착할 때마다 **치던 값이 사라진다.** 위 effect와 갈라 둔 것은 그쪽의 「의존성이
   * `gr` 하나뿐」이 줄 초안을 지키는 규칙이라 다른 일을 얹으면 무엇을 지키는지 읽히지 않아서다.
   */
  useEffect(() => {
    setResult(null);
    setConfirmOpen(false);
    setDiscardOpen(false);
  }, [selectedReceiptId]);

  /*
   * **실패 배너는 자기 대상보다 오래 살지 않는다**(수명 표 1~5행 · 앞 화면의 리뷰가 세운 규칙).
   *
   * 이 화면의 실패는 「이 입고 전표에서 이 줄들을 이만큼 반품하려 했는데 거절당했다」는
   * 사실이라 매인 대상이 `gr`다. 전표 A의 「권한이 없습니다」가 **전표 B의 라인 표 위에** 서면
   * 사용자는 B도 막힌 것으로 읽는다 — 한 화면이 서로 어긋나는 두 말을 동시에 한다.
   *
   * **줄 선택·수량·반품 정보 입력에는 반응하지 않는다**(6~8행). 같은 대상에 대한 사실이 아직
   * 유효하고, 사용자는 거절 사유를 읽으며 값을 고치는 중이다.
   *
   * **의존성은 고른 전표 하나다.** `post.reset`은 렌더마다 새 참조라(공통 훅이 `useMutation`
   * 결과를 물고 있다) 의존성에 넣으면 **매 렌더 배너가 지워져** 실패가 아예 보이지 않는다.
   */
  useEffect(() => {
    if (post.error === null) return;

    post.reset();
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
   * 무엇을 얼마나 보낼 것인가. **화면이 한 번만 부르고 아래로 나눠 준다**(완료 조건 C31).
   *
   * 라인 표의 요약도, 「반품 처리」의 활성 판정도, 확인 창의 줄 목록도, 요청 조립의 입력도
   * 전부 이 한 결과에서 나온다 — 부르는 자리가 둘이면 같은 함수라도 **한쪽 인자만 바뀌었을 때
   * 표와 버튼이 서로 다른 말을 한다.**
   */
  const selection = describeReturnSelection(lineTableRows);

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
    /*
     * **전송 중에는 대상을 바꾸지 않는다** — 잠금의 **둘째 겹**이다(수명 표 14행).
     *
     * 눈에 보이는 컨트롤은 전부 잠가 두었으나 **조건 칩의 ×는 잠기지 않는다** — 디자인 시스템
     * `Chip`이 그 prop을 갖고 있지 않다(실측). 그 길로 들어오면 조건이 바뀌며 `gr`가 풀리고,
     * 앞서 보낸 반품의 결과가 **다른 전표 맥락에** 나타난다.
     *
     * 여기가 이 화면에서 **가드가 홀로 서는 유일한 자리**다. 나머지 호출부(조회·초기화·
     * 첫 쪽으로·쪽 이동)는 컨트롤이 이미 잠겨 있어 이 줄에 닿지 않는다.
     */
    if (isLocked) return;

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
   * **화면이 판단에 쓰는 값을 전부 다시 한다**(수명 표 10행).
   *
   * 목록만 다시 부르면 제목줄과 라인 표가 낡은 채로 남아 **갱신된 값과 갱신되지 않은 값이
   * 한 화면에 섞인다**(W-01-07의 Major 지적). 이 화면에서 그 어긋남은 비싸다 — 다른 사람이
   * 먼저 반품하거나 전표가 고쳐지면 화면의 줄 집합이 낡는데, 낡은 줄로 반품을 보내면
   * **없어진 자재를 되돌려 보내려 한다.**
   *
   * **보유 수량도 함께 부른다.** 위 문단이 든 피해(「다른 사람이 먼저 반품한다」)로 바뀌는 것은
   * 줄 집합만이 아니라 **그 LOT에 남은 양**이다. 낡은 상한은 두 방향으로 해로운데 나쁜 쪽이 더
   * 잦다 — 낮은 쪽으로 낡으면 화면이 「보유 수량 …보다 많이 되돌려 보낼 수 없습니다」라는
   * **사실이 아닌 문장으로 정당한 반품을 막는다.** 승인 13-6이 「막는 쪽이 더 안전해 보이지만」
   * 이라며 물리친 바로 그 형태이고, **성공한 잔액을 다시 부를 길은 이 버튼뿐이다** —
   * 표 아래 「다시 시도」는 조회가 **실패했을 때만** 그려진다.
   *
   * **이름 참조 넷은 여기서 부르지 않는다.** 가르는 잣대는 「마스터냐 아니냐」가 아니라
   * **화면이 그 값으로 막고 푸느냐**다. 보유 수량은 상한이라 낡으면 판정이 틀리지만, 이름은
   * 알리기만 한다 — **자재 LOT의 보류 표식조차 선택을 막지 않고**(반품해도 보류는 유지된다 ·
   * 착수 이슈 §6) 그 값이 낡아도 사용자의 결정이 달라지지 않는다. 이름의 복구는 그것이
   * 실패로 보이는 구획의 「다시 시도」가 소유한다(계획 결정 17).
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

    /*
     * 잔액에는 가드가 따로 없다 — 고르기 전에는 라인이 없어 **만들어진 조회 자체가 0건**이라
     * 순회할 것이 없다. 「고르지 않았으면 부르지 않는다」가 자료 구조로 지켜지는 자리다.
     */
    balances.refetch();
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
   * 거래처의 복구 경로도 **자기 구획이 소유한다**(계획 결정 17). 라인 표의 이름 넷과 갈라 두는
   * 이유는 안내 문구가 적은 대상과 다시 부르는 대상이 어긋나면 눌러도 한쪽은 실패인 채로
   * 남는데 문구는 둘 다 고쳐질 것처럼 말하기 때문이다.
   */
  const retryPartners = (): void => {
    partners.refetch();
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

  /** 잠긴 두 버튼의 사유를 잇는 `id`. 사유는 **잠근 자리 옆에서** 읽혀야 한다(배치 규범 4). */
  const blockReasonId = useId();
  const discardReasonId = `${blockReasonId}-discard`;

  /**
   * 버릴 것이 있는가. **두 초안을 함께 본다** — 한쪽만 보면 나머지가 확인 없이 사라진다.
   * 없으면 「입력 지우기」를 잠근다: 눌러도 아무 일이 없는 버튼은 화면을 고장으로 읽히게 한다.
   */
  const hasDraft = hasAnyLineDraftValue(lineDraft) || hasAnyReturnDraftValue(returnDraft);

  /**
   * 두 초안을 함께 버린다(수명 표 13행). **서버를 부르지 않는다** — 보내기 전 복귀이고,
   * 이 화면의 취소에 해당하는 오퍼레이션은 01 도메인 계약에 없다(착수 이슈 §6).
   *
   * **결과 구획과 실패 배너도 함께 거둔다.** 「버린다」는 앞서 한 시도를 통째로 물리는 것이라,
   * 방금 만든 전표 번호나 거절 사유만 남으면 무엇이 지금 상태인지 알 수 없다.
   */
  const discardDrafts = (): void => {
    setLineDraft(EMPTY_LINE_DRAFT);
    setReturnDraft(EMPTY_RETURN_DRAFT);
    setLocalFieldErrors(NO_FIELD_ERRORS);
    setResult(null);
    post.reset();
  };

  /** 표기 헬퍼 — 확인 창과 결과 구획이 **같은 규칙으로** 이름과 수량을 읽는다. */
  const itemNameOf = (itemId: number): string => describeReference(toReference(items, itemId));
  const lotNameOf = (lotId: number): string => describeReference(toReference(lots, lotId));
  const qtyTextOf = (qty: number, uomId: number): string =>
    t.lineTable.returnQtyPair(qty, describeReference(toReference(uoms, uomId)));

  /**
   * 확인 창이 보일 줄. **요청에 실릴 줄과 같은 자리에서 나온다** — 읽을 수 없는 수량인 줄은
   * 요청 조립이 거르므로 여기서도 걸러야 「확인한 것과 나가는 것」이 갈리지 않는다.
   */
  const submitLines: SubmitLineSummary[] = selection.selectedRows.flatMap((row) =>
    row.qty.kind === 'qty'
      ? [
          {
            ordinal: row.ordinal,
            item: itemNameOf(row.line.itemId),
            lot: lotNameOf(row.line.lotId),
            qty: qtyTextOf(row.qty.value, row.line.uomId),
          },
        ]
      : [],
  );

  /**
   * 결과가 보일 줄. **서버가 되돌려 준 배열에서 나온다**(계획 결정 13) — 화면이 보낸 줄을
   * 되비추면 서버가 무엇을 만들었는지가 아니라 화면이 무엇을 보냈는지를 말하는 것이 된다.
   */
  const resultLines: ResultLineSummary[] =
    result?.lines.map((line, index) => ({
      ordinal: index + 1,
      item: itemNameOf(line.itemId),
      lot: lotNameOf(line.lotId),
      qty: qtyTextOf(line.issueQty, line.uomId),
    })) ?? [];

  /**
   * 반품 정보 구획. **고른 전표가 있을 때만 그린다** — 대상이 없는데 공급사·코드를 받으면
   * 그 입력이 무엇에 대한 것인지 화면이 말할 수 없다.
   *
   * 고른 전표를 **인자로 받는다** — 여기까지 왔다는 것이 곧 대상이 있다는 뜻이라, 안쪽에서
   * 다시 `null` 가지를 만들지 않는다.
   */
  const returnPane = (receipt: ReceiptView): ReactNode => {
    const fieldErrors = { ...post.fieldErrors, ...localFieldErrors };
    const blockReason = returnBlockReason({
      isCodeListPending: isRequiredCodeListPending(codeOptions),
      draft: returnDraft,
      selection: selection.ready,
    });

    /**
     * 보낼 수 있는 상태인가. **활성 조건과 길이를 함께 본다.**
     *
     * 창을 여는 자리와 실제로 보내는 자리가 **둘 다** 이것을 부른다 — 「버튼이 막았으니
     * 여기서는 안 봐도 된다」가 성립하려면 버튼과 전송 사이에 상태가 바뀔 수 없어야 하는데,
     * **확인 창이 그 사이를 벌려 놓는다.** 창이 열려 있는 동안 다른 사람이 그 줄을 먼저
     * 반품하고 사용자가 「다시 조회」를 누르면 고른 줄이 사라질 수 있다.
     */
    const findBlocked = (): Record<string, string> | null => {
      const errors = validateReturnDraft(returnDraft);

      if (Object.keys(errors).length > 0) return errors;

      return blockReason === null ? null : {};
    };

    /** 확인 창을 연다. 막히면 **창을 열지 않고 요청도 만들지 않는다.** */
    const openConfirm = (): void => {
      const blocked = findBlocked();

      setLocalFieldErrors(blocked ?? NO_FIELD_ERRORS);

      if (blocked !== null) return;

      setConfirmOpen(true);
    };

    /**
     * 보낸다. **보내기 직전에 한 번 더 본다.**
     *
     * 막혀 있으면 **창을 닫고 보내지 않는다** — 여기서 그냥 보내면 되돌릴 수 없는 전표가
     * 빈 코드나 사라진 줄로 나간다(계약에 `minLength`도 `minItems`도 없어 서버가 받는다).
     */
    const submit = (): void => {
      setConfirmOpen(false);

      const blocked = findBlocked();

      if (blocked !== null) {
        setLocalFieldErrors(blocked);

        return;
      }

      const body = toGoodsIssueRequest({
        receipt,
        lines: toReturnLines(selection.selectedRows),
        draft: returnDraft,
        /* 발생 시각은 **제출 순간**이다. 순수 함수에 넘겨 그 사실이 인자로 드러나게 한다. */
        now: new Date(),
      });

      /* 조립이 마지막으로 거른다 — 빈 라인은 계약이 막지 않는다(`minItems` 부재). */
      if (body === null) return;

      /* 실패하면 결과 구획이 비어 있어야 한다(수명 표 12행) — 앞 성공의 번호가 남으면 오해한다. */
      setResult(null);
      post.write(body);
    };

    const changeCode = (key: ReturnCodeKey, value: string): void => {
      setReturnDraft((prev) => ({ ...prev, codes: { ...prev.codes, [key]: value } }));
    };

    return (
      <>
        <ReturnForm
          values={returnDraft}
          supplierOptions={toSelectOptions(partners)}
          /*
           * 잘림은 **선택칸에 붙이고** 실패는 복구 버튼과 함께 폼이 따로 낸다 — 잘림은 다시
           * 불러도 같은 쪽이 오므로 사용자가 할 조치가 없고, 실패는 있다.
           */
          supplierNote={partners.truncated ? t.reasons.partnersTruncated : undefined}
          hasSupplierError={partners.isError}
          codeOptions={codeOptions}
          fieldErrors={fieldErrors}
          isLocked={isLocked}
          onChangeSupplier={(value) => {
            setReturnDraft((prev) => ({ ...prev, supplier: value }));
          }}
          onChangeCode={changeCode}
          onChangeIssuedDate={(value) => {
            setReturnDraft((prev) => ({ ...prev, issuedDate: value }));
          }}
          onChangeIssuedTime={(value) => {
            setReturnDraft((prev) => ({ ...prev, issuedTime: value }));
          }}
          onChangeReplacementExpected={(value) => {
            setReturnDraft((prev) => ({ ...prev, replacementExpected: value }));
          }}
          onChangeSendToErp={(value) => {
            setReturnDraft((prev) => ({ ...prev, sendToErp: value }));
          }}
          onChangeRemarks={(value) => {
            setReturnDraft((prev) => ({ ...prev, remarks: value }));
          }}
          onRetrySupplierOptions={retryPartners}
        />

        {/*
         * 저장 실패는 **네 갈래**다(계획 결정 14). 배너가 검증 실패(400)·권한 없음(403)·
         * 저장 충돌(409)·응답 없음(네트워크)의 문구를 갈라 내고, **409에만** 「최신 불러오기」가
         * 붙는다 — 다시 읽어 풀리는 것은 충돌뿐이라 다른 갈래에 내면 입력만 버리게 된다.
         */}
        <SaveErrorBanner error={post.error} onReload={refreshAll} />

        {/*
         * **응답을 받지 못한 실패에만 한 줄을 더한다.** 공통 문구는 「다시 시도하세요」로 끝나는데,
         * 이 화면에서 확인 없이 다시 보내면 같은 반품이 전표 두 벌로 남는다 — 공통 쓰기 훅이
         * 호출마다 새 멱등 키를 만들어 서버가 재전송으로 보지 못한다.
         */}
        {post.error?.kind === 'network' && <p className="field-error">{t.notes.submitRecheck}</p>}

        <div className="form-actions">
          {/* 지우기가 반품 처리보다 앞에 선다 — 되돌릴 수 없는 것이 손 가까이 있으면 안 된다. */}
          <div className="field-cell">
            <Button
              variant="text"
              disabled={!hasDraft || isLocked}
              aria-describedby={hasDraft ? undefined : discardReasonId}
              onClick={() => {
                setDiscardOpen(true);
              }}
            >
              {t.actions.discardDrafts}
            </Button>
            {!hasDraft && (
              <span id={discardReasonId} className="field-note">
                {t.actionReasons.nothingToDiscard}
              </span>
            )}
          </div>

          <div className="field-cell">
            <Button
              disabled={blockReason !== null || isLocked}
              loading={isLocked}
              aria-describedby={blockReason === null ? undefined : blockReasonId}
              onClick={openConfirm}
            >
              {t.actions.submit}
            </Button>
            {blockReason !== null && (
              <span id={blockReasonId} className="field-note">
                {blockReason}
              </span>
            )}
          </div>
        </div>

        {isConfirmOpen && (
          <SubmitConfirmDialog
            summary={{
              supplierName: describeReference(
                toReference(partners, returnDraft.supplier === '' ? null : Number(returnDraft.supplier)),
              ),
              issueTypeCode: returnDraft.codes.issueType,
              sourceDocumentTypeCode: returnDraft.codes.sourceDocumentType,
              destinationTypeCode: returnDraft.codes.destinationType,
              reasonCode: returnDraft.codes.reason,
              issuedAt: formatDateTime(toIssuedLocal(returnDraft)),
              businessDate: toBusinessDate(toIssuedLocal(returnDraft)),
              replacementExpected: returnDraft.replacementExpected,
              sendToErp: returnDraft.sendToErp,
              remarks: returnDraft.remarks,
              lines: submitLines,
              /* 상한을 확인하지 못한 줄이 **보낼 줄에 섞여 있을 때만** 밝힌다(위험 10). */
              hasUnknownOnHand: selection.selectedRows.some((row) => row.onHand.kind !== 'known'),
            }}
            onConfirm={submit}
            onClose={() => {
              setConfirmOpen(false);
            }}
          />
        )}
      </>
    );
  };

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
          isLocked={isLocked}
          /* 판정은 **화면이 한 번 부른 결과**를 넘긴다 — 표와 버튼이 같은 것을 본다(C31). */
          selection={selection}
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

  /**
   * 반품 정보 구획을 열 대상. **라인 표가 그려지는 조건과 같다** — 조건이 갈리면 표는 없는데
   * 폼만 있는 상태가 생기고, 사용자는 무엇에 대한 입력인지 모른 채 값을 넣는다.
   */
  const returnTarget =
    selectedReceiptId !== null &&
    !hasNotFoundNotice &&
    !isDetailNotFound &&
    !detail.isError &&
    detailData !== undefined
      ? detailData.receipt
      : null;

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
        actions={
          <Button variant="outlined" size="sm" disabled={isLocked} onClick={refreshAll}>
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
          isLocked={isLocked}
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
              isLocked={isLocked}
              onFirstPage={() => {
                applyQuery(filters);
              }}
              onToggleSelect={toggleSelectReceipt}
              onRetryReferences={retryTopReferences}
            />
            {!list.isPending && (
              <PageNav
                view={pageView}
                isLocked={isLocked}
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

      {/*
       * 반품 정보는 **라인 표가 그려지는 조건과 같은 조건**으로 연다 — 갈리면 표는 없는데
       * 폼만 있는 상태가 생기고, 사용자는 무엇에 대한 입력인지 모른 채 값을 넣는다.
       */}
      {returnTarget !== null && (
        <section className="pane" aria-label={t.panes.form}>
          {returnPane(returnTarget)}
        </section>
      )}

      {/*
       * 결과는 **따로 선 구획**이다. 반품 정보 폼 안에 두면 다음 처리를 준비하는 입력과 방금
       * 만들어진 번호가 섞인다. 이름은 부품이 `role="status"`로 갖는다 — 구획에도 같은 이름을
       * 붙이면 두 번 읽힌다.
       */}
      {result !== null && (
        <section className="pane">
          <ResultPane result={result} lines={resultLines} />
        </section>
      )}

      {isDiscardOpen && (
        <DiscardConfirmDialog
          onConfirm={() => {
            discardDrafts();
            setDiscardOpen(false);
          }}
          onClose={() => {
            setDiscardOpen(false);
          }}
        />
      )}
    </>
  );
};
