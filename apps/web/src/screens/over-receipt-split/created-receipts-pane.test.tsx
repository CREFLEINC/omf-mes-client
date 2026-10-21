import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { CreatedReceiptsPane, docStatusLabel, partOf } from './created-receipts-pane';
import type { CreatedReceiptView, SplitMode } from './types';

const t = messages.overReceiptSplit;

const receipt = (no: string, overrides: Partial<CreatedReceiptView> = {}): CreatedReceiptView => ({
  inboundReceiptId: 9601,
  inboundReceiptNo: no,
  statusCode: 'REGISTERED',
  exceptionTypeCode: null,
  ...overrides,
});

const NORMAL = receipt('IR-2026-900010');
const EXCESS = receipt('IR-2026-900011', {
  inboundReceiptId: 9602,
  exceptionTypeCode: 'OVER_DELIVERY',
});

const renderPane = (receipts: CreatedReceiptView[], mode: SplitMode = 'BOTH'): HTMLElement => {
  render(
    <MemoryRouter>
      <CreatedReceiptsPane receipts={receipts} mode={mode} />
    </MemoryRouter>,
  );

  return screen.getByRole('status', { name: t.panes.result });
};

describe('partOf — 어느 전표가 초과분인가', () => {
  it('예외 유형이 실린 전표가 초과분이다', () => {
    expect(partOf(EXCESS, 'BOTH')).toBe('excess');
    expect(partOf(NORMAL, 'BOTH')).toBe('normal');
  });

  /* 유형이 없어도 초과분만 저장한 갈래면 전부 초과분이다 — 고객이 유형을 비운 경우. */
  it('유형이 없으면 갈래로 본다', () => {
    expect(partOf(NORMAL, 'EXCESS_ONLY')).toBe('excess');
    expect(partOf(NORMAL, 'NORMAL_ONLY')).toBe('normal');
  });
});

describe('docStatusLabel', () => {
  it('코드 사전의 네 값은 번역하고 모르는 코드는 그대로다', () => {
    expect(docStatusLabel('REGISTERED')).toBe(t.values.docStatus.REGISTERED);
    expect(docStatusLabel('SAMPLE_IR_STATUS_B')).toBe('SAMPLE_IR_STATUS_B');
  });
});

describe('CreatedReceiptsPane', () => {
  it('만들어진 건수와 전표 번호를 빠짐없이 낸다', () => {
    const pane = renderPane([NORMAL, EXCESS]);

    expect(within(pane).getByText(t.result.count(2))).toBeInTheDocument();
    expect(within(pane).getByText('IR-2026-900010')).toBeInTheDocument();
    expect(within(pane).getByText('IR-2026-900011')).toBeInTheDocument();
  });

  it('전표마다 정량분·초과분 구분과 번역된 상태가 붙는다', () => {
    const pane = renderPane([NORMAL, EXCESS]);

    expect(within(pane).getByText(t.values.partNormal)).toBeInTheDocument();
    expect(within(pane).getByText(t.values.partExcess)).toBeInTheDocument();
    expect(within(pane).getAllByText(t.values.docStatus.REGISTERED)).toHaveLength(2);
  });

  it('모르는 상태 코드는 그대로 보인다', () => {
    const pane = renderPane([receipt('IR-2026-900010', { statusCode: 'SAMPLE_IR_STATUS_B' })]);

    expect(within(pane).getByText('SAMPLE_IR_STATUS_B')).toBeInTheDocument();
  });

  /* 정산할 것은 초과분이다 — 정량분 전표에 신규 P/O 등록 길이 서면 정량분을 정산하는 것으로 읽힌다. */
  it('다음 화면으로 가는 링크는 초과분 전표에만 선다', () => {
    const pane = renderPane([NORMAL, EXCESS]);

    expect(within(pane).getAllByRole('link')).toHaveLength(1);
    expect(
      within(pane).getByRole('link', { name: t.result.registerPo('IR-2026-900011') }),
    ).toHaveAttribute('href', '/logistics/po-register?receipt=9602');
  });

  it('초과분이 실리지 않은 등록에는 이동 경로가 없다', () => {
    const pane = renderPane([NORMAL], 'NORMAL_ONLY');

    expect(within(pane).queryAllByRole('link')).toHaveLength(0);
  });

  it('사람이 읽는 자리에 내부 번호가 없다', () => {
    const pane = renderPane([NORMAL, EXCESS]);

    for (const id of ['9601', '9602']) {
      expect(pane.textContent ?? '').not.toContain(id);
    }
  });
});
