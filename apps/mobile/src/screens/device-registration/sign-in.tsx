import { AlertBanner, Button, Card, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { NumericKeypad } from '@omf-mes/ui';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import { loadWorkerDirectory, type WorkerEntry } from './directory';
import { verifyWorkerNo, type SignInResult } from './verify';
import './sign-in.css';

const t = messages.deviceRegistration.signIn;

/*
 * 계약 Worker.workerNo 의 상한이다. 화면이 더 좁히지 않는다 - 계약이 형식을 강제하지 않기로
 * 한 이유가 「표본 밖의 사번을 가진 사람이 단말을 아예 못 쓰는 것」을 막으려는 것이라, 화면이
 * 좁히면 그 결정을 화면에서 되돌리는 셈이 된다.
 */
const MAX_WORKER_NO_LENGTH = 50;

export const WorkerSignInScreen = () => {
  useScreenTitle(t.title);
  const navigate = useNavigate();
  const { worker, signIn, signOut } = useWorkerSession();

  const [entry, setEntry] = useState('');
  const [directory, setDirectory] = useState<WorkerEntry[] | null | undefined>(undefined);
  const [rejected, setRejected] = useState<SignInResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadWorkerDirectory()
      .catch(() => null)
      .then((entries) => {
        if (!cancelled) {
          setDirectory(entries);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const confirm = () => {
    const result = verifyWorkerNo(directory ?? null, entry);

    if (result.kind === 'ok') {
      signIn(result.worker);
      setEntry('');
      setRejected(null);
      return;
    }

    setRejected(result);
  };

  const change = () => {
    signOut();
    setEntry('');
    setRejected(null);
  };

  if (worker !== null) {
    return (
      <div className="worker-sign-in">
        {/* 누구로 기록되는지가 이 카드의 요점이라 머리말 자리에 둔다. */}
        <Card bordered aria-label={t.current.label}>
          <Card.Header>{`${worker.workerName} · ${worker.workerNo}`}</Card.Header>
          <Card.Body>
            <p>{t.current.notice}</p>
          </Card.Body>
        </Card>

        <Button variant="outlined" size="xl" onClick={change}>
          {t.change}
        </Button>

        <Button
          variant="filled"
          size="2xl"
          onClick={() => {
            void navigate('/screens');
          }}
        >
          {t.toWork}
        </Button>
      </div>
    );
  }

  return (
    <div className="worker-sign-in">
      <TextField
        label={t.label}
        value={entry}
        readOnly
        size="xl"
        fullWidth
        error={rejected?.kind === 'unknown' ? t.unknown : undefined}
      />

      <NumericKeypad
        value={entry}
        onChange={(next) => {
          setEntry(next);
          setRejected(null);
        }}
        maxLength={MAX_WORKER_NO_LENGTH}
        label={t.keypad.label}
        backspaceLabel={t.keypad.backspace}
        clearLabel={t.keypad.clear}
      />

      <Button
        variant="filled"
        size="2xl"
        disabled={entry === '' || directory === null}
        onClick={confirm}
      >
        {t.confirm}
      </Button>

      {directory === null ? <AlertBanner variant="warning" title={t.noDirectory} /> : null}
    </div>
  );
};
