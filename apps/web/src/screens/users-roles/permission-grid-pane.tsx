import { EmptyState, MatrixGrid, SkeletonText, type MatrixColumn, type MatrixRow } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import type { PermissionColumn } from './permission-catalog';

const t = messages.usersRoles;

export interface PermissionGridPaneProps {
  /** 격자의 유일한 행 라벨. 고른 역할을 가리키는 값이다 */
  roleLabel: string;
  columns: PermissionColumn[];
  isLoading: boolean;
  /** 조회 실패 표시. null이 아니면 격자·빈 상태 대신 이것을 낸다 */
  loadError: ReactNode;
}

/**
 * 우 칸 아래 — 기능 권한 격자. **보는 것까지만 된다.**
 *
 * 권한 목록이 확정되지 않아 화면이 고를 수 있는 값이 하나도 없다(이슈 #17 §4).
 * 그래서 격자는 그리되 **누를 수 없게** 두고, 그 사실을 항상 보이는 안내로 밝힌다.
 *
 * **`onCellClick`을 넘기지 않는다.** 디자인 시스템은 그 prop을 받을 때만 셀에
 * `tabIndex`·`onClick`·`data-clickable`을 붙인다 — 넘기는 순간 격자가 눌리고,
 * 누를 수 있는 격자는 「바꿀 수 있다」고 읽힌다. 별도의 `disabled` prop은 없다.
 *
 * **저장 버튼을 두지 않는다.** 부를 치환이 없으면 「비활성 저장 버튼」도 둘 이유가 없다.
 *
 * **`.wide-table`로 감싸지 않는다.** 이 격자는 자기 가로 스크롤 상자를 갖고 있어
 * 감싸면 `min-width: 58rem`이 열 하나짜리 격자에도 걸린다.
 */
export const PermissionGridPane = ({
  roleLabel,
  columns,
  isLoading,
  loadError,
}: PermissionGridPaneProps) => {
  const noteId = useId();

  const gridColumns: MatrixColumn[] = columns.map((column) => ({
    key: column.code,
    // 권한 이름 목록이 아직 없다 — 코드를 그대로 낸다. 없는 이름을 지어내지 않는다.
    label: column.code,
  }));

  const gridRows: MatrixRow[] = [
    {
      label: roleLabel,
      cells: columns.map((column) => ({
        key: column.code,
        /*
         * 셀은 내용 없이 상태만 갖는다(밀집 격자). 그래서 **접근 이름을 화면이 만들어 넘긴다.**
         *
         * 디자인 시스템의 자동 조합에 기대면 안 된다 — 그 분기는 상태가 있는 셀에만 도는데,
         * `'none'`은 내부에서 「상태 없음」으로 정규화되고 상태명 표에도 그 항목이 없다(설치본 실측).
         * 즉 **부여되지 않은 칸만 이름 없는 빈 칸이 되어** 보조기술에게 그 칸의 뜻이 닿지 않는다.
         * 자리표시가 채워지는 날 그 칸이 처음 생기므로, 지금 두 갈래를 다 만들어 둔다.
         */
        status: column.isGranted ? 'success' : 'none',
        ariaLabel: `${roleLabel} · ${column.code} · ${
          column.isGranted ? t.permission.granted : t.permission.notGranted
        }`,
      })),
    },
  ];

  const gridSlot = (): ReactNode => {
    /*
     * 실패를 빈 상태로 내면 「부여된 권한이 없습니다」가 되어 **없는 사실을 단정한다** —
     * 없는 것이 아니라 못 불러온 것이다.
     */
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.permissions}>
          <SkeletonText lines={2} />
        </div>
      );
    }

    /* 열이 0개면 라벨 칸만 남은 빈 표가 된다 — 격자 대신 빈 상태를 낸다. */
    if (columns.length === 0) {
      return (
        <EmptyState
          size="sm"
          live
          aria-describedby={noteId}
          title={t.permission.empty.none}
          description={t.permission.empty.noneDescription}
        />
      );
    }

    return <MatrixGrid size="sm" aria-describedby={noteId} columns={gridColumns} rows={gridRows} />;
  };

  return (
    <section className="pane" aria-label={t.panes.permission}>
      {/*
       * 안내는 **격자보다 앞에** 두고 감추지 않는다. 비활성 컨트롤은 포커스를 받지 못해
       * 사유를 시각으로만 두면 보조기술이 닿을 수 없다(배치 규범 4).
       * 여러 칸이 함께 보는 안내라 컨트롤 이름이 아니라 무엇에 대한 안내인지로 시작한다.
       */}
      <p id={noteId} className="field-note">
        {t.permission.pendingNote}
      </p>

      {gridSlot()}
    </section>
  );
};
