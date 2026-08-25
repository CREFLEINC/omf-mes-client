import { messages } from '@omf-mes/i18n';
import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import {
  INSPECTION_TYPE_GROUP,
  OVERALL_JUDGMENT_GROUP,
  useInspectionItemLookup,
  useInspectionProcessLookup,
  useInspectionTypeLookup,
  useOverallJudgmentLookup,
} from './lookups';

const page = (total: number) => ({ page: 1, size: 50, total });
const codeValue = (code: string, codeName: string, displayOrder: number, isActive = true) => ({
  codeValueId: displayOrder,
  codeGroupId: 1,
  code,
  codeName,
  displayOrder,
  isActive,
});

describe('검사실적 참조 조회', () => {
  it('계약 코드 그룹을 비활성 포함으로 조회하고 표시 순서와 빈 이름을 안전하게 옮긴다', async () => {
    const calls: URL[] = [];
    const fetch = createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/mdm/code-values',
        respond: (request) => {
          const url = new URL(request.url);
          calls.push(url);
          const group = url.searchParams.get('codeGroupCode');
          const items =
            group === INSPECTION_TYPE_GROUP
              ? [codeValue('PQC', '', 2), codeValue('IQC', '수입검사', 1, false)]
              : [codeValue('REJECTED', '불합격', 1)];
          return jsonResponse({ items, page: page(items.length) });
        },
      },
    ]);
    const { result } = renderHookWithProviders(
      () => ({ inspectionTypes: useInspectionTypeLookup(), judgments: useOverallJudgmentLookup() }),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.inspectionTypes.entries).toHaveLength(2);
      expect(result.current.judgments.entries).toHaveLength(1);
    });

    expect(result.current.inspectionTypes.entries).toEqual([
      { value: 'IQC', label: '수입검사', isActive: false },
      { value: 'PQC', label: messages.common.reference.unknown, isActive: true },
    ]);
    expect(
      calls.every(
        (url) =>
          url.searchParams.get('includeInactive') === 'true' &&
          [INSPECTION_TYPE_GROUP, OVERALL_JUDGMENT_GROUP].includes(
            url.searchParams.get('codeGroupCode') ?? '',
          ),
      ),
    ).toBe(true);
  });

  it('품목·공정을 좁힘 없이 조회하고 잘림과 비활성 상태를 보존한다', async () => {
    const calls: URL[] = [];
    const route = (path: string, items: unknown[], total: number): StubRoute => ({
      match: (request) => new URL(request.url).pathname === path,
      respond: (request) => {
        calls.push(new URL(request.url));
        return jsonResponse({ items, page: page(total) });
      },
    });
    const fetch = createStubFetch([
      route(
        '/mdm/items',
        [{ itemId: 101, itemCode: 'ITEM-101', itemName: '합성 품목', isActive: false }],
        2,
      ),
      route(
        '/mdm/processes',
        [
          {
            processId: 501,
            processCode: 'PROC-501',
            processName: '합성 공정',
            isActive: true,
          },
        ],
        1,
      ),
    ]);
    const { result } = renderHookWithProviders(
      () => ({ items: useInspectionItemLookup(), processes: useInspectionProcessLookup() }),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.items.entries).toHaveLength(1);
      expect(result.current.processes.entries).toHaveLength(1);
    });

    expect(result.current.items.entries[0]).toEqual({
      value: '101',
      label: 'ITEM-101 · 합성 품목',
      isActive: false,
    });
    expect(result.current.items.truncated).toBe(true);
    expect(result.current.processes.truncated).toBe(false);
    expect(calls.every((url) => url.searchParams.get('includeInactive') === 'true')).toBe(true);
    expect(calls.every((url) => url.searchParams.has('q') === false)).toBe(true);
  });

  it('조회 실패를 빈 정상 목록으로 뭉개지 않고 재시도 통로를 제공한다', async () => {
    const fetch = createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/mdm/items',
        respond: () => jsonResponse({ message: 'synthetic error' }, { status: 500 }),
      },
    ]);
    const { result } = renderHookWithProviders(() => useInspectionItemLookup(), { fetch });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.entries).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.refetch).toEqual(expect.any(Function));
  });
});
