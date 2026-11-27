import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { WarehouseFormPane, type WarehouseFormPaneProps } from './warehouse-form-pane';

const t = messages.warehouseLocation;

export type WarehouseEditDialogProps = WarehouseFormPaneProps & {
  open: boolean;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  /** 닫기 · 취소 — 저장하지 않은 값은 버린다. */
  onClose: () => void;
};

/**
 * 창고 정보 수정 창(안 B, 사용자 결정 2026-11-24) — 본문은 창고 정보 판, 바닥은 취소 · 저장만. 사용 중지 · 다시 사용은
 * 본문 맨 아래 「사용 상태」 줄에 둔다(사용자 지시 2026-11-24) — 창고 머리에는 두지 않는다.
 */
export const WarehouseEditDialog = ({
  open,
  onClose,
  isDirty,
  isSaving,
  onSave,
  ...paneProps
}: WarehouseEditDialogProps) => (
  <Dialog
    className="location-dialog dialog-icon-edit"
    open={open}
    onClose={onClose}
    size="lg"
    title={t.warehouseInfo.editTitle}
    footer={
      <>
        <Button variant="outlined" onClick={onClose}>
          {messages.common.cancel}
        </Button>
        <Button disabled={!isDirty || isSaving} loading={isSaving} onClick={onSave}>
          {messages.common.save}
        </Button>
      </>
    }
  >
    <WarehouseFormPane {...paneProps} />
  </Dialog>
);
