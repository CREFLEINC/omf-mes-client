import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { TransitionPreview } from './transition-preview';
import { TransitionWarningBody } from './transition-warning';

/**
 * 판정 저장 확인 창 — ⭐ **쓰기는 이 창의 버튼에서만 나간다.**
 *
 * 이 화면의 저장은 한 번이고 되돌릴 수 없다(LOT 상태가 전이하고 보류 해제가 기록된다). 그래서
 * 폼의 버튼은 창을 열 뿐이고, 실제 요청은 여기서 나간다.
 *
 * - `closeOnBackdropClick={false}` · `showCloseButton={false}` — 바깥을 잘못 눌러 닫히면
 *   사용자가 「눌렀는데 아무 일도 없었다」로 읽고 다시 누른다
 * - **저장 중에는 닫히지 않는다** — 나가 있는 쓰기를 화면만 없던 일로 치면 안 된다
 * - 실패해도 **창을 닫지 않는다** — 같은 창에서 다시 누르면 같은 멱등 키가 나가므로 서버가
 *   두 번째 쓰기로 보지 않는다. 닫았다 다시 열면 그 보장이 사라진다
 *
 * 구조 원형은 `shipment-processing/submit-confirm-dialog.tsx` 다(패턴만 옮겼다).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.oqcInspection.confirm;

export interface ConfirmDialogProps {
  inspectionRequestNo: string;
  /** 고른 판정의 표시명. 목록에 없으면 코드 그대로다 */
  judgmentLabel: string;
  /** 전이 경고 본문에 실을 값. `null` 이면 경고 문장을 빼고 나머지만 낸다 */
  preview: TransitionPreview | null;
  /** 저장 실패 배너 — 창 안에 낸다. 밖에 내면 창에 가려 보이지 않는다 */
  banner: ReactNode;
  isSaving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ConfirmDialog = ({
  inspectionRequestNo,
  judgmentLabel,
  preview,
  banner,
  isSaving,
  onClose,
  onConfirm,
}: ConfirmDialogProps) => (
  <Dialog
    open
    closeOnBackdropClick={false}
    showCloseButton={false}
    title={t.title(inspectionRequestNo)}
    footer={
      <>
        <Button disabled={isSaving} variant="outlined" onClick={onClose}>
          {t.cancel}
        </Button>
        <Button loading={isSaving} variant="filled" onClick={onConfirm}>
          {t.confirm}
        </Button>
      </>
    }
    onClose={() => {
      if (!isSaving) onClose();
    }}
  >
    {banner}
    <p>{t.judgment(judgmentLabel)}</p>
    {/*
     * 전이 경고 본문을 그대로 다시 낸다 — 무엇이 일어나는지가 누르는 자리에 있어야 한다.
     *
     * ⛔ **수량 셋을 따로 한 줄 더 내지 않는다.** 경고 본문의 첫 규칙이 이미 그 세 값이라,
     * 따로 내면 같은 문장이 두 줄 연달아 서고 사용자는 둘이 다른 값인지 확인하려 다시 읽는다.
     */}
    <TransitionWarningBody preview={preview} />
    <p>{t.irreversible}</p>
  </Dialog>
);
