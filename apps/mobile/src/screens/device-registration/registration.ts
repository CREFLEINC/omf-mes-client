import { useCallback, useEffect, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { useDeviceRegistration } from '../../patterns/device-registration';
import { useOnlineStatus } from '../../patterns/online-status';
import { toApiError } from '../../patterns/request';
import { createMlkitQrCamera, type QrCamera } from '../../patterns/qr-camera';
import { readTerminalClaims, type TerminalClaims } from '../../patterns/token-claims';
import { fetchWorkerDirectory, saveWorkerDirectory } from './directory';

/**
 * 등록은 한 방향으로만 간다 — 카메라를 열고, 읽고, 서버가 받아 주는지 확인한다.
 *
 * offline 과 denied 는 되돌아올 수 있는 자리라 다시 시도를 붙이고, rejected 는 관리자가
 * 새 QR 을 만들어야 하는 자리라 다시 시도로 풀리지 않는다.
 */
export type RegistrationPhase =
  'offline' | 'preparing' | 'unsupported' | 'denied' | 'scanning' | 'receiving' | 'rejected';

export interface RegistrationFlow {
  phase: RegistrationPhase;
  /** 읽은 QR 이 가리키는 단말. 아직 읽지 않았으면 null 이다. */
  terminal: TerminalClaims | null;
  retry: () => void;
}

export interface RegistrationFlowOptions {
  camera?: QrCamera;
}

export const useRegistrationFlow = ({ camera }: RegistrationFlowOptions = {}): RegistrationFlow => {
  const online = useOnlineStatus();
  const { register } = useDeviceRegistration();
  const { client } = useApiClient();

  const [phase, setPhase] = useState<RegistrationPhase>('preparing');
  const [terminal, setTerminal] = useState<TerminalClaims | null>(null);
  const [attempt, setAttempt] = useState(0);

  const cameraRef = useRef<QrCamera | null>(null);
  cameraRef.current ??= camera ?? createMlkitQrCamera();

  const retry = useCallback(() => {
    setTerminal(null);
    setPhase('preparing');
    setAttempt((count) => count + 1);
  }, []);

  useEffect(() => {
    if (!online) {
      setPhase('offline');
      return;
    }

    const qrCamera = cameraRef.current;

    if (qrCamera === null) {
      return;
    }

    let cancelled = false;
    let close: (() => Promise<void>) | null = null;
    // 한 번 읽은 뒤에도 미리보기는 계속 코드를 던진다. 첫 건만 받는다.
    let taken = false;

    const accept = (value: string) => {
      if (taken) {
        return;
      }

      const claims = readTerminalClaims(value);

      // 등록 QR 이 아닌 코드는 실패가 아니다. 미리보기를 열어 둔 채 다음 것을 기다린다.
      if (claims === null) {
        return;
      }

      taken = true;
      setTerminal(claims);
      setPhase('receiving');

      void close?.().catch(() => undefined);
      close = null;

      /*
       * 토큰을 두고 곧바로 기준정보를 받는다. 서버가 이 토큰을 받아 주는지는 실제로 불러 봐야
       * 알고, 받아 둔 목록이 있어야 등록 직후 현장에 들어가도 사번을 확인할 수 있다.
       */
      void register(value, async () => {
        const entries = await fetchWorkerDirectory(client, claims.plantId);
        await saveWorkerDirectory(entries);
      }).catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        /*
         * 닿지 못한 것과 거절당한 것을 가른다. 둘을 뭉치면 잠깐 끊긴 작업자에게 관리자를
         * 찾아가 새 QR 을 받아 오라고 말하게 된다 - 다시 시도하면 될 일이다.
         */
        setPhase(toApiError(error).kind === 'network' ? 'offline' : 'rejected');
      });
    };

    void (async () => {
      try {
        if (!(await qrCamera.isSupported())) {
          if (!cancelled) setPhase('unsupported');
          return;
        }

        if ((await qrCamera.requestPermission()) !== 'granted') {
          if (!cancelled) setPhase('denied');
          return;
        }

        const stop = await qrCamera.open(accept);

        if (cancelled) {
          await stop();
          return;
        }

        close = stop;
        setPhase('scanning');
      } catch {
        if (!cancelled) setPhase('unsupported');
      }
    })();

    return () => {
      cancelled = true;
      void close?.().catch(() => undefined);
    };
  }, [attempt, client, online, register]);

  return { phase, terminal, retry };
};
