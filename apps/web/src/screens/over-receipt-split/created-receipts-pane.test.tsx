import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { CreatedReceiptsPane } from './created-receipts-pane';
import type { CreatedReceiptView } from './types';

const t = messages.overReceiptSplit;

/**
 * 내부 번호는 **전표번호와 겹치지 않는 대역**으로 둔다 — 겹치면 「글자로 나오지 않는다」가
 * 전표번호 때문에 실패해 감지기가 무엇을 잡았는지 가려진다.
 */
const receipt = (
  no: string,
  statusCode = 'SAMPLE_IR_STATUS_A',
  inboundReceiptId = 9601,
): CreatedReceiptView => ({
  inboundReceiptId,
  inboundReceiptNo: no,
  statusCode,
});

/** 링크가 있는 부품이라 라우터 안에서 렌더한다 — 밖에서 렌더하면 `Link`가 던진다. */
const renderPane = (receipts: CreatedReceiptView[]): void => {
  render(
    <MemoryRouter>
      <CreatedReceiptsPane receipts={receipts} />
    </MemoryRouter>,
  );
};

describe('CreatedReceiptsPane', () => {
  /*
   * **M42** — 두 건이 만들어졌다는 것이 이 화면의 요점이다. 번호만 나열하면
   * 두 줄이 「한 전표의 두 표기」로 읽힐 수 있어 **건수를 함께** 밝힌다.
   */
  it('만들어진 건수를 밝힌다', () => {
    renderPane([receipt('IR-2026-900010'), receipt('IR-2026-900011', 'SAMPLE_IR_STATUS_A', 9602)]);

    expect(screen.getByText(t.result.count(2))).toBeInTheDocument();
  });

  it('한 건일 때도 건수를 밝힌다', () => {
    renderPane([receipt('IR-2026-900010')]);

    expect(screen.getByText(t.result.count(1))).toBeInTheDocument();
  });

  it('전표 번호를 빠짐없이 낸다', () => {
    renderPane([receipt('IR-2026-900010'), receipt('IR-2026-900011', 'SAMPLE_IR_STATUS_A', 9602)]);

    expect(screen.getByText('IR-2026-900010')).toBeInTheDocument();
    expect(screen.getByText('IR-2026-900011')).toBeInTheDocument();
  });

  /* 상태 코드는 **값으로 분기하지 않고** 그대로 보인다(공유계약 G-2). */
  it('상태 코드를 그대로 보인다', () => {
    renderPane([receipt('IR-2026-900010', 'SAMPLE_IR_STATUS_B')]);

    expect(screen.getByText('SAMPLE_IR_STATUS_B')).toBeInTheDocument();
  });

  /*
   * **이름 하나에 값 하나다.** 이름 칸 하나 뒤에 값 칸이 둘이면 보조기술이 상태를
   * 「전표번호」의 **두 번째 값**으로 읽는다 — 이름 없는 값이 아니라 **틀린 이름이 붙은 값**이다.
   * 「보인다」만 단언하면 그 어긋남이 그대로 통과한다.
   */
  it('전표번호와 상태가 각각 자기 이름 아래에 있다', () => {
    renderPane([receipt('IR-2026-900010', 'SAMPLE_IR_STATUS_B')]);

    const labelOf = (value: string): string | null => {
      const definition = screen
        .getAllByRole('definition')
        .find((node) => node.textContent === value);

      return definition?.previousElementSibling?.textContent ?? null;
    };

    expect(labelOf('IR-2026-900010')).toBe(t.result.receiptNo);
    expect(labelOf('SAMPLE_IR_STATUS_B')).toBe(t.result.status);
  });

  /*
   * **응답이 어느 건이 정량분인지 알려 주지 않는다.** 순서로 추측해 라벨을 붙이면
   * 틀린 라벨이 되돌릴 수 없는 전표에 붙는다 — 모른다는 사실을 밝힌다.
   */
  it('어느 전표가 어느 쪽인지 추측하지 않는다', () => {
    renderPane([receipt('IR-2026-900010'), receipt('IR-2026-900011', 'SAMPLE_IR_STATUS_A', 9602)]);

    const pane = screen.getByRole('status', { name: t.panes.result });

    expect(within(pane).getByText(t.result.unlabeled)).toBeInTheDocument();
    /* 짝 방향 — 번호는 실제로 보이는데 갈래 이름만 붙지 않는다. */
    expect(within(pane).getByText('IR-2026-900010')).toBeInTheDocument();
    expect(within(pane).queryByText(t.actions.registerNormalOnly)).not.toBeInTheDocument();
    expect(within(pane).queryByText(t.actions.registerExcessOnly)).not.toBeInTheDocument();
  });

  /*
   * **M40의 부품 몫 · C36** — 결과 구획에 내부 번호가 **글자로** 새지 않는다.
   *
   * 앞 회차에는 이 부품이 번호를 받지도 않아 늘 참인 단언이었다. 이제는 링크를 만들려고
   * **실제로 받는다** — 그래서 이 감지기가 비로소 문다. 받은 값이 주소에만 실리고 사람이 읽는
   * 자리에는 나오지 않는다는 것이 #44의 본뜻이고, 이 시험이 그 경계를 지킨다.
   */
  it('사람이 읽는 자리에 내부 번호가 없다', () => {
    renderPane([receipt('IR-2026-900010'), receipt('IR-2026-900011', 'SAMPLE_IR_STATUS_A', 9602)]);

    const pane = screen.getByRole('status', { name: t.panes.result });

    /* 짝 양성 — 번호는 실제로 보인다. 「아무것도 안 그려서 통과」를 막는다. */
    expect(within(pane).getByText('IR-2026-900010')).toBeInTheDocument();

    for (const id of ['9601', '9602']) {
      expect(pane.textContent ?? '').not.toContain(id);
    }
  });

  /*
   * **C34** — 전표마다 다음 화면으로 가는 길이 선다.
   *
   * **건마다 따로 세운다.** 두 건이 만들어졌을 때 하나로 합치면 어느 전표로 가는지 화면이
   * 지어내야 한다 — 응답은 어느 건이 초과분인지 알려 주지 않는다(계획 결정 3).
   */
  it('전표마다 다음 화면으로 가는 링크가 선다', () => {
    renderPane([receipt('IR-2026-900010'), receipt('IR-2026-900011', 'SAMPLE_IR_STATUS_A', 9602)]);

    const pane = screen.getByRole('status', { name: t.panes.result });

    expect(within(pane).getAllByRole('link')).toHaveLength(2);
    /* 건수만 세면 두 링크가 같은 전표를 가리켜도 통과한다 — 각 전표의 이름으로 다시 찾는다. */
    expect(
      within(pane).getByRole('link', { name: t.result.registerPo('IR-2026-900010') }),
    ).toBeInTheDocument();
    expect(
      within(pane).getByRole('link', { name: t.result.registerPo('IR-2026-900011') }),
    ).toBeInTheDocument();
  });

  /*
   * **주소를 글자 그대로 잰다.** 상수를 되읽어 견주면 열쇠 이름이 바뀌어도 기대값이 함께
   * 바뀌어 아무도 울지 않는다(사본 체크리스트 6번의 자기참조 금지와 같은 사정) —
   * 받는 쪽(W-01-11)이 읽는 열쇠는 `receipt` 하나뿐이라 이 문자열이 곧 계약이다.
   */
  it('링크 주소에 그 전표의 번호가 열쇠로 실린다', () => {
    renderPane([receipt('IR-2026-900010'), receipt('IR-2026-900011', 'SAMPLE_IR_STATUS_A', 9602)]);

    expect(
      screen.getByRole('link', { name: t.result.registerPo('IR-2026-900010') }),
    ).toHaveAttribute('href', '/logistics/po-register?receipt=9601');
    expect(
      screen.getByRole('link', { name: t.result.registerPo('IR-2026-900011') }),
    ).toHaveAttribute('href', '/logistics/po-register?receipt=9602');
  });

  /*
   * **보이는 글자가 곧 접근 이름이다.** 숨은 이름으로만 전표를 가르면 눈으로 보는 사람이
   * 두 링크를 구분하지 못하고, 보이는 글자에만 담고 숨은 이름을 따로 두면 둘이 어긋난다.
   * **내부 번호는 어느 쪽에도 담지 않는다** — 그것이 번호가 화면 밖으로 새는 또 하나의 경로다.
   */
  it('링크 이름이 보이는 글자 그대로이고 내부 번호를 담지 않는다', () => {
    renderPane([receipt('IR-2026-900010')]);

    const link = screen.getByRole('link', { name: t.result.registerPo('IR-2026-900010') });

    expect(link).not.toHaveAttribute('aria-label');
    expect(link.textContent ?? '').toContain('IR-2026-900010');
    expect(link.textContent ?? '').not.toContain('9601');
  });
});
