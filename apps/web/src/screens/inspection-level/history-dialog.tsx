import { AlertBanner, Button, type Column, Dialog, EmptyState, Table } from '@crefle/web-ui';
import type { ItemInspectionLevel, ItemInspectionLevelHistory } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { useFitColumns } from '../../patterns/column-fit';
import { PageNav } from '../../patterns/page-nav';
import { PAGE_SIZE, useInspectionLevelHistories } from './queries';

const t = messages.inspectionLevel;

export interface ItemHistoryDialogProps {
  item: ItemInspectionLevel;
  /** 아래 「전환 이력」 표와 같은 열 — 품목 열은 뺀다(창 제목이 품목을 말한다). */
  columns: Column<ItemInspectionLevelHistory>[];
  onClose: () => void;
}

/**
 * 줄의 「이력」 — 그 품목의 전환 이력만 창으로 본다(사용자 지시 · #208).
 * 아래 「전환 이력」 카드는 늘 전체 이력을 보인다.
 */
export const ItemHistoryDialog = ({ item, columns, onClose }: ItemHistoryDialogProps) => {
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
      title={t.history.itemTitle(item.itemCode, item.itemName)}
      onClose={onClose}
      footer={
        <Button variant="outlined" onClick={onClose}>
          {messages.common.close}
        </Button>
      }
    >
      <div className="inspection-level-history-dialog">
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
