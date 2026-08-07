import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.itemExtendedAttrs.bom;

export interface SetDefaultDialogProps {
  /** 기본으로 지정할 자재 명세서의 이름(「코드 · Rev N」). 제목에 담아 대상을 못 박는다 */
  bomName: string;
  isSaving: boolean;
  /** 저장 실패 배너 슬롯. 창을 닫지 않고 이유를 보여야 다시 시도할 수 있다 */
  banner: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * 기본 자재 명세서 지정 확인(결정 9).
 *
 * **확인 창을 두는 이유는 「사용자가 고르지 않은 다른 줄이 함께 바뀌기」 때문이다.**
 * 서버가 한 트랜잭션으로 지정과 해제를 처리하는데(공유계약 A-6) 응답은 **지정한 줄만**
 * 돌려준다 — 무엇이 기본에서 내려갔는지 화면이 알 수 없다. 그 사실을 본문이 먼저 밝힌다.
 *
 * **화면이 해제를 따로 부르지 않는다.** 두 번 부르면 그 사이에 기본이 하나도 없는 순간이
 * 생긴다(이슈 #14 §6) — 이 창의 확인은 `:set-default` 한 번으로 끝난다.
 *
 * **스크림 클릭으로 닫히는 것을 막지 않는다.** 실수로 닫혀도 아무 일이 일어나지 않고,
 * 되돌리는 경로(다른 줄을 다시 지정)도 있다 — 사용 중지 확인 창과 다른 자리다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이므로 이 화면 슬라이스가 소유한다.
 */
export const SetDefaultDialog = ({
  bomName,
  isSaving,
  banner,
  onClose,
  onConfirm,
}: SetDefaultDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="sm"
    title={`${t.dialog.setDefaultTitle} — ${bomName}`}
    footer={
      <>
        <Button variant="outlined" onClick={onClose}>
          {messages.common.cancel}
        </Button>
        <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
          {t.dialog.setDefaultConfirm}
        </Button>
      </>
    }
  >
    {banner}
    <p>{t.dialog.setDefaultDescription}</p>
  </Dialog>
);
