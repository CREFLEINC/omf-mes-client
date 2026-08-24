import {
  Button,
  Checkbox,
  Chip,
  type Column,
  EmptyState,
  SearchInput,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useState } from 'react';

import {
  EQUIPMENT_TYPE_OPTIONS,
  type CodeOption,
  defaultEquipmentFilters,
  equipmentTypeLabel,
  statusLabel,
} from './code-options';
import { SelectField } from './select-field';
import type { Equipment, EquipmentFilters } from './types';

export interface EquipmentListPaneProps {
  items: Equipment[];
  isLoading: boolean;
  /** 적용된 조건 — 조건 칩의 렌더 기준 */
  appliedFilters: EquipmentFilters;
  onApplyFilters: (next: EquipmentFilters) => void;
  /** 자산 상태 선택지. 비어 있으면 코드가 그대로 보인다 — 시드가 아직 없을 수 있다 */
  statusOptions: CodeOption[];
  /** 등록 폼을 여는 주 액션 */
  onAdd: () => void;
  /** 설비 하나를 편집한다 — 수명주기 액션도 그 창 안에 있다 */
  onEdit: (equipment: Equipment) => void;
  /** 그 설비의 점검 항목 창을 연다. 설비 상세와 «다른» 자원이라 따로 연다 */
  onOpenInspection: (equipment: Equipment) => void;
  /**
   * 조회 실패 표시. null이 아니면 표·빈 상태 대신 이것을 낸다 —
   * 실패를 「등록된 설비가 없습니다」로 보이면 사실과 다른 안내가 된다.
   */
  loadError: ReactNode;
}

const t = messages.equipmentMaster;

const hasAnyFilter = (filters: EquipmentFilters): boolean =>
  filters.q !== '' ||
  filters.equipmentTypeCode !== '' ||
  filters.calibrationRequired ||
  filters.includeInactive ||
  filters.includeDisposed;

/**
 * 「조회」를 눌러야 나가는 조건. **체크칸 셋은 여기 없다** — 그것들은 바꾸는 즉시 나간다.
 *
 * ⛔ **한 벌을 나눠 갖지 않는다.** 초안이 즉시 적용되는 조건까지 품으면 두 축이 서로를 되돌린다 —
 * 검색칸에 낱말을 넣은 뒤 체크칸을 켜면 되맞춤 효과가 돌면서 **아직 적용하지 않은 낱말이
 * 지워졌다**(client#316). 반대 방향으로 무너진 사례가 W-05-11 이다(client#314).
 */
interface DraftFilters {
  q: string;
  equipmentTypeCode: string;
}

const draftOf = (filters: EquipmentFilters): DraftFilters => ({
  q: filters.q,
  equipmentTypeCode: filters.equipmentTypeCode,
});

export const EquipmentListPane = ({
  items,
  isLoading,
  appliedFilters,
  onApplyFilters,
  statusOptions,
  onAdd,
  onEdit,
  onOpenInspection,
  loadError,
}: EquipmentListPaneProps) => {
  // 트리거 모델: 편집은 모아서 적용, 해제는 즉시.
  const [draft, setDraft] = useState<DraftFilters>(draftOf(appliedFilters));
  const { q: appliedQ, equipmentTypeCode: appliedType } = appliedFilters;

  /* 밖에서 조건이 되돌려지면(초기화·칩 제거) 초안도 그것을 따라간다. */
  useEffect(() => {
    setDraft({ q: appliedQ, equipmentTypeCode: appliedType });
  }, [appliedQ, appliedType]);

  /** 초안을 지금 적용된 조건 «위에» 얹는다 — 즉시 적용된 체크칸을 건드리지 않는다. */
  const applyDraft = (overrides: Partial<DraftFilters> = {}): void => {
    onApplyFilters({ ...appliedFilters, ...draft, ...overrides });
  };

  /*
   * ⛔ **초안을 손으로 거둔다 — 위 효과에 맡기지 않는다.**
   * 효과는 «적용된 값이 달라졌을 때»만 돈다. 적용된 검색어가 이미 비어 있는데 칸에만 낱말이
   * 남아 있으면 달라지는 값이 없어 효과가 돌지 않고, 그 상태로 「조회」를 누르면 초기화한
   * 줄 알았던 조건이 되살아난다(client#316).
   */
  const resetAll = (): void => {
    setDraft(draftOf(defaultEquipmentFilters));
    onApplyFilters(defaultEquipmentFilters);
  };

  const columns: Column<Equipment>[] = [
    {
      key: 'equipmentCode',
      header: t.fields.equipmentCode,
      render: (row) => (
        <button type="button" className="link-cell" onClick={() => onEdit(row)}>
          {row.equipmentCode}
        </button>
      ),
    },
    { key: 'equipmentName', header: t.fields.equipmentName },
    {
      key: 'equipmentTypeCode',
      header: t.fields.equipmentType,
      render: (row) => equipmentTypeLabel(row.equipmentTypeCode),
    },
    {
      /*
       * ⛔ 상태는 «조건»이 아니라 열이다 — 이 화면은 마스터라 폐기된 자산도 보여야 한다.
       * 값 목록이 아직 없어(omf-mes#185) 서버가 준 코드를 그대로 보인다.
       */
      key: 'statusCode',
      header: t.fields.status,
      render: (row) => statusLabel(row.statusCode, statusOptions),
    },
    {
      key: 'calibrationRequired',
      header: t.fields.calibrationRequired,
      render: (row) => (row.calibrationRequired ? t.values.calibrationYes : t.values.calibrationNo),
    },
    {
      key: 'isActive',
      header: t.fields.isActive,
      render: (row) => (row.isActive ? t.values.active : t.values.inactive),
    },
    {
      key: 'inspection',
      header: t.inspection.equipmentPaneTitle,
      width: '132px',
      /*
       * ⭐ **설비마다 다른 자원이다** — 설비 상세와 부여가 다른 경로를 쓰고 잠금 토큰도
       * 따로다. 그래서 설비 창 «안»에 넣지 않고 줄에서 바로 연다: 한 창에서 두 자원을
       * 저장하면 어느 쪽이 충돌했는지 사용자가 알 수 없다.
       */
      render: (row) => (
        <Button
          variant="outlined"
          size="sm"
          onClick={() => onOpenInspection(row)}
          aria-label={t.inspection.equipmentOpenLabel(row.equipmentCode)}
        >
          {t.inspection.equipmentEditAction}
        </Button>
      ),
    },
  ];

  const emptySlot = hasAnyFilter(appliedFilters) ? (
    <EmptyState
      size="sm"
      live
      title={t.empty.equipmentNoMatchTitle}
      description={t.empty.equipmentNoMatchDescription}
      action={
        <Button variant="outlined" onClick={resetAll}>
          {messages.common.reset}
        </Button>
      }
    />
  ) : (
    <EmptyState
      size="sm"
      live
      title={t.empty.equipmentNoneTitle}
      description={t.empty.equipmentNoneDescription}
      action={<Button onClick={onAdd}>{t.actions.addEquipment}</Button>}
    />
  );

  /** 조회 실패 → 로딩 → 표 순서로 하나만 낸다. */
  const listSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.equipments}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <Table
        density="compact"
        columns={columns}
        rows={items}
        getRowId={(row) => String(row.equipmentId)}
        empty={emptySlot}
      />
    );
  };

  return (
    <section aria-label={t.tabs.equipment}>
      {/* 결과가 없어도 필터 바는 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
      <div className="filter-bar">
        <SearchInput
          label={t.equipmentFilters.searchLabel}
          placeholder={t.equipmentFilters.searchPlaceholder}
          value={draft.q}
          onChange={(event) => setDraft((prev) => ({ ...prev, q: event.target.value }))}
          onSearch={(value) => applyDraft({ q: value })}
        />
        <SelectField
          label={t.fields.equipmentType}
          options={[{ value: '', label: t.equipmentFilters.typeAll }, ...EQUIPMENT_TYPE_OPTIONS]}
          value={draft.equipmentTypeCode}
          onChange={(value) => setDraft((prev) => ({ ...prev, equipmentTypeCode: value }))}
          note={messages.pendingCode.note}
        />
        {/* 해제 축이라 변경 즉시 적용한다. */}
        <div className="field-cell field-cell-unlabeled">
          <Checkbox
            checked={appliedFilters.calibrationRequired}
            onChange={(event) =>
              onApplyFilters({ ...appliedFilters, calibrationRequired: event.target.checked })
            }
          >
            {t.equipmentFilters.calibrationRequiredOnly}
          </Checkbox>
        </div>
        <div className="field-cell field-cell-unlabeled">
          <Checkbox
            checked={appliedFilters.includeInactive}
            onChange={(event) =>
              onApplyFilters({ ...appliedFilters, includeInactive: event.target.checked })
            }
          >
            {messages.common.includeInactive}
          </Checkbox>
        </div>
        {/*
         * ⭐ 사용 여부와 «다른 축» 이다. 기본은 운용 중인 것만 부르되, 마스터는 폐기된 자산도
         * 볼 수 있어야 한다 — 감추기만 하면 폐기 처리의 결과를 아무 데서도 확인할 수 없다.
         */}
        <div className="field-cell field-cell-unlabeled">
          <Checkbox
            checked={appliedFilters.includeDisposed}
            onChange={(event) =>
              onApplyFilters({ ...appliedFilters, includeDisposed: event.target.checked })
            }
          >
            {t.equipmentFilters.includeDisposed}
          </Checkbox>
        </div>
        <Button className="field-cell-unlabeled" onClick={() => applyDraft()}>
          {messages.common.search}
        </Button>
        <Button className="field-cell-unlabeled" variant="outlined" onClick={onAdd}>
          {t.actions.addEquipment}
        </Button>
        <Button className="field-cell-unlabeled" variant="outlined" onClick={resetAll}>
          {messages.common.reset}
        </Button>
      </div>

      <div className="filter-bar">
        {appliedFilters.q !== '' && (
          <Chip
            variant="status"
            removeLabel={t.equipmentFilters.chipRemoveKeyword}
            onRemove={() => onApplyFilters({ ...appliedFilters, q: '' })}
          >
            {t.equipmentFilters.chipKeyword(appliedFilters.q)}
          </Chip>
        )}
        {appliedFilters.equipmentTypeCode !== '' && (
          <Chip
            variant="status"
            removeLabel={t.equipmentFilters.chipRemoveType}
            onRemove={() => onApplyFilters({ ...appliedFilters, equipmentTypeCode: '' })}
          >
            {t.equipmentFilters.chipType(equipmentTypeLabel(appliedFilters.equipmentTypeCode))}
          </Chip>
        )}
        {appliedFilters.calibrationRequired && (
          <Chip
            variant="status"
            removeLabel={t.equipmentFilters.chipRemoveCalibration}
            onRemove={() => onApplyFilters({ ...appliedFilters, calibrationRequired: false })}
          >
            {t.equipmentFilters.calibrationRequiredOnly}
          </Chip>
        )}
        {appliedFilters.includeInactive && (
          <Chip
            variant="status"
            removeLabel={t.equipmentFilters.chipRemoveIncludeInactive}
            onRemove={() => onApplyFilters({ ...appliedFilters, includeInactive: false })}
          >
            {messages.common.includeInactive}
          </Chip>
        )}
        {appliedFilters.includeDisposed && (
          <Chip
            variant="status"
            removeLabel={t.equipmentFilters.chipRemoveIncludeDisposed}
            onRemove={() => onApplyFilters({ ...appliedFilters, includeDisposed: false })}
          >
            {t.equipmentFilters.includeDisposed}
          </Chip>
        )}
      </div>

      {listSlot()}
    </section>
  );
};
