import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DetailPane, type DetailPaneProps } from './detail-pane';
import type { DispositionLookup } from './lookups';
import type { NonconformanceDetailView } from './types';

const t = messages.dispositionDecision;

const lookup = (entries: { value: string; label: string }[]): DispositionLookup => ({
  entries: entries.map((entry) => ({ ...entry, isActive: true })),
  truncated: false,
  isError: false,
  isLoading: false,
});

const view = (overrides: Partial<NonconformanceDetailView> = {}): NonconformanceDetailView => ({
  nonconformanceNo: 'NC-TEST-0042',
  itemId: 5001,
  severityCode: 'CODE-B',
  statusCode: 'CODE-C',
  openedAtText: '2026-08-12 09:30',
  description: '도장 표면 박리',
  lots: [
    {
      nonconformanceLotId: 9001,
      lotId: 8001,
      lotNoText: 'LOT-TEST-0088',
      affectedQtyText: '320',
      uomId: 7001,
      qualityStatusText: 'CODE-D → CODE-E',
    },
  ],
  ...overrides,
});

const baseProps = (): DetailPaneProps => ({
  view: view(),
  items: lookup([{ value: '5001', label: 'SYNTH-ITEM-1 · 합성 품목' }]),
  uoms: lookup([{ value: '7001', label: 'EA' }]),
  severity: lookup([{ value: 'CODE-B', label: '합성 심각도 B' }]),
  status: lookup([{ value: 'CODE-C', label: '합성 상태 C' }]),
});

const renderPane = (overrides: Partial<DetailPaneProps> = {}) =>
  render(<DetailPane {...baseProps()} {...overrides} />);

describe('DetailPane', () => {
  it('부적합 개요와 설명을 보인다', () => {
    renderPane();

    expect(screen.getByText('NC-TEST-0042')).toBeInTheDocument();
    expect(screen.getByText('도장 표면 박리')).toBeInTheDocument();
    expect(screen.getByText('SYNTH-ITEM-1 · 합성 품목')).toBeInTheDocument();
  });

  it('대상 LOT을 단위 이름과 함께 보인다', () => {
    renderPane();

    expect(screen.getByText('LOT-TEST-0088')).toBeInTheDocument();
    expect(screen.getByText('EA')).toBeInTheDocument();
    expect(screen.getByText('CODE-D → CODE-E')).toBeInTheDocument();
  });

  it('⚠ LOT 상태 전이가 이력에 남지 않는다는 사실을 표 머리에 적는다(A-11)', () => {
    renderPane();

    expect(screen.getByText(t.detail.transitionHistoryUnavailable)).toBeInTheDocument();
  });

  it('대상 LOT이 없으면 빈 상태를 보인다', () => {
    renderPane({ view: view({ lots: [] }) });

    expect(screen.getByText(t.detail.noLots)).toBeInTheDocument();
  });

  it('⛔ 부적합을 고치는 컨트롤을 두지 않는다 — 등록·수정은 다른 화면이 한다', () => {
    renderPane();

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('심각도·상태는 공통코드 이름으로 보이고, 이름이 없으면 코드를 그대로 보인다(G-32 · G-9)', () => {
    const coded = { ...view(), severityCode: 'CODE-B', statusCode: 'CODE-C' };
    const { unmount } = renderPane({ view: coded });
    expect(screen.getByText('합성 심각도 B')).toBeInTheDocument();
    expect(screen.getByText('합성 상태 C')).toBeInTheDocument();
    unmount();

    renderPane({ view: coded, severity: lookup([]), status: lookup([]) });
    expect(screen.getByText('CODE-B')).toBeInTheDocument();
    expect(screen.getByText('CODE-C')).toBeInTheDocument();
  });
});
