import {
  Button,
  Checkbox,
  EmptyState,
  Icon,
  SkeletonText,
  Table,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useId } from 'react';

import { DisabledAction } from './disabled-action';
import { toPermissionRows, type PermissionGroup, type PermissionRow } from './permission-catalog';

const t = messages.usersRoles;

export interface PermissionGridPaneProps {
  /** 표의 대상. 고른 역할을 가리키는 값이고, 칸의 접근 이름에 들어간다 */
  roleLabel: string;
  groups: PermissionGroup[];
  isLoading: boolean;
  /** 조회 실패 표시. null이 아니면 표·빈 상태 대신 이것을 낸다 */
  loadError: ReactNode;
  /** 저장 실패 배너 슬롯 */
  banner: ReactNode;
  /** 후보 목록에 없는 행이 섰다는 안내 슬롯 */
  unlistedNotice: ReactNode;
  isDirty: boolean;
  isSaving: boolean;
  onToggle: (code: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onSave: () => void;
  onCancel: () => void;
  /** 아래 [취소][저장] 줄. 끄면 역할 설정 카드 아래 한 줄이 맡는다(사용자 관리 탭과 같다 · #333). */
  showActions?: boolean;
}

/**
 * 우 칸 아래 — 기능 권한 표. **부여·회수할 수 있다.**
 *
 * ⭐ **세로 표다**(#1308). 처음에는 역할 하나를 행으로 두고 권한을 열로 세운 밀집 격자였는데,
 * 권한이 117개라 열이 117개가 되어 **오른쪽 끝 권한을 눌러서 고를 수가 없었다** — 격자가 자기
 * 가로 스크롤 상자를 갖고, 페인이 화면보다 넓어져 아래 「취소·저장」 줄까지 화면 밖으로 밀렸다.
 * 권한을 행으로 세우고 **표에만 세로 스크롤**을 두어 페인과 액션 줄이 자리를 지키게 한다.
 *
 * **저장은 전체 치환이다.** 칸을 켤 때마다 서버를 부르지 않고 「저장」에서 최종 상태가 한 번에
 * 나간다 — 계약이 개별 부여·회수 경로를 두지 않았다. 같은 화면의 역할 부여와 같은 규약이다.
 *
 * ⛔ **디자인 시스템 `Table` 의 `selectable` 선택 열을 쓰지 않는다.** 그 열은 행마다 같은 접근
 * 이름(`행 선택`)을 붙여, 117행이 전부 「행 선택」으로 읽힌다(설치본 실측). 어느 권한의 칸인지
 * 보조기술에 닿지 않으므로 **확인칸을 이 화면이 직접 그리고 이름을 만들어 넘긴다.**
 * 머리글의 전체 선택도 그래서 쓰지 않고, 아래 「전체 선택·전체 해제」 버튼이 그 몫을 한다.
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
  onSelectAll,
  onClearAll,
  onSave,
  onCancel,
  showActions = true,
}: PermissionGridPaneProps) => {
  const noteId = useId();

  const rows = toPermissionRows(groups);

  const columns: Column<PermissionRow>[] = [
    {
      key: 'granted',
      header: t.permission.columns.granted,
      width: '5rem',
      align: 'center',
      render: (row) => (
        <Checkbox
          checked={row.isGranted}
          disabled={isSaving}
          /*
           * 확인칸에 보이는 글자를 두지 않는다 — 옆 칸이 이미 권한 이름이라 같은 말이 두 번
           * 읽힌다. 대신 **어느 역할의 어느 권한인지**를 접근 이름으로 만들어 넘긴다.
           */
          aria-label={`${roleLabel} · ${row.label} · ${
            row.isGranted ? t.permission.granted : t.permission.notGranted
          }`}
          onChange={() => {
            onToggle(row.code);
          }}
        />
      ),
    },
    { key: 'label', header: t.permission.columns.name, render: (row) => row.label },
    {
      key: 'code',
      header: t.permission.columns.code,
      width: '9rem',
      align: 'center',
      render: (row) => row.code,
    },
  ];

  const tableSlot = (): ReactNode => {
    /*
     * 실패를 빈 상태로 내면 「부여할 수 있는 권한이 없습니다」가 되어 **없는 사실을 단정한다** —
     * 없는 것이 아니라 못 불러온 것이다. 그 상태로 저장하면 전체 회수가 나간다.
     */
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.permissions}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    if (rows.length === 0) {
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

    /*
     * ⭐ **표만 구른다.** 페인 전체가 구르면 아래 액션 줄이 화면 밖으로 밀려, 고른 뒤 저장을
     * 찾아 다시 끝까지 내려가야 한다. 높이 제한과 스크롤은 `.permission-table-scroll` 이 준다.
     */
    return (
      <div className="permission-table-scroll">
        <Table<PermissionRow>
          aria-describedby={noteId}
          caption={t.permission.tableCaption(roleLabel)}
          density="compact"
          columns={columns}
          rows={rows}
          getRowId={(row) => row.code}
          groupBy={(row) => row.groupKey}
          renderGroupHeader={(groupKey, groupRows) => groupRows[0]?.groupLabel ?? groupKey}
        />
      </div>
    );
  };

  const hasRows = rows.length > 0 && (loadError === null || loadError === undefined) && !isLoading;

  return (
    <section
      className="pane users-roles-pane users-roles-permission-pane"
      aria-label={t.panes.permission}
    >
      {/*
       * 표제 줄 — 왼쪽 「기능 권한」 + 라벨 안내, 오른쪽 전체 선택 · 해제(데이터 접근 범위 구역과 같은 모양 · #333).
       * 전체 선택·해제는 고르기만 하고 저장은 따로라 아래 [저장]과 떨어뜨린다.
       */}
      <div className="pane-heading-row users-roles-heading">
        <div className="users-roles-scope-title">
          <h3 className="pane-title">{t.panes.permission}</h3>
          <p
            id={noteId}
            className="iqc-inspection-action-note users-roles-scope-hint"
            data-tone="info"
          >
            <Icon name="info" size={14} aria-hidden />
            {t.permission.hint}
          </p>
        </div>
        {hasRows && (
          <div className="permission-bulk-actions">
            <Button
              variant="outlined"
              size="sm"
              className="app-button-neutral"
              disabled={isSaving}
              onClick={onSelectAll}
            >
              {t.permission.selectAll}
            </Button>
            <Button
              variant="outlined"
              size="sm"
              className="app-button-neutral"
              disabled={isSaving}
              onClick={onClearAll}
            >
              {t.permission.clearAll}
            </Button>
          </div>
        )}
      </div>
      {banner}
      {unlistedNotice}

      {tableSlot()}

      {showActions && (
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
      )}
    </section>
  );
};
