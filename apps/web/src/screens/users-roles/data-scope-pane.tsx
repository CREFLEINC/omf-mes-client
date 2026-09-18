import {
  Button,
  type Column,
  EmptyState,
  IconButton,
  SkeletonText,
  Table,
  Tooltip,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { DataScopeDraft } from './data-scope-draft';
import type { LookupEntry } from './types';

const t = messages.usersRoles;

export interface DataScopePaneProps {
  drafts: DataScopeDraft[];
  isLoading: boolean;
  /** 번호를 사람이 읽는 이름으로 옮기는 데 쓴다 */
  businessUnitEntries: LookupEntry[];
  plantEntries: LookupEntry[];
  /** 선택 목록이 잘렸거나 실패했다는 안내 슬롯 */
  optionsNotice: ReactNode;
  loadError: ReactNode;
  /** 저장 실패 배너 슬롯 */
  banner: ReactNode;
  isDirty: boolean;
  isSaving: boolean;
  onAdd: () => void;
  onEdit: (draftId: string) => void;
  onRemove: (draftId: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * 축 하나의 표기.
 *
 * **빈 축은 「(전체)」다** — 고르지 않은 것이 아니라 그 축 전체를 고른 것이다(공유계약 A-7).
 * **목록에 없는 번호는 번호로 내지 않는다** — 내부 식별자라 사용자가 쓸 수 없고, 보이면 자료로 읽힌다.
 * **미사용 값에는 표식을 붙인다** — 편집 창(`selectableOptions`)과 역할 부여(`toRoleChoices`)가
 * 같은 규칙을 쓴다. 표에만 표식이 없으면 같은 값이 창을 열 때 갑자기 「(미사용)」으로 바뀐다.
 */
const axisLabel = (entries: LookupEntry[], value: string): string => {
  if (value === '') return t.scope.values.all;

  const entry = entries.find((item) => item.value === value);

  if (entry === undefined) return t.values.unknown;

  return entry.isActive ? entry.label : `${entry.label}${t.values.inactiveSuffix}`;
};

/**
 * 우 칸 아래 — 데이터 접근범위.
 *
 * **저장은 전체 치환이다.** 줄을 더하고 지우는 것은 표에만 반영되고, 「저장」에서 최종 목록이
 * 한 번에 나간다 — 계약이 개별 부여·회수 경로를 두지 않았다.
 *
 * **쪽 이동을 두지 않는다** — 계약의 접근범위 목록에 쪽 나눔이 없다(`items`만 온다).
 *
 * 표는 `.wide-table`(최소 58rem)로 감싸지 않는다 — 열이 셋뿐이라 그 하한이 카드 폭(52rem)을 넘겨
 * 편집 열이 가로 스크롤 밖으로 밀린다. 긴 「코드 · 이름」은 셀 안에서 줄바꿈한다.
 */
export const DataScopePane = ({
  drafts,
  isLoading,
  businessUnitEntries,
  plantEntries,
  optionsNotice,
  loadError,
  banner,
  isDirty,
  isSaving,
  onAdd,
  onEdit,
  onRemove,
  onSave,
  onCancel,
}: DataScopePaneProps) => {
  /** 줄을 가리키는 이름. 「수정」이 여러 줄에 있으면 어느 줄을 고치는 것인지 알 수 없다. */
  const rowLabel = (draft: DataScopeDraft): string =>
    t.scope.values.pair(
      axisLabel(businessUnitEntries, draft.businessUnitId),
      axisLabel(plantEntries, draft.plantId),
    );

  /*
   * 열 비율 — 사업부·공장은 같은 무게(각 40%), 편집은 아이콘 둘이 여유 있게 드는 20%
   * (사용자 요청 2026-09-18). 사용자 목록 표와 같은 규칙으로 가운데 정렬한다.
   */
  const columns: Column<DataScopeDraft>[] = [
    {
      key: 'businessUnitId',
      align: 'center',
      header: t.scope.fields.businessUnit,
      width: '40%',
      render: (row) => axisLabel(businessUnitEntries, row.businessUnitId),
    },
    {
      key: 'plantId',
      align: 'center',
      header: t.scope.fields.plant,
      width: '40%',
      render: (row) => axisLabel(plantEntries, row.plantId),
    },
    {
      key: 'edit',
      align: 'center',
      header: t.scope.fields.edit,
      width: '20%',
      render: (row) => (
        /* 마우스를 올리면 짧은 이름을 보인다 — 공통 `Tooltip` 을 쓰고 표 액션 자체는 바꾸지 않는다. */
        <span className="users-roles-row-actions">
          <Tooltip content={t.scope.actions.editTooltip}>
            <IconButton
              icon="edit"
              size="sm"
              aria-label={t.scope.actions.editRow(rowLabel(row))}
              onClick={() => {
                onEdit(row.draftId);
              }}
            />
          </Tooltip>
          <Tooltip content={t.scope.actions.removeTooltip}>
            <IconButton
              icon="delete"
              size="sm"
              aria-label={t.scope.actions.removeRow(rowLabel(row))}
              onClick={() => {
                onRemove(row.draftId);
              }}
            />
          </Tooltip>
        </span>
      ),
    },
  ];

  const listSlot = (): ReactNode => {
    /*
     * 실패를 빈 표로 내면 「지정된 범위가 없다」로 읽힌다 — 그 상태로 저장하면
     * 사용자가 의도한 적 없는 전체 회수가 나간다.
     */
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.dataScopes}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <div>
        <Table
          density="compact"
          columns={columns}
          rows={drafts}
          getRowId={(row) => row.draftId}
          empty={
            <EmptyState
              size="sm"
              live
              title={t.scope.empty.none}
              description={t.scope.empty.noneDescription}
            />
          }
        />
      </div>
    );
  };

  return (
    <section className="pane users-roles-pane" aria-label={t.panes.dataScope}>
      {/* 추가는 이 구획의 표에 줄을 더하는 일이라 구획 표제 오른쪽에 둔다. */}
      <div className="pane-heading-row users-roles-heading">
        <h2 className="pane-title">{t.panes.dataScope}</h2>
        <Button variant="outlined" onClick={onAdd}>
          {t.scope.actions.add}
        </Button>
      </div>
      {banner}
      {optionsNotice}

      {listSlot()}

      <div className="form-actions">
        <Button variant="outlined" disabled={!isDirty} onClick={onCancel}>
          {messages.common.cancel}
        </Button>

        {/* 규범 4(비활성 사유 상시 표시)의 예외 — 사용자 지시 2026-09-18: 이 화면의 저장 사유 문구를 내지 않는다. */}
        <Button disabled={!isDirty || isSaving} loading={isSaving} onClick={onSave}>
          {messages.common.save}
        </Button>
      </div>
    </section>
  );
};
