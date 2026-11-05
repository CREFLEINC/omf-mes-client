import {
  Button,
  type Column,
  EmptyState,
  Icon,
  IconButton,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState, type ReactNode } from 'react';

import { DisabledAction } from './disabled-action';
import { SHOWN_OPERATION_FLAG_KEYS } from './operation-order';
import type { OperationDraft } from './types';
import { centerColumns } from './table-align';

const t = messages.routing;

export interface OperationsPaneProps {
  /**
   * 구역 제목(상세 카드 「공정 구성 N개」 · #231). 주면 공정 추가 · 선후행 단추가 제목 줄 오른쪽에 선다 —
   * 막힌 사유 글도 그 단추 아래에 붙어 표와 겹치지 않는다.
   */
  title?: ReactNode;
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
  /** 이 줄을 지울 수 없는 이유(선후행이 걸려 있다 등). 지울 수 있으면 null */
  removeBlockedReason: (draft: OperationDraft) => string | null;
  /** 선후행 창을 열 수 없는 이유. 잠긴 Rev 는 읽기 전용으로 열리므로 잠금은 이유가 아니다 */
  dependenciesBlockedReason: string | null;
  /** 취소 · 저장을 이 칸 아래에 둘지. 상세 카드는 설정 탭 맨 아래 한 줄로 모은다(#231). */
  showSaveActions?: boolean;
  /** 공정 추가 · 공정 연결 단추를 세울지. Rev 상세 보기 창은 보기만 해 두지 않는다(#231). */
  showTools?: boolean;
  /** 저장 실패 배너 슬롯 */
  banner: ReactNode;
  onAdd: () => void;
  onEdit: (draftId: string) => void;
  onRemove: (draftId: string) => void;
  /** 초안 배열의 위치 기준 이동. **여기서 서버를 부르지 않는다** */
  onReorder: (from: number, to: number) => void;
  onSave: () => void;
  onCancel: () => void;
  onOpenDependencies: () => void;
}

/**
 * 켜진 관리 항목의 이름만 이어 한 칸에 낸다.
 *
 * 확인 아이콘을 7개 늘어놓지 않는 이유는 보조기술에서 의미가 잡히지 않고
 * 열이 화면 폭을 먹기 때문이다. 전체 항목은 행 편집 다이얼로그에서 본다.
 */
const managedItemsLabel = (draft: OperationDraft): string => {
  const enabled = SHOWN_OPERATION_FLAG_KEYS.filter((key) => draft[key]).map(
    (key) => t.operationFlags[key],
  );

  return enabled.length === 0 ? t.values.none : enabled.join(' · ');
};

/**
 * 관리 항목 칸 — 「첫 항목 외 N개 ▾」를 누르면 칸 안에서 펼쳐 전체를 한 줄씩 보인다(아코디언 · 사용자 지시 · #231).
 * 마우스를 올려 띄우는 말풍선은 쓰지 않는다. 한 개뿐이거나 없으면 그대로 낸다.
 */
const ManagedItemsSummary = ({ draft }: { draft: OperationDraft }) => {
  const [isOpen, setIsOpen] = useState(false);
  const listId = useId();
  const enabled = SHOWN_OPERATION_FLAG_KEYS.filter((key) => draft[key]).map(
    (key) => t.operationFlags[key],
  );
  const [first] = enabled;
  if (first === undefined || enabled.length === 1) return <>{managedItemsLabel(draft)}</>;

  return (
    <div className="routing-managed-accordion">
      <button
        type="button"
        className="routing-managed-toggle"
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() => setIsOpen((open) => !open)}
      >
        {t.values.moreItems(first, enabled.length - 1)}
        <Icon name={isOpen ? 'expand_less' : 'expand_more'} size={18} aria-hidden="true" />
      </button>
      {isOpen && (
        <ul id={listId} className="routing-managed-list">
          {enabled.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      )}
    </div>
  );
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
  title,
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
  dependenciesBlockedReason,
  removeBlockedReason,
  banner,
  onAdd,
  onEdit,
  onRemove,
  onReorder,
  onSave,
  onCancel,
  onOpenDependencies,
  showSaveActions = true,
  showTools = true,
}: OperationsPaneProps) => {
  const lockNoteId = useId();
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
      render: (row) => processLabel(row.processId),
    },
    /* 공정 · 공정명은 내용 폭만큼 — 고정 폭이면 긴 이름이 두 줄로 꺾였다(사용자 지시 · #231). */
    { key: 'operationName', header: t.fields.operationName },
    /*
     * 관리 항목만 폭을 지정하지 않는다 — 여러 값을 이어 담는 칸이라 남는 폭을 이 열이 가져가는 것이 맞다.
     * 나머지 열의 폭 합과 표 최소 폭의 차이가 곧 이 열의 하한이다(도출 표는 배치 규범 문서에).
     */
    {
      key: 'managedItems',
      header: t.fields.managedItems,
      render: (row) => <ManagedItemsSummary draft={row} />,
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
      // 초안이 이미 퍼센트(0~100)다 — 서버 비율과의 변환은 operation-order.ts 한 곳에서 한다(#231).
      render: (row) =>
        row.standardYieldRate === '' ? t.values.empty : t.values.percent(row.standardYieldRate),
    },
    {
      key: 'rowActions',
      header: t.fields.rowActions,
      width: '96px',
      /*
       * 잠긴 Rev 에서는 아이콘마다 까닭을 붙인다 — 화면 위 안내만 두면 아이콘을 누르려던 사람은 왜
       * 안 눌리는지 모른다. 비활성 단추는 마우스 올림을 받지 못해 감싼 칸이 툴팁을 진다.
       */
      render: (row, rowIndex) => {
        /* 서버가 선후행이 걸린 공정의 삭제를 저장 전체와 함께 거부한다 — 지우기 전에 막고 풀 길을 말한다. */
        const removeReason = isEditable ? removeBlockedReason(row) : null;
        const removeNoteId = `${lockNoteId}-${row.draftId}`;

        return (
          <span className="routing-row-actions" title={isEditable ? undefined : lockReason}>
            <IconButton
              icon="edit"
              size="sm"
              aria-label={t.actions.editOperation(rowIndex + 1)}
              aria-describedby={isEditable ? undefined : lockNoteId}
              disabled={!isEditable}
              onClick={() => onEdit(row.draftId)}
            />
            <span title={removeReason ?? undefined}>
              <IconButton
                icon="delete"
                size="sm"
                aria-label={t.actions.removeOperation(rowIndex + 1)}
                aria-describedby={
                  isEditable ? (removeReason === null ? undefined : removeNoteId) : lockNoteId
                }
                disabled={!isEditable || removeReason !== null}
                onClick={() => onRemove(row.draftId)}
              />
            </span>
            {removeReason !== null && (
              <span id={removeNoteId} className="routing-visually-hidden">
                {removeReason}
              </span>
            )}
          </span>
        );
      },
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
      <div className="wide-table routing-operations-table">
        {!isEditable && (
          <span id={lockNoteId} className="routing-visually-hidden">
            {lockReason}
          </span>
        )}
        <Table
          density="compact"
          /* 잠긴 Rev 에는 고칠 수 없는 편집 칸을 두지 않는다 — 조회할 정보 칸만(사용자 지시 · #231). */
          columns={centerColumns(
            isEditable ? columns : columns.filter((column) => column.key !== 'rowActions'),
          )}
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

  /* 공정 추가 · 선후행 — 제목 줄 오른쪽(상세 카드) 또는 표 위 단추 줄에 선다. */
  const tools = (
    <>
      {/* 잠긴 Rev(확정 · 폐기)에서는 공정 추가를 세우지 않는다 — 비활성 단추와 사유 문장 대신(사용자 지시 · #231). */}
      {isEditable && (
        <div className="field-cell">
          <Button variant="outlined" onClick={onAdd}>
            {t.actions.addOperation}
          </Button>
        </div>
      )}

      {dependenciesBlockedReason === null ? (
        <div className="field-cell">
          <Button variant="outlined" onClick={onOpenDependencies}>
            {t.actions.dependencies}
          </Button>
        </div>
      ) : (
        <DisabledAction
          label={t.actions.dependencies}
          reason={dependenciesBlockedReason}
          badge={t.values.dependenciesBlockedBadge}
        />
      )}
    </>
  );

  return (
    <section className="pane" aria-label={t.panes.operations}>
      {optionsNotice}
      {banner}

      {/* 상세 카드는 제목 줄 오른쪽에 단추를 둔다(#231). 제목이 없으면 종전처럼 표 위 단추 줄. */}
      {title !== undefined && (
        <div className="pane-heading-row routing-operations-heading">
          <h3 className="pane-title">{title}</h3>
          {isRevisionSelected && showTools && (
            <div className="routing-card-section-tools">{tools}</div>
          )}
        </div>
      )}
      {title === undefined && isRevisionSelected && showTools && (
        <div className="filter-bar">{tools}</div>
      )}

      {listSlot()}

      {isRevisionSelected && showSaveActions && (
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
