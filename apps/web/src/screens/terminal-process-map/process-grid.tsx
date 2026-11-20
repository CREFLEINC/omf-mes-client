import { Button, Checkbox, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { useFitColumns } from '../../patterns/column-fit';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useColumnWidths } from '../../patterns/column-resize';
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
}: ProcessGridProps) => {
  const columns: Column<ProcessRowView>[] = [
    /* 한 행의 여덟 기능을 함께 켜고 끄는 칸 — 공정 칸 앞에 따로 둔다. 글자 없이 확인칸만. */
    {
      key: 'openAll',
      header: t.grid.openAll,
      width: '88px',
      align: 'center',
      render: (row) => (
        <Checkbox
          checked={isRowOpen(row)}
          disabled={disabled}
          /* 줄마다 같은 이름이면 낭독기가 여러 개의 「전체 선택」을 가르지 못한다. */
          aria-label={`${row.processName} ${t.grid.openAll}`}
          onChange={(event) => {
            onToggleRow(row.processId, event.target.checked);
          }}
        />
      ),
    },
    {
      key: 'process',
      header: t.grid.process,
      width: '160px',
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
    ...FLAG_KEYS.map((key): Column<ProcessRowView> => ({
      key,
      header: flagLabel(key),
      width: '104px',
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
    {
      key: 'remove',
      header: t.grid.manage,
      width: '72px',
      align: 'center',
      render: (row) => (
        <Button
          variant="text"
          size="sm"
          disabled={disabled}
          aria-label={`${row.processName} ${t.grid.remove}`}
          onClick={() => {
            onRemove(row.processId);
          }}
        >
          {t.grid.remove}
        </Button>
      ),
    },
  ];

  /* 다른 표와 같이 열 폭 끌기 · 순서 바꾸기, 남는 폭은 나눠 갖고 넘치면 가로로 구른다(사용자 지시 2026-11-20 · #333). */
  const ordered = useColumnOrder('omf-mes:terminal-process-map:grid:order', columns);
  const resizable = useColumnWidths('omf-mes:terminal-process-map:grid', ordered);
  const fit = useFitColumns(resizable.columns, { scrollX: true });

  return (
    <div
      ref={fit.ref}
      className="inspection-queue-table terminal-map-matrix"
      style={resizable.style}
    >
      <Table
        columns={fit.columns}
        rows={rows}
        getRowId={(row) => String(row.processId)}
        density="compact"
        empty={empty}
      />
    </div>
  );
};
