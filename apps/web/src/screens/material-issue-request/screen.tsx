import { AlertBanner, Breadcrumb, EmptyState, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { SaveErrorBanner } from '../../patterns/master';
import { resolveLineOrigins } from './bom-origin';
import { ExistingRequestBanner } from './existing-request-banner';
import { addLineDraft, patchLineDraft, removeLineDraft, replaceShortageDrafts } from './line-draft';
import { LinePane } from './line-pane';
import { LoadErrorBanner } from './load-error-banner';
import {
  isTruncated,
  lookupNote,
  useItemNameSources,
  useItemOptions,
  useLocationDetail,
  useLocationOptions,
  useUomOptions,
  useWarehouseOptions,
  type LookupResult,
} from './lookups';
import type { MaterialIssueRequestInput } from './material-issue-request-body';
import { useMaterialIssueRequestMutation, type PlannedStockConflict } from './mutations';
import { PlannedStockDialog } from './planned-stock-dialog';
import { usePublishSubmission } from './publish-submission';
import {
  useExistingRequests,
  useItemBaseUom,
  useShortage,
  useWorkOrderDetail,
  useWorkOrderSearch,
} from './queries';
import { ReasonPane } from './reason-pane';
import { useReasonOptions } from './reason-options';
import { ResultPane } from './result-pane';
import { TargetPane } from './target-pane';
import {
  toWorkOrderView,
  type CreatedRequestView,
  type ExistingRequestView,
  type MaterialIssueLineDraft,
  type SelectOption,
  type ShortageLineView,
  type WorkOrderView,
} from './types';
import {
  publishBlockReason,
  validateHeader,
  validateLines,
  visibleHeaderErrors,
  type HeaderDraft,
} from './validation';

const t = messages.materialIssueRequest;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_WORK_ORDERS: WorkOrderView[] = [];
const EMPTY_SHORTAGE: ShortageLineView[] = [];
const EMPTY_EXISTING: ExistingRequestView[] = [];

const toSelectOptions = (lookup: LookupResult): SelectOption[] =>
  lookup.entries.map((entry) => ({ value: entry.value, label: entry.label }));

/** 머리 초안 중 W/O 를 뺀 나머지 — W/O 는 고른 객체 자체로 들고 있다. */
interface FormDraft {
  /** 피처 003 출발 생산 창고. 비면 「자동」(검토 4). 생산 창고 공장에서만 쓴다. */
  sourceWarehouseId: string;
  warehouseId: string;
  destinationLocationId: string;
  requiredDate: string;
  requiredTime: string;
  reasonCode: string;
  remarks: string;
}

const EMPTY_FORM: FormDraft = {
  sourceWarehouseId: '',
  warehouseId: '',
  destinationLocationId: '',
  requiredDate: '',
  requiredTime: '',
  reasonCode: '',
  remarks: '',
};

/**
 * 방금 나간 발행이 겨눈 대상. 나가는 중에 다른 W/O 로 옮겨 간 뒤 늦게 도착한 성공이 새 대상
 * 위에 「발행했습니다」로 서지 않게 한다.
 */
type TargetSignature = `wo:${string}`;

interface CreatedBinding {
  targetSignature: TargetSignature;
  result: CreatedRequestView;
}

/**
 * W-02-11 「보충 요청 →」이 실어 온 값(검토 3) — W/O · 품목 · 수량 · 사유 · 출발 생산 창고 · 미배정 부족 행.
 * 들어올 때 한 번만 읽는다(이 화면은 주소가 상태를 소유하지 않는다).
 */
interface Prefill {
  workOrderId: number;
  itemId: number | null;
  qty: string;
  reasonCode: string;
  sourceWarehouseId: string;
  unsourcedShortageId: string;
}

const ID = /^[1-9]\d*$/;

/** 「자동」 선택지의 값 — 빈 값은 선택칸이 「고르지 않음」으로 그린다. 본문에는 싣지 않는다. */
const AUTO_SOURCE = 'auto';

const readPrefill = (params: URLSearchParams): Prefill | null => {
  const wo = params.get('wo') ?? '';
  if (!ID.test(wo)) return null;
  const item = params.get('item') ?? '';
  const src = params.get('src') ?? '';
  const unsourced = params.get('unsourced') ?? '';
  return {
    workOrderId: Number(wo),
    itemId: ID.test(item) ? Number(item) : null,
    qty: params.get('qty') ?? '',
    reasonCode: params.get('reason') ?? '',
    sourceWarehouseId: ID.test(src) ? src : '',
    unsourcedShortageId: ID.test(unsourced) ? unsourced : '',
  };
};

/**
 * W-02-10 컨테이너 — **긴급 W/O 등으로 부족한 자재를 무절차 반출 없이 정식 출고로 경유시킨다.**
 *
 * 구획 셋과 액션 하나다 — ① 대상 W/O · ② 요청 품목 · ③ 사유 / [요청 발행].
 *
 * ⛔ **원인 W/O 칸을 만들지 않는다**(스펙 §5-2). `workOrderId` 는 투입 대상을 가리키고,
 * 발생 원인은 사유 코드가 대신한다.
 *
 * ⛔ **오프라인 큐가 없다.** 관리웹 셸이다(공유계약 C-5). `Idempotency-Key` 는 오프라인 때문이
 * 아니라 **재시도 중복을 막기 위해** 붙는다.
 *
 * ⭐ **주소가 이 화면의 상태를 소유하지 않는다.** 목록 화면이 아니라 폼이고, 되돌릴 수 없는
 * 쓰기가 걸린 초안을 주소로 되살리면 「무엇을 발행하려던 것인가」가 흐려진다.
 *
 * **되돌릴 수 없는 쓰기를 두 겹으로 막는다** — ① 전송 중 잠금 ② 성공 뒤 잠금. 확인 창은 두지
 * 않는다(재고를 움직이지 않는 요청 발행이다).
 */
export const MaterialIssueRequestScreen = () => {
  const [searchParams] = useSearchParams();
  const [prefill] = useState<Prefill | null>(() => readPrefill(searchParams));
  /** 채운 값을 한 번만 세운다 — 사용자가 고친 뒤 다시 덮지 않는다. */
  const [isPrefillApplied, setIsPrefillApplied] = useState(prefill === null);
  const [conflict, setConflict] = useState<PlannedStockConflict | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderView | null>(null);
  const [form, setForm] = useState<FormDraft>(EMPTY_FORM);
  const [lines, setLines] = useState<MaterialIssueLineDraft[]>([]);
  const [isShortageRequested, setIsShortageRequested] = useState(false);
  /**
   * 「불러오기」가 도는 중인가 — **표시 전용**이다.
   *
   * ⛔ 「반영해도 되는가」의 판정에 쓰지 않는다. 그 판정은 누름이 쥔 약속이 진다(`loadShortage`) —
   * 표식으로 판정하면 실패로 굳은 표식을 **배경 재조회가 소비**해 편집을 덮는다.
   */
  const [isLoadPending, setIsLoadPending] = useState(false);
  const [createdBinding, setCreatedBinding] = useState<CreatedBinding | null>(null);
  /** 사용자가 만진 칸(오류의 열쇠로 적는다) · 발행을 한 번이라도 눌렀는가 — 오류 노출의 문이다. */
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [hasAttemptedPublish, setHasAttemptedPublish] = useState(false);

  const workOrderId = selectedWorkOrder === null ? '' : String(selectedWorkOrder.workOrderId);
  const targetSignature: TargetSignature = `wo:${workOrderId}`;

  const workOrders = useWorkOrderSearch(appliedQuery);
  const workOrderRows = workOrders.data?.items ?? EMPTY_WORK_ORDERS;

  const defaultWipLocationId = selectedWorkOrder?.defaultWipLocationId ?? null;
  const locationDetail = useLocationDetail(defaultWipLocationId);

  const warehouses = useWarehouseOptions();
  const warehouseId = form.warehouseId === '' ? null : Number(form.warehouseId);
  const locations = useLocationOptions(warehouseId);
  const items = useItemOptions();
  const uoms = useUomOptions();
  const reasons = useReasonOptions();

  const numericWorkOrderId = selectedWorkOrder?.workOrderId ?? null;
  const shortage = useShortage(numericWorkOrderId, isShortageRequested);
  const shortageLines = shortage.data ?? EMPTY_SHORTAGE;
  const existing = useExistingRequests(numericWorkOrderId);

  const submittingTargetRef = useRef<TargetSignature | null>(null);
  /**
   * 지금 불러오기가 겨눈 대상. **쓰기 경로의 `submittingTargetRef` 와 같은 관용구다** — 나가는
   * 중에 다른 W/O 로 옮겨 가면 늦게 도착한 응답이 새 대상 위에 서면 안 된다.
   *
   * ⭐ 쓰기만 대상을 확인하고 읽기는 확인하지 않는 비대칭이 회귀를 낳았다(리뷰 R3-1).
   */
  const loadTargetRef = useRef<TargetSignature | null>(null);
  /** 제출 순간의 고정은 이 훅이 진다 — 화면은 본문을 직접 조립하지 않는다. */
  const submission = usePublishSubmission();

  /*
   * 피처 003 — W/O 담당 부서의 생산 창고. 있으면 생산 창고 공장(새 규칙): 출발 생산 창고 칸, 「창고」 칸 숨김,
   * 입고지 선택(비우면 서버가 채움). 없거나 못 받으면 지금 화면 그대로(FR-009a).
   */
  const workOrderDetail = useWorkOrderDetail(
    selectedWorkOrder?.workOrderId ?? (isPrefillApplied ? null : (prefill?.workOrderId ?? null)),
  );
  const productionWarehouses = workOrderDetail.data?.productionWarehouses ?? [];
  /* 공장 모드(FR-009a)는 «공장» 기준이다 — 빈 배열을 지금 방식으로 읽지 않는다(계약 §2). */
  const usesProductionWarehouses =
    selectedWorkOrder !== null &&
    workOrderDetail.data?.workOrderId === selectedWorkOrder.workOrderId &&
    workOrderDetail.data.productionWarehouseMode === true;
  /** 새 규칙 공장인데 이 W/O 라인 부서에 생산 창고가 없다 — 알리고 만들기를 막는다(서버도 400). */
  const lacksProductionWarehouse = usesProductionWarehouses && productionWarehouses.length === 0;
  const prefillUom = useItemBaseUom(isPrefillApplied ? null : (prefill?.itemId ?? null));

  /* 보충 요청으로 열었으면 그 W/O 를 고른다. */
  useEffect(() => {
    if (isPrefillApplied || prefill === null || selectedWorkOrder !== null) return;
    if (workOrderDetail.data?.workOrderId === prefill.workOrderId) {
      setSelectedWorkOrder(toWorkOrderView(workOrderDetail.data));
    } else if (workOrderDetail.isError) {
      setIsPrefillApplied(true);
    }
  }, [isPrefillApplied, prefill, selectedWorkOrder, workOrderDetail.data, workOrderDetail.isError]);

  const create = useMaterialIssueRequestMutation({
    onPlannedStockConflict: setConflict,
    onSuccess: (result) => {
      const boundSignature = submittingTargetRef.current;

      setCreatedBinding(
        boundSignature === null ? null : { targetSignature: boundSignature, result },
      );
    },
  });

  /**
   * **나가는 중인 쓰기는 건드리지 않는다.** 공통 훅의 `reset()`은 진행 중 mutation에서 옵저버를
   * 떼어 낸다 — 응답이 이미 서버에 갔는데 화면만 없던 일로 치면 안 된다.
   */
  const resetCreateIfIdle = (): void => {
    if (create.isSaving) return;

    create.reset();
  };

  /*
   * 대상이 바뀌면 이 W/O 에 매인 것을 전부 비운다 — 앞 W/O 의 줄이 새 대상에 실리면 안 된다.
   *
   * ⛔ **제출 도장은 여기서도 버리지 않는다.** 대상이 바뀌면 `workOrderId` 가 지문에 들어 있어
   * 어차피 새 도장이 찍힌다. 손으로 버리면 「값을 고쳤다 되돌린」 경우까지 새 키가 나간다.
   */
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      sourceWarehouseId: '',
      warehouseId: '',
      destinationLocationId: '',
    }));
    setConflict(null);
    setLines([]);
    setIsShortageRequested(false);
    setIsLoadPending(false);
    /*
     * ⭐ **앞 대상을 겨눈 불러오기는 이제 남의 것이다.** 비우지 않으면 나가 있던 조회가 돌아와
     * **누르지도 않은 새 대상**의 줄을 세운다 — `queries.ts` 가 못 박은 「버튼을 눌러야 부른다」가
     * 깨진다(리뷰 R3-1).
     */
    loadTargetRef.current = null;
    /*
     * ⭐ **만짐 기록도 함께 비운다.** 앞 대상에서 발행을 눌렀다는 사실이 남으면, 새 대상에서
     * 화면이 방금 비운 도착 위치에 **즉시 붉은 오류**가 선다 — 사용자는 새 대상에서 아직 아무
     * 일도 하지 않았다(리뷰 m-1). 「만진 칸만 붉힌다」가 이 경로에서만 깨지고 있었다.
     */
    setTouched({});
    setHasAttemptedPublish(false);
    resetCreateIfIdle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId]);

  /*
   * 도착 위치 자동 채움 — W/O 의 기본 재공 위치가 속한 창고를 찾아 창고·위치를 함께 세운다.
   * **사용자가 이미 고른 값을 덮지 않는다**(둘 다 비어 있을 때만 채운다). 상세 조회가 실패하면
   * 아무것도 채우지 않는다 — 조용히 첫 창고를 고르면 잘못된 위치가 전표에 실린다.
   *
   * ⛔ **대상(`workOrderId`)도 조건에 넣는다.** 위 비움 effect 가 대상이 바뀔 때마다 두 칸을
   * 비우는데, 기본 재공 위치가 같은 W/O 로 옮기면 위치·창고 값이 그대로라 이 effect 가 다시 돌지
   * 않아 칸이 빈 채로 남았다(PLAN-WO-01 W13). 선언 순서상 비움 뒤에 돌므로 비운 칸을 다시 채운다.
   */
  const resolvedWarehouseId = locationDetail.warehouseId;

  useEffect(() => {
    if (defaultWipLocationId === null || resolvedWarehouseId === null) return;

    setForm((prev) =>
      prev.warehouseId === '' && prev.destinationLocationId === ''
        ? {
            ...prev,
            warehouseId: String(resolvedWarehouseId),
            destinationLocationId: String(defaultWipLocationId),
          }
        : prev,
    );
  }, [workOrderId, defaultWipLocationId, resolvedWarehouseId]);

  /*
   * 보충 요청 값 채우기 — 대상 비움(위)이 돈 다음에 세운다. 품목 기본 단위를 받은 뒤에 한 번만.
   */
  useEffect(() => {
    if (isPrefillApplied || prefill === null) return;
    if (selectedWorkOrder?.workOrderId !== prefill.workOrderId) return;
    if (prefill.itemId !== null && prefillUom.isPending) return;
    setForm((prev) => ({
      ...prev,
      reasonCode: prefill.reasonCode,
      sourceWarehouseId: prefill.sourceWarehouseId,
    }));
    if (prefill.itemId !== null) {
      const line = {
        ...addLineDraft([])[0],
        itemId: String(prefill.itemId),
        uomId:
          prefillUom.data === null || prefillUom.data === undefined ? '' : String(prefillUom.data),
        requestedQty: prefill.qty,
      } as MaterialIssueLineDraft;
      setLines([line]);
    }
    setIsPrefillApplied(true);
  }, [isPrefillApplied, prefill, selectedWorkOrder, prefillUom.isPending, prefillUom.data]);

  /** BOM 유래 판정을 한 자리에서 채운다 — 표의 경고와 본문의 FK 가 같은 값을 본다. */
  const resolvedLines = useMemo(
    () => resolveLineOrigins(lines, shortageLines),
    [lines, shortageLines],
  );

  /* BOM 유래 줄의 품목 이름은 품목 상세로 푼다 — 품목 목록 한 쪽에 없는 품목도 이름이 선다. */
  const itemNameSources = useItemNameSources(
    resolvedLines.filter((line) => line.origin === 'shortage').map((line) => line.itemId),
  );

  const boundCreated =
    createdBinding !== null && createdBinding.targetSignature === targetSignature
      ? createdBinding.result
      : null;

  const isLocked = create.isSaving || boundCreated !== null;

  const header: HeaderDraft = { workOrderId, ...form };
  const headerLocalErrors = validateHeader(header, {
    destinationOptional: usesProductionWarehouses,
  });

  /*
   * **아직 만지지 않은 칸에는 붉은 글씨를 세우지 않는다**(검증 발견 6). 판정은 그대로 두고
   * 표시만 미룬다 — 잠금은 아래 `publishBlockReason` 이 `headerLocalErrors` 전부를 보고 한다.
   *
   * 빈 칸에서는 로컬 판정이 서버 오류를 덮는다 — 지금 고칠 수 있는 것을 먼저 보인다.
   */
  const headerErrors = {
    ...create.fieldErrors,
    ...visibleHeaderErrors(headerLocalErrors, touched, hasAttemptedPublish),
  };
  const lineErrors = validateLines(resolvedLines).errors;

  /**
   * 이 칸을 만졌다고 적는다. **오류의 열쇠로 적는다** — 필요 일자·시각 두 칸이 `requiredAt` 오류
   * 하나를 공유하므로, 칸 이름으로 적으면 어느 쪽을 만져도 그 오류가 드러나지 않는다.
   */
  const markTouched = (fields: readonly string[]): void => {
    setTouched((prev) => {
      const next = { ...prev };

      for (const field of fields) {
        next[field] = true;
        if (field === 'requiredDate' || field === 'requiredTime') next.requiredAt = true;
      }

      return next;
    });
  };

  /**
   * 폼 값을 바꾼다.
   *
   * ⚠ **화면이 연쇄로 비운 칸은 만짐으로 치지 않는다**(`cascaded`). 창고를 바꾸면 도착 위치를
   * 화면이 스스로 비우는데, 그것까지 만짐으로 적으면 **사용자가 건드리지도 않은 칸이 즉시
   * 붉어진다** — 「만진 칸만 붉힌다」는 규칙이 바로 그 경로에서 깨진다(재검증 R2-1).
   *
   * 서버 오류는 연쇄로 비운 칸에서도 지운다 — 값이 달라졌으므로 그 오류는 이미 낡았다.
   */
  const changeForm = (
    patch: Partial<FormDraft>,
    cascaded: readonly (keyof FormDraft)[] = [],
  ): void => {
    setForm((prev) => ({ ...prev, ...patch }));
    markTouched(Object.keys(patch).filter((field) => !cascaded.includes(field as keyof FormDraft)));

    for (const field of Object.keys(patch)) create.clearFieldError(field);
  };

  const selectWorkOrder = (value: string): void => {
    setSelectedWorkOrder(workOrderRows.find((row) => String(row.workOrderId) === value) ?? null);
    create.clearFieldError('workOrderId');
  };

  /*
   * ⛔ **줄을 고쳐도 제출 도장을 손으로 버리지 않는다.** 「값이 달라졌는가」는 `stampSubmission`
   * 의 지문이 판정한다. 손으로 버리면 값을 고쳤다 **되돌렸을 때** — 보낼 값이 첫 시도와 완전히
   * 같은데도 — 새 멱등 키가 나가 전표가 둘 쌓일 수 있다(검증 발견 3).
   */
  const patchLine = (key: string, patch: Partial<Omit<MaterialIssueLineDraft, 'key'>>): void => {
    setLines((prev) => patchLineDraft(prev, key, patch));
  };

  const removeLine = (key: string): void => {
    setLines((prev) => removeLineDraft(prev, key));
  };

  const addLine = (): void => {
    setLines((prev) => addLineDraft(prev));
  };

  /**
   * 「불러오기」 — 누름이 부른 조회의 **응답을 그 자리에서** 초안에 반영한다.
   *
   * ⭐ **반영을 effect 가 아니라 이 누름의 약속(promise)에 맨다.** 「반영해도 되는 응답」은
   * 조회 상태로는 가려낼 수 없다 — 배경 재조회도 똑같이 성공하기 때문이다. `refetch()` 가
   * 돌려주는 결과는 **이 누름이 부른 조회의 결과**라, 다른 조회가 끼어들 자리가 없다.
   *
   * 앞선 두 판이 각각 다른 쪽으로 샜다 —
   *
   * | 판 | 축 | 새는 곳 |
   * | --- | --- | --- |
   * | 참조 비교 | 응답 객체 | 서버 값이 같으면 **누름이 삼켜진다** |
   * | 대기 표식 + `dataUpdatedAt` | 조회가 돌았는가 | **누르지 않은 배경 재조회**가 초안을 덮는다 |
   * | 대기 표식 + `isSuccess` | 아무 성공이나 | 실패로 표식이 굳고, 그 구간의 **배경 재조회가 표식을 소비**한다 |
   *
   * 셋 다 「누가 불렀는가」를 조회 상태에서 되짚으려 한 것이 원인이다. 약속을 쥐면 되짚을 필요가
   * 없다.
   *
   * ⛔ **실패에는 반영하지 않는다.** 실패해도 앞서 받아 둔 값이 `data` 에 남는데, 그것을 반영하면
   * **실패한 불러오기가 사용자의 편집을 옛 값으로 되돌린다.** 실패 사실은 `shortage.isError` 가
   * 배너로 이미 낸다.
   *
   * **누를 때마다 실제로 받아 온다**(`refetch`). 서버 값이 앞과 같아도 누른 사람에게는 반영이
   * 보여야 한다(검증 발견 4). `refetch` 는 조회가 꺼져 있어도 돌므로 첫 누름도 같은 길을 간다.
   */
  const loadShortage = (): void => {
    const pressedTarget = targetSignature;

    loadTargetRef.current = pressedTarget;
    setIsShortageRequested(true);
    setIsLoadPending(true);

    void (async () => {
      try {
        const result = await shortage.refetch();

        /*
         * 돌아와 보니 대상이 바뀌어 있으면 **아무것도 하지 않는다.** 약속은 관측자의 «지금»
         * 결과로 풀리므로, 확인하지 않으면 새 대상의 자료가 누르지도 않았는데 실린다.
         */
        if (loadTargetRef.current !== pressedTarget) return;

        if (result.isSuccess && result.data !== undefined) {
          setLines((prev) => replaceShortageDrafts(prev, result.data));
        }
      } catch {
        /*
         * `refetch` 는 실패를 결과로 돌려주고 던지지 않는다. 그래도 잡아 두는 이유는 던지는 판이
         * 오더라도 **화면이 대기 표식에 갇히지 않게** 하기 위해서다 — 실패 문면은 `isError` 가
         * 배너로 내므로 여기서 다시 말하지 않는다.
         */
      } finally {
        setIsLoadPending(false);
      }
    })();
  };

  /**
   * 확인 창 없이 곧바로 보낸다 — 전송 중 잠금과 성공 후 잠금 두 겹이 연타를 막는다.
   *
   * ⭐ **본문을 여기서 조립하지 않는다.** 제출 순간의 고정과 본문 조립을 잇는 이음매는
   * `usePublishSubmission` 이 진다 — 그 이음매가 이 화면에서 가장 조용히 틀릴 자리이고,
   * 화면 안에 두면 감지기가 닿지 않는다(검증 발견 1).
   */
  const publish = (acceptPlannedOverride = false): void => {
    setHasAttemptedPublish(true);
    setConflict(null);

    const input: MaterialIssueRequestInput = {
      workOrderId,
      destinationLocationId: form.destinationLocationId,
      requiredDate: form.requiredDate,
      requiredTime: form.requiredTime,
      reasonCode: form.reasonCode,
      remarks: form.remarks,
      lines: resolvedLines,
      shortage: shortageLines,
      ...(usesProductionWarehouses
        ? {
            sourceWarehouseId: form.sourceWarehouseId,
            destinationOptional: true,
            acceptPlannedOverride,
            unsourcedShortageId: prefill?.unsourcedShortageId ?? '',
          }
        : {}),
    };

    const body = submission.build(input);

    /*
     * 여기 닿으면 아무 일도 일어나지 않은 것처럼 보인다. **버튼 잠금이 이미 닫아 둔 길이라
     * 실사용에서 닿지 않는다** — `publishBlockReason` 이 W/O·도착 위치·보낼 줄을 모두 확인한
     * 뒤에야 버튼이 열리고, 그 셋이 본문 조립이 `null` 을 내는 조건의 전부다. 마지막 겹으로만 둔다.
     */
    if (body === null) return;

    submittingTargetRef.current = targetSignature;
    create.write(body);
  };

  const workOrderOptions = useMemo<SelectOption[]>(() => {
    const label = (row: WorkOrderView): string =>
      t.values.workOrderOption(
        row.workOrderNo,
        row.routingOperationName ?? t.values.empty,
        row.itemCode ?? t.values.empty,
      );
    const options = workOrderRows.map((row) => ({
      value: String(row.workOrderId),
      label: label(row),
    }));

    if (selectedWorkOrder === null) return options;

    const selectedValue = String(selectedWorkOrder.workOrderId);

    /* 검색어를 바꿔 목록에서 사라져도 고른 W/O 는 선택칸에 남는다 — 값과 표시가 갈리지 않는다. */
    return options.some((option) => option.value === selectedValue)
      ? options
      : [...options, { value: selectedValue, label: label(selectedWorkOrder) }];
  }, [workOrderRows, selectedWorkOrder]);

  const workOrderNote = (): string | undefined => {
    if (workOrders.isError) return t.filters.lookupFailed;

    const page = workOrders.data?.page;

    if (page === undefined) return undefined;

    /*
     * 0건은 **잘림과 다른 사실**이다 — 잘렸으면 좁히라 하고, 0건이면 결과가 없다고 말한다.
     * 아무 말도 없으면 빈 선택칸이 고장 난 것으로 읽힌다.
     */
    if (workOrderRows.length === 0) return t.empty.noWorkOrderOption;

    /* 잘림 판정은 선택 목록들과 같은 함수를 쓴다 — 「전체가 첫 쪽보다 많은가」 하나다. */
    return isTruncated(page, workOrderRows.length) ? t.filters.workOrderTruncated : undefined;
  };

  const warehouseNote = (): string | undefined => {
    const note = lookupNote(warehouses);

    if (note !== undefined) return note;

    return resolvedWarehouseId !== null && form.warehouseId === String(resolvedWarehouseId)
      ? t.notes.warehouseAutoFilled
      : undefined;
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={
          <Breadcrumb
            items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
      />

      <div className="material-issue-request-workspace">
        {/*
         * ⭐ **상수 표시다.** 조건부로 감추지 않는다 — 이 문장이 이 화면의 존재 이유다.
         */}
        <div className="banner-slot">
          <AlertBanner variant="info" title={t.policyNotice.title}>
            {t.policyNotice.description}
          </AlertBanner>
        </div>

        {prefill !== null && (
          <div className="banner-slot">
            <AlertBanner variant="info">{t.prefilled}</AlertBanner>
          </div>
        )}

        {workOrders.isError && (
          <LoadErrorBanner
            error={workOrders.error}
            onRetry={() => {
              void workOrders.refetch();
            }}
          />
        )}

        <TargetPane
          searchDraft={searchDraft}
          onChangeSearchDraft={setSearchDraft}
          onSearch={setAppliedQuery}
          isSearching={workOrders.isFetching}
          workOrderOptions={workOrderOptions}
          workOrderNote={workOrderNote()}
          workOrderId={workOrderId}
          onSelectWorkOrder={selectWorkOrder}
          selectedWorkOrder={selectedWorkOrder}
          uomLookup={uoms}
          warehouseOptions={toSelectOptions(warehouses)}
          warehouseNote={warehouseNote()}
          warehouseId={form.warehouseId}
          onChangeWarehouse={(value) => {
            /*
             * 창고가 바뀌면 그 창고에 없는 위치가 남지 않게 도착 위치를 비운다.
             * **비운 것은 화면이므로 만짐으로 적지 않는다** — 사용자는 창고만 건드렸다.
             */
            changeForm({ warehouseId: value, destinationLocationId: '' }, [
              'destinationLocationId',
            ]);
          }}
          locationOptions={toSelectOptions(locations)}
          locationNote={lookupNote(locations)}
          destinationLocationId={form.destinationLocationId}
          onChangeDestination={(value) => {
            changeForm({ destinationLocationId: value });
          }}
          requiredDate={form.requiredDate}
          requiredTime={form.requiredTime}
          onChangeRequiredDate={(value) => {
            changeForm({ requiredDate: value });
          }}
          onChangeRequiredTime={(value) => {
            changeForm({ requiredTime: value });
          }}
          headerErrors={headerErrors}
          isLocked={isLocked}
          sourceWarehouse={
            usesProductionWarehouses
              ? {
                  options: [
                    { value: AUTO_SOURCE, label: t.sourceWarehouse.auto },
                    ...productionWarehouses.map((warehouse) => ({
                      value: String(warehouse.warehouseId),
                      label: `${warehouse.warehouseCode} ${warehouse.warehouseName}`,
                    })),
                  ],
                  value: form.sourceWarehouseId === '' ? AUTO_SOURCE : form.sourceWarehouseId,
                  note: lacksProductionWarehouse
                    ? t.sourceWarehouse.none
                    : form.sourceWarehouseId === ''
                      ? t.sourceWarehouse.autoHelp(productionWarehouses.length)
                      : t.sourceWarehouse.fixedHelp(
                          productionWarehouses.find(
                            (warehouse) => String(warehouse.warehouseId) === form.sourceWarehouseId,
                          )?.warehouseName ?? form.sourceWarehouseId,
                        ),
                  onChange: (value) => {
                    changeForm({ sourceWarehouseId: value === AUTO_SOURCE ? '' : value });
                  },
                }
              : undefined
          }
        />

        {/* 실패해도 배너를 세우지 않는다 — 중복 확인은 알림이지 관문이 아니다(스펙 §6). */}
        <ExistingRequestBanner
          requests={existing.data?.items ?? EMPTY_EXISTING}
          total={existing.data?.total ?? 0}
        />

        {selectedWorkOrder === null ? (
          <section
            className="pane material-issue-request-pane material-issue-request-empty-pane"
            aria-label={t.panes.lines}
          >
            <h2 className="pane-title">{t.panes.lines}</h2>
            <EmptyState
              title={t.empty.noWorkOrderTitle}
              description={t.empty.noWorkOrderDescription}
            />
          </section>
        ) : (
          <>
            <LinePane
              rows={resolvedLines}
              errors={lineErrors}
              itemLookup={items}
              itemNameSources={itemNameSources}
              uomLookup={uoms}
              uomOptions={toSelectOptions(uoms)}
              isLocked={isLocked}
              isLoadingShortage={isLoadPending && shortage.isFetching}
              linesError={headerErrors.lines}
              /*
               * 「다시 시도」는 다시 누르는 것과 같다 — 같은 길(`loadShortage`)로 보낸다. 조회만
               * 다시 부르면 그 응답을 반영할 자리가 없어 표가 그대로 남는다.
               */
              shortageErrorBanner={
                shortage.isError ? (
                  <LoadErrorBanner error={shortage.error} onRetry={loadShortage} />
                ) : null
              }
              onLoadShortage={loadShortage}
              onAddLine={addLine}
              onPatchLine={patchLine}
              onRemoveLine={removeLine}
            />

            <div className="material-issue-request-footer">
              {usesProductionWarehouses && <p className="field-note">{t.reasonHelp}</p>}
              <ReasonPane
                reasons={reasons}
                reasonCode={form.reasonCode}
                onChangeReason={(value) => {
                  changeForm({ reasonCode: value });
                }}
                remarks={form.remarks}
                onChangeRemarks={(value) => {
                  changeForm({ remarks: value });
                }}
                reasonError={headerErrors.reasonCode}
                remarksError={headerErrors.remarks}
                isLocked={isLocked}
              />

              <ResultPane
                publishBlockReason={
                  lacksProductionWarehouse
                    ? t.sourceWarehouse.none
                    : publishBlockReason({
                        header,
                        lines: resolvedLines,
                        isSaving: create.isSaving,
                        hasPublished: boundCreated !== null,
                        destinationOptional: usesProductionWarehouses,
                      })
                }
                banner={conflict === null ? <SaveErrorBanner error={create.error} /> : null}
                created={boundCreated}
                onPublish={() => publish()}
              />
              {conflict !== null && (
                <PlannedStockDialog
                  conflict={conflict}
                  itemLabel={(itemId) =>
                    items.entries.find((entry) => entry.value === String(itemId))?.label ??
                    String(itemId)
                  }
                  warehouseLabel={(warehouseId) =>
                    productionWarehouses.find((warehouse) => warehouse.warehouseId === warehouseId)
                      ?.warehouseName ?? String(warehouseId)
                  }
                  isSaving={create.isSaving}
                  onFix={() => setConflict(null)}
                  onOverride={() => publish(true)}
                />
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
};
