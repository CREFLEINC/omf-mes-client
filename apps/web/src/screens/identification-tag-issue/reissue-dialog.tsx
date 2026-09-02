import { Button, Dialog, Select } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.identificationTagIssue;

export interface ReissueDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 재인쇄 — **사유 선택이 열리기 전까지 진행할 수 없다.**
 *
 * ⚠ **사유 값 목록이 아직 확정되지 않았다**(착수 이슈 미결표 · `omf-mes#145`). 처리 방법이
 * 「비활성 + 사유 표시」로 지정돼 있어 그대로 따른다 — 선택지를 지어내면 확정되지 않은 값이
 * 발행 기록에 남고, 그 기록은 되돌릴 수 없다.
 *
 * ⛔ **사유 없이 보내지 않는다.** 회차가 2 이상인 발행은 사유가 필수이고, 없으면 서버가 422 로
 * 거부한다 — 눌리는데 반드시 실패하는 버튼을 두지 않는다.
 *
 * ⚠ **값 목록이 도착하면 이 파일과 문구 두 곳만 바뀐다** — 목록 조회를 붙이고 `disabled` 를
 * 걷어낸다. 호출부(화면)는 그대로다.
 */
export const ReissueDialog = ({ open, onClose }: ReissueDialogProps) => (
  <Dialog
    open={open}
    onClose={onClose}
    title={t.reissueDialog.title}
    footer={
      <>
        <Button variant="outlined" size="xl" onClick={onClose}>
          {t.reissueDialog.cancel}
        </Button>
        <Button size="xl" disabled>
          {t.reissueDialog.confirm}
        </Button>
      </>
    }
  >
    <p>{t.reissueDialog.description}</p>
    <Select
      options={[]}
      size="xl"
      disabled
      placeholder={t.reissueDialog.reasonLabel}
      aria-label={t.reissueDialog.reasonLabel}
    />
    <p className="field-note">{t.reissueDialog.reasonPending}</p>
  </Dialog>
);
