import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useWorkerLookup } from '../screens/work-start/queries';
import { assignedAtText } from '../screens/work-start/terminal-clock';
import { verifyWorker } from '../screens/work-start/worker-verify';
import { WorkerNoDialog } from './worker-no-dialog';
import { setWorkerSession } from './worker-session';

const t = messages.popChrome.workerNoDialog;

export interface PopWorkerEntry {
  /** 귀속 사번이 없다. 화면은 입력을 받지 않는다. */
  isMissing: boolean;
  /** 사번 입력 창을 연다(잠긴 칸이나 줄을 눌렀을 때, [사번 입력]). */
  open: () => void;
  /** 화면 맨 끝에 놓는 사번 입력 창. */
  dialog: ReactNode;
}

/**
 * 작업형 화면에 사번 없이 들어왔을 때의 사번 입력(PI-17). 들어오자마자 공용 사번 입력 창을 열고, 확인되면
 * 단말의 현재 작업자(`worker-session`)로 정한 뒤 창을 닫아 같은 W/O에서 이어 간다. 확인은 작업 시작과 같은
 * 판정(`verifyWorker`, 미등록과 퇴사 구분)이고 단말 공장 비교는 하지 않는다(서버가 집행한다).
 *
 * 자재 투입(P-02-03)과 생산 작업(P-02-04)이 쓴다(C-20).
 */
export const usePopWorkerEntry = (
  workerNo: string | null,
  /** 사번이 확인되어 창을 닫은 뒤 부른다(스캔 칸 포커스 되찾기 등). */
  onVerified?: () => void,
): PopWorkerEntry => {
  const isMissing = workerNo === null;
  const [isOpen, setOpen] = useState(isMissing);
  const [submittedWorkerNo, setSubmittedWorkerNo] = useState<string | null>(null);
  const lookup = useWorkerLookup(submittedWorkerNo);
  const verified = useMemo(
    () =>
      submittedWorkerNo !== null && lookup.data !== undefined
        ? verifyWorker(lookup.data, submittedWorkerNo, null)
        : null,
    [lookup.data, submittedWorkerNo],
  );
  const error = ((): string | null => {
    if (submittedWorkerNo === null) return null;
    if (lookup.isError) return t.lookupFailed;
    if (verified?.kind === 'unknown') return t.unknown;
    if (verified?.kind === 'inactive') return t.inactive;

    return null;
  })();
  const onVerifiedRef = useRef(onVerified);
  onVerifiedRef.current = onVerified;

  /* 확인된 사번을 단말의 현재 작업자로 정하고 창을 닫는다. 렌더 중에 화면 밖 저장소를 쓰지 않는다. */
  useEffect(() => {
    if (verified?.kind !== 'ok') return;

    setWorkerSession({
      worker: verified.worker,
      assignedAt: assignedAtText(new Date()),
      isOtherPlant: verified.isOtherPlant,
    });
    setSubmittedWorkerNo(null);
    setOpen(false);
    onVerifiedRef.current?.();
  }, [verified]);

  const open = (): void => {
    setSubmittedWorkerNo(null);
    setOpen(true);
  };

  const dialog = (
    <WorkerNoDialog
      open={isOpen && isMissing}
      title={t.title}
      confirmLabel={t.confirm}
      cancelLabel={t.cancel}
      isChecking={submittedWorkerNo !== null && lookup.isFetching}
      error={error}
      errorAction={
        lookup.isError ? (
          <Button
            type="button"
            variant="outlined"
            size="sm"
            onClick={() => {
              void lookup.refetch();
            }}
          >
            {t.retry}
          </Button>
        ) : undefined
      }
      onCancel={() => {
        setSubmittedWorkerNo(null);
        setOpen(false);
      }}
      onSubmit={setSubmittedWorkerNo}
      onDraftChange={() => {
        setSubmittedWorkerNo(null);
      }}
    />
  );

  return { isMissing, open, dialog };
};
