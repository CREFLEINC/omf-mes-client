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

/** 사번 길이는 마스터가 정하고 화면은 모른다. 너무 길게 받지만 않게 상한만 둔다. */
const MAX_WORKER_NO_LENGTH = 20;

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
        <Card bordered aria-label={t.current.label}>
          <Card.Body>
            <p className="worker-sign-in__worker">{`${worker.workerName} · ${worker.workerNo}`}</p>
            <p>{t.current.notice}</p>
          </Card.Body>
        </Card>

        <Button variant="outlined" size="xl" onClick={change}>
          {t.change}
        </Button>

        <Button
          variant="filled"
          size="xl"
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
        error={
          rejected === null ? undefined : rejected.kind === 'unknown' ? t.unknown : t.noDirectory
        }
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

      <Button variant="filled" size="xl" disabled={entry === ''} onClick={confirm}>
        {t.confirm}
      </Button>

      {directory === null ? <AlertBanner variant="warning" title={t.noDirectory} /> : null}
    </div>
  );
};
