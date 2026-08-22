import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { useProductionOrderResync } from './resync';

const RESYNC_PATH = '/planning/production-orders/7101:resync';

interface RecordedRequest {
  method: string;
  url: URL;
  body: string;
  headers: Headers;
}

const resyncRoute = (respond: (request: Request) => Response): StubRoute => ({
  match: (request) => new URL(request.url).pathname === RESYNC_PATH,
  respond,
});

const createRecordingFetch = (
  routes: StubRoute[],
): { fetch: StubFetch; requests: RecordedRequest[] } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes);

  const fetch: StubFetch = async (request) => {
    requests.push({
      method: request.method,
      url: new URL(request.url),
      body: await request.clone().text(),
      headers: request.headers,
    });

    return stub(request);
  };

  return { fetch, requests };
};

const createSecondAttemptPendingFetch = (
  firstResponse = new Response(null, { status: 202 }),
): {
  fetch: StubFetch;
  requests: RecordedRequest[];
  release: () => void;
} => {
  const requests: RecordedRequest[] = [];
  let release = (): void => {
    /* The Promise constructor assigns the resolver below. */
  };
  const secondResponse = new Promise<Response>((resolve) => {
    release = () => resolve(new Response(null, { status: 202 }));
  });

  const fetch: StubFetch = async (request) => {
    requests.push({
      method: request.method,
      url: new URL(request.url),
      body: await request.clone().text(),
      headers: request.headers,
    });

    return requests.length === 1 ? firstResponse : secondResponse;
  };

  return { fetch, requests, release };
};

describe('useProductionOrderResync — request contract', () => {
  it('sends the exact no-body resync request with only an idempotency key', async () => {
    const recording = createRecordingFetch([
      resyncRoute(() => new Response(null, { status: 202 })),
    ]);
    const { result } = renderHookWithProviders(() => useProductionOrderResync(7101), {
      fetch: recording.fetch,
    });

    act(() => {
      result.current.requestResync();
    });

    await waitFor(() => {
      expect(recording.requests).toHaveLength(1);
    });

    const request = recording.requests[0];

    expect(request?.method).toBe('POST');
    expect(request?.url.pathname).toBe(RESYNC_PATH);
    expect(request?.url.search).toBe('');
    expect(request?.body).toBe('');
    expect(request?.headers.get('Idempotency-Key')).toMatch(/\S/);
    expect(request?.headers.get('If-Match')).toBeNull();
  });
});

describe('useProductionOrderResync — accepted request', () => {
  it('reads a no-content 202 as accepted and gives each settled attempt a new key', async () => {
    const recording = createRecordingFetch([
      resyncRoute(() => new Response(null, { status: 202 })),
    ]);
    const { result } = renderHookWithProviders(() => useProductionOrderResync(7101), {
      fetch: recording.fetch,
    });

    act(() => {
      result.current.requestResync();
    });

    await waitFor(() => {
      expect(result.current.isAccepted).toBe(true);
    });

    expect(result.current).not.toHaveProperty('data');
    expect(result.current).not.toHaveProperty('result');

    act(() => {
      result.current.requestResync();
    });

    await waitFor(() => {
      expect(recording.requests).toHaveLength(2);
    });

    expect(recording.requests[0]?.headers.get('Idempotency-Key')).toMatch(/\S/);
    expect(recording.requests[1]?.headers.get('Idempotency-Key')).toMatch(/\S/);
    expect(recording.requests[1]?.headers.get('Idempotency-Key')).not.toBe(
      recording.requests[0]?.headers.get('Idempotency-Key'),
    );
  });
});

describe('useProductionOrderResync — rejected request', () => {
  it.each([403, 404])(
    'keeps HTTP %i as a normalized error instead of acceptance',
    async (status) => {
      const recording = createRecordingFetch([
        resyncRoute(() => jsonResponse({ message: `synthetic ${status}` }, { status })),
      ]);
      const { result } = renderHookWithProviders(() => useProductionOrderResync(7101), {
        fetch: recording.fetch,
      });

      act(() => {
        result.current.requestResync();
      });

      await waitFor(() => {
        expect(result.current.error).toEqual({
          kind: 'http',
          status,
          message: `synthetic ${status}`,
        });
      });

      expect(result.current.isAccepted).toBe(false);
    },
  );

  it('keeps a network rejection as a normalized error instead of acceptance', async () => {
    const recording = createRecordingFetch([
      resyncRoute(() => {
        throw new Error('synthetic network rejection');
      }),
    ]);
    const { result } = renderHookWithProviders(() => useProductionOrderResync(7101), {
      fetch: recording.fetch,
    });

    act(() => {
      result.current.requestResync();
    });

    await waitFor(() => {
      expect(result.current.error).toEqual({ kind: 'network' });
    });

    expect(result.current.isAccepted).toBe(false);
  });

  it('clears a settled error when a new explicit attempt starts', async () => {
    const recording = createSecondAttemptPendingFetch(
      jsonResponse({ message: 'synthetic forbidden' }, { status: 403 }),
    );
    const { result } = renderHookWithProviders(() => useProductionOrderResync(7101), {
      fetch: recording.fetch,
    });

    act(() => {
      result.current.requestResync();
    });
    await waitFor(() => {
      expect(result.current.error).toEqual({
        kind: 'http',
        status: 403,
        message: 'synthetic forbidden',
      });
    });

    act(() => {
      result.current.requestResync();
    });
    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    expect(result.current.error).toBeNull();

    act(() => {
      recording.release();
    });
  });
});

describe('useProductionOrderResync — pending request and reset', () => {
  it('blocks same-render re-entry and leaves a pending request untouched by reset', async () => {
    const recording = createSecondAttemptPendingFetch();
    const { result } = renderHookWithProviders(() => useProductionOrderResync(7101), {
      fetch: recording.fetch,
    });

    act(() => {
      result.current.requestResync();
    });
    await waitFor(() => {
      expect(result.current.isAccepted).toBe(true);
    });

    act(() => {
      result.current.requestResync();
      result.current.requestResync();
    });
    await waitFor(() => {
      expect(recording.requests).toHaveLength(2);
      expect(result.current.isPending).toBe(true);
    });

    expect(result.current.isAccepted).toBe(false);

    act(() => {
      result.current.resetIfIdle();
    });

    expect(result.current.isPending).toBe(true);

    act(() => {
      recording.release();
    });
    await waitFor(() => {
      expect(result.current.isAccepted).toBe(true);
    });

    act(() => {
      result.current.resetIfIdle();
    });

    expect(result.current.isAccepted).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
