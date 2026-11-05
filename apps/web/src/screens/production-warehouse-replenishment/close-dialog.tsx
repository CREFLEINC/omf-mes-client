import { AlertBanner, Button, Dialog, TextField } from '@crefle/web-ui';
import type { MaterialIssueCloseRemaining } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { SaveErrorBanner, type MasterWriteResult } from '../../patterns/master';
import { Select } from '../../patterns/select';
import { useCloseReasons } from './queries';
import { lineClosedQty, qtyWithUom, type ReplenishmentDetailView } from './types';

const t = messages.productionWarehouseReplenishment;
const tc = t.closeDialog;

export interface CloseDialogProps {
  open: boolean;
  detail: ReplenishmentDetailView;
  close: MasterWriteResult<MaterialIssueCloseRemaining>;
  onClose: () => void;
}

/** 잔량 마감 창(US3-1) — 사유 코드(공통코드) 필수, 메모 선택. 줄마다 닫을 남은 양을 보인다. */
export const CloseDialog = ({ open, detail, close, onClose }: CloseDialogProps) => {
  const [reason, setReason] = useState('');
  const [remark, setRemark] = useState('');
  const [tried, setTried] = useState(false);
  const reasons = useCloseReasons();
  const { request, lines } = detail;
  /* 마감하면 줄의 미출고분이 닫힌다 — 미리 보이는 양은 지금 상태를 마감했다고 보고 센다. */
  const preview = { ...request, status: 'CLOSED' as const };

  const submit = (): void => {
    setTried(true);
    if (reason === '') return;
    close.write({
      versionNo: request.versionNo,
      reasonCode: reason,
      ...(remark.trim() === '' ? {} : { remark: remark.trim() }),
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={tc.title}
      size="sm"
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {tc.cancel}
          </Button>
          <Button loading={close.isSaving} onClick={submit}>
            {tc.submit}
          </Button>
        </>
      }
    >
      <ul className="replenishment-result-list">
        {lines
          .filter((line) => lineClosedQty(preview, line) > 0)
          .map((line) => (
            <li key={line.id}>
              {tc.line(
                `${line.itemCode} ${line.itemName}`,
                qtyWithUom(line.requested, line.uomCode),
                qtyWithUom(line.issued, line.uomCode),
                qtyWithUom(lineClosedQty(preview, line), line.uomCode),
              )}
            </li>
          ))}
      </ul>
      <p className="dialog-text">{tc.body}</p>
      {close.error !== null && <SaveErrorBanner error={close.error} />}
      <Select
        aria-label={tc.reason}
        placeholder={tc.reasonPlaceholder}
        value={reason === '' ? null : reason}
        invalid={tried && reason === ''}
        options={reasons.data?.options ?? []}
        onChange={(value) => {
          close.reset();
          setReason(value);
        }}
      />
      {tried && reason === '' && <AlertBanner variant="error">{tc.reasonRequired}</AlertBanner>}
      <TextField
        label={tc.remark}
        value={remark}
        maxLength={500}
        onChange={(event) => setRemark(event.target.value)}
      />
    </Dialog>
  );
};
