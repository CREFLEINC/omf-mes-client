import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import {
  PuButton,
  PuChip,
  PuCount,
  PuNote,
  PuRemoveButton,
} from '../../patterns/pop-uniform';
import { WorkerNoDialog } from '../../patterns/worker-no-dialog';

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
 * 오른쪽 「작업 확인」 구획 안의 묶음이다.
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
    <div className="ws-group" role="group" aria-label={t.title}>
      <h3 className="ws-group-title">
        {t.title} <PuCount>{t.count(members.length, CREW_MAX)}</PuCount>
      </h3>

      <ul className="ws-crew">
        {members.map((member) => (
          <li key={member.key} className="ws-member">
            <PuChip tone={member.role === 'MAIN' ? 'info' : 'idle'}>
              {member.role === 'MAIN' ? t.main : t.sub}
            </PuChip>
            <span className="ws-member-name">{nameOf(member)}</span>
            {member.role === 'SUB' && (
              <PuRemoveButton
                label={t.remove(nameOf(member))}
                disabled={disabled}
                onClick={() => {
                  onRemove(member);
                }}
              />
            )}
          </li>
        ))}
        <li>
          <PuButton
            disabled={disabled || isFull}
            onClick={() => {
              setAdding(true);
            }}
          >
            {t.add}
          </PuButton>
        </li>
      </ul>

      {error !== null && <PuNote tone="bad">{error}</PuNote>}

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
