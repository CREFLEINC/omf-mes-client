import { Breadcrumb, Button, EmptyState, PageHeader, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { SaveErrorBanner } from '../../patterns/master';
import { DiscardConfirmDialog } from './discard-confirm-dialog';
import { readSourceLineId, readSourceReceiptId, withSourceLineId } from './entry';
import { HeaderForm } from './header-form';
import {
  addLineDraft,
  areLinesInherited,
  createInheritedLineDraft,
  patchLineDraft,
  removeLineDraft,
} from './line-draft';
import { LineTable } from './line-table';
import { LoadErrorBanner } from './load-error-banner';
import {
  describeReference,
  lookupNote,
  toReference,
  useBusinessUnitOptions,
  useItemOptions,
  usePlantOptions,
  useSupplierOptions,
  useUomOptions,
  type LookupResult,
} from './lookups';
import { summarizeOrderedQty, toPurchaseOrderCreate } from './po-request';
import {
  useCreatePurchaseOrder,
  usePurchaseOrderDetailFetcher,
  useRequestApproval,
  useSourceReceipt,
} from './queries';
import { readReason, toApprovalRequest } from './reason-draft';
import { RegisterConfirmDialog, type RegisterSummary } from './register-confirm-dialog';
import { ResultPane, type SubmitPhase } from './result-pane';
import { ScopeBanner } from './scope-banner';
import { SourceReceiptPane } from './source-receipt-pane';
import { SubmitConfirmDialog, type SubmitSummary } from './submit-confirm-dialog';
import {
  headerSeed,
  isHeaderEdited,
  type CreatedPoView,
  type HeaderDraft,
  type LineDraft,
  type SelectOption,
  type SourceLineView,
} from './types';
import { supplierChangeWarning, validateHeader, validateLines } from './validation';

const t = messages.poRegister;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_LINES: SourceLineView[] = [];
const EMPTY_DRAFTS: LineDraft[] = [];

/** 확인을 기다리는 조작. `null`이면 열린 창이 없다. */
type PendingAction = 'register' | 'discard' | 'submit';

/**
 * 참조 목록을 선택지로 옮긴다.
 *
 * **미사용 값을 빼지 않고 표식만 붙인다** — 참조를 `includeInactive=true`로 받는 이유는
 * 미사용 값을 참조하는 과거 자료의 이름을 풀기 위해서인데, 빼면 그 값을 고를 수도 없다.
 */
const toSelectOptions = (lookup: LookupResult): SelectOption[] =>
  lookup.entries.map((entry) => ({
    value: entry.value,
    label: entry.isActive ? entry.label : `${entry.label}${t.values.inactiveSuffix}`,
  }));

/**
 * W-01-11 컨테이너 — **초과 입하분을 사후에 정산하는 발주 등록 화면**이다.
 *
 * 배치는 위에서 아래로 쌓는다 — 범위 안내 · 넘어온 초과분(읽기 전용) · 발주 정보 · 발주 라인 ·
 * 등록. 진입 맥락(`receipt`·`line`)은 **주소가 소유한다**(계획 결정 2) — 새로고침·뒤로가기·
 * 공유가 같은 초과분을 연다. **친 값은 주소에 싣지 않는다.**
 *
 * **등록과 승인 요청은 별개 동작이다**(착수 이슈 §6 ③ · 계획 결정 9). 이 화면의 「등록」 한 번은
 * 요청 **하나**를 보내고 거기서 멈춘다 — 결재 상신은 별개 조작이고 뒤따르는 회차가 붙인다.
 * 주 사본이 된 전례는 한 버튼이 등록+상신 두 요청을 이었는데, 그 형태를 그대로 베끼면 이 화면이
 * 착수 이슈를 어긴다.
 *
 * **되돌릴 수 없는 쓰기를 세 겹으로 막는다**(계획 결정 12·16 · 공통 훅이 호출마다 새 멱등 키를
 * 만든다 — 실측). ① 확인 창 ② 전송 중 전면 잠금 ③ 성공 뒤 폼·버튼 잠금. 두 번 누르는 것이
 * 그대로 전표 두 벌이 되고, 이 화면에는 되돌릴 경로가 없다(취소는 승인을 탄다).
 *
 * **무엇이 바뀔 때 무엇을 비우는가 — 수명 표.**
 *
 * | # | 조작 | `receipt` | `line` | 발주 정보 | 라인 초안 |
 * | :-: | --- | :-: | :-: | :-: | :-: |
 * | 1 | 첫 진입(맥락 있음) | 주소 | 주소 또는 자동 확정 | **승계로 채운다** | **승계 줄 1행** |
 * | 2 | 대상 줄 바꾸기 | 유지 | 바뀐다(`replace`) | **건드리지 않는다** | **다시 세운다** |
 * | 3 | 발주 정보·라인 치기 | 유지 | 유지 | 바뀐다 | 바뀐다 |
 * | 4 | 참조 응답 도착 | 유지 | 유지 | **건드리지 않는다** | **건드리지 않는다** |
 * | 5 | **입하 상세 재조회(같은 값)** | 유지 | 유지 | **건드리지 않는다** | **건드리지 않는다** |
 * | 6 | 입하 상세 재조회(**값이 달라짐**) | 유지 | 유지 | 승계값(공급사·공장)이 달라지면 **다시 세운다** · 그 밖에는 건드리지 않는다 | **고른 줄이 달라지면** 다시 세운다 |
 * | 7 | **다른 전표로 주소가 바뀜** | 바뀐다 | 바뀐다 | **다시 세운다** | 다시 세운다 |
 * | 8 | 맥락 없이 진입 | 없음 | 없음 | 비어 있다 | 비어 있다 |
 * | 9 | **취소**(버리기 확인 뒤) | 유지 | 유지 | **승계로 되세운다** | **승계 줄 1행으로 되세운다** |
 * | 10 | **등록 성공** | 유지 | 유지 | 값은 남고 **잠긴다** | 값은 남고 **잠긴다** |
 *
 * 4~6행이 이 화면의 `omf-mes#43` 자리다. **되돌림 축이 둘이고 서로 다르다**(전례와 같은 형태):
 *
 * - **발주 정보** — 축은 **넘어온 전표와 승계 원천 두 값**(전표 번호 · 공급사 · 공장)이다.
 *   응답 객체를 축으로 삼으면 재조회가 새 참조를 주는 순간 사용자가 친 사업부·발주일이 말없이
 *   되돌아간다. 반대로 전표 번호를 축에서 빼면 **공급사·공장이 같은 다른 전표**로 옮겨 갈 때
 *   앞 전표에서 치던 값이 그대로 남는다(7행) — 그래서 축에 전표 번호가 함께 있다.
 * - **라인 초안** — 축은 **고른 줄**이다. 하한 판정의 근거가 그 줄의 입하수량이라, **고른 줄이
 *   실제로 달라지면** 초안도 다시 서야 한다(6행). 대상을 바꾸는 것과 그 줄의 값이 바뀌는 것이
 *   같은 뜻이다 — **다른 줄만 바뀌면 다시 서지 않는다**(구조 공유가 고른 줄의 참조를 지킨다).
 *   **같은 값을 다시 받는 것도 그 축을 움직이지 않는다**(5행) — 조회 캐시가 구조를 공유해
 *   응답이 같으면 `chosenLine`의 참조도 그대로다. 여기서 초안이 다시 서면 사용자가 친 수량이
 *   재조회 한 번에 말없이 되돌아간다.
 *
 * 두 축이 서로 다른 조건에 걸리므로 6행의 두 칸도 **각각 다른 조건**으로 읽는다 — 승계값이
 * 그대로인 채 줄만 달라지면 발주 정보는 남고 라인만 다시 선다.
 *
 * **상신 사유 초안은 축이 하나 더 있다** — **만들어진 전표**다. 등록 결과가 서야 사유 칸이
 * 있고, 대상 전표가 바뀌면 결과와 함께 사유도 거둔다(7행) — 남겨 두면 앞 초과분에 붙일 사유가
 * 다른 발주의 결재에 올라간다. **상신에 실패해도 사유는 남는다**(다시 올릴 길이 그것이다).
 *
 * **상신 결과는 전표 번호에 매인다**(리뷰 R-24). 나가는 중인 쓰기를 끊지 않으므로 정리
 * effect가 지나간 뒤 응답이 도착하는 길이 실재한다 — **주소는 잠글 수 없다**(뒤로·앞으로·주소
 * 편집). 그래서 「올렸다」를 깃발이 아니라 **올린 전표 번호**로 들고, 성공 갈래인지는
 * **읽는 자리**(`submitPhase`)에서 지금 전표와 대조해 정한다. 정리 effect도 그 값을 함께
 * 거두지만 그것은 **둘째 겹**이고, 순서에 기대지 않는 쪽이 첫째 겹이다.
 *
 * **되돌릴 수 없는 쓰기가 둘이고 서로 별개다**(착수 이슈 §6 ③ · 계획 결정 9). 등록 한 번이
 * 상신을 잇지 않고, 상신은 **등록이 끝난 뒤에만** 설 수 있다. 두 쓰기가 각자 확인 창·잠금·
 * 실패 배너를 갖는다 — 한 자리에 뭉치면 어느 쪽이 실패했는지 사용자가 가릴 수 없다.
 */
export const PoRegisterScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const sourceReceiptId = readSourceReceiptId(searchParams);
  const urlLineId = readSourceLineId(searchParams);

  const source = useSourceReceipt(sourceReceiptId);
  const sourceData = source.data;
  const sourceLines = sourceData?.lines ?? EMPTY_LINES;

  const suppliers = useSupplierOptions();
  const businessUnits = useBusinessUnitOptions();
  const plants = usePlantOptions();
  const items = useItemOptions();
  const uoms = useUomOptions();

  /**
   * 대상으로 확정된 줄.
   *
   * **한 줄이면 자동으로 확정되고, 여럿이면 고른 줄만 대상이다**(계획 결정 4).
   * 주소가 목록에 없는 줄을 가리키면 고르지 않은 것으로 본다 — 주소는 손으로 고쳐지는 자리라
   * 없는 줄을 승계하면 화면이 지어낸 값이 전표에 실린다.
   */
  const chosenLine = useMemo<SourceLineView | null>(() => {
    if (sourceLines.length === 1) return sourceLines[0] ?? null;

    return sourceLines.find((line) => line.inboundReceiptLineId === urlLineId) ?? null;
  }, [sourceLines, urlLineId]);

  const [header, setHeader] = useState<HeaderDraft>(headerSeed(null, null));
  const [lines, setLines] = useState<LineDraft[]>(EMPTY_DRAFTS);

  /** 만들어진 전표. `null`이면 아직 등록하지 않았거나 마지막 시도가 실패했다 */
  const [created, setCreated] = useState<CreatedPoView | null>(null);

  /**
   * 만들어진 전표의 **내부 번호**. 상신에만 쓰고 **그리지 않는다**(`omf-mes#44`).
   *
   * 표시 타입(`CreatedPoView`)에 담지 않고 여기 따로 드는 이유가 그것이다 — 그리는 값과 같은
   * 자루에 있으면 사람이 읽는 자리로 새는 경로가 먼저 생긴다.
   */
  const [purchaseOrderId, setPurchaseOrderId] = useState<number | null>(null);

  /** 친 상신 사유 글자 그대로. **판정과 조립은 `reason-draft.ts` 한 곳이 한다** */
  const [submitReason, setSubmitReason] = useState('');

  /**
   * **어느 전표를 결재에 올렸는가**. `null`이면 아직 아무것도 올리지 않았다.
   *
   * **불리언으로 들지 않는다**(리뷰 R-24). 이 화면은 나가는 중인 쓰기를 끊지 않으므로
   * (`resetIfIdle`) 대상을 바꾼 **뒤에** 202가 도착하는 길이 실재한다 — 그때 「올렸다」를
   * 깃발로만 들고 있으면 **올린 적 없는 전표 위에 「결재에 올렸습니다」**가 서고, 그 갈래에서는
   * 사유 칸과 버튼이 아예 서지 않아 정작 그 전표를 올릴 길이 사라진다.
   *
   * **판정은 읽는 자리에서 한다**(전례 `disposal-issue`의 매임 축과 같은 형태). 정리 effect가
   * 지워 주기를 기대할 수 없다 — 주소는 잠글 수 없고, 늦게 온 응답은 그 뒤에 도착한다.
   */
  const [submittedPurchaseOrderId, setSubmittedPurchaseOrderId] = useState<number | null>(null);

  /** 확인을 기다리는 조작. `null`이면 열린 창이 없다 */
  const [pending, setPending] = useState<PendingAction | null>(null);

  const chosenLineId = chosenLine?.inboundReceiptLineId ?? null;

  /**
   * 발주 정보를 승계로 세운다(수명 표 1행).
   *
   * **축은 넘어온 전표와 승계 원천 두 값이다.** 입하 상세가 같은 값을 다시 주더라도(재조회)
   * 축이 바뀌지 않아 친 사업부·발주일·입고 예정일이 남는다 — 응답 객체를 축으로 삼으면 그 자리가
   * 무너진다. 대상 **줄**을 바꾸는 것도 이 초안을 되돌리지 않는다(공급사·공장은 전표의 값이라
   * 줄과 무관하다).
   *
   * **전표 번호가 축에 함께 있다**(수명 표 7행). 빼면 **공급사·공장이 같은 다른 전표**로 옮겨
   * 갈 때 승계 원천 두 값이 그대로여서 축이 움직이지 않고, 앞 전표에서 치던 사업부·발주일이
   * 새 전표의 발주에 실린다 — 전례가 초안 축에 전표 식별자를 둔 이유와 같은 자리다.
   */
  const seedSupplierId = sourceData?.receipt.supplierId ?? null;
  const seedPlantId = sourceData?.receipt.plantId ?? null;

  /** 지금 세워야 할 승계 상태. **초안을 세울 때와 친 값을 견줄 때 같은 값을 쓴다.** */
  const seededHeader = headerSeed(seedSupplierId, seedPlantId);

  useEffect(() => {
    setHeader(headerSeed(seedSupplierId, seedPlantId));
  }, [sourceReceiptId, seedSupplierId, seedPlantId]);

  /**
   * 라인 1행을 승계로 세운다(수명 표 2·5행).
   *
   * **축은 고른 줄이다.** 하한 판정의 근거가 그 줄의 입하수량이라, 응답이 실제로 달라지면 초안도
   * 다시 서야 한다 — 낡은 하한으로 판정하면 서버가 막을 값을 화면이 통과시킨다.
   * `chosenLine`은 응답 배열에서 찾은 값이라 응답이 같으면 참조도 같다.
   */
  useEffect(() => {
    setLines(chosenLine === null ? EMPTY_DRAFTS : [createInheritedLineDraft(chosenLine)]);
  }, [chosenLine]);

  /**
   * 등록 — **이 화면에서 되돌릴 수 없는 쓰기**다.
   *
   * 성공하면 결과를 세우고 확인 창을 닫는다. **초안은 비우지 않는다** — 폼이 그 자리에서 잠기므로
   * (아래 `isFormLocked`) 남은 값이 다시 보내질 길이 없고, 사용자가 방금 무엇을 보냈는지 읽을 수
   * 있어야 한다.
   *
   * **내부 번호를 여기서 든다.** 응답이 표시 타입과 갈라 주므로(`PoDetailResult`) 그리는 값과
   * 섞이지 않은 채 상신에만 쓰인다 — 상신의 잠금 토큰을 얻을 상세 경로도 이 번호로 만든다.
   *
   * **상신 상태는 건드리지 않는다.** 등록에 성공한 시점에는 아직 아무것도 올라가지 않았고,
   * 사유 칸은 결과 구획이 세운 뒤 사용자가 채운다(착수 이슈 §6 ③).
   */
  const register = useCreatePurchaseOrder({
    onSuccess: (result) => {
      setCreated(result.created);
      setPurchaseOrderId(result.purchaseOrderId);
      setPending(null);
    },
  });

  /** 잠금 토큰을 확보하는 자리 — 상신 직전의 상세 조회다(계획 결정 10). */
  const fetchPoDetail = usePurchaseOrderDetailFetcher();

  /**
   * 상신 — **이 화면의 둘째 쓰기**다. 등록과 **별개 동작**이라 훅도 확인 창도 따로 선다.
   *
   * 성공하면 올라갔다는 사실만 적는다 — **진행 상태를 이 화면이 조회하지 않는다**(계획 결정 11).
   * 그 값은 결재함(W-CO-09)이 정본이고, 여기서 또 읽으면 두 화면이 서로 다른 시점의 값으로
   * 같은 요청을 말하게 된다.
   */
  /**
   * 지금 **나가고 있는 상신이 겨눈 전표**와 **화면이 지금 보고 있는 전표**.
   *
   * 늦게 도착한 성공을 어느 전표의 것으로 적을지, 그리고 그것이 **지금 보고 있는 전표의
   * 것인지**를 응답이 온 시점에 알아야 한다 — 둘 다 그 시점에는 렌더 클로저의 값이 낡아 있다.
   */
  const submittingPurchaseOrderIdRef = useRef<number | null>(null);
  const currentPurchaseOrderIdRef = useRef<number | null>(null);

  currentPurchaseOrderIdRef.current = purchaseOrderId;

  const submit = useRequestApproval({
    purchaseOrderId,
    onSuccess: () => {
      /* **그 호출이 겨눈 번호**로 적는다 — 지금 보고 있는 전표가 아니라. */
      const submittedId = submittingPurchaseOrderIdRef.current;

      setSubmittedPurchaseOrderId(submittedId);

      /*
       * **늦게 온 성공은 적기만 한다.** 사유를 비우거나 창을 닫는 것은 지금 보고 있는 전표의
       * 조작이라, 남의 전표의 응답이 그것을 건드리면 새 대상에서 치던 사유가 사라진다.
       */
      if (submittedId !== currentPurchaseOrderIdRef.current) return;

      setSubmitReason('');
      setPending(null);
    },
  });

  /**
   * 상세 조회와 상신 사이의 **틈을 막는 깃발**.
   *
   * 확인 창의 실행을 누르면 상세 GET이 먼저 나가는데, 그 응답이 오기 전까지 쓰기 훅은 아직
   * 나가는 중이 아니다(`isSaving === false`) — 그 틈에 한 번 더 누르면 **연쇄가 두 벌** 돈다.
   * 공통 훅이 호출마다 새 멱등 키를 만들므로 그것이 그대로 결재 요청 두 건이 된다.
   */
  const [isSubmitStarting, setSubmitStarting] = useState(false);

  const isSubmitting = isSubmitStarting || submit.isSaving;

  /**
   * **나가는 중인 쓰기는 건드리지 않는다**(사본 체크리스트 4번 · `omf-mes#96`).
   *
   * 공통 훅의 `reset()`은 진행 중 mutation에서 옵저버를 떼어 낸다 — 떼어 내면 그 호출에 매달린
   * 되먹임이 통째로 오지 않는다(성공도 실패도 잠금 해제도). 요청은 이미 서버에 갔는데 화면만
   * 없던 일로 친다. `reset()`을 부르는 자리는 전부 이 함수를 지난다.
   */
  const resetIfIdle = (write: { isSaving: boolean; reset: () => void }): void => {
    if (write.isSaving) return;

    write.reset();
  };

  /**
   * **폼이 잠기는 두 사정**(계획 결정 12·16).
   *
   * ① 나가는 중 — 연타가 그대로 전표 두 벌이 된다(호출마다 새 멱등 키).
   * ② 이미 등록했다 — 되돌릴 경로가 없어 두 번째 전표를 지울 수 없다.
   *
   * 두 사정이 **같은 잠금을 쓴다.** 조작 자리마다 다른 조건을 쓰면 한 자리가 열린 채로 남고,
   * 이 화면에서 열린 자리 하나는 전표 한 벌이다.
   */
  const isFormLocked = register.isSaving || created !== null;

  /** 잠긴 사유. **잠갔으면 반드시 함께 선다** — 사유 없는 잠금은 죽은 버튼과 구분되지 않는다 */
  const formLockReason = (): string | undefined => {
    if (created !== null) return t.actionReasons.alreadyRegistered;
    if (register.isSaving) return t.actionReasons.saving;

    return undefined;
  };

  /*
   * 대상 전표가 바뀌면 **등록 결과와 열린 창을 함께 거둔다**(수명 표 7행).
   *
   * 남겨 두면 만들어진 전표를 보이는 구획이 **다른 초과분** 위에 서고, 앞 시도의 실패 배너가
   * 새 대상의 사유처럼 읽힌다. **나가는 중인 쓰기는 끊지 않는다**(`resetIfIdle`).
   *
   * **최신 함수를 ref로 갈아 끼운다**(전례와 같은 형태). 초안·응답·`reset` 참조를 의존성에 넣으면
   * 한 글자 칠 때마다 배너가 지워지거나(너무 지움) 아예 보이지 않는다(늘 지움).
   */
  const collectOnTargetChangeRef = useRef((): void => {
    /* 자리를 미리 만든다 — 아래에서 매 렌더 최신 함수로 갈아 끼운다. */
  });

  collectOnTargetChangeRef.current = (): void => {
    setCreated(null);
    setPending(null);
    resetIfIdle(register);

    /*
     * **상신 자리도 함께 거둔다.** 남겨 두면 앞 초과분에 붙일 사유가 다른 발주의 결재에
     * 올라가고, 「올렸습니다」가 아직 만들지도 않은 전표 위에 선다.
     */
    setPurchaseOrderId(null);
    setSubmitReason('');
    setSubmittedPurchaseOrderId(null);
    resetIfIdle(submit);
  };

  useEffect(() => {
    collectOnTargetChangeRef.current();
  }, [sourceReceiptId]);

  /**
   * 대상을 고른다. **주소를 `replace`로 갱신한다**(사본 체크리스트 1번) —
   * 고를 때마다 히스토리가 쌓이면 뒤로가기가 앞선 선택으로 되돌아가 초안이 말없이 다시 세워진다.
   */
  const chooseLine = (inboundReceiptLineId: number): void => {
    setSearchParams(withSourceLineId(searchParams, inboundReceiptLineId), { replace: true });
  };

  /**
   * 머리 입력을 고친다.
   *
   * **고친 칸의 서버 오류를 함께 지운다**(부 사본과 같은 형태 · `useMasterWrite`가 이 목적으로
   * `clearFieldError`를 내놓는다). 화면이 잡은 오류는 상태가 아니라 파생이라(`validateHeader`)
   * 값이 채워지면 저절로 사라지지만, **서버가 준 오류는 다음 저장까지 남는다** — 지우지 않으면
   * 400을 받은 칸을 유효한 값으로 고치는 순간 로컬 오류만 걷히고 **방금 고친 칸에 서버 문구와
   * `aria-invalid`가 되살아난다.**
   */
  const changeHeader = (patch: Partial<HeaderDraft>): void => {
    setHeader((prev) => ({ ...prev, ...patch }));

    for (const field of Object.keys(patch)) register.clearFieldError(field);
  };

  const patchLine = (key: string, patch: Partial<Omit<LineDraft, 'key'>>): void => {
    setLines((prev) => patchLineDraft(prev, key, patch));
  };

  const removeLine = (key: string): void => {
    setLines((prev) => removeLineDraft(prev, key));
  };

  const addLine = (): void => {
    setLines((prev) => addLineDraft(prev));
  };

  const lineValidation = validateLines(lines);
  const headerErrors = validateHeader(header);

  /**
   * 등록이 막힌 사유. `null`이면 **열려 있다.**
   *
   * **순서가 뜻을 정한다** — 먼저 풀어야 하는 것부터 말한다. 앞의 사정이 남아 있는데 뒤의 사정을
   * 말하면 사용자가 풀 수 없는 조치를 시도한다.
   *
   * **잠금 둘이 맨 앞이다.** 이미 등록했거나 나가는 중이면 폼의 어느 값을 고쳐도 이 버튼은
   * 열리지 않는다 — 그 사정을 뒤에 두면 「필수를 채우세요」를 읽고 채웠는데도 잠긴 버튼을 본다.
   */
  const registerBlockReason = (): string | null => {
    if (created !== null) return t.actionReasons.alreadyRegistered;
    if (register.isSaving) return t.actionReasons.saving;

    if (sourceReceiptId === null) return t.actionReasons.noContext;
    if (sourceData === undefined) return t.actionReasons.sourceNotLoaded;

    if (chosenLine === null) {
      /*
       * **고를 줄이 없는 갈래를 가른다.** 줄이 0행인 전표가 넘어오는 경로가 있고(대상 구획도
       * 그 빈 상태를 그린다), 그때 「줄을 하나 고르세요」로 말하면 할 수 없는 조치를 지시한다.
       */
      return sourceData.lines.length === 0
        ? t.actionReasons.noSourceLines
        : t.actionReasons.sourceLineNotChosen;
    }

    /* **잘못 친 값이 아직 안 친 칸보다 먼저다** — 지금 고칠 수 있는 것을 먼저 말한다. */
    if (Object.keys(lineValidation.errors).length > 0) return t.actionReasons.lineInvalid;
    if (Object.keys(headerErrors).length > 0) return t.actionReasons.headerIncomplete;

    return null;
  };

  const registerReasonId = useId();
  const cancelReasonId = useId();

  /**
   * 버릴 것이 있는가 — **머리와 라인을 함께 본다.** 한쪽만 보면 나머지가 확인 없이 사라진다.
   *
   * 승계 상태와 **값으로 견준다**(깃발이 아니다). 쳤다가 되돌린 사용자에게 「버릴 것이 있다」로
   * 말하면 아무것도 잃지 않는 조작에 확인을 받는 창이 된다.
   */
  const hasDraftInput =
    isHeaderEdited(header, seededHeader) || !areLinesInherited(lines, chosenLine);

  /** 취소가 막힌 사유. `null`이면 되돌릴 값이 있다. */
  const cancelBlockReason = (): string | null => {
    if (created !== null) return t.actionReasons.alreadyRegistered;
    if (register.isSaving) return t.actionReasons.saving;

    return hasDraftInput ? null : t.actionReasons.nothingToDiscard;
  };

  /** 두 사유를 렌더 한 번에 한 번만 판정한다 — 같은 판정을 자리마다 되부르면 갈릴 여지가 생긴다. */
  const registerReason = registerBlockReason();
  const cancelReason = cancelBlockReason();

  /**
   * 확인 창이 되보일 요약. **화면이 이미 만든 글자를 넘긴다** — 창이 다시 셈하거나 이름을 다시
   * 풀면 「사용자가 확인한 것」과 「요청에 실리는 것」이 갈린다.
   */
  const registerSummary = (): RegisterSummary => {
    const qty = summarizeOrderedQty(lines);

    return {
      supplier: describeReference(
        toReference(suppliers, header.supplierId === '' ? null : Number(header.supplierId)),
      ),
      orderDate: header.orderDate,
      lineCount: lines.length,
      totalQtyText: qty.total === null ? t.dialog.totalUnreadable : String(qty.total),
      hasMixedUom: qty.hasMixedUom,
    };
  };

  /**
   * 상신 확인 창이 되보일 요약. **화면이 이미 들고 있는 글자를 넘긴다** — 창이 사유를 다시
   * 다듬거나 첫 줄을 다시 뽑으면 「사용자가 확인한 것」과 「요청에 실리는 것」이 갈린다.
   */
  const submitSummary = (createdPo: CreatedPoView): SubmitSummary => {
    const state = readReason(submitReason);

    return {
      purchaseOrderNo: createdPo.purchaseOrderNo,
      /* 창은 보낼 수 있을 때만 열린다(버튼 잠금) — 그래도 갈래를 지어내지 않고 빈 글자로 둔다. */
      reason: state.kind === 'ready' ? state.reason : '',
      reasonFirstLine: state.kind === 'ready' ? state.firstLine : '',
    };
  };

  /**
   * 저장 실패 표시 — 배너와 **응답 없음 안내**를 함께 낸다(완료 조건 C25).
   *
   * 멱등 3층 완화의 셋째 층이다. 첫째가 확인 창, 둘째가 전송 중·성공 후 잠금, 셋째가 이것 —
   * **응답이 오지 않은 요청은 「실패」가 아니라는 사실**을 말한다. 훅이 호출마다 새 멱등 키를
   * 만들어, 그대로 다시 보내면 서버에는 다른 요청으로 보인다.
   *
   * **네트워크 갈래에만 붙는다.** 서버가 거절한 요청은 전달된 것이 확실하다.
   *
   * **「최신 불러오기」를 낼 자리가 아니다.** 등록에는 저장 충돌이 없다(계약에 `If-Match`도 409도
   * 없다) — 잠글 대상이 없는 쓰기에 재조회 수단을 내면 입력만 버리게 된다.
   */
  const failureSlot = (): ReactNode => (
    <>
      <SaveErrorBanner error={register.error} />
      {register.error?.kind === 'network' && (
        <p className="field-note">{t.notes.networkUnconfirmed}</p>
      )}
    </>
  );

  /**
   * 409의 「최신 불러오기」 — **낡은 것은 이 발주의 잠금 토큰이다.**
   *
   * 거부는 삼키지 않고 받아 둔다. 실패해도 막다른 길이 아니다 — 「승인 요청」을 다시 누르는
   * 길이 **같은 조회를 다시 지나므로**, 그때 못 얻으면 「최신 정보를 불러오는 중입니다」가 선다.
   */
  const reloadPoDetail = (): void => {
    if (purchaseOrderId === null) return;

    void fetchPoDetail(purchaseOrderId).catch(() => undefined);
  };

  /**
   * 상신 실패 표시 — **409에는 「최신 불러오기」를 함께 낸다**(완료 조건 C31).
   *
   * 등록과 달리 이 쓰기에는 **잠글 대상이 있다**(계약이 `If-Match`를 필수로 두고 409를 낸다) —
   * 그래서 재조회 수단을 내는 것이 맞고, 실제로 다시 읽으면 풀린다.
   *
   * **친 사유는 이 재조회로 사라지지 않는다.** 다시 읽는 것이 발주 상세 하나뿐이라 공통 배너의
   * 안내(「입력한 내용은 사라집니다」)보다 잃는 것이 적다 — 그 문구는 폼을 통째로 다시 세우는
   * 화면들이 함께 쓰는 것이라 여기서 고치지 않는다(공용 패턴 · 이 화면의 범위 밖).
   */
  const submitFailureSlot = (): ReactNode => (
    <SaveErrorBanner error={submit.error} onReload={reloadPoDetail} />
  );

  /**
   * 지금 상신이 어디까지 갔는가. **결과 구획이 그리는 갈래를 한 자리에서 정한다** —
   * 자리마다 따로 판정하면 배너와 버튼이 서로 다른 갈래를 말한다.
   */
  const submitPhase = (): SubmitPhase => {
    /*
     * **어느 전표를 올렸는지 묻는다**(리뷰 R-24). 「올렸다」를 깃발로만 보면 대상을 바꾼 뒤
     * 도착한 성공이 **올린 적 없는 전표 위에** 성공 갈래를 세운다 — 되돌릴 수 없는 조작에 대한
     * 거짓 진술이고, 그 갈래에서는 사유 칸도 버튼도 서지 않아 올릴 길까지 사라진다.
     */
    if (submittedPurchaseOrderId !== null && submittedPurchaseOrderId === purchaseOrderId) {
      return 'submitted';
    }

    if (isSubmitting) return 'submitting';

    /*
     * **인라인으로 소화된 실패도 실패다.** 400의 사유 오류는 배너가 아니라 칸에 붙으므로
     * (`fieldErrors`) 배너만 보면 「아직 아무 일도 없었다」로 읽힌다 — 그러면 상신이 한 번
     * 튕긴 사실이 화면 어디에도 남지 않는다.
     */
    const hasFailed = submit.error !== null || Object.keys(submit.fieldErrors).length > 0;

    return hasFailed ? 'failed' : 'idle';
  };

  /**
   * 상신이 막힌 사유. `null`이면 **열려 있다.**
   *
   * **나가는 중이 맨 앞이다** — 사유를 아무리 고쳐도 그동안은 열리지 않는다. 「이미 올렸다」는
   * 갈래를 두지 않는다: 올라간 뒤에는 결과 구획이 이 버튼을 **아예 세우지 않고**(칠 수 있는데
   * 보낼 수 없는 칸을 남기지 않는다) 결재함 안내가 그 자리를 대신한다.
   */
  const submitBlockReason = (): string | null => {
    if (isSubmitting) return t.actionReasons.submitting;
    if (readReason(submitReason).kind === 'empty') return t.actionReasons.reasonRequired;

    return null;
  };

  /** 등록을 **요청한다** — 보내는 것은 확인 창을 지난 뒤다. */
  const requestRegister = (): void => {
    setPending('register');
  };

  /**
   * 확인을 받고 **실제로 보낸다.**
   *
   * **창을 닫지 않고 보낸다**(완료 조건 C25). 실패했을 때 창이 닫히면 무엇이 막았는지 모른 채
   * 같은 버튼을 다시 누른다 — 배너는 창 안에 서고, 창은 성공했을 때만 닫힌다.
   *
   * 본문을 만들 수 없으면 **보내지 않고 창을 닫는다.** 버튼 잠금이 이미 막은 길이라 도달하지
   * 않지만, 도달했다면 폼으로 되돌려 보내는 것이 맞다 — 그 자리에 잠긴 사유가 서 있다.
   */
  const confirmRegister = (): void => {
    const body = toPurchaseOrderCreate({
      source:
        chosenLine === null ? null : { inboundReceiptLineId: chosenLine.inboundReceiptLineId },
      header,
      lines,
    });

    if (body === null) {
      setPending(null);

      return;
    }

    register.write(body);
  };

  /**
   * 상신을 **요청한다** — 보내는 것은 확인 창을 지난 뒤다. 등록과 같은 층 구조다.
   */
  const requestSubmit = (): void => {
    setPending('submit');
  };

  /**
   * 확인을 받고 **실제로 올린다** — 요청이 **둘**이다.
   *
   * ① 발주 상세를 부른다(잠금 토큰이 그 경로에서만 나온다 · 계획 결정 10)
   * ② 사유 한 칸을 실어 상신한다
   *
   * **창을 닫지 않고 보낸다** — 실패했을 때 창이 닫히면 무엇이 막았는지 모른 채 같은 버튼을
   * 다시 누른다. 창은 성공했을 때만 닫힌다.
   *
   * **상세 조회가 실패해도 갈래를 새로 만들지 않는다.** 토큰을 못 얻은 채 상신하면 공통 훅이
   * 요청을 만들지 않고 「최신 정보를 불러오는 중입니다」를 세운다 — 그 자리가 이미 있다.
   *
   * **매번 다시 부른다.** 조회 훅이 신선도를 무시하도록 두었으므로(`staleTime: 0`) 409를 받은
   * 뒤 다시 누르면 실제로 새 토큰으로 나간다 — 그것이 이 화면에서 충돌이 풀리는 길이다.
   */
  const confirmSubmit = (): void => {
    const body = toApprovalRequest(submitReason);

    if (body === null || purchaseOrderId === null) {
      setPending(null);

      return;
    }

    setSubmitStarting(true);
    /* 이 호출이 겨눈 전표를 적어 둔다 — 응답이 늦게 오면 그때의 화면은 다른 전표를 볼 수 있다. */
    submittingPurchaseOrderIdRef.current = purchaseOrderId;

    void fetchPoDetail(purchaseOrderId)
      .catch(() => undefined)
      .finally(() => {
        setSubmitStarting(false);
        submit.write(body);
      });
  };

  /**
   * 친 값을 버리고 **승계 상태로 되세운다**(수명 표 9행).
   *
   * 앞 시도의 실패 배너도 함께 거둔다 — 남겨 두면 방금 되돌린 값 때문에 막힌 것처럼 읽힌다.
   */
  const confirmDiscard = (): void => {
    setHeader(headerSeed(seedSupplierId, seedPlantId));
    setLines(chosenLine === null ? EMPTY_DRAFTS : [createInheritedLineDraft(chosenLine)]);
    resetIfIdle(register);
    setPending(null);
  };

  /**
   * 참조 실패의 복구 — **이 화면의 복구 자리는 한 곳이고 다섯을 함께 되살린다.**
   *
   * 그러려면 복구 버튼이 서는 조건도 다섯이어야 한다(`SourceReceiptPane`이 다섯을 받는 이유).
   * 사업부는 이 구획에 이름이 보이지 않지만 **승계 원천이 없는 유일한 필수 값**이라, 그 실패에
   * 복구 수단이 없으면 선택지가 빈 채로 등록이 영구 잠긴다.
   */
  const retryReferences = (): void => {
    suppliers.refetch();
    businessUnits.refetch();
    plants.refetch();
    items.refetch();
    uoms.refetch();
  };

  const sourcePaneContent = () => {
    if (sourceReceiptId === null) {
      return (
        <EmptyState
          size="sm"
          title={t.empty.noContextTitle}
          description={t.empty.noContextDescription}
        />
      );
    }

    /* 실패는 위 배너가 말한다 — 여기서 빈 상태로 내면 자료가 없는 것으로 읽힌다. */
    if (source.isError) return null;

    if (sourceData === undefined) {
      return (
        <div role="status" aria-label={t.loading.sourceReceipt}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <SourceReceiptPane
        receipt={sourceData.receipt}
        lines={sourceData.lines}
        chosenLineId={chosenLineId}
        supplierLookup={suppliers}
        businessUnitLookup={businessUnits}
        plantLookup={plants}
        itemLookup={items}
        uomLookup={uoms}
        /*
         * **대상을 바꾸는 길도 잠금 안에 있다.** 나가는 중에 바뀌면 도착한 결과가 다른 맥락에
         * 놓이고, 이미 등록한 뒤에 바뀌면 만들어진 전표를 보이는 화면이 다른 초과분을 가리킨다.
         */
        isLocked={isFormLocked}
        lockedReason={formLockReason()}
        onChoose={chooseLine}
        onRetryReferences={retryReferences}
      />
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {/* 범위 안내는 **늘 선다** — 맥락 유무로 접히면 정작 잘못 들어온 사람이 읽지 못한다. */}
      <ScopeBanner />

      {source.isError && (
        <LoadErrorBanner
          error={source.error}
          onRetry={() => {
            void source.refetch();
          }}
        />
      )}

      <section className="pane" aria-label={t.panes.source}>
        {sourcePaneContent()}
      </section>

      {sourceData !== undefined && (
        <section className="pane" aria-label={t.panes.header}>
          <HeaderForm
            values={header}
            supplierOptions={toSelectOptions(suppliers)}
            businessUnitOptions={toSelectOptions(businessUnits)}
            plantOptions={toSelectOptions(plants)}
            supplierNote={lookupNote(suppliers)}
            businessUnitNote={lookupNote(businessUnits)}
            plantNote={lookupNote(plants)}
            /*
             * **빈 필수 칸의 오류가 곧바로 선다**(완료 조건 C12).
             *
             * 이 화면은 필수가 비면 **등록 버튼이 잠긴다** — 그래서 「누른 뒤에 보인다」 규율을
             * 쓸 수 없다(누를 수 없으므로 영영 보이지 않는다). 잠금 사유는 「필수 항목을 채우세요」
             * 라고만 말하므로, 어느 칸인지 함께 보이지 않으면 사용자가 다섯 칸을 훑어야 한다.
             *
             * **빈 칸에서는 로컬 판정이 서버 오류를 덮는다** — 지금 고칠 수 있는 것을 먼저
             * 보인다. 칸이 채워지면 로컬 오류가 사라지므로 그때 남는 것은 서버 오류인데,
             * 그 자리를 `changeHeader`의 `clearFieldError`가 맡는다(고친 칸의 옛 오류를 지운다).
             */
            fieldErrors={{ ...register.fieldErrors, ...headerErrors }}
            supplierWarning={
              supplierChangeWarning(header, sourceData.receipt.supplierId) ?? undefined
            }
            isLocked={isFormLocked}
            onChange={changeHeader}
          />
        </section>
      )}

      {sourceData !== undefined && (
        <section className="pane" aria-label={t.panes.lines}>
          {chosenLine === null ? (
            /*
             * **줄이 0행이면 다른 말을 한다.** 「줄을 하나 고르세요」는 고를 것이 있을 때만 참이다 —
             * 등록 사유와 같은 갈래를 여기서도 가른다.
             */
            <EmptyState
              size="sm"
              title={
                sourceData.lines.length === 0 ? t.empty.noSourceLinesTitle : t.empty.noTargetTitle
              }
              description={
                sourceData.lines.length === 0
                  ? t.empty.noSourceLinesDescription
                  : t.empty.noTargetDescription
              }
            />
          ) : (
            <>
              <LineTable
                rows={lines}
                errors={lineValidation.errors}
                warnings={lineValidation.warnings}
                itemLookup={items}
                uomLookup={uoms}
                itemOptions={toSelectOptions(items)}
                uomOptions={toSelectOptions(uoms)}
                isLocked={isFormLocked}
                onPatch={patchLine}
                onRemove={removeLine}
              />

              <p className="field-note">{t.notes.lineNoAssignedByServer}</p>

              <div className="filter-bar">
                <div className="field-cell">
                  <Button variant="outlined" disabled={isFormLocked} onClick={addLine}>
                    {t.actions.addLine}
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/*
       * 잠긴 사유는 감추지 않고 항상 보이는 DOM 텍스트로 렌더해 `aria-describedby`로 잇는다 —
       * 잠긴 컨트롤은 포커스를 받지 못해 툴팁만으로는 키보드·스크린리더 사용자가 닿을 수 없다
       * (배치 규범 4). **열려 있으면 사유를 그리지 않는다** — 늘 서 있으면 읽히지 않는다.
       */}
      <div className="form-actions">
        <div className="field-cell">
          <Button
            variant="outlined"
            disabled={registerReason !== null}
            aria-describedby={registerReason === null ? undefined : registerReasonId}
            onClick={requestRegister}
          >
            {t.actions.register}
          </Button>
          {registerReason !== null && (
            <span id={registerReasonId} className="field-note">
              {registerReason}
            </span>
          )}
        </div>

        <div className="field-cell">
          {/*
           * 취소는 **보내기 전 복귀**다 — 서버를 부르지 않는다. 만들어진 전표를 되돌리는 수단이
           * 아니고(그것은 승인을 탄다), 되돌릴 입력이 없으면 잠긴 채 그 사실을 말한다.
           */}
          <Button
            variant="text"
            disabled={cancelReason !== null}
            aria-describedby={cancelReason === null ? undefined : cancelReasonId}
            onClick={() => {
              setPending('discard');
            }}
          >
            {t.actions.cancel}
          </Button>
          {cancelReason !== null && (
            <span id={cancelReasonId} className="field-note">
              {cancelReason}
            </span>
          )}
        </div>
      </div>

      {/*
       * 저장 실패는 **한 자리에만** 선다 — 확인 창이 열려 있으면 창 안이고, 닫혀 있으면 여기다.
       * 두 자리에 두면 사용자가 스크림 뒤의 사본을 읽으려 든다.
       */}
      {pending !== 'register' && failureSlot()}

      {/*
       * **결과 구획이 상신의 자리다**(계획 결정 9). 등록에 성공해야 이 구획이 서므로 「승인
       * 요청」도 그때 처음 존재한다 — 등록 전에 잠긴 버튼을 세워 두지 않는다.
       *
       * 상신 실패 배너도 **한 자리에만** 선다 — 확인 창이 열려 있으면 창 안이고, 닫혀 있으면
       * 여기다.
       */}
      {created !== null && (
        <ResultPane
          created={created}
          phase={submitPhase()}
          reason={submitReason}
          reasonError={submit.fieldErrors.reason}
          blockReason={submitBlockReason()}
          banner={pending === 'submit' ? null : submitFailureSlot()}
          onChangeReason={(value) => {
            setSubmitReason(value);
            submit.clearFieldError('reason');
          }}
          onRequestSubmit={requestSubmit}
        />
      )}

      {pending === 'register' && (
        <RegisterConfirmDialog
          summary={registerSummary()}
          isSaving={register.isSaving}
          banner={failureSlot()}
          onConfirm={confirmRegister}
          /*
           * Escape로 닫히는 길은 디자인 시스템이 막을 수단을 주지 않는다. 그래서 이 창의 규율은
           * 「닫히지 않게」가 아니라 **「닫혀도 나가는 요청이 무너지지 않게」**다 — 여기서 쓰기를
           * 되돌리지 않으므로(`reset` 없음) 응답은 그대로 도착해 결과 구획이 선다.
           */
          onClose={() => {
            setPending(null);
          }}
        />
      )}

      {pending === 'submit' && created !== null && (
        <SubmitConfirmDialog
          summary={submitSummary(created)}
          isSaving={isSubmitting}
          banner={submitFailureSlot()}
          onConfirm={confirmSubmit}
          /*
           * 등록 확인 창과 같은 규율이다 — Escape로 닫혀도 **나가는 요청을 되돌리지 않는다**
           * (`reset` 없음). 응답은 그대로 도착해 결과 구획의 갈래를 올린다.
           */
          onClose={() => {
            setPending(null);
          }}
        />
      )}

      {pending === 'discard' && (
        <DiscardConfirmDialog
          onConfirm={confirmDiscard}
          onClose={() => {
            setPending(null);
          }}
        />
      )}
    </>
  );
};
