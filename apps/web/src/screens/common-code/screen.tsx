import {
  AlertBanner,
  Breadcrumb,
  EmptyState,
  PageHeader,
  SkeletonText,
  Tabs,
  useToast,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useMemo, useState } from 'react';
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
import { lookupLabel, selectableOptions } from './code-options';
import { CodeValueSection } from './code-value-section';
import { DeactivateDialog } from './deactivate-dialog';
import { indexById, orderForGrouping } from './department-hierarchy';
import { DepartmentListPane } from './department-list-pane';
import { toDepartmentRows } from './department-mappers';
import { useDepartmentList } from './department-queries';
import {
  SCOPE_KEYS,
  readCodeGroupFilters,
  readPage,
  readScopedFilters,
  readSelectedId,
  toScopedSearchParams,
  toSearchParams,
} from './filters';
import { LoadErrorBanner } from './load-error-banner';
import { useBusinessUnitOptions, type LookupResult } from './lookups';
import { toPageView } from './pagination';
import { COMMON_CODE_TABS, resolveTab, tabSearchParams } from './tabs';
import type { CodeGroupFilters, CodeGroupFormValues, ScopedFilters } from './types';

type CodeGroup = components['schemas']['CodeGroup'];
type CodeGroupDetailResponse = components['schemas']['CodeGroupDetailResponse'];

const t = messages.commonCode;

/**
 * 폼의 현재 값과 그것이 어디서 나왔는지.
 * 「고친 것이 있는가」는 둘의 비교로 판정하고, 출처가 바뀔 때만 폼을 다시 세운다 —
 * 사용자가 입력하는 동안 값이 되돌아가면 안 된다.
 *
 * **출처는 등록과 수정을 함께 담는다** — 수정은 상세 응답 객체이고, 등록은 주소에서 파생한
 * 문자열이다. 등록 폼의 값을 로컬 상태에만 두면 주소로 직접 들어온 사용자에게 빈 화면이 남는다
 * (여닫음은 주소가 소유한다고 정해 놓고 값은 주소에서 살아나지 못하는 어긋남).
 */
type CodeGroupFormSource = string | CodeGroupDetailResponse;

interface CodeGroupFormState {
  source: CodeGroupFormSource;
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
  const isCodeTab = tab.id === 'code';
  const isOrgTab = tab.id === 'org';

  const filters = useMemo<CodeGroupFilters>(
    () => readCodeGroupFilters(searchParams),
    [searchParams],
  );
  const page = readPage(searchParams);

  const isCreatingCodeGroup = isCodeTab && searchParams.get('new') === 'group';
  const selectedParam = isCodeTab ? readSelectedId(searchParams, 'grp') : null;
  /** 등록 폼이 열려 있는 동안에는 상세를 조회하지 않는다 — 만들고 있는 자원에는 상세가 없다. */
  const selectedCodeGroupId = isCreatingCodeGroup ? null : selectedParam;

  const codeGroupList = useCodeGroupList(filters, page, isCodeTab);
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
  const selectedCodeValueId = readSelectedId(searchParams, 'val');
  /*
   * 코드값 등록에는 그룹이 있어야 한다 — 계약이 그룹 번호를 필수로 두었다.
   * 그룹 없이 `new=value`만 실린 주소로 들어와도 만들 수 없는 폼을 세우지 않는다.
   */
  const isCreatingCodeValue = searchParams.get('new') === 'value' && selectedCodeGroupId !== null;

  const [formState, setFormState] = useState<CodeGroupFormState | null>(null);

  /**
   * 폼의 기준값 출처. 수정은 상세 응답 객체가, 등록은 **주소**가 정한다.
   *
   * 출처가 그대로면 다시 세우지 않아 사용자가 입력하는 동안 값이 서버 값으로 되돌아가지 않는다.
   * 캐시가 같은 값을 돌려주면 객체 동일성이 유지되므로 다시 세우지 않는다.
   *
   * 등록 출처를 주소에서 파생시키는 것이 핵심이다 — 그래야 새로고침·공유·뒤로가기로
   * `?new=group`에 바로 들어온 사용자에게도 폼이 선다.
   */
  const codeGroupFormSource: CodeGroupFormSource | null = isCreatingCodeGroup
    ? 'create:group'
    : (codeGroupDetail.data ?? null);

  if (codeGroupFormSource === null) {
    if (formState !== null) setFormState(null);
  } else if (formState?.source !== codeGroupFormSource) {
    const seeded =
      typeof codeGroupFormSource === 'string'
        ? emptyCodeGroupFormValues()
        : codeGroupToFormValues(codeGroupFormSource.codeGroup);
    setFormState({ source: codeGroupFormSource, baseline: seeded, values: seeded });
  }

  const isCodeGroupDirty =
    formState !== null && !isSameCodeGroupValues(formState.values, formState.baseline);

  /** 보내기 전에 화면에서 잡은 오류. 저장을 누른 뒤에만 세운다 — 입력 도중에 붉은 글씨를 띄우지 않는다. */
  const [codeGroupFieldErrors, setCodeGroupFieldErrors] = useState<Record<string, string>>({});

  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);

  /**
   * 주소의 일부만 고친다.
   *
   * **한 조작은 이 함수를 한 번만 부른다.** 한 틱에 두 번 부르면 앞 갱신이 렌더되지 않은 채
   * 히스토리 칸으로 남아, 뒤로가기가 사용자가 본 적 없는 중간 상태로 떨어진다.
   * 그래서 「선택을 비우면서 등록을 켠다」 같은 조작은 한 번의 patch 안에서 함께 처리한다.
   *
   * **주소가 달라지지 않으면 갱신하지 않는다.** 같은 값을 다시 쓰는 갱신은 화면을 바꾸지 않으면서
   * 히스토리 칸만 늘린다.
   */
  const patchSearchParams = (patch: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    patch(next);

    if (next.toString() === searchParams.toString()) return;

    setSearchParams(next);
  };

  const selectCodeGroup = (codeGroupId: number) => {
    patchSearchParams((next) => {
      next.set('grp', String(codeGroupId));
      // 다른 그룹의 코드값을 가리키면 안 된다.
      next.delete('val');
      next.delete('vpage');
      // 그룹을 고르는 것과 등록 폼이 열려 있는 것은 함께 성립하지 않는다.
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
      setCodeGroupFieldErrors({});
      /*
       * 201에는 ETag가 없다 — 새 그룹을 고르면 상세를 다시 조회하게 되고
       * 그 조회가 잠금 토큰을 확보한다. 여기서 옮기지 않으면 사용자가 방금 만든 그룹을 직접 찾아야 한다.
       *
       * **주소 갱신은 이 한 번뿐이다.** `new`를 지우는 것과 `grp`를 새 번호로 놓는 것을
       * 한 patch 안에서 함께 한다 — 나눠 부르면 뒤로가기가 중간 상태로 떨어진다.
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

  /**
   * 지금 모드의 쓰기. 등록과 수정이 **한 폼 상태**를 쓰므로 저장·오류·진행 표시도
   * 한 곳에서 골라 쓴다 — 두 훅의 상태를 화면에서 합치면 어느 저장의 실패인지 흐려진다.
   */
  const activeCodeGroupWrite = isCreatingCodeGroup ? codeGroupCreateWrite : codeGroupWrite;

  /** 편집 중이던 상태를 통째로 비운다. 보이는 행이 달라질 때 함께 부른다. */
  const resetCodeGroupEditing = () => {
    codeGroupWrite.reset();
    codeGroupCreateWrite.reset();
    codeGroupDeactivateWrite.reset();
    setIsDeactivateOpen(false);
    setFormState(null);
    setCodeGroupFieldErrors({});
  };

  /**
   * 조건·쪽이 바뀌면 **주소를 통째로 새로 만든다.**
   * 그래야 `grp`·`val`·`vpage`·`vinactive`·`new`가 자연히 사라진다 — 보이는 행이 달라지는데
   * 선택이 남으면 우 칸의 폼이 어디서 온 것인지 알 수 없다.
   */
  const applyFilters = (next: CodeGroupFilters) => {
    resetCodeGroupEditing();
    setSearchParams(toSearchParams(tab.id, next, 1));
  };

  const changeCodeGroupPage = (nextPage: number) => {
    resetCodeGroupEditing();
    setSearchParams(toSearchParams(tab.id, filters, nextPage));
  };

  const handleSelectCodeGroup = (codeGroupId: number) => {
    resetCodeGroupEditing();
    selectCodeGroup(codeGroupId);
  };

  const handleAddCodeGroup = () => {
    resetCodeGroupEditing();

    patchSearchParams((next) => {
      next.set('new', 'group');
      // 등록 폼이 열려 있는 동안 고른 그룹의 상세가 함께 보이면 어느 쪽을 고치는지 가릴 수 없다.
      next.delete('grp');
      next.delete('val');
      next.delete('vpage');
    });
  };

  const closeCodeGroupCreateForm = () => {
    codeGroupCreateWrite.reset();
    setCodeGroupFieldErrors({});

    patchSearchParams((next) => {
      next.delete('new');
    });
  };

  /**
   * 코드값 한 벌이 주소에 바라는 것은 **조작 단위**다.
   *
   * 「고른다」·「등록 폼을 연다」·「조건을 바꾼다」가 각각 patch 한 번으로 끝나야
   * 뒤로가기가 사용자가 본 적 없는 중간 상태로 떨어지지 않는다. 그래서 각 함수가
   * 그 조작에 딸린 주소 규칙(선택과 등록 폼은 함께 성립하지 않는다 등)까지 함께 처리한다.
   */
  const clearCodeValueCreating = (next: URLSearchParams) => {
    // 코드그룹 등록 폼이 열려 있는 상태를 코드값 쪽 조작이 닫아 버리면 안 된다.
    if (next.get('new') === 'value') next.delete('new');
  };

  const selectCodeValue = (codeValueId: number) => {
    patchSearchParams((next) => {
      next.set('val', String(codeValueId));
      clearCodeValueCreating(next);
    });
  };

  const openCodeValueCreate = () => {
    patchSearchParams((next) => {
      next.set('new', 'value');
      // 등록 폼이 열려 있는 동안 고른 코드값의 상세가 함께 보이면 어느 쪽을 고치는지 가릴 수 없다.
      next.delete('val');
    });
  };

  const closeCodeValueCreate = () => {
    patchSearchParams(clearCodeValueCreating);
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
      clearCodeValueCreating(next);
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
      clearCodeValueCreating(next);
    });
  };

  /* ── 조직(부서) 탭 ─────────────────────────────────────────────────────── */

  const departmentFilters = useMemo(
    () => readScopedFilters(searchParams, SCOPE_KEYS.businessUnit),
    [searchParams],
  );

  const isCreatingDepartment = isOrgTab && searchParams.get('new') === 'dept';
  const selectedDepartmentParam = isOrgTab ? readSelectedId(searchParams, 'dep') : null;
  const selectedDepartmentId = isCreatingDepartment ? null : selectedDepartmentParam;

  const departmentList = useDepartmentList(departmentFilters, page, isOrgTab);

  /*
   * 계약 표현을 화면 표현으로 옮기며 **자기참조를 여기서 한 번만 접는다** —
   * 목 서버가 실제로 그런 행을 준다. 접지 않으면 대표가 자기 자신인 그룹이 생긴다.
   */
  const departmentRows = useMemo(
    () => toDepartmentRows(departmentList.data?.items ?? []),
    [departmentList.data],
  );
  const departmentById = useMemo(() => indexById(departmentRows), [departmentRows]);
  /* 디자인 시스템 Table의 그룹 순서는 rows에서 그 키가 처음 나온 순서다 — 화면이 미리 정렬한다. */
  const orderedDepartments = useMemo(
    () => orderForGrouping(departmentRows, departmentById),
    [departmentRows, departmentById],
  );

  const departmentPageView = toPageView(
    departmentList.data?.page ?? { page, size: 0, total: 0 },
    departmentRows.length,
  );

  const businessUnitOptions = useBusinessUnitOptions(isOrgTab);

  /**
   * 선택 목록이 잘리거나 실패했다는 사실을 목록 위에 낸다.
   * 알리지 않으면 이름이 이유 없이 비어 보이고 사용자는 값이 사라진 줄 안다.
   */
  const renderOptionsNotice = (lookups: LookupResult[]): ReactNode => {
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
  };

  const applyDepartmentFilters = (next: ScopedFilters) => {
    setSearchParams(toScopedSearchParams(tab.id, SCOPE_KEYS.businessUnit, next, 1));
  };

  const changeDepartmentPage = (nextPage: number) => {
    setSearchParams(
      toScopedSearchParams(tab.id, SCOPE_KEYS.businessUnit, departmentFilters, nextPage),
    );
  };

  const handleSelectDepartment = (departmentId: number) => {
    patchSearchParams((next) => {
      next.set('dep', String(departmentId));
      // 부서를 고르는 것과 등록 폼이 열려 있는 것은 함께 성립하지 않는다.
      next.delete('new');
    });
  };

  const handleAddDepartment = () => {
    patchSearchParams((next) => {
      next.set('new', 'dept');
      // 등록 폼이 열려 있는 동안 고른 부서의 상세가 함께 보이면 어느 쪽을 고치는지 가릴 수 없다.
      next.delete('dep');
    });
  };

  /*
   * 탭이 바뀌면 그 탭의 처음 상태로 간다. 한쪽 탭의 조건·선택이 남으면
   * 그 탭에 없는 자원을 조회하게 된다.
   */
  const changeTab = (value: string) => {
    resetCodeGroupEditing();
    setSearchParams(tabSearchParams(value));
  };

  /** 값을 고치는 중에 옛 오류가 남아 있으면 무엇을 고쳐야 하는지 알 수 없다. */
  const changeCodeGroupValues = (patch: Partial<CodeGroupFormValues>) => {
    setFormState((prev) =>
      prev === null ? prev : { ...prev, values: { ...prev.values, ...patch } },
    );

    for (const field of Object.keys(patch)) {
      activeCodeGroupWrite.clearFieldError(field);
      setCodeGroupFieldErrors((prev) => {
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

    activeCodeGroupWrite.write(formState.values);
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
      if (formState === null) return null;

      return (
        <CodeGroupFormPane
          mode="create"
          values={formState.values}
          onChange={changeCodeGroupValues}
          fieldErrors={{ ...codeGroupCreateWrite.fieldErrors, ...codeGroupFieldErrors }}
          /* 등록에는 저장 충돌이 없다 — 「최신 불러오기」를 낼 자리가 아니다. */
          banner={<SaveErrorBanner error={codeGroupCreateWrite.error} />}
          /* 등록에서는 코드 칸이 열려 있다 — 아직 참조할 자료가 없다. */
          codeLockReason={null}
          deactivateDisabledReason={null}
          isDirty={isCodeGroupDirty}
          isSaving={codeGroupCreateWrite.isSaving}
          onSave={handleSaveCodeGroup}
          onCancel={closeCodeGroupCreateForm}
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
          onOpenCreate={openCodeValueCreate}
          onCloseCreate={closeCodeValueCreate}
          includeInactive={codeValueIncludeInactive}
          onIncludeInactiveChange={changeCodeValueIncludeInactive}
          page={codeValuePage}
          onPageChange={changeCodeValuePage}
        />
      </div>
    </div>
  );

  const orgTabContent = (
    <div className="two-pane">
      <DepartmentListPane
        rows={orderedDepartments}
        byId={departmentById}
        isLoading={departmentList.isPending}
        appliedFilters={departmentFilters}
        onApplyFilters={applyDepartmentFilters}
        businessUnitOptions={selectableOptions(
          businessUnitOptions.entries,
          departmentFilters.scopeId,
        )}
        /*
         * 조건 칩에는 번호가 아니라 이름을 낸다. 선택 목록을 아직 받지 못했으면
         * 「알 수 없음」이 나오고 목록이 도착하면 이름으로 바뀐다 —
         * 번호를 대신 보이면 사용자가 쓸 수 없는 값을 자료로 읽는다.
         */
        businessUnitLabel={(scopeId) => lookupLabel(businessUnitOptions.entries, Number(scopeId))}
        optionsNotice={renderOptionsNotice([businessUnitOptions])}
        pageView={departmentPageView}
        onChangePage={changeDepartmentPage}
        selectedDepartmentId={selectedDepartmentId}
        onSelect={handleSelectDepartment}
        isCreating={isCreatingDepartment}
        onAddDepartment={handleAddDepartment}
        loadError={
          departmentList.isError ? (
            <LoadErrorBanner
              error={departmentList.error}
              onRetry={() => void departmentList.refetch()}
            />
          ) : null
        }
      />

      <section className="pane" aria-label={t.panes.departmentForm}>
        <EmptyState size="sm" title={t.department.empty.notSelected} />
      </section>
    </div>
  );

  const tabContentOf = (tabId: string): ReactNode => {
    if (tabId === 'code') return codeTabContent;
    return orgTabContent;
  };

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
          content: definition.id === tab.id ? tabContentOf(definition.id) : null,
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
