import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  renderWithProviders,
} from '../../test/api-harness';
import { useWarehouseOptions, type LookupResult, type TerminalCodeNames } from './lookups';
import { TerminalProcessMapScreen } from './screen';
import { EMPTY_TERMINAL, toCreateBody, toTerminalDraft, toUpdateBody } from './terminal-draft';
import { TerminalForm } from './terminal-form';
import { toTerminalView } from './types';

const t = messages.terminalProcessMap;
const path = (request: Request): string => new URL(request.url).pathname;
const page = (items: unknown[]) => ({ items, page: { page: 1, size: 100, total: items.length } });

const warehouse = (warehouseId: number, plantId: number, code: string, name: string) => ({
  warehouseId,
  plantId,
  businessUnitId: 1,
  warehouseCode: code,
  warehouseName: name,
  warehouseTypeCode: 'RAW',
  managementLevelCode: 'LOCATION',
  isExternal: false,
  isDefect: false,
  isActive: true,
});

/* 공장 질의를 모르는 서버처럼 두 공장의 창고를 함께 낸다 — 화면이 다시 걸러야 한다. */
const WAREHOUSES = [
  warehouse(11, 1, 'A01', '합성 자재창고 A'),
  warehouse(12, 1, 'P01', '합성 제품창고 P'),
  warehouse(21, 2, 'B01', '다른 공장 창고'),
  { ...warehouse(13, 1, 'X01', '중지 창고'), isActive: false },
];

const lookup = (entries: LookupResult['entries']): LookupResult => ({
  entries,
  truncated: false,
  isError: false,
  error: null,
  isLoading: false,
  refetch: vi.fn(),
});

const noCodes: TerminalCodeNames = (() => {
  const empty = { nameOf: (code: string) => code, entries: [] };
  return { type: empty.nameOf, status: empty.nameOf, typeLookup: empty, statusLookup: empty };
})();

describe('W-CO-06 단말 창고(피처 002)', () => {
  it('US5-1 창고 선택지는 단말 공장의 사용 중인 창고만이고 공장 질의를 싣는다', async () => {
    const queries: URL[] = [];
    const { result } = renderHookWithProviders(() => useWarehouseOptions('1'), {
      fetch: createStubFetch([
        {
          match: (request) => path(request) === '/mdm/warehouses',
          respond: (request) => {
            queries.push(new URL(request.url));
            return jsonResponse(page(WAREHOUSES));
          },
        },
      ]),
    });

    await waitFor(() => expect(result.current.entries).toHaveLength(2));
    expect(result.current.entries.map((entry) => entry.label)).toEqual([
      'A01 합성 자재창고 A',
      'P01 합성 제품창고 P',
    ]);
    expect(queries[0]?.searchParams.get('plantId')).toBe('1');
  });

  it('공장을 고르기 전에는 창고 조회를 하지 않는다', () => {
    const fetch = vi.fn();
    const { result } = renderHookWithProviders(() => useWarehouseOptions(''), { fetch });

    expect(result.current.entries).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('US5-1 폼에 「공장 전체 (지정 안 함)」 맨 위 창고 칸과 기준 안내가 서고, 공장을 바꾸면 창고를 비운다', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <TerminalForm
        draft={{ ...EMPTY_TERMINAL, plant: '1', warehouse: '11', statusCode: 'RUNNING' }}
        errors={{}}
        isNew={false}
        isSaving={false}
        saveError={null}
        fieldErrors={{}}
        plants={lookup([
          { value: '1', label: 'G1 합성 1공장', isActive: true },
          { value: '2', label: 'G2 합성 2공장', isActive: true },
        ])}
        equipments={lookup([])}
        warehouses={lookup([
          { value: '11', label: 'A01 합성 자재창고 A', isActive: true },
          { value: '12', label: 'P01 합성 제품창고 P', isActive: true },
        ])}
        codeNames={noCodes}
        onChange={onChange}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(t.terminal.warehouseGuide)).toBeInTheDocument();
    expect(screen.queryByText('설치 위치를 설정하려면 먼저 창고를 선택해 주세요.')).toBeNull();

    await user.click(screen.getByRole('combobox', { name: t.terminal.warehouse }));
    const options = within(await screen.findByRole('listbox')).getAllByRole('option');
    expect(options[0]).toHaveTextContent(t.terminal.warehouseAll);
    expect(options).toHaveLength(3);
    await user.click(options[2] as HTMLElement);
    expect(onChange).toHaveBeenLastCalledWith({ warehouse: '12' });

    await user.click(screen.getByRole('combobox', { name: t.terminal.plant }));
    await user.click(await screen.findByRole('option', { name: 'G2 합성 2공장' }));
    expect(onChange).toHaveBeenLastCalledWith({ plant: '2', warehouse: '' });
  });

  it('공장을 고르기 전에는 창고 칸이 잠기고 사유를 보인다', () => {
    renderWithProviders(
      <TerminalForm
        draft={{ ...EMPTY_TERMINAL }}
        errors={{}}
        isNew
        isSaving={false}
        saveError={null}
        fieldErrors={{}}
        plants={lookup([])}
        equipments={lookup([])}
        codeNames={noCodes}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('combobox', { name: t.terminal.warehouse })).toBeDisabled();
    expect(screen.getByText(t.terminal.warehouseNeedsPlant)).toBeInTheDocument();
  });

  it('US5-1 저장 본문 — 등록은 고르면 warehouseId, 수정은 비우면 null 로 뗀다', () => {
    const filled = {
      ...EMPTY_TERMINAL,
      terminalCode: 'SYN-MOB',
      plant: '1',
      terminalTypeCode: 'MOBILE',
    };

    expect(toCreateBody({ ...filled, warehouse: '11' }).warehouseId).toBe(11);
    expect('warehouseId' in toCreateBody(filled)).toBe(false);
    expect(toUpdateBody({ ...filled, statusCode: 'RUNNING', warehouse: '12' }).warehouseId).toBe(
      12,
    );
    expect(toUpdateBody({ ...filled, statusCode: 'RUNNING' }).warehouseId).toBeNull();
  });

  it('US5-1 응답의 창고를 폼과 목록 값으로 옮긴다 — 없으면 공장 전체', () => {
    const base = {
      terminalId: 1,
      terminalCode: 'SYN-MOB',
      plantId: 1,
      terminalTypeCode: 'MOBILE',
      statusCode: 'RUNNING',
      isActive: true,
      versionNo: 1,
    };
    const view = toTerminalView({ ...base, warehouseId: 11, warehouseName: '합성 자재창고 A' });
    expect(view.warehouseName).toBe('합성 자재창고 A');
    expect(toTerminalDraft(view).warehouse).toBe('11');

    const plain = toTerminalView(base);
    expect(plain.warehouseId).toBeNull();
    expect(toTerminalDraft(plain).warehouse).toBe('');
  });

  it('US5-1 단말 목록에 「창고」 열 — 없으면 「공장 전체」', async () => {
    const terminals = [
      {
        terminalId: 1,
        terminalCode: 'SYN-MOB-01',
        warehouseId: 11,
        warehouseName: '합성 자재창고 A',
      },
      { terminalId: 2, terminalCode: 'SYN-MOB-02' },
    ].map((row) => ({
      plantId: 1,
      terminalTypeCode: 'MOBILE',
      statusCode: 'RUNNING',
      registrationStatusCode: 'REGISTERED',
      isActive: true,
      versionNo: 1,
      ...row,
    }));
    renderWithProviders(<TerminalProcessMapScreen />, {
      fetch: createStubFetch([
        {
          match: (request) => path(request) === '/mdm/terminals',
          respond: () => jsonResponse(page(terminals)),
        },
        {
          match: (request) => path(request) === '/mdm/code-values',
          respond: () => jsonResponse(page([])),
        },
        {
          match: (request) =>
            ['/mdm/plants', '/mdm/equipments', '/mdm/processes'].includes(path(request)),
          respond: () => jsonResponse(page([])),
        },
      ]),
      route: '/system/terminal-process-map',
    });

    expect(await screen.findByRole('columnheader', { name: t.list.warehouse })).toBeInTheDocument();
    const first = (await screen.findByRole('button', { name: 'SYN-MOB-01' })).closest('tr');
    const second = screen.getByRole('button', { name: 'SYN-MOB-02' }).closest('tr');
    expect(within(first as HTMLElement).getByText('합성 자재창고 A')).toBeInTheDocument();
    expect(within(second as HTMLElement).getByText(t.list.warehouseAll)).toBeInTheDocument();
  });
});
