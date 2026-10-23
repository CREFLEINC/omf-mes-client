import { AlertBanner, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { NumericKeypad } from '@omf-mes/ui';
import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '../../patterns/button';
import { Card } from '../../patterns/card';
import { useDeviceTokenState } from '../../patterns/load-failure';
import { LocalNetworkNotice } from '../../patterns/local-network';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession, type Worker } from '../../patterns/worker-session';
import { loadWorkerDirectory, type WorkerEntry } from './directory';
import { UnregisterDevice } from './unregister';
import { autoSignInOf, verifyWorkerNo, type SignInResult } from './verify';
import './sign-in.css';

const t = messages.deviceRegistration.signIn;

/** 작업 목록. 사번을 확인하면 이리 간다. */
const HOME_PATH = '/screens';

/*
 * 계약 Worker.workerNo 의 상한이다. 화면이 더 좁히지 않는다 - 계약이 형식을 강제하지 않기로
 * 한 이유가 표본 밖의 사번을 가진 사람이 단말을 아예 못 쓰는 것을 막으려는 데 있어, 화면이
 * 좁히면 그 결정을 화면에서 되돌리는 셈이 된다.
 */
const MAX_WORKER_NO_LENGTH = 50;

export const WorkerSignInScreen = () => {
  useScreenTitle(t.title, { compact: true });
  const navigate = useNavigate();
  const { worker, signIn, signOut } = useWorkerSession();

  const [entry, setEntry] = useState('');
  const [directory, setDirectory] = useState<WorkerEntry[] | null | undefined>(undefined);
  const [rejected, setRejected] = useState<SignInResult | null>(null);
  const entryId = useId();
  const messageId = useId();
  const unknown = rejected?.kind === 'unknown';
  /*
   * 명단만 보고 통과시키면 서버에서 끊긴 등록도 들어간다. QR 을 다시 발급하면 앞 기기의 토큰이
   * 즉시 죽는데, 작업자는 들어간 뒤 모든 조회가 막히고서야 안다(#1198). 설계는 이때 새 QR 을
   * 요청하라고 막는다(M-CO-01 §6). 서버에 못 닿으면 모른다고 두고 막지 않는다(§5-7).
   * 만료 문구는 셸이 화면 위에 한 번만 띄운다(`ShellGate`) - 여기서 또 띄우면 두 번 뜬다.
   */
  const token = useDeviceTokenState();
  const expired = token.state === 'dead';

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

  /*
   * 확인되면 곧바로 작업 목록으로 간다. 전에는 확인 카드를 한 번 더 보이고 「작업 목록으로」를
   * 눌러야 했다 - 누구로 기록되는지는 앱바의 사번 칩이 늘 보인다.
   */
  const enter = (next: Worker) => {
    signIn(next);
    setEntry('');
    setRejected(null);
    void navigate(HOME_PATH);
  };

  const confirm = () => {
    const result = verifyWorkerNo(directory ?? null, entry);

    if (result.kind === 'ok') {
      enter(result.worker);
      return;
    }

    setRejected(result);
  };

  const change = () => {
    signOut();
    setEntry('');
    setRejected(null);
    /* 교대는 같은 화면에 머문다. 앞 사람이 들어온 뒤에 끊겼을 수 있어 다시 묻는다. */
    token.recheck();
  };

  if (worker !== null) {
    return (
      <div className="worker-sign-in">
        <LocalNetworkNotice />

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
          disabled={expired}
          onClick={() => {
            void navigate(HOME_PATH);
          }}
        >
          {t.toWork}
        </Button>

        {/* 기기 등록 해제는 설정 화면에 있다(사용자 지시 2026-10-21). */}
      </div>
    );
  }

  /*
   * 등록이 끊겼으면 사번을 넣어도 들어갈 수 없다. 막힌 입력을 두면 작업자는 키패드를 누르다
   * 멈추고, 풀 길은 키패드 아래 맨 끝에 밀려 단말 화면에서 보이지 않았다(#1243 실기). 입력을
   * 걷고 등록을 푸는 단추 하나만 만료 문구 바로 아래에 둔다. 누르면 해제 확인 창을 그대로
   * 거친다 - 보내지 못한 기록이 사라진다는 안내를 건너뛰지 않는다(설계 §5-5).
   *
   * 평소의 기기 등록 해제는 설정 화면에 있다(사용자 지시 2026-10-21). 끊긴 단말은 사번을 넣을
   * 수 없어 설정까지 갈 길이 없으므로 여기에만 남긴다.
   */
  if (expired) {
    return (
      <div className="worker-sign-in">
        <LocalNetworkNotice />

        <UnregisterDevice
          trigger={(open) => (
            <Button variant="text" size="xl" onClick={open}>
              {t.unregister.open}
            </Button>
          )}
        />
      </div>
    );
  }

  return (
    <div className="worker-sign-in">
      {/* 등록된 기기도 업데이트 뒤에는 이 권한이 없을 수 있다. 사번을 넣기 전에 알린다. */}
      <LocalNetworkNotice />

      {/*
        누른 사번은 글자 칸이 아니라 큰 고정폭 숫자로 선다. 작업자는 키패드를 보며 누르다 눈을 들어
        자릿수를 세는데, 입력 칸 크기의 글씨는 한눈에 몇 자리인지 읽히지 않았다. 손으로 쓰는 칸이
        아니라 키패드가 채우는 칸이라 읽기 전용이다.
      */}
      <div className="worker-sign-in__entry">
        <label htmlFor={entryId} className="worker-sign-in__label">
          {t.label}
        </label>
        <input
          id={entryId}
          className={
            unknown ? 'worker-sign-in__pin worker-sign-in__pin--error' : 'worker-sign-in__pin'
          }
          value={entry}
          readOnly
          aria-invalid={unknown || undefined}
          aria-describedby={unknown ? messageId : undefined}
        />
        {/* 안내 문장은 두지 않는다(사용자 지시 2026-10-21). 없는 사번일 때만 그 사실을 적는다. */}
        {unknown ? (
          <p id={messageId} className="worker-sign-in__message worker-sign-in__message--error">
            {t.unknown}
          </p>
        ) : null}
      </div>

      <NumericKeypad
        value={entry}
        onChange={(next) => {
          setEntry(next);
          setRejected(null);

          /* 명부의 사번 하나로 정해지면 「확인」을 누르지 않아도 들어간다. */
          const matched = autoSignInOf(directory ?? null, next);

          if (matched !== null) {
            enter(matched);
          }
        }}
        maxLength={MAX_WORKER_NO_LENGTH}
        label={t.keypad.label}
        backspaceLabel={t.keypad.backspace}
        backspaceGlyph={<Icon name="backspace" size={24} />}
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

      {/*
        기기 등록 해제는 여기 두지 않는다 - 설정 화면으로 옮겼다(사용자 지시 2026-10-21, 2026-09-15
        지시를 바꿈). 교대 때마다 눈에 걸리는데 쓰는 일은 거의 없다.
      */}
    </div>
  );
};
