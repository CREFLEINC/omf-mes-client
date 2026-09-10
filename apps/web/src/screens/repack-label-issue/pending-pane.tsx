import { Button, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { HandlingUnit } from './types';

const t = messages.repackLabelIssue.pending;

export interface PendingPaneProps {
  rows: readonly HandlingUnit[];
  selectedId: number | null;
  isLoading: boolean;
  isError: boolean;
  disabled: boolean;
  onSelect: (handlingUnitId: number) => void;
  onRetry: () => void;
}

/** 발행 대기 목록 — 계약의 `labelIssued=false` 결과만 보여 준다(§4-A·§5-1). */
export const PendingPane = ({
  rows,
  selectedId,
  isLoading,
  isError,
  disabled,
  onSelect,
  onRetry,
}: PendingPaneProps) => {
  const columns: Column<HandlingUnit>[] = [
    {
      key: 'handlingUnitNo',
      header: t.numberColumn,
      render: (row) => t.newNumber(row.handlingUnitNo),
    },
    { key: 'handlingUnitTypeCode', header: t.typeColumn },
    {
      key: 'select',
      /*
       * ⛔ **머리글을 두지 않는다**(사용자 지시 2026-09-11). 「선택」이라고 적어 두면 그
       *    낱말이 칸 안의 [ 선택 ] 단추 바로 위에 겹쳐 같은 말을 두 번 한다.
       *
       * ⚠ 읽어 주는 이름은 단추가 갖고 있다(`aria-label`) — 머리글을 비워도 무엇을 고르는
       *   자리인지가 사라지지 않는다.
       */
      header: '',
      align: 'end',
      width: '9rem',
      render: (row) => {
        const selected = row.handlingUnitId === selectedId;

        return (
          <Button
            variant={selected ? 'filled' : 'outlined'}
            size="sm"
            disabled={disabled || selected}
            aria-pressed={selected}
            aria-label={selected ? t.selected : t.select(row.handlingUnitNo)}
            onClick={() => onSelect(row.handlingUnitId)}
          >
            {selected ? t.selected : t.selectAction}
          </Button>
        );
      },
    },
  ];

  if (isError) {
    return (
      <div className="pop-repack-pending-state" role="alert">
        <p>{t.loadFailed}</p>
        <Button variant="outlined" size="sm" onClick={onRetry}>
          {messages.common.retry}
        </Button>
      </div>
    );
  }

  return (
    <div className="pop-repack-pending-table">
      <Table
        rows={[...rows]}
        columns={columns}
        getRowId={(row) => String(row.handlingUnitId)}
        density="compact"
        /*
         * ⛔ **보이는 이름표를 달지 않는다**(사용자 지시 2026-09-11). 표 위 가운데에 서던
         *    「라벨을 아직 발행하지 않은 신규 포장」이 구획 표제 「발행 대기」와 같은 말을
         *    두 번 하고, 가운데 정렬이라 표의 머리글처럼 읽혔다.
         *
         * ⚠ 읽어 주는 이름은 남긴다 — 표가 이름 없이 서면 화면을 듣는 사용자에게는 무엇을
         *   담은 표인지 알 길이 없다.
         */
        aria-label={t.caption}
        empty={<p className="pop-empty-note">{isLoading ? t.loading : t.empty}</p>}
      />
    </div>
  );
};
