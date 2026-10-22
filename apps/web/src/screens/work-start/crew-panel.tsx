import { AlertBanner, Button, Chip, Dialog, IconButton, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { NumericKeypad } from '@omf-mes/ui';
import { useState } from 'react';

import { POP_TOUCH_SIZE } from './touch-spec';

const t = messages.workStart.coWorkers;
const keypad = messages.workStart.worker;

/** 한 세션에 동시에 들어갈 수 있는 사람 수(정 포함). 서버도 같은 수로 막는다. */
export const CREW_MAX = 4;

export interface CrewMember {
  key: string;
  workerId: number;
  workerNo: string | null;
  workerName: string | null;
  role: 'MAIN' | 'SUB';
  /** 열린 세션의 참여 행. 시작 전에 모으는 중이면 `null` */
  workSessionWorkerId: number | null;
}

export interface CrewPanelProps {
  members: CrewMember[];
  /** 오프라인·쓰는 중 — 넣고 빼기를 잠근다. */
  disabled: boolean;
  /** 넣기·빼기가 실패한 사유. 없으면 `null` */
  error: string | null;
  /** 사번을 받아 넣는다. 못 넣으면 사유를 돌려준다 — 창이 그 사유를 보이고 열린 채로 남는다. */
  onAdd: (workerNo: string) => Promise<string | null>;
  onRemove: (member: CrewMember) => void;
}

const nameOf = (member: CrewMember): string =>
  member.workerName !== null && member.workerNo !== null
    ? t.name(member.workerName, member.workerNo)
    : (member.workerName ?? member.workerNo ?? t.unknown);

/**
 * 함께 일하는 작업자. 사번을 확인한 사람이 정(맨 앞, 뺄 수 없음)이고 나머지는 부다.
 *
 * 오른쪽 「작업 확인」 구획 안의 묶음이다. 구획 상자 안에 상자를 겹치지 않는다(C-19).
 *
 * ⚠ 사번은 키패드로만 받는다 — 키오스크라 운영체제 키보드가 뜨면 화면을 덮는다.
 */
export const CrewPanel = ({ members, disabled, error, onAdd, onRemove }: CrewPanelProps) => {
  const [isAdding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isChecking, setChecking] = useState(false);
  const isFull = members.length >= CREW_MAX;

  const close = () => {
    setAdding(false);
    setDraft('');
    setAddError(null);
  };

  const submit = async () => {
    setChecking(true);
    const reason = await onAdd(draft.trim());
    setChecking(false);

    if (reason === null) close();
    else setAddError(reason);
  };

  return (
    <div className="work-start-group work-start-crew" role="group" aria-label={t.title}>
      <div className="work-start-crew-head">
        <h3 className="work-start-group-title">{t.title}</h3>
        <span className="field-note">{t.count(members.length, CREW_MAX)}</span>
      </div>

      <ul className="work-start-crew-list">
        {members.map((member) => (
          <li key={member.key} className="work-start-crew-member">
            <Chip status={member.role === 'MAIN' ? 'info' : 'idle'} size="md">
              {member.role === 'MAIN' ? t.main : t.sub}
            </Chip>
            <span>{nameOf(member)}</span>
            {member.role === 'SUB' && (
              <IconButton
                icon="close"
                size="md"
                aria-label={t.remove(nameOf(member))}
                disabled={disabled}
                onClick={() => {
                  onRemove(member);
                }}
              />
            )}
          </li>
        ))}
        <li>
          <Button
            type="button"
            variant="outlined"
            size="lg"
            disabled={disabled || isFull}
            onClick={() => {
              setAdding(true);
            }}
          >
            {t.add}
          </Button>
        </li>
      </ul>

      {error !== null && (
        <div className="banner-slot">
          <AlertBanner variant="error">{error}</AlertBanner>
        </div>
      )}

      <Dialog
        open={isAdding}
        onClose={close}
        title={t.dialogTitle}
        showCloseButton={false}
        /* 터치 단말의 오조작 — 바깥을 눌러 닫히지 않는다. */
        closeOnBackdropClick={false}
        footer={
          <>
            <Button variant="outlined" size={POP_TOUCH_SIZE} onClick={close}>
              {t.cancel}
            </Button>
            <Button
              size={POP_TOUCH_SIZE}
              disabled={draft.trim() === '' || isChecking}
              onClick={() => {
                void submit();
              }}
            >
              {isChecking ? keypad.checking : t.confirm}
            </Button>
          </>
        }
      >
        <TextField
          label={keypad.fieldLabel}
          value={draft}
          size="xl"
          readOnly
          onChange={() => undefined}
        />
        <NumericKeypad
          value={draft}
          onChange={(value) => {
            setDraft(value);
            setAddError(null);
          }}
          label={keypad.keypadLabel}
          backspaceLabel={keypad.backspace}
          clearLabel={keypad.clear}
          disabled={isChecking}
          keySize={POP_TOUCH_SIZE}
        />
        {addError !== null && (
          <div className="banner-slot">
            <AlertBanner variant="error">{addError}</AlertBanner>
          </div>
        )}
      </Dialog>
    </div>
  );
};
