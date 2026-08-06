import { Button, type Column, EmptyState, IconButton, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { DisabledAction } from './disabled-action';
import type { ItemDraft } from './types';

const t = messages.inspectionStandard;

export interface ItemPaneProps {
  drafts: ItemDraft[];
  /** 단위 id를 사람이 읽는 이름으로. 선택 목록에 없으면 코드를 그대로 낸다. */
  uomLabel: (uomId: string) => string;
  isLoading: boolean;
  isVersionSelected: boolean;
  loadError: ReactNode;
  /** 선택 목록이 잘렸거나 실패했다는 안내 슬롯 */
  optionsNotice: ReactNode;
  /** 편집할 수 있는 상태인가. 확정·폐기 버전은 항목도 잠긴다. */
  isEditable: boolean;
  /** 잠겼을 때 보일 사유. 여러 컨트롤이 공유하므로 한 문구를 돌려 쓴다 */
  lockReason: string;
  isDirty: boolean;
  isSaving: boolean;
  /** 잠금 말고 저장만 막는 이유(버전 미저장·입력 미완성). 없으면 null */
  saveBlockedReason: string | null;
  /** 저장 실패 배너 슬롯 */
  banner: ReactNode;
  onAdd: () => void;
  onEdit: (draftId: string) => void;
  onRemove: (draftId: string) => void;
  /** 초안 배열의 위치 기준 이동. **여기서 서버를 부르지 않는다** */
  onReorder: (from: number, to: number) => void;
  onSave: () => void;
  onCancel: () => void;
}

/** 값이 없다는 것과 0이라는 것은 다르다 — 빈 값을 빈 칸으로 두면 둘이 같아 보인다. */
const orEmptyMark = (value: string): string => (value === '' ? t.values.empty : value);

/**
 * 목표 · 하한~상한 · 단위를 한 칸에 이어 담는다.
 *
 * 계약의 항목에는 필드가 15개 있다 — 전부 열로 만들면 표가 짓눌린다.
 * 개별 입력칸은 편집 창에 두고 표에서는 훑을 수 있는 요약만 낸다.
 */
const rangeLabel = (draft: ItemDraft, uomLabel: (uomId: string) => string): string => {
  const parts = [orEmptyMark(draft.targetValue)];

  if (draft.lowerLimit !== '' || draft.upperLimit !== '') {
    parts.push(t.values.range(orEmptyMark(draft.lowerLimit), orEmptyMark(draft.upperLimit)));
  }

  if (draft.uomId !== '') parts.push(uomLabel(draft.uomId));

  return parts.join(' · ');
};

/** 「필수 · 자동판정」. 꺼진 것은 적지 않는다 — 켜진 것만 이어야 훑을 수 있다. */
const judgmentLabel = (draft: ItemDraft): string => {
  const enabled: string[] = [];

  if (draft.requiredFlag) enabled.push(t.fields.requiredFlag);
  if (draft.automaticJudgment) enabled.push(t.fields.automaticJudgment);

  return enabled.length === 0 ? t.values.none : enabled.join(' · ');
};

/**
 * 우 하단 — 검사 항목.
 *
 * **표시 번호는 목록 안의 위치(1..N)다.** 저장된 순서 값을 그대로 보이지 않는다 —
 * 서버 채번은 서버 재량이라 10·20으로 올 수 있고, 그 값을 보이면 사용자가 그것을 자료로 읽는다.
 *
 * **정렬 가능한 열을 두지 않는다.** 정렬은 보는 방식이고 재배치는 편집이라
 * 함께 쓰면 결과가 어긋난다(디자인 시스템도 정렬이 켜지면 이동 버튼을 비활성화한다).
 *
 * **순서를 바꿔도 저장하지 않는다.** 순서 컬럼에 유일 제약이 있어 행 단위 저장은
 * 중간 상태가 반드시 제약을 위반한다 — 최종 순서 전체를 「저장」에서 한 번에 보낸다(공유계약 A-5).
 */
export const ItemPane = ({
  drafts,
  uomLabel,
  isLoading,
  isVersionSelected,
  loadError,
  optionsNotice,
  isEditable,
  lockReason,
  isDirty,
  isSaving,
  saveBlockedReason,
  banner,
  onAdd,
  onEdit,
  onRemove,
  onReorder,
  onSave,
  onCancel,
}: ItemPaneProps) => {
  /*
   * 지정 폭의 합은 656px이고 디자인 시스템이 렌더하는 순서 이동 열(96px)을 더해도
   * `.wide-table`의 최소 폭(58rem = 928px) 안에 들어간다 — `app.css`를 고치지 않는다.
   * 「목표·범위」만 폭을 지정하지 않는다: 여러 값을 이어 담는 칸이라 남는 폭을 이 열이 가져가는 것이 맞다.
   */
  const columns: Column<ItemDraft>[] = [
    {
      key: 'displayNo',
      header: t.fields.sequence,
      align: 'end',
      width: '64px',
      render: (_row, rowIndex) => String(rowIndex + 1),
    },
    {
      key: 'inspectionItemCode',
      header: t.fields.itemSpec,
      width: '200px',
      render: (row) => t.values.itemLabel(row.inspectionItemCode, row.inspectionItemName),
    },
    { key: 'dataTypeCode', header: t.fields.dataType, width: '96px' },
    {
      key: 'targetRange',
      header: t.fields.targetRange,
      render: (row) => rangeLabel(row, uomLabel),
    },
    {
      key: 'measurementCount',
      header: t.fields.measurementCount,
      align: 'end',
      width: '88px',
    },
    {
      key: 'judgment',
      header: t.fields.judgment,
      width: '112px',
      render: (row) => judgmentLabel(row),
    },
    {
      key: 'rowActions',
      header: t.fields.rowActions,
      width: '96px',
      render: (row, rowIndex) => (
        <>
          <IconButton
            icon="edit"
            size="sm"
            aria-label={t.actions.editItem(rowIndex + 1)}
            disabled={!isEditable}
            onClick={() => onEdit(row.draftId)}
          />
          <IconButton
            icon="delete"
            size="sm"
            aria-label={t.actions.removeItem(rowIndex + 1)}
            disabled={!isEditable}
            onClick={() => onRemove(row.draftId)}
          />
        </>
      ),
    },
  ];

  /** 선택 전 → 조회 실패 → 로딩 → 표 순서로 하나만 낸다. */
  const listSlot = (): ReactNode => {
    if (!isVersionSelected) {
      return <EmptyState size="sm" title={t.empty.versionNotSelected} />;
    }

    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.items}>
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
          /*
           * 순서 이동 열은 디자인 시스템이 렌더하고 접근성 처리(포커스 이동·라이브 안내)도 맡는다.
           * 잠긴 상태에서는 이 열 자체를 내지 않는다 — 디자인 시스템에 「이동만 비활성」 스위치가 없고,
           * 눌러도 아무 일이 없는 버튼을 남기는 것보다 없는 편이 정직하다.
           * 무엇이 막혔는지는 액션 줄의 잠금 사유가 한 번 말한다.
           */
          reorderable={isEditable}
          onRowReorder={onReorder}
          empty={
            <EmptyState
              size="sm"
              live
              title={t.empty.itemNoneTitle}
              description={t.empty.itemNoneDescription}
            />
          }
        />
      </div>
    );
  };

  /** 잠금이 먼저다 — 잠긴 상태에서는 버전 편집 여부가 사용자에게 아무 도움이 되지 않는다. */
  const saveReason = isEditable ? saveBlockedReason : lockReason;

  return (
    <section className="pane" aria-label={t.panes.items}>
      {optionsNotice}
      {banner}

      {isVersionSelected && (
        <div className="filter-bar">
          {isEditable ? (
            <div className="field-cell">
              <Button variant="outlined" onClick={onAdd}>
                {t.actions.addItem}
              </Button>
            </div>
          ) : (
            <DisabledAction label={t.actions.addItem} reason={lockReason} />
          )}
        </div>
      )}

      {listSlot()}

      {isVersionSelected && (
        <div className="form-actions">
          <Button variant="outlined" disabled={!isEditable || !isDirty} onClick={onCancel}>
            {messages.common.cancel}
          </Button>

          {saveReason === null ? (
            <Button disabled={!isDirty || isSaving} loading={isSaving} onClick={onSave}>
              {messages.common.save}
            </Button>
          ) : (
            <DisabledAction label={messages.common.save} reason={saveReason} />
          )}
        </div>
      )}
    </section>
  );
};
