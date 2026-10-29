import { AlertBanner, Button, Dialog, TextField, type ButtonSize } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { NumericKeypad } from '@omf-mes/ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';

const keypad = messages.popChrome.workerNoDialog;

/** POP 터치 규격(작업 시작 `touch-spec` 의 `POP_TOUCH_SIZE` 와 같은 값). 공용 부품이 화면 폴더를 읽지 않게 여기 둔다. */
const POP_TOUCH_SIZE: ButtonSize = '2xl';

export interface WorkerNoDialogProps {
  open: boolean;
  title: string;
  /** 확인 버튼 이름(사번 확인은 「확인」, 부 작업자는 「추가」). */
  confirmLabel: string;
  cancelLabel: string;
  isChecking: boolean;
  /** 확인하지 못한 사유. 창 안에 보이고 창은 열린 채로 남는다. */
  error: string | null;
  /** 사유 옆 동작(조회 실패의 [다시 시도] 등). */
  errorAction?: ReactNode;
  onCancel: () => void;
  onSubmit: (workerNo: string) => void;
  /** 입력이 바뀌면 부른다. 부르는 쪽이 지난 사유를 지운다. */
  onDraftChange?: () => void;
}

const DIGITS_ONLY = /\D/gu;

/**
 * 사번 입력 창(C-12 가끔 쓰는 숫자 입력은 창). 작업 시작의 작업자 사번 확인과 부 작업자 추가, 자재
 * 투입의 사번 확인이 같은 창과 키패드를 쓴다(사용자 화면 확인 결정 2026-10-23). 화면마다 복제하지
 * 않는다(C-8, C-20).
 *
 * - 키패드로 누르거나, 칸에 바코드 스캐너나 키보드로 친다. 칸은 열리자마자 포커스를 받고 Enter로
 *   확인한다. `inputMode="none"`이라 터치 단말에서 운영체제 키보드가 화면을 덮지 않는다.
 * - 터치 단말의 오조작을 막으려고 바깥을 눌러 닫히지 않는다.
 */
export const WorkerNoDialog = ({
  open,
  title,
  confirmLabel,
  cancelLabel,
  isChecking,
  error,
  errorAction,
  onCancel,
  onSubmit,
  onDraftChange,
}: WorkerNoDialogProps) => {
  const [draft, setDraft] = useState('');
  const fieldRef = useRef<HTMLInputElement>(null);

  /*
   * 열 때마다 빈 칸에서 시작하고 칸에 포커스를 준다. 스캐너와 키보드 입력이 바로 칸으로 들어간다.
   * DS `Dialog`가 자식 효과에서 `showModal()`을 먼저 부르므로, 이 효과가 그 뒤에 포커스를 옮긴다.
   */
  useEffect(() => {
    if (!open) return;

    setDraft('');
    fieldRef.current?.focus();
  }, [open]);

  const change = (value: string) => {
    setDraft(value.replace(DIGITS_ONLY, ''));
    onDraftChange?.();
  };

  const canSubmit = draft.trim() !== '' && !isChecking;
  const submit = () => {
    if (canSubmit) onSubmit(draft.trim());
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      showCloseButton={false}
      closeOnBackdropClick={false}
      footer={
        <>
          <Button variant="outlined" size={POP_TOUCH_SIZE} onClick={onCancel}>
            {cancelLabel}
          </Button>
          {/* 잠그지 않는다. 빈 칸이나 확인 중에는 눌러도 아무 일이 없다(C-4, 사유 없는 잠금 금지). */}
          <Button size={POP_TOUCH_SIZE} onClick={submit}>
            {isChecking ? keypad.checking : confirmLabel}
          </Button>
        </>
      }
    >
      {/* 칸, 키패드, 사유 사이는 같은 간격 토큰 하나로 띄운다(C-19). */}
      <div className="worker-no-dialog">
        <TextField
          label={keypad.fieldLabel}
          value={draft}
          size="xl"
          ref={fieldRef}
          containerClassName="worker-no-dialog-field"
          inputMode="none"
          autoComplete="off"
          onChange={(event) => {
            change(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;

            event.preventDefault();
            submit();
          }}
        />
        <NumericKeypad
          value={draft}
          onChange={change}
          label={keypad.keypadLabel}
          backspaceLabel={keypad.backspace}
          clearLabel={keypad.clear}
          disabled={isChecking}
          keySize={POP_TOUCH_SIZE}
          /* 키 높이는 P-CO-01 사번 키패드와 같은 규칙(`.worker-no-keypad > button`, 72px)을 쓴다. */
          className="worker-no-keypad"
        />
        {error !== null && (
          <div className="banner-slot">
            <AlertBanner variant="error" action={errorAction}>
              {error}
            </AlertBanner>
          </div>
        )}
      </div>
    </Dialog>
  );
};
