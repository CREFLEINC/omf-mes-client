import { AlertBanner, Breadcrumb, EmptyState, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useRef, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { resolveLineOrigins } from './bom-origin';
import { ExistingRequestBanner } from './existing-request-banner';
import { addLineDraft, patchLineDraft, removeLineDraft, replaceShortageDrafts } from './line-draft';
import { LinePane } from './line-pane';
import { LoadErrorBanner } from './load-error-banner';
import {
  isTruncated,
  lookupNote,
  useItemOptions,
  useLocationDetail,
  useLocationOptions,
  useUomOptions,
  useWarehouseOptions,
  type LookupResult,
} from './lookups';
import type { MaterialIssueRequestInput } from './material-issue-request-body';
import { useMaterialIssueRequestMutation } from './mutations';
import { usePublishSubmission } from './publish-submission';
import { useExistingRequests, useShortage, useWorkOrderSearch } from './queries';
import { ReasonPane } from './reason-pane';
import { useReasonOptions } from './reason-options';
import { ResultPane } from './result-pane';
import { TargetPane } from './target-pane';
import type {
  CreatedRequestView,
  ExistingRequestView,
  MaterialIssueLineDraft,
  SelectOption,
  ShortageLineView,
  WorkOrderView,
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
  warehouseId: string;
  destinationLocationId: string;
  requiredDate: string;
  requiredTime: string;
  reasonCode: string;
  remarks: string;
}

const EMPTY_FORM: FormDraft = {
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
 * W-02-10 컨테이너 — **긴급 W/O 등으로 부족한 자재를 무절차 반출 없이 정식 출고로 경유시킨다.**
 *
 * 구획 셋과 액션 하나다 — ① 대상 W/O · ② 요청 품목 · ③ 사유 / [요청 발행].
 *
 * ⛔ **원인 W/O 칸을 만들지 않는다**(스펙 §5-2). `workOrderId` 는 「투입 대상」이고 「발생 원인」은
 * 사유 코드가 대신한다.
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
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderView | null>(null);
  const [form, setForm] = useState<FormDraft>(EMPTY_FORM);
  const [lines, setLines] = useState<MaterialIssueLineDraft[]>([]);
  const [isShortageRequested, setIsShortageRequested] = useState(false);
  /** 「불러오기」를 누른 횟수. 서버 값이 그대로여도 누름이 반영되게 하는 축이다 */
  const [loadCount, setLoadCount] = useState(0);
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
  /** 제출 순간의 고정은 이 훅이 진다 — 화면은 본문을 직접 조립하지 않는다. */
  const submission = usePublishSubmission();

  const create = useMaterialIssueRequestMutation({
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
    setForm((prev) => ({ ...prev, warehouseId: '', destinationLocationId: '' }));
    setLines([]);
    setIsShortageRequested(false);
    resetCreateIfIdle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId]);

  /*
   * 도착 위치 자동 채움 — W/O 의 기본 재공 위치가 속한 창고를 찾아 창고·위치를 함께 세운다.
   * **사용자가 이미 고른 값을 덮지 않는다**(둘 다 비어 있을 때만 채운다). 상세 조회가 실패하면
   * 아무것도 채우지 않는다 — 조용히 첫 창고를 고르면 잘못된 위치가 전표에 실린다.
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
  }, [defaultWipLocationId, resolvedWarehouseId]);

  /*
   * 소요 응답이 도착하면 **BOM 유래 줄만** 갈아 끼운다. 손으로 더한 줄은 키까지 그대로 남는다 —
   * 지우면 사용자가 담은 품목이 조용히 사라진다.
   *
   * ⭐ **응답의 참조로 가드하지 않는다.** react-query 는 내용이 같은 응답에 **같은 참조**를
   * 돌려주므로(구조적 공유), 참조로 가드하면 서버 값이 그대로일 때 「불러오기」를 다시 눌러도
   * 아무 일도 일어나지 않는다 — 사용자에게는 버튼이 안 먹는 것으로 읽히고, 고쳐 둔 요청 수량이
   * 부족량으로 되돌아간다는 감지기의 단언과도 어긋난다(검증 발견 4). **불러오기는 사용자가 고른
   * 명시적 동작이므로 누를 때마다 반영한다.**
   *
   * 누름 횟수(`loadCount`)와 불러온 시각을 함께 본다 — 누름만으로도 캐시에 있는 값이 곧바로
   * 다시 서고, 새 응답이 도착하면 한 번 더 선다. 둘 다 같은 함수를 지나므로 두 번 반영해도 결과가
   * 같다. 시각만 보면 두 응답이 같은 밀리초에 끝나는 드문 경우에 누름이 삼켜진다.
   *
   * `isShortageRequested` 를 함께 본다 — 대상을 바꾼 직후에는 조회가 꺼져 있는데, 캐시에 남은
   * 앞선 응답이 그대로 보여 **버튼을 누르지 않았는데** 줄이 서는 것을 막는다.
   */
  useEffect(() => {
    if (!isShortageRequested || shortage.data === undefined) return;

    const arrived = shortage.data;

    setLines((prev) => replaceShortageDrafts(prev, arrived));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortage.dataUpdatedAt, loadCount, isShortageRequested]);

  /** BOM 유래 판정을 한 자리에서 채운다 — 표의 경고와 본문의 FK 가 같은 값을 본다. */
  const resolvedLines = useMemo(
    () => resolveLineOrigins(lines, shortageLines),
    [lines, shortageLines],
  );

  const boundCreated =
    createdBinding !== null && createdBinding.targetSignature === targetSignature
      ? createdBinding.result
      : null;

  const isLocked = create.isSaving || boundCreated !== null;

  const header: HeaderDraft = { workOrderId, ...form };
  const headerLocalErrors = validateHeader(header);

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
   * 「불러오기」 — 처음이면 조회를 열고, 이미 받았으면 다시 받는다.
   *
   * 누름 자체를 세어 둔다. 서버 값이 앞과 같아도 **누른 사람에게는 반영이 보여야 한다**
   * (검증 발견 4).
   */
  const loadShortage = (): void => {
    setLoadCount((count) => count + 1);

    if (!isShortageRequested) {
      setIsShortageRequested(true);
      return;
    }

    void shortage.refetch();
  };

  /**
   * 확인 창 없이 곧바로 보낸다 — 전송 중 잠금과 성공 후 잠금 두 겹이 연타를 막는다.
   *
   * ⭐ **본문을 여기서 조립하지 않는다.** 제출 순간의 고정과 본문 조립을 잇는 이음매는
   * `usePublishSubmission` 이 진다 — 그 이음매가 이 화면에서 가장 조용히 틀릴 자리이고,
   * 화면 안에 두면 감지기가 닿지 않는다(검증 발견 1).
   */
  const publish = (): void => {
    setHasAttemptedPublish(true);

    const input: MaterialIssueRequestInput = {
      workOrderId,
      destinationLocationId: form.destinationLocationId,
      requiredDate: form.requiredDate,
      requiredTime: form.requiredTime,
      reasonCode: form.reasonCode,
      remarks: form.remarks,
      lines: resolvedLines,
      shortage: shortageLines,
    };

    const body = submission.build(input);

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

    /* 잘림 판정은 선택 목록들과 같은 함수를 쓴다 — 「전체가 첫 쪽보다 많은가」 하나다. */
    return page !== undefined && isTruncated(page, workOrderRows.length)
      ? t.filters.workOrderTruncated
      : undefined;
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
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {/*
       * ⭐ **상수 표시다.** 조건부로 감추지 않는다 — 이 문장이 이 화면의 존재 이유다.
       */}
      <div className="banner-slot">
        <AlertBanner variant="info" title={t.policyNotice.title}>
          {t.policyNotice.description}
        </AlertBanner>
      </div>

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
          changeForm({ warehouseId: value, destinationLocationId: '' }, ['destinationLocationId']);
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
      />

      {/* 실패해도 배너를 세우지 않는다 — 중복 확인은 알림이지 관문이 아니다(스펙 §6). */}
      <ExistingRequestBanner requests={existing.data ?? EMPTY_EXISTING} />

      {selectedWorkOrder === null ? (
        <section className="pane" aria-label={t.panes.lines}>
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
            uomLookup={uoms}
            itemOptions={toSelectOptions(items)}
            uomOptions={toSelectOptions(uoms)}
            isLocked={isLocked}
            isLoadingShortage={isShortageRequested && shortage.isFetching}
            shortageErrorBanner={
              shortage.isError ? (
                <LoadErrorBanner
                  error={shortage.error}
                  onRetry={() => {
                    void shortage.refetch();
                  }}
                />
              ) : null
            }
            onLoadShortage={loadShortage}
            onAddLine={addLine}
            onPatchLine={patchLine}
            onRemoveLine={removeLine}
          />

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
            remarksError={headerErrors.remarks}
            isLocked={isLocked}
          />

          <ResultPane
            publishBlockReason={publishBlockReason({
              header,
              lines: resolvedLines,
              isSaving: create.isSaving,
              hasPublished: boundCreated !== null,
            })}
            banner={<SaveErrorBanner error={create.error} />}
            created={boundCreated}
            onPublish={publish}
          />
        </>
      )}
    </>
  );
};
