import { createApiClient, type ApiClient } from '@omf-mes/api-client';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ApiClientProvider, useApiClient } from './api-context';

const stubClient = (): ApiClient =>
  createApiClient({
    baseUrl: 'http://api.test',
    fetch: async () => new Response(null, { status: 200 }),
  });

const ClientProbe = () => {
  const client = useApiClient();
  return <p>{typeof client.etags.ifMatch === 'function' ? '연결됨' : '없음'}</p>;
};

describe('useApiClient', () => {
  it('프로바이더 안에서는 주입된 클라이언트를 돌려준다', () => {
    render(
      <ApiClientProvider client={stubClient()}>
        <ClientProbe />
      </ApiClientProvider>,
    );

    expect(screen.getByText('연결됨')).toBeInTheDocument();
  });

  it('프로바이더 밖에서 부르면 오류를 던진다 — 조용히 빈 클라이언트로 돌지 않는다', () => {
    expect(() => render(<ClientProbe />)).toThrow(/ApiClientProvider/);
  });
});
