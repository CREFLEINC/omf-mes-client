import {
  Button,
  EmptyState,
  MatrixGrid,
  SkeletonText,
  type MatrixColumn,
  type MatrixGroupHeader,
  type MatrixRow,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { DisabledAction } from './disabled-action';
import { flattenPermissionColumns, type PermissionGroup } from './permission-catalog';

const t = messages.usersRoles;

export interface PermissionGridPaneProps {
  /** 격자의 유일한 행 라벨. 고른 역할을 가리키는 값이다 */
  roleLabel: string;
  groups: PermissionGroup[];
  isLoading: boolean;
  /** 조회 실패 표시. null이 아니면 격자·빈 상태 대신 이것을 낸다 */
  loadError: ReactNode;
  /** 저장 실패 배너 슬롯 */
  banner: ReactNode;
  /** 후보 목록에 없는 열이 섰다는 안내 슬롯 */
  unlistedNotice: ReactNode;
  isDirty: boolean;
  isSaving: boolean;
  onToggle: (code: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * 우 칸 아래 — 기능 권한 격자. **부여·회수할 수 있다.**
 *
 * 종전에는 보기 전용이었다. 막아 둔 사유(권한 목록 미정 · 회신 E-9 대기)는 2026-09-01 사용자
 * 결정으로 풀렸고 — 입도는 **화면 단위**이며 후보 목록은 `GET /app/permissions` 가 준다 —
 * 설계도 그렇게 적는다(W-CO-02 §8 항목 7·8).
 *
 * **저장은 전체 치환이다.** 칸을 켤 때마다 서버를 부르지 않고 「저장」에서 최종 상태가 한 번에
 * 나간다 — 계약이 개별 부여·회수 경로를 두지 않았다. 같은 화면의 역할 부여와 같은 규약이다.
 *
 * **`onCellClick` 을 넘긴다.** 디자인 시스템은 그 prop 을 받을 때만 셀에 `tabIndex`·`onClick`·
 * `data-clickable` 을 붙인다 — 넘기지 않으면 격자를 키보드로 만질 수 없다. 별도의 `disabled`
 * prop 은 없어, 저장 중에는 **읽는 쪽에서** 조작을 흘린다(포커스를 뺏지 않으려는 것이다).
 *
 * **셀의 접근 이름을 화면이 만들어 넘긴다.** 셀은 내용 없이 상태만 갖는 밀집 격자라 디자인
 * 시스템의 자동 조합에 기댈 수 없다 — `'none'` 은 내부에서 「상태 없음」으로 정규화되고 상태명
 * 표에도 그 항목이 없어(설치본 실측), **부여되지 않은 칸만 이름 없는 빈 칸**이 된다.
 *
 * **`.wide-table` 로 감싸지 않는다.** 이 격자는 자기 가로 스크롤 상자를 갖고 있어 감싸면
 * `min-width: 58rem` 이 걸린다.
 */
export const PermissionGridPane = ({
  roleLabel,
  groups,
  isLoading,
  loadError,
  banner,
  unlistedNotice,
  isDirty,
  isSaving,
  onToggle,
  onSave,
  onCancel,
}: PermissionGridPaneProps) => {
  const noteId = useId();

  const columns = flattenPermissionColumns(groups);

  const gridColumns: MatrixColumn[] = columns.map((column) => ({
    key: column.code,
    label: column.label,
  }));

  /*
   * ⚠ **빈 묶음을 싣지 않는다.** 디자인 시스템이 `span` 합과 열 개수가 다르면 개발 경고를
   * 낸다. 후보 조회가 어떤 축을 0건으로 주는 경우가 실제로 있다.
   */
  const groupHeaders: MatrixGroupHeader[] = groups
    .filter((group) => group.columns.length > 0)
    .map((group) => ({ label: group.label, span: group.columns.length }));

  const gridRows: MatrixRow[] = [
    {
      label: roleLabel,
      cells: columns.map((column) => ({
        key: column.code,
        status: column.isGranted ? 'success' : 'none',
        ariaLabel: `${roleLabel} · ${column.label} · ${
          column.isGranted ? t.permission.granted : t.permission.notGranted
        }`,
      })),
    },
  ];

  const gridSlot = (): ReactNode => {
    /*
     * 실패를 빈 상태로 내면 「부여된 권한이 없습니다」가 되어 **없는 사실을 단정한다** —
     * 없는 것이 아니라 못 불러온 것이다. 그 상태로 저장하면 전체 회수가 나간다.
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

    return (
      <MatrixGrid
        size="sm"
        aria-describedby={noteId}
        columns={gridColumns}
        groupHeaders={groupHeaders}
        rows={gridRows}
        onCellClick={(_row, column) => {
          /* 저장 중에는 흘린다 — 보낸 뒤에 바뀐 값은 응답이 덮어써 사실과 어긋난다. */
          if (isSaving) return;

          onToggle(column.key);
        }}
      />
    );
  };

  return (
    <section className="pane" aria-label={t.panes.permission}>
      {banner}
      {unlistedNotice}

      {/*
       * 조작 안내는 **격자보다 앞에** 둔다. 여러 칸이 함께 보는 안내라 컨트롤 이름이 아니라
       * 무엇에 대한 안내인지로 시작한다(배치 규범 4).
       */}
      <p id={noteId} className="field-note">
        {t.permission.editNote}
      </p>

      {gridSlot()}

      <div className="form-actions">
        <Button variant="outlined" disabled={!isDirty || isSaving} onClick={onCancel}>
          {messages.common.cancel}
        </Button>

        {/*
         * 고친 것이 없으면 주 액션을 **비활성 + 사유**로 둔다(배치 규범 4).
         * 저장 중에는 진행 표시가 그 자리를 대신하므로 사유를 내지 않는다.
         */}
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
