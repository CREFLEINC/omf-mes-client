import { Button, type Column, EmptyState, IconButton, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { DisabledAction } from './disabled-action';
import { OPERATION_FLAG_KEYS } from './operation-order';
import type { OperationDraft } from './types';

const t = messages.routing;

export interface OperationsPaneProps {
  drafts: OperationDraft[];
  /** 공정 id를 사람이 읽는 이름으로. 선택 목록에 없으면 코드를 그대로 낸다. */
  processLabel: (processId: string) => string;
  isLoading: boolean;
  isRevisionSelected: boolean;
  loadError: ReactNode;
  /** 선택 목록이 잘렸거나 실패했다는 안내 슬롯 */
  optionsNotice: ReactNode;
  /** 편집할 수 있는 상태인가. 확정·폐기 Rev는 라인도 잠긴다. */
  isEditable: boolean;
  /** 잠겼을 때 보일 사유. 여러 컨트롤이 공유하므로 한 문구를 돌려 쓴다 */
  lockReason: string;
  isDirty: boolean;
  isSaving: boolean;
  /** 잠금 말고 저장만 막는 이유(헤더 미저장·입력 미완성). 없으면 null */
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

/**
 * 켜진 관리 항목의 이름만 이어 한 칸에 낸다.
 *
 * 확인 아이콘을 7개 늘어놓지 않는 이유는 보조기술에서 의미가 잡히지 않고
 * 열이 화면 폭을 먹기 때문이다. 전체 항목은 행 편집 다이얼로그에서 본다.
 */
const managedItemsLabel = (draft: OperationDraft): string => {
  const enabled = OPERATION_FLAG_KEYS.filter((key) => draft[key]).map(
    (key) => t.operationFlags[key],
  );

  return enabled.length === 0 ? t.values.none : enabled.join(' · ');
};

/** 값이 없다는 것과 0이라는 것은 다르다 — 빈 값을 빈 칸으로 두면 둘이 같아 보인다. */
const orEmptyMark = (value: string): string => (value === '' ? t.values.empty : value);

/**
 * 우 하단 — 공정 라인.
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
export const OperationsPane = ({
  drafts,
  processLabel,
  isLoading,
  isRevisionSelected,
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
}: OperationsPaneProps) => {
  const columns: Column<OperationDraft>[] = [
    {
      key: 'displayNo',
      header: t.fields.operationNo,
      align: 'end',
      width: '64px',
      render: (_row, rowIndex) => String(rowIndex + 1),
    },
    {
      key: 'processId',
      header: t.fields.process,
      width: '112px',
      render: (row) => processLabel(row.processId),
    },
    { key: 'operationName', header: t.fields.operationName, width: '144px' },
    /*
     * 관리 항목만 폭을 지정하지 않는다 — 여러 값을 이어 담는 칸이라 남는 폭을 이 열이 가져가는 것이 맞다.
     * 나머지 열의 폭 합과 표 최소 폭의 차이가 곧 이 열의 하한이다(도출 표는 배치 규범 문서에).
     */
    {
      key: 'managedItems',
      header: t.fields.managedItems,
      render: (row) => managedItemsLabel(row),
    },
    {
      key: 'standardCycleTimeSec',
      header: t.fields.standardCycleTimeSec,
      align: 'end',
      width: '112px',
      render: (row) => orEmptyMark(row.standardCycleTimeSec),
    },
    {
      key: 'standardYieldRate',
      header: t.fields.standardYieldRate,
      align: 'end',
      width: '120px',
      // 비율 그대로 낸다. 퍼센트로 보이면서 비율로 저장하면 100배 오입력이 조용히 통과한다.
      render: (row) => orEmptyMark(row.standardYieldRate),
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
            aria-label={t.actions.editOperation(rowIndex + 1)}
            disabled={!isEditable}
            onClick={() => onEdit(row.draftId)}
          />
          <IconButton
            icon="delete"
            size="sm"
            aria-label={t.actions.removeOperation(rowIndex + 1)}
            disabled={!isEditable}
            onClick={() => onRemove(row.draftId)}
          />
        </>
      ),
    },
  ];

  /** 선택 전 → 조회 실패 → 로딩 → 표 순서로 하나만 낸다. */
  const listSlot = (): ReactNode => {
    if (!isRevisionSelected) {
      return <EmptyState size="sm" title={t.empty.revisionNotSelected} />;
    }

    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.operations}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    /*
     * `.wide-table`이 표에 최소 폭을 준다 — 이 페인은 3단 배치의 한 칸이라
     * 8열이 들어갈 폭이 늘 나오지 않는다. 폭이 모자라면 짓누르지 않고 가로로 넘긴다.
     * 값의 근거는 docs/layout-conventions.md의 도출 표에 있다.
     */
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
              title={t.empty.operationNoneTitle}
              description={t.empty.operationNoneDescription}
            />
          }
        />
      </div>
    );
  };

  /** 잠금이 먼저다 — 잠긴 상태에서는 헤더 편집 여부가 사용자에게 아무 도움이 되지 않는다. */
  const saveReason = isEditable ? saveBlockedReason : lockReason;

  return (
    <section className="pane" aria-label={t.panes.operations}>
      {optionsNotice}
      {banner}

      {isRevisionSelected && (
        <div className="filter-bar">
          {isEditable ? (
            <div className="field-cell">
              <Button variant="outlined" onClick={onAdd}>
                {t.actions.addOperation}
              </Button>
            </div>
          ) : (
            <DisabledAction label={t.actions.addOperation} reason={lockReason} />
          )}

          <DisabledAction
            label={t.actions.dependencies}
            reason={t.actionReasons.dependenciesUnavailable}
          />
        </div>
      )}

      {listSlot()}

      {isRevisionSelected && (
        <div className="form-actions">
          {/*
           * 저장을 막는 사유는 그 버튼 아래에 붙인다(배치 규범 4).
           * 「고친 것이 없다」는 사유를 적지 않는다 — 무엇을 하면 풀리는지가 화면에 이미 있다.
           */}
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
