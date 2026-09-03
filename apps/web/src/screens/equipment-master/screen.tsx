import {
  AlertBanner,
  Breadcrumb,
  Button,
  EmptyState,
  PageHeader,
  SkeletonText,
  Tabs,
  useToast,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { lookupDisplayLabel, type LookupSource } from '../../patterns/lookup-display';
import { SaveErrorBanner, codeLockMessage, useMasterWrite } from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import {
  CODE_GROUPS,
  type CodeOption,
  groupDeactivateImpact,
  selectableOptions,
  toCodeLabels,
} from './code-options';
import { DeactivateConfirmDialog } from './deactivate-confirm-dialog';
import { DiscardConfirmDialog } from './discard-confirm-dialog';
import { EquipmentFormDialog } from './equipment-form-dialog';
import { EquipmentListPane } from './equipment-list-pane';
import { EQUIPMENT_FORM_FIELDS, validateEquipment } from './equipment-validation';
import { GroupFormPane } from './group-form-pane';
import { InspectionAssignDialog } from './inspection-assign-dialog';
import { InspectionItemDialog } from './inspection-item-dialog';
import { InspectionItemPane } from './inspection-item-pane';
import { INSPECTION_ITEM_FIELDS, validateInspectionItem } from './inspection-item-validation';
import { InspectionItemsPane } from './inspection-items-pane';
import { resolutionText } from './inspection-resolution';
import {
  toAssignmentInput,
  toDraftRow,
  validateRows,
  type RowErrors,
} from './inspection-assignment';
import { GroupListPane } from './group-list-pane';
import { buildGroupRows, selfAndDescendantIds } from './group-tree';
import { GROUP_FORM_FIELDS, validateGroup } from './group-validation';
import { LoadErrorBanner } from './load-error-banner';
import {
  carriedFrom,
  emptyCarriedValues,
  emptyEquipmentFormValues,
  emptyGroupFormValues,
  equipmentToFormValues,
  emptyInspectionItemValues,
  groupToFormValues,
  inspectionItemToFormValues,
  isSameEquipmentValues,
  isSameGroupValues,
  toEquipmentCreate,
  toEquipmentUpdate,
  toGroupCreate,
  toGroupUpdate,
  toInspectionItemCreate,
  toInspectionItemUpdate,
} from './mappers';
import {
  equipmentDetailPath,
  equipmentInspectionPath,
  equipmentKeys,
  groupDetailPath,
  groupInspectionPath,
  groupKeys,
  inspectionItemDetailPath,
  inspectionKeys,
  isTruncated,
  useCodeValues,
  useEquipmentDetail,
  useEquipmentInspectionItems,
  useEquipmentList,
  useGroupDetail,
  useGroupInspectionItems,
  useGroupList,
  useGroupOptions,
  useInspectionItemDetail,
  useInspectionItemList,
  useInspectionItemMaster,
  useLookupOptions,
  useUomOptions,
} from './queries';
import type {
  AssignmentDraftRow,
  CarriedEquipmentValues,
  Equipment,
  EquipmentFilters,
  EquipmentFormValues,
  EquipmentGroup,
  EquipmentInspectionItem,
  GroupFilters,
  GroupFormValues,
  InspectionItemFilters,
  InspectionItemFormValues,
  LookupEntry,
} from './types';

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
 * 지금 상위로 매여 있는 값을 선택지에 반드시 남긴다 — **빼면 칸이 비어 보여 값이 사라진 줄 안다.**
 *
 * ⭐ **남기되 번호만 덩그러니 두지 않는다.** 자기 자신이나 하위가 상위로 매여 있으면(스펙 §8-4 —
 * 데이터베이스가 순환을 막지 않는다) 그 값은 고를 수 있는 목록에서 빠지는데, 그때 코드만
 * 되살리면 화면에 **내부 번호**가 그대로 나온다. 사용자는 그것이 무엇인지도, 왜 고칠 수 없는지도
 * 알 수 없다 — 저장을 눌러야 비로소 「순환이 생깁니다」를 본다.
 *
 * 그래서 **전체 목록에서 이름을 찾아** 붙이고 순환이라는 사실을 표식으로 낸다. 이름조차 찾지
 * 못하면 원시 번호 대신 조회 상태를 밝힌다.
 */
const ensureCurrentParent = (
  selectable: CodeOption[],
  current: string,
  all: EquipmentGroup[],
  source: LookupSource<LookupEntry>,
): CodeOption[] => {
  if (current === '' || selectable.some((option) => option.value === current)) return selectable;

  const found = all.find((group) => String(group.equipmentGroupId) === current);

  return [
    ...selectable,
    {
      value: current,
      label:
        found === undefined
          ? lookupDisplayLabel(source, current)
          : `${parentOptionLabel(found)}${t.values.parentCycleSuffix}`,
    },
  ];
};

/** 숫자 FK의 현재 값이 목록에 없으면 값은 남기되 내부 번호를 라벨로 쓰지 않는다. */
const ensureNumericOption = (
  options: CodeOption[],
  current: string,
  source: LookupSource<LookupEntry>,
): CodeOption[] =>
  current === '' || options.some((option) => option.value === current)
    ? options
    : [...options, { value: current, label: lookupDisplayLabel(source, current) }];

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

  /* 화면 수준 뷰 — 기본은 자산이라 주소에 남기지 않는다. */
  const activeView =
    searchParams.get('view') === 'inspection-items' ? 'inspection-items' : 'assets';
  const tabParam = searchParams.get('tab');
  const activeTab = tabParam === 'equipment' || tabParam === 'inspection' ? tabParam : 'group';

  const equipmentFilters = useMemo<EquipmentFilters>(
    () => ({
      q: searchParams.get('eq') ?? '',
      equipmentTypeCode: searchParams.get('eqtype') ?? '',
      calibrationRequired: searchParams.get('calib') === '1',
      includeInactive: searchParams.get('eqinactive') === '1',
      includeDisposed: searchParams.get('disposed') === '1',
    }),
    [searchParams],
  );

  const isCreateMode = searchParams.get('mode') === 'create';
  const selectedGroupId = isCreateMode ? null : Number(searchParams.get('grp') ?? '') || null;

  const groupList = useGroupList(filters);
  const groupItems = useMemo(() => groupList.data?.items ?? [], [groupList.data]);
  const lookups = useLookupOptions();
  const detail = useGroupDetail(selectedGroupId);
  /*
   * ⭐ **이 그룹의 값 전부가 「설비 계열」의 정의다**(설계 확정 `omf-mes#224`) — 목록 조건이
   * 이것을 통째로 싣는다. 코드에 값을 박지 않으므로 고객이 유형을 늘려도 손대지 않는다.
   */
  const equipmentTypeValues = useCodeValues(CODE_GROUPS.equipmentType);
  const equipmentTypeOptions = useMemo(
    () => toCodeLabels(equipmentTypeValues.data ?? []),
    [equipmentTypeValues.data],
  );
  const equipmentTypeCodes = useMemo(
    () => (equipmentTypeValues.data ?? []).map((value) => value.code),
    [equipmentTypeValues.data],
  );

  const equipmentList = useEquipmentList(
    selectedGroupId,
    equipmentFilters,
    equipmentTypeCodes,
    equipmentTypeValues.data !== undefined,
  );
  /**
   * 자산 상태 값 목록. **비어 있어도 화면을 감추지 않는다** — 시드가 아직 없을 수 있고
   * (설계 `omf-mes#182`) 그때는 상태가 코드로 보이고 폐기가 잠긴다(G-2).
   */
  const statusValues = useCodeValues(CODE_GROUPS.equipmentStatus);
  const statusOptions = useMemo(() => toCodeLabels(statusValues.data ?? []), [statusValues.data]);
  /** 기간 단위 값 목록 — 검교정 주기를 사람이 읽는 말로 옮긴다. */
  const cycleValues = useCodeValues(CODE_GROUPS.cycleType);
  const cycleOptions = useMemo(() => toCodeLabels(cycleValues.data ?? []), [cycleValues.data]);
  /** 점검 유형 값 목록 — 부여 표의 유형 칸을 사람이 읽는 말로 옮긴다. */
  const inspectionTypeValues = useCodeValues(
    CODE_GROUPS.equipmentInspectionType,
  ); /* ⛔ 이름을 모르는 코드는 담기지 않는다 — 담으면 코드가 이름 행세를 한다(G-9). */
  const labelMapOf = (options: readonly CodeOption[]): ReadonlyMap<string, string> =>
    new Map(options.map((option) => [option.value, option.label]));
  const cycleLabels = labelMapOf(cycleOptions);
  /* 해석 근거가 가리키는 그룹의 이름 — 못 찾으면 층까지만 말한다(G-9). */
  const groupLabels = useMemo(
    () =>
      new Map(
        (groupList.data?.items ?? []).map((group) => [
          group.equipmentGroupId,
          `${group.groupCode} · ${group.groupName}`,
        ]),
      ),
    [groupList.data],
  );
  const inspectionTypeLabels = labelMapOf(toCodeLabels(inspectionTypeValues.data ?? []));
  const equipmentItems = equipmentList.data?.items ?? [];

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
  const groupLookupSource = useMemo<LookupSource<LookupEntry>>(
    () => ({
      entries: groupOptions.groups.map((group) => ({
        value: String(group.equipmentGroupId),
        label: `${group.groupCode} · ${group.groupName}`,
        isActive: group.isActive,
      })),
      isError: groupOptions.isError,
      isLoading: groupOptions.isLoading,
    }),
    [groupOptions.groups, groupOptions.isError, groupOptions.isLoading],
  );

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
   * 「없음(최상위)」이 첫 줄이고, 지금 매인 값이 목록에 없으면 값은 보존하고 조회 상태를 낸다.
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
      ...ensureCurrentParent(
        selectable,
        formValues.parentGroupId,
        groupOptions.groups,
        groupLookupSource,
      ),
    ];
  }, [groupOptions.groups, groupLookupSource, cycleBlockedIds, formValues.parentGroupId]);

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

  /**
   * 점검 항목 부여 창.
   *
   * ⛔ **묶음 통째 교체다**(계약의 `PUT … /inspection-items`) — 창이 들고 있는 것이 곧
   * 저장 뒤의 전부가 된다. 그래서 창을 열 때 **지금 부여된 전부**를 담아 연다.
   */
  const [assignRows, setAssignRows] = useState<AssignmentDraftRow[] | null>(null);

  const groupInspections = useGroupInspectionItems(selectedGroupId);
  /**
   * 점검 항목 창의 대상 설비. **설비 상세와 «다른» 자원이라** 설비 창 안이 아니라 목록
   * 줄에서 바로 연다 — 한 창에서 두 자원을 저장하면 어느 쪽이 충돌했는지 알 수 없다.
   */
  /**
   * 점검 항목 **마스터**.
   *
   * ⭐ **만드는 자리가 이 화면이다**(설계 회신 `omf-mes#220` · 스펙 §5-1-1) — 부여 창은 이
   * 목록에서 고르기만 한다. 만드는 것과 고르는 것을 나눈다(공유계약 B-6 의 화면 판).
   */
  const [inspectionItemFilters, setInspectionItemFilters] = useState<InspectionItemFilters>({
    q: '',
    inspectionTypeCode: '',
    includeInactive: false,
  });
  const [inspectionItemDialog, setInspectionItemDialog] = useState<
    { mode: 'create' } | { mode: 'edit'; equipmentInspectionItemId: number } | null
  >(null);
  const [inspectionItemValues, setInspectionItemValues] =
    useState<InspectionItemFormValues>(emptyInspectionItemValues);
  const [inspectionItemErrors, setInspectionItemErrors] = useState<Record<string, string>>({});

  const inspectionItemList = useInspectionItemList(
    inspectionItemFilters,
    activeView === 'inspection-items',
  );
  const editingItemId =
    inspectionItemDialog?.mode === 'edit' ? inspectionItemDialog.equipmentInspectionItemId : null;
  const inspectionItemDetail = useInspectionItemDetail(editingItemId);
  const judgmentMethodValues = useCodeValues(CODE_GROUPS.inspectionJudgmentMethod);
  const inspectionTypeOptions = useMemo(
    () => toCodeLabels(inspectionTypeValues.data ?? []),
    [inspectionTypeValues.data],
  );
  const judgmentMethodOptions = useMemo(
    () => toCodeLabels(judgmentMethodValues.data ?? []),
    [judgmentMethodValues.data],
  );

  const uomList = useUomOptions();
  /*
   * ⭐ **지금 걸려 있는 단위가 목록에 없어도 칸이 비어 보이면 안 된다.** 사용 중지된 단위나
   * 잘린 목록이면 실제로 그렇게 되고, 사용자는 **지워진 줄 알고 다시 고른다** — 그러면 원래
   * 값이 조용히 바뀐다(형제 화면 W-05-11 이 브라우저 확인에서 겪은 자리다).
   */
  const uomSource = useMemo<LookupSource<LookupEntry>>(
    () => ({
      entries: (uomList.data ?? []).map((uom) => ({
        value: String(uom.uomId),
        label: uom.uomName,
        isActive: true,
      })),
      isError: uomList.isError,
      isLoading: uomList.isPending,
    }),
    [uomList.data, uomList.isError, uomList.isPending],
  );
  const uomOptions = useMemo(
    () => selectableOptions(uomSource, inspectionItemValues.uomId),
    [uomSource, inspectionItemValues.uomId],
  );

  const inspectionItemWrite = useMasterWrite<InspectionItemFormValues, EquipmentInspectionItem>({
    request: (values, headers) =>
      editingItemId === null
        ? /* 등록에는 낙관적 잠금이 없다 — 계약이 If-Match 를 요구하지 않는다. */
          client.POST('/mdm/equipment-inspection-items', {
            params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
            body: toInspectionItemCreate(values),
          })
        : client.PUT('/mdm/equipment-inspection-items/{equipmentInspectionItemId}', {
            params: {
              path: { equipmentInspectionItemId: editingItemId },
              header: {
                'Idempotency-Key': headers['Idempotency-Key'],
                'If-Match': headers['If-Match'] ?? '',
              },
            },
            body: toInspectionItemUpdate(
              values,
              inspectionItemDetail.data?.editability.codeEditable ?? false,
            ),
          }),
    etagPath: editingItemId === null ? null : inspectionItemDetailPath(editingItemId),
    invalidateKeys: [inspectionKeys.all],
    knownFields: INSPECTION_ITEM_FIELDS,
    onSuccess: () => {
      setInspectionItemDialog(null);
      setInspectionItemErrors({});
      toast.show({
        variant: 'success',
        description: editingItemId === null ? messages.common.created : messages.common.saved,
      });
    },
  });

  const openInspectionItemCreate = (): void => {
    resetIfIdle(inspectionItemWrite);
    setInspectionItemErrors({});
    setInspectionItemValues(emptyInspectionItemValues(filters.plantId));
    setInspectionItemDialog({ mode: 'create' });
  };

  const openInspectionItemEdit = (item: EquipmentInspectionItem): void => {
    resetIfIdle(inspectionItemWrite);
    setInspectionItemErrors({});
    setInspectionItemValues(inspectionItemToFormValues(item));
    setInspectionItemDialog({
      mode: 'edit',
      equipmentInspectionItemId: item.equipmentInspectionItemId,
    });
  };

  const changeInspectionItemValues = (patch: Partial<InspectionItemFormValues>): void => {
    setInspectionItemValues((prev) => ({ ...prev, ...patch }));

    /* 고친 칸의 오류는 즉시 걷는다 — 남으면 사용자가 이미 고친 것을 다시 본다. */
    for (const field of Object.keys(patch)) {
      setInspectionItemErrors((prev) => {
        if (!(field in prev)) return prev;

        const next = { ...prev };

        delete next[field];

        return next;
      });
      inspectionItemWrite.clearFieldError(field);
    }
  };

  const handleSaveInspectionItem = (): void => {
    const errors = validateInspectionItem(inspectionItemValues, {
      isCreate: inspectionItemDialog?.mode === 'create',
    });

    setInspectionItemErrors(errors);

    if (Object.keys(errors).length > 0) return;

    inspectionItemWrite.write(inspectionItemValues);
  };

  const [inspectionTarget, setInspectionTarget] = useState<Equipment | null>(null);

  /**
   * 창을 열 때만 마스터를 읽는다 — 목록만 볼 때는 고를 것이 필요 없다.
   *
   * ⛔ **두 창이 같은 목록을 쓴다.** 한쪽만 보면 다른 창이 「등록된 점검 항목이 없습니다」를
   * 띄운다 — 실제로는 조회를 «시작조차» 하지 않은 것이라 사용자가 마스터를 등록하러 간다
   * (브라우저 확인에서 실제로 그렇게 보였다).
   */
  const inspectionMaster = useInspectionItemMaster(
    assignRows !== null || inspectionTarget !== null,
  );

  const inspectionWrite = useMasterWrite<AssignmentDraftRow[], unknown>({
    request: (rows, headers) =>
      client.PUT('/mdm/equipment-groups/{equipmentGroupId}/inspection-items', {
        params: {
          path: { equipmentGroupId: selectedGroupId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body: { items: rows.map(toAssignmentInput) },
      }),
    /*
     * ⛔ **그룹 상세의 토큰이 아니다.** 부여는 그룹과 다른 자원이라, 그룹의 토큰으로 저장하면
     * 서로의 변경을 못 본 채 덮어쓴다.
     */
    etagPath: selectedGroupId === null ? null : groupInspectionPath(selectedGroupId),
    invalidateKeys: [inspectionKeys.all],
    /* 줄마다의 오류는 화면이 잰다 — 묶음 교체라 서버 오류는 어느 줄인지 말해 주지 못한다. */
    knownFields: [],
    onSuccess: () => {
      setAssignRows(null);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const [assignRowErrors, setAssignRowErrors] = useState<Map<number, RowErrors>>(new Map());

  /**
   * 설비의 점검 항목.
   *
   * ⭐ **설비 상세와 «다른» 자원이다** — 경로도 잠금 토큰도 따로다. 그래서 설비 창 안이
   * 아니라 목록 줄에서 바로 연다: 한 창에서 두 자원을 저장하면 어느 쪽이 충돌했는지
   * 사용자가 알 수 없다.
   */
  const [equipmentAssignRows, setEquipmentAssignRows] = useState<AssignmentDraftRow[] | null>(null);

  const equipmentInspections = useEquipmentInspectionItems(inspectionTarget?.equipmentId ?? null);

  const equipmentInspectionWrite = useMasterWrite<AssignmentDraftRow[], unknown>({
    request: (rows, headers) =>
      client.PUT('/mdm/equipments/{equipmentId}/inspection-items', {
        params: {
          path: { equipmentId: inspectionTarget?.equipmentId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body: { items: rows.map(toAssignmentInput) },
      }),
    etagPath:
      inspectionTarget === null ? null : equipmentInspectionPath(inspectionTarget.equipmentId),
    invalidateKeys: [inspectionKeys.all],
    knownFields: [],
    onSuccess: () => {
      setInspectionTarget(null);
      setEquipmentAssignRows(null);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const [equipmentAssignErrors, setEquipmentAssignErrors] = useState<Map<number, RowErrors>>(
    new Map(),
  );

  /**
   * 창이 다루는 줄.
   *
   * ⭐ **고치기 전에는 받아 온 것이 곧 초안이다** — 되맞추는 효과를 두지 않는다. 효과로
   * 채우면 조회가 늦게 끝난 사이 사용자가 친 것을 덮어쓴다.
   *
   * ⛔ **`assigned` 를 담는다 — `effective` 가 아니다.** 뒤엣것은 그룹에서 온 것일 수 있고,
   * 그것을 담아 저장하면 **그룹의 것이 이 설비로 복사되어** 이후 그룹을 고쳐도 이 설비만
   * 옛 항목을 돈다.
   */
  const equipmentRows =
    equipmentAssignRows ?? (equipmentInspections.data?.assigned ?? []).map(toDraftRow);

  const handleSaveEquipmentAssignments = (): void => {
    const errors = validateRows(equipmentRows);

    setEquipmentAssignErrors(errors);

    if (errors.size > 0) return;

    equipmentInspectionWrite.write(equipmentRows);
  };

  /**
   * ⭐ **창은 «설비 자신의» 부여만 담는다**(`assigned`) — `effective` 는 그룹에서 온 것일 수
   * 있고, 그것을 담아 저장하면 **그룹의 것이 설비에 복사되어** 이후 그룹을 고쳐도 이 설비만
   * 옛 항목을 돈다.
   */
  const openEquipmentInspection = (equipment: Equipment): void => {
    resetIfIdle(equipmentInspectionWrite);
    setEquipmentAssignErrors(new Map());
    setInspectionTarget(equipment);
    setEquipmentAssignRows(null);
  };

  const handleSaveAssignments = (): void => {
    if (assignRows === null) return;

    const errors = validateRows(assignRows);

    setAssignRowErrors(errors);

    if (errors.size > 0) return;

    inspectionWrite.write(assignRows);
  };

  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);

  const deactivateWrite = useMasterWrite<void, EquipmentGroup>({
    request: (_variables, headers) =>
      client.POST('/mdm/equipment-groups/{equipmentGroupId}:deactivate', {
        params: {
          path: { equipmentGroupId: selectedGroupId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
      }),
    /* 잠금 토큰은 상세 경로에 보관돼 있다. 요청 경로(`...:deactivate`)로 꺼내면 언제나 비어 있다. */
    etagPath: selectedGroupId === null ? null : groupDetailPath(selectedGroupId),
    invalidateKeys: [groupKeys.all],
    // 대응하는 입력칸이 없다 — 필드 오류도 전부 배너로 올린다.
    knownFields: [],
    onSuccess: () => {
      setIsDeactivateOpen(false);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /**
   * **끝난 쓰기만 거둔다.** 나가는 중인 요청을 `reset()` 으로 끊으면 그 요청의 되먹임
   * (성공 뒤 주소 이동·기준값 갱신, 실패 뒤 오류 표시)이 통째로 사라져, 화면은 아무 일도
   * 없었다고 믿고 서버는 이미 처리한 상태가 된다.
   *
   * ⛔ **`reset()` 을 부르는 모든 자리가 이 함수를 지난다**(client#96).
   */
  const resetIfIdle = (write: { isSaving: boolean; reset: () => void }): void => {
    if (write.isSaving) return;

    write.reset();
  };

  /** 설비 창이 무엇을 다루는지. 닫혀 있으면 `null`. */
  const [equipmentDialog, setEquipmentDialog] = useState<{
    mode: 'create' | 'edit';
    equipmentId: number | null;
  } | null>(null);

  /*
   * 창을 열 때만 상세를 조회한다. 목록 응답에는 잠금 토큰도 코드 편집 가부도 계층도 없다 —
   * 창의 초기값은 목록 행에서 오고 이 조회가 나머지 셋을 확보한다.
   */
  const equipmentDetail = useEquipmentDetail(equipmentDialog?.equipmentId ?? null);

  const [equipmentValues, setEquipmentValues] = useState<EquipmentFormValues>(() =>
    emptyEquipmentFormValues(''),
  );
  /**
   * 이 화면이 소유하지 않는 값. 보이지 않게 고치지 않되 **그대로 되돌려 보낸다**(공유계약 B-13).
   *
   * ⭐ **목록 행이 아니라 상세에서 뜬다.** 목록은 캐시라 낡을 수 있고, 낡은 주기를 되돌려
   * 보내면 그 사이 계측기 마스터가 정한 값을 **덮어쓴다** — 잠금 토큰은 상세에서 온 최신이라
   * 충돌로도 걸리지 않는다. 읽기 전용 표시(상태·검교정 일자)가 이미 상세를 읽고 있으니
   * 자리도 이것이 맞다.
   *
   * ⛔ **상태로 두지 않는다.** 창을 열 때 한 번 뜨면 상세가 도착해도 갱신되지 않는다 —
   * 쓰기는 상세의 잠금 토큰이 있어야 나가므로, 상세가 곧 되돌려 보낼 값의 정본이다.
   */
  const carried: CarriedEquipmentValues =
    equipmentDetail.data === undefined
      ? emptyCarriedValues()
      : carriedFrom(equipmentDetail.data.equipment);
  const [equipmentFieldErrors, setEquipmentFieldErrors] = useState<Record<string, string>>({});

  /**
   * 설비의 소속 그룹 선택지. **순환 제외를 걸지 않는다** — 설비는 그룹의 상위가 될 수 없어
   * 순환이 생길 수 없다. 「소속 없음」을 첫 줄에 두는 이유는 소속이 비는 것이 정상 상태라서다.
   */
  const equipmentGroupOptions: CodeOption[] = useMemo(
    () => [
      { value: '', label: t.equipmentForm.groupNone },
      ...ensureNumericOption(
        groupOptions.groups.map((group) => ({
          value: String(group.equipmentGroupId),
          label: parentOptionLabel(group),
        })),
        equipmentValues.productionLineId,
        groupLookupSource,
      ),
    ],
    [groupOptions.groups, groupLookupSource, equipmentValues.productionLineId],
  );

  const equipmentWrite = useMasterWrite<EquipmentFormValues, Equipment>({
    request: (values, headers) =>
      equipmentDialog?.mode === 'create'
        ? client.POST('/mdm/equipments', {
            params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
            body: toEquipmentCreate(values, carried, detail.data?.equipmentGroup.plantId ?? 0),
          })
        : client.PUT('/mdm/equipments/{equipmentId}', {
            params: {
              path: { equipmentId: equipmentDialog?.equipmentId ?? 0 },
              header: {
                'Idempotency-Key': headers['Idempotency-Key'],
                'If-Match': headers['If-Match'] ?? '',
              },
            },
            body: toEquipmentUpdate(
              values,
              carried,
              equipmentDetail.data?.editability.codeEditable ?? true,
            ),
          }),
    etagPath:
      equipmentDialog?.mode === 'edit' && equipmentDialog.equipmentId !== null
        ? equipmentDetailPath(equipmentDialog.equipmentId)
        : null,
    invalidateKeys: [equipmentKeys.all],
    knownFields: EQUIPMENT_FORM_FIELDS,
    onSuccess: () => {
      setEquipmentDialog(null);
      setEquipmentFieldErrors({});
      toast.show({
        variant: 'success',
        description:
          equipmentDialog?.mode === 'create' ? messages.common.created : messages.common.saved,
      });
    },
  });

  /** 사용 중지할 설비. 닫혀 있으면 `null`. */
  const [deactivateTarget, setDeactivateTarget] = useState<Equipment | null>(null);

  const equipmentDeactivateWrite = useMasterWrite<void, Equipment>({
    request: (_variables, headers) =>
      client.POST('/mdm/equipments/{equipmentId}:deactivate', {
        params: {
          path: { equipmentId: deactivateTarget?.equipmentId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
      }),
    /*
     * 잠금 토큰은 상세 경로에 보관돼 있다 — 요청 경로로 꺼내면 언제나 비어 있다.
     *
     * ⭐ **토큰이 있다는 것이 보장된다.** 이 액션은 수정 창 안에만 있고, 그 창의 버튼은
     * 상세가 도착해야 서기 때문이다 — 목록 행에 두었을 때 필요했던 「토큰이 오기 전」
     * 방어가 여기서는 자리 자체로 성립한다.
     */
    etagPath: deactivateTarget === null ? null : equipmentDetailPath(deactivateTarget.equipmentId),
    invalidateKeys: [equipmentKeys.all],
    // 대응하는 입력칸이 없다 — 필드 오류도 전부 배너로 올린다.
    knownFields: [],
    onSuccess: () => {
      setDeactivateTarget(null);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /**
   * 설비 상세를 다시 받아 잠금 토큰을 갱신한다.
   *
   * ⭐ **저장 충돌을 푸는 유일한 길이다.** 배너가 「최신 내용을 불러온 뒤 다시 저장하세요」라고
   * 말하면서 누를 자리를 두지 않으면, 사용자는 무엇을 해야 하는지 듣고도 할 수 없다 —
   * 「다시 시도하세요」라고 말하는 갈래에는 반드시 누를 자리가 있어야 한다.
   */
  const reloadEquipmentDetail = () => {
    void equipmentDetail.refetch();
  };

  /** 폐기할 설비. 닫혀 있으면 `null`. */
  const [disposeTarget, setDisposeTarget] = useState<Equipment | null>(null);

  /**
   * ⛔ **되돌릴 수 없는 쓰기다.** 그런데도 멱등 키 수명은 기본값(`per-attempt`)이 맞다 —
   * `useMasterWrite` 가 「**본문이 빈 액션**에 `until-applied` 를 쓰지 말라」고 정했다.
   * 보낼 값이 없으면 「값이 바뀌면 새 키」가 성립하지 않아, 다른 화면에서 원인을 고치고
   * 돌아와 다시 눌러도 같은 키가 나가 **영영 성공할 수 없다.**
   */
  const disposeWrite = useMasterWrite<void, Equipment>({
    request: (_variables, headers) =>
      client.POST('/mdm/equipments/{equipmentId}:dispose', {
        params: {
          path: { equipmentId: disposeTarget?.equipmentId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
      }),
    /* 잠금 토큰은 상세 경로에 보관돼 있다 — 요청 경로로 꺼내면 언제나 비어 있다. */
    etagPath: disposeTarget === null ? null : equipmentDetailPath(disposeTarget.equipmentId),
    invalidateKeys: [equipmentKeys.all],
    // 대응하는 입력칸이 없다 — 필드 오류도 전부 배너로 올린다.
    knownFields: [],
    onSuccess: () => {
      setDisposeTarget(null);
      /*
       * ⛔ **창도 함께 닫는다.** 폐기된 자산은 편집이 풀리지 않으므로, 열린 폼을 남기면
       * 사용자가 고칠 수 있다고 믿고 치다가 저장에서 거절당한다.
       */
      setEquipmentDialog(null);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /** 편집 중이던 것을 통째로 거둔다 — 인라인 오류와 저장 실패 배너. */
  const resetEditing = () => {
    resetIfIdle(groupWrite);
    resetIfIdle(deactivateWrite);
    resetIfIdle(equipmentWrite);
    resetIfIdle(equipmentDeactivateWrite);
    resetIfIdle(disposeWrite);
    setLocalFieldErrors({});
  };

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
    resetEditing();
    setFormState(null);
    void detail.refetch();
  };

  /**
   * 편집 중이면 **한 걸음 둔다.** 옮겨 가면 지금 폼이 통째로 버려지는데,
   * 그것은 되돌릴 수 없는 조작이라 확인 없이 일어나면 안 된다.
   *
   * ⛔ **「취소」에는 걸지 않는다.** 그 버튼은 고친 것이 있을 때만 열리고 이름이 곧 뜻이라,
   * 사용자가 **버리겠다고 말한 자리**다. 여기서 막는 것은 사용자가 폼을 생각하지 않는 채
   * 일어나는 **말없는 유실**이다.
   */
  const [pendingParams, setPendingParams] = useState<Record<string, string | null> | null>(null);

  const navigateWithDraftGuard = (patch: Record<string, string | null>) => {
    if (isDirty) {
      setPendingParams(patch);
      return;
    }

    resetEditing();
    updateParams(patch);
  };

  /** 파기는 서버를 부르지 않는다 — 옮겨 갈 뿐이며, 대상이 바뀌면 폼은 렌더 중에 다시 세워진다. */
  const handleDiscard = () => {
    if (pendingParams === null) return;

    const patch = pendingParams;
    setPendingParams(null);
    resetEditing();
    updateParams(patch);
  };

  // 신규 등록은 선택을 지운다 — 어느 그룹의 상세도 아닌 새 폼이다.
  const handleAddGroup = () => {
    navigateWithDraftGuard({ mode: 'create', grp: null, tab: null });
  };

  // 조회 조건은 화면 상태가 아니라 URL이 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
  const handleApplyFilters = (next: GroupFilters) => {
    updateParams({
      q: next.q === '' ? null : next.q,
      plant: next.plantId === '' ? null : next.plantId,
      inactive: next.includeInactive ? '1' : null,
    });
  };

  /** 값을 고치는 중에 옛 오류가 남아 있으면 무엇을 고쳐야 하는지 알 수 없다. */
  const changeEquipmentValues = (patch: Partial<EquipmentFormValues>) => {
    setEquipmentValues((prev) => ({ ...prev, ...patch }));

    for (const field of Object.keys(patch)) {
      equipmentWrite.clearFieldError(field);
      setEquipmentFieldErrors((prev) => {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const openEquipmentCreate = () => {
    resetIfIdle(equipmentWrite);
    setEquipmentFieldErrors({});
    setEquipmentValues(emptyEquipmentFormValues(String(selectedGroupId ?? '')));
    setEquipmentDialog({ mode: 'create', equipmentId: null });
  };

  /** 창의 초기값은 목록 행에서 온다 — 상세는 잠금 토큰·코드 가부·계층을 확보하러 간다. */
  const openEquipmentEdit = (equipment: Equipment) => {
    resetIfIdle(equipmentWrite);
    setEquipmentFieldErrors({});
    setEquipmentValues(equipmentToFormValues(equipment));
    setEquipmentDialog({ mode: 'edit', equipmentId: equipment.equipmentId });
  };

  const handleSaveEquipment = () => {
    const errors = validateEquipment(equipmentValues);
    setEquipmentFieldErrors(errors);

    // 화면에서 잡히는 오류는 서버로 보내지 않는다.
    if (Object.keys(errors).length > 0) return;

    equipmentWrite.write(equipmentValues);
  };

  const handleApplyEquipmentFilters = (next: EquipmentFilters) => {
    updateParams({
      eq: next.q === '' ? null : next.q,
      eqtype: next.equipmentTypeCode === '' ? null : next.equipmentTypeCode,
      calib: next.calibrationRequired ? '1' : null,
      eqinactive: next.includeInactive ? '1' : null,
      disposed: next.includeDisposed ? '1' : null,
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
      plantOptions={selectableOptions(lookups.sources.plants, formValues.plantId)}
      parentOptions={parentOptions}
      isActive={options.isActive}
      isDirty={isDirty}
      isSaving={groupWrite.isSaving}
      onSave={handleSaveGroup}
      onCancel={() => {
        resetEditing();
        setFormState((prev) => (prev === null ? prev : { ...prev, values: prev.baseline }));
      }}
      onDeactivate={() => {
        resetIfIdle(deactivateWrite);
        setIsDeactivateOpen(true);
      }}
    />
  );

  /**
   * 우측 페인. 상세를 받지 못한 상태에서 빈 폼을 보이면 사용자가 그것을 자료로 읽는다 —
   * 선택 전·불러오는 중·실패를 각각 다른 화면으로 낸다.
   */
  const renderDetailPane = () => {
    if (isCreateMode) {
      return (
        <div className="pane equipment-master-pane equipment-master-detail-pane">
          <h2 className="pane-title">{t.form.createTitle}</h2>
          {renderGroupForm({ mode: 'create', isActive: true })}
        </div>
      );
    }

    if (selectedGroupId === null) {
      return (
        <div className="pane equipment-master-pane equipment-master-detail-pane">
          <h2 className="pane-title">{t.panes.groupDetail}</h2>
          <EmptyState size="sm" title={t.empty.groupNotSelected} />
        </div>
      );
    }

    if (detail.isError) {
      return (
        <div className="pane equipment-master-pane equipment-master-detail-pane">
          <h2 className="pane-title">{t.panes.groupDetail}</h2>
          <LoadErrorBanner error={toApiError(detail.error)} onRetry={() => void detail.refetch()} />
        </div>
      );
    }

    if (detail.data === undefined || formState === null) {
      return (
        <div className="pane equipment-master-pane equipment-master-detail-pane">
          <h2 className="pane-title">{t.panes.groupDetail}</h2>
          <div role="status" aria-label={t.loading.groupDetail}>
            <SkeletonText lines={5} />
          </div>
        </div>
      );
    }

    const equipmentPage = equipmentList.data?.page;
    const equipmentTruncated =
      equipmentPage !== undefined && isTruncated(equipmentPage, equipmentItems.length);

    return (
      <div className="pane equipment-master-pane equipment-master-detail-pane">
        <h2 className="pane-title">{t.panes.groupDetail}</h2>
        <Tabs
          aria-label={t.title}
          value={activeTab}
          onChange={(value) => updateParams({ tab: value })}
          items={[
            {
              value: 'group',
              label: t.tabs.group,
              content: renderGroupForm({
                mode: 'edit',
                isActive: detail.data.equipmentGroup.isActive,
              }),
            },
            {
              value: 'inspection',
              label: t.tabs.inspection,
              content: (
                <InspectionItemsPane
                  assignments={groupInspections.data ?? []}
                  isLoading={groupInspections.isPending}
                  cycleLabels={cycleLabels}
                  typeLabels={inspectionTypeLabels}
                  /* 조회하지 못한 채로 고치면 «보이지 않는 줄»을 지우게 된다. */
                  canEdit={groupInspections.data !== undefined}
                  editDisabledReason={t.inspection.needsGroupReason}
                  onEdit={() => {
                    resetIfIdle(inspectionWrite);
                    setAssignRowErrors(new Map());
                    setAssignRows((groupInspections.data ?? []).map(toDraftRow));
                  }}
                  loadError={
                    groupInspections.isError ? (
                      <LoadErrorBanner
                        error={toApiError(groupInspections.error)}
                        onRetry={() => void groupInspections.refetch()}
                      />
                    ) : null
                  }
                />
              ),
            },
            {
              value: 'equipment',
              label: t.tabs.equipment,
              content: (
                <>
                  {/* 잘렸다는 사실을 감추지 않는다 — 조건을 좁히는 것이 사용자가 할 수 있는 조치다. */}
                  {equipmentTruncated && equipmentPage !== undefined && (
                    <AlertBanner variant="warning">
                      {t.equipmentListTruncated(equipmentItems.length, equipmentPage.total)}
                    </AlertBanner>
                  )}
                  <EquipmentListPane
                    items={equipmentItems}
                    /* 유형 목록을 기다리는 동안도 「불러오는 중」이다 — 조건이 그것을 기다린다. */
                    isLoading={equipmentList.isPending || equipmentTypeValues.isPending}
                    appliedFilters={equipmentFilters}
                    onApplyFilters={handleApplyEquipmentFilters}
                    statusOptions={statusOptions}
                    onAdd={openEquipmentCreate}
                    onEdit={openEquipmentEdit}
                    onOpenInspection={openEquipmentInspection}
                    typeOptions={equipmentTypeOptions}
                    /*
                     * ⛔ **유형 목록을 못 받으면 «설비 목록도» 못 낸다.** 그것이 조회 조건이라
                     * 없으면 조건 없이 나가고, 그러면 계측기가 이 목록에 섞인다. 조회를 열지
                     * 않는 대신 **왜 못 여는지 말하고 다시 시도할 자리를 준다**(G-2 · G-23) —
                     * 말하지 않으면 스켈레톤이 영영 돌아 사용자가 기다리기만 한다.
                     */
                    loadError={
                      equipmentTypeValues.isError ? (
                        <LoadErrorBanner
                          error={toApiError(equipmentTypeValues.error)}
                          onRetry={() => void equipmentTypeValues.refetch()}
                        />
                      ) : equipmentList.isError ? (
                        <LoadErrorBanner
                          error={toApiError(equipmentList.error)}
                          onRetry={() => void equipmentList.refetch()}
                        />
                      ) : null
                    }
                  />
                </>
              ),
            },
          ]}
        />
      </div>
    );
  };

  const listPage = groupList.data?.page;
  const listTruncated = listPage !== undefined && isTruncated(listPage, groupItems.length);
  /**
   * 자산 뷰 — 설비 그룹과 설비.
   *
   * ⭐ **점검 항목 마스터와 «나란히» 선다**(스펙 §5-1-1). 마스터는 그룹에 매이지 않으므로
   * 그룹을 고른 뒤의 안쪽 탭이 아니라 화면 수준에서 갈린다 — 안쪽에 두면 「이 그룹의 점검
   * 항목」으로 읽히고, 그것은 부여지 마스터가 아니다.
   */
  const renderAssetsView = () => (
    <>
      {/*
       * 목록이 잘렸다는 사실을 감추지 않는다. 페이지 이동 컨트롤은 아직 없으므로
       * 조건을 좁히는 것이 사용자가 할 수 있는 조치다.
       */}
      {listTruncated && listPage !== undefined && (
        <AlertBanner variant="warning">
          {t.listTruncated(groupItems.length, listPage.total)}
        </AlertBanner>
      )}

      <div className="two-pane equipment-master-layout">
        <GroupListPane
          rows={groupRows}
          isLoading={groupList.isPending}
          appliedFilters={filters}
          onApplyFilters={handleApplyFilters}
          plantOptions={selectableOptions(lookups.sources.plants, filters.plantId)}
          plants={lookups.sources.plants}
          expandedIds={expandedIds}
          onToggleExpand={handleToggleExpand}
          selectedGroupId={selectedGroupId}
          onSelect={(equipmentGroupId) =>
            navigateWithDraftGuard({ grp: String(equipmentGroupId), mode: null })
          }
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

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
        /*
         * ⛔ **머리의 동작은 «보고 있는 뷰»의 것이다.** 점검 항목을 보는 중에 「그룹 추가」가
         * 서 있으면 그 탭의 동작으로 읽힌다 — 누르면 뷰가 바뀌어 사용자가 길을 잃는다.
         * 점검 항목을 더하는 자리는 그 뷰 «안»에 있다.
         */
        actions={
          activeView === 'assets' ? (
            <Button onClick={handleAddGroup}>{t.actions.addGroup}</Button>
          ) : undefined
        }
      />

      {lookupNotice}

      <Tabs
        aria-label={t.title}
        value={activeView}
        onChange={(value) => updateParams({ view: value === 'assets' ? null : value })}
        items={[
          { value: 'assets', label: t.views.assets, content: renderAssetsView() },
          {
            value: 'inspection-items',
            label: t.inspectionItem.tabLabel,
            content: (
              <InspectionItemPane
                items={inspectionItemList.data?.items ?? []}
                isLoading={inspectionItemList.isPending}
                appliedFilters={inspectionItemFilters}
                onApplyFilters={setInspectionItemFilters}
                typeOptions={inspectionTypeOptions}
                methodOptions={judgmentMethodOptions}
                onAdd={openInspectionItemCreate}
                onEdit={openInspectionItemEdit}
                loadError={
                  inspectionItemList.isError ? (
                    <LoadErrorBanner
                      error={toApiError(inspectionItemList.error)}
                      onRetry={() => void inspectionItemList.refetch()}
                    />
                  ) : null
                }
              />
            ),
          },
        ]}
      />

      {pendingParams !== null && (
        <DiscardConfirmDialog onConfirm={handleDiscard} onClose={() => setPendingParams(null)} />
      )}

      {equipmentDialog !== null && (
        <EquipmentFormDialog
          mode={equipmentDialog.mode}
          values={equipmentValues}
          onChange={changeEquipmentValues}
          typeOptions={equipmentTypeOptions}
          // 로컬 검증 결과가 서버 오류를 덮는다 — 지금 고칠 수 있는 것을 먼저 보인다.
          fieldErrors={{ ...equipmentWrite.fieldErrors, ...equipmentFieldErrors }}
          banner={
            <>
              {/* 상세를 받지 못했다는 사실을 감추지 않는다 — 잠금 토큰도 코드 가부도 없는 상태다. */}
              {equipmentDetail.isError && (
                <LoadErrorBanner
                  error={toApiError(equipmentDetail.error)}
                  onRetry={() => void equipmentDetail.refetch()}
                />
              )}
              <SaveErrorBanner error={equipmentWrite.error} />
            </>
          }
          /*
           * ⭐ **모르면 잠근다.** 상세가 아직 오지 않았거나 오지 못했으면 코드 편집 가부를
           * 알 수 없다 — 열어 두면 사용자가 고친 값이 저장 시점에야 거부되고, 그 사유를
           * 화면이 말할 수 없다. 등록에는 참조가 있을 수 없어 언제나 열려 있다.
           */
          codeLockReason={
            equipmentDialog.mode === 'create'
              ? null
              : equipmentDetail.data === undefined
                ? t.actionReasons.codeLockUnknown
                : codeLockMessage(equipmentDetail.data.editability)
          }
          groupOptions={equipmentGroupOptions}
          processOptions={[
            { value: '', label: t.equipmentForm.processNone },
            ...selectableOptions(lookups.sources.processes, equipmentValues.processId),
          ]}
          /*
           * 계층은 상세 응답이 준다. **등록 중에 비는 것은 방어가 아니라 사실이다** —
           * 아직 없는 설비에는 상세를 조회할 대상이 없어 그 조회가 꺼져 있다.
           * 여기서 `mode` 를 한 번 더 보면 두 자리가 같은 것을 지키게 되고, 한쪽을 지워도
           * 아무 감지기가 울지 않는다.
           */
          hierarchy={equipmentDetail.data?.hierarchy ?? null}
          statusCode={equipmentDetail.data?.equipment.statusCode ?? null}
          /* 주기는 이 화면이 소유하지 않는다 — 상세에서 받은 값을 그대로 보인다. */
          calibrationCycleTypeCode={carried.calibrationCycleTypeCode}
          calibrationCycleInterval={carried.calibrationCycleInterval}
          cycleOptions={cycleOptions}
          lastCalibrationDate={equipmentDetail.data?.equipment.lastCalibrationDate ?? null}
          calibrationDueDate={equipmentDetail.data?.equipment.calibrationDueDate ?? null}
          isActive={equipmentDetail.data?.equipment.isActive ?? false}
          statusOptions={statusOptions}
          isSaving={equipmentWrite.isSaving}
          onClose={() => setEquipmentDialog(null)}
          onSave={handleSaveEquipment}
          onDeactivate={() => {
            resetIfIdle(equipmentDeactivateWrite);
            if (equipmentDetail.data !== undefined) {
              setDeactivateTarget(equipmentDetail.data.equipment);
            }
          }}
          onDispose={() => {
            resetIfIdle(disposeWrite);
            if (equipmentDetail.data !== undefined) {
              setDisposeTarget(equipmentDetail.data.equipment);
            }
          }}
        />
      )}

      {disposeTarget !== null && (
        <DeactivateConfirmDialog
          title={t.dispose.title}
          targetNote={t.dispose.target(
            `${disposeTarget.equipmentCode} · ${disposeTarget.equipmentName}`,
          )}
          confirmLabel={t.dispose.confirm}
          impactNote={t.dispose.impact}
          reversibilityNote={t.dispose.notReversible}
          isSaving={disposeWrite.isSaving}
          banner={<SaveErrorBanner error={disposeWrite.error} onReload={reloadEquipmentDetail} />}
          onClose={() => setDisposeTarget(null)}
          onConfirm={() => disposeWrite.write(undefined)}
        />
      )}

      {deactivateTarget !== null && (
        <DeactivateConfirmDialog
          title={t.deactivate.equipmentTitle}
          targetNote={t.deactivate.target(
            `${deactivateTarget.equipmentCode} · ${deactivateTarget.equipmentName}`,
          )}
          confirmLabel={t.deactivate.confirm}
          impactNote={t.deactivate.equipmentImpact}
          reversibilityNote={t.deactivate.notReversibleHere}
          isSaving={equipmentDeactivateWrite.isSaving}
          banner={
            <SaveErrorBanner
              error={equipmentDeactivateWrite.error}
              onReload={reloadEquipmentDetail}
            />
          }
          onClose={() => setDeactivateTarget(null)}
          onConfirm={() => equipmentDeactivateWrite.write(undefined)}
        />
      )}

      {isDeactivateOpen && detail.data !== undefined && (
        <DeactivateConfirmDialog
          title={t.deactivate.title}
          targetNote={t.deactivate.target(
            `${detail.data.equipmentGroup.groupCode} · ${detail.data.equipmentGroup.groupName}`,
          )}
          confirmLabel={t.deactivate.confirm}
          impactNote={groupDeactivateImpact(detail.data.memberEquipmentCount)}
          reversibilityNote={t.deactivate.notReversibleHere}
          isSaving={deactivateWrite.isSaving}
          /* 충돌은 상세를 다시 받아 잠금 토큰을 갱신하면 풀린다. 버릴 입력이 없다. */
          banner={<SaveErrorBanner error={deactivateWrite.error} onReload={handleReloadDetail} />}
          onClose={() => setIsDeactivateOpen(false)}
          onConfirm={() => deactivateWrite.write(undefined)}
        />
      )}

      {inspectionItemDialog !== null && (
        <InspectionItemDialog
          mode={inspectionItemDialog.mode}
          values={inspectionItemValues}
          onChange={changeInspectionItemValues}
          /* 로컬 검증이 서버 오류를 덮는다 — 지금 고칠 수 있는 것을 먼저 보인다. */
          fieldErrors={{ ...inspectionItemWrite.fieldErrors, ...inspectionItemErrors }}
          banner={
            <>
              {/* 상세를 받지 못했다는 사실을 감추지 않는다 — 잠금 토큰도 코드 가부도 없다. */}
              {inspectionItemDetail.isError && (
                <LoadErrorBanner
                  error={toApiError(inspectionItemDetail.error)}
                  onRetry={() => void inspectionItemDetail.refetch()}
                />
              )}
              <SaveErrorBanner
                error={inspectionItemWrite.error}
                onReload={
                  editingItemId === null ? undefined : () => void inspectionItemDetail.refetch()
                }
              />
            </>
          }
          /*
           * ⭐ **수정 가부를 화면이 세지 않는다** — 상세 응답이 가부와 사유를 함께 준다(B-4).
           * 등록 중에는 상세가 없어 잠글 것도 없다.
           */
          codeLockReason={
            inspectionItemDetail.data === undefined
              ? null
              : codeLockMessage(inspectionItemDetail.data.editability)
          }
          assignmentCount={inspectionItemDetail.data?.assignmentCount ?? null}
          plantOptions={selectableOptions(lookups.sources.plants, inspectionItemValues.plantId)}
          typeOptions={inspectionTypeOptions}
          methodOptions={judgmentMethodOptions}
          uomOptions={uomOptions}
          /* 상세를 기다리는 동안 저장을 열면 잠금 토큰 없이 나간다. */
          isSaving={
            inspectionItemWrite.isSaving ||
            (editingItemId !== null && inspectionItemDetail.data === undefined)
          }
          onSave={handleSaveInspectionItem}
          onClose={() => setInspectionItemDialog(null)}
        />
      )}

      {inspectionTarget !== null && (
        <InspectionAssignDialog
          title={t.inspection.equipmentDialogTitle}
          targetLabel={`${inspectionTarget.equipmentCode} · ${inspectionTarget.equipmentName}`}
          lead={t.inspection.equipmentDialogLead}
          rows={equipmentRows}
          onChangeRows={(next) => setEquipmentAssignRows(next)}
          master={inspectionMaster.data ?? []}
          masterLoadFailed={inspectionMaster.isError}
          cycleOptions={cycleOptions}
          rowErrors={equipmentAssignErrors}
          resolutionNote={
            equipmentInspections.data === undefined
              ? undefined
              : resolutionText(equipmentInspections.data, groupLabels)
          }
          banner={
            <SaveErrorBanner
              error={equipmentInspectionWrite.error}
              onReload={() => void equipmentInspections.refetch()}
            />
          }
          /* 조회가 끝나기 전에는 저장을 열지 않는다 — 안 보이는 줄을 지우게 된다. */
          isSaving={equipmentInspectionWrite.isSaving || equipmentInspections.data === undefined}
          onSave={handleSaveEquipmentAssignments}
          onClose={() => {
            setInspectionTarget(null);
            setEquipmentAssignRows(null);
          }}
        />
      )}

      {assignRows !== null && detail.data !== undefined && (
        <InspectionAssignDialog
          title={t.inspection.dialogTitle}
          targetLabel={`${detail.data.equipmentGroup.groupCode} · ${detail.data.equipmentGroup.groupName}`}
          lead={t.inspection.dialogLead}
          rows={assignRows}
          onChangeRows={setAssignRows}
          master={inspectionMaster.data ?? []}
          masterLoadFailed={inspectionMaster.isError}
          cycleOptions={cycleOptions}
          rowErrors={assignRowErrors}
          /* 충돌은 부여를 다시 받아 잠금 토큰을 갱신하면 풀린다. */
          banner={
            <SaveErrorBanner
              error={inspectionWrite.error}
              onReload={() => void groupInspections.refetch()}
            />
          }
          isSaving={inspectionWrite.isSaving}
          onSave={handleSaveAssignments}
          onClose={() => setAssignRows(null)}
        />
      )}
    </>
  );
};
