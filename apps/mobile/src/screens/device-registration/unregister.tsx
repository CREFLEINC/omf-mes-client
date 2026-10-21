import { AlertBanner, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState, type ReactNode } from 'react';

import { Button } from '../../patterns/button';
import { useDeviceRegistration } from '../../patterns/device-registration';
import { useOutbox } from '../../patterns/outbox';
import { useWorkerSession } from '../../patterns/worker-session';
import './unregister.css';

const t = messages.deviceRegistration.signIn.unregister;

export interface UnregisterDeviceProps {
  /** 창을 여는 단추. 자리마다 모양이 달라(설정 행 · 만료 화면의 글자 단추) 쓰는 쪽이 그린다. */
  trigger: (open: () => void) => ReactNode;
}

/**
 * 기기 등록 해제 - 여는 단추 · 확인 창 · 실패 배너.
 *
 * 평소에는 설정 화면에서 연다(사용자 지시 2026-10-21) - 사번 입력 화면에 두면 교대 때마다 눈에
 * 걸리는데 쓰는 일은 거의 없다. 등록이 끊긴 단말만은 사번 확인 화면에 이 단추 하나만 남는다 -
 * 사번을 넣을 수 없어 설정까지 갈 길이 없고, 풀어야 새 QR 로 다시 등록할 수 있다.
 */
export const UnregisterDevice = ({ trigger }: UnregisterDeviceProps) => {
  const { signOut } = useWorkerSession();
  const [asking, setAsking] = useState(false);
  const [releaseFailed, setReleaseFailed] = useState(false);
  const { unregister } = useDeviceRegistration();
  /*
   * 등록을 풀면 담아 둔 것이 함께 사라진다. 몇 건인지 모른 채 누르게 두지 않는다(설계 §5-5).
   * 되돌아온 것도 센다 - 그것도 이 기기에만 남아 있다.
   */
  const { loaded, pending, rejected: returned, discardAll } = useOutbox();

  /*
   * 큐를 먼저 버리고 그다음 등록을 푼다. 반대로 하면 토큰이 없는 채로 큐가 남아, 다음
   * 재전송이 인증 없이 나가 401 로 되돌아온다 - 그 사유는 서버가 그 기록에 대해 내린 판정이
   * 아니라 우리가 등록을 푼 결과이고, 되돌아온 것은 다시 보내지 않으므로 되찾을 수 없다.
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
     * 사번으로 기록이 쌓인다 - 셸이 등록 화면으로 갈아타도 사번은 셸 위에 있어 살아남는다
     * (공유계약 D-5).
     */
    signOut();
  };

  const open = () => {
    setAsking(true);
    setReleaseFailed(false);
  };

  return (
    <>
      {trigger(open)}

      {releaseFailed ? <AlertBanner variant="error" title={t.failed} /> : null}

      <Dialog
        open={asking}
        className="device-unregister__dialog"
        /* 되돌릴 수 없다. 스크림을 스쳐 닫히면 물러선 것인지 손이 스친 것인지 갈리지 않는다. */
        closeOnBackdropClick={false}
        /* ⭐ 닫는 길은 [취소] 하나다 - X 를 두지 않는다(사용자 지시 2026-09-15). */
        showCloseButton={false}
        onClose={() => {
          setAsking(false);
        }}
        /*
         * 제목과 단추 줄을 우리 요소로 감싼다. 디자인 시스템이 창을 그릴 때 쓰는 클래스는
         * 빌드마다 바뀌는 해시라 붙잡을 수 없어, 예전에는 header·h2·footer 라는 태그로
         * 골랐다. 그 방식은 부품 속에 닿아, 겨냥한 적 없는 다른 창까지 번질 수 있다.
         */
        title={<span className="device-unregister__title">{t.title}</span>}
        footer={
          <div className="device-unregister__actions">
            <Button
              variant="outlined"
              size="xl"
              onClick={() => {
                setAsking(false);
              }}
            >
              {t.cancel}
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
              {t.confirm}
            </Button>
          </div>
        }
      >
        {/*
          디자인 시스템의 창 본문은 자식 사이 간격을 주지 않는다. 감싸지 않으면 안내와 경고가
          서로 붙는다.
        */}
        <div className="device-unregister__body">
          <p className="device-unregister__notice">{t.notice}</p>
          {!loaded ? <p>{t.counting}</p> : null}
          {/*
            앱바가 둘로 가른 것을 창에서 합치지 않는다. 기다리면 가는 것과 기다려도 가지
            않는 것은 다른 일이라, 합치면 앱바의 두 수와 창의 한 수가 어긋난다.
          */}
          {loaded && pending > 0 ? (
            <AlertBanner variant="warning" title={t.pending(String(pending))} />
          ) : null}
          {loaded && returned.length > 0 ? (
            <AlertBanner variant="warning" title={t.returned(String(returned.length))} />
          ) : null}
        </div>
      </Dialog>
    </>
  );
};
