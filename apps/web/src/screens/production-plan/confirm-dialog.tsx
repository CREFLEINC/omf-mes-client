import { Button, Dialog } from '@crefle/web-ui';
import type { ReactNode } from 'react';

interface ProductionPlanConfirmDialogProps {
  planNo: string;
  banner: ReactNode;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ProductionPlanConfirmDialog = ({
  planNo,
  banner,
  isSubmitting,
  onClose,
  onConfirm,
}: ProductionPlanConfirmDialogProps) => (
  <Dialog
    open
    size="sm"
    title={`${planNo} 전개 확정`}
    closeOnBackdropClick={false}
    showCloseButton={false}
    onClose={() => {
      if (!isSubmitting) onClose();
    }}
    footer={
      <>
        <Button variant="outlined" disabled={isSubmitting} onClick={onClose}>
          취소
        </Button>
        <Button loading={isSubmitting} disabled={isSubmitting} onClick={onConfirm}>
          전개 확정
        </Button>
      </>
    }
  >
    {banner}
    <p>계획을 확정하면 Routing 공정별 W/O와 공정 의존 관계를 함께 생성합니다.</p>
    <p>서버가 한 트랜잭션으로 처리하며, 확정된 계획은 수정하거나 삭제할 수 없습니다.</p>
  </Dialog>
);
