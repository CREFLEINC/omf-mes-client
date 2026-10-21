import {
  Button,
  EmptyState,
  SkeletonText,
  Stepper,
  TextField,
  type StepperItem,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { SaveErrorBanner } from '../../patterns/master';
import { plantNowLocal } from '../../patterns/plant-time';
import { useFitToViewport } from '../../patterns/po-board';
import {
  codeLabel,
  defaultExceptionType,
  EXCEPTION_TYPE_GROUP,
  SUBSTITUTE_LOT_REASON_GROUP,
  toCodeOptions,
  type CodeListState,
} from './code-options';
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
import {
  createDrafts,
  hasAnyLineInput,
  readDraft,
  setDraftLot,
  setDraftQty,
  type LineDrafts,
  type LotDraft,
  type LotPart,
} from './line-draft';
import { LoadErrorBanner } from './load-error-banner';
import {
  describeReference,
  lookupNote,
  toReference,
  useItemNames,
  usePlantOptions,
  useSupplierOptions,
  useUomOptions,
  type LookupResult,
} from './lookups';
import { guideHint, guideStatuses, guideStep, GUIDE_STEPS } from './guide';
import { applyLotScan } from './lot-scan';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { PoFilterBar } from './po-filter-bar';
import { PoTable } from './po-table';
import { ReceiptHeaderForm } from './receipt-header-form';
import { RegisterActions } from './register-actions';
import { RegisterConfirmDialog } from './register-confirm-dialog';
import {
  useCodeValues,
  usePurchaseOrderLines,
  usePurchaseOrders,
  useSplitRegister,
} from './queries';
import { hasLineError, toSplitLines, type ItemCodeResolver } from './split-calc';
import { toSplitParts, toSplitRequest } from './split-request';
import { SplitLineTable } from './split-line-table';
import {
  EMPTY_HEADER_DRAFT,
  toCreatedReceiptView,
  type CreatedResult,
  type HeaderDraft,
  type PoLineView,
  type PoView,
  type SelectOption,
  type SplitMode,
} from './types';
import { lineErrorReason, registerBlockReason, validateHeader } from './validation';

const t = messages.overReceiptSplit;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: PoView[] = [];
const EMPTY_LINES: PoLineView[] = [];
const EMPTY_ITEM_IDS: number[] = [];
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

const isSameHeader = (left: HeaderDraft, right: HeaderDraft): boolean =>
  left.receiptDatetime === right.receiptDatetime &&
  left.deliveryNoteNo === right.deliveryNoteNo &&
  left.remarks === right.remarks &&
  left.exceptionTypeCode === right.exceptionTypeCode &&
  left.exceptionReason === right.exceptionReason;

const codeStateOf = (query: { isPending: boolean; isError: boolean }): CodeListState =>
  query.isError ? 'failed' : query.isPending ? 'loading' : 'ready';

/**
 * W-01-03 컨테이너 — **자재창고 도메인의 첫 쓰기 화면**이다.
 *
 * 배치는 「입하 예정 조회」와 같다(사용자 지시 2026-10-21) — 위: 조건 줄 / 아래 왼쪽: 대상 발주 목록 /
 * 아래 오른쪽(1:2): 고른 발주의 머리 · 라벨 스캔 · 라인과 도착 수량·LOT · 등록 정보 · 등록 결과.
 * 조회 조건과 고른 발주는 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 * **초안은 주소에 싣지 않는다.**
 *
 * **되돌릴 수 없는 쓰기다.** 계약의 입하 취소는 승인을 타므로(실측) 잘못 만들어진 전표를
 * 이 화면이 되돌릴 수 없다. 그래서 보내기 전에 네 겹으로 막는다 —
 * ① 갈래별 활성 조건(계약의 조건부 필수) ② 머리 입력 검증 ③ 고치지 않은 줄(수량·LOT)
 * ④ 무엇이 몇 건 나가는지 보이는 확인 창.
 *
 * **보내는 중에는 화면 전체를 잠근다**(계획 결정 13). 등록 세 갈래와 취소·입력칸뿐 아니라
 * **대상을 바꾸는 길**(목록의 선택 · 조건 조회·초기화 · 쪽 이동)도 함께 닫는다 —
 * 열어 두면 사용자가 초안을 버리고 다른 발주로 옮긴 뒤 **앞 발주의 등록 결과가 지금 보는
 * 발주의 맥락에 나타난다.**
 */
export const OverReceiptSplitScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { splitRef, aboveRef } = useFitToViewport();

  /**
   * **무엇이 바뀔 때 무엇을 비우는가 — 수명 표.**
   *
   * 「비운다」와 「비우지 않는다」를 이 표 한 곳에 모은다. 규칙이 흩어지면 한쪽만 고쳐져
   * 비대칭이 생긴다(조건을 바꾸면 아래 구획이 닫히는데 쪽을 옮기면 안 닫히는 식).
   *
   * | # | 조작 | 조건 | `page` | `po` | 초안 | 결과 구획 |
   * | :-: | --- | :-: | :-: | :-: | :-: | :-: |
   * | 1 | 조건 변경·조회 | 바뀐다 | **첫 쪽** | **비운다** | **비운다** | 비운다 |
   * | 2 | 초기화 | **기본으로** | 첫 쪽 | 비운다 | 비운다 | 비운다 |
   * | 3 | 쪽 이동 | 유지 | 옮긴 쪽 | **비운다** | **비운다** | 비운다 |
   * | 4 | 발주 고르기 | 유지 | **유지** | 넣는다 | **라인 응답으로 새로 만든다** | 비운다 |
   * | 5 | 결과에 고른 발주 없음 | 유지 | 유지 | **비운다** | 비운다 | 비운다 |
   * | 6 | **수량·LOT·머리 입력** | 유지 | 유지 | 유지 | 바뀐다 | **유지** |
   * | 7 | 목록·참조 응답 도착 | 유지 | 유지 | 유지 | **건드리지 않는다** | 유지 |
   * | 8 | **등록 성공** | 유지 | 유지 | **유지** | **비운다** | **채운다** |
   * | 9 | 등록 실패 | 유지 | 유지 | 유지 | **유지**(입력을 잃지 않는다) | 비운다 |
   * | 10 | 취소 | 유지 | 유지 | **비운다** | **비운다** | 비운다 |
   *
   * - **1·3행이 초안을 비우는 이유**: 초안은 특정 발주의 라인에 묶여 있다. 다만 **비어 있지 않으면
   *   확인을 받는다** — 친 값이 말없이 사라지면 무엇을 잃었는지도 알 수 없다.
   * - **6·7행이 이 화면의 #43 자리다**: 초안 되돌림은 **`po`와 라인 응답에만 반응하는 effect
   *   한 곳**이 한다. 목록 재조회·참조 도착·부모 리렌더에 반응하면 「치던 수량이 사라진다」.
   * - **8행이 초안을 비우는 것을 라인 재조회에 얹지 않는 이유**: 같은 응답이 오면 캐시가 참조를
   *   그대로 유지해 되돌림 effect가 깨어나지 않는다 — 등록에 성공했는데 수량이 남아 한 번 더
   *   보낼 수 있는 상태가 된다.
   */
  const filters = useMemo<PoFilters>(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const selectedPoId = readSelectedPoId(searchParams);

  /* **조건이 하나도 없어도 조회한다.** 기본 조건(미완료만)은 `toFilterQuery`가 채운다. */
  const listQuery = { ...toFilterQuery(filters), ...(page > 1 ? { page } : {}) };

  const list = usePurchaseOrders(listQuery);
  const rows = list.data?.items ?? EMPTY_ROWS;
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  const suppliers = useSupplierOptions();
  const plants = usePlantOptions();
  /* 단위·코드 사전은 아래 구획만 쓴다 — 고르기 전에 부르면 첫 진입의 요청 수가 이유 없이 는다. */
  const uoms = useUomOptions(selectedPoId !== null);
  const exceptionTypes = useCodeValues(EXCEPTION_TYPE_GROUP, selectedPoId !== null);
  const lotReasons = useCodeValues(SUBSTITUTE_LOT_REASON_GROUP, selectedPoId !== null);
  const exceptionTypeOptions = useMemo(
    () => toCodeOptions(exceptionTypes.data),
    [exceptionTypes.data],
  );
  const lotReasonOptions = useMemo(() => toCodeOptions(lotReasons.data), [lotReasons.data]);
  const defaultExceptionCode = defaultExceptionType(exceptionTypeOptions);

  const lines = usePurchaseOrderLines(selectedPoId);
  const lineData = lines.data;

  /* 품목 이름·코드는 **라인이 온 뒤에** 그 줄에 실린 번호만 묻는다(`lookups.ts`의 ⛔ 둘). */
  const items = useItemNames(lineData?.map((line) => line.itemId) ?? EMPTY_ITEM_IDS);
  const itemCodeOf: ItemCodeResolver = (itemId) => items.detail(itemId)?.itemCode ?? null;

  /** 라인별 도착 수량·LOT 초안. **주소에 싣지 않는다** — 글자마다 뒤로가기 기록이 쌓인다. */
  const [drafts, setDrafts] = useState<LineDrafts>(EMPTY_DRAFTS);

  /*
   * **#43을 재생산하지 않는 자리다**(수명 표 6·7행). 의존성은 **고른 발주와 라인 응답 둘뿐이다.**
   * `useMemo`로 만든 파생 객체(아래 `splitLines`)를 의존성에 넣지 않는 것도 같은 이유다.
   */
  useEffect(() => {
    setDrafts(createDrafts(lineData ?? EMPTY_LINES));
  }, [selectedPoId, lineData]);

  /**
   * 라인 바깥의 초안. **라인 응답에 반응하지 않는다.** 되돌아가는 신호는 **고른 발주가 바뀌는 것**뿐이다.
   *
   * `baseline` 은 화면이 채운 기본값(입하 일시 = 공장 현지 지금 · 예외 유형 = 초과입하)이다 —
   * 「버릴 것이 있는가」는 기본값과 **다른지**로 잰다. 기본값만 있는 상태는 버릴 것이 없다.
   */
  const [header, setHeader] = useState<HeaderDraft>(EMPTY_HEADER_DRAFT);
  const [baseline, setBaseline] = useState<HeaderDraft>(EMPTY_HEADER_DRAFT);

  /** 만들어진 전표와 그 갈래. `null`이면 아직 등록하지 않았거나 마지막 시도가 실패했다. */
  const [created, setCreated] = useState<CreatedResult | null>(null);

  /**
   * 방금 제출한 갈래. 되먹임(`onSuccess`)에서 읽는다 — **`savingMode` 상태로는 읽을 수 없다.**
   * 되먹임은 제출한 렌더의 닫힘을 들고 있어 그 렌더의 옛 값을 본다.
   */
  const submittedModeRef = useRef<SplitMode>('BOTH');

  /** 보내기 전에 화면이 잡은 오류. **등록을 누른 뒤에만 세운다.** */
  const [localFieldErrors, setLocalFieldErrors] = useState<Record<string, string>>(NO_FIELD_ERRORS);

  /** 고치지 않은 줄 때문에 막았다는 사실. 사용자가 고치면 조건이 풀려 저절로 사라진다 */
  const [isLineBlockShown, setLineBlockShown] = useState(false);

  /** 지금 보내는 갈래. 어느 버튼을 눌렀는지 그 버튼이 밝히는 데 쓴다 */
  const [savingMode, setSavingMode] = useState<SplitMode | null>(null);

  /** 확인을 기다리는 조작. `null`이면 확인 창이 없다 */
  const [pendingDiscard, setPendingDiscard] = useState<DiscardIntent | null>(null);

  /** 확인 창이 열려 있는가(④). 검증을 통과한 뒤에만 선다 — 갈래는 창 안에서 고른 전표로 정해진다. */
  const [isConfirmOpen, setConfirmOpen] = useState(false);

  /** 라벨 스캔 칸. 결과 한 줄은 칸 아래 산다. */
  const scanRef = useRef<HTMLInputElement>(null);
  const [scanText, setScanText] = useState('');
  const [scanNote, setScanNote] = useState<string | null>(null);

  /*
   * 대상이 바뀌면 머리 입력과 등록 결과를 함께 비운다(수명 표 1~5·10행).
   * **의존성은 고른 발주 하나뿐이다** — 라인 응답을 넣으면 다시 부를 때마다 입력이 사라진다.
   * 입하 일시는 **공장 현지 지금**으로 채운다 — 대개 받자마자 등록하고, 아니면 고친다.
   */
  useEffect(() => {
    const next: HeaderDraft = {
      ...EMPTY_HEADER_DRAFT,
      receiptDatetime: selectedPoId === null ? '' : plantNowLocal(),
    };
    setHeader(next);
    setBaseline(next);
    setCreated(null);
    setLocalFieldErrors(NO_FIELD_ERRORS);
    setLineBlockShown(false);
    setScanText('');
    setScanNote(null);
  }, [selectedPoId]);

  /*
   * 예외 유형의 기본값은 코드 사전이 온 뒤에 채운다 — 아직 고르지 않았을 때만. 초과분은 정의상
   * 「초과입하」라 사람이 매번 고를 까닭이 없다. 기본값은 버릴 것으로 세지 않는다(baseline 도 함께).
   */
  useEffect(() => {
    if (defaultExceptionCode === '') return;
    setHeader((prev) =>
      prev.exceptionTypeCode === '' ? { ...prev, exceptionTypeCode: defaultExceptionCode } : prev,
    );
    setBaseline((prev) =>
      prev.exceptionTypeCode === '' ? { ...prev, exceptionTypeCode: defaultExceptionCode } : prev,
    );
  }, [selectedPoId, defaultExceptionCode]);

  /** 고른 발주. **목록 응답에서 찾는다** — 제목줄에 필요한 값이 그 행에 이미 들어 있다. */
  const selectedRow = rows.find((row) => row.purchaseOrderId === selectedPoId) ?? null;

  const register = useSplitRegister({
    purchaseOrderId: selectedPoId,
    onSuccess: (data) => {
      setCreated({
        mode: submittedModeRef.current,
        receipts: data.created.map(toCreatedReceiptView),
      });
      /* **초안을 비운다**(수명 표 8행 · 이중 제출 완화의 한 층). 머리는 기본값으로 돌아간다. */
      setDrafts(EMPTY_DRAFTS);
      setHeader(baseline);
      setLocalFieldErrors(NO_FIELD_ERRORS);
      setLineBlockShown(false);
    },
  });

  /** 버릴 것이 있는가. 라인 입력(수량·LOT)과 머리 입력을 **함께** 본다. */
  const hasDraft = hasAnyLineInput(drafts) || !isSameHeader(header, baseline);

  /**
   * 조작을 실제로 수행한다. 셋 모두 **주소를 한 번만 갱신한다** — 조건과 쪽을 따로 갱신하면
   * 뒤로가기 기록이 두 칸 는다. `toSearchParams`가 `po`를 만들지 않으므로 조건·쪽이 바뀌면
   * 고른 발주가 함께 풀리고, 초안 되돌림 effect가 초안을 비운다(수명 표 1~3행).
   */
  const runIntent = (intent: DiscardIntent): void => {
    switch (intent.kind) {
      case 'cancel':
        /* **서버를 부르지 않는다**(이슈 §6). 이 화면의 「취소」는 저장 전 복귀다. */
        setSearchParams(toSearchParams(filters, page));
        break;
      case 'select': {
        /* 고르는 것은 **보이는 행을 바꾸지 않는다**(수명 표 4행). */
        const next = toSearchParams(filters, page);
        next.set('po', String(intent.purchaseOrderId));
        setSearchParams(next);
        break;
      }
      case 'query':
        setSearchParams(toSearchParams(intent.filters, intent.page));
        break;
    }
  };

  /**
   * 초안을 버리게 되는 조작은 **버리기 전에 확인을 받는다**(계획 결정 10). 버릴 것이 없으면 곧바로 한다.
   */
  const requestIntent = (intent: DiscardIntent): void => {
    /* **보내는 중에는 대상을 바꾸지 않는다** — 조건 칩의 ×처럼 잠금을 받지 않는 자리까지 막는다. */
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
    if (purchaseOrderId === selectedPoId) return;
    requestIntent({ kind: 'select', purchaseOrderId });
  };

  /*
   * 갱신된 결과에 고른 발주가 없으면 `po`를 주소에서 뗀다(수명 표 5행). **정리를 고른 식별자에 묶는다** —
   * 뒤로가기·주소 직접 편집은 핸들러를 거치지 않는다. **받은 결과가 있을 때만 판정한다.**
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
   * **읽는 자리에서 파생한다.** 잔량·정량/초과·LOT 사유는 `split-calc.ts`가 한 번만 만들고
   * 표는 그 결과를 그리기만 한다 — **요청 조립도 같은 결과를 받는다.**
   */
  const splitLines = toSplitLines(lineData ?? EMPTY_LINES, drafts, itemCodeOf);

  /* 수량·LOT 입력은 **주소를 바꾸지 않는다**(수명 표 6행). */
  const changeQty = (purchaseOrderLineId: number, text: string): void => {
    setDrafts((prev) => setDraftQty(prev, purchaseOrderLineId, text));
  };

  /**
   * LOT 칸. 「라벨 없음」을 켜면 대체 사유를 **첫 선택지로 미리 채운다** — 사유 없이는 보낼 수 없어 어차피
   * 하나를 골라야 하고, 가장 흔한 사유(라벨 없음)가 첫째다. 다른 사유면 바꾼다.
   */
  const changeLot = (
    purchaseOrderLineId: number,
    part: LotPart,
    patch: Partial<LotDraft>,
  ): void => {
    const defaultReason = lotReasonOptions[0]?.value ?? '';
    setDrafts((prev) => {
      const draft = readDraft(prev, purchaseOrderLineId);
      const current = part === 'normal' ? draft.lot : draft.excessLot;
      const filled =
        patch.labelMissing === true && (patch.reasonCode ?? current.reasonCode) === ''
          ? { ...patch, reasonCode: defaultReason }
          : patch;

      return setDraftLot(prev, purchaseOrderLineId, part, filled);
    });
  };

  /** 잔량이 남은 줄 중 아직 비운 줄에 잔량을 넣는다 — 「전부 왔다」가 이 화면의 흔한 출발점이다. */
  const fillRemaining = (): void => {
    setDrafts((prev) =>
      splitLines.reduce(
        (next, row) =>
          row.remainingQty > 0 &&
          readDraft(prev, row.line.purchaseOrderLineId).qtyText.trim() === ''
            ? setDraftQty(next, row.line.purchaseOrderLineId, String(row.remainingQty))
            : next,
        prev,
      ),
    );
  };

  /** 라벨 스캔 — 품목코드로 줄을 찾아 수량과 LOT 을 담는다(규칙은 `lot-scan.ts`). 칸은 비워 다음 스캔을 받는다. */
  const scan = (): void => {
    const result = applyLotScan(scanText, lineData ?? EMPTY_LINES, drafts, itemCodeOf);
    setScanNote(result.note);
    if (result.applied) {
      setDrafts(result.drafts);
      setScanText('');
    }
  };

  /** 실제로 요청에 실릴 라인 수. **세는 자리와 보내는 자리가 같다** — 갈리면 빈 part가 나간다. */
  const parts = toSplitParts(splitLines);
  const counts = { normalLines: parts.normal.length, excessLines: parts.excess.length };

  /* 사용자가 고치면 조건이 풀려 안내가 저절로 사라진다 — 지워 주는 절차를 따로 두지 않는다. */
  const lineBlockReason = isLineBlockShown ? lineErrorReason(splitLines) : null;

  /**
   * 등록 단추 — **보내기 전에 두 겹을 본다**(머리 입력 · 고치지 않은 줄). 통과하면 확인 창을 연다(④).
   * 막히면 **요청을 만들지 않는다** — 되돌릴 수 없는 쓰기라 「보내 보고 서버가 막아 주기」를 기대할 수 없다.
   */
  const requestSubmit = (): void => {
    const headerErrors = validateHeader(header, { needsExceptionType: counts.excessLines > 0 });
    const lineBlocked = lineErrorReason(splitLines) !== null;

    setLocalFieldErrors(headerErrors);
    setLineBlockShown(lineBlocked);

    if (Object.keys(headerErrors).length > 0 || lineBlocked) return;

    setConfirmOpen(true);
  };

  /** 확인 창의 「등록」. 요청을 만들어 보낸다. */
  const submit = (purchaseOrder: PoView, mode: SplitMode): void => {
    /* 실패하면 결과 구획이 비어 있어야 한다(수명 표 9행) — 앞 성공의 번호가 남으면 오해한다. */
    setCreated(null);
    setSavingMode(mode);
    /* 요청을 만들기 전에 적는다 — 되먹임이 이 값을 읽는다(위 ref 주석). 매 제출마다 새로 적는다. */
    submittedModeRef.current = mode;

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

  /** 머리 입력을 고치면 그 칸의 옛 오류(서버·화면 둘 다)를 지운다 — 남아 있으면 무엇을 고쳐야 하는지 알 수 없다. */
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

  /** 참조 실패의 복구 경로 — **이름이 보이는 자리마다 하나씩** 둔다(계획 결정 15). */
  const retryTopReferences = (): void => {
    suppliers.refetch();
  };

  const retryLineReferences = (): void => {
    items.refetch();
    uoms.refetch();
    plants.refetch();
  };

  /*
   * 등록 구획을 열 대상. **라인 표가 그려지는 조건과 같다** — 조건이 갈리면 표는 없는데 폼만 있는 상태가 생긴다.
   */
  const registerTarget =
    selectedRow !== null && !lines.isError && !lines.isPending ? selectedRow : null;

  /* 라인이 서면 스캔 칸이 입력을 받는다 — 스캐너는 키보드처럼 글자와 Enter 를 보낸다. */
  useEffect(() => {
    if (registerTarget !== null) scanRef.current?.focus();
  }, [registerTarget]);

  const toolbar = (
    <div className="ors-toolbar">
      <div className="field-cell ors-scan">
        <TextField
          ref={scanRef}
          fullWidth
          label={t.scan.label}
          placeholder={t.scan.placeholder}
          value={scanText}
          autoComplete="off"
          disabled={register.isSaving}
          onChange={(event) => {
            setScanText(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              scan();
            }
          }}
        />
        {scanNote === null ? (
          <span className="field-note">{t.scan.hint}</span>
        ) : (
          <span className="field-note" role="status">
            {scanNote}
          </span>
        )}
      </div>
      <div className="field-cell field-cell-unlabeled">
        <Button variant="outlined" size="sm" disabled={register.isSaving} onClick={fillRemaining}>
          {t.actions.fillRemaining}
        </Button>
      </div>
    </div>
  );

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
     * 고른 번호는 있는데 그 행이 없다. **잣대는 「목록 조회가 성립했는가」다** — 목록이 실패하면
     * 골격을 내도 기다려서 풀리지 않는다. 라인 값을 받아도 제목줄의 발주 값이 목록 응답에만 있어
     * 구획을 열 수 없다.
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
        /* 공장은 **참조 자체**를 넘긴다 — 이 구획이 실패 안내와 다시 시도를 소유한다. */
        plantLookup={plants}
        itemNames={items}
        uomLookup={uoms}
        lotReasonOptions={lotReasonOptions}
        isLocked={register.isSaving}
        showLotErrors={isLineBlockShown}
        toolbar={lines.isPending ? undefined : toolbar}
        onChangeQty={changeQty}
        onChangeLot={changeLot}
        onRetryReferences={retryLineReferences}
      />
    );
  };

  /**
   * 단계 안내(`guide.ts`) — 화면 상태에서 지금 할 일을 정한다. 머리 입력은 **지금** 검증해 보되 붉은 글씨는
   * 내지 않는다(그것은 등록을 누른 뒤의 일). 단계는 안내일 뿐 아무 단추도 잠그지 않는다.
   */
  const step = guideStep({
    hasOrder: registerTarget !== null,
    counts,
    hasLineError: hasLineError(splitLines),
    headerErrorCount: Object.keys(
      validateHeader(header, { needsExceptionType: counts.excessLines > 0 }),
    ).length,
  });
  const statuses = guideStatuses(step);
  const guideItems: StepperItem[] = GUIDE_STEPS.map((key) => ({
    label: t.guide.steps[key],
    status: statuses[key],
  }));

  const guide = (
    <nav className="ors-guide" aria-label={t.guide.label}>
      <Stepper size="sm" steps={guideItems} />
      <p className="ors-guide-hint" aria-live="polite">
        {guideHint(step)}
      </p>
    </nav>
  );

  /**
   * 등록 구획. **라인 표가 실제로 그려질 때만 낸다** — 라인을 못 받았는데 등록 폼을 열면
   * 무엇을 등록하는지 없는 채로 입력만 받게 된다. 초과분 정보는 **초과분이 갈린 뒤에만** 선다.
   */
  const registerPane = (purchaseOrder: PoView): ReactNode => (
    <>
      <h3 className="ors-section-title">{t.form.headerTitle}</h3>
      <ReceiptHeaderForm
        values={header}
        fieldErrors={fieldErrors}
        isSaving={register.isSaving}
        onChange={changeHeader}
      />

      {counts.excessLines > 0 && (
        <>
          <h3 className="ors-section-title">{t.form.excessTitle}</h3>
          <ExcessForm
            values={header}
            fieldErrors={fieldErrors}
            isSaving={register.isSaving}
            exceptionTypeOptions={exceptionTypeOptions}
            exceptionTypeState={codeStateOf(exceptionTypes)}
            onChange={changeHeader}
          />
        </>
      )}

      {/* 저장 실패는 **세 갈래**다(계획 결정 9) — 검증 실패(400)·권한 없음(403)·응답 없음(네트워크). */}
      <SaveErrorBanner error={register.error} />

      {/* **응답을 받지 못한 실패에만 한 줄을 더한다** — 확인 없이 다시 보내면 같은 입하가 전표 두 벌로 남는다. */}
      {register.error?.kind === 'network' && (
        <p className="field-error">{t.notes.registerRecheck}</p>
      )}

      {lineBlockReason !== null && <p className="field-error">{lineBlockReason}</p>}

      {/* 누르기 전에 무엇이 만들어지는지 — 「등록」 하나가 무엇을 하는지 이 줄에서 읽힌다. */}
      <p className="ors-totals" aria-live="polite">
        {counts.normalLines + counts.excessLines === 0 ? (
          t.totals.none
        ) : (
          <>
            <span>{t.totals.label}:</span>
            {counts.normalLines > 0 && <strong>{t.totals.normal(counts.normalLines)}</strong>}
            {counts.excessLines > 0 && <strong>{t.totals.excess(counts.excessLines)}</strong>}
          </>
        )}
      </p>

      <RegisterActions
        blockReason={registerBlockReason(counts)}
        isSaving={register.isSaving}
        onSubmit={requestSubmit}
        onCancel={() => {
          requestIntent({ kind: 'cancel' });
        }}
      />

      {isConfirmOpen && (
        <RegisterConfirmDialog
          counts={counts}
          purchaseOrderNo={purchaseOrder.purchaseOrderNo}
          supplierName={describeReference(toReference(suppliers, purchaseOrder.supplierId))}
          header={header}
          exceptionTypeLabel={codeLabel(exceptionTypeOptions, header.exceptionTypeCode)}
          lotReasonLabel={(code) => codeLabel(lotReasonOptions, code)}
          rows={splitLines.filter((row) => row.split !== null)}
          itemLabelOf={(itemId) => describeReference(items.of(itemId))}
          uomLabelOf={(uomId) => describeReference(toReference(uoms, uomId))}
          onConfirm={(mode) => {
            setConfirmOpen(false);
            submit(purchaseOrder, mode);
          }}
          onClose={() => {
            setConfirmOpen(false);
          }}
        />
      )}
    </>
  );

  return (
    <>
      {/* 조회 실패는 빈 상태로 오인시키지 않는다 — 「없습니다」로 내면 자료가 없는 줄 안다. */}
      {list.isError && (
        <LoadErrorBanner
          error={list.error}
          onRetry={() => {
            void list.refetch();
          }}
        />
      )}

      {/* 결과가 없어도 조건 줄은 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
      <section ref={aboveRef} className="pane po-board-filter" aria-label={t.panes.filter}>
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
      </section>

      <div ref={splitRef} className="po-board-split">
        <section className="pane po-board-pane" aria-label={t.panes.list}>
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

        {/*
         * 오른쪽 한 구획에 라인 · 등록 정보 · 결과를 차례로 둔다 — 고른 발주의 일이 한 자리에서 끝난다.
         * 넘치면 이 구획이 통째로 스크롤한다(등록 단추가 표 아래에 있어 표만 스크롤하면 단추가 멀어진다).
         */}
        <section className="pane po-board-pane po-board-scroll" aria-label={t.panes.lines}>
          {guide}
          {linePane()}

          {registerTarget !== null && (
            <section className="po-board-register" aria-label={t.panes.register}>
              {registerPane(registerTarget)}
            </section>
          )}

          {/* 결과는 **따로 선 자리**다 — 다음 등록을 준비하는 입력과 방금 만들어진 번호가 섞이지 않게. */}
          {created !== null && (
            <div className="po-board-register">
              <CreatedReceiptsPane receipts={created.receipts} mode={created.mode} />
            </div>
          )}
        </section>
      </div>

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
