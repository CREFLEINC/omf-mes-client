import {
  AlertBanner,
  Button,
  Chip,
  Dialog,
  EmptyState,
  SearchInput,
  Skeleton,
  Table,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';

import { CANDIDATE_PAGE_SIZE, useRecipientCandidates } from './queries';
import type { Candidate } from './types';

const t = messages.alarmRecipientSettings;

export interface RecipientPickerProps {
  open: boolean;
  /** 이미 수신자인 사람 — 다시 고를 수 없게 표식만 붙인다(행은 그대로 둬 쪽 수가 흔들리지 않는다) */
  existingIds: ReadonlySet<number>;
  onAdd: (picked: Candidate[]) => void;
  onClose: () => void;
}

/**
 * 수신자 추가 창 — 검색 + 표 행 체크로 여럿을 고른다.
 *
 * DS 에 다중 선택 부품이 없어 `Dialog` · `SearchInput` · `Table(selectable)` 을 조합한다
 * (설계 W-CO-11). 조합물은 이 화면 슬라이스가 소유한다.
 *
 * ⭐ **고른 사람은 쪽을 넘겨도 남는다** — 이름순으로 흩어진 사람을 한 번에 더할 수 있어야 한다.
 * 그래서 고른 것을 쪽 단위가 아니라 번호 → 후보로 든다.
 */
export const RecipientPicker = ({ open, existingIds, onAdd, onClose }: RecipientPickerProps) => {
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<Map<number, Candidate>>(() => new Map());
  const candidates = useRecipientCandidates(appliedKeyword, page, open);

  /* 다시 열 때 지난번 고른 것·검색어가 남아 있으면 「안 고른 사람」이 더해진다. */
  useEffect(() => {
    if (open) return;
    setKeyword('');
    setAppliedKeyword('');
    setPage(1);
    setPicked(new Map());
  }, [open]);

  const rows = candidates.data?.items ?? [];
  const total = candidates.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / CANDIDATE_PAGE_SIZE));

  const applySearch = (value: string): void => {
    setAppliedKeyword(value.trim());
    setPage(1);
  };

  /** 표가 주는 것은 이 쪽의 선택 결과다 — 다른 쪽에서 고른 사람은 건드리지 않는다. */
  const changeSelection = (nextIds: string[]): void => {
    const selected = new Set(nextIds);
    setPicked((current) => {
      const next = new Map(current);
      for (const row of rows) {
        if (existingIds.has(row.appUserId)) continue;
        if (selected.has(String(row.appUserId))) next.set(row.appUserId, row);
        else next.delete(row.appUserId);
      }
      return next;
    });
  };

  const columns: Column<Candidate>[] = [
    {
      key: 'userName',
      header: t.columns.userName,
      render: (row) =>
        existingIds.has(row.appUserId) ? (
          <span>
            {row.userName} <Chip size="sm">{t.values.alreadyAdded}</Chip>
          </span>
        ) : (
          row.userName
        ),
    },
    { key: 'loginId', header: t.columns.loginId, render: (row) => row.loginId },
    {
      key: 'department',
      header: t.columns.department,
      render: (row) => row.departmentName ?? t.values.noDepartment,
    },
    {
      key: 'phone',
      header: t.columns.phone,
      render: (row) =>
        row.hasPhone ? (
          t.values.hasPhone
        ) : (
          <Chip status="warning" size="sm">
            {`📵 ${t.values.noPhone}`}
          </Chip>
        ),
    },
  ];

  const body = (() => {
    if (candidates.isError) {
      return (
        <AlertBanner
          variant="error"
          action={
            <Button
              variant="outlined"
              size="sm"
              onClick={() => {
                void candidates.refetch();
              }}
            >
              {messages.common.retry}
            </Button>
          }
        >
          {t.errors.lookupFailed}
        </AlertBanner>
      );
    }

    if (candidates.isPending) return <Skeleton variant="rect" height="12rem" />;

    return (
      <Table
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.appUserId)}
        density="compact"
        caption={t.picker.caption}
        selectable
        selectedIds={[...picked.keys()].map(String)}
        onSelectionChange={changeSelection}
        empty={<EmptyState size="sm" title={t.state.candidatesEmpty} />}
      />
    );
  })();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t.picker.title}
      size="lg"
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {t.actions.cancel}
          </Button>
          <Button
            disabled={picked.size === 0}
            onClick={() => {
              onAdd([...picked.values()]);
            }}
          >
            {t.actions.addSelected(picked.size)}
          </Button>
        </>
      }
    >
      <div className="alarm-picker">
        <SearchInput
          label={t.picker.searchLabel}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onSearch={applySearch}
          onClear={() => applySearch('')}
          fullWidth
        />
        {body}
        {totalPages > 1 && (
          <div className="alarm-picker-pages">
            <Button
              variant="text"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              {t.actions.prevPage}
            </Button>
            <span>{t.state.pageOf(page, totalPages)}</span>
            <Button
              variant="text"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              {t.actions.nextPage}
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
};
