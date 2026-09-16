import { AlertBanner, Button } from '@crefle/web-ui';
import { Capacitor, registerPlugin, type PermissionState } from '@capacitor/core';
import { messages } from '@omf-mes/i18n';
import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';

const t = messages.deviceRegistration;

export type LocalNetworkPermission = 'granted' | 'denied';

/**
 * 사내망 서버에 닿기 위한 로컬 네트워크 권한.
 *
 * Android 17(targetSdk 37)부터 이 권한이 허용되지 않으면 사설 주소로 가는 연결이 시간 초과로
 * 끝난다 — 인터넷은 되는데 사내망 서버만 안 닿고, 작업자에게는 2분 뒤 「오프라인」으로만
 * 보인다(REG-ALL-01 N15). 앱 안의 플러그인(`LocalNetworkPlugin.java`)이 묻는다.
 */
export interface LocalNetworkAccess {
  request(): Promise<LocalNetworkPermission>;
}

interface LocalNetworkPlugin {
  checkPermissions(): Promise<{ localNetwork: PermissionState }>;
  requestPermissions(): Promise<{ localNetwork: PermissionState }>;
}

const LocalNetwork = registerPlugin<LocalNetworkPlugin>('LocalNetwork');

export const createCapacitorLocalNetworkAccess = (): LocalNetworkAccess => ({
  request: async () => {
    // 브라우저에는 이 제한이 없다. 네이티브 플러그인이 없어 부르면 던진다.
    if (!Capacitor.isNativePlatform()) return 'granted';

    const current = await LocalNetwork.checkPermissions();
    if (current.localNetwork === 'granted') return 'granted';

    const requested = await LocalNetwork.requestPermissions();
    return requested.localNetwork === 'granted' ? 'granted' : 'denied';
  },
});

/**
 * - `unknown` 아직 묻지 않았다
 * - `requesting` 묻는 중이다
 * - `granted` / `denied` 답을 받았다
 */
export type LocalNetworkStatus = 'unknown' | 'requesting' | LocalNetworkPermission;

interface LocalNetworkState {
  status: LocalNetworkStatus;
  /** 첫 물음에 답을 받았는가. 다시 묻는 동안에는 참으로 남는다. */
  settled: boolean;
  request: () => void;
}

/*
 * 공급자 없이 세운 화면(개별 화면 시험)은 제한이 없는 것으로 둔다 — 묻지 않는 자리에서
 * 경고가 뜨면 안 된다. 앱은 `AppProviders` 에서 공급자를 세운다.
 */
const NOT_REQUIRED: LocalNetworkState = { status: 'granted', settled: true, request: () => undefined };

const LocalNetworkContext = createContext<LocalNetworkState>(NOT_REQUIRED);

export const LocalNetworkProvider = ({
  access,
  children,
}: {
  access?: LocalNetworkAccess;
  children: ReactNode;
}) => {
  const accessRef = useRef<LocalNetworkAccess | null>(null);
  accessRef.current ??= access ?? createCapacitorLocalNetworkAccess();
  const inFlight = useRef(false);
  const [status, setStatus] = useState<LocalNetworkStatus>('unknown');
  const [settled, setSettled] = useState(false);

  const request = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus('requesting');

    void accessRef
      .current!.request()
      // 묻지 못한 것은 허용을 증명하지 못한 것이다. 경고만 하므로 막히지는 않는다.
      .catch((): LocalNetworkPermission => 'denied')
      .then((answer) => {
        inFlight.current = false;
        setStatus(answer);
        setSettled(true);
      });
  }, []);

  const value = useMemo(() => ({ status, settled, request }), [status, settled, request]);

  return <LocalNetworkContext value={value}>{children}</LocalNetworkContext>;
};

export const useLocalNetwork = (): LocalNetworkState => use(LocalNetworkContext);

/**
 * 권한이 거절되면 곧바로 알린다.
 *
 * 앱은 이 권한이 실제로 필요한지 모른다 — 도메인 주소도 사내 DNS 로 사설 주소에 풀릴 수
 * 있다. 그래서 등록·사번 확인을 막지 않고, 연결되지 않을 수 있다고만 조건부로 말한다
 * (통합 담당 결정 2026-09-15). 카메라 거절 안내와 같은 모양이다.
 */
export const LocalNetworkNotice = () => {
  const { status, request } = useLocalNetwork();
  if (status !== 'denied') return null;

  return (
    <AlertBanner
      variant="warning"
      title={t.localNetwork.denied}
      action={
        <Button variant="outlined" onClick={request}>
          {t.retry}
        </Button>
      }
    >
      {t.localNetwork.grant}
    </AlertBanner>
  );
};
