import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { CreatedReceiptsPane, docStatusLabel, excessLinkPath } from './created-receipts-pane';
import type { CreatedReceiptView, CreatedResult } from './types';

const t = messages.overReceiptSplit;

const receipt = (no: string, overrides: Partial<CreatedReceiptView> = {}): CreatedReceiptView => ({
  inboundReceiptNo: no,
  statusCode: 'REGISTERED',
  ...overrides,
});

const RECEIPT = receipt('IR-2026-900010');

const renderPane = (result: CreatedResult): HTMLElement => {
  render(
    <MemoryRouter>
      <CreatedReceiptsPane result={result} />
    </MemoryRouter>,
  );

  return screen.getByRole('status', { name: t.panes.result });
};

describe('docStatusLabel', () => {
  it('코드 사전의 네 값은 번역하고 모르는 코드는 그대로다', () => {
    expect(docStatusLabel('REGISTERED')).toBe(t.values.docStatus.REGISTERED);
    expect(docStatusLabel('SAMPLE_IR_STATUS_B')).toBe('SAMPLE_IR_STATUS_B');
  });
});

describe('excessLinkPath — 초과분 연결 자리', () => {
  /* 연결은 「입하 예정 조회」가 연다 — `excess=1` 이 창을 열고 `excessReceipt` 가 방금 만든 전표를 앞에 세운다. */
  it('입하 예정 조회로 가고 연결 창과 방금 만든 전표를 싣는다', () => {
    const [pathname, query = ''] = excessLinkPath('IR-2026-900010').split('?');
    const params = new URLSearchParams(query);

    expect(pathname).toBe('/logistics/inbound-schedule');
    expect(params.get('excess')).toBe('1');
    expect(params.get('excessReceipt')).toBe('IR-2026-900010');
  });
});

describe('CreatedReceiptsPane', () => {
  it('만들어진 건수와 전표 번호, 번역된 상태를 낸다', () => {
    const pane = renderPane({ receipts: [RECEIPT], excessLines: [] });

    expect(within(pane).getByText(t.result.count(1))).toBeInTheDocument();
    expect(within(pane).getByText('IR-2026-900010')).toBeInTheDocument();
    expect(within(pane).getByText(t.values.docStatus.REGISTERED)).toBeInTheDocument();
  });

  it('모르는 상태 코드는 그대로 보인다', () => {
    const pane = renderPane({
      receipts: [receipt('IR-2026-900010', { statusCode: 'SAMPLE_IR_STATUS_B' })],
      excessLines: [],
    });

    expect(within(pane).getByText('SAMPLE_IR_STATUS_B')).toBeInTheDocument();
  });

  /* 초과 몫은 P/O 에 들어가지 않았다 — 그 사실과 연결할 자리를 결과 자리에서 함께 읽는다. */
  it('초과분을 실었으면 줄마다 몫을 밝히고 연결로 가는 링크를 세운다', () => {
    const pane = renderPane({
      receipts: [RECEIPT],
      excessLines: [
        { lineNo: 1, excessQty: 500 },
        { lineNo: 3, excessQty: 1200 },
      ],
    });

    expect(
      within(pane).getByText(
        t.result.excessWaiting(
          [
            t.result.excessLine(1, (500).toLocaleString()),
            t.result.excessLine(3, (1200).toLocaleString()),
          ].join(' · '),
        ),
      ),
    ).toBeInTheDocument();
    expect(within(pane).getByRole('link', { name: t.result.goLinkExcess })).toHaveAttribute(
      'href',
      excessLinkPath('IR-2026-900010'),
    );
  });

  it('초과분이 실리지 않은 등록에는 이동 경로가 없다', () => {
    const pane = renderPane({ receipts: [RECEIPT], excessLines: [] });

    expect(within(pane).queryAllByRole('link')).toHaveLength(0);
    expect(within(pane).queryByText(/P\/O 에 넣지 않았습니다/)).not.toBeInTheDocument();
  });
});
