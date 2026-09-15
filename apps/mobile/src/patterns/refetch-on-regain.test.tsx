import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { noteServerAnswered, noteServerSilent } from './online-status';
import { useRefetchOnRegain } from './refetch-on-regain';

const Probe = ({ ask }: { ask: () => Promise<string> }) => {
  useRefetchOnRegain();

  const query = useQuery({ queryKey: ['probe'], queryFn: ask, retry: 0 });

  return <p>{query.isError ? '못 받았습니다' : (query.data ?? '받는 중')}</p>;
};

const mount = (ask: () => Promise<string>, client: QueryClient) =>
  render(
    <QueryClientProvider client={client}>
      <Probe ask={ask} />
    </QueryClientProvider>,
  );

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
   * 끊긴 동안 나간 요청은 실패한 채로 멈춘다. 다시 답을 받아도 풀 계기가 없으면 화면이 값을 들고
   * 있으면서 연결을 확인하라고 말한다 - 자리를 옮기라는 뜻이라 멀쩡한 단말을 든 사람이
   * 헛되이 움직인다.
   */
  it('실패한 채로 멈춘 조회를 다시 받는다', async () => {
    let asked = 0;
    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, networkMode: 'always' } },
    });

    const ask = async () => {
      asked += 1;

      if (asked === 1) {
        throw new TypeError('Failed to fetch');
      }

      return '도착 L1-STG';
    };

    noteServerSilent();
    mount(ask, client);
    await settle();

    expect(await screen.findByText('못 받았습니다')).toBeTruthy();

    await act(async () => {
      noteServerAnswered();
      await settle();
    });

    expect(await screen.findByText('도착 L1-STG')).toBeTruthy();
    expect(asked).toBe(2);
  });

  /* 성공해 있는 것까지 부르면 망이 돌아올 때마다 화면 전부가 다시 조회를 낸다. */
  it('성공해 있던 조회는 다시 부르지 않는다', async () => {
    let asked = 0;
    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, networkMode: 'always' } },
    });

    const ask = async () => {
      asked += 1;
      return '도착 L1-STG';
    };

    mount(ask, client);
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
