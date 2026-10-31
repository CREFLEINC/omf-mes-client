import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { WorkerNoDialog } from '../../patterns/worker-no-dialog';

const t = messages.workStart.worker;

export interface WorkerPanelProps {
  /** 사번 입력 창이 열려 있는가. 화면이 W/O 를 고를 때도 열므로 화면이 갖는다. */
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** 사번을 받아 확인을 청한다. 확인되면 화면이 이 묶음 대신 작업자 묶음을 세우므로 창도 닫힌다. */
  onSubmit: (workerNo: string) => void;
  /** 입력을 고치거나 창을 닫으면 지난 확인 결과(사유)를 버린다. */
  onDiscard: () => void;
  /** 조회가 실패했을 때 다시 묻는 경로. 문구가 「다시 시도하세요」이므로 수단이 있어야 한다. */
  onRetry: () => void;
  isChecking: boolean;
  /** 확인 결과의 오류 문구. 없으면 `null` */
  error: string | null;
}

/**
 * 사번이 없을 때의 「작업자」 묶음. 사번을 받지 못하고 들어온 경우에만 선다.
 *
 * 구획 안에 키패드를 펼치지 않는다. 빈 상태 한 줄과 [사번 입력]을 두고, 누르면 부 작업자 추가와
 * 같은 사번 입력 창이 열린다(사용자 화면 확인 결정 2026-10-23). 확인되면 창이 닫히고 같은 자리에
 * 작업자가 선다.
 *
 * 비밀번호 칸이 없다. POP 은 로그인을 생략하고 사번만 받는다(REQ-PR-0023). 이 화면이 하는 것은
 * 인증이 아니라 귀속이다. 확인 전에는 목록을 고를 수 없다(§5-5).
 */
export const WorkerPanel = ({
  isOpen,
  onOpenChange,
  onSubmit,
  onDiscard,
  onRetry,
  isChecking,
  error,
}: WorkerPanelProps) => {
  return (
    /* 오른쪽 「작업 확인」 구획 안의 묶음이다. 제목은 사번 확인 뒤와 같은 「작업자」다. */
    <div className="work-start-group work-start-worker" role="group" aria-label={t.title}>
      <h3 className="work-start-group-title">{t.title}</h3>
      <p className="field-note">{t.empty}</p>
      <Button
        type="button"
        variant="outlined"
        size="lg"
        onClick={() => {
          onOpenChange(true);
        }}
      >
        {t.open}
      </Button>

      <WorkerNoDialog
        open={isOpen}
        title={t.dialogTitle}
        confirmLabel={t.confirm}
        cancelLabel={t.cancel}
        isChecking={isChecking}
        error={error}
        errorAction={
          /* 조회가 실패한 자리에만 준다. 미등록과 퇴사는 다시 물어도 답이 같다. */
          error === t.lookupFailed ? (
            <Button type="button" variant="outlined" size="sm" onClick={onRetry}>
              {t.retry}
            </Button>
          ) : undefined
        }
        onCancel={() => {
          onOpenChange(false);
          onDiscard();
        }}
        onDraftChange={onDiscard}
        onSubmit={onSubmit}
      />
    </div>
  );
};
