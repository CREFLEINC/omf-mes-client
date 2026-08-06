import { type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { DisabledAction } from './disabled-action';
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
}

/**
 * 관리 플래그 7종과 그 짧은 이름. **배열 순서가 곧 표시 순서다** —
 * 행마다 순서가 달라지면 열을 훑어 비교할 수 없다.
 */
const MANAGED_FLAGS: readonly [keyof OperationDraft, string][] = [
  ['mesManaged', t.operationFlags.mesManaged],
  ['materialInputManaged', t.operationFlags.materialInputManaged],
  ['productionResultManaged', t.operationFlags.productionResultManaged],
  ['inspectionManaged', t.operationFlags.inspectionManaged],
  ['outputLotRequired', t.operationFlags.outputLotRequired],
  ['equipmentRequired', t.operationFlags.equipmentRequired],
  ['moldRequired', t.operationFlags.moldRequired],
];

/**
 * 켜진 관리 항목의 이름만 이어 한 칸에 낸다.
 *
 * 확인 아이콘을 7개 늘어놓지 않는 이유는 보조기술에서 의미가 잡히지 않고
 * 열이 화면 폭을 먹기 때문이다. 전체 항목은 행 편집 다이얼로그에서 본다.
 */
const managedItemsLabel = (draft: OperationDraft): string => {
  const enabled = MANAGED_FLAGS.filter(([key]) => draft[key] === true).map(([, label]) => label);

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
 */
export const OperationsPane = ({
  drafts,
  processLabel,
  isLoading,
  isRevisionSelected,
  loadError,
  optionsNotice,
}: OperationsPaneProps) => {
  const columns: Column<OperationDraft>[] = [
    {
      key: 'displayNo',
      header: t.fields.operationNo,
      align: 'end',
      width: '64px',
      render: (_row, rowIndex) => String(rowIndex + 1),
    },
    { key: 'processId', header: t.fields.process, render: (row) => processLabel(row.processId) },
    { key: 'operationName', header: t.fields.operationName },
    {
      key: 'managedItems',
      header: t.fields.managedItems,
      render: (row) => managedItemsLabel(row),
    },
    {
      key: 'standardCycleTimeSec',
      header: t.fields.standardCycleTimeSec,
      align: 'end',
      render: (row) => orEmptyMark(row.standardCycleTimeSec),
    },
    {
      key: 'standardYieldRate',
      header: t.fields.standardYieldRate,
      align: 'end',
      // 비율 그대로 낸다. 퍼센트로 보이면서 비율로 저장하면 100배 오입력이 조용히 통과한다.
      render: (row) => orEmptyMark(row.standardYieldRate),
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

    return (
      <Table
        density="compact"
        columns={columns}
        rows={drafts}
        getRowId={(row) => row.draftId}
        empty={
          <EmptyState
            size="sm"
            live
            title={t.empty.operationNoneTitle}
            description={t.empty.operationNoneDescription}
          />
        }
      />
    );
  };

  return (
    <section className="pane" aria-label={t.panes.operations}>
      {optionsNotice}

      {isRevisionSelected && (
        <div className="filter-bar">
          <DisabledAction
            label={t.actions.addOperation}
            reason={t.actionReasons.addOperationNotReady}
          />
          <DisabledAction
            label={t.actions.dependencies}
            reason={t.actionReasons.dependenciesUnavailable}
          />
        </div>
      )}

      {listSlot()}
    </section>
  );
};
