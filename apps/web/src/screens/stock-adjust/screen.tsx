import {
  AlertBanner,
  Breadcrumb,
  Button,
  EmptyState,
  PageHeader,
  SkeletonText,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { SaveErrorBanner } from '../../patterns/master';
import { AdjustLineTable, type AdjustLineRow } from './adjust-line-table';
import { summarizeAdjustLines, toInventoryAdjustmentCreate } from './adjust-request';
import {
  APPROVED_APPROVAL_STATUS_CODES,
  REJECTION_DECISION_CODES,
  isApprovalJudgePending,
  readSubmission,
  toRequestProgressView,
} from './approval-progress';
import { ApprovalProgressPane, type ApprovalProgressState } from './approval-progress-pane';
import { toBookQty, type BookQtyState } from './balances';
import {
  isReasonCodeListPending,
  PLACEHOLDER_STOCK_ADJUST_CODES,
  toCodeOptionSets,
} from './code-options';
import { DiscardConfirmDialog } from './discard-confirm-dialog';
import { readInventoryCountId, withInventoryCountId, withoutInventoryCountId } from './entry';
import { HeaderForm } from './header-form';
import {
  addLineDraft,
  createInheritedLineDrafts,
  patchLineDraft,
  removeLineDraft,
} from './line-draft';
import { LoadErrorBanner } from './load-error-banner';
import {
  describeReference,
  lookupNote,
  toReference,
  toSelectOptions,
  useItemLookup,
  useLocationLookup,
  useLotLookup,
  useUomLookup,
  useWarehouseLookup,
} from './lookups';
import {
  UNASKED_BALANCE,
  useAdjustmentDetailFetcher,
  useApprovalRequest,
  useCountVarianceLines,
  useCreateStockAdjustment,
  useInventoryCounts,
  useLocationBalances,
  useRequestAdjustmentApproval,
} from './queries';
import { readReason, toApprovalRequest } from './reason-draft';
import { RegisterConfirmDialog, type RegisterSummary } from './register-confirm-dialog';
import { ResultPane, type SubmitPhase } from './result-pane';
import { applySourceChange, initialSourceKind, type AdjustSourceKind } from './source';
import { SourcePane } from './source-pane';
import { SubmitConfirmDialog, type SubmitSummary } from './submit-confirm-dialog';
import { emptyHeaderDraft, isHeaderEdited } from './types';
import type {
  AdjustHeaderDraft,
  AdjustLineDraft,
  CreatedAdjustmentResult,
  SelectOption,
} from './types';
import { excludedLineCount, validateLines } from './validation';

const t = messages.stockAdjust;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_IDS: number[] = [];

/** 확인을 기다리는 조작. `null`이면 열린 창이 없다. */
type PendingAction = 'register' | 'discard' | 'submit';

/**
 * 등록의 매임 — **어느 초안을 겨눈 시도인가**와 **그것이 만들어졌는가**(D-15).
 *
 * 둘을 한 자루에 두는 이유는 되먹임 셋(성공·나가는 중·실패)이 **같은 문**을 지나게 하기
 * 위해서다. 갈래마다 따로 매면 하나를 빠뜨리기 쉽고, 빠뜨린 갈래가 곧 「시도한 적 없는 초안
 * 위의 진술」이 된다.
 *
 * **축이 초안 세션이다.** 등록에는 아직 자원 번호가 없고(전표번호는 서버가 응답으로 준다),
 * 폼을 버리고 다시 열 수 있어 **두 초안을 가를 것이 이 번호뿐**이다.
 */
interface RegisterBinding {
  /** 그 시도가 겨눈 초안 세션. **지금 세우고 있는 초안과 견줄 값**이다 */
  draftSession: number;
  /** 서버가 만들어 준 전표(내부 번호 + 표시 타입). `null`이면 아직 응답이 오지 않았거나 실패했다 */
  created: CreatedAdjustmentResult | null;
}

/**
 * 상신의 매임 — **어느 전표를 겨눈 시도인가**와 **그것이 올라갔는가**(D-15).
 *
 * **축이 조정 번호다.** 등록과 달리 이 쓰기에는 자원 번호가 이미 있다 — 배경 재조회가 초안
 * 세션을 올리면 결과 구획이 걷히고 그 번호도 사라지므로(`boundRegister`), 나가는 중이던 상신의
 * 응답이 **남의 전표 위에 서는** 길이 실재한다.
 *
 * **되먹임 셋(성공·나가는 중·실패)이 전부 이 매임을 지난다** — 갈래마다 따로 매면 하나를
 * 빠뜨리고, 빠뜨린 갈래가 곧 「시도한 적 없는 전표 위의 진술」이 된다.
 */
interface SubmitBinding {
  /** 그 시도가 겨눈 전표. **지금 보고 있는 전표와 견줄 값**이다 */
  inventoryAdjustmentId: number;
  /** 그 전표의 업무 번호. **매임이 끊긴 채 성공했을 때 사람에게 말할 값**이다 */
  inventoryAdjustmentNo: string;
  /**
   * 202가 준 승인 요청 번호. `null`이면 아직 응답이 오지 않았거나 실패했다.
   *
   * **화면이 확인한 사실만 담는다** — 등록 응답에도 같은 이름의 값이 실려 오지만(목이 채워 준다)
   * 그것은 상신의 증거가 아니다(§5.2.5 · C36).
   */
  approvalRequestId: number | null;
}

/**
 * W-01-12 컨테이너 — **장부와 실물이 어긋난 것을 조정 전표로 만드는 화면**이다.
 *
 * 이 회차가 세우는 것은 **조정 대상**까지다. 등록·상신·전기와 처리 이력은 뒤따르는 회차가
 * 붙이고, 그동안 라우트는 닫혀 있다.
 *
 * ⭐ **잔량을 직접 고치지 않는다**(조심 ③ · D-5). 표는 「장부 · 실물 · 차이」 세 열로 서고
 * **입력칸은 차이 하나**다 — 실물은 `장부 + 차이`로 파생한다. 화면 맨 위의 범위 안내가 그
 * 사실을 상시 밝힌다.
 *
 * ⛔ **승인 대기 탭이 없다**(조심 ① · D-3). 승인·반려는 결재함(W-CO-09)이 소유하고, 이 화면은
 * 조정을 세워 올리는 쪽이다 — 상단 안내가 그 자리를 가리킨다.
 *
 * **되돌릴 수 없는 쓰기를 세 겹으로 막는다**(공통 훅이 호출마다 새 멱등 키를 만든다 — 실측).
 * ① 확인 창 ② 전송 중 잠금 ③ 성공 뒤 폼·대상 전환 잠금. 두 번 누르는 것이 그대로 전표 두 벌이
 * 되고, 이 화면에는 만들어진 조정을 되돌릴 경로가 없다.
 *
 * **무엇이 바뀔 때 무엇을 비우는가 — 수명 표.**
 *
 * | # | 조작 | `count` | 원천 갈래 | 대상 창고 | 조정 대상(줄) | 초안 세션 |
 * | :-: | --- | :-: | :-: | :-: | :-: | :-: |
 * | 1 | 맥락 있는 첫 진입 | 주소 | **실사** | 실사가 정한다 | 비어 있다 | 0 |
 * | 2 | 맥락 없는 첫 진입 | 없음 | **직접** | 비어 있다 | 비어 있다 | 0 |
 * | 3 | 원천 바꾸기 | 직접으로 가면 지운다 | 바뀐다 | 갈래가 정한다 | **버린다** | **올린다** |
 * | 4 | 대상 실사 바꾸기 | 바뀐다(`replace`) | 유지 | 실사가 정한다 | **버린다** | **올린다** |
 * | 5 | 실사 차이 불러오기 | 유지 | 유지 | 유지 | **다시 세운다** | **올린다** |
 * | 6 | 같은 값을 다시 받음(재조회) | 유지 | 유지 | 유지 | **건드리지 않는다** | 유지 |
 * | 7 | 대상 창고 바꾸기 | — | 유지 | 바뀐다 | **버린다** | **올린다** |
 * | 8 | 줄 더하기·고치기·지우기 | 유지 | 유지 | 유지 | 바뀐다 | 유지 |
 * | 9 | 참조·잔액 응답 도착 | 유지 | 유지 | 유지 | **건드리지 않는다** | 유지 |
 * | 10 | 주소가 없는 실사를 가리킴 | **지운다**(`replace`) | 유지 | — | 유지 | 유지 |
 * | 11 | **초안 버리기**(확인 뒤) | 유지 | 유지 | 유지 | **버린다** · 머리도 비운다 | **올린다** |
 * | 12 | **등록 성공** | 유지 | 유지 | 유지 | 값은 남고 **잠긴다** | 유지 |
 *
 * 6행이 이 화면의 되돌림 축 자리다. **조정 대상의 축은 「불러온 응답」이다** — 조회 캐시가
 * 구조를 공유해 같은 값이 다시 오면 참조도 같으므로, 재조회 한 번에 친 차이 수량이 말없이
 * 되돌아가지 않는다. 반대로 응답이 실제로 달라지면 대상도 다시 서야 한다 — 낡은 장부로
 * 실물을 파생하면 사용자가 확인하지 않은 수가 화면에 선다.
 *
 * **초안 세션**(D-15)은 대상을 버리고 다시 세울 때마다 올라간다. 초안 줄의 키가 그 값을 쓰고,
 * **등록의 매임**(`RegisterBinding`)이 같은 값을 축으로 쓴다 — 등록에는 아직 자원 번호가 없어
 * 초안 세션 말고는 두 초안을 가를 것이 없다.
 *
 * **되먹임 셋이 한 문을 지난다**(`boundRegister`) — 성공·나가는 중·실패가 전부 이 매임을
 * 지나므로, 갈래마다 따로 매다가 하나를 빠뜨리는 형태가 생기지 않는다. **판정은 읽는 자리에서
 * 한다**: 정리 effect가 지워 주기를 기대할 수 없다(늦게 온 응답은 그 뒤에 도착한다).
 *
 * **잠금은 매임을 지나지 않는다 — 일부러 그렇게 두었다.** 화면이 가르는 것은 둘이다.
 * **진술**(어느 초안에 대해 무엇을 말하는가)은 초안별로 참이어야 하므로 매임을 지나지만,
 * **조작 허용**은 어느 초안이든 나가는 중이면 막는 편이 안전하다 — 공통 훅은 mutation 하나를
 * 들므로 둘째 쓰기가 시작되면 **첫 쓰기의 옵저버가 떨어져** 성공도 실패도 오지 않는다.
 * 「보내는 중입니다」는 그때도 거짓말이 되지 않는다(어느 초안인지 주장하지 않는다).
 *
 * **대상을 버리는 길이 하나다**(`resetDraftForNewTarget`). 자리마다 따로 비우면 한 자리가
 * 빠지고, 그 자리가 곧 「앞 대상의 줄이 새 대상 위에 서는」 경로가 된다.
 */
export const StockAdjustScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlCountId = readInventoryCountId(searchParams);

  const counts = useInventoryCounts();
  const countList = counts.data;

  const [sourceKind, setSourceKind] = useState<AdjustSourceKind>(() =>
    initialSourceKind(urlCountId),
  );
  const [lines, setLines] = useState<AdjustLineDraft[]>([]);
  const [header, setHeader] = useState<AdjustHeaderDraft>(emptyHeaderDraft);
  const [warehouseDraft, setWarehouseDraft] = useState('');
  /** 실사 차이를 실제로 불러온 실사. `null`이면 아직 부르지 않았다 */
  const [loadedCountId, setLoadedCountId] = useState<number | null>(null);
  /** 주소가 가리킨 실사를 찾지 못해 지웠는가. **지운 뒤에는 판정이 사라지므로 사실을 든다** */
  const [hasCleanedMissingCount, setCleanedMissingCount] = useState(false);

  /**
   * **등록의 매임** — 어느 초안을 겨눈 시도이고 그것이 만들어졌는가.
   * `null`이면 이 화면에서 등록을 시도한 적이 없다.
   */
  const [registerBinding, setRegisterBinding] = useState<RegisterBinding | null>(null);

  /**
   * **도착한 시점에 이미 매임이 끊겨 있던 전표들**(리뷰 R-4).
   *
   * 초안을 버린 뒤 그 등록이 성공하면 서버에는 전표가 실제로 남는다 — 그 사실은 감추지 않되
   * 지금 초안의 결과로 세우지도 않는다(D-15). **매임과 다른 자리에 쌓는 것**이 요점이다:
   * 매임은 한 자리라 다음 등록이 성공하면 덮이고, 그 순간 앞 전표의 번호가 화면에서 사라진다.
   * 이 슬라이스에는 아직 그 번호를 되찾을 조회 자리가 없다(처리 이력은 뒤따르는 회차).
   *
   * ⚠ **선 뒤에 끊기는 갈래는 여기 쌓이지 않는다** — 그쪽은 읽는 자리의 파생(`strandedNos`)이
   * 잡는다. 두 시점을 한 자리로 합치려면 세션을 올리는 자리마다 옮겨 담아야 하는데, 그 열거가
   * 빠지는 것이 바로 이 화면이 한 번 겪은 사고다(리뷰 R-7).
   */
  const [strandedAdjustmentNos, setStrandedAdjustmentNos] = useState<string[]>([]);

  /** **상신의 매임.** `null`이면 이 화면에서 상신을 시도한 적이 없다. */
  const [submitBinding, setSubmitBinding] = useState<SubmitBinding | null>(null);

  /**
   * 친 상신 사유 — **어느 전표를 위해 쓴 글인가와 함께 든다**(리뷰 R-1 · D-15).
   *
   * ⭐ **판정을 읽는 자리에서 한다.** 앞선 형태는 사유를 홑값으로 들고 「대상을 버리는 한 문」이
   * 거두게 했는데, **초안 세션을 올리는 문이 둘**이다 — `resetDraftForNewTarget`(조작)과
   * `seedFromVarianceRef`(**effect** · 폼 잠금 밖에서 돈다). 뒤쪽으로 대상이 다시 서면 사유가
   * 거둬지지 않은 채 남고, 새로 등록한 전표의 사유 칸에 **앞 전표를 위해 쓴 문장**이 그대로
   * 서서 그것이 그 전표의 결재함 요약(A-12)으로 올라간다.
   *
   * 쓰는 자리를 빠짐없이 세는 대신 **읽을 때 대조한다** — 이 슬라이스가 매임과 끊긴 영수증에서
   * 이미 두 번 같은 결론에 이른 형태다(T2 R-7 · 이 회차 R-1).
   */
  const [submitReasonDraft, setSubmitReasonDraft] = useState<{
    /** 그 글을 쓴 대상. `null`이면 아직 아무 전표에도 매이지 않았다 */
    inventoryAdjustmentId: number | null;
    text: string;
  }>({ inventoryAdjustmentId: null, text: '' });

  /**
   * **매임이 끊긴 채 결재에 올라간 전표들.**
   *
   * 등록의 `strandedAdjustmentNos`와 같은 사정이다 — 그 상신은 실제로 일어나 서버에 결재 요청이
   * 남으므로 감추지 않되, 지금 보고 있는 대상의 결과로 세우지도 않는다(D-15).
   *
   * **매임과 다른 자리에 쌓는 것**이 요점이다: 매임은 한 자리라 **뒤이은 상신이 성공하면 덮이고**,
   * 그 순간 앞 요청의 사실이 화면에서 사라진다. 이 슬라이스에는 아직 그것을 되찾을 조회 자리가
   * 없다(처리 이력은 뒤따르는 회차).
   */
  const [strandedSubmittedNos, setStrandedSubmittedNos] = useState<string[]>([]);

  /** 확인을 기다리는 조작. `null`이면 열린 창이 없다 */
  const [pending, setPending] = useState<PendingAction | null>(null);

  /**
   * **초안 세션**(D-15) — 대상을 버리고 다시 세울 때마다 올라간다.
   *
   * **ref가 정본이고 상태는 그 사본이다.** 두 소비처의 시점이 다르기 때문이다:
   *
   * | 읽는 곳 | 언제 | 무엇이 필요한가 |
   * | --- | --- | --- |
   * | 초안 줄의 키 · 등록을 보내는 자리 | **그 순간** | 갱신이 커밋되기 전의 최신 값 — ref |
   * | 매임 대조(`boundRegister`) · 늦게 온 되먹임 | **렌더할 때 · 응답이 올 때** | 다시 그리게 하는 값 — 상태 |
   *
   * 상태만 두면 한 조작 안에서 연달아 세울 때 앞 갱신이 아직 커밋되지 않아 같은 번호를 두 번
   * 쓰고, ref만 두면 세션이 올라가도 화면이 다시 그려지지 않아 **앞 초안의 결과가 그대로 서 있다.**
   */
  const draftSessionRef = useRef(0);
  const [draftSession, setDraftSession] = useState(0);

  const startDraftSession = (): number => {
    const next = draftSessionRef.current + 1;

    draftSessionRef.current = next;
    setDraftSession(next);

    return next;
  };

  const warehouses = useWarehouseLookup();

  const chosenCount =
    countList?.counts.find((count) => count.inventoryCountId === urlCountId) ?? null;

  /**
   * 대상 창고 — **갈래마다 정하는 주체가 다르다.**
   *
   * 실사 갈래에서는 고른 실사가 정하고(그 실사가 센 창고다), 직접 등록 갈래에서는 사용자가
   * 고른다. 계약이 위치 조회에 창고를 필수로 요구하고 잔액 조회도 창고를 받으므로,
   * 이 값이 없으면 위치도 장부도 확인할 수 없다.
   */
  const warehouseId =
    sourceKind === 'count'
      ? (chosenCount?.warehouseId ?? null)
      : warehouseDraft === ''
        ? null
        : Number(warehouseDraft);

  const hasTarget = warehouseId !== null;

  const locations = useLocationLookup(warehouseId);
  const items = useItemLookup(hasTarget);
  const uoms = useUomLookup(hasTarget);

  const lineItemIds =
    lines.length === 0
      ? EMPTY_IDS
      : lines.flatMap((line) => (line.itemId === '' ? [] : [Number(line.itemId)]));

  const lots = useLotLookup(lineItemIds, hasTarget);

  /**
   * 장부 조회는 **직접 등록 갈래에만 있다**(D-6).
   *
   * 실사 갈래의 장부는 실사 라인이 이미 들고 왔다 — 여기서 또 부르면 같은 사실을 두 시점의
   * 값으로 말하게 되고, 둘이 갈리면 어느 쪽이 참인지 화면이 모른다.
   */
  const balanceLocationIds =
    sourceKind === 'direct' && lines.length > 0
      ? lines.flatMap((line) => (line.locationId === '' ? [] : [Number(line.locationId)]))
      : EMPTY_IDS;

  const balances = useLocationBalances(
    sourceKind === 'direct' ? warehouseId : null,
    balanceLocationIds,
  );

  const variance = useCountVarianceLines(loadedCountId);
  const varianceData = variance.data;

  /**
   * 주소가 **없는 실사**를 가리키면 지운다(사본 체크리스트 1번).
   *
   * **잘린 목록에서는 판정하지 않는다** — 못 본 것과 없는 것은 다르다. 목록이 앞쪽 일부만
   * 왔는데 「없다」로 판정하면 정상 실사를 가리킨 주소가 지워지고, 재고실사에서 넘어온 사용자가
   * 무엇을 조정하려 했는지 잃는다.
   *
   * **`replace`로 지운다.** 히스토리에 칸을 쌓으면 뒤로가기가 없는 실사 주소로 되돌아가
   * 같은 정리가 되풀이되고 사용자가 갇힌다.
   */
  const isUrlCountMissing =
    urlCountId !== null &&
    countList !== undefined &&
    !countList.truncated &&
    !countList.counts.some((count) => count.inventoryCountId === urlCountId);

  /* 정리 effect가 읽는 값은 **그 시점의 최신**이어야 한다 — 의존성에 넣으면 매 렌더 다시 돈다. */
  const cleanMissingCountRef = useRef((): void => {
    /* 자리를 미리 만든다 — 아래에서 매 렌더 최신 함수로 갈아 끼운다. */
  });

  cleanMissingCountRef.current = (): void => {
    setSearchParams(withoutInventoryCountId(searchParams), { replace: true });
    setCleanedMissingCount(true);
  };

  useEffect(() => {
    if (!isUrlCountMissing) return;

    cleanMissingCountRef.current();
  }, [isUrlCountMissing]);

  /** 주소가 실사를 가리키면 실사 갈래다 — 재고실사에서 넘어오는 길과 뒤로가기가 같은 자리다. */
  useEffect(() => {
    if (urlCountId === null) return;

    setSourceKind('count');
  }, [urlCountId]);

  /**
   * 불러온 실사 차이를 조정 대상으로 세운다(C2·C3).
   *
   * **축이 「불러온 응답」이다.** 조회 캐시가 구조를 공유해 같은 값이 다시 오면 참조도 같으므로
   * 재조회가 친 차이 수량을 되돌리지 않는다 — 응답이 실제로 달라졌을 때만 다시 선다.
   */
  const seedFromVarianceRef = useRef((): void => {
    /* 자리를 미리 만든다. */
  });

  seedFromVarianceRef.current = (): void => {
    if (varianceData === undefined) return;

    setLines(createInheritedLineDrafts(varianceData.lines, startDraftSession()));
  };

  useEffect(() => {
    seedFromVarianceRef.current();
  }, [varianceData]);

  /**
   * 지금 나가고 있는 등록이 **겨눈 초안**.
   *
   * 늦게 도착한 되먹임을 어느 초안의 것으로 적을지는 **응답이 온 시점**에 알아야 하는데,
   * 그때 렌더 클로저의 값은 낡아 있다.
   */
  const registeringSessionRef = useRef<number | null>(null);

  /**
   * 등록 — **이 화면에서 되돌릴 수 없는 첫 쓰기**다.
   *
   * 성공하면 **그 호출이 겨눈 초안 세션**으로 매임을 다시 세운다 — 지금 세우고 있는 초안이
   * 아니라. 그사이 초안을 버렸다면 이 결과는 남의 것이고, 지금 번호로 적으면 **시도한 적 없는
   * 초안 위에** 「만들었습니다」와 잠금이 선다.
   *
   * **초안은 비우지 않는다** — 폼이 그 자리에서 잠기므로(아래 `isFormLocked`) 남은 값이 다시
   * 보내질 길이 없고, 사용자가 방금 무엇을 보냈는지 읽을 수 있어야 한다.
   */
  const register = useCreateStockAdjustment({
    onSuccess: (created) => {
      /* **그 호출이 겨눈 초안**으로 적는다 — 지금 세우고 있는 초안이 아니라. */
      const session = registeringSessionRef.current;

      setRegisterBinding(session === null ? null : { draftSession: session, created });

      /*
       * **늦게 온 성공은 적기만 한다.** 창을 닫는 것은 지금 보고 있는 초안의 조작이라,
       * 남의 초안의 응답이 그것을 건드리면 새로 연 확인 창이 말없이 닫힌다.
       */
      if (session !== draftSessionRef.current) {
        /*
         * **도착한 시점에 이미 매임이 끊겨 있으면 쌓는다**(리뷰 R-4).
         *
         * 매임은 한 자리라 다음 등록이 성공하면 앞 전표의 사실이 덮여 사라지는데, 이 갈래를
         * 만든 이유가 「사용자가 모르는 전표가 서버에 남는다」였다 — 덮이면 그 사고가 그대로
         * 되돌아온다. 그래서 **매임과 다른 자리**에 쌓는다.
         *
         * ⚠ **이 적재가 전부는 아니다**(리뷰 R-7). 매임은 **선 뒤에도 끊길 수 있다** —
         * 초안 세션을 올리는 자리가 둘이고 그중 하나(`seedFromVarianceRef`)는 **조작이 아니라
         * effect**라 폼 잠금 밖에서 돈다(배경 재조회가 달라진 실사 차이를 물고 오는 길).
         * 그 갈래는 **읽는 자리의 파생**(`strandedNos`)이 잡는다 — 두 겹이다.
         */
        setStrandedAdjustmentNos((prev) => [...prev, created.created.inventoryAdjustmentNo]);

        return;
      }

      setPending(null);
    },
  });

  /**
   * **지금 세우는 초안이 그 등록의 대상인가** — 등록의 되먹임은 전부 이 문을 지난다(D-15).
   *
   * `null`이면 이 화면이 지금 초안에 대해 말할 등록이 없다: 시도한 적이 없거나, **나가는 중에
   * 초안을 버려 그 응답이 남의 것이 됐다.** 결과 구획·실패 배너·사유 칸의 서버 오류·폼 잠금의
   * 「이미 등록했다」 갈래가 모두 이 값을 본다 — 한 자리라도 빠지면 그 자리에서 남의 초안의
   * 사실이 샌다.
   */
  const boundRegister =
    registerBinding !== null && registerBinding.draftSession === draftSession
      ? registerBinding
      : null;

  /**
   * 상신이 겨눌 전표. **등록에 성공한 뒤에만 값이 있다.**
   *
   * 내부 번호라 **그리지 않는다**(`omf-mes#44`) — 경로 조각과 잠금 토큰의 열쇠(D-14)로만 쓴다.
   */
  const adjustmentId = boundRegister?.created?.inventoryAdjustmentId ?? null;

  /**
   * **이 전표를 위해 쓴 사유만 이 전표의 사유다**(리뷰 R-1).
   *
   * 다른 전표에 매인 글은 **빈 값으로 읽는다** — 그러면 잠금(`submitBlockReason`)·확인 창
   * (`submitSummary`)·본문(`toApprovalRequest`)이 **한 파생을 함께 지나** 셋이 동시에 옳아진다.
   * 자리마다 따로 판정하면 버튼은 열렸는데 본문은 비는 식으로 갈린다.
   */
  const submitReason =
    submitReasonDraft.inventoryAdjustmentId === adjustmentId ? submitReasonDraft.text : '';

  /**
   * 지금 나가고 있는 상신이 **겨눈 전표**와 **화면이 지금 보고 있는 전표**.
   *
   * 늦게 도착한 성공을 어느 전표의 것으로 적을지, 그리고 그것이 **지금 보고 있는 전표의
   * 것인지**를 응답이 온 시점에 알아야 한다 — 둘 다 그 시점에는 렌더 클로저의 값이 낡아 있다.
   */
  const submittingTargetRef = useRef<{
    inventoryAdjustmentId: number;
    inventoryAdjustmentNo: string;
  } | null>(null);
  const currentAdjustmentIdRef = useRef<number | null>(null);

  currentAdjustmentIdRef.current = adjustmentId;

  /** 상신 직전에 상세를 한 번 불러 **잠금 토큰을 상세 경로에 앉힌다**(D-14). */
  const fetchAdjustmentDetail = useAdjustmentDetailFetcher();

  /**
   * 상신 — **이 화면의 둘째 쓰기이고 등록과 별개 동작**이다.
   *
   * 성공하면 **그 호출이 겨눈 전표**로 매임을 다시 세운다 — 지금 보고 있는 전표가 아니라.
   * 그사이 배경 재조회가 초안 세션을 올렸다면 이 결과는 남의 것이고, 지금 번호로 적으면
   * **시도한 적 없는 전표 위에** 「올렸습니다」가 선다.
   */
  const submit = useRequestAdjustmentApproval({
    inventoryAdjustmentId: adjustmentId,
    onSuccess: (ref) => {
      /* **그 호출이 겨눈 전표**로 적는다 — 지금 보고 있는 전표가 아니라. */
      const target = submittingTargetRef.current;

      setSubmitBinding(
        target === null ? null : { ...target, approvalRequestId: ref.approvalRequestId },
      );

      /*
       * **늦게 온 성공은 적기만 한다.** 사유를 비우거나 창을 닫는 것은 지금 보고 있는 전표의
       * 조작이라, 남의 전표의 응답이 그것을 건드리면 새 대상에서 치던 값이 사라진다.
       */
      if (target === null || target.inventoryAdjustmentId !== currentAdjustmentIdRef.current) {
        /*
         * **도착한 시점에 이미 매임이 끊겨 있으면 쌓는다**(등록 갈래와 같은 규율).
         *
         * 매임은 한 자리라 뒤이은 상신이 성공하면 앞 요청의 사실이 덮여 사라지는데, 이 갈래를
         * 만든 이유가 「사용자가 모르는 결재 요청이 서버에 남는다」였다 — 덮이면 그 사고가
         * 그대로 되돌아온다. **선 뒤에 끊기는 갈래**는 읽는 자리의 파생이 잡는다(두 겹).
         */
        if (target !== null) {
          setStrandedSubmittedNos((prev) =>
            prev.includes(target.inventoryAdjustmentNo)
              ? prev
              : [...prev, target.inventoryAdjustmentNo],
          );
        }

        return;
      }

      /*
       * **사유를 여기서 비우지 않는다**(리뷰 R-5 — 죽은 줄이었다).
       *
       * 성공 뒤에는 매임이 서서 `phase === 'submitted'`가 되고 **사유 칸 자체가 렌더되지
       * 않는다**. 그 매임을 비우는 유일한 자리(`resetDraftForNewTarget`)가 사유도 함께 비우므로,
       * 여기서 한 번 더 비우는 것은 **어떤 렌더에서도 관측되지 않는다**(자유 뮤테이션 생존으로
       * 실증됐다). 죽은 통로를 남기면 다음 사람이 그것을 방어로 읽는다.
       *
       * ⚠ **올린 뒤에 사유 칸이 다시 서는 자리**(재상신 등)가 생기면 이 판정을 다시 본다 —
       * 그때는 앞 시도의 글자가 새 시도의 칸에 남는 경로가 열린다.
       */
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
   * 없던 일로 친다. **`reset()`을 부르는 자리는 전부 이 함수를 지난다.**
   */
  const resetIfIdle = (write: { isSaving: boolean; reset: () => void }): void => {
    if (write.isSaving) return;

    write.reset();
  };

  /**
   * 대상이 바뀌면 **세운 것을 거둔다** — 원천·대상 실사·대상 창고·초안 버리기 네 자리가
   * 이 한 문을 지난다.
   *
   * 자리마다 따로 비우면 한 자리가 빠지고, 그 자리가 곧 「앞 대상의 줄이 새 대상 위에 서는」
   * 경로가 된다.
   *
   * **머리는 여기서 비우지 않는다.** 조정 사유와 ERP 송신은 전표의 값이지 대상의 값이 아니다 —
   * 원천을 바꿨다고 고른 사유가 사라지면 사용자가 같은 값을 다시 고른다. 초안을 통째로 버리는
   * 자리(`confirmDiscard`)만 머리를 함께 비운다.
   */
  const resetDraftForNewTarget = (): void => {
    setLines(applySourceChange(lines).keptLines);
    setLoadedCountId(null);
    startDraftSession();

    /*
     * **앞 초안의 실패를 새 초안이 물려받지 않는다.** 나가는 중이면 되먹임을 끊지 않고 그대로
     * 두되(`resetIfIdle`), 그 응답은 매임(`boundRegister`)이 걸러 낸다 — 두 겹이다.
     */
    resetIfIdle(register);

    /*
     * **상신 자리도 같은 한 문에서 거둔다**(T2 인계 ③). 남겨 두면 「올렸습니다」가 아직
     * 만들지도 않은 전표 위에 선다.
     *
     * 매임을 비우는 것이 **나가는 중인 요청을 끊지는 않는다** — 그 응답은 도착해서 겨눈 번호로
     * 다시 매이고, 그때 대상이 달라져 있으면 「앞서 보낸 상신이 끝났습니다」로만 남는다.
     *
     * ⚠ **사유의 방어는 이 문에 기대지 않는다**(리뷰 R-1). 여기서 함께 비우는 것은 조작으로
     * 대상을 바꾼 사용자에게 빈 칸을 주기 위해서일 뿐이고, **이 문을 지나지 않는 길**(잠금 밖
     * effect)이 실재하므로 진짜 방어는 읽는 자리의 파생(`submitReason`)이 진다.
     */
    setSubmitBinding(null);
    setSubmitReasonDraft({ inventoryAdjustmentId: null, text: '' });
    resetIfIdle(submit);

    /*
     * **「없는 실사였다」 안내에 수명을 준다**(리뷰 R-4). 남겨 두면 유효한 실사를 고른 뒤에도
     * 「아래에서 실사를 고르세요」가 남아 **이미 한 조치를 계속 지시하고**, 직접 등록으로
     * 바꾸면 그 안내가 **실사 선택칸이 없는 구획**에 서서 화면에 없는 컨트롤을 쓰라고 말한다.
     */
    setCleanedMissingCount(false);
  };

  const changeSourceKind = (next: AdjustSourceKind): void => {
    if (next === sourceKind) return;

    resetDraftForNewTarget();
    setSourceKind(next);

    /* 직접 등록 갈래에는 대상 실사가 없다 — 주소에 남겨 두면 화면과 주소가 다른 말을 한다. */
    if (next === 'direct' && urlCountId !== null) {
      setSearchParams(withoutInventoryCountId(searchParams), { replace: true });
    }
  };

  const chooseCount = (value: string): void => {
    if (value === '') return;

    resetDraftForNewTarget();
    setSearchParams(withInventoryCountId(searchParams, Number(value)), { replace: true });
  };

  const chooseWarehouse = (value: string): void => {
    if (value === warehouseDraft) return;

    resetDraftForNewTarget();
    setWarehouseDraft(value);
  };

  /**
   * 실사 차이를 불러온다 — **대상을 다시 세우는 조작**이다.
   *
   * 이미 부른 실사를 다시 누르면 조회만 다시 한다. 응답이 같으면 대상은 그대로다
   * (수명 표 6행) — 같은 값으로 다시 세우면 친 차이 수량이 말없이 되돌아간다.
   */
  const loadVariance = (): void => {
    if (urlCountId === null) return;

    if (loadedCountId === urlCountId) {
      void variance.refetch();

      return;
    }

    setLoadedCountId(urlCountId);
  };

  const addLine = (): void => {
    setLines((prev) => addLineDraft(prev, draftSessionRef.current));
  };

  const patchLine = (key: string, patch: Partial<Omit<AdjustLineDraft, 'key'>>): void => {
    setLines((prev) => patchLineDraft(prev, key, patch));
  };

  const removeLine = (key: string): void => {
    setLines((prev) => removeLineDraft(prev, key));
  };

  const retryReferences = (): void => {
    locations.refetch();
    items.refetch();
    uoms.refetch();
    lots.refetch();
  };

  /** 창고만 되살린다 — 그 실패의 안내와 복구가 원천 구획에 함께 선다(리뷰 R-1). */
  const retryWarehouses = (): void => {
    warehouses.refetch();
  };

  /**
   * 장부를 다시 부른다 — **같은 위치를 다시 골라도 다시 나가지 않는다**(관측자가 그대로다).
   * 복구 수단이 없으면 사용자에게 남는 조치가 줄을 지웠다 다시 더하거나 새로고침뿐이다.
   */
  const retryBalances = (): void => {
    balances.refetch();
  };

  /**
   * 그 줄의 장부 — **갈래마다 출처가 다르다**(D-6).
   *
   * 실사에서 온 줄은 실사가 준 값을 그대로 쓰고, 더한 줄은 그 위치의 잔액에서 (품목·LOT)로
   * 찾는다. **못 찾은 것을 0으로 메우지 않는다.**
   */
  const bookQtyOf = (line: AdjustLineDraft): BookQtyState => {
    /*
     * **값의 유무 하나로 가른다.** 블라인드 실사는 장부를 내려보내지 않으므로(`types.ts`가
     * 그 자리에서 `null`로 받는다) 여기서 그 줄은 아래 「묻지 않음」 갈래로 안전하게 떨어진다 —
     * 「—」가 서고, 실물도 파생되지 않는다.
     */
    if (line.countSystemQty !== null) return { kind: 'known', qty: line.countSystemQty };

    const source =
      line.locationId === ''
        ? UNASKED_BALANCE
        : (balances.sources[Number(line.locationId)] ?? UNASKED_BALANCE);

    return toBookQty(
      source,
      line.itemId === '' ? null : Number(line.itemId),
      line.lotId === '' ? null : Number(line.lotId),
    );
  };

  const rows: AdjustLineRow[] = lines.map((draft) => ({ draft, bookQty: bookQtyOf(draft) }));

  const { errors } = validateLines(lines);
  const excludedCount = excludedLineCount(lines);
  const lineSummary = summarizeAdjustLines(lines);

  const countOptions: SelectOption[] =
    countList?.counts.map((count) => ({
      value: String(count.inventoryCountId),
      label: `${count.inventoryCountNo} · ${count.plannedDate}`,
    })) ?? [];

  /**
   * 값 목록이 확정되지 않은 코드(D-9).
   *
   * **컴포넌트 안에서 옮긴다** — 모듈 수준에 두면 값 목록이 채워지는 날 그 시점의 배열이
   * 얼어붙고, 이 화면이 「채우면 저절로 살아나는 자리」라는 사실이 깨진다.
   */
  const codeOptions = toCodeOptionSets(PLACEHOLDER_STOCK_ADJUST_CODES);
  const isReasonPending = isReasonCodeListPending(codeOptions);

  /**
   * **매임이 끊긴 채 만들어진 전표들** — 그 사실은 감추지 않는다.
   *
   * 그 등록은 실제로 일어났으므로 **감추지 않는다** — 감추면 사용자가 만들어진 줄 모르는
   * 전표가 남는다. 다만 지금 초안의 결과가 아니므로 결과 구획을 세우지도, 지금 폼을 잠그지도
   * 않는다(그것은 시도한 적 없는 초안 위의 진술이 된다) — **사실만 한 줄로 적는다.**
   *
   * **매임이 끊기는 시점이 둘이라 겹도 둘이다**(리뷰 R-4·R-7).
   *
   * | 시점 | 어떻게 생기나 | 무엇이 잡나 |
   * | --- | --- | --- |
   * | **도착할 때 이미 끊김** | 보내는 중에 초안을 버렸다 | `strandedAdjustmentNos` **적재** — 다음 등록이 매임을 덮어도 남는다 |
   * | **선 뒤에 끊김** | 초안 세션을 올리는 자리가 둘이고 그중 `seedFromVarianceRef`는 **조작이 아니라 effect**라 폼 잠금 밖에서 돈다(배경 재조회가 달라진 실사 차이를 물고 오는 길) | **이 파생** — 읽는 자리에서 매임을 다시 본다 |
   *
   * **판정은 읽는 자리에서 한다**(D-15의 규율 그대로). 쓰는 자리를 빠짐없이 세었다는 전제에
   * 기대면, 그 열거에서 빠진 자리가 곧 사실이 사라지는 경로가 된다 — 실제로 그렇게 빠졌다.
   *
   * **같은 번호를 두 번 적지 않는다** — 두 겹이 같은 전표를 가리키는 시점이 있다.
   *
   * ⚠ 실패는 이 갈래에서 말하지 않는다. 성공은 서버에 남는 것이 있어 알려야 하지만, 거절된
   * 요청은 남는 것이 없어 **버린 초안의 실패를 새 초안 위에서 말할 이유가 없다**(C28).
   */
  const unboundCreatedNo =
    registerBinding !== null && registerBinding.draftSession !== draftSession
      ? (registerBinding.created?.created.inventoryAdjustmentNo ?? null)
      : null;

  const strandedNos =
    unboundCreatedNo === null || strandedAdjustmentNos.includes(unboundCreatedNo)
      ? strandedAdjustmentNos
      : [...strandedAdjustmentNos, unboundCreatedNo];

  const strandedNote = strandedNos.length === 0 ? null : strandedNos.join(', ');

  /**
   * **지금 보고 있는 전표가 그 상신의 대상인가** — 상신의 되먹임은 전부 이 문을 지난다(D-15).
   *
   * `null`이면 이 화면이 지금 전표에 대해 말할 상신이 없다: 시도한 적이 없거나, **나가는 중에
   * 대상이 바뀌어 그 응답이 남의 것이 됐다.** 결과 구획의 갈래 판정·실패 배너·사유 칸의 서버
   * 오류·결재 진행 구획이 모두 이 값을 본다 — 한 자리라도 빠지면 그 자리에서 남의 전표의
   * 사실이 샌다.
   */
  const boundSubmit =
    submitBinding !== null && submitBinding.inventoryAdjustmentId === adjustmentId
      ? submitBinding
      : null;

  /**
   * **매임이 끊긴 채 결재에 올라간 전표들** — 등록 갈래와 같은 두 겹이다.
   *
   * | 시점 | 어떻게 생기나 | 무엇이 잡나 |
   * | --- | --- | --- |
   * | **도착할 때 이미 끊김** | 나가는 중에 배경 재조회가 대상을 다시 세웠다 | `strandedSubmittedNos` **적재** — 뒤이은 상신이 매임을 덮어도 남는다 |
   * | **선 뒤에 끊김** | 「올렸습니다」가 선 뒤에 같은 effect가 초안 세션을 올린다 | **이 파생** — 읽는 자리에서 매임을 다시 본다 |
   *
   * **판정은 읽는 자리에서 한다**(D-15). 쓰는 자리를 빠짐없이 세었다는 전제에 기대면 그 열거에서
   * 빠진 자리가 곧 사실이 사라지는 경로가 된다 — 이 슬라이스가 등록에서 한 번 겪은 사고다.
   *
   * **같은 번호를 두 번 적지 않는다** — 두 겹이 같은 전표를 가리키는 시점이 있다.
   *
   * ⚠ 실패는 이 갈래에서 말하지 않는다. 성공은 서버에 결재 요청이 남아 알려야 하지만, 거절된
   * 요청은 남는 것이 없다.
   */
  const unboundSubmittedNo =
    submitBinding !== null &&
    submitBinding.approvalRequestId !== null &&
    submitBinding.inventoryAdjustmentId !== adjustmentId
      ? submitBinding.inventoryAdjustmentNo
      : null;

  const strandedSubmitted =
    unboundSubmittedNo === null || strandedSubmittedNos.includes(unboundSubmittedNo)
      ? strandedSubmittedNos
      : [...strandedSubmittedNos, unboundSubmittedNo];

  const strandedSubmittedNote =
    strandedSubmitted.length === 0 ? null : strandedSubmitted.join(', ');

  /**
   * 결재 진행을 부를 수 있는가 — **판정이 한 곳이다**(C36).
   *
   * ⛔ **등록 응답의 값으로 부르지 않는다.** 목이 등록 201에 승인 요청 번호를 채워 주므로
   * (§5.2.5) 그 값으로 부르면 **상신하지 않은 전표의 결재 진행**을 열게 된다 — 화면이 확인하지
   * 않은 사실이다. 근거는 오직 **이 화면이 받은 202**(`boundSubmit.approvalRequestId`)다.
   */
  const submission = readSubmission(boundSubmit?.approvalRequestId ?? null);
  const approvalRequest = useApprovalRequest(submission);

  /**
   * **폼이 잠기는 두 사정**(C26).
   *
   * ① 나가는 중 — 연타가 그대로 전표 두 벌이 된다(호출마다 새 멱등 키).
   * ② 이미 등록했다 — 되돌릴 경로가 없어 두 번째 전표를 지울 수 없다.
   *
   * 두 사정이 **같은 잠금을 쓴다.** 조작 자리마다 다른 조건을 쓰면 한 자리가 열린 채로 남고,
   * 이 화면에서 열린 자리 하나는 전표 한 벌이다. **대상을 바꾸는 길도 이 잠금 안에 있다** —
   * 이미 등록한 뒤에 원천을 바꾸면 만들어진 전표를 보이는 구획이 사라진다.
   */
  const isFormLocked = register.isSaving || boundRegister?.created != null;

  /** 잠긴 사유. **잠갔으면 반드시 함께 선다** — 사유 없는 잠금은 죽은 버튼과 구분되지 않는다 */
  const formLockReason = (): string | null => {
    if (boundRegister?.created != null) return t.actionReasons.alreadyRegistered;
    if (register.isSaving) return t.actionReasons.saving;

    return null;
  };

  /** 「불러오기」가 막힌 사유. `null`이면 열려 있다. */
  const loadBlockReason = (): string | null => {
    /* 잠금이 맨 앞이다 — 그동안은 실사를 다시 불러 대상을 갈아엎을 수 없다. */
    const locked = formLockReason();

    if (locked !== null) return locked;

    if (urlCountId === null) return t.actionReasons.loadVarianceNeedsCount;
    if (variance.isFetching) return t.actionReasons.loadVarianceLoading;

    return null;
  };

  /**
   * 「라인 추가」가 막힌 사유.
   *
   * **실사 갈래에서는 줄을 더하지 않는다.** 그 갈래의 장부는 실사가 준 값이라, 더한 줄은
   * 장부를 확인할 길이 없는 채로 표에 선다 — 세 열 중 둘이 영영 빈 줄이 된다.
   */
  const addLineBlockReason = (): string | null => {
    const locked = formLockReason();

    if (locked !== null) return locked;

    if (sourceKind === 'count') return t.actionReasons.addLineCountSource;
    if (!hasTarget) return t.actionReasons.addLineNeedsWarehouse;

    return null;
  };

  const addLineReason = addLineBlockReason();
  const addLineReasonId = useId();
  const registerReasonId = useId();
  const discardReasonId = useId();

  /**
   * **안내가 말하는 넷과 복구가 되살리는 넷이 같다**(리뷰 R-1 · 전례가 같은 자리에 남긴 규율).
   *
   * 창고는 여기 들어오지 않는다 — 그 이름이 실패로 보이는 자리가 **원천 구획**이고, 복구도
   * 거기 선다. 조건에만 넣고 문구에서 빼면 창고만 실패했을 때 「위치·품목·단위·자재 LOT을
   * 불러오지 못했습니다」가 서는데, 그 넷은 정상이라 **사실이 아닌 문구**가 된다.
   */
  const hasLineReferenceError = locations.isError || items.isError || uoms.isError || lots.isError;

  const hasBalanceError = Object.values(balances.sources).some((source) => source.isError);

  /**
   * 장부가 「—」인데 **그 이유를 말해 줘야 하는** 줄이 있는가.
   *
   * 두 갈래를 함께 본다.
   *
   * | 갈래 | 어떻게 나오나 |
   * | --- | --- |
   * | 잔액에서 (품목·LOT)을 못 찾았다 | `notFound` |
   * | **실사가 장부를 내려보내지 않았다**(블라인드 실사) | 승계 줄인데 `countSystemQty`가 없다 |
   *
   * ⛔ **`notAsked`를 통째로 더하지 않는다.** 그 갈래에는 「위치를 아직 고르지 않은 갓 더한
   * 줄」이 함께 들어 있어, 더할 때마다 안내가 떠서 **정상 상태를 사고처럼** 보이게 만든다.
   * 그래서 블라인드 갈래는 **승계 줄이라는 사실**로 좁혀 가른다 — 그 줄은 사용자가 채울 수
   * 있는 것이 아무것도 없는데 두 열이 비어 있으므로, 이유 없는 대시로 남으면 안 된다.
   */
  const hasUnknownBookQty =
    rows.some((row) => row.bookQty.kind === 'notFound') ||
    lines.some((line) => line.countLineId !== null && line.countSystemQty === null);

  const hasInheritedReason = lines.some((line) => line.countReasonCode !== null);

  /**
   * **잘린 목록으로 등록하지 않는다**(T1이 세운 판정의 소비처).
   *
   * 못 받은 줄은 조정 대상에 실리지 않고, 그 차이는 **조정되지 않은 채 남는다** — 되돌릴 수
   * 없는 쓰기 앞의 조용한 누락이다. 실사 갈래에서 실제로 불러왔을 때만 판정한다:
   * 직접 등록 갈래에는 실사 목록 자체가 대상이 아니다.
   */
  const isVarianceTruncated =
    sourceKind === 'count' && loadedCountId !== null && varianceData?.truncated === true;

  /**
   * 등록이 막힌 사유. `null`이면 **열려 있다.**
   *
   * **순서가 뜻을 정한다.** 먼저 **고쳐도 풀리지 않는 사정**을 말한다 — 뒤에 두면 사용자가
   * 고칠 수 있는 것을 다 고친 뒤에야 막다른 벽을 만난다. 그다음이 지금 고칠 수 있는 것들이고,
   * 그중에서도 **잘못 친 값이 아직 안 친 칸보다 먼저**다.
   */
  const registerBlockReason = (): string | null => {
    /* ① 잠금 둘 — 폼의 어느 값을 고쳐도 이 버튼은 열리지 않는다. */
    const locked = formLockReason();

    if (locked !== null) return locked;

    /* ② 고쳐도 풀리지 않는 사정 둘. */
    if (isReasonPending) return t.actionReasons.registerReasonPending;
    if (isVarianceTruncated) return t.actionReasons.registerVarianceTruncated;

    /* ③ 지금 고칠 수 있는 것들. */
    if (lines.length === 0) return t.actionReasons.registerNeedsLines;
    if (Object.keys(errors).length > 0) return t.actionReasons.registerLineInvalid;
    if (lineSummary.includedCount === 0) return t.actionReasons.registerAllExcluded;
    if (header.reasonCode === '') return t.actionReasons.registerNeedsReason;

    return null;
  };

  /**
   * 버릴 것이 있는가 — **머리와 줄을 함께 본다.** 한쪽만 보면 나머지가 확인 없이 사라진다.
   *
   * **값으로 견준다**(깃발이 아니다). 쳤다가 되돌린 사용자에게 「버릴 것이 있다」로 말하면
   * 아무것도 잃지 않는 조작에 확인을 받는 창이 된다.
   */
  const hasDraftInput = lines.length > 0 || isHeaderEdited(header);

  /**
   * 초안 버리기가 막힌 사유. `null`이면 버릴 값이 있다.
   *
   * ⭐ **나가는 중에는 잠그지 않는다** — 다른 조작과 갈리는 자리다. 이 조작은 서버를 부르지 않고
   * 화면의 초안만 비우므로, 응답을 기다리는 동안 사용자를 묶어 둘 이유가 없다. 대신 확인 창이
   * **보낸 등록은 되돌아가지 않는다**는 사실을 밝히고, 나가는 중이던 응답은 매임이 걸러 낸다.
   *
   * ⚠ **전례 `po-register`와 갈리는 자리다** — 그 화면은 나가는 중 취소를 **잠근다**(같은 파일이
   * 잠금 쪽에서는 그 전례를 이름으로 따르므로, 여기도 따른다고 읽기 쉽다). 여기서 잠그면
   * `resetIfIdle`의 진행 중 가드가 **닿을 수 없는 죽은 분기**가 된다: 그 함수를 부르는 곳이
   * `resetDraftForNewTarget` 하나이고, 나가는 중 그곳에 이르는 길이 버리기뿐이기 때문이다.
   * 그러면 「나가는 중인 쓰기를 끊지 않는다」는 규율이 코드에 적혀 있으되 아무것도 지키지
   * 않는 상태가 된다. 대신 되먹임은 **매임이 가린다**(잠그지 말고 가린다는 것이 이 저장소의
   * 뒤 판정이다). **뒤따르는 회차가 상신·전기의 취소·버리기를 이 자리에서 사본한다.**
   */
  const discardBlockReason = (): string | null => {
    if (boundRegister?.created != null) return t.actionReasons.alreadyRegistered;

    return hasDraftInput ? null : t.actionReasons.discardNothing;
  };

  /**
   * 상신이 막힌 사유. `null`이면 **열려 있다.**
   *
   * **나가는 중이 맨 앞이다** — 사유를 아무리 고쳐도 그동안은 열리지 않는다. 「이미 올렸다」
   * 갈래를 두지 않는다: 올라간 뒤에는 결과 구획이 이 버튼을 **아예 세우지 않고**(칠 수 있는데
   * 보낼 수 없는 칸을 남기지 않는다) 결재 진행 구획이 그 자리를 대신한다.
   *
   * ⛔ **승인 축으로 잠그지 않는다**(D-13 · C37). 자리표시(`APPROVED_APPROVAL_STATUS_CODES`)가
   * 비어 있는 채로 그것을 잠금에 쓰면 버튼이 **영영 잠긴다** — 승인 축의 잠금은 서버가 400으로
   * 한다(D-12). 이 함수가 그 배열을 읽지 않는 것이 그 규율의 자리다.
   *
   * **이 잠금은 매임(`boundSubmit`)을 지나지 않는다 — 일부러 그렇게 두었다.**
   *
   * 화면이 가르는 것은 둘이다. **진술**(어느 전표에 대해 무엇을 말하는가)은 전표별로 참이어야
   * 하므로 매임을 지나지만, **조작 허용**은 어느 전표든 나가는 중이면 막는 편이 안전하다 —
   * 잠금까지 매면 대상이 바뀐 뒤 새 전표의 「조정 상신」이 열리고, 그 순간 ① 되돌릴 수 없는
   * 쓰기 둘이 **한 훅의 상태**를 나눠 쓰며(공통 훅은 mutation 하나를 든다) ② 겨눈 전표를 담는
   * **한 칸짜리 ref가 덮여** 늦게 온 앞 전표의 성공이 새 전표의 매임으로 적힌다.
   *
   * 이 문구는 그때 **거짓말이 되지 않는다** — 「올리는 중」이라고만 말하고 어느 전표인지
   * 주장하지 않으며, 풀리는 조건(「응답이 오면」)도 참이다.
   */
  const submitBlockReason = (): string | null => {
    if (isSubmitting) return t.actionReasons.submitting;
    if (readReason(submitReason).kind === 'empty') return t.actionReasons.submitReasonRequired;

    return null;
  };

  /** 세 사유를 렌더 한 번에 한 번만 판정한다 — 같은 판정을 자리마다 되부르면 갈릴 여지가 생긴다. */
  const registerReason = registerBlockReason();
  const discardReason = discardBlockReason();
  const submitReasonBlocked = submitBlockReason();

  /**
   * 머리 입력을 고친다.
   *
   * **고친 칸의 서버 오류를 함께 지운다**(공통 훅이 이 목적으로 `clearFieldError`를 내놓는다).
   * 화면이 잡은 사정은 잠금 사유로 파생되지만 **서버가 준 오류는 다음 저장까지 남는다** —
   * 지우지 않으면 400을 받은 칸을 고치는 순간에도 서버 문구와 `aria-invalid`가 되살아난다.
   */
  const changeHeader = (patch: Partial<AdjustHeaderDraft>): void => {
    setHeader((prev) => ({ ...prev, ...patch }));

    for (const field of Object.keys(patch)) register.clearFieldError(field);
  };

  /**
   * 확인 창이 되보일 요약. **화면이 이미 만든 값을 넘긴다** — 창이 다시 세면 「사용자가 확인한
   * 것」과 「요청에 실리는 것」이 갈린다.
   */
  const registerSummary = (): RegisterSummary => ({
    reasonCode: header.reasonCode,
    sendToErp: header.sendToErp,
    includedCount: lineSummary.includedCount,
    excludedCount: lineSummary.excludedCount,
    hasCountRef: sourceKind === 'count' && loadedCountId !== null,
  });

  /** 등록을 **요청한다** — 보내는 것은 확인 창을 지난 뒤다. */
  const requestRegister = (): void => {
    setPending('register');
  };

  /**
   * 확인을 받고 **실제로 보낸다.**
   *
   * **창을 닫지 않고 보낸다**(C25·C27). 실패했을 때 창이 닫히면 무엇이 막았는지 모른 채 같은
   * 버튼을 다시 누른다 — 배너는 창 안에 서고, 창은 성공했을 때만 닫힌다.
   *
   * 본문을 만들 수 없으면 **보내지 않고 창을 닫는다.** 버튼 잠금이 이미 막은 길이라 도달하지
   * 않지만, 도달했다면 폼으로 되돌려 보내는 것이 맞다 — 그 자리에 잠긴 사유가 서 있다.
   */
  const confirmRegister = (): void => {
    const body = toInventoryAdjustmentCreate({
      /* **불러온 실사만 원천이다** — 고르기만 한 실사를 실으면 그 실사에서 온 줄이 없는 전표에 원천이 적힌다. */
      inventoryCountId: sourceKind === 'count' ? loadedCountId : null,
      header,
      lines,
    });

    if (body === null) {
      setPending(null);

      return;
    }

    /* 이 호출이 겨눈 초안을 적어 둔다 — 응답이 늦게 오면 그때의 화면은 다른 초안을 세울 수 있다. */
    registeringSessionRef.current = draftSessionRef.current;
    /* **시도부터 매인다** — 나가는 중과 실패도 이 초안의 것으로만 읽혀야 한다. */
    setRegisterBinding({ draftSession: draftSessionRef.current, created: null });
    register.write(body);
  };

  /**
   * 세운 것을 버리고 **빈 초안으로 되돌린다**(수명 표 11행).
   *
   * 대상을 버리는 한 문(`resetDraftForNewTarget`)을 지나므로 초안 세션이 올라가고, 그때부터
   * 앞 초안의 되먹임은 매임에 걸려 이 화면에 서지 않는다 — **나가는 중인 요청 자체는 끊지
   * 않는다**(`resetIfIdle`). 머리는 이 자리에서만 함께 비운다.
   */
  const confirmDiscard = (): void => {
    resetDraftForNewTarget();
    setHeader(emptyHeaderDraft());
    setPending(null);
  };

  /** 확인 창이 되보일 요약. **화면이 이미 만든 값을 넘긴다** — 창이 다시 세면 갈린다. */
  const submitSummary = (created: CreatedAdjustmentResult): SubmitSummary => {
    const state = readReason(submitReason);

    return {
      inventoryAdjustmentNo: created.created.inventoryAdjustmentNo,
      reason: state.kind === 'ready' ? state.reason : '',
      reasonFirstLine: state.kind === 'ready' ? state.firstLine : '',
    };
  };

  /** 상신을 **요청한다** — 보내는 것은 확인 창을 지난 뒤다. 등록과 같은 층 구조다. */
  const requestSubmit = (): void => {
    setPending('submit');
  };

  /**
   * 확인을 받고 **실제로 올린다** — 요청이 **둘**이다.
   *
   * ① 조정 상세를 부른다(잠금 토큰이 그 경로에서만 나온다 · D-14)
   * ② 사유 한 칸을 실어 상신한다
   *
   * **창을 닫지 않고 보낸다** — 실패했을 때 창이 닫히면 무엇이 막았는지 모른 채 같은 버튼을
   * 다시 누른다. 창은 성공했을 때만 닫힌다.
   *
   * **상세 조회가 실패해도 갈래를 새로 만들지 않는다.** 토큰을 못 얻은 채 상신하면 공통 훅이
   * 요청을 만들지 않고 「최신 정보를 불러오는 중입니다」를 세운다 — 그 자리가 이미 있다.
   *
   * **매번 다시 부른다.** 조회가 신선도를 무시하므로(`staleTime: 0`) 409를 받은 뒤 다시 누르면
   * 실제로 새 토큰으로 나간다 — 그것이 이 화면에서 충돌이 풀리는 길이다.
   */
  const confirmSubmit = (): void => {
    const body = toApprovalRequest(submitReason);
    const target = boundRegister?.created ?? null;

    if (body === null || target === null) {
      setPending(null);

      return;
    }

    setSubmitStarting(true);
    /* 이 호출이 겨눈 전표를 적어 둔다 — 응답이 늦게 오면 그때의 화면은 다른 대상을 볼 수 있다. */
    submittingTargetRef.current = {
      inventoryAdjustmentId: target.inventoryAdjustmentId,
      inventoryAdjustmentNo: target.created.inventoryAdjustmentNo,
    };
    /* **시도부터 매인다** — 나가는 중과 실패도 이 전표의 것으로만 읽혀야 한다. */
    setSubmitBinding({
      inventoryAdjustmentId: target.inventoryAdjustmentId,
      inventoryAdjustmentNo: target.created.inventoryAdjustmentNo,
      approvalRequestId: null,
    });

    void fetchAdjustmentDetail(target.inventoryAdjustmentId)
      .catch(() => undefined)
      .finally(() => {
        setSubmitStarting(false);
        submit.write(body);
      });
  };

  /**
   * 409의 「최신 불러오기」 — **낡은 것은 이 전표의 잠금 토큰이다.**
   *
   * 거부는 삼키지 않고 받아 둔다. 실패해도 막다른 길이 아니다 — 「조정 상신」을 다시 누르는
   * 길이 **같은 조회를 다시 지나므로**, 그때 못 얻으면 「최신 정보를 불러오는 중입니다」가 선다.
   */
  const reloadAdjustmentDetail = (): void => {
    if (adjustmentId === null) return;

    void fetchAdjustmentDetail(adjustmentId).catch(() => undefined);
  };

  /**
   * 저장 실패 표시 — 배너와 **응답 없음 안내**를 함께 낸다(C27).
   *
   * 멱등 세 겹의 셋째다. 첫째가 확인 창, 둘째가 전송 중·성공 후 잠금, 셋째가 이것 —
   * **응답이 오지 않은 요청은 「실패」가 아니라는 사실**을 말한다. 훅이 호출마다 새 멱등 키를
   * 만들어, 그대로 다시 보내면 서버에는 다른 요청으로 보인다.
   *
   * **네트워크 갈래에만 붙는다.** 서버가 거절한 요청은 전달된 것이 확실하다.
   *
   * **「최신 불러오기」를 낼 자리가 아니다.** 등록에는 저장 충돌이 없다(계약에 `If-Match`도 409도
   * 없다) — 잠글 대상이 없는 쓰기에 재조회 수단을 내면 입력만 버리게 된다.
   *
   * **매임을 지난다** — 버린 초안의 실패가 새 초안 위에 서지 않는다(C28).
   */
  const failureSlot = (): ReactNode =>
    boundRegister === null ? null : (
      <>
        <SaveErrorBanner error={register.error} />
        {register.error?.kind === 'network' && (
          <p className="field-note">{t.notes.networkUnconfirmed}</p>
        )}
      </>
    );

  /**
   * 상신 실패 표시 — **409에는 「최신 불러오기」를 함께 낸다.**
   *
   * 등록과 달리 이 쓰기에는 **잠글 대상이 있다**(계약이 `If-Match`를 필수로 두고 409를 낸다) —
   * 그래서 재조회 수단을 내는 것이 맞고, 실제로 다시 읽으면 풀린다.
   *
   * **매임을 지난다** — 남의 전표의 실패가 지금 보고 있는 전표 위에 서지 않는다.
   */
  const submitFailureSlot = (): ReactNode =>
    boundSubmit === null ? null : (
      <SaveErrorBanner error={submit.error} onReload={reloadAdjustmentDetail} />
    );

  /**
   * 지금 상신이 어디까지 갔는가. **결과 구획이 그리는 갈래를 한 자리에서 정한다** —
   * 자리마다 따로 판정하면 배너와 버튼이 서로 다른 갈래를 말한다.
   */
  const submitPhase = (): SubmitPhase => {
    /*
     * **남의 전표의 되먹임은 이 구획에 서지 않는다**(매임의 문).
     *
     * 대상이 바뀐 뒤 도착하는 응답이 실재하므로, 매임을 지나지 않으면 **시도한 적 없는 전표
     * 위에** 성공·진행·실패가 선다. 성공만 매고 실패를 두면 절반만 막힌다 — 그래서 셋이
     * 이 한 문을 함께 지난다.
     */
    if (boundSubmit === null) return 'idle';

    if (boundSubmit.approvalRequestId !== null) return 'submitted';
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
   * 결재 진행 구획 — **상신을 확인한 뒤에만 선다**(C36).
   *
   * `null`을 내는 것이 「아직 상신되지 않았다」의 표현이다. 구획에 그 갈래를 만들면 **도달할 수
   * 없는 자리표시**가 남는다(그 판정은 여기서 이미 끝난다).
   *
   * 자리표시 두 배열을 **여기서 읽어 넘긴다** — 부품이 직접 읽으면 「채우면 무엇이 달라지는가」를
   * 화면 수준에서 잴 수 없어 그 자리가 죽은 가지가 된다(D-13 · C37).
   */
  const progressSlot = (): ReactNode => {
    if (submission.kind === 'notSubmitted') return null;

    const state = ((): ApprovalProgressState => {
      if (submission.kind === 'unusable') return { kind: 'unusable' };
      if (approvalRequest.isPending) return { kind: 'loading' };
      if (approvalRequest.isError) return { kind: 'failed', error: approvalRequest.error };

      return {
        kind: 'ready',
        view: toRequestProgressView(
          approvalRequest.data,
          REJECTION_DECISION_CODES,
          APPROVED_APPROVAL_STATUS_CODES,
        ),
      };
    })();

    return (
      <ApprovalProgressPane
        state={state}
        isJudgePending={isApprovalJudgePending(APPROVED_APPROVAL_STATUS_CODES)}
        onRetry={() => {
          void approvalRequest.refetch();
        }}
      />
    );
  };

  /**
   * 표와 그 줄에 딸린 안내 — **줄이 있어야 뜻이 서는 것만** 여기 둔다.
   *
   * 복구 블록은 이 함수 **밖**에 있다(리뷰 R-1). 여기 두면 줄이 0행일 때 빈 상태에서 끊겨
   * 복구 수단이 렌더되지 않고, 참조만 실패한 화면이 막다른 길이 된다.
   */
  const linesPaneContent = () => {
    if (variance.isPending && loadedCountId !== null) {
      return (
        <div role="status" aria-label={t.loading.varianceLines}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    if (rows.length === 0) {
      return (
        <EmptyState
          size="sm"
          title={t.empty.noLinesTitle}
          description={
            sourceKind === 'count'
              ? t.empty.noLinesCountDescription
              : t.empty.noLinesDirectDescription
          }
        />
      );
    }

    return (
      <>
        <AdjustLineTable
          rows={rows}
          errors={errors}
          locationLookup={locations}
          itemLookup={items}
          uomLookup={uoms}
          lotLookup={lots}
          locationOptions={toSelectOptions(locations)}
          itemOptions={toSelectOptions(items)}
          uomOptions={toSelectOptions(uoms)}
          /*
           * **표도 같은 잠금을 쓴다**(C26). 보내는 중에 값이 바뀌면 화면이 보여 주는 것과 나간
           * 본문이 갈리고, 이미 등록한 뒤에 바뀌면 만들어진 전표와 다른 줄을 보이게 된다.
           */
          isLocked={isFormLocked}
          onPatch={patchLine}
          onRemove={removeLine}
        />

        {/* 차이 0인 줄은 **막지 않고** 무엇이 일어나는지만 밝힌다(D-4). */}
        {excludedCount > 0 && <p className="field-note">{t.notes.excludedZero(excludedCount)}</p>}

        {/* 실사에서 온 사유는 보이기만 한다(D-7) — 고칠 수 있는 값으로 읽히지 않게 밝힌다. */}
        {hasInheritedReason && <p className="field-note">{t.notes.lineReasonReadOnly}</p>}

        <p className="field-note">{t.notes.lineNoAssignedByServer}</p>
      </>
    );
  };

  /**
   * 참조·장부 실패의 복구 — **빈 상태 가드 밖에 선다.**
   *
   * 이름을 못 푸는 것과 장부를 못 받는 것은 **줄이 0행일 때도 참**이고, 오히려 그때가 사용자가
   * 아무것도 할 수 없는 상태다(고를 값이 없어 줄을 세울 수 없다). 복구를 표 아래에 가두면
   * 그 상태에서 화면에 「다시 시도」가 한 개도 남지 않는다.
   */
  const recoverySlot = () => (
    <>
      {hasBalanceError && (
        <div className="field-cell">
          <span className="field-error" role="status">
            {t.reasons.balancesFailed}
          </span>
          <Button variant="outlined" size="sm" onClick={retryBalances}>
            {messages.common.retry}
          </Button>
        </div>
      )}

      {hasLineReferenceError && (
        <div className="field-cell">
          <span className="field-note">{t.reasons.lineReferencesFailed}</span>
          <Button variant="outlined" size="sm" onClick={retryReferences}>
            {messages.common.retry}
          </Button>
        </div>
      )}
    </>
  );

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {/*
       * ⭐ **범위 안내는 늘 선다**(조심 ③ · C13). 이 화면을 「잔량을 고치는 화면」으로 읽는 것이
       * 여기서 가장 비싼 오해라, 맥락 유무로 접으면 정작 그렇게 읽는 사람이 읽지 못한다.
       */}
      <div className="banner-slot">
        <AlertBanner variant="info" title={t.scope.title}>
          {t.scope.description}
        </AlertBanner>
      </div>

      {/*
       * ⛔ **승인 대기 탭을 두지 않는다**(조심 ① · D-3). 결재는 결재함이 소유한다 —
       * 이 안내가 그 자리를 가리키므로 사용자가 여기서 승인 버튼을 찾지 않는다.
       */}
      <div className="banner-slot">
        <AlertBanner variant="info" title={t.approvalNotice.title}>
          {t.approvalNotice.description}
        </AlertBanner>
      </div>

      {counts.isError && (
        <LoadErrorBanner
          error={counts.error}
          onRetry={() => {
            void counts.refetch();
          }}
        />
      )}

      <section className="pane" aria-label={t.panes.source}>
        {/* 지운 사실을 남긴다 — 주소를 지우고 나면 「없는 실사였다」를 말할 근거가 사라진다. */}
        {hasCleanedMissingCount && <p className="field-note">{t.source.countNotFoundNote}</p>}

        <SourcePane
          kind={sourceKind}
          onChangeKind={changeSourceKind}
          discardCount={applySourceChange(lines).discardedCount}
          countOptions={countOptions}
          countNote={countList?.truncated === true ? t.lookups.truncated : undefined}
          countId={urlCountId === null ? '' : String(urlCountId)}
          onChangeCount={chooseCount}
          countWarehouseName={describeReference(
            toReference(warehouses, chosenCount?.warehouseId ?? null),
          )}
          warehouseOptions={toSelectOptions(warehouses)}
          warehouseNote={lookupNote(warehouses)}
          warehouseId={warehouseDraft}
          onChangeWarehouse={chooseWarehouse}
          hasWarehouseError={warehouses.isError}
          onRetryWarehouses={retryWarehouses}
          /*
           * **대상을 바꾸는 길도 잠금 안에 있다**(C26). 나가는 중에 바뀌면 도착한 되먹임이
           * 다른 맥락에 놓이고, 이미 등록한 뒤에 바뀌면 만들어진 전표를 보이는 구획이 사라진다.
           */
          isLocked={isFormLocked}
          loadBlockReason={loadBlockReason()}
          onLoadVariance={loadVariance}
        />

        {/*
         * **불러온 결과를 밝힌다.** 세 갈래를 가르는 것이 요점이다.
         *
         * - 0행 — 「불러오지 못했다」와 「불러왔더니 차이가 없다」는 다른 말이다
         * - **잘림** — 받은 것을 전부라고 말하면 조정되지 않은 차이가 남은 채로 전표가 올라간다
         * - 전부 — 그때만 「N행을 가져왔습니다」로 완결을 말할 수 있다
         *
         * 잘림은 **살아 있는 영역**으로 알린다(`role="status"`) — 표를 보지 않는 사용자에게도 닿아야
         * 하고, 이 사실이 뒤따르는 회차에서 등록 잠금 사유가 된다.
         */}
        {loadedCountId !== null && varianceData !== undefined && (
          <p className={varianceData.truncated ? 'field-error' : 'field-note'} role="status">
            {varianceData.lines.length === 0
              ? t.source.loadedEmptyNote
              : varianceData.truncated
                ? t.source.loadedTruncatedNote(varianceData.lines.length, varianceData.total)
                : t.source.loadedNote(varianceData.lines.length)}
          </p>
        )}
      </section>

      <section className="pane" aria-label={t.panes.lines}>
        {/*
         * ⭐ **실물은 파생이고 차이는 음수를 받는다**(조심 ②·③). 표를 읽기 전에 이 둘을 알아야
         * 사용자가 「실물을 고쳐야 하나」·「음수를 넣어도 되나」를 묻지 않는다.
         */}
        <p className="field-note">{t.notes.actualDerived}</p>
        <p className="field-note">{t.notes.negativeAllowed}</p>

        {variance.isError && (
          <LoadErrorBanner
            error={variance.error}
            onRetry={() => {
              void variance.refetch();
            }}
          />
        )}

        {linesPaneContent()}

        {recoverySlot()}

        <div className="form-actions">
          <div className="field-cell">
            <Button
              variant="outlined"
              disabled={addLineReason !== null}
              aria-describedby={addLineReason === null ? undefined : addLineReasonId}
              onClick={addLine}
            >
              {t.actions.addLine}
            </Button>
            {addLineReason !== null && (
              <span id={addLineReasonId} className="field-note">
                {addLineReason}
              </span>
            )}
          </div>
        </div>
      </section>

      {/*
       * 등록 구획 — **되돌릴 수 없는 쓰기가 사는 자리**다.
       *
       * 머리 두 칸과 조작 둘이 여기 함께 선다. **막는 사정과 막지 않는 사정이 나란히 읽혀야**
       * 사용자가 무엇을 고쳐야 하는지 안다 — 장부를 확인하지 못한 줄이 있다는 사실은 여기서
       * 「그래도 등록할 수 있다」로 읽힌다.
       */}
      <section className="pane" aria-label={t.panes.register}>
        <HeaderForm
          values={header}
          reasonOptions={codeOptions.reason}
          /*
           * **값 목록이 비어 있는 동안 무엇이 막히는지 그 칸에서 밝힌다**(D-9 · C10).
           * 왜 잠겼는지는 아래 조작 자리가 따로 말한다 — 칸은 「고를 것이 없다」를, 버튼은
           * 「그래서 등록이 막혔다」를 말한다.
           */
          reasonNote={isReasonPending ? t.notes.reasonCodePending : undefined}
          /* 남의 초안의 서버 오류가 이 칸에 서지 않는다(C28 · 매임). */
          fieldErrors={boundRegister === null ? {} : register.fieldErrors}
          isLocked={isFormLocked}
          onChange={changeHeader}
        />

        {/*
         * 장부를 못 찾아도 **등록은 막지 않는다**(C8) — 잠금 사유 옆에 서야 그 사실이 읽힌다.
         * 표 아래에 두면 「막는 사정」 목록에서 떨어져, 사용자가 장부부터 채우려 든다.
         */}
        {hasUnknownBookQty && <p className="field-note">{t.notes.bookQtyOptional}</p>}

        <div className="form-actions">
          {/*
           * 잠긴 사유는 감추지 않고 항상 보이는 DOM 텍스트로 렌더해 `aria-describedby`로 잇는다 —
           * 잠긴 컨트롤은 포커스를 받지 못해 툴팁만으로는 키보드·스크린리더 사용자가 닿을 수 없다.
           * **열려 있으면 사유를 그리지 않는다** — 늘 서 있으면 읽히지 않는다.
           */}
          <div className="field-cell">
            <Button
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
             * 버리기는 **보내기 전 복귀**다 — 서버를 부르지 않는다. 만들어진 전표를 되돌리는
             * 수단이 아니고, 되돌릴 입력이 없으면 잠긴 채 그 사실을 말한다.
             */}
            <Button
              variant="text"
              disabled={discardReason !== null}
              aria-describedby={discardReason === null ? undefined : discardReasonId}
              onClick={() => {
                setPending('discard');
              }}
            >
              {t.actions.discard}
            </Button>
            {discardReason !== null && (
              <span id={discardReasonId} className="field-note">
                {discardReason}
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
         * 버린 초안으로 보낸 등록이 **뒤늦게 성공한** 갈래(C28의 나머지 반쪽).
         * 지금 초안의 결과가 아니므로 결과 구획을 세우지 않되, 서버에 남은 사실은 감추지 않는다.
         * **쌓인 번호를 한 줄에 함께 낸다** — 다음 등록이 성공해도 앞 번호가 사라지지 않는다.
         */}
        {strandedNote !== null && (
          <p className="field-note" role="status">
            {t.result.unboundCreatedNote(strandedNote)}
          </p>
        )}

        {/*
         * 매임이 끊긴 채 **결재에 올라간** 전표(같은 갈래의 상신 몫). 서버에 결재 요청이 남았으므로
         * 감추지 않되, 지금 보고 있는 대상의 결과로 세우지 않는다.
         */}
        {strandedSubmittedNote !== null && (
          <p className="field-note" role="status">
            {t.result.unboundSubmittedNote(strandedSubmittedNote)}
          </p>
        )}
      </section>

      {/* **결과 구획은 이 초안의 등록이 성공했을 때만 선다**(매임). */}
      {boundRegister?.created != null && (
        <ResultPane
          created={boundRegister.created.created}
          phase={submitPhase()}
          reason={submitReason}
          /* 남의 전표의 서버 오류가 이 칸에 서지 않는다(매임의 넷째 소비처). */
          reasonError={boundSubmit === null ? undefined : submit.fieldErrors.reason}
          blockReason={submitReasonBlocked}
          /*
           * 저장 실패는 **한 자리에만** 선다 — 확인 창이 열려 있으면 창 안이고, 닫혀 있으면 여기다.
           * 두 자리에 두면 사용자가 스크림 뒤의 사본을 읽으려 든다.
           */
          banner={pending === 'submit' ? null : submitFailureSlot()}
          progress={progressSlot()}
          onChangeReason={(value) => {
            /* **친 글자를 그 전표에 맨다** — 읽는 자리가 이 짝으로 남의 사유를 걸러 낸다(R-1). */
            setSubmitReasonDraft({ inventoryAdjustmentId: adjustmentId, text: value });
            /* 고친 칸의 서버 오류를 함께 지운다 — 남겨 두면 고치는 순간에도 빨갛게 서 있다. */
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

      {pending === 'submit' && boundRegister?.created != null && (
        <SubmitConfirmDialog
          summary={submitSummary(boundRegister.created)}
          isSaving={isSubmitting}
          banner={submitFailureSlot()}
          onConfirm={confirmSubmit}
          /*
           * 등록 확인 창과 같은 규율이다 — Escape로 닫히는 길은 디자인 시스템이 막을 수단을
           * 주지 않으므로, **닫혀도 나가는 요청이 무너지지 않게** 한다(여기서 `reset`을 부르지
           * 않는다). 응답은 그대로 도착해 매임을 지나 결과 구획에 선다.
           */
          onClose={() => {
            setPending(null);
          }}
        />
      )}

      {pending === 'discard' && (
        <DiscardConfirmDialog
          isSaving={register.isSaving}
          onConfirm={confirmDiscard}
          onClose={() => {
            setPending(null);
          }}
        />
      )}
    </>
  );
};
