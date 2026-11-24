import {
  AlertBanner,
  Button,
  Chip,
  type ChipStatus,
  type Column,
  Dialog,
  EmptyState,
  Table,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { useFitColumns } from '../../patterns/column-fit';
import { PageNav } from '../../patterns/page-nav';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { PAGE_SIZE, useInspectionLevelHistories } from './queries';

type ItemInspectionLevelHistory = components['schemas']['ItemInspectionLevelHistory'];

const t = messages.inspectionLevel;

export const levelName = (code: string | null): string =>
  code === null ? '' : (t.levels[code] ?? code);

/** 검사 수준을 글자 + 색으로 가른다(#208) — 무검사는 흐리게, 수월은 초록, 보통은 파랑, 엄격은 주의색. */
const LEVEL_TONE: Record<string, ChipStatus> = {
  NONE: 'idle',
  REDUCED: 'success',
  NORMAL: 'info',
  TIGHTENED: 'warning',
};

export const LevelChip = ({ code }: { code: string | null }) =>
  code === null ? null : (
    <Chip variant="status" size="sm" status={LEVEL_TONE[code] ?? 'idle'}>
      {levelName(code)}
    </Chip>
  );

/** 이력의 사유 칸 — 자동은 연속 합격 수나 불합격 의뢰, 수동은 입력한 사유. */
export const historyReason = (row: ItemInspectionLevelHistory): string => {
  if (row.changeTypeCode === 'AUTO') {
    if (row.consecutiveAcceptCount !== null)
      return t.history.acceptStreak(row.consecutiveAcceptCount);
    return t.history.rejected(row.inspectionRequestNo ?? '');
  }
  return row.reason ?? '—';
};

/*
 * 품목 이력 창의 열 — 사용자 시안(#208): 변경 일시 · 검사 수준(새 수준 칩 + 아래 「최초 지정」/「이전 수준에서 변경」) ·
 * 변경 방식 · 변경 사유 · 처리자. 품목은 창 머리가 말하므로 열에서 뺀다. 왼쪽 정렬.
 */
const columns: Column<ItemInspectionLevelHistory>[] = [
  {
    key: 'changedAt',
    header: t.history.itemColumns.changedAt,
    width: '150px',
    render: (row) => formatPlantDateTime(row.changedAt) ?? '',
  },
  {
    key: 'level',
    header: t.history.itemColumns.level,
    width: '130px',
    render: (row) => (
      <span className="inspection-level-history-level">
        <LevelChip code={row.toLevelCode} />
        <span className="inspection-sheet-template-muted">
          {row.fromLevelCode === null
            ? t.history.firstSetNote
            : t.history.changedFrom(levelName(row.fromLevelCode))}
        </span>
      </span>
    ),
  },
  {
    key: 'type',
    header: t.history.itemColumns.type,
    width: '90px',
    render: (row) => t.history.types[row.changeTypeCode] ?? row.changeTypeCode,
  },
  {
    key: 'reason',
    header: t.history.itemColumns.reason,
    width: '150px',
    render: (row) => {
      const reason = historyReason(row);
      return <span title={reason}>{reason}</span>;
    },
  },
  {
    key: 'changedBy',
    header: t.history.itemColumns.changedBy,
    width: '120px',
    render: (row) => row.changedByName ?? '',
  },
];

export interface ItemHistoryDialogProps {
  item: { itemId: number; itemCode: string; itemName: string };
  onClose: () => void;
}

/**
 * 품목 하나의 검사 수준 전환 이력 창(사용자 지시 · #208). 검사 기준 상세의 「이력」이 연다(omf-all-around#357).
 */
export const ItemHistoryDialog = ({ item, onClose }: ItemHistoryDialogProps) => {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<number>(PAGE_SIZE);
  const histories = useInspectionLevelHistories(item.itemId, page, size);
  /* 창 폭에 맞춰 열을 비율대로 줄이고 늘린다 — 마지막 열(처리자)이 잘리지 않게(#208). */
  const fit = useFitColumns(columns);

  return (
    <Dialog
      open
      size="lg"
      closeOnBackdropClick={false}
      showCloseButton={false}
      title={t.history.itemTitle}
      onClose={onClose}
      footer={
        <Button variant="outlined" onClick={onClose}>
          {messages.common.close}
        </Button>
      }
    >
      <div className="inspection-level-history-dialog">
        {/* 품목 머리 — 품목명(크게) · 아래 「품목코드 …」(흐리게) · 사용자 시안(#208). */}
        <div className="inspection-level-history-item">
          <p className="inspection-level-history-item-name">{item.itemName}</p>
          <p className="inspection-sheet-template-muted">{t.history.itemCode(item.itemCode)}</p>
        </div>
        {histories.isError && <AlertBanner variant="error">{t.history.loadFailed}</AlertBanner>}
        <div
          ref={fit.ref}
          className="inspection-queue-table inspection-standard-table-box inspection-level-rows"
        >
          <Table
            caption={
              <span className="inspection-standard-visually-hidden">{t.history.caption}</span>
            }
            density="compact"
            columns={fit.columns}
            rows={histories.data?.items ?? []}
            getRowId={(row) => String(row.itemInspectionLevelHistoryId)}
            empty={
              <EmptyState
                size="sm"
                live
                title={histories.isPending ? t.history.loading : t.history.empty}
              />
            }
          />
        </div>
        {histories.data !== undefined && (
          <PageNav
            meta={histories.data.page}
            buttonSize="md"
            onChangePage={setPage}
            onChangeSize={(next) => {
              setSize(next);
              setPage(1);
            }}
          />
        )}
      </div>
    </Dialog>
  );
};
