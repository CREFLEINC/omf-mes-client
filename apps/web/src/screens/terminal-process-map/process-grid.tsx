import { Button, Checkbox, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { FLAG_KEYS, flagLabel, type FlagKey } from './flags';
import { isRowOpen } from './grid-draft';
import type { ProcessRowView } from './types';

const t = messages.terminalProcessMap;

export interface ProcessGridProps {
  rows: ProcessRowView[];
  disabled: boolean;
  onToggle: (processId: number, key: FlagKey) => void;
  onToggleRow: (processId: number, open: boolean) => void;
  onRemove: (processId: number) => void;
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
  disabled,
  onToggle,
  onToggleRow,
  onRemove,
}: ProcessGridProps) => {
  const columns: Column<ProcessRowView>[] = [
    {
      key: 'process',
      header: t.grid.process,
      render: (row) => (
        <span className="stacked-cell">
          <span>{row.processName}</span>
          <Checkbox
            checked={isRowOpen(row)}
            disabled={disabled}
            /* 줄마다 같은 이름이면 낭독기가 여덟 개의 「모두 열기」를 가르지 못한다. */
            aria-label={`${row.processName} ${t.grid.openAll}`}
            onChange={(event) => {
              onToggleRow(row.processId, event.target.checked);
            }}
          >
            {t.grid.openAll}
          </Checkbox>
        </span>
      ),
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
    {
      key: 'remove',
      header: t.grid.remove,
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

  return (
    <div className="wide-table">
      <Table
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.processId)}
        density="compact"
      />
    </div>
  );
};
