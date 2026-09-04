import { AlertBanner, Button, type Column, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Link } from 'react-router';

import { lookupDisplayLabel, type LookupSource } from '../../patterns/lookup-display';
import { DISPOSITION_REQUEST_SCREEN_PATH } from '../disposition-request/filters';
import type { ActiveLine } from './line-draft';
import { formatQty, type WarehouseView } from './types';

const t = messages.returnReceipt;

export interface Outcome {
  receiptNo: string;
  lines: ActiveLine[];
  warehouse: WarehouseView;
}

export interface OutcomePaneProps {
  outcome: Outcome;
  uoms: LookupSource;
  onAnother: () => void;
}

/**
 * 판정 의뢰 화면(W-04-07)의 진입 주소 — LOT 하나면 그 LOT 을, 여럿이면 창고를 겨눈다.
 * 주소 키는 그 화면의 `filters.ts` 가 정한다(`lot` · `wh`).
 */
export const dispositionRequestHref = (outcome: Outcome): string => {
  const params = new URLSearchParams();
  const first = outcome.lines[0];
  if (outcome.lines.length === 1 && first !== undefined) {
    params.set('lot', String(first.source.lotId));
  } else {
    params.set('wh', String(outcome.warehouse.warehouseId));
  }

  return `${DISPOSITION_REQUEST_SCREEN_PATH}?${params.toString()}`;
};

/** 등록 뒤 — 무엇이 들어갔고 다음이 어디인지. 이 화면은 여기서 끝난다(§5-7 판정 의뢰 = 화면 이동). */
export const OutcomePane = ({ outcome, uoms, onAnother }: OutcomePaneProps) => {
  const columns: Column<ActiveLine>[] = [
    { key: 'item', header: t.fields.item, render: (row) => row.source.itemCode ?? '' },
    { key: 'lot', header: t.fields.lotNo, render: (row) => row.source.lotNo },
    {
      key: 'qty',
      header: t.fields.returnQty,
      align: 'end',
      render: (row) => `${formatQty(row.qty)} ${lookupDisplayLabel(uoms, row.source.uomId)}`.trim(),
    },
  ];

  return (
    <div className="return-receipt-outcome" role="group" aria-label={t.panes.outcome}>
      <div className="banner-slot">
        <AlertBanner variant="success" title={t.outcome.title}>
          {`${t.outcome.receiptNo} ${outcome.receiptNo} · ${t.outcome.lines(outcome.lines.length)} · ${outcome.warehouse.warehouseName}`}
        </AlertBanner>
      </div>
      <Table
        density="compact"
        caption={<span className="return-receipt-table-caption">{t.panes.lines}</span>}
        columns={columns}
        rows={outcome.lines}
        getRowId={(row) => row.source.key}
      />
      <p className="field-note">{t.outcome.next}</p>
      <div className="form-actions">
        <Button variant="outlined" onClick={onAnother}>
          {t.actions.registerAnother}
        </Button>
        <Link to={dispositionRequestHref(outcome)}>{t.actions.openDisposition}</Link>
      </div>
    </div>
  );
};
