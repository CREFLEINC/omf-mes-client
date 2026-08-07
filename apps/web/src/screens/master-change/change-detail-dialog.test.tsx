import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ChangeDetailDialog } from './change-detail-dialog';
import { auditEvent } from './fixtures';
import type { AuditEventView } from './types';

const renderDialog = (row: AuditEventView | null = auditEvent()) => {
  const onClose = vi.fn();

  render(<ChangeDetailDialog row={row} onClose={onClose} />);

  return { onClose, user: userEvent.setup() };
};

describe('ChangeDetailDialog — 창 수명', () => {
  /* 디자인 시스템 Dialog는 닫혀도 내용이 DOM에 남는다. 열 때만 마운트해야 내용도 함께 사라진다. */
  it('가리키는 건이 없으면 아무것도 마운트하지 않는다', () => {
    renderDialog(null);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('변경 내용')).not.toBeInTheDocument();
  });

  it('가리키는 건이 있으면 창이 열린다', () => {
    renderDialog();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('바깥 어둠을 누르면 닫기를 올린다 — 읽기만 하는 창이라 잃을 것이 없다', async () => {
    const { onClose, user } = renderDialog();

    await user.click(screen.getByRole('dialog'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ChangeDetailDialog — 부가 항목', () => {
  it('목록에 없는 항목이 값 표기로 나온다', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('이력 번호')).toBeInTheDocument();
    expect(within(dialog).getByText('9001')).toBeInTheDocument();
    expect(within(dialog).getByText('SAMPLE-CORR-0001')).toBeInTheDocument();
    expect(within(dialog).getByText('9301')).toBeInTheDocument();
    expect(within(dialog).getByText('예시 사유 — 합성 데이터입니다')).toBeInTheDocument();
  });

  it('없는 값은 「—」로 낸다', () => {
    renderDialog(
      auditEvent({ reason: null, correlationId: null, terminalId: null, performedBy: null }),
    );

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByText('—').length).toBeGreaterThanOrEqual(4);
  });

  /* 이 화면은 조회만 한다. 사유의 입력처가 정해지지 않아 입력 자리를 두지 않는다. */
  it('창 안에 입력 수단이 하나도 없다', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(dialog).queryAllByRole('spinbutton')).toHaveLength(0);
    expect(within(dialog).queryAllByRole('combobox')).toHaveLength(0);
    expect(within(dialog).queryByRole('button', { name: '저장' })).not.toBeInTheDocument();
  });
});

describe('ChangeDetailDialog — 전후 비교', () => {
  it('키 합집합만큼 비교 행이 나오고 순서가 받은 순서다', () => {
    renderDialog(
      auditEvent({
        beforeValue: { sampleFieldA: '이전', sampleFieldB: 1 },
        afterValue: { sampleFieldB: 2, sampleFieldC: 3 },
      }),
    );

    const rows = screen.getAllByRole('group');
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
      'sampleFieldA',
      'sampleFieldB',
      'sampleFieldC',
    ]);
  });

  it('키 이름이 받은 그대로 나온다 — 화면이 모르는 키도 감추지 않는다', () => {
    renderDialog(
      auditEvent({ beforeValue: { someUnknownKey: 'x' }, afterValue: { someUnknownKey: 'y' } }),
    );

    expect(screen.getByRole('group', { name: 'someUnknownKey' })).toBeInTheDocument();
  });

  it('바뀐 항목은 변경으로 표시되고 이전·이후 값이 함께 나온다', () => {
    renderDialog(
      auditEvent({ beforeValue: { sampleFieldA: '이전' }, afterValue: { sampleFieldA: '이후' } }),
    );

    const row = screen.getByRole('group', { name: 'sampleFieldA' });
    expect(row).toHaveAttribute('data-changed', 'true');
    expect(within(row).getByText('이전')).toBeInTheDocument();
    expect(within(row).getByText('이후')).toBeInTheDocument();
  });

  it('값이 같은 항목은 변경 없음으로 표시되고 값이 한 번만 나온다', () => {
    renderDialog(
      auditEvent({ beforeValue: { sampleFieldA: '같음' }, afterValue: { sampleFieldA: '같음' } }),
    );

    const row = screen.getByRole('group', { name: 'sampleFieldA' });
    expect(row).toHaveAttribute('data-changed', 'false');
    expect(within(row).getAllByText('같음')).toHaveLength(1);
  });

  it('한쪽에만 있는 키는 반대쪽이 빈 값 표기이고 변경으로 표시된다', () => {
    renderDialog(auditEvent({ beforeValue: { sampleFieldA: 'x' }, afterValue: {} }));

    const row = screen.getByRole('group', { name: 'sampleFieldA' });
    expect(row).toHaveAttribute('data-changed', 'true');
    expect(within(row).getByText('—')).toBeInTheDocument();
  });

  /* 자유 형식이라 객체가 실제로 온다. String()으로 그리면 `[object Object]`가 화면에 나온다. */
  it('객체 값이 원문 JSON으로 나오고 [object Object]가 어디에도 없다', () => {
    renderDialog(
      auditEvent({
        beforeValue: { sampleFieldA: { nested: 1 } },
        afterValue: { sampleFieldA: [1, 2] },
      }),
    );

    const row = screen.getByRole('group', { name: 'sampleFieldA' });
    expect(within(row).getByText('{"nested":1}')).toBeInTheDocument();
    expect(within(row).getByText('[1,2]')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('[object Object]');
  });

  it('0과 false가 값으로 나온다 — 「없음」으로 뭉개지 않는다', () => {
    renderDialog(
      auditEvent({
        beforeValue: { sampleFieldA: 0, sampleFieldB: false },
        afterValue: { sampleFieldA: 1, sampleFieldB: true },
      }),
    );

    expect(within(screen.getByRole('group', { name: 'sampleFieldA' })).getByText('0')).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'sampleFieldB' })).getByText('false'),
    ).toBeInTheDocument();
  });

  /* 셋을 갈라 다른 문구를 내면 화면이 서버 사정을 해석하는 것이 된다. */
  it('전후 값이 둘 다 없으면 비교 행 대신 받지 못했다는 안내를 낸다', () => {
    renderDialog(auditEvent({ beforeValue: null, afterValue: null }));

    expect(screen.queryAllByRole('group')).toHaveLength(0);
    expect(screen.getByText('전후 값을 받지 못했습니다')).toBeInTheDocument();
  });

  it('전후 값이 둘 다 빈 객체여도 같은 안내를 낸다 — 목 서버가 실제로 이렇게 준다', () => {
    renderDialog(auditEvent({ beforeValue: {}, afterValue: {} }));

    expect(screen.queryAllByRole('group')).toHaveLength(0);
    expect(screen.getByText('전후 값을 받지 못했습니다')).toBeInTheDocument();
  });
});
