import { Breadcrumb, EmptyState, PageHeader, SkeletonText, Tabs, useToast } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, codeLockMessage, useMasterWrite } from '../../patterns/master';
import { CodeGroupFormPane } from './code-group-form-pane';
import { CodeGroupListPane } from './code-group-list-pane';
import {
  codeGroupToFormValues,
  emptyCodeGroupFormValues,
  isSameCodeGroupValues,
  toCodeGroupCreate,
  toCodeGroupUpdate,
} from './code-group-mappers';
import {
  codeGroupDetailPath,
  codeGroupKeys,
  useCodeGroupDetail,
  useCodeGroupList,
} from './code-group-queries';
import { CODE_GROUP_FORM_FIELDS, validateCodeGroupForm } from './code-group-validation';
import { CodeValueSection } from './code-value-section';
import { DeactivateDialog } from './deactivate-dialog';
import { readCodeGroupFilters, readPage, toSearchParams } from './filters';
import { LoadErrorBanner } from './load-error-banner';
import { toPageView } from './pagination';
import { COMMON_CODE_TABS, resolveTab, tabSearchParams } from './tabs';
import type { CodeGroupFilters, CodeGroupFormValues } from './types';

type CodeGroup = components['schemas']['CodeGroup'];
type CodeGroupDetailResponse = components['schemas']['CodeGroupDetailResponse'];

const t = messages.commonCode;

/**
 * 폼의 현재 값과 그것이 어디서 나왔는지.
 * 「고친 것이 있는가」는 둘의 비교로 판정하고, 출처가 바뀔 때만 폼을 다시 세운다 —
 * 사용자가 입력하는 동안 값이 되돌아가면 안 된다.
 */
interface CodeGroupFormState {
  source: CodeGroupDetailResponse;
  baseline: CodeGroupFormValues;
  values: CodeGroupFormValues;
}

/**
 * W-06-06 컨테이너.
 *
 * 조회 조건과 선택은 URL이 소유한다(`?tab=&q=&inactive=1&page=&grp=&new=`) —
 * 새로고침·뒤로가기·공유가 같은 화면을 낸다.
 *
 * **탭은 만든 것만 렌더한다**(`tabs.ts`). 조직·작업자 탭은 그 탭의 목록·폼이 생길 때 붙는다 —
 * 자리만 먼저 두면 「탭은 있는데 눌러도 빈 화면인」 상태가 된다.
 */
export const CommonCodeScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { client } = useApiClient();

  const tab = resolveTab(searchParams.get('tab'));

  const filters = useMemo<CodeGroupFilters>(
    () => readCodeGroupFilters(searchParams),
    [searchParams],
  );
  const page = readPage(searchParams);

  const isCreatingCodeGroup = searchParams.get('new') === 'group';
  const selectedParam = Number(searchParams.get('grp') ?? '') || null;
  /** 등록 폼이 열려 있는 동안에는 상세를 조회하지 않는다 — 만들고 있는 자원에는 상세가 없다. */
  const selectedCodeGroupId = isCreatingCodeGroup ? null : selectedParam;

  const codeGroupList = useCodeGroupList(filters, page);
  const codeGroups = codeGroupList.data?.items ?? [];

  /*
   * 서버가 준 쪽 정보를 정본으로 쓴다. 주소의 쪽 번호를 쓰면 서버가 다른 쪽을 돌려줬을 때
   * 표시와 내용이 어긋난다. 아직 받지 못했으면 건수를 지어내지 않고 0으로 둔다.
   */
  const codeGroupPageView = toPageView(
    codeGroupList.data?.page ?? { page, size: 0, total: 0 },
    codeGroups.length,
  );

  const codeGroupDetail = useCodeGroupDetail(selectedCodeGroupId);

  /*
   * 코드값 한 벌에 넘길 상태. 좌 목록과 **다른 주소 키**를 쓴다 —
   * 한 화면에 쪽이 둘이라 같은 키를 쓰면 한쪽을 옮길 때 다른 쪽까지 따라간다.
   */
  const codeValueIncludeInactive = searchParams.get('vinactive') === '1';
  const codeValuePage = readPage(searchParams, 'vpage');
  const selectedCodeValueId = Number(searchParams.get('val') ?? '') || null;
  const isCreatingCodeValue = searchParams.get('new') === 'value';

  const [formState, setFormState] = useState<CodeGroupFormState | null>(null);

  /*
   * 폼의 기준값은 상세 응답에서 온다. 응답 객체가 바뀔 때만 다시 세워
   * 사용자가 입력하는 동안 값이 서버 값으로 되돌아가지 않게 한다.
   * 캐시가 같은 값을 돌려주면 객체 동일성이 유지되므로 다시 세우지 않는다.
   */
  const codeGroupSource = codeGroupDetail.data ?? null;

  if (codeGroupSource !== null && formState?.source !== codeGroupSource) {
    const seeded = codeGroupToFormValues(codeGroupSource.codeGroup);
    setFormState({ source: codeGroupSource, baseline: seeded, values: seeded });
  }

  const isCodeGroupDirty =
    formState !== null && !isSameCodeGroupValues(formState.values, formState.baseline);

  /** 보내기 전에 화면에서 잡은 오류. 저장을 누른 뒤에만 세운다 — 입력 도중에 붉은 글씨를 띄우지 않는다. */
  const [codeGroupFieldErrors, setCodeGroupFieldErrors] = useState<Record<string, string>>({});

  /**
   * 코드그룹 등록 폼의 값. null이면 폼이 닫혀 있다.
   *
   * 상세 응답이 없는 폼이라 수정 폼 상태와 섞지 않는다 —
   * 섞으면 「기준값이 서버에서 왔는가」가 흐려지고, 등록 성공 후 어느 쪽을 비울지도 갈린다.
   */
  const [createValues, setCreateValues] = useState<CodeGroupFormValues | null>(null);
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string>>({});

  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);

  /**
   * 주소의 일부만 고친다.
   *
   * **한 조작이 이 함수를 두 번 부르는 자리가 있다** — 예를 들어 코드값 등록 폼을 열 때
   * 등록 표시를 켜면서 선택을 비운다. 그때 두 갱신이 각각 지금 렌더의 주소를 밑그림으로 쓰면
   * 뒤 갱신이 앞 갱신을 지운다. `setSearchParams`의 되돌림 함수 형태도 마찬가지다 —
   * 그 함수가 받는 값이 **지금 렌더의 주소**라 한 틱 안의 두 호출이 서로를 보지 못한다.
   *
   * 그래서 방금 만든 주소를 참조에 남겨 다음 호출이 그 위에 이어 붙이게 한다.
   * 참조는 렌더마다 주소로 다시 맞춰지므로 실제 주소와 어긋난 채 남지 않는다.
   */
  const pendingParamsRef = useRef(searchParams);
  pendingParamsRef.current = searchParams;

  const patchSearchParams = (patch: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(pendingParamsRef.current);
    patch(next);
    pendingParamsRef.current = next;
    setSearchParams(next);
  };

  /** 주소를 통째로 갈아 끼운다. 참조도 함께 옮겨 뒤따르는 부분 갱신이 옛 주소를 밑그림으로 쓰지 않게 한다. */
  const replaceSearchParams = (next: URLSearchParams) => {
    pendingParamsRef.current = next;
    setSearchParams(next);
  };

  const selectCodeGroup = (codeGroupId: number) => {
    patchSearchParams((next) => {
      next.set('grp', String(codeGroupId));
      // 다른 그룹의 코드값을 가리키면 안 된다.
      next.delete('val');
      next.delete('vpage');
      next.delete('new');
    });
  };

  const codeGroupWrite = useMasterWrite<CodeGroupFormValues, CodeGroup>({
    request: (values, headers) =>
      client.PUT('/mdm/code-groups/{codeGroupId}', {
        params: {
          path: { codeGroupId: selectedCodeGroupId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body: toCodeGroupUpdate(values),
      }),
    /*
     * 잠금 토큰은 상세 경로에 보관돼 있다. 보관 키가 요청 경로라 다른 경로로 꺼내면 언제나 비어 있다.
     * 이 화면의 쓰기 열 가지 중 If-Match 를 요구하는 것은 여섯이고 이것이 그 하나다(계약 실측).
     */
    etagPath: selectedCodeGroupId === null ? null : codeGroupDetailPath(selectedCodeGroupId),
    invalidateKeys: [codeGroupKeys.all],
    knownFields: CODE_GROUP_FORM_FIELDS,
    onSuccess: (saved) => {
      setCodeGroupFieldErrors({});
      const next = codeGroupToFormValues(saved);
      setFormState((prev) => (prev === null ? prev : { ...prev, baseline: next, values: next }));
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const codeGroupCreateWrite = useMasterWrite<CodeGroupFormValues, CodeGroup>({
    request: (values, headers) =>
      client.POST('/mdm/code-groups', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body: toCodeGroupCreate(values),
      }),
    // 아직 없는 자원이라 잠글 대상이 없다. 201 응답에도 ETag가 없다(계약 실측).
    etagPath: null,
    invalidateKeys: [codeGroupKeys.all],
    knownFields: CODE_GROUP_FORM_FIELDS,
    onSuccess: (saved) => {
      setCreateValues(null);
      setCreateFieldErrors({});
      /*
       * 201에는 ETag가 없다 — 새 그룹을 고르면 상세를 다시 조회하게 되고
       * 그 조회가 잠금 토큰을 확보한다. 여기서 옮기지 않으면 사용자가 방금 만든 그룹을 직접 찾아야 한다.
       */
      selectCodeGroup(saved.codeGroupId);
      toast.show({ variant: 'success', description: messages.common.created });
    },
  });

  /**
   * 사용 중지 — **본문이 없다.**
   *
   * 응답에 `ETag`가 없으므로 성공하면 상세까지 무효화해 재조회가 새 토큰을 확보하게 한다.
   * 무효화를 빠뜨리면 보관된 토큰이 낡아 그다음 저장이 조용히 막힌다.
   */
  const codeGroupDeactivateWrite = useMasterWrite<void, CodeGroup>({
    request: (_variables, headers) =>
      client.POST('/mdm/code-groups/{codeGroupId}:deactivate', {
        params: {
          path: { codeGroupId: selectedCodeGroupId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
      }),
    /*
     * 잠금 토큰은 상세 경로에 보관돼 있다. 요청 경로(`…:deactivate`)로 꺼내면 언제나 비어 있어
     * 사용 중지가 전부 실패한다.
     */
    etagPath: selectedCodeGroupId === null ? null : codeGroupDetailPath(selectedCodeGroupId),
    invalidateKeys: [codeGroupKeys.all],
    // 대응하는 입력칸이 없다 — 필드 오류도 전부 배너로 올린다.
    knownFields: [],
    onSuccess: () => {
      setIsDeactivateOpen(false);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /** 편집 중이던 상태를 통째로 비운다. 보이는 행이 달라질 때 함께 부른다. */
  const resetCodeGroupEditing = () => {
    codeGroupWrite.reset();
    codeGroupCreateWrite.reset();
    codeGroupDeactivateWrite.reset();
    setIsDeactivateOpen(false);
    setFormState(null);
    setCodeGroupFieldErrors({});
    setCreateValues(null);
    setCreateFieldErrors({});
  };

  /**
   * 조건·쪽이 바뀌면 **주소를 통째로 새로 만든다.**
   * 그래야 `grp`·`val`·`vpage`·`vinactive`·`new`가 자연히 사라진다 — 보이는 행이 달라지는데
   * 선택이 남으면 우 칸의 폼이 어디서 온 것인지 알 수 없다.
   */
  const applyFilters = (next: CodeGroupFilters) => {
    resetCodeGroupEditing();
    replaceSearchParams(toSearchParams(tab.id, next, 1));
  };

  const changeCodeGroupPage = (nextPage: number) => {
    resetCodeGroupEditing();
    replaceSearchParams(toSearchParams(tab.id, filters, nextPage));
  };

  const handleSelectCodeGroup = (codeGroupId: number) => {
    resetCodeGroupEditing();
    selectCodeGroup(codeGroupId);
  };

  const handleAddCodeGroup = () => {
    resetCodeGroupEditing();
    setCreateValues(emptyCodeGroupFormValues());

    patchSearchParams((next) => {
      next.set('new', 'group');
      // 등록 폼이 열려 있는 동안 고른 그룹의 상세가 함께 보이면 어느 쪽을 고치는지 가릴 수 없다.
      next.delete('grp');
      next.delete('val');
      next.delete('vpage');
    });
  };

  const closeCreateForm = () => {
    setCreateValues(null);
    setCreateFieldErrors({});
    codeGroupCreateWrite.reset();

    patchSearchParams((next) => {
      next.delete('new');
    });
  };

  const selectCodeValue = (codeValueId: number | null) => {
    patchSearchParams((next) => {
      if (codeValueId === null) {
        next.delete('val');
      } else {
        next.set('val', String(codeValueId));
      }
    });
  };

  /** 코드값 등록 폼의 여닫음도 주소가 소유한다 — 새로고침이 같은 화면을 낸다. */
  const changeCodeValueCreating = (isCreatingNext: boolean) => {
    patchSearchParams((next) => {
      if (isCreatingNext) {
        next.set('new', 'value');
        return;
      }

      // 코드그룹 등록 폼이 열려 있는 상태를 이 함수가 닫아 버리면 안 된다.
      if (next.get('new') === 'value') next.delete('new');
    });
  };

  /** 코드값 조건이 바뀌면 보이는 행이 달라진다 — 코드값 선택과 쪽을 함께 비운다. */
  const changeCodeValueIncludeInactive = (includeInactive: boolean) => {
    patchSearchParams((next) => {
      if (includeInactive) {
        next.set('vinactive', '1');
      } else {
        next.delete('vinactive');
      }

      next.delete('val');
      next.delete('vpage');
    });
  };

  const changeCodeValuePage = (nextPage: number) => {
    patchSearchParams((next) => {
      if (nextPage > 1) {
        next.set('vpage', String(nextPage));
      } else {
        next.delete('vpage');
      }

      // 쪽을 옮기면 보이는 행이 달라진다 — 목록에 없는 코드값을 가리키면 안 된다.
      next.delete('val');
    });
  };

  /*
   * 탭이 바뀌면 그 탭의 처음 상태로 간다. 한쪽 탭의 조건·선택이 남으면
   * 그 탭에 없는 자원을 조회하게 된다.
   */
  const changeTab = (value: string) => {
    resetCodeGroupEditing();
    replaceSearchParams(tabSearchParams(value));
  };

  /** 값을 고치는 중에 옛 오류가 남아 있으면 무엇을 고쳐야 하는지 알 수 없다. */
  const changeCodeGroupValues = (patch: Partial<CodeGroupFormValues>) => {
    setFormState((prev) =>
      prev === null ? prev : { ...prev, values: { ...prev.values, ...patch } },
    );

    for (const field of Object.keys(patch)) {
      codeGroupWrite.clearFieldError(field);
      setCodeGroupFieldErrors((prev) => {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const changeCreateValues = (patch: Partial<CodeGroupFormValues>) => {
    setCreateValues((prev) => (prev === null ? prev : { ...prev, ...patch }));

    for (const field of Object.keys(patch)) {
      codeGroupCreateWrite.clearFieldError(field);
      setCreateFieldErrors((prev) => {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSaveCodeGroup = () => {
    if (formState === null) return;

    const errors = validateCodeGroupForm(formState.values);
    setCodeGroupFieldErrors(errors);

    // 화면에서 잡히는 오류는 서버로 보내지 않는다.
    if (Object.keys(errors).length > 0) return;

    codeGroupWrite.write(formState.values);
  };

  const handleSaveCreate = () => {
    if (createValues === null) return;

    const errors = validateCodeGroupForm(createValues);
    setCreateFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;

    codeGroupCreateWrite.write(createValues);
  };

  /**
   * 저장 충돌을 푸는 유일한 경로. 계약이 덮어쓰기 강제를 제공하지 않으므로
   * 최신 값을 받아 다시 입력하는 수밖에 없고, 입력한 내용은 사라진다.
   */
  const reloadCodeGroupDetail = () => {
    codeGroupWrite.reset();
    codeGroupDeactivateWrite.reset();
    setCodeGroupFieldErrors({});
    setFormState(null);
    void codeGroupDetail.refetch();
  };

  /*
   * 이미 미사용이면 되돌릴 수 없는 조작을 다시 할 이유가 없다.
   * 감추지 않고 사유와 함께 비활성으로 둔다 — 감추면 「이 화면에는 없는 기능」으로 오해한다.
   */
  const deactivateDisabledReason =
    codeGroupDetail.data?.codeGroup.isActive === false
      ? t.actionReasons.deactivateAlreadyDone(t.targets.codeGroup)
      : null;

  /**
   * 우 칸 위쪽 — 코드그룹 정보.
   *
   * 상세를 받지 못한 상태에서 빈 폼을 보이면 사용자가 그것을 자료로 읽는다 —
   * 등록·선택 전·불러오는 중·실패를 각각 다른 화면으로 낸다.
   */
  const renderCodeGroupFormPane = (): ReactNode => {
    if (isCreatingCodeGroup) {
      if (createValues === null) return null;

      return (
        <CodeGroupFormPane
          mode="create"
          values={createValues}
          onChange={changeCreateValues}
          fieldErrors={{ ...codeGroupCreateWrite.fieldErrors, ...createFieldErrors }}
          /* 등록에는 저장 충돌이 없다 — 「최신 불러오기」를 낼 자리가 아니다. */
          banner={<SaveErrorBanner error={codeGroupCreateWrite.error} />}
          codeLockReason={null}
          deactivateDisabledReason={null}
          isDirty
          isSaving={codeGroupCreateWrite.isSaving}
          onSave={handleSaveCreate}
          onCancel={closeCreateForm}
          onDeactivate={() => undefined}
        />
      );
    }

    if (selectedCodeGroupId === null) {
      return <EmptyState size="sm" title={t.codeGroup.empty.notSelected} />;
    }

    if (codeGroupDetail.isError) {
      return (
        <LoadErrorBanner
          error={codeGroupDetail.error}
          onRetry={() => void codeGroupDetail.refetch()}
        />
      );
    }

    if (codeGroupDetail.data === undefined || formState === null) {
      return (
        <div role="status" aria-label={t.loading.codeGroupDetail}>
          <SkeletonText lines={4} />
        </div>
      );
    }

    return (
      <CodeGroupFormPane
        mode="edit"
        values={formState.values}
        onChange={changeCodeGroupValues}
        // 로컬 검증 결과가 서버 오류를 덮는다 — 지금 고칠 수 있는 것을 먼저 보인다.
        fieldErrors={{ ...codeGroupWrite.fieldErrors, ...codeGroupFieldErrors }}
        banner={<SaveErrorBanner error={codeGroupWrite.error} onReload={reloadCodeGroupDetail} />}
        /*
         * 판정의 주인은 서버가 준 `codeEditable`이다. 화면이 스스로 잠그지 않는다 —
         * `reason`이 `EDITABLE`인데 잠긴 어긋난 조합이 실제로 내려온다.
         */
        codeLockReason={codeLockMessage(codeGroupDetail.data.editability)}
        deactivateDisabledReason={deactivateDisabledReason}
        isDirty={isCodeGroupDirty}
        isSaving={codeGroupWrite.isSaving}
        onSave={handleSaveCodeGroup}
        onCancel={() => {
          setCodeGroupFieldErrors({});
          codeGroupWrite.reset();
          setFormState((prev) => (prev === null ? prev : { ...prev, values: prev.baseline }));
        }}
        onDeactivate={() => {
          codeGroupDeactivateWrite.reset();
          setIsDeactivateOpen(true);
        }}
      />
    );
  };

  const codeTabContent = (
    <div className="two-pane">
      <CodeGroupListPane
        codeGroups={codeGroups}
        isLoading={codeGroupList.isPending}
        appliedFilters={filters}
        onApplyFilters={applyFilters}
        pageView={codeGroupPageView}
        onChangePage={changeCodeGroupPage}
        selectedCodeGroupId={selectedCodeGroupId}
        onSelect={handleSelectCodeGroup}
        isCreating={isCreatingCodeGroup}
        onAddCodeGroup={handleAddCodeGroup}
        loadError={
          codeGroupList.isError ? (
            <LoadErrorBanner
              error={codeGroupList.error}
              onRetry={() => void codeGroupList.refetch()}
            />
          ) : null
        }
      />

      {/*
       * 우 칸은 구획을 세로로 쌓는다 — 코드그룹 정보 아래에 코드값 한 벌이 붙는다.
       * 한 벌을 이 칸에 통째로 두면 코드값만 다루는 화면이 그 칸을 그대로 옮길 수 있다.
       */}
      <div className="pane-stack">
        {renderCodeGroupFormPane()}

        <CodeValueSection
          codeGroupId={selectedCodeGroupId}
          selectedCodeValueId={selectedCodeValueId}
          onSelectCodeValue={selectCodeValue}
          isCreating={isCreatingCodeValue}
          onCreatingChange={changeCodeValueCreating}
          includeInactive={codeValueIncludeInactive}
          onIncludeInactiveChange={changeCodeValueIncludeInactive}
          page={codeValuePage}
          onPageChange={changeCodeValuePage}
        />
      </div>
    </div>
  );

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      <Tabs
        aria-label={t.tabs.label}
        value={tab.id}
        onChange={changeTab}
        items={COMMON_CODE_TABS.map((definition) => ({
          value: definition.id,
          label: definition.label,
          /*
           * 활성 탭의 내용만 만든다. 디자인 시스템 Tabs는 비활성 패널도 DOM에 두므로
           * 모두 만들면 보이지 않는 표가 함께 살아 있게 된다.
           */
          content: definition.id === tab.id ? codeTabContent : null,
        }))}
      />

      {/*
       * 창은 열 때만 붙인다 — 닫힌 창을 남겨 두면 지난 값이 그대로 살아 있다.
       * 되돌릴 수 없는 액션이라 확인을 한 단계 두고, **실패해도 창을 닫지 않는다** —
       * 닫으면 사용자는 무엇이 막았는지 모른 채 같은 버튼을 다시 누른다.
       */}
      {isDeactivateOpen && (
        <DeactivateDialog
          open
          title={t.dialog.deactivateCodeGroupTitle}
          onClose={() => {
            setIsDeactivateOpen(false);
            codeGroupDeactivateWrite.reset();
          }}
          onConfirm={() => {
            codeGroupDeactivateWrite.write(undefined);
          }}
          isSaving={codeGroupDeactivateWrite.isSaving}
          /* 충돌은 상세를 다시 받아 잠금 토큰을 갱신하면 풀린다. 버릴 입력이 없다. */
          banner={
            <SaveErrorBanner
              error={codeGroupDeactivateWrite.error}
              onReload={reloadCodeGroupDetail}
            />
          }
        />
      )}
    </>
  );
};
