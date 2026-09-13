import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { ScanField } from './use-scan-field';

const t = messages.common.rescan;

export interface ScanReplaceDialogProps {
  field: ScanField;
  /** 번호를 읽기 좋게 끊어 보이는 화면이 있다. 그 자리는 같은 모양으로 넘긴다. */
  format?: (value: string) => string;
}

/**
 * 이미 정해진 대상이 있는데 다른 것을 읽었을 때 되묻는 창.
 *
 * 스캔 하나가 대상을 정하는 화면에만 세운다. 여러 건을 쌓는 화면에서는 재스캔이 정상
 * 동작이라 물어보면 걸리적거린다.
 */
export const ScanReplaceDialog = ({ field, format }: ScanReplaceDialogProps) => {
  const show = (value: string) => (format === undefined ? value : format(value));

  return (
    <Dialog
      open={field.pending !== null}
      onClose={field.dismissPending}
      title={t.title}
      closeOnBackdropClick={false}
      footer={
        <>
          <Button variant="outlined" size="xl" onClick={field.dismissPending}>
            {t.keep}
          </Button>
          <Button variant="filled" size="xl" onClick={field.acceptPending}>
            {t.replace}
          </Button>
        </>
      }
    >
      {t.body(show(field.applied ?? ''), show(field.pending ?? ''))}
    </Dialog>
  );
};
