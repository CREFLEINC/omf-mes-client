import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useApiClient } from '../patterns/api-context';
import { FailureBanner } from '../patterns/failure-banner';
import { deviceTokenKey, useLoadFailure } from '../patterns/load-failure';
import { rememberPlant } from '../patterns/plant';
import { runRequest } from '../patterns/request';
import {
  createStubFetch,
  createTestQueryClient,
  jsonResponse,
  renderWithProviders,
} from '../test/api-harness';
import { ShellGate } from './shell-gate';

const store = vi.hoisted(() => new Map<string, string>());

vi.mock('../patterns/local-store', () => ({
  readLocal: (key: string) => Promise.resolve(store.get(key) ?? null),
  writeLocal: (key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  },
  removeLocal: (key: string) => {
    store.delete(key);
    return Promise.resolve();
  },
}));

const keystore = vi.hoisted(() => ({ token: null as string | null }));

vi.mock('../patterns/device-token', () => ({
  readDeviceToken: () => Promise.resolve(keystore.token),
  writeDeviceToken: (value: string) => {
    keystore.token = value;
    return Promise.resolve();
  },
  clearDeviceToken: () => {
    keystore.token = null;
    return Promise.resolve();
  },
  currentDeviceToken: () => keystore.token,
}));

afterEach(() => {
  keystore.token = null;
  store.clear();
});

const renderGate = () => {
  renderWithProviders(
    <ShellGate>
      <p>작업 화면</p>
    </ShellGate>,
    { fetch: createStubFetch([]) },
  );
};

describe('셸 관문', () => {
  it('미등록이면 등록 화면만 보인다', async () => {
    renderGate();

    expect(await screen.findByText('이 기기는 아직 등록되지 않았습니다')).toBeInTheDocument();
    expect(screen.queryByText('작업 화면')).not.toBeInTheDocument();
  });

  it('등록됐으면 아래 화면을 그대로 통과시킨다', async () => {
    keystore.token = 'tok-1';

    renderGate();

    expect(await screen.findByText('작업 화면')).toBeInTheDocument();
  });

  it('판정 전에는 어느 쪽도 보이지 않는다', () => {
    renderGate();

    expect(screen.getByRole('status')).toHaveTextContent('등록 상태를 확인하는 중입니다');
    expect(screen.queryByText('작업 화면')).not.toBeInTheDocument();
  });
});

const denied = { errors: [{ scope: 'screen', code: 'PERMISSION_DENIED', message: '거절' }] };

/** 조회 둘을 가진 화면. 토큰이 죽으면 둘 다 거절된다. */
const TwoLookups = () => {
  const { client } = useApiClient();
  const describe = useLoadFailure();
  const items = useQuery({
    queryKey: ['items'],
    queryFn: () => runRequest(() => client.GET('/mdm/items', {})),
  });
  const uoms = useQuery({
    queryKey: ['uoms'],
    queryFn: () => runRequest(() => client.GET('/mdm/uoms', {})),
  });

  return (
    <>
      <p>작업 화면</p>
      {items.isError ? (
        <FailureBanner variant="error" title={describe(items.error, '품목 연결 확인')} />
      ) : null}
      {uoms.isError ? (
        <FailureBanner variant="error" title={describe(uoms.error, '단위 연결 확인')} />
      ) : null}
      {items.isError && uoms.isError ? <AlertBanner title="둘 다 거절됨" /> : null}
    </>
  );
};

/*
 * 실기 실측(#1198) - 토큰이 죽자 적치 화면이 사번·지시 조회마다 같은 만료 문구를 달아 두 번
 * 떴다. 만료는 기기의 상태라 셸이 화면 위에 한 번만 알린다.
 */
describe('등록 만료 알림', () => {
  it('한 화면의 조회가 모두 거절돼도 만료는 한 번만 뜬다', async () => {
    keystore.token = 'tok-1';
    await rememberPlant(7);
    const reject = () => jsonResponse(denied, { status: 401 });

    renderWithProviders(
      <ShellGate>
        <TwoLookups />
      </ShellGate>,
      {
        fetch: createStubFetch([
          { match: (req) => new URL(req.url).pathname === '/mdm/items', respond: reject },
          { match: (req) => new URL(req.url).pathname === '/mdm/uoms', respond: reject },
          { match: (req) => new URL(req.url).pathname === '/mdm/workers', respond: reject },
        ]),
      },
    );

    await screen.findByText('둘 다 거절됨');
    expect(await screen.findByText(messages.httpError.deviceExpired)).toBeInTheDocument();
    expect(screen.getAllByText(messages.httpError.deviceExpired)).toHaveLength(1);
    expect(screen.queryByText(messages.httpError.deviceRejected)).not.toBeInTheDocument();
  });

  /* 앞 등록의 판정이 남으면 새 QR 로 다시 등록한 멀쩡한 단말에 만료가 뜬다. */
  it('등록이 풀리면 앞 토큰의 판정을 버린다', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(deviceTokenKey, 'dead');

    renderWithProviders(
      <ShellGate>
        <p>작업 화면</p>
      </ShellGate>,
      { fetch: createStubFetch([]), queryClient },
    );

    await screen.findByText('이 기기는 아직 등록되지 않았습니다');
    await waitFor(() => {
      expect(queryClient.getQueryData(deviceTokenKey)).toBeUndefined();
    });
  });
});
