import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../test/api-harness';
import { useCodeValues } from './code-values';

const page = { page: 0, size: 20, totalElements: 0, totalPages: 1 };

const capturing = (pathname: string, body: unknown, seen: URL[]): StubRoute => ({
  match: (request) => new URL(request.url).pathname === pathname,
  respond: (request) => {
    seen.push(new URL(request.url));
    return jsonResponse(body);
  },
});

const codeValue = (overrides: Record<string, unknown>) => ({
  codeValueId: 1,
  codeGroupId: 5,
  code: 'NO_PO',
  codeName: '무발주',
  displayOrder: 1,
  isActive: true,
  ...overrides,
});

describe('공통코드 조회', () => {
  it('그룹 코드로 묻는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch([capturing('/mdm/code-values', { items: [], page }, seen)]);

    const { result } = renderHookWithProviders(() => useCodeValues('NO_PO_GROUP'), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(seen[0]?.searchParams.get('codeGroupCode')).toBe('NO_PO_GROUP');
  });

  /* 쓰지 않는 값을 새 입력의 선택지로 내면 서버가 받지 않는 값을 고르게 된다. */
  it('쓰지 않는 값을 선택지에서 뺀다', async () => {
    const fetch = createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/mdm/code-values',
        respond: () =>
          jsonResponse({
            items: [
              codeValue({ code: 'OLD', codeName: '폐지', isActive: false }),
              codeValue({ code: 'NO_PO', displayOrder: 2 }),
            ],
            page,
          }),
      },
    ]);

    const { result } = renderHookWithProviders(() => useCodeValues('G'), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.map((each) => each.code)).toEqual(['NO_PO']);
  });

  it('마스터가 정한 표시 순서를 따른다', async () => {
    const fetch = createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/mdm/code-values',
        respond: () =>
          jsonResponse({
            items: [
              codeValue({ code: 'B', displayOrder: 2 }),
              codeValue({ code: 'A', displayOrder: 1 }),
            ],
            page,
          }),
      },
    ]);

    const { result } = renderHookWithProviders(() => useCodeValues('G'), { fetch });

    await waitFor(() => {
      expect(result.current.data?.map((each) => each.code)).toEqual(['A', 'B']);
    });
  });

  /* 한국어 이름이 따로 있으면 그것을 쓴다. 없으면 기본 이름으로 물러난다. */
  it('한국어 이름이 있으면 그것을 보인다', async () => {
    const fetch = createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/mdm/code-values',
        respond: () =>
          jsonResponse({
            items: [codeValue({ codeName: 'No PO', nameKo: '무발주 도착' })],
            page,
          }),
      },
    ]);

    const { result } = renderHookWithProviders(() => useCodeValues('G'), { fetch });

    await waitFor(() => {
      expect(result.current.data?.[0]?.name).toBe('무발주 도착');
    });
  });
});
