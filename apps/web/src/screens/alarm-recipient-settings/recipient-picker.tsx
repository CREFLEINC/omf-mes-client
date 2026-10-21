import {
  AlertBanner,
  Button,
  Checkbox,
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
 * DS 에 다중 선택 부품이 없어 `Dialog` · `SearchInput` · `Table` · `Checkbox` 를 조합한다
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
  const total = candidates.data?.page.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / CANDIDATE_PAGE_SIZE));

  const applySearch = (value: string): void => {
    setAppliedKeyword(value.trim());
    setPage(1);
  };

  /** 한 줄을 고르거나 푼다. 다른 쪽에서 고른 사람은 그대로 남는다. */
  const toggle = (row: Candidate, checked: boolean): void => {
    setPicked((current) => {
      const next = new Map(current);
      if (checked) next.set(row.appUserId, row);
      else next.delete(row.appUserId);
      return next;
    });
  };

  /*
   * 체크 열을 직접 둔다 — DS `Table` 의 선택 열은 행마다 막을 수 없는데, 이미 수신자인 사람은
   * 고를 수 없어야 한다(다시 더해도 서버가 중복으로 거절한다).
   */
  const columns: Column<Candidate>[] = [
    {
      key: 'pick',
      header: '',
      render: (row) => (
        <Checkbox
          aria-label={t.values.selectRow(row.userName)}
          checked={existingIds.has(row.appUserId) || picked.has(row.appUserId)}
          disabled={existingIds.has(row.appUserId)}
          onChange={(event) => toggle(row, event.target.checked)}
        />
      ),
    },
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
          clearLabel={messages.common.clear}
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
