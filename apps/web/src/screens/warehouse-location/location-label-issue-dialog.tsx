import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { SelectField } from './warehouse-form-pane';

export interface LocationLabelIssueDialogProps {
  /** 여럿을 한꺼번에 낼 때 이미 발행한 건수 — 한 줄로 알린다. 하나만 다시 낼 때는 없다. */
  alreadyIssuedCount?: number;
  reasonCode: string;
  reasonOptions: { value: string; label: string }[];
  reasonError?: string;
  isSaving: boolean;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  banner: ReactNode;
}

/** 이미 발행한 라벨을 다시 발행할 때 회차를 올릴 사유를 받는다. */
export const LocationLabelIssueDialog = ({
  alreadyIssuedCount,
  reasonCode,
  reasonOptions,
  reasonError,
  isSaving,
  onReasonChange,
  onConfirm,
  onClose,
  banner,
}: LocationLabelIssueDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="sm"
    title={messages.warehouseLocation.labelIssue.title}
    footer={
      <>
        <Button variant="outlined" onClick={onClose}>
          {messages.common.cancel}
        </Button>
        <Button disabled={reasonCode === '' || isSaving} loading={isSaving} onClick={onConfirm}>
          {messages.warehouseLocation.labelIssue.confirm}
        </Button>
      </>
    }
  >
    {banner}
    {alreadyIssuedCount !== undefined && (
      <p className="dialog-lead">
        {messages.warehouseLocation.labelIssue.alreadyIssued(alreadyIssuedCount)}
      </p>
    )}
    <div className="form-grid warehouse-location-label-reissue-form">
      <SelectField
        label={messages.warehouseLocation.labelIssue.reason}
        required
        options={reasonOptions}
        value={reasonCode}
        onChange={onReasonChange}
        error={reasonError}
      />
    </div>
  </Dialog>
);
