import {
  AlertBanner,
  Breadcrumb,
  Button,
  EmptyState,
  Icon,
  PageHeader,
  SkeletonText,
  Tabs,
  useToast,
} from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, codeLockMessage, useMasterWrite } from '../../patterns/master';
import { PaneSplitter, useFitToViewport, usePaneSplit } from '../../patterns/po-board';
import { PAGE_SIZES, type PageSize } from '../../patterns/page-nav';
import { toApiError } from '../../patterns/request';
import {
  PaneHeightSplitter,
  QUALITY_STANDARD_ORIENTATION_KEY,
  SplitOrientationToggle,
  useSplitOrientation,
} from '../../patterns/split-orientation';
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
import { isTruncated, useCodeDetail, useCodeList, useCodeOptions } from './queries';
import { ProcessMappingPane } from './process-mapping-pane';
import { CODE_TABS, resolveTab } from './tabs';
import type { CodeDetailResult, CodeFilters, CodeFormValues, HierarchyCode } from './types';
import { HUB_ACTIONS_ID } from '../../patterns/hub-actions';
import { usePageHub } from '../../patterns/page-hub';

const t = messages.defectCauseCode;

/** 목록 한 쪽의 처음 건수 — 서버 기본 크기(50)와 같아 처음 열면 받은 줄이 한 쪽에 다 선다(#208). */
const DEFAULT_LIST_SIZE: PageSize = 50;
const hubText = messages.common.inspectionHub;

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
 * 탭·조회 조건·선택을 주소에 둔다.
 */
const CodeMasterWorkspace = () => {
  /*
   * 좌우 · 상하 배치 · 폭/높이 손잡이 · 창 높이 맞춤 — 검사 기준 탭과 같다(사용자 지시 · #208).
   * 배치는 탭 묶음이 함께 쓰고, 폭 비율은 불량코드 · 원인코드 하위 탭이 함께 쓴다.
   */
  const { splitRef, aboveRef } = useFitToViewport();
  const split = usePaneSplit('omf-mes:defect-cause-code:split', 0.4);
  const layout = useSplitOrientation(QUALITY_STANDARD_ORIENTATION_KEY);
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { client } = useApiClient();

  const tab = resolveTab(searchParams.get('tab'));
  const adapter = tab.adapter;

  const filters = useMemo<CodeFilters>(
    () => ({
      q: searchParams.get('q') ?? '',
      includeInactive: searchParams.get('inactive') === '1',
    }),
    [searchParams],
  );

  const isCreateMode = searchParams.get('mode') === 'create';
  const selectedParam = Number(searchParams.get('sel') ?? '') || null;
  const selectedId = isCreateMode ? null : selectedParam;
  /** 「상세 추가」로 열면 그때 고른 대분류가 상위 초기값이 된다. */
  const createParentSeed = isCreateMode ? selectedParam : null;

  const list = useCodeList(adapter, filters);
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const byId = useMemo(() => indexById(items), [items]);
  const rows = useMemo(() => orderForGrouping(items, byId), [items, byId]);

  /*
   * 쪽 이동 — 받은 줄(대분류별로 묶어 정렬한 뒤)을 화면이 쪽으로 나눈다(사용자 지시 · #208).
   * 서버 쪽 이동은 쓰지 않는다: 서버는 코드값 순으로 자르므로 대분류와 그 상세가 다른 쪽으로 갈리면
   * 상세가 「상위 없음」 묶음으로 잘못 보인다. 묶음 머리는 쪽마다 다시 선다(상위 색인은 받은 전체로 판정).
   * 조회 요청은 종전 그대로(크기 없이 서버 기본)라 받는 줄 · 잘림 안내가 바뀌지 않는다. 기본 50건이라 처음 열면 종전과 같다.
   */
  const listSize: PageSize =
    PAGE_SIZES.find((size) => String(size) === searchParams.get('size')) ?? DEFAULT_LIST_SIZE;
  const listPageCount = Math.max(1, Math.ceil(rows.length / listSize));
  const listPageNo = Math.min(
    Math.max(1, Math.trunc(Number(searchParams.get('page'))) || 1),
    listPageCount,
  );
  const pageRows = useMemo(
    () => rows.slice((listPageNo - 1) * listSize, listPageNo * listSize),
    [rows, listPageNo, listSize],
  );

  const selected = selectedId === null ? null : (byId.get(selectedId) ?? null);
  const canAddChild = selected !== null && isCategory(selected);

  const detail = useCodeDetail(adapter, selectedId);

  const isFormOpen = isCreateMode || selectedId !== null;
  const options = useCodeOptions(adapter, isFormOpen);

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

  const listPage = list.data?.page;
  const listTruncated = listPage !== undefined && isTruncated(listPage, items.length);

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
  const handleApplyFilters = (next: CodeFilters) => {
    updateParams({
      q: next.q === '' ? null : next.q,
      inactive: next.includeInactive ? '1' : null,
      page: null,
    });
  };

  const openCreateForm = (patch: Record<string, string | null>) => {
    write.reset();
    setLocalFieldErrors({});
    updateParams({ mode: 'create', ...patch });
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
   * 세는 대상은 지금 화면에 그려진 목록이라 문구가 「표시된 목록 기준」이라고 밝힌다.
   */
  const selectedCode = selected ?? detail.data?.code ?? null;
  const deactivateChildCount =
    selectedCode !== null && isCategory(selectedCode) && childCountOf(items, selectedCode.id) > 0
      ? childCountOf(items, selectedCode.id)
      : null;

  const renderForm = (formMode: 'create' | 'edit'): ReactNode => (
    <CodeFormPane
      adapter={adapter}
      mode={formMode}
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
          ? codeLockMessage(detail.data.editability)
          : null
      }
      parentOptions={parentOptions}
      parentLockReason={parentLockReason}
      isActive={detail.data?.code.isActive ?? true}
      isDirty={isDirty}
      isSaving={write.isSaving}
      onSave={handleSave}
      onCancel={() => {
        setLocalFieldErrors({});
        write.reset();
        setFormState((prev) => (prev === null ? prev : { ...prev, values: prev.baseline }));
      }}
      onDeactivate={() => {
        deactivateWrite.reset();
        setIsDeactivateOpen(true);
      }}
    />
  );

  /**
   * 우 페인. 상세를 받지 못한 상태에서 빈 폼을 보이면 사용자가 그것을 자료로 읽는다 —
   * 선택 전·등록·불러오는 중·실패를 각각 다른 화면으로 낸다.
   */
  const renderFormPane = (): ReactNode => {
    if (isCreateMode) {
      return formState === null ? null : renderForm('create');
    }

    if (selectedId === null) {
      /* 둥근 바탕 아이콘 · 제목 · 설명 — 검사 기준 탭과 같다(#208). */
      return (
        <EmptyState
          size="sm"
          icon={
            <span className="inspection-standard-empty-icon">
              <Icon name="assignment" size={20} />
            </span>
          }
          title={t.empty.codeNotSelectedTitle}
          description={t.empty.codeNotSelected}
        />
      );
    }

    if (detail.isError) {
      return <LoadErrorBanner error={detail.error} onRetry={() => void detail.refetch()} />;
    }

    if (detail.data === undefined || formState === null) {
      return (
        <div role="status" aria-label={t.loading.codeDetail}>
          <SkeletonText lines={4} />
        </div>
      );
    }

    return renderForm('edit');
  };

  const codeListPane = (
    <CodeListPane
      adapter={adapter}
      rows={pageRows}
      byId={byId}
      pageMeta={{ page: listPageNo, size: listSize, total: rows.length }}
      onChangePage={(page) => updateParams({ page: page > 1 ? String(page) : null })}
      onChangePageSize={(size) =>
        updateParams({ size: size === DEFAULT_LIST_SIZE ? null : String(size), page: null })
      }
      isLoading={list.isPending}
      appliedFilters={filters}
      onApplyFilters={handleApplyFilters}
      selectedId={selectedId}
      onSelect={(id) => updateParams({ sel: String(id), mode: null })}
      // 대분류 추가는 선택을 지운다 — 어느 코드의 하위도 아닌 새 축이다.
      onAddCategory={() => openCreateForm({ sel: null })}
      // 상세 추가는 고른 대분류를 그대로 남겨 상위 초기값으로 쓴다.
      onAddChild={() => openCreateForm({})}
      canAddChild={canAddChild}
      loadError={
        list.isError ? (
          <LoadErrorBanner error={list.error} onRetry={() => void list.refetch()} />
        ) : null
      }
      searchRef={aboveRef}
      /* 조회 카드 아래 목록 | 상세 — 검사 기준 탭과 같은 분할(#208). */
      renderLayout={(listPane) => (
        <div
          ref={splitRef}
          className={`po-board-split inspection-split inspection-standard-split${layout.orientation === 'column' ? ' is-stacked' : ''}`}
          style={{ ...split.style, ...layout.style }}
        >
          {listPane}
          <PaneSplitter label={hubText.splitter} ratio={split.ratio} onChange={split.commit} />
          {layout.orientation === 'column' && (
            <PaneHeightSplitter
              label={hubText.heightSplitter}
              height={layout.listHeight}
              onChange={layout.changeListHeight}
            />
          )}
          <div className="pane quality-standard-detail">{renderFormPane()}</div>
        </div>
      )}
    />
  );

  return (
    <>
      {/*
       * 목록이 잘렸다는 사실을 감추지 않는다. 페이지 이동 컨트롤은 아직 없으므로
       * 조건을 좁히는 것이 사용자가 할 수 있는 조치다.
       *
       * 화면 최상위 배너라 이음매는 `main > * + *`가 이미 처리하지만, 슬롯으로 감싸
       * DS 배너의 box-sizing까지 정규화한다 — 감싸지 않으면 배너만 본문 폭을 넘친다.
       */}
      {listTruncated && listPage !== undefined && (
        <div className="banner-slot">
          <AlertBanner variant="warning">
            {t.listTruncated(items.length, listPage.total)}
          </AlertBanner>
        </div>
      )}

      <SplitOrientationToggle orientation={layout.orientation} onChange={layout.change} />
      {codeListPane}

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

const resolveScreenTab = (value: string | null): ScreenTab => {
  if (value === 'cause' || value === 'mapping') return value;
  return 'defect';
};

/** W-06-03의 현상·원인·공정 매핑 세 축. 비활성 탭은 렌더하지 않아 숨은 요청을 만들지 않는다. */
export const DefectCauseCodeScreen = () => {
  const hub = usePageHub();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = resolveScreenTab(searchParams.get('tab'));

  const changeTab = (value: string) => {
    setSearchParams(new URLSearchParams({ tab: resolveScreenTab(value) }));
  };

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
          /*
           * 사이드바 한 줄로 따로 선다(#208) — 탭 막대가 없으니 배치 전환(좌우 · 상하)이 들어갈 자리를 머리 오른쪽에
           * 직접 둔다(LOT 추적과 같은 방식).
           */
          actions={<div id={HUB_ACTIONS_ID} className="hub-actions" />}
        />
      )}
      <Tabs
        aria-label={t.title}
        value={activeTab}
        onChange={changeTab}
        items={[
          ...CODE_TABS.map((definition) => ({
            value: definition.kind,
            label: definition.adapter.labels.tab,
            content: definition.kind === activeTab ? <CodeMasterWorkspace /> : null,
          })),
          {
            value: 'mapping',
            label: t.tabs.mapping,
            content: activeTab === 'mapping' ? <ProcessMappingPane /> : null,
          },
        ]}
      />
    </>
  );
};
