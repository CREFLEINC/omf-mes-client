import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CreatedReceiptsPane } from './created-receipts-pane';
import type { CreatedReceiptView } from './types';

const t = messages.overReceiptSplit;

const receipt = (no: string, statusCode = 'SAMPLE_IR_STATUS_A'): CreatedReceiptView => ({
  inboundReceiptNo: no,
  statusCode,
});

describe('CreatedReceiptsPane', () => {
  /*
   * **M42** — 두 건이 만들어졌다는 것이 이 화면의 요점이다. 번호만 나열하면
   * 두 줄이 「한 전표의 두 표기」로 읽힐 수 있어 **건수를 함께** 밝힌다.
   */
  it('만들어진 건수를 밝힌다', () => {
    render(<CreatedReceiptsPane receipts={[receipt('IR-2026-900010'), receipt('IR-2026-900011')]} />);

    expect(screen.getByText(t.result.count(2))).toBeInTheDocument();
  });

  it('한 건일 때도 건수를 밝힌다', () => {
    render(<CreatedReceiptsPane receipts={[receipt('IR-2026-900010')]} />);

    expect(screen.getByText(t.result.count(1))).toBeInTheDocument();
  });

  it('전표 번호를 빠짐없이 낸다', () => {
    render(<CreatedReceiptsPane receipts={[receipt('IR-2026-900010'), receipt('IR-2026-900011')]} />);

    expect(screen.getByText('IR-2026-900010')).toBeInTheDocument();
    expect(screen.getByText('IR-2026-900011')).toBeInTheDocument();
  });

  /* 상태 코드는 **값으로 분기하지 않고** 그대로 보인다(공유계약 G-2). */
  it('상태 코드를 그대로 보인다', () => {
    render(<CreatedReceiptsPane receipts={[receipt('IR-2026-900010', 'SAMPLE_IR_STATUS_B')]} />);

    expect(screen.getByText('SAMPLE_IR_STATUS_B')).toBeInTheDocument();
  });

  /*
   * **응답이 어느 건이 정량분인지 알려 주지 않는다.** 순서로 추측해 라벨을 붙이면
   * 틀린 라벨이 되돌릴 수 없는 전표에 붙는다 — 모른다는 사실을 밝힌다.
   */
  it('어느 전표가 어느 쪽인지 추측하지 않는다', () => {
    render(<CreatedReceiptsPane receipts={[receipt('IR-2026-900010'), receipt('IR-2026-900011')]} />);

    const pane = screen.getByRole('status', { name: t.panes.result });

    expect(within(pane).getByText(t.result.unlabeled)).toBeInTheDocument();
    /* 짝 방향 — 번호는 실제로 보이는데 갈래 이름만 붙지 않는다. */
    expect(within(pane).getByText('IR-2026-900010')).toBeInTheDocument();
    expect(within(pane).queryByText(t.actions.registerNormalOnly)).not.toBeInTheDocument();
    expect(within(pane).queryByText(t.actions.registerExcessOnly)).not.toBeInTheDocument();
  });

  /*
   * **M40의 부품 몫** — 결과 구획에 내부 번호가 새지 않는다. 이 부품은 번호를 받지도 않지만
   * (`CreatedReceiptView`에 자리가 없다), 화면 자료를 손으로 만들어 넘기는 경로가 생겨도
   * 사람이 읽는 자리에는 번호가 나오지 않아야 한다.
   */
  it('사람이 읽는 자리에 내부 번호가 없다', () => {
    render(<CreatedReceiptsPane receipts={[receipt('IR-2026-900010')]} />);

    const pane = screen.getByRole('status', { name: t.panes.result });

    for (const id of ['9601', '9602']) {
      expect(pane.textContent ?? '').not.toContain(id);
    }
  });
});
