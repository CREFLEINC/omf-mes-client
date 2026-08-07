import { Button, type Column, EmptyState, IconButton, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { DataScopeDraft } from './data-scope-draft';
import { DisabledAction } from './disabled-action';
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
 * 표는 `.wide-table`로 감싼다 — 두 축이 「코드 · 이름」이라 좁은 칸에서 낱말 단위로 쪼개진다.
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
   * 지정 폭의 합은 **296px**(200+96)이라 `.wide-table`의 최소 폭(58rem = 928px) 안에 들어간다 —
   * 사업부만 폭을 지정하지 않고 남는 폭을 흡수한다(계획 결정 17).
   */
  const columns: Column<DataScopeDraft>[] = [
    {
      key: 'businessUnitId',
      header: t.scope.fields.businessUnit,
      render: (row) => axisLabel(businessUnitEntries, row.businessUnitId),
    },
    {
      key: 'plantId',
      header: t.scope.fields.plant,
      width: '200px',
      render: (row) => axisLabel(plantEntries, row.plantId),
    },
    {
      key: 'edit',
      header: t.scope.fields.edit,
      width: '96px',
      render: (row) => (
        <>
          <IconButton
            icon="edit"
            size="sm"
            aria-label={t.scope.actions.editRow(rowLabel(row))}
            onClick={() => {
              onEdit(row.draftId);
            }}
          />
          <IconButton
            icon="delete"
            size="sm"
            aria-label={t.scope.actions.removeRow(rowLabel(row))}
            onClick={() => {
              onRemove(row.draftId);
            }}
          />
        </>
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
      <div className="wide-table">
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
    <section className="pane" aria-label={t.panes.dataScope}>
      {banner}
      {optionsNotice}

      <div className="filter-bar">
        <div className="field-cell">
          <Button variant="outlined" onClick={onAdd}>
            {t.scope.actions.add}
          </Button>
        </div>
      </div>

      {listSlot()}

      <div className="form-actions">
        <Button variant="outlined" disabled={!isDirty} onClick={onCancel}>
          {messages.common.cancel}
        </Button>

        {/* 고친 것이 없으면 주 액션을 **비활성 + 사유**로 둔다(배치 규범 4). */}
        {isDirty || isSaving ? (
          <Button disabled={isSaving} loading={isSaving} onClick={onSave}>
            {messages.common.save}
          </Button>
        ) : (
          <DisabledAction
            variant="filled"
            label={messages.common.save}
            reason={t.actionReasons.saveNoChanges}
          />
        )}
      </div>
    </section>
  );
};
