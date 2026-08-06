import {
  AlertBanner,
  Breadcrumb,
  Button,
  EmptyState,
  PageHeader,
  SkeletonText,
  useToast,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, codeLockMessage, useMasterWrite } from '../../patterns/master';
import { selectableOptions } from './code-options';
import { DisabledAction } from './disabled-action';
import { readFilters, readPage, toSearchParams } from './filters';
import { LoadErrorBanner } from './load-error-banner';
import { toPageView } from './pagination';
import { PlanActionBanner } from './plan-action-banner';
import { PlanActionDialog, type PlanActionKind } from './plan-action-dialog';
import { PlanListPane } from './plan-list-pane';
import {
  emptyPlanFormValues,
  formatApprovedAt,
  isSamePlanValues,
  planToFormValues,
  toPlanCreate,
  toPlanUpdate,
} from './plan-mappers';
import { PlanPane } from './plan-pane';
import { PLAN_FORM_FIELDS, validatePlanForm } from './plan-validation';
import {
  planDetailPath,
  planKeys,
  useInspectionPlanDetail,
  useInspectionPlanList,
  useItemOptions,
  useProcessOptions,
  useRoutingOptions,
  type LookupResult,
} from './queries';
import type { InspectionPlan, PlanFilters, PlanFormValues } from './types';

type InspectionPlanDetailResponse = components['schemas']['InspectionPlanDetailResponse'];

const t = messages.inspectionStandard;

/** 폼의 현재 값과 그것이 어디서 나왔는지. 「고친 것이 있는가」는 둘의 비교로 판정한다. */
interface PlanFormState {
  source: InspectionPlanDetailResponse;
  baseline: PlanFormValues;
  values: PlanFormValues;
}

/**
 * W-06-02 컨테이너 — 기준 목록 → 버전 목록 → 기준·버전·항목을 3단으로 놓는다.
 *
 * **배치는 W-06-01(Routing)과 같은 3단이다.** 착수 이슈가 「버전 마스터 형 골격을 그대로
 * 재사용」을 지시했고, 접힘 기준점(1280px·720px)의 근거는 그 화면이 이미 도출해 `.three-pane`에
 * 담아 두었다 — 열 구성이 같으므로 근거를 다시 도출할 이유가 없고 `app.css`를 고치지 않는다.
 *
 * 우 칸이 2구획이 아니라 **3구획**인 이유는 자료 구조가 3계층(기준 → 버전 → 검사 항목)이고
 * 계층마다 자기 상세 조회·자기 잠금 토큰·자기 저장 실패가 있기 때문이다. 두 구획에 접으면
 * 어느 배너가 어느 저장의 실패인지 사용자가 가릴 수 없다.
 *
 * 조회 조건과 선택은 URL이 소유한다(`?q=&type=&inactive=1&page=&plan=&ver=`) —
 * 새로고침·뒤로가기·공유가 같은 화면을 낸다.
 */
export const InspectionStandardScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { client } = useApiClient();

  const filters = useMemo<PlanFilters>(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);

  const selectedPlanId = Number(searchParams.get('plan') ?? '') || null;

  const planList = useInspectionPlanList(filters, page);
  const plans = planList.data?.items ?? [];

  const planDetail = useInspectionPlanDetail(selectedPlanId);

  /*
   * 서버가 준 쪽 정보를 정본으로 쓴다. 주소의 쪽 번호를 쓰면 서버가 다른 쪽을 돌려줬을 때
   * 표시와 내용이 어긋난다. 아직 받지 못했으면 건수를 지어내지 않고 0으로 둔다.
   */
  const pageView = toPageView(planList.data?.page ?? { page, size: 0, total: 0 }, plans.length);

  const [formState, setFormState] = useState<PlanFormState | null>(null);

  /*
   * 폼의 기준값은 상세 응답에서 온다. 응답 객체가 바뀔 때만 다시 세워
   * 사용자가 입력하는 동안 값이 서버 값으로 되돌아가지 않게 한다.
   * 캐시가 같은 값을 돌려주면 객체 동일성이 유지되므로 다시 세우지 않는다.
   */
  const planSource = planDetail.data ?? null;

  if (planSource !== null && formState?.source !== planSource) {
    const seeded = planToFormValues(planSource.inspectionPlan);
    setFormState({ source: planSource, baseline: seeded, values: seeded });
  }

  const isPlanDirty = formState !== null && !isSamePlanValues(formState.values, formState.baseline);

  /** 보내기 전에 화면에서 잡은 오류. 저장을 누른 뒤에만 세운다 — 입력 도중에 붉은 글씨를 띄우지 않는다. */
  const [planFieldErrors, setPlanFieldErrors] = useState<Record<string, string>>({});

  /**
   * 기준 등록 폼의 값. null이면 폼이 닫혀 있다.
   *
   * 상세 응답이 없는 폼이라 수정 폼 상태와 섞지 않는다 —
   * 섞으면 「기준값이 서버에서 왔는가」가 흐려지고, 등록 성공 후 어느 쪽을 비울지도 갈린다.
   */
  const [createValues, setCreateValues] = useState<PlanFormValues | null>(null);
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string>>({});

  const planWrite = useMasterWrite<PlanFormValues, InspectionPlan>({
    request: (values, headers) =>
      client.PUT('/quality/inspection-plans/{inspectionPlanId}', {
        params: {
          path: { inspectionPlanId: selectedPlanId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body: toPlanUpdate(values),
      }),
    /*
     * 잠금 토큰은 상세 경로에 보관돼 있다. 보관 키가 요청 경로라 다른 경로로 꺼내면 언제나 비어 있다.
     * 이 화면의 쓰기 열 가지 중 If-Match 를 요구하는 것은 셋뿐이고(기준 수정·기준 사용 중지·버전 수정)
     * 이것이 그 하나다(계약 실측).
     */
    etagPath: selectedPlanId === null ? null : planDetailPath(selectedPlanId),
    invalidateKeys: [planKeys.all],
    knownFields: PLAN_FORM_FIELDS,
    onSuccess: (saved) => {
      setPlanFieldErrors({});
      const next = planToFormValues(saved);
      setFormState((prev) => (prev === null ? prev : { ...prev, baseline: next, values: next }));
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const createWrite = useMasterWrite<PlanFormValues, InspectionPlan>({
    request: (values, headers) =>
      client.POST('/quality/inspection-plans', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body: toPlanCreate(values),
      }),
    // 아직 없는 자원이라 잠글 대상이 없다. 201 응답에도 ETag가 없다(계약 실측).
    etagPath: null,
    invalidateKeys: [planKeys.all],
    knownFields: PLAN_FORM_FIELDS,
    onSuccess: (saved) => {
      setCreateValues(null);
      setCreateFieldErrors({});
      /*
       * 201에는 ETag가 없다 — 새 기준을 고르면 상세를 다시 조회하게 되고
       * 그 조회가 잠금 토큰을 확보한다. 여기서 옮기지 않으면 사용자가 방금 만든 기준을 직접 찾아야 한다.
       */
      selectPlan(saved.inspectionPlanId);
      toast.show({ variant: 'success', description: messages.common.created });
    },
  });

  /**
   * 승인 — **`If-Match`를 싣지 않는다.** 계약이 이 경로에 낙관적 잠금을 두지 않았다.
   * 상세 경로를 주면 토큰을 찾지 못했을 때 요청을 보내지 않고 멈춰
   * 「눌러도 아무 일이 없다」가 된다.
   *
   * **본문이 없다.** 승인자와 승인 시각은 서버가 함께 기록한다 — 화면이 보내지 않는다.
   * 응답에 `ETag`가 없으므로 성공하면 상세를 무효화해 재조회가 새 토큰을 확보하게 한다.
   */
  const approveWrite = useMasterWrite<void, InspectionPlan>({
    request: (_variables, headers) =>
      client.POST('/quality/inspection-plans/{inspectionPlanId}:approve', {
        params: {
          path: { inspectionPlanId: selectedPlanId ?? 0 },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
      }),
    etagPath: null,
    invalidateKeys: [planKeys.all],
    // 액션에는 입력칸이 없다 — 인라인으로 낼 자리가 없어 서버 오류는 전부 배너로 간다.
    knownFields: [],
    onSuccess: () => {
      setPlanAction(null);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /**
   * 사용 중지 — 같은 기준에 걸리는 액션인데도 **`If-Match`를 요구한다.**
   * 승인과 규약이 다르다(계약 실측). 여기에 `null`을 주면 서버가 거부한다.
   */
  const deactivateWrite = useMasterWrite<void, InspectionPlan>({
    request: (_variables, headers) =>
      client.POST('/quality/inspection-plans/{inspectionPlanId}:deactivate', {
        params: {
          path: { inspectionPlanId: selectedPlanId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
      }),
    etagPath: selectedPlanId === null ? null : planDetailPath(selectedPlanId),
    invalidateKeys: [planKeys.all],
    knownFields: [],
    onSuccess: () => {
      setPlanAction(null);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const [planAction, setPlanAction] = useState<PlanActionKind | null>(null);
  const planActionWrite = planAction === 'deactivate' ? deactivateWrite : approveWrite;

  /** 다른 기준으로 옮기면 앞의 편집과 실패 표시를 들고 가지 않는다. */
  const resetPlanEditing = () => {
    planWrite.reset();
    createWrite.reset();
    approveWrite.reset();
    deactivateWrite.reset();
    setPlanAction(null);
    setPlanFieldErrors({});
    setCreateFieldErrors({});
    setCreateValues(null);
  };

  /**
   * 조건·쪽이 바뀌면 **주소를 통째로 새로 만든다.**
   * 그래야 `plan`·`ver`가 자연히 사라진다 — 보이는 행이 달라지는데 선택이 남으면
   * 우 칸의 폼이 어디서 온 것인지 알 수 없다.
   */
  const applyFilters = (next: PlanFilters) => {
    resetPlanEditing();
    setSearchParams(toSearchParams(next, 1));
  };

  const changePage = (nextPage: number) => {
    resetPlanEditing();
    setSearchParams(toSearchParams(filters, nextPage));
  };

  /** 기준을 바꾸면 버전 선택을 지운다 — 다른 기준의 버전을 가리키면 안 된다. */
  function selectPlan(inspectionPlanId: number): void {
    const next = new URLSearchParams(searchParams);
    next.set('plan', String(inspectionPlanId));
    next.delete('ver');
    setSearchParams(next);
  }

  const handleSelectPlan = (inspectionPlanId: number) => {
    resetPlanEditing();
    selectPlan(inspectionPlanId);
  };

  /**
   * 라우팅은 **품목을 고른 뒤에만** 조회한다 — 계약이 `itemId`를 필수 쿼리로 두었다.
   * 지금 열려 있는 폼(등록 또는 수정)의 품목이 그 기준이다.
   */
  const activeValues = createValues ?? formState?.values ?? null;
  const activeItemId = Number(activeValues?.itemId ?? '') || null;

  const itemOptions = useItemOptions();
  const processOptions = useProcessOptions();
  const routingOptions = useRoutingOptions(activeItemId);

  /**
   * 선택 목록이 잘리거나 실패했다는 사실을 폼 위에 낸다.
   * 알리지 않으면 이름이 이유 없이 비어 보이고 사용자는 값이 사라진 줄 안다.
   */
  const optionsNotice = (() => {
    const lookups: LookupResult[] = [itemOptions, processOptions, routingOptions];

    if (lookups.some((lookup) => lookup.isError)) {
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.optionsLoadFailed}</AlertBanner>
        </div>
      );
    }

    if (lookups.some((lookup) => lookup.truncated)) {
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.optionsTruncated}</AlertBanner>
        </div>
      );
    }

    return null;
  })();

  /**
   * 값을 고치는 중에 옛 오류가 남아 있으면 무엇을 고쳐야 하는지 알 수 없다.
   *
   * **품목을 바꾸면 라우팅 값을 비운다** — 다른 품목의 라우팅을 가리키면 안 된다.
   * 계약이 공정 개정 시 자동 승계를 정하지 않았고, 이슈도 「사용자가 다시 고른다」로 확정했다.
   */
  const withItemChangeRule = (patch: Partial<PlanFormValues>): Partial<PlanFormValues> =>
    'itemId' in patch ? { ...patch, routingId: '' } : patch;

  const clearFieldErrors = (
    patch: Partial<PlanFormValues>,
    setErrors: (updater: (prev: Record<string, string>) => Record<string, string>) => void,
    clearServerError: (field: string) => void,
  ) => {
    for (const field of Object.keys(patch)) {
      clearServerError(field);
      setErrors((prev) => {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const changePlanValues = (rawPatch: Partial<PlanFormValues>) => {
    const patch = withItemChangeRule(rawPatch);

    setFormState((prev) =>
      prev === null ? prev : { ...prev, values: { ...prev.values, ...patch } },
    );
    clearFieldErrors(patch, setPlanFieldErrors, planWrite.clearFieldError);
  };

  const changeCreateValues = (rawPatch: Partial<PlanFormValues>) => {
    const patch = withItemChangeRule(rawPatch);

    setCreateValues((prev) => (prev === null ? prev : { ...prev, ...patch }));
    clearFieldErrors(patch, setCreateFieldErrors, createWrite.clearFieldError);
  };

  const handleSavePlan = () => {
    if (formState === null) return;

    const errors = validatePlanForm(formState.values);
    setPlanFieldErrors(errors);

    // 화면에서 잡히는 오류는 서버로 보내지 않는다.
    if (Object.keys(errors).length > 0) return;

    planWrite.write(formState.values);
  };

  const handleSaveCreate = () => {
    if (createValues === null) return;

    const errors = validatePlanForm(createValues);
    setCreateFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;

    createWrite.write(createValues);
  };

  /**
   * 저장 충돌을 푸는 유일한 경로. 계약이 덮어쓰기 강제를 제공하지 않으므로
   * 최신 값을 받아 다시 입력하는 수밖에 없고, 입력한 내용은 사라진다.
   */
  const handleReloadPlanDetail = () => {
    planWrite.reset();
    setPlanFieldErrors({});
    setFormState(null);
    void planDetail.refetch();
  };

  const routingDisabledReason = activeItemId === null ? t.actionReasons.routingNeedsItem : null;

  const optionsFor = (lookup: LookupResult, selected: string) =>
    selectableOptions(lookup.entries, selected);

  /**
   * 승인·사용 중지를 막는 사유. 서버가 최종 판정을 하지만(400·403·409)
   * 이미 끝난 액션은 화면이 먼저 막고 **왜 못 하는지** 알린다.
   *
   * 아직 등록하지 않은 기준에는 액션을 걸 대상 자체가 없다 — 감추지 않고 사유와 함께 비활성으로 둔다.
   */
  const savedPlan = planDetail.data?.inspectionPlan ?? null;

  const approveDisabledReason = ((): string | null => {
    if (createValues !== null || savedPlan === null) return t.actionReasons.approveNeedsPlan;
    if (formatApprovedAt(savedPlan.approvedAt) !== null) return t.actionReasons.approveAlreadyDone;

    return null;
  })();

  const deactivateDisabledReason = ((): string | null => {
    if (createValues !== null || savedPlan === null) return t.actionReasons.deactivateNeedsPlan;
    if (!savedPlan.isActive) return t.actionReasons.deactivateAlreadyDone;

    return null;
  })();

  const isPlanActionRunning = approveWrite.isSaving || deactivateWrite.isSaving;

  const renderPlanActions = (): ReactNode => (
    <>
      {approveDisabledReason === null ? (
        <div className="field-cell">
          <Button
            variant="outlined"
            disabled={isPlanActionRunning}
            onClick={() => {
              approveWrite.reset();
              setPlanAction('approve');
            }}
          >
            {t.actions.approve}
          </Button>
        </div>
      ) : (
        <DisabledAction label={t.actions.approve} reason={approveDisabledReason} />
      )}

      {deactivateDisabledReason === null ? (
        <div className="field-cell form-actions-secondary">
          <Button
            variant="outlined"
            disabled={isPlanActionRunning}
            onClick={() => {
              deactivateWrite.reset();
              setPlanAction('deactivate');
            }}
          >
            {messages.common.deactivate}
          </Button>
        </div>
      ) : (
        <DisabledAction
          label={messages.common.deactivate}
          reason={deactivateDisabledReason}
          className="form-actions-secondary"
        />
      )}
    </>
  );

  /**
   * 우 상단 편집 칸. 상세를 받지 못한 상태에서 빈 폼을 보이면 사용자가 그것을 자료로 읽는다 —
   * 선택 전·불러오는 중·실패를 각각 다른 화면으로 낸다.
   */
  const renderPlanPane = () => {
    if (createValues !== null) {
      return (
        <PlanPane
          mode="create"
          plan={null}
          values={createValues}
          onChange={changeCreateValues}
          fieldErrors={{ ...createWrite.fieldErrors, ...createFieldErrors }}
          /* 첫 등록에는 저장 충돌이 없다 — 「최신 불러오기」를 낼 자리가 아니다. */
          banner={<SaveErrorBanner error={createWrite.error} />}
          optionsNotice={optionsNotice}
          itemOptions={optionsFor(itemOptions, createValues.itemId)}
          processOptions={optionsFor(processOptions, createValues.processId)}
          routingOptions={optionsFor(routingOptions, createValues.routingId)}
          routingDisabledReason={routingDisabledReason}
          // 새로 짓는 코드는 잠길 이유가 없다. editability는 이미 있는 자원의 판정이다.
          codeLockReason={null}
          isDirty={!isSamePlanValues(createValues, emptyPlanFormValues())}
          isSaving={createWrite.isSaving}
          onSave={handleSaveCreate}
          onCancel={() => {
            createWrite.reset();
            setCreateValues(null);
            setCreateFieldErrors({});
          }}
          // 아직 없는 기준에는 승인·중지할 대상이 없다. 감추지 않고 사유와 함께 비활성으로 둔다.
          transitionActions={renderPlanActions()}
        />
      );
    }

    if (selectedPlanId === null) {
      return (
        <section className="pane" aria-label={t.panes.planForm}>
          <EmptyState size="sm" title={t.empty.planNotSelected} />
        </section>
      );
    }

    if (planDetail.isError) {
      return (
        <section className="pane" aria-label={t.panes.planForm}>
          <LoadErrorBanner error={planDetail.error} onRetry={() => void planDetail.refetch()} />
        </section>
      );
    }

    if (planDetail.data === undefined || formState === null) {
      return (
        <section className="pane" aria-label={t.panes.planForm}>
          <div role="status" aria-label={t.loading.planDetail}>
            <SkeletonText lines={5} />
          </div>
        </section>
      );
    }

    return (
      <PlanPane
        mode="edit"
        plan={planDetail.data.inspectionPlan}
        values={formState.values}
        onChange={changePlanValues}
        // 로컬 검증 결과가 서버 오류를 덮는다 — 지금 고칠 수 있는 것을 먼저 보인다.
        fieldErrors={{ ...planWrite.fieldErrors, ...planFieldErrors }}
        banner={<SaveErrorBanner error={planWrite.error} onReload={handleReloadPlanDetail} />}
        optionsNotice={optionsNotice}
        itemOptions={optionsFor(itemOptions, formState.values.itemId)}
        processOptions={optionsFor(processOptions, formState.values.processId)}
        routingOptions={optionsFor(routingOptions, formState.values.routingId)}
        routingDisabledReason={routingDisabledReason}
        // 판정의 주인은 codeEditable이다. reason은 문구 선택에만 쓴다.
        codeLockReason={codeLockMessage(planDetail.data.editability)}
        isDirty={isPlanDirty}
        isSaving={planWrite.isSaving}
        onSave={handleSavePlan}
        onCancel={() => {
          planWrite.reset();
          setPlanFieldErrors({});
          setFormState((prev) => (prev === null ? prev : { ...prev, values: prev.baseline }));
        }}
        transitionActions={renderPlanActions()}
      />
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      <div className="three-pane">
        <PlanListPane
          plans={plans}
          isLoading={planList.isPending}
          appliedFilters={filters}
          onApplyFilters={applyFilters}
          pageView={pageView}
          onChangePage={changePage}
          selectedPlanId={selectedPlanId}
          onSelect={handleSelectPlan}
          isCreating={createValues !== null}
          onAddPlan={() => {
            resetPlanEditing();
            setCreateValues(emptyPlanFormValues());
          }}
          loadError={
            planList.isError ? (
              <LoadErrorBanner error={planList.error} onRetry={() => void planList.refetch()} />
            ) : null
          }
        />

        <section className="pane" aria-label={t.panes.version}>
          <EmptyState size="sm" title={t.empty.planNotSelected} />
        </section>

        <div className="pane-stack">{renderPlanPane()}</div>
      </div>

      {/*
       * 창은 열 때만 붙인다 — 닫힌 창을 남겨 두면 지난 값이 그대로 살아 있다.
       * 되돌릴 수 없는 액션이라 확인을 한 단계 두고, **실패해도 창을 닫지 않는다** —
       * 닫으면 사용자는 무엇이 막았는지 모른 채 같은 버튼을 다시 누른다.
       */}
      {planAction !== null && (
        <PlanActionDialog
          open
          kind={planAction}
          onClose={() => {
            setPlanAction(null);
            approveWrite.reset();
            deactivateWrite.reset();
          }}
          onConfirm={() => {
            planActionWrite.write();
          }}
          isSaving={planActionWrite.isSaving}
          banner={
            <PlanActionBanner
              error={planActionWrite.error}
              /* 409는 사용 중지에만 있다(계약 실측) — 승인에 내면 헛수고를 시킨다. */
              onReload={planAction === 'deactivate' ? handleReloadPlanDetail : undefined}
            />
          }
        />
      )}
    </>
  );
};
