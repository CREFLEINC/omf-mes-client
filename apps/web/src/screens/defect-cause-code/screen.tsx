import {
  AlertBanner,
  Breadcrumb,
  Button,
  EmptyState,
  Icon,
  PageHeader,
  SkeletonText,
  useToast,
} from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, codeLockMessage, useMasterWrite } from '../../patterns/master';
import { PAGE_SIZES } from '../../patterns/page-nav';
import { PaneSplitter, useFitToViewport, usePaneSplit } from '../../patterns/po-board';
import {
  PaneHeightSplitter,
  SplitOrientationToggle,
  useSplitOrientation,
} from '../../patterns/split-orientation';
import { toApiError } from '../../patterns/request';
import { ChildCodeTable } from './child-code-table';
import { CodeDetailHead } from './code-detail-head';
import { CodeFilterBar } from './code-filter-bar';
import { CodeFormPane } from './code-form-pane';
import { CodeListPane } from './code-list-pane';
import { selectableCategoryOptions } from './code-options';
import { validateCode } from './code-validation';
import { DeactivateConfirmDialog } from './deactivate-confirm-dialog';
import {
  categoryOptionsFor,
  childCountOf,
  hasChildren,
  indexById,
  isCategory,
  orderForGrouping,
} from './hierarchy';
import {
  codeToFormValues,
  emptyCodeFormValues,
  isSameCodeValues,
  toFormFieldErrors,
  toServerFieldName,
} from './mappers';
import { UsageChips } from './usage-chips';
import { useCodeDetail, useCodeList, useCodeOptions, useProcessLabels } from './queries';
import { ProcessMappingPane } from './process-mapping-pane';
import { resolveTab } from './tabs';
import type {
  CodeDetailResult,
  Editability,
  CodeFilters,
  CodeFormValues,
  CodeKind,
  HierarchyCode,
} from './types';
import { usePageHub } from '../../patterns/page-hub';

const t = messages.defectCauseCode;
const hubText = messages.common.inspectionHub;

/**
 * 코드 잠금 사유 — 다른 기록에서 쓰는 코드는 짧은 한 줄로(사용자 시안 · #209), 그 밖(ERP 수신 등)은 공용 문구 그대로.
 * 잠김 판정의 주인은 `codeEditable` 이다(공용 문구가 정한다).
 */
const codeLockReasonOf = (editability: Editability): string | null => {
  const message = codeLockMessage(editability);
  if (message === null) return null;
  return editability.reason === 'REFERENCED' ? t.actionReasons.codeLockedReferenced : message;
};

/** 목록 · 상세 배치는 「품질 코드 관리」 묶음의 탭끼리 함께 쓴다(#209). */
const DEFECT_JUDGMENT_ORIENTATION_KEY = 'omf-mes:defect-judgment-hub:split-orientation';

/**
 * 조회 실패의 원인을 한 줄 안내로 옮긴다.
 * 저장 실패와 달리 사용자가 할 수 있는 조치가 재시도뿐이라 액션도 하나다.
 *
 * 다른 화면 슬라이스에도 같은 함수가 있으나 가져다 쓰지 않는다 —
 * 화면 슬라이스끼리 참조하면 한쪽의 사정이 다른 쪽 화면을 바꾼다.
 */
const describeLoadError = (error: ApiError): string => {
  switch (error.kind) {
    case 'network':
      return messages.httpError.offline;
    case 'http':
      if (error.status === 403) return messages.httpError.forbidden;
      // 서버가 빈 message를 주는 일이 실제로 있다. ??는 빈 문자열을 통과시켜 본문을 지운다.
      return error.message === undefined || error.message === ''
        ? messages.httpError.description
        : error.message;
    case 'conflict':
      return error.message === '' ? messages.httpError.description : error.message;
    case 'stateLocked':
    case 'validation': {
      const lines = error.errors.map((item) => item.message).join(' ');
      return lines === '' ? messages.httpError.description : lines;
    }
  }
};

interface LoadErrorBannerProps {
  error: unknown;
  onRetry: () => void;
}

/** 조회 실패 배너. 규범 6에 따라 화면이 직접 배치하는 배너는 화면이 이음매를 붙인다. */
const LoadErrorBanner = ({ error, onRetry }: LoadErrorBannerProps) => (
  <div className="banner-slot">
    <AlertBanner
      variant="error"
      title={messages.httpError.loadTitle}
      action={
        <Button variant="outlined" size="sm" onClick={onRetry}>
          {messages.common.retry}
        </Button>
      }
    >
      {describeLoadError(toApiError(error))}
    </AlertBanner>
  </div>
);

/**
 * 폼의 현재 값과 그것이 어디서 나왔는지.
 * 「고친 것이 있는가」는 둘의 비교로 판정하고, 출처가 바뀔 때만 폼을 다시 세운다 —
 * 사용자가 입력하는 동안 값이 되돌아가면 안 된다.
 */
interface CodeFormState {
  /** 등록은 「어느 탭에서 어느 상위로 여는가」를 담은 문자열, 수정은 상세 응답 객체다. */
  source: string | CodeDetailResult;
  baseline: CodeFormValues;
  values: CodeFormValues;
}

/**
 * W-06-03 컨테이너. 불량 코드와 원인 코드를 같은 부품으로 그리고,
 * 조회 조건·선택을 주소에 둔다. 어느 코드를 다룰지는 주소(경로)가 정한다(#208).
 */
const CodeMasterWorkspace = ({ kind }: { kind: CodeKind }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { client } = useApiClient();

  const tab = resolveTab(kind);
  const adapter = tab.adapter;

  /* 목록 · 상세 배치 — 검사 기준 탭과 같은 좌우 분할, 가운데 막대로 폭을 나눈다(비율은 브라우저에 남는다 · #209). */
  const { splitRef, aboveRef } = useFitToViewport();
  const split = usePaneSplit('omf-mes:defect-cause-code:split', 0.45);
  const layout = useSplitOrientation(DEFECT_JUDGMENT_ORIENTATION_KEY);
  /* 「수정」 창 — 고른 코드의 값을 고친다(#209). 등록 창은 주소(`mode=create`)가 연다. */
  const [isEditOpen, setIsEditOpen] = useState(false);

  const filters = useMemo<CodeFilters>(
    () => ({
      q: searchParams.get('q') ?? '',
      includeInactive: searchParams.get('inactive') === '1',
      // `usage=off` 는 미사용만 — 미사용 포함이 켜져 있을 때만 뜻이 있다(#209).
      inactiveOnly: searchParams.get('inactive') === '1' && searchParams.get('usage') === 'off',
      page: Math.max(1, Number(searchParams.get('page')) || 1),
      size: PAGE_SIZES.find((size) => String(size) === searchParams.get('size')) ?? 20,
    }),
    [searchParams],
  );

  const isCreateMode = searchParams.get('mode') === 'create';
  const selectedParam = Number(searchParams.get('sel') ?? '') || null;
  const selectedId = isCreateMode ? null : selectedParam;
  /** 「상세 추가」로 열면 그때 고른 대분류가 상위 초기값이 된다. */
  /*
   * 「대분류 추가」는 `as=category` 로 연다 — 고른 코드(`sel`)는 뒤 상세 카드에 그대로 두고, 상위 씨앗으로는 쓰지 않는다
   * (#209 버그 수정: 대분류 추가를 누르면 상세 카드가 비던 문제).
   */
  const isCategoryCreate = isCreateMode && searchParams.get('as') === 'category';
  const createParentSeed = isCreateMode && !isCategoryCreate ? selectedParam : null;

  const list = useCodeList(adapter, filters);
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  /*
   * 목록은 쪽으로 나뉘어 오므로(#209) 상세 코드의 대분류가 다른 쪽에 있을 수 있다 — 그룹 머리글과 상위 판정은
   * 선택지용 전체 목록까지 합친 색인으로 한다. 그래야 다른 쪽의 대분류 밑 상세가 「상위를 찾을 수 없는 코드」로 가지 않는다.
   */
  const options = useCodeOptions(adapter, true);
  const byId = useMemo(() => indexById([...options.items, ...items]), [options.items, items]);
  const rows = useMemo(() => orderForGrouping(items, byId), [items, byId]);
  const processLabelOf = useProcessLabels();

  const selected = selectedId === null ? null : (byId.get(selectedId) ?? null);

  const detail = useCodeDetail(adapter, selectedId);
  /*
   * 오른쪽 상세 카드가 보이는 코드 — 「상세 추가」 창이 열려 있는 동안에도 고른 대분류를 그대로 보인다(#209 버그 수정).
   * 수정 · 저장은 `detail` 이 맡는다. 등록이 아니면 같은 키라 요청이 하나 더 나가지 않는다.
   */
  const viewId = isCreateMode ? selectedParam : selectedId;
  const shown = useCodeDetail(adapter, viewId);

  /*
   * 폼의 기준값 출처. 수정은 상세 응답 객체가, 등록은 「어느 탭에서 어느 상위로 여는가」가 정한다.
   * 출처가 그대로면 다시 세우지 않아 사용자가 입력하는 동안 값이 서버 값으로 되돌아가지 않는다.
   * 캐시가 같은 값을 돌려주면 객체 동일성이 유지되므로 다시 세우지 않는다.
   */
  const formSource: string | CodeDetailResult | null = isCreateMode
    ? `create:${adapter.kind}:${String(createParentSeed ?? '')}`
    : (detail.data ?? null);

  const [formState, setFormState] = useState<CodeFormState | null>(null);

  if (formSource === null) {
    if (formState !== null) setFormState(null);
  } else if (formState?.source !== formSource) {
    const seeded =
      typeof formSource === 'string'
        ? emptyCodeFormValues(createParentSeed === null ? '' : String(createParentSeed))
        : codeToFormValues(formSource.code);
    setFormState({ source: formSource, baseline: seeded, values: seeded });
  }

  const formValues = formState?.values ?? emptyCodeFormValues();
  const isDirty = formState !== null && !isSameCodeValues(formState.values, formState.baseline);

  /** 보내기 전에 화면에서 잡은 오류. 저장을 누른 뒤에만 세운다 — 입력 도중에 붉은 글씨를 띄우지 않는다. */
  const [localFieldErrors, setLocalFieldErrors] = useState<
    Partial<Record<keyof CodeFormValues, string>>
  >({});

  const write = useMasterWrite<CodeFormValues, HierarchyCode>({
    request: (values, headers) =>
      isCreateMode
        ? // 등록에는 낙관적 잠금이 없다 — 계약이 If-Match를 요구하지 않는다.
          adapter.create(client, values, headers)
        : adapter.update(
            client,
            selectedId ?? 0,
            values,
            // 화면에 입력칸이 없는 값을 그대로 되돌려 보낸다 — 빠뜨리면 조용히 지워진다.
            detail.data?.processId ?? null,
            headers,
          ),
    // 잠금 토큰은 상세 경로에 보관돼 있다. 저장 응답의 ETag도 같은 경로로 갱신돼 연속 수정이 된다.
    etagPath: selectedId === null ? null : adapter.detailPath(selectedId),
    invalidateKeys: [adapter.keys.all],
    // 어댑터가 아는 세 이름만 인라인으로 낸다. 그 밖의 이름은 훅이 배너로 올린다.
    knownFields: Object.values(adapter.serverFields),
    onSuccess: (saved) => {
      setLocalFieldErrors({});

      if (isCreateMode) {
        // 이어서 한 건 더 등록할 수 있게 폼을 기준값으로 되돌린다.
        setFormState((prev) => (prev === null ? prev : { ...prev, values: prev.baseline }));
        toast.show({ variant: 'success', description: messages.common.created });
        return;
      }

      const next = codeToFormValues(saved);
      setFormState((prev) => (prev === null ? prev : { ...prev, baseline: next, values: next }));
      setIsEditOpen(false);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);

  const deactivateWrite = useMasterWrite<void, HierarchyCode>({
    request: (_variables, headers) => adapter.deactivate(client, selectedId ?? 0, headers),
    /*
     * 잠금 토큰은 상세 경로에 보관돼 있다. 요청 경로(`…:deactivate`)로 꺼내면 언제나 비어 있어
     * 사용 중지가 전부 실패한다.
     */
    etagPath: selectedId === null ? null : adapter.detailPath(selectedId),
    // 응답에 ETag가 없어 보관된 토큰이 낡는다 — 상세까지 무효화해야 다음 쓰기가 된다.
    invalidateKeys: [adapter.keys.all],
    // 대응하는 입력칸이 없다 — 필드 오류도 전부 배너로 올린다.
    knownFields: [],
    onSuccess: () => {
      setIsDeactivateOpen(false);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    setSearchParams(next);
  };

  // 조회 조건은 화면 상태가 아니라 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
  // 조건을 바꾸면 1쪽으로 돌아간다 — 지난 쪽 번호가 새 결과의 범위 밖일 수 있다(#209).
  const handleApplyFilters = (next: CodeFilters) => {
    updateParams({
      q: next.q === '' ? null : next.q,
      inactive: next.includeInactive ? '1' : null,
      usage: next.includeInactive && next.inactiveOnly ? 'off' : null,
      page: null,
      size: next.size === 20 ? null : String(next.size),
    });
  };

  const openCreateForm = (patch: Record<string, string | null>) => {
    write.reset();
    setLocalFieldErrors({});
    setIsEditOpen(false);
    updateParams({ mode: 'create', as: null, ...patch });
  };

  /** 창의 「취소」 — 고친 값을 버리고 닫는다. 등록 창은 주소에서 `mode` 를 지워 닫는다. */
  const closeForm = () => {
    setLocalFieldErrors({});
    write.reset();
    setFormState((prev) => (prev === null ? prev : { ...prev, values: prev.baseline }));
    setIsEditOpen(false);
    if (isCreateMode) updateParams({ mode: null, as: null });
  };

  /** 값을 고치는 중에 옛 오류가 남아 있으면 무엇을 고쳐야 하는지 알 수 없다. */
  const changeFormValues = (patch: Partial<CodeFormValues>) => {
    setFormState((prev) =>
      prev === null ? prev : { ...prev, values: { ...prev.values, ...patch } },
    );

    for (const field of Object.keys(patch) as (keyof CodeFormValues)[]) {
      write.clearFieldError(toServerFieldName(field, adapter.serverFields));
      setLocalFieldErrors((prev) => {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSave = () => {
    const errors = validateCode(formValues, {
      items: options.items,
      editingId: selectedId,
      /*
       * 수정에서는 폼의 기준값이 곧 「서버에 저장돼 있는 상위」다 — 저장에 성공하면 함께 갱신된다.
       * 등록에는 저장된 상위가 **없다.** 그때의 기준값은 「상세 추가」가 심은 씨앗이지 서버 값이
       * 아니므로 넘기지 않는다 — 값의 이름과 실제가 어긋난 채로 두면 다음 사람이 또 넘긴다.
       */
      savedParentId: isCreateMode ? '' : (formState?.baseline.parentId ?? ''),
    });
    setLocalFieldErrors(errors);

    // 화면에서 잡히는 오류는 서버로 보내지 않는다.
    if (Object.keys(errors).length > 0) return;

    write.write(formValues);
  };

  /**
   * 저장 충돌을 푸는 유일한 경로. 계약이 덮어쓰기 강제를 제공하지 않으므로
   * 최신 값을 받아 다시 입력하는 수밖에 없고, 입력한 내용은 사라진다.
   */
  const handleReloadDetail = () => {
    write.reset();
    setLocalFieldErrors({});
    setFormState(null);
    void detail.refetch();
  };

  /**
   * 선택 목록이 잘리거나 실패했다는 사실을 폼 위에 낸다.
   * 알리지 않으면 선택칸이 이유 없이 비어 보이고 사용자는 값이 사라진 줄 안다.
   */
  const optionsNotice = (): ReactNode => {
    if (options.isError) {
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.optionsLoadFailed}</AlertBanner>
        </div>
      );
    }

    if (options.truncated) {
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.optionsTruncated}</AlertBanner>
        </div>
      );
    }

    return null;
  };

  /*
   * 하위가 있는 코드에 상위를 지정하면 그 하위가 3계층이 된다(차단 R3).
   * 선택칸을 잠그고 사유를 붙이는 것이 1차 방어이고, validateCode가 2차 방어다.
   */
  const parentLockReason =
    selectedId !== null && hasChildren(options.items, selectedId)
      ? t.actionReasons.parentLockedByChildren
      : null;

  const parentOptions = selectableCategoryOptions(
    categoryOptionsFor(options.items, selectedId),
    formValues.parentId,
    options,
  );

  /*
   * 하위가 딸린 대분류를 중지하면 영향 범위가 넓다. 누르기 전에 그 건수를 보인다.
   * 표가 쪽으로 나뉘므로(#209) 쪽 목록이 아니라 미사용까지 받은 전체 목록으로 센다.
   */
  const selectedCode = selected ?? detail.data?.code ?? null;
  const deactivateChildCount =
    selectedCode !== null &&
    isCategory(selectedCode) &&
    childCountOf(options.items, selectedCode.id) > 0
      ? childCountOf(options.items, selectedCode.id)
      : null;

  /* 탭 줄 사용 여부 칩의 건수(사용자 지시 · #209) — 미사용까지 받은 전체 목록으로 센다. 받기 전이면 건수 없이 낸다. */
  const usageCounts = options.isLoading
    ? null
    : {
        all: options.items.length,
        active: options.items.filter((item) => item.isActive).length,
        inactive: options.items.filter((item) => !item.isActive).length,
      };

  const codeListPane = (
    <CodeListPane
      adapter={adapter}
      rows={rows}
      byId={byId}
      isLoading={list.isPending}
      appliedFilters={filters}
      onApplyFilters={handleApplyFilters}
      selectedId={selectedId}
      pageMeta={list.data?.page ?? { page: filters.page, size: filters.size, total: 0 }}
      onChangePage={(page) => updateParams({ page: page === 1 ? null : String(page) })}
      onChangePageSize={(size) =>
        updateParams({ page: null, size: size === 20 ? null : String(size) })
      }
      processLabelOf={processLabelOf}
      onSelect={(id) => {
        setIsEditOpen(false);
        updateParams({ sel: String(id), mode: null, as: null });
      }}
      // 대분류 추가는 선택을 지운다 — 어느 코드의 하위도 아닌 새 축이다.
      onAddCategory={() => openCreateForm({ as: 'category' })}
      loadError={
        list.isError ? (
          <LoadErrorBanner error={list.error} onRetry={() => void list.refetch()} />
        ) : null
      }
    />
  );

  /*
   * 조회 · 초기화 뒤 구분선 너머의 화면 단추 — 검사 기준 탭의 「기준 추가」 자리와 같다(#209).
   * 상세 추가는 대분류를 고른 뒤 상세 카드에서 한다(사용자 지시 2026-10-29).
   */
  const filterActions = (
    <Button
      leadingIcon={<Icon name="add" size={18} />}
      onClick={() => openCreateForm({ as: 'category' })}
    >
      {t.actions.addCategory}
    </Button>
  );

  const formTitle = (): string => {
    if (!isCreateMode) return t.dialog.editTitle(adapter.labels.tab);
    return createParentSeed === null
      ? t.dialog.createCategoryTitle(adapter.labels.tab)
      : t.dialog.createChildTitle(adapter.labels.tab);
  };

  const renderForm = (formMode: 'create' | 'edit'): ReactNode => (
    <CodeFormPane
      adapter={adapter}
      mode={formMode}
      title={formTitle()}
      values={formValues}
      onChange={changeFormValues}
      // 로컬 검증 결과가 서버 오류를 덮는다 — 지금 고칠 수 있는 것을 먼저 보인다.
      fieldErrors={{
        ...toFormFieldErrors(write.fieldErrors, adapter.serverFields),
        ...localFieldErrors,
      }}
      banner={
        <>
          {optionsNotice()}
          <SaveErrorBanner
            error={write.error}
            onReload={formMode === 'edit' ? handleReloadDetail : undefined}
          />
        </>
      }
      codeLockReason={
        formMode === 'edit' && detail.data !== undefined
          ? codeLockReasonOf(detail.data.editability)
          : null
      }
      parentOptions={parentOptions}
      parentLockReason={parentLockReason}
      // 상세(상위가 있는 코드)를 추가 · 수정할 때만 상위에 필수 표시를 붙인다 — 표시뿐, 저장 규칙은 그대로다.
      parentRequired={
        formMode === 'create'
          ? createParentSeed !== null
          : (formState?.baseline.parentId ?? '') !== ''
      }
      isDirty={isDirty}
      isSaving={write.isSaving}
      onSave={handleSave}
      onCancel={closeForm}
    />
  );

  /** 창은 열 때만 붙인다 — 닫힌 창을 남겨 두면 지난 값이 그대로 살아 있다. */
  const renderFormDialog = (): ReactNode => {
    if (isCreateMode) return formState === null ? null : renderForm('create');
    if (isEditOpen && detail.data !== undefined && formState !== null) return renderForm('edit');
    return null;
  };

  /** 상위 대분류의 표시(「코드 · 명칭」). 목록이 조건으로 걸러져도 찾게 선택지 목록까지 본다. */
  const parentLabelOf = (code: HierarchyCode): string | null => {
    if (code.parentId === null) return null;
    const parent =
      byId.get(code.parentId) ?? options.items.find((item) => item.id === code.parentId);
    return parent === undefined
      ? String(code.parentId)
      : t.values.groupHeader(parent.code, parent.name);
  };

  /**
   * 우 칸. 상세를 받지 못한 상태에서 빈 카드를 보이면 사용자가 그것을 자료로 읽는다 —
   * 선택 전·불러오는 중·실패를 각각 다른 화면으로 낸다.
   */
  const renderDetail = (): ReactNode => {
    if (viewId === null) {
      return (
        <section className="pane" aria-label={t.detail.title(adapter.labels.tab)}>
          <EmptyState
            size="sm"
            /* 둥근 바탕 위 아이콘 · 제목 · 설명 — 검사 기준 탭과 같은 모양(#196). */
            icon={
              <span className="inspection-standard-empty-icon">
                <Icon name="layers" size={20} />
              </span>
            }
            title={t.empty.codeNotSelectedTitle}
            description={t.empty.codeNotSelectedDescription}
          />
        </section>
      );
    }

    if (shown.isError) {
      return (
        <section className="pane" aria-label={t.detail.title(adapter.labels.tab)}>
          <LoadErrorBanner error={shown.error} onRetry={() => void shown.refetch()} />
        </section>
      );
    }

    if (shown.data === undefined) {
      return (
        <section className="pane" aria-label={t.detail.title(adapter.labels.tab)}>
          <div role="status" aria-label={t.loading.codeDetail}>
            <SkeletonText lines={4} />
          </div>
        </section>
      );
    }

    const code = shown.data.code;
    return (
      <section
        className="pane inspection-standard-detail-card"
        aria-label={t.detail.title(adapter.labels.tab)}
      >
        <CodeDetailHead
          adapter={adapter}
          code={code}
          parentLabel={parentLabelOf(code)}
          processLabel={processLabelOf(shown.data.processId)}
          referenceCount={shown.data.editability.referenceCount ?? null}
          // 대분류를 고르면 상세 카드에서 상세를 추가한다 — 고른 대분류가 상위 초기값이 된다.
          // 창이 열려 있는 동안에도 뒤 카드의 단추는 그대로 둔다 — 보이는 코드(`viewId`)로 판정한다(#209 버그 수정).
          onAddChild={isCategory(code) ? () => openCreateForm({}) : undefined}
          onEdit={() => {
            write.reset();
            setLocalFieldErrors({});
            setIsEditOpen(true);
          }}
          onDeactivate={() => {
            deactivateWrite.reset();
            setIsDeactivateOpen(true);
          }}
        />
        {/* 대분류를 고르면 딸린 하위 코드를 함께 본다(사용자 지시 · #209). 미사용까지 받은 전체 목록 기준. */}
        {isCategory(code) && (
          <ChildCodeTable
            // 다른 대분류를 고르면 쪽을 1로 되돌린다.
            key={code.id}
            adapter={adapter}
            codes={options.items
              .filter((item) => item.parentId === code.id && item.id !== code.id)
              .sort((left, right) => left.code.localeCompare(right.code))}
            processLabelOf={processLabelOf}
          />
        )}
      </section>
    );
  };

  return (
    <>
      {/* 탭 줄 오른쪽 — 사용 여부 칩 다음에 좌우·상하 배치(사용자 지시 · #209). 그린 순서대로 선다. */}
      <UsageChips
        counts={usageCounts}
        value={filters.inactiveOnly ? 'inactive' : filters.includeInactive ? 'all' : 'active'}
        onChange={(usage) =>
          handleApplyFilters({
            ...filters,
            includeInactive: usage !== 'active',
            inactiveOnly: usage === 'inactive',
          })
        }
      />
      <SplitOrientationToggle orientation={layout.orientation} onChange={layout.change} />

      {/* 조회 조건 — 검사 기준 탭처럼 목록과 다른 카드에 둔다(#209). */}
      <section
        ref={aboveRef}
        className="pane inspection-standard-search defect-cause-search"
        role="search"
      >
        <CodeFilterBar
          adapter={adapter}
          appliedFilters={filters}
          onApplyFilters={handleApplyFilters}
          actions={filterActions}
        />
      </section>

      <div
        ref={splitRef}
        className={`po-board-split inspection-split inspection-standard-split defect-cause-split${layout.orientation === 'column' ? ' is-stacked' : ''}`}
        style={{ ...split.style, ...layout.style }}
      >
        {codeListPane}

        <PaneSplitter label={hubText.splitter} ratio={split.ratio} onChange={split.commit} />
        {layout.orientation === 'column' && (
          <PaneHeightSplitter
            label={hubText.heightSplitter}
            height={layout.listHeight}
            onChange={layout.changeListHeight}
          />
        )}

        <div className="inspection-standard-detail">{renderDetail()}</div>
      </div>

      {renderFormDialog()}

      <DeactivateConfirmDialog
        open={isDeactivateOpen}
        onClose={() => setIsDeactivateOpen(false)}
        onConfirm={() => deactivateWrite.write(undefined)}
        isSaving={deactivateWrite.isSaving}
        childCount={deactivateChildCount}
        // 충돌은 상세를 다시 받아 잠금 토큰을 갱신하면 풀린다. 버릴 입력이 없다.
        banner={<SaveErrorBanner error={deactivateWrite.error} onReload={handleReloadDetail} />}
      />
    </>
  );
};

type ScreenTab = 'defect' | 'cause' | 'mapping';

/** 하위 탭마다 고유 주소 — 「품질 코드 관리」 탭 막대 한 줄에 선다(사용자 지시 · #208). */
const TAB_PATHS: Record<ScreenTab, string> = {
  defect: '/master-data/defect-cause-code',
  cause: '/master-data/cause-code',
  mapping: '/master-data/defect-process-mapping',
};

interface DefectCauseCodeScreenProps {
  /** 보일 하위 탭. 주소가 정한다 — 종전 주소(불량코드)는 비워 둔다. */
  tab?: ScreenTab;
}

/**
 * W-06-03의 현상·원인·공정 매핑 세 축. 하위 탭은 셸 탭 막대(주소)로 고른다 — 화면 안 탭 줄은 두지 않는다(#208).
 * 다른 하위 탭 화면은 렌더하지 않아 숨은 요청을 만들지 않는다.
 */
export const DefectCauseCodeScreen = ({ tab }: DefectCauseCodeScreenProps) => {
  const hub = usePageHub();
  const [searchParams] = useSearchParams();

  /*
   * 종전 주소 `?tab=cause|mapping` 은 새 주소로 옮긴다(다른 질의값은 그대로) — 북마크·다른 화면 연결이 산다.
   */
  const legacyTab = searchParams.get('tab');
  if (tab === undefined && (legacyTab === 'cause' || legacyTab === 'mapping')) {
    const rest = new URLSearchParams(searchParams);
    rest.delete('tab');
    const search = rest.toString();
    return (
      <Navigate
        replace
        to={{ pathname: TAB_PATHS[legacyTab], search: search === '' ? '' : `?${search}` }}
      />
    );
  }

  const activeTab: ScreenTab = tab ?? 'defect';

  return (
    <>
      {/* 탭 묶음 안이면 탭 막대가 화면 이름을 말한다 — 경로·제목을 세우지 않는다(#208 · 검사 기준 탭과 같다). */}
      {hub === null && (
        <PageHeader
          title={t.title}
          breadcrumb={
            <Breadcrumb
              items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
              aria-label={messages.common.shell.breadcrumb}
            />
          }
        />
      )}
      {/* key — 하위 탭을 옮기면 폼·선택 상태를 새로 세운다. 탭끼리 상태가 섞이지 않는다. */}
      {activeTab === 'mapping' ? (
        <ProcessMappingPane key="mapping" />
      ) : (
        <CodeMasterWorkspace key={activeTab} kind={activeTab} />
      )}
    </>
  );
};
