import { Dialog } from '@crefle/web-ui';
import type { ReactNode } from 'react';

import { Button } from './button';
import './confirm-dialog.css';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** 무엇이 일어나는지 한두 줄. */
  children: ReactNode;
  cancelLabel: string;
  proceedLabel: string;
  /** 돌아가기 · 바깥 누르기 · 뒤로가기가 모두 여기로 온다. */
  onCancel: () => void;
  onProceed: () => void;
}

/**
 * 누르기 전에 한 번 묻는 창 - 화면 가운데 뜨는 작은 창이다(사용자 지시 2026-10-27).
 *
 * 디자인 시스템은 좁은 화면(768px 이하)에서 대화상자를 전체 화면으로 편다. 확인 하나 받자고
 * 화면을 통째로 가리면 무엇을 하던 중인지 보이지 않는다 - 뒤 화면이 어둡게 비치는 가운데 창으로
 * 띄운다. 돌아가기는 아무것도 바꾸지 않으므로 바깥을 눌러도 닫힌다.
 */
export const ConfirmDialog = ({
  open,
  title,
  children,
  cancelLabel,
  proceedLabel,
  onCancel,
  onProceed,
}: ConfirmDialogProps) => (
  <Dialog
    open={open}
    onClose={onCancel}
    title={title}
    size="sm"
    className="confirm-dialog"
    /* 단추가 둘 다 바닥에 있다 - 머리의 닫기는 「돌아가기」와 같은 일이라 두지 않는다. */
    showCloseButton={false}
    footer={
      <>
        {/* 핵심 액션 규격(72px). 두 단추가 나란히 서므로 높이를 맞춘다. */}
        <Button variant="outlined" size="2xl" className="confirm-dialog__action" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant="filled" size="2xl" className="confirm-dialog__action" onClick={onProceed}>
          {proceedLabel}
        </Button>
      </>
    }
  >
    {children}
  </Dialog>
);
