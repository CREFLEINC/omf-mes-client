import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { noteServerAnswered, noteServerSilent } from './online-status';
import { useRefetchOnRegain } from './refetch-on-regain';

/*
 * 실제 앱에서 이 훅은 화면 바깥 공통 자리에 산다. 시험에서도 그렇게 두어야 화면을 떠난 뒤를
 * 잴 수 있다 - 화면 안에 두면 화면과 함께 사라져 아무도 다시 받지 않고, 시험이 무엇도 재지
 * 못한 채 통과한다.
 */
const Watcher = ({ children }: { children: ReactNode }) => {
  useRefetchOnRegain();

  return children;
};

const Probe = ({ ask }: { ask: () => Promise<string> }) => {
  const query = useQuery({ queryKey: ['probe'], queryFn: ask, retry: 0 });

  return <p>{query.isError ? '못 받았습니다' : (query.data ?? '받는 중')}</p>;
};

/** 화면을 떠나는 것을 흉내 낸다. 감시는 남고 조회를 보던 화면만 사라진다. */
const Stage = ({ ask, hide }: { ask: () => Promise<string>; hide: (go: () => void) => void }) => {
  const [shown, setShown] = useState(true);

  hide(() => {
    setShown(false);
  });

  return shown ? <Probe ask={ask} /> : <p>떠났습니다</p>;
};

const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: 0, networkMode: 'always' } } });

const settle = async () => {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

describe('다시 닿기 시작할 때', () => {
  beforeEach(() => {
    noteServerAnswered();
  });

  /*
   * 끊긴 동안 나간 요청은 실패한 채로 멈춘다. 다시 답을 받아도 풀 계기가 없으면 화면이 값을
   * 들고 있으면서 연결을 확인하라고 말한다 - 자리를 옮기라는 뜻이라 멀쩡한 단말을 든 사람이
   * 헛되이 움직인다.
   */
  it('실패한 채로 멈춘 조회를 다시 받는다', async () => {
    let asked = 0;

    const ask = async () => {
      asked += 1;

      if (asked === 1) {
        throw new TypeError('Failed to fetch');
      }

      return '도착 L1-STG';
    };

    noteServerSilent();
    render(
      <QueryClientProvider client={newClient()}>
        <Watcher>
          <Probe ask={ask} />
        </Watcher>
      </QueryClientProvider>,
    );
    await settle();

    expect(await screen.findByText('못 받았습니다')).toBeTruthy();

    await act(async () => {
      noteServerAnswered();
      await settle();
    });

    expect(await screen.findByText('도착 L1-STG')).toBeTruthy();
    expect(asked).toBe(2);
  });

  /*
   * 화면 밖 조회까지 부르면 그동안 쌓인 실패가 한꺼번에 나간다. 현장 단말은 화면을 여럿 오가고
   * 연결이 자주 끊겨 그 양이 그대로 쌓인다. 화면 밖 것은 그 화면을 다시 열 때 어차피 부른다.
   */
  it('화면에 없는 조회는 다시 부르지 않는다', async () => {
    let asked = 0;
    let leave = () => {};

    const ask = async () => {
      asked += 1;
      throw new TypeError('Failed to fetch');
    };

    noteServerSilent();
    render(
      <QueryClientProvider client={newClient()}>
        <Watcher>
          <Stage
            ask={ask}
            hide={(go) => {
              leave = go;
            }}
          />
        </Watcher>
      </QueryClientProvider>,
    );
    await settle();

    expect(await screen.findByText('못 받았습니다')).toBeTruthy();
    expect(asked).toBe(1);

    /* 화면만 떠난다. 조회는 캐시에 남고 감시는 그대로 듣고 있다. */
    await act(async () => {
      leave();
      await settle();
    });
    expect(await screen.findByText('떠났습니다')).toBeTruthy();

    await act(async () => {
      noteServerAnswered();
      await settle();
    });

    expect(asked).toBe(1);
  });

  /* 성공해 있는 것까지 부르면 연결이 돌아올 때마다 화면 전부가 다시 묻는다. */
  it('성공해 있던 조회는 다시 부르지 않는다', async () => {
    let asked = 0;

    const ask = async () => {
      asked += 1;
      return '도착 L1-STG';
    };

    render(
      <QueryClientProvider client={newClient()}>
        <Watcher>
          <Probe ask={ask} />
        </Watcher>
      </QueryClientProvider>,
    );
    await settle();

    expect(await screen.findByText('도착 L1-STG')).toBeTruthy();

    await act(async () => {
      noteServerSilent();
      noteServerAnswered();
      await settle();
    });

    expect(asked).toBe(1);
  });
});
