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
import { useEffect, useId, useState } from 'react';

import { TAB_PAGE_SIZES, type TabPageSize } from '../../patterns/client-page';
import { PageNav } from '../../patterns/page-nav';
import { Select } from '../../patterns/select';
import { useDepartments, useRecipientCandidates } from './queries';
import type { Candidate } from './types';

const t = messages.alarmRecipientSettings;

export interface RecipientPickerProps {
  open: boolean;
  /** 이미 수신자인 사람 — 다시 고를 수 없게 표식만 붙인다(행은 그대로 둬 쪽 수가 흔들리지 않는다) */
  existingIds: ReadonlySet<number>;
  onAdd: (picked: Candidate[]) => void;
  onClose: () => void;
  /**
   * 수신자 최대 인원(이미 있는 사람 포함, D-11). 차면 남은 체크가 잠긴다.
   * 주지 않으면 상한이 없고 지금과 같다(W-CO-11).
   */
  max?: number;
}

/**
 * 수신자 추가 창 — 부서 · 검색으로 좁히고 표 행 체크로 여럿을 고른다.
 *
 * 후보 조회에 부서 조건이 없어(후보는 부서 이름만 준다) 검색어에 맞는 사람을 다 받은 뒤 **화면에서** 부서로 거르고
 * 쪽을 나눈다. 닫기(X)는 없다 — [취소] · Esc 로 닫는다(사용자 지시 2026-11-25).
 *
 * DS 에 다중 선택 부품이 없어 `Dialog` · `SearchInput` · `Table` · `Checkbox` 를 조합한다
 * (설계 W-CO-11). 조합물은 이 화면 슬라이스가 소유한다.
 *
 * ⭐ **고른 사람은 쪽을 넘겨도 남는다** — 이름순으로 흩어진 사람을 한 번에 더할 수 있어야 한다.
 * 그래서 고른 것을 쪽 단위가 아니라 번호 → 후보로 든다.
 */
export const RecipientPicker = ({
  open,
  existingIds,
  onAdd,
  onClose,
  max,
}: RecipientPickerProps) => {
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  /** 고른 부서 번호(문자열). 빈 값이 「전체」. */
  const [departmentId, setDepartmentId] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<TabPageSize>(TAB_PAGE_SIZES[0]);
  const [picked, setPicked] = useState<Map<number, Candidate>>(() => new Map());
  const candidates = useRecipientCandidates(appliedKeyword, open);
  /* 부서 선택지는 알림 수신자 설정 위쪽 「부서 선택」과 같은 목록(사용 중인 부서)이다. */
  const departments = useDepartments();
  const departmentSelectId = useId();

  /* 다시 열 때 지난번 고른 것·검색어가 남아 있으면 「안 고른 사람」이 더해진다. */
  useEffect(() => {
    if (open) return;
    setKeyword('');
    setAppliedKeyword('');
    setDepartmentId('');
    setPage(1);
    setSize(TAB_PAGE_SIZES[0]);
    setPicked(new Map());
  }, [open]);

  const departmentName =
    departments.data?.items.find((item) => String(item.departmentId) === departmentId)
      ?.departmentName ?? null;
  /* 후보는 부서 이름만 준다 — 고른 부서의 이름과 같은 사람만 남긴다. */
  const filtered = (candidates.data?.items ?? []).filter(
    (row) => departmentId === '' || row.departmentName === departmentName,
  );
  const total = filtered.length;
  const current = Math.min(page, Math.max(1, Math.ceil(total / size)));
  const rows = filtered.slice((current - 1) * size, current * size);
  const departmentOptions = [
    { value: '', label: t.picker.departmentAll },
    ...(departments.data?.items.map((item) => ({
      value: String(item.departmentId),
      label: `${item.departmentCode} · ${item.departmentName}`,
    })) ?? []),
  ];
  /* 더 고를 수 있는 사람 수(지금 고른 사람까지 뺀다). 상한이 없으면 null. */
  const slotsLeft = max === undefined ? null : Math.max(0, max - existingIds.size - picked.size);

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
      /* 이미 수신자인 사람은 체크 칸을 두지 않는다 — 빈 칸은 남겨 열 줄을 맞춘다. */
      render: (row) =>
        existingIds.has(row.appUserId) ? null : (
          <Checkbox
            aria-label={t.values.selectRow(row.userName)}
            checked={picked.has(row.appUserId)}
            disabled={slotsLeft === 0 && !picked.has(row.appUserId)}
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
      /* 없으면 그 사람만 Zalo 를 건너뛴다(알림센터로는 받는다) — 추가는 막지 않고 보조 글로만 알린다. */
      render: (row) =>
        row.hasPhone ? (
          t.values.hasPhone
        ) : (
          <span className="alarm-picker-muted">{t.values.phoneMissing}</span>
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
      /*
       * 줄 어디를 눌러도 고르거나 푼다(사용자 지시 2026-11-25). DS 표에 줄 클릭이 없어 그 줄의 체크 칸을 대신 누른다 —
       * 이미 수신자(체크 칸 없음) · 남은 자리 없음(체크 칸 잠김)은 체크 칸과 똑같이 막힌다.
       */
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- 키보드는 줄마다 있는 체크 칸이 맡는다.
      <div
        className="alarm-picker-rows"
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest('input, button, label') !== null) return;
          const box = target
            .closest('tr')
            ?.querySelector<HTMLInputElement>('input[type="checkbox"]');
          if (box !== null && box !== undefined && !box.disabled) box.click();
        }}
      >
        <Table
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.appUserId)}
          density="compact"
          aria-label={t.picker.caption}
          empty={<EmptyState size="sm" title={t.state.candidatesEmpty} />}
        />
      </div>
    );
  })();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t.picker.title}
      size="lg"
      /* 모든 창의 닫기(X)를 없앴다 — [취소] · Esc 로 닫는다(사용자 지시 2026-11-25). */
      showCloseButton={false}
      footer={
        <>
          {/* 상한이 있는 화면만 — 왼쪽 끝에 남은 자리(지금 고른 사람까지 뺀 수). */}
          {slotsLeft !== null && (
            <span className="alarm-picker-limit">{t.picker.addable(slotsLeft)}</span>
          )}
          <Button variant="outlined" onClick={onClose}>
            {t.actions.cancel}
          </Button>
          <Button
            disabled={picked.size === 0}
            onClick={() => {
              onAdd([...picked.values()]);
            }}
          >
            {picked.size === 0 ? t.actions.addPick : t.actions.addSelected(picked.size)}
          </Button>
        </>
      }
    >
      <div className="alarm-picker">
        <div className="alarm-picker-controls">
          <div className="field-cell alarm-picker-department">
            <label className="field-label" htmlFor={departmentSelectId}>
              {t.fields.department}
            </label>
            <Select
              id={departmentSelectId}
              options={departmentOptions}
              value={departmentId}
              placeholder={t.picker.departmentAll}
              disabled={departments.isPending}
              onChange={(value) => {
                setDepartmentId(value);
                /* 조건이 바뀌면 쪽 번호는 뜻을 잃는다 — 고른 사람은 그대로 남는다. */
                setPage(1);
              }}
            />
          </div>
          <SearchInput
            containerClassName="alarm-picker-search"
            label={t.picker.searchLabel}
            placeholder={t.picker.searchPlaceholder}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={applySearch}
            onClear={() => applySearch('')}
            clearLabel={messages.common.clear}
            fullWidth
          />
        </div>
        {candidates.data?.truncated === true && (
          <span className="field-note">{t.picker.truncated}</span>
        )}
        {body}
        {/* 목록 표 아래와 같은 쪽 이동 줄 — 총 건수 · 10 · 20 · 50건 · [처음] [이전] n/N [다음] [마지막]. */}
        <PageNav
          meta={{ page: current, size, total }}
          sizes={TAB_PAGE_SIZES}
          onChangePage={setPage}
          onChangeSize={(next) => {
            setSize(next);
            setPage(1);
          }}
        />
      </div>
    </Dialog>
  );
};
