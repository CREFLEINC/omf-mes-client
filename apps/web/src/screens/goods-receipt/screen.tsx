import { Breadcrumb, Button, EmptyState, PageHeader, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { SaveErrorBanner } from '../../patterns/master';
import { CodeFields } from './code-fields';
import {
  isRequiredCodeListPending,
  PLACEHOLDER_GOODS_RECEIPT_CODES,
  toCodeOptionSets,
} from './code-options';
import { DiscardConfirmDialog } from './discard-confirm-dialog';
import {
  clearFilter,
  DEFAULT_FILTERS,
  readFilters,
  readPage,
  readSelectedIrId,
  readSelectedLineId,
  SELECTION_KEYS,
  toFilterQuery,
  toSearchParams,
  type ChipFilterKey,
  type IrFilters,
} from './filters';
import { toGoodsReceiptRequest, toReceiptLines } from './gr-request';
import { IrFilterBar } from './ir-filter-bar';
import { IrLineTable } from './ir-line-table';
import { IrTable } from './ir-table';
import { findSelectedLine, nextSelectedLineId } from './line-select';
import { LoadErrorBanner } from './load-error-banner';
import {
  describeReference,
  lookupNote,
  toReference,
  useItemOptions,
  useLotOptions,
  usePlantOptions,
  useSupplierOptions,
  useUomOptions,
  type LookupResult,
} from './lookups';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import {
  useGoodsReceiptPost,
  useInboundReceiptLines,
  useInboundReceipts,
  useLocationOptions,
  useLotStatus,
  useWarehouseOptions,
} from './queries';
import { ReceiptHeaderForm } from './receipt-header-form';
import { ResultPane, type LotStatusState } from './result-pane';
import { SubmitConfirmDialog } from './submit-confirm-dialog';
import {
  EMPTY_RECEIPT_DRAFT,
  formatDateTime,
  hasAnyDraftValue,
  toGoodsReceiptResultView,
  type GoodsReceiptCodeKey,
  type GoodsReceiptResultView,
  type IrLineView,
  type IrView,
  type ReceiptDraft,
  type SelectOption,
} from './types';
import { CODE_FIELD_NAMES, postBlockReason, validateDraft } from './validation';
import { WarehouseLocationFields } from './warehouse-location-fields';

const t = messages.goodsReceipt;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: IrView[] = [];
const EMPTY_LINES: IrLineView[] = [];
const NO_FIELD_ERRORS: Record<string, string> = {};

/**
 * 초안을 버리게 되는 조작. **버리기 전에 확인을 받으려면 「무엇을 하려 했는지」를 붙들어야 한다.**
 *
 * 넷 모두 초안이 뜻을 잃는 자리다(수명 표 1~5·12행) — 대상이 바뀌거나 사라지므로
 * 고른 줄에 묶인 창고·위치·코드가 가리킬 곳이 없어진다.
 */
type DiscardIntent =
  | { kind: 'cancel' }
  | { kind: 'selectIr'; inboundReceiptId: number }
  | { kind: 'selectLine'; inboundReceiptLineId: number }
  | { kind: 'query'; filters: IrFilters; page: number };

/**
 * 참조 목록을 선택지로 옮긴다.
 *
 * **미사용 값을 빼지 않고 표식만 붙인다.** 참조를 `includeInactive=true`로 받는 이유는
 * 미사용 값을 참조하는 과거 입하의 이름을 풀기 위해서인데, 그 입하들을 **조건으로 찾으려면**
 * 선택지에도 있어야 한다.
 */
const toSelectOptions = (lookup: LookupResult): SelectOption[] =>
  lookup.entries.map((entry) => ({
    value: entry.value,
    label: entry.isActive ? entry.label : `${entry.label}${t.values.inactiveSuffix}`,
  }));

/**
 * W-01-10 컨테이너 — **한 번의 확정으로 다섯 가지가 함께 움직이는 화면**이다.
 *
 * 배치는 상하로 쌓는다 — 위: 조건 줄과 대상 입하 전표 목록 / 아래: 고른 전표의 제목줄·라인 표·
 * 고른 줄의 확정 입력·액션·결과. 조회 조건과 고른 전표·라인은 전부 주소가 소유한다 —
 * 새로고침·뒤로가기·공유가 같은 결과를 낸다. **초안은 주소에 싣지 않는다.**
 *
 * **되돌릴 수 없는 쓰기다.** 계약의 입고 취소는 승인을 타므로(실측) 잘못 만들어진 전표를
 * 이 화면이 되돌릴 수 없다. 그래서 보내기 전에 세 겹으로 막는다 —
 * ① 활성 조건과 사유(`postBlockReason`) ② 길이 검증(`validateDraft`) ③ **제출 확인 창.**
 *
 * **보내는 중에는 화면 전체를 잠근다.** 확정 입력·버튼·취소뿐 아니라 **대상을 바꾸는 길**
 * (목록의 선택·해제 · 조건 조회·초기화 · 쪽 이동 · 라인 선택)도 함께 닫는다 — 열어 두면
 * 사용자가 다른 전표로 옮긴 뒤 **앞 전표의 처리 결과가 지금 보는 전표의 맥락에 나타난다.**
 *
 * **한 번의 확정으로 함께 움직이는 다섯 가지**(계획 결정 13) — ①~④는 한 트랜잭션이라
 * 부분 실패가 없고, ⑤(ERP 송신 **적재**)만 트랜잭션 밖이라 세 갈래로 갈린다.
 *
 * | 무엇 | 트랜잭션 | 응답이 주는 증거 | 화면이 하는 것 |
 * | :-: | :-: | --- | --- |
 * | ① 입고 전표 생성·전기 | 안 | 입고번호 · 상태 코드 | 그대로 낸다(값으로 분기하지 않는다) |
 * | ② 자재 LOT 상태 전이 | 안 | **없다** | 성공 뒤 그 LOT을 **다시 조회해** 상태를 그대로 낸다 |
 * | ③ 수불 원장 | 안 | 원장 라인 번호(nullable) | **유무만** 낸다. 번호는 내지 않는다 |
 * | ④ 잔액 | 안 | 없다 | **확인하지 않는다**는 사실을 결과 구획이 밝힌다 |
 * | ⑤ ERP 송신 적재 | **밖** | `erpMessageQueued`(선택 필드) | **세 갈래.** 「적재」는 「전송」이 아니다 |
 *
 * **참조 → 보이는 자리 → 복구 표**(계획 결정 17)는 `lookups.ts`의 머리에 있다.
 */
export const GoodsReceiptScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const blockReasonId = `${useId()}-post-reason`;

  /**
   * **무엇이 바뀔 때 무엇을 비우는가 — 수명 표**(계획 결정 6).
   *
   * 「비운다」와 「비우지 않는다」를 이 표 한 곳에 모은다. 규칙이 흩어지면 한쪽만 고쳐져
   * 비대칭이 생긴다(조건을 바꾸면 아래 구획이 닫히는데 쪽을 옮기면 안 닫히는 식).
   *
   * | # | 조작 | 조건 5종 | `page` | `ir` | `line` | 초안 | 결과 구획 | **열린 창** |
   * | :-: | --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
   * | 1 | 조건 변경·조회 | 바뀐다 | **첫 쪽** | **비운다** | **비운다** | **비운다** | 비운다 | **닫는다** |
   * | 2 | 초기화 | **비운다** | 첫 쪽 | 비운다 | 비운다 | 비운다 | 비운다 | **닫는다** |
   * | 3 | 쪽 이동 | 유지 | 옮긴 쪽 | **비운다** | **비운다** | **비운다** | 비운다 | **닫는다** |
   * | 4 | 전표 고르기·해제 | 유지 | **유지** | 넣고 뺀다 | **비운다** | **비운다** | 비운다 | **닫는다** |
   * | 5 | 라인 고르기·해제 | 유지 | 유지 | 유지 | 넣고 뺀다 | **비운다** | 비운다 | **닫는다** |
   * | 6 | 결과에 고른 전표·라인 없음 | 유지 | 유지 | **비운다** | **비운다** | 비운다 | 비운다 | **닫는다** |
   * | 7 | **확정 입력**(창고·위치·코드·일시·비고) | 유지 | 유지 | 유지 | 유지 | 바뀐다 | **유지** | 유지 |
   * | 8 | **창고 바꾸기** | 유지 | 유지 | 유지 | 유지 | **위치만 비운다** | 유지 | 유지 |
   * | 9 | 목록·참조·라인 응답 도착 | 유지 | 유지 | 유지 | 유지 | **건드리지 않는다** | 유지 | 유지 |
   * | 10 | **입고 처리 성공** | 유지 | 유지 | **유지** | **유지** | **비운다** | **채운다** | 닫혀 있다 |
   * | 11 | 입고 처리 실패 | 유지 | 유지 | 유지 | 유지 | **유지**(입력을 잃지 않는다) | 비운다 | 닫혀 있다 |
   * | 12 | 취소 | 유지 | 유지 | 유지 | **비운다** | **비운다** | 비운다 | **닫는다** |
   *
   * 열세째 조작이 생기면 표에 행을 먼저 더한다. **열이 생겨도 마찬가지다** —
   * 표에 오르지 않은 상태는 규칙이 닿지 않는 사각이 된다.
   *
   * **왜 이렇게 정했는가**
   *
   * - **1·3·4·5행이 초안을 비우는 이유**: 초안의 위치·코드 맥락은 고른 라인에 묶여 있다.
   *   대상이 바뀌면 뜻을 잃는다. 다만 **초안이 비어 있지 않으면 확인을 받는다** — 친 값이
   *   말없이 사라지면 무엇을 잃었는지도 알 수 없다.
   * - **4행이 쪽을 유지하는 이유**: 보이는 행이 그대로다. 3쪽에서 하나 골랐다고 1쪽으로 튀면 안 된다.
   * - **6행이 클릭 핸들러가 아니라 고른 식별자에 묶이는 이유**: 뒤로가기·앞으로가기·주소 직접
   *   편집은 핸들러를 거치지 않고 `ir`·`line`만 바꾸므로, 핸들러에 두면 그 경로가 통째로 샌다.
   * - **8행이 이 화면에만 있는 행이다**: 위치는 창고에 속한다. 창고를 바꾸면 앞서 고른 위치는
   *   **다른 창고의 자리**라 그대로 보내면 잘못된 곳으로 적치된다. 코드·일시·비고는 창고와
   *   무관하므로 남긴다.
   * - **7·9행이 이 화면의 #43 자리다**: 초안 되돌림은 **`line`과 라인 응답 두 개에만 반응하는
   *   effect 한 곳**이 한다. 목록 재조회·참조 도착·부모 리렌더에 반응하면 코드를 치던 중에
   *   값이 사라진다.
   * - **10행이 초안을 비우는 것을 라인 재조회에 얹지 않는 이유**: 같은 응답이 오면 캐시가
   *   참조를 그대로 유지해 되돌림 effect가 깨어나지 않는다. 그러면 처리에 성공했는데 입력이
   *   남아 **한 번 더 보낼 수 있는 상태**가 된다 — 중복 전송 완화의 한 층이라 확실히 비운다.
   * - **10행이 `ir`·`line`을 유지하는 이유**: 방금 무엇을 입고했는지 화면에 남아 있어야
   *   결과를 읽을 수 있다. 결과 구획의 원천 문서 번호도 그 값에서 나온다.
   * - **11행이 아무것도 비우지 않는 이유**: 실패했는데 입력을 지우면 처음부터 다시 친다.
   */
  /*
   * **주소가 바뀔 때만 새 참조를 만든다.** 렌더마다 새 객체를 만들면 내용이 같아도 참조가 달라,
   * 이 값을 되돌림 기준으로 삼는 조건 줄이 **부모가 다시 그려질 때마다** 입력을 덮어쓴다(#43).
   * `searchParams`는 주소가 바뀔 때만 새 참조다.
   */
  const filters = useMemo<IrFilters>(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const selectedIrId = readSelectedIrId(searchParams);
  const selectedLineId = readSelectedLineId(searchParams);

  /*
   * **조건이 하나도 없어도 조회한다.** 들어오자마자 받아들일 수 있는 입하가 보여야
   * 무엇을 고를 수 있는지 안다 — 빈 화면으로 시작하면 조건을 먼저 정해야 하는 줄 안다.
   *
   * **기본 기간을 심지 않는다** — 첫 요청에 날짜 조건이 실리지 않는다(계획 결정 6).
   */
  const listQuery = { ...toFilterQuery(filters), ...(page > 1 ? { page } : {}) };

  const list = useInboundReceipts(listQuery);
  const rows = list.data?.items ?? EMPTY_ROWS;
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  const suppliers = useSupplierOptions();
  /* 공장만 미리 받는다 — 제목줄은 목록 응답만으로 곧바로 그려진다(`lookups.ts`의 표). */
  const plants = usePlantOptions();

  const lines = useInboundReceiptLines(selectedIrId);
  const lineData = lines.data;
  const lineRows = lineData ?? EMPTY_LINES;

  /*
   * 품목·단위·자재 LOT은 **라인 표가 그려질 때** 쓴다 — 그 표는 라인 응답을 기다리므로
   * 미리 받아 둘 이득이 없고, 고르기 전에 부르면 첫 진입의 요청 수만 이유 없이 는다.
   */
  const items = useItemOptions(selectedIrId !== null);
  const uoms = useUomOptions(selectedIrId !== null);

  /*
   * 자재 LOT은 **라인이 가리키는 품목마다** 받는다 — 번호 여러 개로 한 번에 조회하는 수단이
   * 계약에 없다. 라인이 오기 전에는 품목이 없어 요청도 없다.
   */
  const lots = useLotOptions(
    lineRows.map((line) => line.itemId),
    selectedIrId !== null,
  );

  /**
   * 고른 입하 전표. **목록 응답에서 찾는다** — 제목줄에 필요한 값이 그 행에 이미 들어 있어
   * 상세 경로를 부를 이유가 없다.
   */
  const selectedRow = rows.find((row) => row.inboundReceiptId === selectedIrId) ?? null;

  /**
   * 고른 라인. **판정은 `line-select.ts` 한 곳이 한다** — 표에는 고를 수 있다고 나오는데
   * 여기서는 아니거나 그 반대인 어긋남을 만들지 않는다.
   */
  const selectedLine = findSelectedLine(lineRows, selectedLineId);

  /**
   * 확정 입력. **주소에 싣지 않는다** — 글자마다 뒤로가기 기록이 쌓이고, 화면이 조회 조건과
   * 입력을 같은 통로로 다루게 된다.
   */
  const [draft, setDraft] = useState<ReceiptDraft>(EMPTY_RECEIPT_DRAFT);

  /** 만들어진 입고 전표. `null`이면 아직 처리하지 않았거나 마지막 시도가 실패했다 */
  const [result, setResult] = useState<GoodsReceiptResultView | null>(null);

  /**
   * 보내기 전에 화면이 잡은 오류. **입고 처리를 누른 뒤에만 세운다** —
   * 치는 도중에 붉은 글씨를 띄우면 아직 넣지도 않은 칸이 잘못된 것처럼 보인다.
   */
  const [localFieldErrors, setLocalFieldErrors] = useState<Record<string, string>>(NO_FIELD_ERRORS);

  /** 확인을 기다리는 조작. `null`이면 파기 확인 창이 없다 */
  const [pendingDiscard, setPendingDiscard] = useState<DiscardIntent | null>(null);

  /** 제출 확인 창이 열려 있는가. **확인하기 전에는 요청이 나가지 않는다** */
  const [isConfirmOpen, setConfirmOpen] = useState(false);

  /*
   * **#43을 재생산하지 않는 자리다**(수명 표 7·9행).
   *
   * 의존성은 **고른 줄과 라인 응답 둘뿐이다.** 목록 재조회·참조 도착·부모 리렌더는 이 effect를
   * 깨우지 않는다 — 깨우면 사용자가 코드를 고르는 도중에 값이 사라진다.
   *
   * `useMemo`로 만든 파생 객체를 의존성에 넣지 않는 것도 같은 이유다. 파생값은 렌더마다
   * 새 참조라 그것을 의존성으로 삼으면 매 렌더 초안이 되돌아간다.
   */
  useEffect(() => {
    setDraft(EMPTY_RECEIPT_DRAFT);
  }, [selectedLineId, lineData]);

  /*
   * 대상이 바뀌면 결과·오류와 **열린 창**을 함께 비운다(수명 표 1~6·12행).
   *
   * **창이 여기 있어야 하는 이유**: 확인 창은 「지금 고른 줄을 이 값으로 보낸다」는 확인이다.
   * 대상이 바뀌면 그 확인은 뜻을 잃는데, 열린 채로 두면 **사용자가 확인한 줄과 실제로 나가는
   * 줄이 갈린다** — 초안까지 함께 비워지므로 빈 코드·번호 0으로 되돌릴 수 없는 전표가 나간다.
   * 이 길은 클릭 핸들러의 잠금·가드가 닿지 않는다(뒤로가기·앞으로가기·주소 직접 편집).
   *
   * 파기 확인 창도 같이 닫는다 — 낡은 의도가 남으면 방금 바뀐 대상에 그 의도가 실행된다.
   *
   * **라인 응답을 의존성에 넣지 않는다** — 성공 뒤 라인을 다시 부르는데, 넣으면 그 응답이
   * 도착하는 순간 방금 만들어진 결과가 사라진다.
   */
  useEffect(() => {
    setResult(null);
    setLocalFieldErrors(NO_FIELD_ERRORS);
    setConfirmOpen(false);
    setPendingDiscard(null);
  }, [selectedIrId, selectedLineId]);

  const warehouses = useWarehouseOptions(selectedIrId !== null);
  const selectedWarehouseId = draft.warehouse === '' ? null : Number(draft.warehouse);
  const locations = useLocationOptions(selectedWarehouseId);

  /*
   * 입고 처리에 **성공한 뒤에만** 자재 LOT을 다시 읽는다 — 응답에 LOT 상태가 없어(실측)
   * 화면 이름의 「Release」를 값으로 확인할 방법이 이것뿐이다.
   */
  const recheckLotId = result === null ? null : (selectedLine?.lotId ?? null);
  const lotStatus = useLotStatus(recheckLotId);

  const post = useGoodsReceiptPost({
    inboundReceiptId: selectedIrId,
    onSuccess: (data) => {
      setResult(toGoodsReceiptResultView(data.goodsReceipt, data.lines));
      /*
       * **초안을 비운다**(수명 표 10행 · 중복 전송 완화의 한 층). 라인 재조회에 얹지 않는
       * 이유는 같은 응답이 오면 캐시가 참조를 그대로 유지해 되돌림 effect가 깨어나지 않기
       * 때문이다 — 그러면 처리에 성공했는데 입력이 남아 한 번 더 보낼 수 있다.
       */
      setDraft(EMPTY_RECEIPT_DRAFT);
      setLocalFieldErrors(NO_FIELD_ERRORS);
    },
  });

  const isLocked = post.isSaving;

  /** 버릴 것이 있는가. **모든 칸을 함께 본다** — 한쪽만 보면 나머지가 확인 없이 사라진다. */
  const hasDraft = hasAnyDraftValue(draft);

  /**
   * 조작을 실제로 수행한다. **주소를 한 번만 갱신한다** — 조건과 쪽을 따로 갱신하면
   * 뒤로가기 기록이 두 칸 늘어 사용자가 뒤로 눌렀는데 같은 자리로 돌아온 것처럼 보인다.
   *
   * `toSearchParams`가 `ir`·`line`을 만들지 않으므로 조건·쪽이 바뀌면 고른 전표와 라인이
   * 함께 풀리고, 그 결과 초안 되돌림 effect가 초안을 비운다(수명 표 1~3행).
   */
  const runIntent = (intent: DiscardIntent): void => {
    /* 대상을 버릴 때는 앞 시도의 실패 배너도 함께 거둔다 — 다른 대상의 오류가 남으면 오해한다. */
    post.reset();

    switch (intent.kind) {
      case 'cancel': {
        /* **서버를 부르지 않는다.** 이 화면의 「취소」는 보내기 전 복귀다(수명 표 12행). */
        const next = new URLSearchParams(searchParams);
        next.delete(SELECTION_KEYS.line);

        setSearchParams(next);
        break;
      }
      case 'selectIr': {
        /* 고르고 푸는 것은 **보이는 행을 바꾸지 않는다**(수명 표 4행). */
        const next = toSearchParams(filters, page);

        if (intent.inboundReceiptId !== selectedIrId) {
          next.set(SELECTION_KEYS.inboundReceipt, String(intent.inboundReceiptId));
        }

        setSearchParams(next);
        break;
      }
      case 'selectLine': {
        /* **지금 주소에서 시작한다** — 조건·쪽·고른 전표를 그대로 두고 `line`만 바꾼다. */
        const nextLineId = nextSelectedLineId(selectedLineId, intent.inboundReceiptLineId);
        const next = new URLSearchParams(searchParams);

        if (nextLineId === null) next.delete(SELECTION_KEYS.line);
        else next.set(SELECTION_KEYS.line, String(nextLineId));

        setSearchParams(next);
        break;
      }
      case 'query':
        setSearchParams(toSearchParams(intent.filters, intent.page));
        break;
    }
  };

  /**
   * 초안을 버리게 되는 조작은 **버리기 전에 확인을 받는다**(계획 결정 15).
   *
   * 버릴 것이 없으면 곧바로 한다 — 아무것도 잃지 않는 조작에까지 확인을 받으면 확인 창이
   * 의미를 잃고 사용자가 읽지 않고 누르게 된다.
   */
  const requestIntent = (intent: DiscardIntent): void => {
    /*
     * **보내는 중에는 대상을 바꾸지 않는다.** 눈에 보이는 컨트롤은 전부 잠가 두었으나,
     * 조건 칩의 ×처럼 디자인 시스템이 잠금을 받지 않는 자리가 남는다 — 그 길로 들어와도
     * 앞 전표의 처리 결과가 다른 전표 맥락에 놓이지 않도록 여기서 한 번 더 막는다.
     */
    if (isLocked) return;

    if (hasDraft) {
      setPendingDiscard(intent);

      return;
    }

    runIntent(intent);
  };

  const applyQuery = (nextFilters: IrFilters, nextPage = 1): void => {
    requestIntent({ kind: 'query', filters: nextFilters, page: nextPage });
  };

  const toggleSelectIr = (inboundReceiptId: number): void => {
    requestIntent({ kind: 'selectIr', inboundReceiptId });
  };

  const toggleSelectLine = (inboundReceiptLineId: number): void => {
    requestIntent({ kind: 'selectLine', inboundReceiptLineId });
  };

  /*
   * 갱신된 결과에 고른 전표가 없으면 `ir`과 `line`을 주소에서 함께 뗀다(수명 표 6행).
   * 남겨 두면 아래 구획이 화면에 없는 전표를 가리킨 채 주소만 남는다.
   *
   * **정리를 클릭 핸들러가 아니라 고른 식별자에 묶는다.** 뒤로가기·앞으로가기·주소 직접 편집은
   * 핸들러를 거치지 않고 `ir`만 바꾸므로, 핸들러에 두면 그 경로가 통째로 샌다.
   *
   * **받은 결과가 있을 때만 판정한다.** 조회를 기다리는 동안에는 행이 비어 있어,
   * 가드가 없으면 「고른 전표가 사라졌다」로 읽혀 아래 구획이 깜빡 닫힌다.
   *
   * replace로 바꿔 정리가 뒤로가기 기록을 늘리지 않게 한다.
   */
  useEffect(() => {
    if (selectedIrId === null) return;
    if (list.data === undefined) return;
    if (list.data.items.some((row) => row.inboundReceiptId === selectedIrId)) return;

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(SELECTION_KEYS.inboundReceipt);
        next.delete(SELECTION_KEYS.line);

        return next;
      },
      { replace: true },
    );
  }, [selectedIrId, list.data, setSearchParams]);

  /*
   * 라인 쪽도 같은 형태다 — 갱신된 라인에 고른 줄이 없거나 **고를 수 없게 됐으면** 정리한다.
   * 주소를 손으로 고쳐 LOT 없는 줄을 가리키는 경우가 이 자리다.
   *
   * **라인 응답이 있을 때만 판정한다.** 기다리는 동안 정리하면 새로고침 직후 고른 줄이
   * 주소에서 사라져 새로고침·공유가 같은 결과를 내지 못한다.
   */
  useEffect(() => {
    if (selectedLineId === null) return;
    if (lineData === undefined) return;
    if (findSelectedLine(lineData, selectedLineId) !== null) return;

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(SELECTION_KEYS.line);

        return next;
      },
      { replace: true },
    );
  }, [selectedLineId, lineData, setSearchParams]);

  /**
   * 초안을 고친다. **주소를 바꾸지 않는다**(수명 표 7행) — 주소에 실으면 글자마다 뒤로가기
   * 기록이 쌓인다.
   *
   * 고친 칸의 옛 오류를 지운다 — 남아 있으면 무엇을 고쳐야 하는지 알 수 없다.
   * 서버가 준 오류와 화면이 잡은 오류를 **함께** 지운다(저장소 전례).
   */
  const clearFieldError = (field: string): void => {
    post.clearFieldError(field);
    setLocalFieldErrors((prev) => {
      if (!(field in prev)) return prev;

      const next = { ...prev };
      delete next[field];

      return next;
    });
  };

  /**
   * **창고를 바꾸면 위치만 비운다**(수명 표 8행). 위치는 창고에 속하므로 앞서 고른 위치는
   * 다른 창고의 자리다 — 그대로 보내면 물건이 없는 자리에 재고가 잡힌다. 코드·일시·비고는
   * 창고와 무관하므로 남긴다.
   */
  const changeWarehouse = (value: string): void => {
    setDraft((prev) => ({ ...prev, warehouse: value, location: '' }));
    clearFieldError('warehouseId');
    clearFieldError('destinationLocationId');
  };

  const changeLocation = (value: string): void => {
    setDraft((prev) => ({ ...prev, location: value }));
    clearFieldError('destinationLocationId');
  };

  const changeCode = (key: GoodsReceiptCodeKey, value: string): void => {
    setDraft((prev) => ({ ...prev, codes: { ...prev.codes, [key]: value } }));
    clearFieldError(CODE_FIELD_NAMES[key]);
  };

  const changeReceiptDatetime = (value: string): void => {
    setDraft((prev) => ({ ...prev, receiptDatetime: value }));
    clearFieldError('receiptDatetime');
  };

  const changeRemarks = (value: string): void => {
    setDraft((prev) => ({ ...prev, remarks: value }));
    clearFieldError('remarks');
  };

  const supplierReference = toReference(
    suppliers,
    filters.supplier === '' ? null : Number(filters.supplier),
  );

  /**
   * 참조 실패의 복구 경로 — **이름이 보이는 자리마다 하나씩** 둔다(계획 결정 17).
   * 안내 문구가 적은 대상과 다시 부르는 대상이 어긋나면, 눌러도 한쪽은 실패인 채로 남는데
   * 문구는 둘 다 고쳐질 것처럼 말한다.
   */
  const retryTopReferences = (): void => {
    suppliers.refetch();
  };

  const retryLineReferences = (): void => {
    items.refetch();
    uoms.refetch();
    lots.refetch();
    plants.refetch();
  };

  const retryPostOptions = (): void => {
    warehouses.refetch();
    locations.refetch();
  };

  /** 고른 창고. 선택지에 없으면 `null`이다(잘렸거나 목록이 아직 오지 않았다). */
  const selectedWarehouse =
    warehouses.items.find((warehouse) => warehouse.warehouseId === selectedWarehouseId) ?? null;

  /** 고른 위치의 「코드 · 이름」. 목록에 없으면 빈 문자열이고 확인 창이 없음 표기를 낸다. */
  const locationLabel = (locationId: string): string => {
    const found = locations.items.find((location) => String(location.locationId) === locationId);

    return found === undefined ? '' : `${found.locationCode} · ${found.locationName}`;
  };

  /**
   * 확정 구획. **고른 줄이 있을 때만 그린다** — 대상이 없는데 창고·코드를 받으면 그 입력이
   * 무엇에 대한 것인지 화면이 말할 수 없고, 줄을 고르는 순간 그 값이 사라진다(수명 표 5행).
   *
   * 고른 전표와 줄을 **인자로 받는다** — 여기까지 왔다는 것이 곧 대상이 있다는 뜻이라,
   * 안쪽에서 다시 `null` 가지를 만들지 않는다.
   */
  const postPane = (inboundReceipt: IrView, line: IrLineView): ReactNode => {
    const codeOptions = toCodeOptionSets(PLACEHOLDER_GOODS_RECEIPT_CODES);
    const fieldErrors = { ...post.fieldErrors, ...localFieldErrors };
    const blockReason = postBlockReason({
      isCodeListPending: isRequiredCodeListPending(codeOptions),
      draft,
    });

    const itemName = describeReference(toReference(items, line.itemId));
    const lotName = describeReference(toReference(lots, line.lotId));
    const receiptQty = t.lineTable.receivedQtyPair(
      line.receivedQty,
      describeReference(toReference(uoms, line.uomId)),
    );
    const warehousePlantName =
      selectedWarehouse === null
        ? null
        : describeReference(toReference(plants, selectedWarehouse.plantId));

    /**
     * 보낼 수 있는 상태인가. **활성 조건과 길이를 함께 본다.**
     *
     * 창을 여는 자리와 실제로 보내는 자리가 **둘 다** 이것을 부른다 — 「버튼이 막았으니
     * 여기서는 안 봐도 된다」가 성립하려면 버튼과 전송 사이에 상태가 바뀔 수 없어야 하는데,
     * **확인 창이 그 사이를 벌려 놓는다.** 창이 열려 있는 동안 대상·초안이 바뀔 수 있고,
     * 그때 나가는 요청은 사용자가 확인한 것과 다른 것이 된다.
     */
    const findBlocked = (): Record<string, string> | null => {
      const errors = validateDraft(draft);

      if (Object.keys(errors).length > 0) return errors;

      return blockReason === null ? null : {};
    };

    /**
     * 확인 창을 연다. 막히면 **창을 열지 않고 요청도 만들지 않는다.**
     */
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
     * 빈 코드·번호 0으로 나가고(계약에 `minLength`가 없어 서버가 받을 수 있다),
     * 사용자가 확인한 줄과 다른 줄에 실릴 수 있다.
     */
    const submit = (): void => {
      setConfirmOpen(false);

      const blocked = findBlocked();

      if (blocked !== null) {
        setLocalFieldErrors(blocked);

        return;
      }

      /*
       * 실패하면 결과 구획이 비어 있어야 한다(수명 표 11행) — 앞 성공의 번호가 남으면 오해한다.
       *
       * **되돌아가는 갈래보다 앞에 둔다.** 아래 조립이 본문을 만들지 못해 아무것도 나가지 않았는데
       * 앞 전표의 번호가 남아 있으면, 사용자는 방금 누른 처리가 그 번호를 만들었다고 읽는다.
       */
      setResult(null);

      const body = toGoodsReceiptRequest({
        inboundReceipt,
        lines: toReceiptLines([line]),
        draft,
        /* 발생 시각은 **제출 순간**이다. 순수 함수에 넘겨 그 사실이 인자로 드러나게 한다. */
        now: new Date(),
      });

      /*
       * 조립이 마지막으로 거른다 — 계약이 모르는 재고 상태 코드는 화면이 막지 못한다.
       *
       * **여기서 되돌아가면 사용자는 아무 되먹임도 받지 못한다** — 결과 구획은 위에서 비웠고,
       * 훅이 아무 실패도 받지 않아 실패 문구도 서지 않는다. 자리표시(`code-options.ts`의
       * `inventoryStatus: []`)가 비어 있어 지금은 닿을 수 없는 자리이고, **자리표시를 여는
       * 회차가 사유 문구와 함께 다뤄야 한다.** 그 사실을 적어 두는 것이 다음 사람이 이 겹을
       * 「없어도 되는 것」으로 읽지 않게 한다.
       */
      if (body === null) return;

      post.write(body);
    };

    return (
      <>
        <WarehouseLocationFields
          warehouses={warehouses}
          locations={locations}
          warehouseValue={draft.warehouse}
          locationValue={draft.location}
          fieldErrors={fieldErrors}
          isLocked={isLocked}
          warehousePlantName={warehousePlantName}
          isPlantMismatch={
            selectedWarehouse !== null && selectedWarehouse.plantId !== inboundReceipt.plantId
          }
          onChangeWarehouse={changeWarehouse}
          onChangeLocation={changeLocation}
          onRetryOptions={retryPostOptions}
        />

        <CodeFields
          options={codeOptions}
          values={draft.codes}
          fieldErrors={fieldErrors}
          isLocked={isLocked}
          onChange={changeCode}
        />

        <ReceiptHeaderForm
          receiptDatetime={draft.receiptDatetime}
          remarks={draft.remarks}
          fieldErrors={fieldErrors}
          isLocked={isLocked}
          onChangeReceiptDatetime={changeReceiptDatetime}
          onChangeRemarks={changeRemarks}
        />

        {/*
         * 저장 실패는 **세 갈래**다(계획 결정 13). 배너가 검증 실패(400)·권한 없음(403)·
         * 응답 없음(네트워크)의 문구를 갈라 낸다. 충돌(409)은 이 오퍼레이션에 없다.
         */}
        <SaveErrorBanner error={post.error} />

        {/*
         * **응답을 받지 못한 실패에만 한 줄을 더한다.** 공통 문구는 「다시 시도하세요」로 끝나는데,
         * 이 화면에서 확인 없이 다시 보내면 같은 입하가 입고 전표 두 벌로 남는다 —
         * 공통 쓰기 훅이 호출마다 새 멱등 키를 만들어 서버가 재전송으로 보지 못한다.
         */}
        {post.error?.kind === 'network' && <p className="field-error">{t.notes.postRecheck}</p>}

        <div className="form-actions">
          {/* 취소가 입고 처리보다 앞에 선다 — 되돌릴 수 없는 것이 손 가까이 있으면 안 된다. */}
          <Button
            variant="text"
            disabled={isLocked}
            onClick={() => {
              requestIntent({ kind: 'cancel' });
            }}
          >
            {messages.common.cancel}
          </Button>

          <div className="field-cell">
            <Button
              variant="outlined"
              disabled={blockReason !== null || isLocked}
              loading={isLocked}
              aria-describedby={blockReason === null ? undefined : blockReasonId}
              onClick={openConfirm}
            >
              {t.actions.post}
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
              inboundReceiptNo: inboundReceipt.inboundReceiptNo,
              lineNo: line.lineNo,
              itemName,
              lotName,
              receiptQty,
              warehouseName:
                selectedWarehouse === null
                  ? ''
                  : `${selectedWarehouse.warehouseCode} · ${selectedWarehouse.warehouseName}`,
              locationName: locationLabel(draft.location),
              receiptTypeCode: draft.codes.receiptType,
              sourceDocumentTypeCode: draft.codes.sourceDocumentType,
              qualityStatusCode: draft.codes.qualityStatus,
              inventoryStatusCode: draft.codes.inventoryStatus,
              reasonCode: draft.codes.reason,
              receiptDatetime: formatDateTime(draft.receiptDatetime),
              remarks: draft.remarks,
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

  const lotStatusState: LotStatusState = lotStatus.isError
    ? { kind: 'failed' }
    : lotStatus.statusCode === null
      ? { kind: 'loading' }
      : { kind: 'known', statusCode: lotStatus.statusCode };

  /** 아래 구획. 넷 중 하나만 낸다 — 사용자가 할 조치가 서로 다르다. */
  const linePane = (): ReactNode => {
    if (selectedIrId === null) {
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
     * 말하는데 기다려서 풀리지 않는다.**
     *
     * 라인 값을 받아도 구획을 열 수 없다 — **제목줄이 쓰는 전표의 값이 목록 응답에만 있다.**
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
      <IrLineTable
        inboundReceipt={selectedRow}
        supplierName={describeReference(toReference(suppliers, selectedRow.supplierId))}
        rows={lineRows}
        isLoading={lines.isPending}
        /*
         * 공장·품목·단위·LOT은 **이름이 아니라 참조 자체**를 넘긴다 — 이 구획이 실패 안내와
         * 다시 시도를 소유하므로 실패 여부를 함께 알아야 한다. 공급사는 위 구획이 소유해
         * 이름만 넘긴다.
         */
        plantLookup={plants}
        itemLookup={items}
        uomLookup={uoms}
        lotLookup={lots}
        selectedLineId={selectedLineId}
        selectedLine={selectedLine}
        isLocked={isLocked}
        onToggleSelect={toggleSelectLine}
        onRetryReferences={retryLineReferences}
      />
    );
  };

  /*
   * 확정 구획을 열 대상. **라인 표가 그려지는 조건과 같다** —
   * 조건이 갈리면 표는 없는데 폼만 있는 상태가 생긴다.
   */
  const postTarget =
    selectedRow !== null && selectedLine !== null && !lines.isError && !lines.isPending
      ? { inboundReceipt: selectedRow, line: selectedLine }
      : null;

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
        <IrFilterBar
          appliedFilters={filters}
          supplierOptions={toSelectOptions(suppliers)}
          chipNames={{ supplier: describeReference(supplierReference) }}
          supplierNote={lookupNote(suppliers)}
          isLocked={isLocked}
          onSearch={(nextFilters) => {
            applyQuery(nextFilters);
          }}
          onRemoveFilter={(key: ChipFilterKey) => {
            applyQuery(clearFilter(filters, key));
          }}
          onReset={() => {
            applyQuery(DEFAULT_FILTERS);
          }}
        />

        {!list.isError && (
          <>
            <IrTable
              rows={rows}
              isLoading={list.isPending}
              isBeyondLast={pageView.isBeyondLast}
              selectedIrId={selectedIrId}
              supplierLookup={suppliers}
              isLocked={isLocked}
              onFirstPage={() => {
                applyQuery(filters);
              }}
              onToggleSelect={toggleSelectIr}
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
        {linePane()}
      </section>

      {postTarget !== null && (
        <section className="pane" aria-label={t.panes.post}>
          {postPane(postTarget.inboundReceipt, postTarget.line)}
        </section>
      )}

      {/*
       * 결과는 **따로 선 구획**이다. 확정 폼 안에 두면 다음 처리를 준비하는 입력과 방금
       * 만들어진 번호가 섞인다. 이름은 부품이 `role="status"`로 갖는다.
       */}
      {result !== null && selectedRow !== null && (
        /* 이름은 부품이 `role="status"`로 갖는다 — 구획에도 같은 이름을 붙이면 두 번 읽힌다. */
        <section className="pane">
          <ResultPane
            result={result}
            sourceInboundReceiptNo={selectedRow.inboundReceiptNo}
            lotStatus={lotStatusState}
          />
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
