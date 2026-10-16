import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import {
  automaticBomId,
  automaticRoutingId,
  isMasterCheckReady,
  MasterCheckPane,
} from './master-check-pane';
import type { BomRevisionFact, RoutingRevisionFact } from './reference-queries';

const bom = (bomId: number, isDefault = false): BomRevisionFact => ({
  bomId,
  parentItemId: 4101,
  bomCode: `BOM-SYN-${String(bomId)}`,
  bomVersion: bomId,
  statusCode: 'APPROVED',
  isDefault,
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  baseQty: 1,
  baseUomId: 5101,
});

const routing = (routingId: number, isDefault = false): RoutingRevisionFact => ({
  routingId,
  itemId: 4101,
  routingCode: `ROUTE-SYN-${String(routingId)}`,
  routingVersion: routingId,
  statusCode: 'APPROVED',
  isDefault,
  effectiveFrom: '2026-02-01',
  effectiveTo: '2026-12-31',
});

const reference = <T,>(items: readonly T[]) => ({
  items,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
});

const Harness = ({
  boms,
  routings,
}: {
  boms: readonly BomRevisionFact[];
  routings: readonly RoutingRevisionFact[];
}) => {
  const [bomId, setBomId] = useState('');
  const [routingId, setRoutingId] = useState('');
  const [routingReferences, setRoutingReferences] = useState(routings);
  return (
    <>
      <MasterCheckPane
        boms={reference(boms)}
        routings={reference(routingReferences)}
        bomId={bomId}
        routingId={routingId}
        onBomChange={setBomId}
        onRoutingChange={setRoutingId}
      />
      <button onClick={() => setRoutingReferences((items) => [...items].reverse())}>
        Routing 참조 갱신
      </button>
    </>
  );
};

describe('생산계획 마스터 점검', () => {
  it('BOM과 Routing을 같은 비중의 비교 카드 묶음으로 표시한다', async () => {
    const { container } = renderWithProviders(
      <Harness boms={[bom(701, true)]} routings={[routing(801)]} />,
    );

    await waitFor(() => expect(screen.getAllByText('선택됨')).toHaveLength(2));
    const pane = screen.getByLabelText('마스터 점검');
    const grid = container.querySelector('.production-plan-master-grid');

    expect(pane).toHaveClass('production-plan-section');
    expect(within(pane).getByRole('heading', { name: '마스터 점검' }).parentElement).toHaveClass(
      'production-plan-section-heading',
    );
    expect(grid).not.toBeNull();
    expect(grid?.children).toHaveLength(2);
    expect(within(pane).getByRole('heading', { name: 'BOM (ERP 정본)' }).parentElement).toHaveClass(
      'production-plan-master-card-header',
    );
    expect(
      within(pane).getByRole('heading', { name: 'Routing (MES 정본)' }).parentElement,
    ).toHaveClass('production-plan-master-card-header');
  });

  it('유일한 기본 BOM과 유일한 Routing만 자동 선택해 준비 상태로 만든다', async () => {
    const boms = [bom(701), bom(702, true)];
    const routings = [routing(801)];
    renderWithProviders(<Harness boms={boms} routings={routings} />);

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'BOM Rev' })).toHaveTextContent('BOM-SYN-702'),
    );
    expect(screen.getByRole('combobox', { name: 'Routing Rev' })).toHaveTextContent(
      'ROUTE-SYN-801',
    );
    expect(screen.getAllByText('선택됨')).toHaveLength(2);
    expect(screen.getByText('기본 BOM Rev를 자동으로 선택했습니다.')).toBeVisible();
    expect(isMasterCheckReady(boms, routings, '702', '801')).toBe(true);
    expect(automaticBomId(boms)).toBe(702);
    expect(automaticRoutingId(routings)).toBe(801);
  });

  it('Routing 후보가 여럿이어도 기본 Rev 하나를 자동 선택하고 경고하지 않는다 (#91 · F-35)', async () => {
    const routings = [routing(802), routing(801, true)];
    renderWithProviders(<Harness boms={[bom(701, true)]} routings={routings} />);

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Routing Rev' })).toHaveTextContent(
        'ROUTE-SYN-801',
      ),
    );
    expect(automaticRoutingId(routings)).toBe(801);
    expect(screen.queryByText(/기본 Rev가 없습니다/)).not.toBeInTheDocument();
  });

  it('Routing 후보가 여럿이고 기본 Rev 가 없으면 자동 선택하지 않고 사용자의 선택을 새 응답에서도 보존한다', async () => {
    const user = userEvent.setup();
    const boms = [bom(701, true)];
    const routings = [routing(801), routing(802)];
    renderWithProviders(<Harness boms={boms} routings={routings} />);

    expect(
      await screen.findByText(
        '사용할 수 있는 Routing 개정 중 기본 Rev가 없습니다. 사용할 개정을 직접 선택하세요.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Routing Rev' })).toHaveTextContent(
      '사용할 개정을 선택하세요',
    );
    expect(automaticRoutingId(routings)).toBeNull();

    await user.click(screen.getByRole('combobox', { name: 'Routing Rev' }));
    await user.click(screen.getByRole('option', { name: /ROUTE-SYN-802/ }));
    expect(screen.getByRole('combobox', { name: 'Routing Rev' })).toHaveTextContent(
      'ROUTE-SYN-802',
    );

    await user.click(screen.getByRole('button', { name: 'Routing 참조 갱신' }));
    expect(screen.getByRole('combobox', { name: 'Routing Rev' })).toHaveTextContent(
      'ROUTE-SYN-802',
    );
  });

  it('기본 플래그가 없는 단일 BOM도 자동 선택하지 않는다', async () => {
    const boms = [bom(701)];
    renderWithProviders(<Harness boms={boms} routings={[routing(801)]} />);

    expect(await screen.findByText('기본 BOM Rev를 하나로 판단할 수 없습니다.')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'BOM Rev' })).toHaveTextContent(
      '사용할 개정을 선택하세요',
    );
    expect(automaticBomId(boms)).toBeNull();
  });

  it('BOM·Routing 부재를 각각 차단하고 Routing 등록 경로만 제공한다', () => {
    renderWithProviders(
      <MasterCheckPane
        boms={reference([])}
        routings={reference([])}
        bomId=""
        routingId=""
        onBomChange={vi.fn()}
        onRoutingChange={vi.fn()}
      />,
    );

    expect(screen.getByText('BOM이 없어 전개할 수 없습니다.')).toBeVisible();
    expect(
      screen.getByText('확정되고 유효 기간 안인 Routing이 없어 전개할 수 없습니다.'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Routing 등록으로 이동' })).toHaveAttribute(
      'href',
      '/master-data/routing',
    );
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('두 참조 실패를 섞지 않고 각 요청만 다시 시도한다', async () => {
    const user = userEvent.setup();
    const retryBom = vi.fn();
    const retryRouting = vi.fn();
    renderWithProviders(
      <MasterCheckPane
        boms={{ ...reference([]), isError: true, refetch: retryBom }}
        routings={{ ...reference([]), isError: true, refetch: retryRouting }}
        bomId=""
        routingId=""
        onBomChange={vi.fn()}
        onRoutingChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'BOM 다시 시도' }));
    expect(retryBom).toHaveBeenCalledTimes(1);
    expect(retryRouting).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Routing 다시 시도' }));
    expect(retryRouting).toHaveBeenCalledTimes(1);
  });
});
