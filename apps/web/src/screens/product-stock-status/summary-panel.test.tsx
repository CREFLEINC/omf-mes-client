import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SummaryPanel } from './summary-panel';

const t = messages.productStockStatus.summary;

describe('SummaryPanel', () => {
  it('다섯 칸 전부 불러올 수 없음 표식을 낸다 — 목록을 받아 세지 않는다', () => {
    render(<SummaryPanel />);

    expect(screen.getAllByText(t.unavailableMark)).toHaveLength(5);
  });

  it('무엇을 왜 못 받는지 안내한다', () => {
    render(<SummaryPanel />);

    expect(screen.getByText(t.unavailable)).toBeInTheDocument();
  });

  it('다섯 칸의 라벨을 낸다', () => {
    render(<SummaryPanel />);

    expect(screen.getByText(t.itemCount)).toBeInTheDocument();
    expect(screen.getByText(t.lotCount)).toBeInTheDocument();
    expect(screen.getByText(t.onHandQty)).toBeInTheDocument();
    expect(screen.getByText(t.availableQty)).toBeInTheDocument();
    expect(screen.getByText(t.blockedQty)).toBeInTheDocument();
  });
});
