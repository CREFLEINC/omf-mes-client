import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { DEFECT_WINDOW_DAYS } from './repair';
import { useDefectRecords, useOpenRepairs } from './queries';

const page = { page: 0, size: 20, totalElements: 0, totalPages: 1 };

const capturing = (pathname: string, body: unknown, seen: URL[]): StubRoute => ({
  match: (request) => new URL(request.url).pathname === pathname,
  respond: (request) => {
    seen.push(new URL(request.url));
    return jsonResponse(body);
  },
});

describe('불량 기록 조회', () => {
  it('이 LOT 으로 좁혀 묻는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch([capturing('/quality/defect-records', { items: [], page }, seen)]);

    const { result } = renderHookWithProviders(() => useDefectRecords(4), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(seen[0]?.searchParams.get('lotId')).toBe('4');
  });

  /* 계약이 기간을 비울 수 없게 해 두었다. 빠뜨리면 서버가 요청 자체를 받지 않는다. */
  it('기간을 비우지 않고 정해진 길이만큼 거슬러 묻는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch([capturing('/quality/defect-records', { items: [], page }, seen)]);

    const { result } = renderHookWithProviders(() => useDefectRecords(4), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const from = seen[0]?.searchParams.get('detectedFrom');
    const to = seen[0]?.searchParams.get('detectedTo');

    expect(from).not.toBeNull();
    expect(to).not.toBeNull();

    const days = (Date.parse(String(to)) - Date.parse(String(from))) / (24 * 60 * 60 * 1000);

    expect(Math.round(days)).toBe(DEFECT_WINDOW_DAYS + 1);
  });

  it('LOT 을 찾기 전에는 묻지 않는다', () => {
    const fetch = createStubFetch([]);

    const { result } = renderHookWithProviders(() => useDefectRecords(null), { fetch });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('열린 수리 건 조회', () => {
  /* 받아 놓고 화면이 거르면 쪽 안에서만 걸러진다. 서버에 열린 것만 달라고 한다. */
  it('열린 것만 달라고 묻는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch([
      capturing('/production/repair-executions', { items: [], page }, seen),
    ]);

    const { result } = renderHookWithProviders(() => useOpenRepairs(), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(seen[0]?.searchParams.get('open')).toBe('true');
    expect(seen[0]?.searchParams.get('lotId')).toBeNull();
  });

  it('LOT 을 주면 그 LOT 으로도 좁힌다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch([
      capturing('/production/repair-executions', { items: [], page }, seen),
    ]);

    const { result } = renderHookWithProviders(() => useOpenRepairs(4), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(seen[0]?.searchParams.get('open')).toBe('true');
    expect(seen[0]?.searchParams.get('lotId')).toBe('4');
  });
});
