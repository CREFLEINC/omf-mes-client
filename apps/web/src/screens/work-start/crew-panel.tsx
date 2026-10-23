import { AlertBanner, Button, Chip, IconButton } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { WorkerNoDialog } from './worker-no-dialog';

const t = messages.workStart.coWorkers;

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
 * 사번은 공용 사번 입력 창(`worker-no-dialog`)으로 받는다. 작업자 사번 확인과 같은 창이다.
 */
export const CrewPanel = ({ members, disabled, error, onAdd, onRemove }: CrewPanelProps) => {
  const [isAdding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [isChecking, setChecking] = useState(false);
  const isFull = members.length >= CREW_MAX;

  const close = () => {
    setAdding(false);
    setAddError(null);
  };

  const submit = async (workerNo: string) => {
    setChecking(true);
    const reason = await onAdd(workerNo);
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

      <WorkerNoDialog
        open={isAdding}
        title={t.dialogTitle}
        confirmLabel={t.confirm}
        cancelLabel={t.cancel}
        isChecking={isChecking}
        error={addError}
        onCancel={close}
        onDraftChange={() => {
          setAddError(null);
        }}
        onSubmit={(workerNo) => {
          void submit(workerNo);
        }}
      />
    </div>
  );
};
