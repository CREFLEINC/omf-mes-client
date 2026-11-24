import { Checkbox, IconButton, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { FLAG_KEYS, flagLabel, type FlagKey } from './flags';
import { isRowOpen } from './grid-draft';
import type { ProcessRowView } from './types';

const t = messages.terminalProcessMap;

export interface ProcessGridProps {
  rows: ProcessRowView[];
  /** 공정 번호 → 그 줄의 오류 문구 */
  rowErrors: ReadonlyMap<number, string>;
  disabled: boolean;
  onToggle: (processId: number, key: FlagKey) => void;
  onToggleRow: (processId: number, open: boolean) => void;
  onRemove: (processId: number) => void;
  /** 공정이 없을 때 표 안에 낼 빈 상태. */
  empty?: ReactNode;
  /** 공정 열 폭 — 넓은 자리(단말 추가 창)에서는 공정 이름이 잘리지 않게 넓힌다. */
  processWidth?: string;
}

/**
 * 기능 구성 격자 — 공정 한 줄에 여덟 칸.
 *
 * ⛔ **`List` 가 없다는 이유로 새 원시 요소를 만들지 않는다.** 조합으로 성립하므로
 * `Table density="compact"` 로 짠다(설계팀 판정: 갭 분류 `c`).
 *
 * ⭐ **줄 전체를 한 번에 여닫는 칸을 앞에 둔다.** 여덟 칸을 하나씩 누르게 두면 현장에서
 * 「대부분 열고 하나만 닫는」 흔한 구성이 여덟 번의 실수 기회가 된다.
 */
export const ProcessGrid = ({
  rows,
  rowErrors,
  disabled,
  onToggle,
  onToggleRow,
  onRemove,
  empty,
  processWidth = '128px',
}: ProcessGridProps) => {
  /* 시안(사용자 지시 2026-11-20 · #333) — 공정 | 모든 기능 | 기능 여덟 칸 | 휴지통. */
  const columns: Column<ProcessRowView>[] = [
    {
      key: 'process',
      header: t.grid.process,
      width: processWidth,
      render: (row) => {
        const error = rowErrors.get(row.processId);
        return error === undefined ? (
          row.processName
        ) : (
          <span className="terminal-map-process-cell">
            {row.processName}
            <span className="field-error">{error}</span>
          </span>
        );
      },
    },
    /* 한 줄의 기능을 함께 켜고 끈다 — 일부만 켜져 있으면 반쯤 표시. */
    {
      key: 'openAll',
      header: t.grid.openAll,
      align: 'center',
      render: (row) => {
        const on = FLAG_KEYS.filter((key) => row[key]).length;
        return (
          <Checkbox
            checked={isRowOpen(row)}
            indeterminate={on > 0 && on < FLAG_KEYS.length}
            disabled={disabled}
            /* 줄마다 같은 이름이면 낭독기가 여러 개의 「모든 기능」을 가르지 못한다. */
            aria-label={`${row.processName} ${t.grid.openAll}`}
            onChange={() => {
              onToggleRow(row.processId, !isRowOpen(row));
            }}
          />
        );
      },
    },
    ...FLAG_KEYS.map((key): Column<ProcessRowView> => ({
      key,
      header: flagLabel(key),
      align: 'center',
      render: (row) => (
        <Checkbox
          checked={row[key]}
          disabled={disabled}
          aria-label={`${row.processName} ${flagLabel(key)}`}
          onChange={() => {
            onToggle(row.processId, key);
          }}
        />
      ),
    })),
    /* 머리 글자 없이 휴지통 아이콘만 — 이름은 낭독기에만(사용자 지시 2026-11-20 · #333). */
    {
      key: 'remove',
      header: <span className="visually-hidden">{t.grid.manage}</span>,
      width: '64px',
      align: 'center',
      render: (row) => (
        <IconButton
          icon="delete"
          size="sm"
          variant="standard"
          disabled={disabled}
          aria-label={`${row.processName} ${t.grid.remove}`}
          onClick={() => {
            onRemove(row.processId);
          }}
        />
      ),
    },
  ];

  return (
    /* 열 순서 · 폭은 고정(사용자 지시 2026-11-20 · #333) — 넘치면 표 안에서 가로로 구른다. */
    <div className="inspection-queue-table terminal-map-matrix">
      <Table
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.processId)}
        density="compact"
        empty={empty}
      />
    </div>
  );
};
