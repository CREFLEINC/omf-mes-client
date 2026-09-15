import { useCallback, useEffect, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { useDeviceRegistration } from '../../patterns/device-registration';
import { useOnlineStatus } from '../../patterns/online-status';
import { toApiError } from '../../patterns/request';
import { rememberPlant } from '../../patterns/plant';
import { createMlkitQrCamera, type QrCamera } from '../../patterns/qr-camera';
import { readTerminalClaims } from '../../patterns/token-claims';
import { confirmTerminalRegistration } from './confirm-registration';
import { fetchWorkerDirectory, saveWorkerDirectory } from './directory';
import { MOBILE_TERMINAL_TYPE, verifyTerminalToken, type RegisteredTerminal } from './terminal';

/** QR 촬영과 직접 입력은 같은 토큰 검증·명부 저장·서버 등록 확인을 거친다. */
export type RegistrationPhase =
  | 'offline'
  | 'preparing'
  | 'unsupported'
  | 'denied'
  | 'scanning'
  | 'receiving'
  | 'rejected'
  /** 서버가 받은 코드지만 모바일 기기용 단말이 아니다(POP 단말 등). */
  | 'wrong-type';

export interface RegistrationFlow {
  phase: RegistrationPhase;
  terminal: RegisteredTerminal | null;
  retry: () => void;
  submitCode: (value: string) => void;
  startCamera: () => void;
  showManualEntry: () => void;
  cameraEnabled: boolean;
}

export interface RegistrationFlowOptions {
  camera?: QrCamera;
}

export const useRegistrationFlow = ({ camera }: RegistrationFlowOptions = {}): RegistrationFlow => {
  const online = useOnlineStatus();
  const { register } = useDeviceRegistration();
  const { client } = useApiClient();

  const [phase, setPhase] = useState<RegistrationPhase>('preparing');
  const [terminal, setTerminal] = useState<RegisteredTerminal | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const busyRef = useRef(false);
  const closeRef = useRef<(() => Promise<void>) | null>(null);
  const cameraRef = useRef<QrCamera | null>(null);
  cameraRef.current ??= camera ?? createMlkitQrCamera();

  const stopCamera = useCallback(() => {
    const close = closeRef.current;
    closeRef.current = null;
    void close?.().catch(() => undefined);
  }, []);

  const retry = useCallback(() => {
    stopCamera();
    busyRef.current = false;
    setTerminal(null);
    setPhase('preparing');
    setCameraEnabled(true);
    setAttempt((count) => count + 1);
  }, [stopCamera]);

  const startCamera = useCallback(() => {
    if (!online || busyRef.current) return;
    setPhase('preparing');
    setCameraEnabled(true);
    setAttempt((count) => count + 1);
  }, [online]);

  const showManualEntry = useCallback(() => {
    stopCamera();
    setCameraEnabled(false);
    setPhase((current) =>
      current === 'denied' ||
      current === 'unsupported' ||
      current === 'rejected' ||
      current === 'wrong-type'
        ? current
        : 'preparing',
    );
  }, [stopCamera]);

  const acceptCode = useCallback((input: string, manual: boolean) => {
    if (busyRef.current) return;
    if (manual) {
      stopCamera();
      setCameraEnabled(false);
    }

    const value = input.trim();
    const claims = readTerminalClaims(value);
    if (claims === null) {
      // 다른 QR은 지나가지만, 사용자가 제출한 잘못된 코드는 명확히 알려 준다.
      if (manual) setPhase('rejected');
      return;
    }
    if (!online) {
      setPhase('offline');
      return;
    }

    busyRef.current = true;
    stopCamera();
    setTerminal(null);
    setPhase('receiving');

    void (async () => {
      /*
       * 보관·명부 수신·서버 확인보다 먼저 이 코드가 가리키는 단말을 묻는다. POP 단말의 코드를
       * 받으면 여기서 멈춘다 — 뒤로 가면 서버가 POP 단말을 이 기기로 등록 완료 처리한다.
       */
      const verified = await verifyTerminalToken(client, claims.terminalId, value);
      if (verified.terminalTypeCode !== MOBILE_TERMINAL_TYPE) {
        busyRef.current = false;
        setPhase('wrong-type');
        return;
      }

      await register(value, async () => {
        if (claims.plantId === null) {
          throw new Error('토큰에 공장이 없어 등록을 확인할 수 없습니다.');
        }

        // 쓰기 화면이 공장을 읽고, 사번 확인이 로컬 명부를 읽는다.
        await rememberPlant(claims.plantId);
        const entries = await fetchWorkerDirectory(client, claims.plantId);
        await saveWorkerDirectory(entries);
        await confirmTerminalRegistration(client, claims.terminalId);
        setTerminal({
          terminalId: claims.terminalId,
          terminalCode: claims.terminalCode,
          plantId: claims.plantId,
        });
      });
    })().catch((error: unknown) => {
      busyRef.current = false;
      setTerminal(null);
      setPhase(toApiError(error).kind === 'network' ? 'offline' : 'rejected');
    });
  }, [client, online, register, stopCamera]);

  const submitCode = useCallback((value: string) => {
    acceptCode(value, true);
  }, [acceptCode]);

  useEffect(() => {
    if (!online) {
      stopCamera();
      setPhase('offline');
      return;
    }

    if (!cameraEnabled) return;

    const qrCamera = cameraRef.current;
    if (qrCamera === null) return;

    let cancelled = false;
    void (async () => {
      try {
        if (!(await qrCamera.isSupported())) {
          if (!cancelled && !busyRef.current) setPhase('unsupported');
          return;
        }
        if (cancelled || busyRef.current) return;
        if ((await qrCamera.requestPermission()) !== 'granted') {
          if (!cancelled && !busyRef.current) setPhase('denied');
          return;
        }

        if (cancelled || busyRef.current) return;
        const close = await qrCamera.open(
          (value) => acceptCode(value, false),
          () => {
            if (cancelled || busyRef.current) return;
            stopCamera();
            setPhase('unsupported');
          },
        );
        if (cancelled || busyRef.current) {
          await close();
          return;
        }

        closeRef.current = close;
        setPhase('scanning');
      } catch {
        if (!cancelled && !busyRef.current) setPhase('unsupported');
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [acceptCode, attempt, cameraEnabled, online, stopCamera]);

  return { phase, terminal, retry, submitCode, startCamera, showManualEntry, cameraEnabled };
};
