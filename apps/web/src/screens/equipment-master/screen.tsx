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
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, codeLockMessage, useMasterWrite } from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import { type CodeOption, ensureOption, selectableOptions } from './code-options';
import { GroupFormPane } from './group-form-pane';
import { GroupListPane } from './group-list-pane';
import { buildGroupRows, selfAndDescendantIds } from './group-tree';
import { GROUP_FORM_FIELDS, validateGroup } from './group-validation';
import { LoadErrorBanner } from './load-error-banner';
import {
  emptyGroupFormValues,
  groupToFormValues,
  isSameGroupValues,
  toGroupCreate,
  toGroupUpdate,
} from './mappers';
import {
  groupDetailPath,
  groupKeys,
  isTruncated,
  useGroupDetail,
  useGroupList,
  useGroupOptions,
  useLookupOptions,
} from './queries';
import type { EquipmentGroup, GroupFilters, GroupFormValues } from './types';

const t = messages.equipmentMaster;

type EquipmentGroupDetailResponse = components['schemas']['EquipmentGroupDetailResponse'];

/** 신규 등록 폼의 기준값 출처. 상세 응답과 같은 자리를 채우는 안정된 표식이다. */
const CREATE_FORM_SOURCE = Symbol('equipment-group-create');

type GroupFormSource = EquipmentGroupDetailResponse | typeof CREATE_FORM_SOURCE;

/** 폼의 현재 값과 그것이 어디서 나왔는지. 「고친 것이 있는가」는 둘의 비교로 판정한다. */
interface GroupFormState {
  source: GroupFormSource;
  baseline: GroupFormValues;
  values: GroupFormValues;
}

const NO_EXPANDED_IDS: ReadonlySet<number> = new Set();
const NO_BLOCKED_IDS: ReadonlySet<number> = new Set();

/** 상위 그룹 선택지의 한 줄. 코드만으로는 같은 이름이 여럿일 때 구분되지 않는다. */
const parentOptionLabel = (group: EquipmentGroup): string => {
  const name = `${group.groupCode} · ${group.groupName}`;
  return group.isActive ? name : `${name}${t.values.inactiveSuffix}`;
};

/**
 * W-05-12 컨테이너. 설비 그룹 계층을 서버 응답으로 그리고 조회 조건과 선택을 URL에 둔다.
 *
 * ⭐ **화면은 「설비 그룹」이라고 부른다.** 계약이 설비 응답에서 소속 그룹을 `productionLineId`
 * 로 부르지만 그것은 저장처의 이름이다 — 같은 값이며, 이름이 갈리는 자리는 `mappers.ts` 하나다.
 */
export const EquipmentMasterScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { client } = useApiClient();

  const filters = useMemo<GroupFilters>(
    () => ({
      q: searchParams.get('q') ?? '',
      plantId: searchParams.get('plant') ?? '',
      includeInactive: searchParams.get('inactive') === '1',
    }),
    [searchParams],
  );

  const isCreateMode = searchParams.get('mode') === 'create';
  const selectedGroupId = isCreateMode ? null : Number(searchParams.get('grp') ?? '') || null;

  const groupList = useGroupList(filters);
  const groupItems = useMemo(() => groupList.data?.items ?? [], [groupList.data]);
  const lookups = useLookupOptions();
  const detail = useGroupDetail(selectedGroupId);

  /**
   * 기본 펼침 대상 — 하위를 가진 모든 노드.
   * 접힌 상태를 기본으로 두면 조회 결과에 있는 하위 그룹이 표에 나오지 않아
   * 사용자가 「없다」는 잘못된 답을 얻는다.
   */
  const expandableIds = useMemo(() => {
    const known = new Set(groupItems.map((item) => item.equipmentGroupId));
    const parents = new Set<number>();

    for (const item of groupItems) {
      const parentId = item.parentGroupId;
      // 자기참조는 부모로 세지 않는다 — buildGroupRows가 그것을 최상위로 올린다.
      if (
        parentId !== null &&
        parentId !== undefined &&
        parentId !== item.equipmentGroupId &&
        known.has(parentId)
      ) {
        parents.add(parentId);
      }
    }

    return parents;
  }, [groupItems]);

  /**
   * 펼침 상태는 「어느 조회 결과에 대한 것인가」와 함께 들고 있는다.
   * 조회 조건이 바뀌면 다시 계산하고, 같은 조건으로 다시 조회할 때는 사용자의 접기를 지킨다.
   */
  const [expansion, setExpansion] = useState<{
    key: string;
    ids: ReadonlySet<number>;
  } | null>(null);

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

  const expansionKey = JSON.stringify(filters);

  if (groupList.data !== undefined && expansion?.key !== expansionKey) {
    setExpansion({ key: expansionKey, ids: expandableIds });
  }

  const expandedIds = expansion?.ids ?? NO_EXPANDED_IDS;

  const groupRows = useMemo(
    () => buildGroupRows(groupItems, expandedIds),
    [groupItems, expandedIds],
  );

  /*
   * 폼의 기준값은 상세 응답에서 온다. 응답 객체가 바뀔 때만 다시 세워
   * 사용자가 입력하는 동안 값이 서버 값으로 되돌아가지 않게 한다.
   * 캐시가 같은 값을 돌려주면 객체 동일성이 유지되므로 다시 세우지 않는다.
   */
  const [formState, setFormState] = useState<GroupFormState | null>(null);

  const formSource: GroupFormSource | null = isCreateMode
    ? CREATE_FORM_SOURCE
    : (detail.data ?? null);

  if (formSource !== null && formState?.source !== formSource) {
    const seeded =
      formSource === CREATE_FORM_SOURCE
        ? emptyGroupFormValues()
        : groupToFormValues(formSource.equipmentGroup);
    setFormState({ source: formSource, baseline: seeded, values: seeded });
  }

  const formValues = formState?.values ?? emptyGroupFormValues();
  const isDirty = formState !== null && !isSameGroupValues(formState.values, formState.baseline);

  /**
   * 상위 그룹의 재료. **좌측 목록이 아니라 공장 전체를 받는다** —
   * 검색으로 좁혀진 목록을 쓰면 조건에 안 걸린 정상 그룹이 선택지에서 사라지고,
   * 후손이 빠져 순환을 못 막는다.
   */
  const groupOptions = useGroupOptions(formValues.plantId);

  /**
   * 상위로 고르면 순환이 생기는 식별자 — 자기 자신과 모든 후손.
   * 등록에는 후손이 없다.
   */
  const cycleBlockedIds = useMemo(
    () =>
      selectedGroupId === null
        ? NO_BLOCKED_IDS
        : selfAndDescendantIds(groupOptions.groups, selectedGroupId),
    [groupOptions.groups, selectedGroupId],
  );

  /**
   * 상위 그룹 선택지. 자기 자신과 후손을 뺀다 — 데이터베이스는 직계 자기참조만 막는다.
   * 「없음(최상위)」이 첫 줄이고, 지금 매인 값이 목록에 없으면 코드 그대로 남긴다.
   */
  const parentOptions: CodeOption[] = useMemo(() => {
    const selectable = groupOptions.groups
      .filter((group) => !cycleBlockedIds.has(group.equipmentGroupId))
      .map((group) => ({
        value: String(group.equipmentGroupId),
        label: parentOptionLabel(group),
      }));

    return [
      { value: '', label: t.form.parentNone },
      ...ensureOption(selectable, formValues.parentGroupId),
    ];
  }, [groupOptions.groups, cycleBlockedIds, formValues.parentGroupId]);

  /** 보내기 전에 화면에서 잡은 오류. 저장을 누른 뒤에만 세운다 — 입력 도중에 붉은 글씨를 띄우지 않는다. */
  const [localFieldErrors, setLocalFieldErrors] = useState<Record<string, string>>({});

  const codeEditable = detail.data?.editability.codeEditable ?? true;

  const groupWrite = useMasterWrite<GroupFormValues, EquipmentGroup>({
    request: (values, headers) =>
      isCreateMode
        ? // 등록에는 낙관적 잠금이 없다 — 계약이 If-Match를 요구하지 않는다.
          client.POST('/mdm/equipment-groups', {
            params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
            body: toGroupCreate(values),
          })
        : client.PUT('/mdm/equipment-groups/{equipmentGroupId}', {
            params: {
              path: { equipmentGroupId: selectedGroupId ?? 0 },
              header: {
                'Idempotency-Key': headers['Idempotency-Key'],
                'If-Match': headers['If-Match'] ?? '',
              },
            },
            body: toGroupUpdate(values, codeEditable),
          }),
    // ETag는 상세 경로에 보관된다. 저장 응답의 ETag도 같은 경로로 갱신돼 연속 수정이 된다.
    etagPath: selectedGroupId === null ? null : groupDetailPath(selectedGroupId),
    invalidateKeys: [groupKeys.all],
    knownFields: GROUP_FORM_FIELDS,
    onSuccess: (saved) => {
      setLocalFieldErrors({});

      if (isCreateMode) {
        toast.show({ variant: 'success', description: messages.common.created });
        /*
         * 등록 응답(201)에는 ETag가 없다. 등록한 그룹의 상세로 옮겨 다시 조회해야
         * 낙관적 잠금 토큰이 확보되고 이어서 수정할 수 있다.
         */
        updateParams({ mode: null, grp: String(saved.equipmentGroupId) });
        return;
      }

      const next = groupToFormValues(saved);
      setFormState((prev) => (prev === null ? prev : { ...prev, baseline: next, values: next }));
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /** 값을 고치는 중에 옛 오류가 남아 있으면 무엇을 고쳐야 하는지 알 수 없다. */
  const changeFormValues = (patch: Partial<GroupFormValues>) => {
    setFormState((prev) =>
      prev === null ? prev : { ...prev, values: { ...prev.values, ...patch } },
    );

    for (const field of Object.keys(patch)) {
      groupWrite.clearFieldError(field);
      setLocalFieldErrors((prev) => {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSaveGroup = () => {
    const errors = validateGroup(formValues, {
      mode: isCreateMode ? 'create' : 'edit',
      cycleBlockedIds,
    });
    setLocalFieldErrors(errors);

    // 화면에서 잡히는 오류는 서버로 보내지 않는다.
    if (Object.keys(errors).length > 0) return;

    groupWrite.write(formValues);
  };

  /**
   * 저장 충돌을 푸는 유일한 경로. 계약이 덮어쓰기 강제를 제공하지 않으므로
   * 최신 값을 받아 다시 입력하는 수밖에 없고, 입력한 내용은 사라진다.
   */
  const handleReloadDetail = () => {
    groupWrite.reset();
    setLocalFieldErrors({});
    setFormState(null);
    void detail.refetch();
  };

  // 신규 등록은 선택을 지운다 — 어느 그룹의 상세도 아닌 새 폼이다.
  const handleAddGroup = () => {
    groupWrite.reset();
    setLocalFieldErrors({});
    updateParams({ mode: 'create', grp: null });
  };

  // 조회 조건은 화면 상태가 아니라 URL이 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
  const handleApplyFilters = (next: GroupFilters) => {
    updateParams({
      q: next.q === '' ? null : next.q,
      plant: next.plantId === '' ? null : next.plantId,
      inactive: next.includeInactive ? '1' : null,
    });
  };

  const handleToggleExpand = (equipmentGroupId: number) => {
    setExpansion((prev) => {
      if (prev === null) return prev;

      const next = new Set(prev.ids);
      if (next.has(equipmentGroupId)) {
        next.delete(equipmentGroupId);
      } else {
        next.add(equipmentGroupId);
      }
      return { ...prev, ids: next };
    });
  };

  /**
   * 선택 목록이 잘리거나 실패했다는 사실을 낸다.
   * 알리지 않으면 선택칸이 이유 없이 비어 보이고 사용자는 값이 사라진 줄 안다.
   */
  const lookupNotice = (() => {
    if (lookups.isError || groupOptions.isError) {
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.optionsLoadFailed}</AlertBanner>
        </div>
      );
    }

    if (lookups.truncated || groupOptions.truncated) {
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.optionsTruncated}</AlertBanner>
        </div>
      );
    }

    return null;
  })();

  const renderGroupForm = (options: { mode: 'create' | 'edit'; isActive: boolean }) => (
    <GroupFormPane
      mode={options.mode}
      values={formValues}
      onChange={changeFormValues}
      // 로컬 검증 결과가 서버 오류를 덮는다 — 지금 고칠 수 있는 것을 먼저 보인다.
      fieldErrors={{ ...groupWrite.fieldErrors, ...localFieldErrors }}
      banner={
        <SaveErrorBanner
          error={groupWrite.error}
          onReload={options.mode === 'edit' ? handleReloadDetail : undefined}
        />
      }
      codeLockReason={detail.data === undefined ? null : codeLockMessage(detail.data.editability)}
      plantOptions={selectableOptions(lookups.entries.plants, formValues.plantId)}
      parentOptions={parentOptions}
      isActive={options.isActive}
      isDirty={isDirty}
      isSaving={groupWrite.isSaving}
      onSave={handleSaveGroup}
      onCancel={() => {
        setLocalFieldErrors({});
        groupWrite.reset();
        setFormState((prev) => (prev === null ? prev : { ...prev, values: prev.baseline }));
      }}
    />
  );

  /**
   * 우측 페인. 상세를 받지 못한 상태에서 빈 폼을 보이면 사용자가 그것을 자료로 읽는다 —
   * 선택 전·불러오는 중·실패를 각각 다른 화면으로 낸다.
   */
  const renderDetailPane = () => {
    if (isCreateMode) {
      return <div className="pane">{renderGroupForm({ mode: 'create', isActive: true })}</div>;
    }

    if (selectedGroupId === null) {
      return (
        <div className="pane">
          <EmptyState size="sm" title={t.empty.groupNotSelected} />
        </div>
      );
    }

    if (detail.isError) {
      return (
        <div className="pane">
          <LoadErrorBanner error={toApiError(detail.error)} onRetry={() => void detail.refetch()} />
        </div>
      );
    }

    if (detail.data === undefined || formState === null) {
      return (
        <div className="pane">
          <div role="status" aria-label={t.loading.groupDetail}>
            <SkeletonText lines={5} />
          </div>
        </div>
      );
    }

    return (
      <div className="pane">
        {renderGroupForm({ mode: 'edit', isActive: detail.data.equipmentGroup.isActive })}
      </div>
    );
  };

  const listPage = groupList.data?.page;
  const listTruncated = listPage !== undefined && isTruncated(listPage, groupItems.length);

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
        actions={<Button onClick={handleAddGroup}>{t.actions.addGroup}</Button>}
      />

      {lookupNotice}

      {/*
       * 목록이 잘렸다는 사실을 감추지 않는다. 페이지 이동 컨트롤은 아직 없으므로
       * 조건을 좁히는 것이 사용자가 할 수 있는 조치다.
       */}
      {listTruncated && listPage !== undefined && (
        <AlertBanner variant="warning">
          {t.listTruncated(groupItems.length, listPage.total)}
        </AlertBanner>
      )}

      <div className="two-pane">
        <GroupListPane
          rows={groupRows}
          isLoading={groupList.isPending}
          appliedFilters={filters}
          onApplyFilters={handleApplyFilters}
          plantOptions={selectableOptions(lookups.entries.plants, filters.plantId)}
          plantEntries={lookups.entries.plants}
          expandedIds={expandedIds}
          onToggleExpand={handleToggleExpand}
          selectedGroupId={selectedGroupId}
          onSelect={(equipmentGroupId) => {
            groupWrite.reset();
            setLocalFieldErrors({});
            updateParams({ grp: String(equipmentGroupId), mode: null });
          }}
          onAddGroup={handleAddGroup}
          loadError={
            groupList.isError ? (
              <LoadErrorBanner
                error={toApiError(groupList.error)}
                onRetry={() => void groupList.refetch()}
              />
            ) : null
          }
        />
        {renderDetailPane()}
      </div>
    </>
  );
};
