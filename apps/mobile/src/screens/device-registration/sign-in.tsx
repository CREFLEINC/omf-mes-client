import { AlertBanner, Button, Card, Dialog, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { NumericKeypad } from '@omf-mes/ui';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { useDeviceRegistration } from '../../patterns/device-registration';
import { useDeviceTokenState } from '../../patterns/load-failure';
import { LocalNetworkNotice } from '../../patterns/local-network';
import { useOutbox } from '../../patterns/outbox';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import { loadWorkerDirectory, type WorkerEntry } from './directory';
import { verifyWorkerNo, type SignInResult } from './verify';
import './sign-in.css';

const t = messages.deviceRegistration.signIn;

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
  const [asking, setAsking] = useState(false);
  const [releaseFailed, setReleaseFailed] = useState(false);
  const { unregister } = useDeviceRegistration();
  /*
   * 등록을 풀면 담아 둔 것이 함께 사라진다. 몇 건인지 모른 채 누르게 두지 않는다(설계 §5-5).
   * 되돌아온 것도 센다 - 그것도 이 기기에만 남아 있다.
   */
  const { loaded, pending, rejected: returned, discardAll } = useOutbox();

  /*
   * 명단만 보고 통과시키면 서버에서 끊긴 등록도 들어간다. QR 을 다시 발급하면 앞 기기의 토큰이
   * 즉시 죽는데, 작업자는 들어간 뒤 모든 조회가 막히고서야 안다(#1198). 설계는 이때 새 QR 을
   * 요청하라고 막는다(M-CO-01 §6). 서버에 못 닿으면 모른다고 두고 막지 않는다(§5-7).
   * 만료 문구는 셸이 화면 위에 한 번만 띄운다(`ShellGate`) - 여기서 또 띄우면 두 번 뜬다.
   */
  const token = useDeviceTokenState();
  const expired = token.state === 'dead';

  /*
   * 큐를 먼저 버리고 그다음 등록을 푼다. 반대로 하면 토큰이 없는 채로 큐가 남아, 다음
   * 재전송이 인증 없이 나가 401 로 되돌아온다 - 그 사유는 서버가 그 기록에 대해 내린 판정이
   * 아니라 우리가 등록을 푼 결과이고, 되돌아온 것은 다시 보내지 않으므로 되찾을 수 없다.
   *
   * 사번도 함께 끊는다. 남겨 두면 새 QR 로 다시 등록했을 때 사번 입력을 건너뛰어 앞 작업자의
   * 사번으로 기록이 쌓인다 - 공용 장비에서 그것이 가장 나쁘다(공유계약 D-5).
   */
  const release = async () => {
    try {
      await discardAll();
      await unregister();
    } catch {
      /*
       * 걸리면 등록이 그대로 남는다 - 토큰과 사번은 그대로다. 다만 큐는 이미 버려졌을 수
       * 있어 기록이 남았는지는 단정하지 않는다. 창은 이미 닫혀 있어 가만히 있으면 된 줄 안다.
       */
      setReleaseFailed(true);
      return;
    }

    /*
     * 사번도 함께 끊는다. 남겨 두면 새 QR 로 다시 등록했을 때 사번 입력을 건너뛰어 앞 작업자의
     * 사번으로 기록이 쌓인다 - 셸이 등록 화면으로 갈아타도 사번은 셸 위에 있어 살아남는다.
     */
    signOut();
  };

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
    /* 교대는 같은 화면에 머문다. 앞 사람이 들어온 뒤에 끊겼을 수 있어 다시 묻는다. */
    token.recheck();
  };

  const openUnregister = () => {
    setAsking(true);
    setReleaseFailed(false);
  };

  /* 사번을 넣기 전에도 열린다 - 등록이 끊겼으면 풀어야 새 QR 로 다시 등록할 수 있다. */
  const unregisterDialog = (
    <>
      {releaseFailed ? <AlertBanner variant="error" title={t.unregister.failed} /> : null}

      <Dialog
        open={asking}
        className="worker-sign-in__unregister-dialog"
        /* 되돌릴 수 없다. 스크림을 스쳐 닫히면 물러선 것인지 손이 스친 것인지 갈리지 않는다. */
        closeOnBackdropClick={false}
        /* ⭐ 닫는 길은 [취소] 하나다 - X 를 두지 않는다(사용자 지시 2026-09-15). */
        showCloseButton={false}
        onClose={() => {
          setAsking(false);
        }}
        title={t.unregister.title}
        footer={
          <>
            <Button
              variant="outlined"
              size="xl"
              onClick={() => {
                setAsking(false);
              }}
            >
              {t.unregister.cancel}
            </Button>
            {/* 큐를 읽기 전에는 몇 건을 잃는지 모른다. 모르는 채 풀게 두지 않는다. */}
            <Button
              variant="filled"
              size="xl"
              disabled={!loaded}
              onClick={() => {
                setAsking(false);
                setReleaseFailed(false);
                void release();
              }}
            >
              {t.unregister.confirm}
            </Button>
          </>
        }
      >
        {/*
          디자인 시스템의 창 본문은 자식 사이 간격을 주지 않고, 이 화면은 문단 여백을 0 으로
          둔다. 감싸지 않으면 안내와 경고가 서로 붙는다.
        */}
        <div className="worker-sign-in__dialog-body">
          <p className="worker-sign-in__dialog-notice">{t.unregister.notice}</p>
          {!loaded ? <p>{t.unregister.counting}</p> : null}
          {/*
            앱바가 둘로 가른 것을 창에서 합치지 않는다. 기다리면 가는 것과 기다려도 가지
            않는 것은 다른 일이라, 합치면 앱바의 두 수와 창의 한 수가 어긋난다.
          */}
          {loaded && pending > 0 ? (
            <AlertBanner variant="warning" title={t.unregister.pending(String(pending))} />
          ) : null}
          {loaded && returned.length > 0 ? (
            <AlertBanner variant="warning" title={t.unregister.returned(String(returned.length))} />
          ) : null}
        </div>
      </Dialog>
    </>
  );

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
            void navigate('/screens');
          }}
        >
          {t.toWork}
        </Button>

        <Button variant="text" size="xl" onClick={openUnregister}>
          {t.unregister.open}
        </Button>

        {unregisterDialog}
      </div>
    );
  }

  /*
   * 등록이 끊겼으면 사번을 넣어도 들어갈 수 없다. 막힌 입력을 두면 작업자는 키패드를 누르다
   * 멈추고, 풀 길은 키패드 아래 맨 끝에 밀려 단말 화면에서 보이지 않았다(#1243 실기). 입력을
   * 걷고 등록을 푸는 단추 하나만 만료 문구 바로 아래에 둔다. 누르면 해제 확인 창을 그대로
   * 거친다 - 보내지 못한 기록이 사라진다는 안내를 건너뛰지 않는다(설계 §5-5).
   *
   * ⭐ 단추는 사번 확인 뒤 화면의 「기기 등록 해제」와 이름·모양이 같다(사용자 지시 2026-09-15).
   */
  if (expired) {
    return (
      <div className="worker-sign-in">
        <LocalNetworkNotice />

        <Button variant="text" size="xl" onClick={openUnregister}>
          {t.unregister.open}
        </Button>

        {unregisterDialog}
      </div>
    );
  }

  return (
    <div className="worker-sign-in">
      {/* 등록된 기기도 업데이트 뒤에는 이 권한이 없을 수 있다. 사번을 넣기 전에 알린다. */}
      <LocalNetworkNotice />

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

      {/* ⭐ 사번을 넣기 전에도 늘 둔다 - 사번 확인 뒤 화면과 같은 단추다(사용자 지시 2026-09-15). */}
      <Button variant="text" size="xl" onClick={openUnregister}>
        {t.unregister.open}
      </Button>

      {unregisterDialog}
    </div>
  );
};
