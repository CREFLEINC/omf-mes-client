import { Button, EmptyState, Skeleton, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { codeLabel, PLACEHOLDER_HISTORY_TYPES, PLACEHOLDER_RESULT_CODES } from './code-options';
import type { CalibrationView } from './types';

const t = messages.gaugeCalibration;

/** 값이 없는 칸. ⛔ 빈 칸으로 두지 않는다 — 표가 덜 그려진 것으로 읽힌다. */
const optional = (value: string | null): string =>
  value === null || value.trim() === '' ? t.table.notAvailable : value;

const columns: Column<CalibrationView>[] = [
  { key: 'performedOn', header: t.table.performedOn, render: (row) => row.performedOn },
  {
    key: 'equipmentCode',
    header: t.table.equipment,
    render: (row) => optional(row.equipmentCode),
  },
  {
    key: 'historyTypeCode',
    header: t.table.historyType,
    /* 이름을 못 찾으면 코드를 그대로 보인다 — 「알 수 없음」은 담당자에게 전할 단서를 지운다. */
    render: (row) => codeLabel(row.historyTypeCode, PLACEHOLDER_HISTORY_TYPES),
  },
  {
    key: 'resultCode',
    header: t.table.result,
    render: (row) => codeLabel(row.resultCode, PLACEHOLDER_RESULT_CODES),
  },
  { key: 'nextDueOn', header: t.table.nextDueOn, render: (row) => optional(row.nextDueOn) },
  {
    key: 'certificateNo',
    header: t.table.certificateNo,
    render: (row) => optional(row.certificateNo),
  },
  { key: 'agencyName', header: t.table.agency, render: (row) => optional(row.agencyName) },
  { key: 'remarks', header: t.table.remarks, render: (row) => optional(row.remarks) },
];

export interface HistoryTableProps {
  rows: CalibrationView[];
  isLoading: boolean;
  /** 결과는 있는데 이 쪽에는 없다 — 주소 조작이나 조건 변경으로 생긴다. */
  isBeyondLast: boolean;
  onFirstPage: () => void;
}

/**
 * 이력 목록.
 *
 * ⛔ **줄을 누를 수 없다.** 고칠 수도 지울 수도 없는 자료라 열어 볼 상세가 따로 없고, 목록이
 * 이미 모든 칸을 보이고 있다. 누르게 두면 사용자는 거기서 고칠 수 있을 것으로 읽는다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const HistoryTable = ({ rows, isLoading, isBeyondLast, onFirstPage }: HistoryTableProps) => {
  if (isLoading) return <Skeleton variant="rect" height="12rem" />;

  if (isBeyondLast) {
    return (
      <EmptyState
        size="sm"
        live
        title={t.table.beyondLastTitle}
        description={t.table.beyondLast}
        action={
          <Button variant="outlined" onClick={onFirstPage}>
            {t.table.firstPage}
          </Button>
        }
      />
    );
  }

  return (
    <div className="wide-table gauge-calibration-table">
      <Table
        caption={<span className="gauge-calibration-table-caption">{t.panes.list}</span>}
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.calibrationId)}
        density="compact"
        empty={<EmptyState size="sm" live title={t.table.emptyTitle} description={t.table.empty} />}
      />
    </div>
  );
};
