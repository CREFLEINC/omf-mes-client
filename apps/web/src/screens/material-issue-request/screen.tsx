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
  lookupNote,
  useItemOptions,
  useLocationDetail,
  useLocationOptions,
  useUomOptions,
  useWarehouseOptions,
  type LookupResult,
} from './lookups';
import {
  stampSubmission,
  toMaterialIssueRequestBody,
  type MaterialIssueRequestInput,
  type SubmissionStamp,
} from './material-issue-request-body';
import { useMaterialIssueRequestMutation } from './mutations';
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
import { publishBlockReason, validateHeader, validateLines, type HeaderDraft } from './validation';

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
  const [createdBinding, setCreatedBinding] = useState<CreatedBinding | null>(null);

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

  /** 이미 초안에 반영한 소요 응답. 같은 응답을 두 번 반영해 사용자가 고친 값을 되돌리지 않는다. */
  const appliedShortageRef = useRef<readonly ShortageLineView[] | null>(null);
  const submittedStampRef = useRef<SubmissionStamp | null>(null);
  const submittingTargetRef = useRef<TargetSignature | null>(null);

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

  /* 대상이 바뀌면 이 W/O 에 매인 것을 전부 비운다 — 앞 W/O 의 줄이 새 대상에 실리면 안 된다. */
  useEffect(() => {
    setForm((prev) => ({ ...prev, warehouseId: '', destinationLocationId: '' }));
    setLines([]);
    setIsShortageRequested(false);
    appliedShortageRef.current = null;
    submittedStampRef.current = null;
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
   */
  useEffect(() => {
    if (shortage.data === undefined) return;
    if (appliedShortageRef.current === shortage.data) return;

    const arrived = shortage.data;

    appliedShortageRef.current = arrived;
    setLines((prev) => replaceShortageDrafts(prev, arrived));
    submittedStampRef.current = null;
  }, [shortage.data]);

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
  /* 빈 칸에서는 로컬 판정이 서버 오류를 덮는다 — 지금 고칠 수 있는 것을 먼저 보인다. */
  const headerErrors = { ...create.fieldErrors, ...headerLocalErrors };
  const lineErrors = validateLines(resolvedLines).errors;

  const changeForm = (patch: Partial<FormDraft>): void => {
    setForm((prev) => ({ ...prev, ...patch }));
    submittedStampRef.current = null;

    for (const field of Object.keys(patch)) create.clearFieldError(field);
  };

  const selectWorkOrder = (value: string): void => {
    setSelectedWorkOrder(workOrderRows.find((row) => String(row.workOrderId) === value) ?? null);
    create.clearFieldError('workOrderId');
  };

  const patchLine = (key: string, patch: Partial<Omit<MaterialIssueLineDraft, 'key'>>): void => {
    setLines((prev) => patchLineDraft(prev, key, patch));
    submittedStampRef.current = null;
  };

  const removeLine = (key: string): void => {
    setLines((prev) => removeLineDraft(prev, key));
    submittedStampRef.current = null;
  };

  const addLine = (): void => {
    setLines((prev) => addLineDraft(prev));
    submittedStampRef.current = null;
  };

  /** 「불러오기」 — 처음이면 조회를 열고, 이미 받았으면 다시 받는다. */
  const loadShortage = (): void => {
    if (!isShortageRequested) {
      setIsShortageRequested(true);
      return;
    }

    void shortage.refetch();
  };

  /**
   * 확인 창 없이 곧바로 보낸다 — 전송 중 잠금과 성공 후 잠금 두 겹이 연타를 막는다.
   *
   * ⭐ **제출 순간을 초안에 매어 둔다.** 본문 조립 안에서 `new Date()` 를 뜨면 `businessDate`·
   * `occurredAt` 이 매번 달라져 공통 쓰기 훅의 지문이 재시도마다 새 멱등 키를 만든다 — 서버가
   * 중복 요청을 막지 않으므로 같은 전표가 둘 쌓인다.
   */
  const publish = (): void => {
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

    const stamp = stampSubmission(submittedStampRef.current, input, new Date());

    submittedStampRef.current = stamp;

    const body = toMaterialIssueRequestBody(input, stamp.at);

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

    return page !== undefined && page.total > workOrderRows.length
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
          /* 창고가 바뀌면 그 창고에 없는 위치가 남지 않게 도착 위치를 비운다. */
          changeForm({ warehouseId: value, destinationLocationId: '' });
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
