import { Breadcrumb, EmptyState, PageHeader, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { SaveErrorBanner } from '../../patterns/master';
import { CreatedReceiptsPane } from './created-receipts-pane';
import { DiscardConfirmDialog } from './discard-confirm-dialog';
import { ExcessForm } from './excess-form';
import {
  DEFAULT_FILTERS,
  readFilters,
  readPage,
  readSelectedPoId,
  toFilterQuery,
  toSearchParams,
  type PoFilters,
} from './filters';
import { createDrafts, hasAnyQty, setDraftQty, type LineDrafts } from './line-draft';
import { LoadErrorBanner } from './load-error-banner';
import {
  describeReference,
  lookupNote,
  toReference,
  useItemOptions,
  usePlantOptions,
  useSupplierOptions,
  useUomOptions,
  type LookupResult,
} from './lookups';
import { ModeActions } from './mode-actions';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { PoFilterBar } from './po-filter-bar';
import { PoTable } from './po-table';
import { ReceiptHeaderForm } from './receipt-header-form';
import { usePurchaseOrderLines, usePurchaseOrders, useSplitRegister } from './queries';
import { toSplitLines } from './split-calc';
import { toSplitParts, toSplitRequest } from './split-request';
import { SplitLineTable } from './split-line-table';
import {
  EMPTY_HEADER_DRAFT,
  hasAnyHeaderValue,
  toCreatedReceiptView,
  type CreatedReceiptView,
  type HeaderDraft,
  type PoLineView,
  type PoView,
  type SelectOption,
  type SplitMode,
} from './types';
import { canSubmit, modeBlockReason, qtyErrorReason, validateHeader } from './validation';

const t = messages.overReceiptSplit;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: PoView[] = [];
const EMPTY_LINES: PoLineView[] = [];
const EMPTY_DRAFTS: LineDrafts = {};
const NO_FIELD_ERRORS: Record<string, string> = {};

/**
 * 초안을 버리게 되는 조작. **버리기 전에 확인을 받으려면 「무엇을 하려 했는지」를 붙들어야 한다.**
 *
 * 셋 모두 초안이 뜻을 잃는 자리다(수명 표 1·3·4·10행) — 대상이 바뀌거나 사라지므로
 * 라인에 묶인 수량이 가리킬 곳이 없어진다.
 */
type DiscardIntent =
  | { kind: 'cancel' }
  | { kind: 'select'; purchaseOrderId: number }
  | { kind: 'query'; filters: PoFilters; page: number };

/**
 * 참조 목록을 선택지로 옮긴다.
 *
 * **미사용 값을 빼지 않고 표식만 붙인다.** 참조를 `includeInactive=true`로 받는 이유는
 * 미사용 값을 참조하는 과거 발주의 이름을 풀기 위해서인데, 그 발주들을 **조건으로 찾으려면**
 * 선택지에도 있어야 한다.
 */
const toSelectOptions = (lookup: LookupResult): SelectOption[] =>
  lookup.entries.map((entry) => ({
    value: entry.value,
    label: entry.isActive ? entry.label : `${entry.label}${t.values.inactiveSuffix}`,
  }));

/**
 * W-01-03 컨테이너 — **자재창고 도메인의 첫 쓰기 화면**이다.
 *
 * 배치는 상하로 쌓는다 — 위: 조건 줄과 대상 발주 목록 / 아래: 고른 발주의 라인과 도착 수량 ·
 * 등록 정보 · 등록 결과. 조회 조건과 고른 발주는 전부 주소가 소유한다 —
 * 새로고침·뒤로가기·공유가 같은 결과를 낸다. **초안은 주소에 싣지 않는다.**
 *
 * **되돌릴 수 없는 쓰기다.** 계약의 입하 취소는 승인을 타므로(실측) 잘못 만들어진 전표를
 * 이 화면이 되돌릴 수 없다. 그래서 보내기 전에 세 겹으로 막는다 —
 * ① 갈래별 활성 조건(계약의 조건부 필수) ② 머리 입력 검증 ③ 고치지 않은 수량.
 *
 * **보내는 중에는 화면 전체를 잠근다**(계획 결정 13). 등록 세 갈래와 취소·입력칸뿐 아니라
 * **대상을 바꾸는 길**(목록의 선택·해제 · 조건 조회·초기화 · 쪽 이동)도 함께 닫는다 —
 * 열어 두면 사용자가 초안을 버리고 다른 발주로 옮긴 뒤 **앞 발주의 등록 결과가 지금 보는
 * 발주의 맥락에 나타난다.** 중복 전송이 생기지는 않지만 「무엇이 어느 발주에 등록됐는가」가
 * 화면에서 흐려지고, 그것이 이 화면에서 가장 비싼 혼선이다. 전송은 짧다.
 */
export const OverReceiptSplitScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * **무엇이 바뀔 때 무엇을 비우는가 — 수명 표.**
   *
   * 「비운다」와 「비우지 않는다」를 이 표 한 곳에 모은다. 규칙이 흩어지면 한쪽만 고쳐져
   * 비대칭이 생긴다(조건을 바꾸면 아래 구획이 닫히는데 쪽을 옮기면 안 닫히는 식).
   *
   * 이 화면은 **입력 형**이라 표에 초안 열이 하나 더 있다. 조회 화면에서는 「무엇이 보이는가」만
   * 달라지지만, 여기서는 사용자가 친 값이 사라지는 것으로 나타난다.
   *
   * | # | 조작 | 조건 | `page` | `po` | 초안 | 결과 구획 |
   * | :-: | --- | :-: | :-: | :-: | :-: | :-: |
   * | 1 | 조건 변경·조회 | 바뀐다 | **첫 쪽** | **비운다** | **비운다** | 비운다 |
   * | 2 | 초기화 | **기본으로** | 첫 쪽 | 비운다 | 비운다 | 비운다 |
   * | 3 | 쪽 이동 | 유지 | 옮긴 쪽 | **비운다** | **비운다** | 비운다 |
   * | 4 | 발주 고르기·해제 | 유지 | **유지** | 넣고 뺀다 | **라인 응답으로 새로 만든다** | 비운다 |
   * | 5 | 결과에 고른 발주 없음 | 유지 | 유지 | **비운다** | 비운다 | 비운다 |
   * | 6 | **수량·머리 입력** | 유지 | 유지 | 유지 | 바뀐다 | **유지** |
   * | 7 | 목록·참조 응답 도착 | 유지 | 유지 | 유지 | **건드리지 않는다** | 유지 |
   * | 8 | **등록 성공** | 유지 | 유지 | **유지** | **비운다** | **채운다** |
   * | 9 | 등록 실패 | 유지 | 유지 | 유지 | **유지**(입력을 잃지 않는다) | 비운다 |
   * | 10 | 취소 | 유지 | 유지 | **비운다** | **비운다** | 비운다 |
   *
   * 열한째 조작이 생기면 표에 행을 먼저 더한다.
   *
   * **왜 이렇게 정했는가**
   *
   * - **1·3행이 초안을 비우는 이유**: 초안은 특정 발주의 라인에 묶여 있다. 대상이 바뀌면
   *   그 수량은 뜻을 잃는다. 다만 **비어 있지 않으면 확인을 받는다** — 친 값이 말없이
   *   사라지면 무엇을 잃었는지도 알 수 없다.
   * - **4행이 쪽을 유지하는 이유**: 보이는 행이 그대로다. 3쪽에서 하나 골랐다고 1쪽으로 튀면 안 된다.
   * - **6·7행이 이 화면의 #43 자리다**: 초안 되돌림은 **`po`와 라인 응답에만 반응하는 effect
   *   한 곳**이 한다. 목록 재조회·참조 도착·부모 리렌더에 반응하면 「치던 수량이 사라진다」가
   *   그대로 재현된다.
   * - **8행이 초안을 비우는 것을 라인 재조회에 얹지 않는 이유**: 같은 응답이 오면 캐시가 참조를
   *   그대로 유지해 되돌림 effect가 깨어나지 않는다. 그러면 등록에 성공했는데 수량이 그대로 남아
   *   **한 번 더 보낼 수 있는 상태**가 된다 — 이중 제출 완화의 한 층이라 확실히 비운다.
   * - **8행이 `po`를 유지하는 이유**: 등록 뒤 같은 발주의 누적 입하가 늘었다. 그 결과를 바로
   *   확인할 수 있어야 「제대로 들어갔나」를 화면에서 답할 수 있다.
   * - **9행이 아무것도 비우지 않는 이유**: 실패했는데 입력을 지우면 사용자가 처음부터 다시 친다.
   */
  /*
   * **주소가 바뀔 때만 새 참조를 만든다.** 렌더마다 새 객체를 만들면 내용이 같아도 참조가 달라,
   * 이 값을 되돌림 기준으로 삼는 조건 줄이 **부모가 다시 그려질 때마다** 입력을 덮어쓴다(#43).
   * `searchParams`는 주소가 바뀔 때만 새 참조다.
   */
  const filters = useMemo<PoFilters>(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const selectedPoId = readSelectedPoId(searchParams);

  /*
   * **조건이 하나도 없어도 조회한다.** 들어오자마자 「받을 것이 남은 발주」가 보여야
   * 무엇을 고를 수 있는지 안다 — 빈 화면으로 시작하면 조건을 먼저 정해야 하는 줄 안다.
   * 기본 조건(미완료만)은 `toFilterQuery`가 채운다.
   */
  const listQuery = { ...toFilterQuery(filters), ...(page > 1 ? { page } : {}) };

  const list = usePurchaseOrders(listQuery);
  const rows = list.data?.items ?? EMPTY_ROWS;
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  const suppliers = useSupplierOptions();
  const plants = usePlantOptions();
  const items = useItemOptions();
  /* 단위는 아래 구획만 쓴다 — 고르기 전에 부르면 첫 진입의 요청 수가 이유 없이 는다. */
  const uoms = useUomOptions(selectedPoId !== null);

  const lines = usePurchaseOrderLines(selectedPoId);

  /**
   * 라인별 도착 수량 초안. **주소에 싣지 않는다** — 글자마다 뒤로가기 기록이 쌓이고,
   * 화면이 조회 조건과 입력을 같은 통로로 다루게 된다.
   */
  const [drafts, setDrafts] = useState<LineDrafts>(EMPTY_DRAFTS);

  /*
   * **#43을 재생산하지 않는 자리다**(수명 표 6·7행).
   *
   * 의존성은 **고른 발주와 라인 응답 둘뿐이다.** 목록 재조회·참조 도착·부모 리렌더는
   * 이 effect를 깨우지 않는다 — 깨우면 사용자가 수량을 치는 도중에 값이 사라진다.
   *
   * `useMemo`로 만든 파생 객체(예: 아래 `splitLines`)를 의존성에 넣지 않는 것도 같은 이유다.
   * 파생값은 렌더마다 새 참조라 그것을 의존성으로 삼으면 매 렌더 초안이 되돌아간다.
   */
  const lineData = lines.data;

  useEffect(() => {
    setDrafts(createDrafts(lineData ?? EMPTY_LINES));
  }, [selectedPoId, lineData]);

  /**
   * 라인 바깥의 초안. **라인 응답에 반응하지 않는다** — 라인을 다시 부르는 것만으로
   * 치던 비고와 입하 일시가 사라지면 안 된다. 되돌아가는 신호는 **고른 발주가 바뀌는 것**뿐이다.
   */
  const [header, setHeader] = useState<HeaderDraft>(EMPTY_HEADER_DRAFT);

  /** 만들어진 전표. `null`이면 아직 등록하지 않았거나 마지막 시도가 실패했다 */
  const [created, setCreated] = useState<CreatedReceiptView[] | null>(null);

  /**
   * 보내기 전에 화면이 잡은 오류. **등록을 누른 뒤에만 세운다** —
   * 치는 도중에 붉은 글씨를 띄우면 아직 넣지도 않은 칸이 잘못된 것처럼 보인다.
   */
  const [localFieldErrors, setLocalFieldErrors] = useState<Record<string, string>>(
    NO_FIELD_ERRORS,
  );

  /** 고치지 않은 수량 때문에 막았다는 사실. 사용자가 고치면 조건이 풀려 저절로 사라진다 */
  const [isQtyBlockShown, setQtyBlockShown] = useState(false);

  /** 지금 보내는 갈래. 어느 버튼을 눌렀는지 그 버튼이 밝히는 데 쓴다 */
  const [savingMode, setSavingMode] = useState<SplitMode | null>(null);

  /** 확인을 기다리는 조작. `null`이면 확인 창이 없다 */
  const [pendingDiscard, setPendingDiscard] = useState<DiscardIntent | null>(null);

  /*
   * 대상이 바뀌면 머리 입력과 등록 결과를 함께 비운다(수명 표 1~5·10행).
   * **의존성은 고른 발주 하나뿐이다** — 라인 응답을 넣으면 다시 부를 때마다 입력이 사라진다.
   */
  useEffect(() => {
    setHeader(EMPTY_HEADER_DRAFT);
    setCreated(null);
    setLocalFieldErrors(NO_FIELD_ERRORS);
    setQtyBlockShown(false);
  }, [selectedPoId]);

  /**
   * 고른 발주. **목록 응답에서 찾는다** — 제목줄에 필요한 값이 그 행에 이미 들어 있어
   * 상세 경로를 부를 이유가 없다.
   */
  const selectedRow = rows.find((row) => row.purchaseOrderId === selectedPoId) ?? null;

  const register = useSplitRegister({
    purchaseOrderId: selectedPoId,
    onSuccess: (data) => {
      setCreated(data.created.map(toCreatedReceiptView));
      /*
       * **초안을 비운다**(수명 표 8행 · 이중 제출 완화의 한 층). 라인 재조회에 얹지 않는
       * 이유는 같은 응답이 오면 캐시가 참조를 그대로 유지해 되돌림 effect가 깨어나지 않기
       * 때문이다 — 그러면 등록에 성공했는데 수량이 남아 한 번 더 보낼 수 있다.
       */
      setDrafts(EMPTY_DRAFTS);
      setHeader(EMPTY_HEADER_DRAFT);
      setLocalFieldErrors(NO_FIELD_ERRORS);
      setQtyBlockShown(false);
    },
  });

  /** 버릴 것이 있는가. 라인 수량과 머리 입력을 **함께** 본다 — 한쪽만 보면 나머지가 말없이 사라진다. */
  const hasDraft = hasAnyQty(drafts) || hasAnyHeaderValue(header);

  /**
   * 조작을 실제로 수행한다. 셋 모두 **주소를 한 번만 갱신한다** —
   * 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 늘어 사용자가 뒤로 눌렀는데
   * 같은 자리로 돌아온 것처럼 보인다.
   *
   * `toSearchParams`가 `po`를 만들지 않으므로 조건·쪽이 바뀌면 고른 발주가 함께 풀리고,
   * 그 결과 초안 되돌림 effect가 초안을 비운다(수명 표 1~3행).
   */
  const runIntent = (intent: DiscardIntent): void => {
    switch (intent.kind) {
      case 'cancel':
        /* **서버를 부르지 않는다**(이슈 §6). 이 화면의 「취소」는 저장 전 복귀다. */
        setSearchParams(toSearchParams(filters, page));
        break;
      case 'select': {
        /* 고르고 푸는 것은 **보이는 행을 바꾸지 않는다**(수명 표 4행). */
        const next = toSearchParams(filters, page);

        if (intent.purchaseOrderId !== selectedPoId) {
          next.set('po', String(intent.purchaseOrderId));
        }

        setSearchParams(next);
        break;
      }
      case 'query':
        setSearchParams(toSearchParams(intent.filters, intent.page));
        break;
    }
  };

  /**
   * 초안을 버리게 되는 조작은 **버리기 전에 확인을 받는다**(계획 결정 10).
   *
   * 버릴 것이 없으면 곧바로 한다 — 아무것도 잃지 않는 조작에까지 확인을 받으면
   * 확인 창이 의미를 잃고 사용자가 읽지 않고 누르게 된다.
   */
  const requestIntent = (intent: DiscardIntent): void => {
    /*
     * **보내는 중에는 대상을 바꾸지 않는다.** 눈에 보이는 컨트롤은 전부 잠가 두었으나,
     * 조건 칩의 ×처럼 디자인 시스템이 잠금을 받지 않는 자리가 남는다 — 그 길로 들어와도
     * 앞 발주의 등록 결과가 다른 발주 맥락에 놓이지 않도록 여기서 한 번 더 막는다.
     */
    if (register.isSaving) return;

    if (hasDraft) {
      setPendingDiscard(intent);

      return;
    }

    runIntent(intent);
  };

  const applyQuery = (nextFilters: PoFilters, nextPage = 1): void => {
    requestIntent({ kind: 'query', filters: nextFilters, page: nextPage });
  };

  const toggleSelect = (purchaseOrderId: number): void => {
    requestIntent({ kind: 'select', purchaseOrderId });
  };

  /*
   * 갱신된 결과에 고른 발주가 없으면 `po`를 주소에서 뗀다(수명 표 5행).
   * 남겨 두면 아래 구획이 화면에 없는 발주를 가리킨 채 주소만 남는다.
   *
   * **정리를 클릭 핸들러가 아니라 고른 식별자에 묶는다.** 뒤로가기·앞으로가기·주소 직접 편집은
   * 핸들러를 거치지 않고 `po`만 바꾸므로, 핸들러에 두면 그 경로가 통째로 샌다.
   *
   * **받은 결과가 있을 때만 판정한다.** 조회를 기다리는 동안에는 행이 비어 있어,
   * 가드가 없으면 「고른 발주가 사라졌다」로 읽혀 아래 구획이 깜빡 닫힌다.
   *
   * replace로 바꿔 정리가 뒤로가기 기록을 늘리지 않게 한다.
   */
  useEffect(() => {
    if (selectedPoId === null) return;
    if (list.data === undefined) return;
    if (list.data.items.some((row) => row.purchaseOrderId === selectedPoId)) return;

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('po');

        return next;
      },
      { replace: true },
    );
  }, [selectedPoId, list.data, setSearchParams]);

  /**
   * **읽는 자리에서 파생한다.** 잔량·정량 한도·정량/초과는 `split-calc.ts`가 한 번만 만들고
   * 표는 그 결과를 그리기만 한다 — **요청 조립도 같은 결과를 받는다.**
   * 두 곳에서 다시 계산하면 보이는 값과 보내는 값이 갈리고, 되돌릴 수 없는 쓰기라 그
   * 어긋남은 잘못된 전표로 남는다.
   */
  const splitLines = toSplitLines(lineData ?? EMPTY_LINES, drafts);

  /*
   * 수량 입력은 **주소를 바꾸지 않는다**(수명 표 6행). 주소에 실으면 글자마다 뒤로가기 기록이 쌓인다.
   */
  const changeQty = (purchaseOrderLineId: number, text: string): void => {
    setDrafts((prev) => setDraftQty(prev, purchaseOrderLineId, text));
  };

  /** 실제로 요청에 실릴 라인 수. **세는 자리와 보내는 자리가 같다** — 갈리면 빈 part가 나간다. */
  const parts = toSplitParts(splitLines);
  const counts = { normalLines: parts.normal.length, excessLines: parts.excess.length };

  /* 사용자가 고치면 조건이 풀려 안내가 저절로 사라진다 — 지워 주는 절차를 따로 두지 않는다. */
  const qtyBlockReason = isQtyBlockShown ? qtyErrorReason(splitLines) : null;

  /**
   * 보낸다. **보내기 전에 두 겹을 더 본다** — 갈래별 활성 조건은 버튼이 이미 막았고,
   * 여기서는 머리 입력과 고치지 않은 수량을 본다.
   *
   * 막히면 **요청을 만들지 않는다.** 되돌릴 수 없는 쓰기라 「보내 보고 서버가 막아 주기」를
   * 기대할 수 없고, 목 서버는 어긋난 요청을 201로 통과시킨다(실측).
   */
  const submit = (purchaseOrder: PoView, mode: SplitMode): void => {
    const headerErrors = validateHeader(header);
    const qtyBlocked = qtyErrorReason(splitLines) !== null;

    setLocalFieldErrors(headerErrors);
    setQtyBlockShown(qtyBlocked);

    if (Object.keys(headerErrors).length > 0 || qtyBlocked) return;

    /* 실패하면 결과 구획이 비어 있어야 한다(수명 표 9행) — 앞 성공의 번호가 남으면 오해한다. */
    setCreated(null);
    setSavingMode(mode);

    register.write(
      toSplitRequest(mode, {
        purchaseOrder,
        rows: splitLines,
        header,
        /* 발생 시각은 **제출 순간**이다. 순수 함수에 넘겨 그 사실이 인자로 드러나게 한다. */
        now: new Date(),
      }),
    );
  };

  /**
   * 머리 입력을 고치면 그 칸의 옛 오류를 지운다 — 남아 있으면 무엇을 고쳐야 하는지 알 수 없다.
   * 서버가 준 오류와 화면이 잡은 오류를 **함께** 지운다(저장소 전례).
   */
  const changeHeader = (patch: Partial<HeaderDraft>): void => {
    setHeader((prev) => ({ ...prev, ...patch }));

    for (const field of Object.keys(patch)) {
      register.clearFieldError(field);
      setLocalFieldErrors((prev) => {
        if (!(field in prev)) return prev;

        const next = { ...prev };
        delete next[field];

        return next;
      });
    }
  };

  const fieldErrors = { ...register.fieldErrors, ...localFieldErrors };

  const supplierReference = toReference(
    suppliers,
    filters.supplier === '' ? null : Number(filters.supplier),
  );

  /**
   * 참조 실패의 복구 경로 — **이름이 보이는 자리마다 하나씩** 둔다(계획 결정 15).
   * 안내 문구가 적은 대상과 다시 부르는 대상이 어긋나면, 눌러도 한쪽은 실패인 채로 남는데
   * 문구는 둘 다 고쳐질 것처럼 말한다.
   */
  const retryTopReferences = (): void => {
    suppliers.refetch();
  };

  const retryLineReferences = (): void => {
    items.refetch();
    uoms.refetch();
    plants.refetch();
  };

  /** 아래 구획. 넷 중 하나만 낸다 — 사용자가 할 조치가 서로 다르다. */
  const linePane = (): ReactNode => {
    if (selectedPoId === null) {
      return (
        <EmptyState
          size="sm"
          title={t.empty.noSelectionTitle}
          description={t.empty.noSelectionDescription}
        />
      );
    }

    /*
     * 고른 번호는 있는데 그 행이 없다. 두 갈래이고 **사용자가 할 조치가 다르다.**
     *
     * **잣대는 「목록 조회가 성립했는가」다**(W-01-07이 세운 형태). 목록이 실패하면 행 목록이
     * 빈 채로 남고 정리 effect도 결과를 못 받아 물러나므로, 여기서 골격을 내면 **기다리라고
     * 말하는데 기다려서 풀리지 않는다.** 라인 조회는 실제로 나가는데 그 실패까지 로딩이 덮는다 —
     * 이 슬라이스가 `load-error-banner.tsx`에 적은 「실패를 빈 상태로 보이지 않는다」와 어긋난다.
     *
     * 라인 값을 받아도 구획을 열 수 없다 — **제목줄이 쓰는 발주의 값이 목록 응답에만 있다.**
     * 그래서 라인 실패 갈래로 넘기지 않고 목록을 되살리라고 말한다(복구 수단은 위 배너에 있다).
     */
    if (selectedRow === null) {
      if (list.isError) {
        return (
          <EmptyState
            size="sm"
            live
            title={t.empty.listFailedTitle}
            description={t.empty.listFailedDescription}
          />
        );
      }

      /* 목록을 기다리는 중이다. 정리 effect가 결과를 보고 판정할 때까지 되돌리지 않는다. */
      return (
        <div role="status" aria-label={t.loading.lines}>
          <SkeletonText lines={2} />
        </div>
      );
    }

    if (lines.isError) {
      return (
        <LoadErrorBanner
          error={lines.error}
          onRetry={() => {
            void lines.refetch();
          }}
        />
      );
    }

    return (
      <SplitLineTable
        purchaseOrder={selectedRow}
        supplierName={describeReference(toReference(suppliers, selectedRow.supplierId))}
        rows={splitLines}
        isLoading={lines.isPending}
        /*
         * 공장은 **이름이 아니라 참조 자체**를 넘긴다 — 이 구획이 실패 안내와 다시 시도를
         * 소유하므로 실패 여부를 함께 알아야 한다. 공급사는 위 구획이 소유해 이름만 넘긴다.
         */
        plantLookup={plants}
        itemLookup={items}
        uomLookup={uoms}
        onChangeQty={changeQty}
        onRetryReferences={retryLineReferences}
      />
    );
  };

  /**
   * 등록 구획. **라인 표가 실제로 그려질 때만 낸다** — 라인을 못 받았는데 등록 폼을 열면
   * 무엇을 등록하는지 없는 채로 입력만 받게 된다.
   *
   * 고른 발주를 **인자로 받는다** — 여기까지 왔다는 것이 곧 대상이 있다는 뜻이라,
   * 안쪽에서 다시 `null` 가지를 만들지 않는다.
   */
  const registerPane = (purchaseOrder: PoView): ReactNode => (
    <>
      <ReceiptHeaderForm
        values={header}
        fieldErrors={fieldErrors}
        isSaving={register.isSaving}
        onChange={changeHeader}
      />

      <ExcessForm
        values={header}
        fieldErrors={fieldErrors}
        isSaving={register.isSaving}
        onChange={changeHeader}
      />

      {/*
       * 저장 실패는 **세 갈래**다(계획 결정 9). 배너가 검증 실패(400)·권한 없음(403)·
       * 응답 없음(네트워크)의 문구를 갈라 낸다. 충돌(409)은 이 오퍼레이션에 없다.
       */}
      <SaveErrorBanner error={register.error} />

      {/*
       * **응답을 받지 못한 실패에만 한 줄을 더한다.** 공통 문구는 「다시 시도하세요」로 끝나는데,
       * 이 화면에서 확인 없이 다시 보내면 같은 입하가 전표 두 벌로 남는다 —
       * 공통 쓰기 훅이 호출마다 새 멱등 키를 만들어 서버가 재전송으로 보지 못한다.
       */}
      {register.error?.kind === 'network' && (
        <p className="field-error">{t.notes.registerRecheck}</p>
      )}

      {qtyBlockReason !== null && <p className="field-error">{qtyBlockReason}</p>}

      <ModeActions
        blockReasons={{
          BOTH: modeBlockReason('BOTH', counts),
          NORMAL_ONLY: modeBlockReason('NORMAL_ONLY', counts),
          EXCESS_ONLY: modeBlockReason('EXCESS_ONLY', counts),
        }}
        isSaving={register.isSaving}
        savingMode={register.isSaving ? savingMode : null}
        onSubmit={(mode) => {
          submit(purchaseOrder, mode);
        }}
        onCancel={() => {
          requestIntent({ kind: 'cancel' });
        }}
      />
    </>
  );

  /*
   * 등록 구획을 열 대상. **라인 표가 그려지는 조건과 같다** —
   * 조건이 갈리면 표는 없는데 폼만 있는 상태가 생긴다.
   */
  const registerTarget =
    selectedRow !== null && !lines.isError && !lines.isPending ? selectedRow : null;

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
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
        <PoFilterBar
          appliedFilters={filters}
          supplierOptions={toSelectOptions(suppliers)}
          chipNames={{ supplier: describeReference(supplierReference) }}
          supplierNote={lookupNote(suppliers)}
          isLocked={register.isSaving}
          onSearch={(nextFilters) => {
            applyQuery(nextFilters);
          }}
          onRemoveFilter={(key) => {
            applyQuery({ ...filters, [key]: '' });
          }}
          onReset={() => {
            applyQuery(DEFAULT_FILTERS);
          }}
        />

        {!list.isError && (
          <>
            <PoTable
              rows={rows}
              isLoading={list.isPending}
              isBeyondLast={pageView.isBeyondLast}
              selectedPoId={selectedPoId}
              supplierLookup={suppliers}
              isLocked={register.isSaving}
              onFirstPage={() => {
                applyQuery(filters);
              }}
              onToggleSelect={toggleSelect}
              onRetryReferences={retryTopReferences}
            />
            {!list.isPending && (
              <PageNav
                view={pageView}
                isLocked={register.isSaving}
                onChange={(nextPage) => {
                  applyQuery(filters, nextPage);
                }}
              />
            )}
          </>
        )}
      </section>

      <section className="pane" aria-label={t.panes.lines}>
        {linePane()}
      </section>

      {registerTarget !== null && (
        <section className="pane" aria-label={t.panes.register}>
          {registerPane(registerTarget)}
        </section>
      )}

      {/*
       * 결과는 **따로 선 구획**이다. 등록 폼 안에 두면 다음 등록을 준비하는 입력과
       * 방금 만들어진 번호가 섞인다. 이름은 부품이 `role="status"`로 갖는다.
       */}
      {created !== null && (
        <section className="pane">
          <CreatedReceiptsPane receipts={created} />
        </section>
      )}

      {pendingDiscard !== null && (
        <DiscardConfirmDialog
          onConfirm={() => {
            runIntent(pendingDiscard);
            setPendingDiscard(null);
          }}
          onClose={() => {
            setPendingDiscard(null);
          }}
        />
      )}
    </>
  );
};
