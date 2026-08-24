import { messages } from '@omf-mes/i18n';
import type { SelectItems } from '@crefle/web-ui';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { WorkOrderCloseInputPane } from './close-input-pane';
import type { WorkOrderCloseInputDraft } from './close-input-draft';
import type { WorkOrderCloseCompletionJudgment } from './close-readiness';

const t = messages.workOrderClose.input;
const reasonOptions: SelectItems = [
  { value: 'reason-second', label: 'Synthetic second reason' },
  { value: 'reason-first', label: 'Synthetic first reason' },
];

const renderPane = ({
  completionJudgment = 'UNDER',
  draft = { remainderDisposition: null, varianceReasonCode: '' },
  reasonOptions: options = reasonOptions,
  reasonUnavailableReason = null,
  onRemainderDispositionChange = vi.fn(),
  onVarianceReasonCodeChange = vi.fn(),
}: Partial<React.ComponentProps<typeof WorkOrderCloseInputPane>> = {}) => {
  render(
    <WorkOrderCloseInputPane
      completionJudgment={completionJudgment}
      draft={draft}
      reasonOptions={options}
      reasonUnavailableReason={reasonUnavailableReason}
      onRemainderDispositionChange={onRemainderDispositionChange}
      onVarianceReasonCodeChange={onVarianceReasonCodeChange}
    />,
  );
  return { onRemainderDispositionChange, onVarianceReasonCodeChange };
};

describe('WorkOrderCloseInputPane', () => {
  it('uses the exact localized classification values', () => {
    expect(t.classification).toEqual({
      label: '수량 판정',
      SHORTFALL: '미달',
      EXACT: '정상',
      OVERAGE: '초과',
    });
  });

  it.each([
    ['UNDER', 'SHORTFALL'],
    ['NORMAL', 'EXACT'],
    ['OVER', 'OVERAGE'],
  ] as const)(
    'shows localized server judgment %s without its raw code',
    (completionJudgment: WorkOrderCloseCompletionJudgment, displayKey) => {
      renderPane({ completionJudgment });

      expect(screen.getByRole('region', { name: t.pane })).toHaveClass('pane');
      expect(screen.getByRole('heading', { name: t.heading })).toBeVisible();
      expect(screen.getByText(t.classification.label)).toBeVisible();
      expect(screen.getByText(t.classification[displayKey])).toBeVisible();
      expect(screen.queryByText(completionJudgment)).not.toBeInTheDocument();
    },
  );

  it('keeps exact drafts hidden and does not expose editable controls', () => {
    const callbacks = renderPane({
      completionJudgment: 'NORMAL',
      draft: { remainderDisposition: 'CARRY_OVER', varianceReasonCode: 'reason-first' },
    });

    expect(screen.getByText(t.exactNote)).toBeVisible();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByText('CARRY_OVER')).not.toBeInTheDocument();
    expect(screen.queryByText('reason-first')).not.toBeInTheDocument();
    expect(callbacks.onRemainderDispositionChange).not.toHaveBeenCalled();
    expect(callbacks.onVarianceReasonCodeChange).not.toHaveBeenCalled();
  });

  it.each([
    [null, false, false],
    ['CARRY_OVER', true, false],
    ['WRITE_OFF', false, true],
  ] as const)(
    'controls shortfall radio selection from %s',
    (remainderDisposition, carryOver, writeOff) => {
      renderPane({ draft: { remainderDisposition, varianceReasonCode: '' } });

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(2);
      expect(radios[0]!).toHaveAccessibleName(t.remainder.CARRY_OVER);
      expect(radios[1]!).toHaveAccessibleName(t.remainder.WRITE_OFF);
      expect(radios[0]!).toHaveProperty('checked', carryOver);
      expect(radios[1]!).toHaveProperty('checked', writeOff);
    },
  );

  it('uses a field-cell fieldset with a check-group radio wrapper', () => {
    renderPane();

    const fieldset = screen.getByRole('group', { name: t.remainder.legend });
    const [legend, checkGroup] = Array.from(fieldset.children);
    expect(fieldset).toHaveClass('field-cell');
    expect(legend?.tagName).toBe('LEGEND');
    expect(checkGroup).toHaveClass('check-group');
    expect(checkGroup).toBeInstanceOf(HTMLDivElement);
    if (!(checkGroup instanceof HTMLDivElement)) throw new Error('Expected radio wrapper.');
    expect(within(checkGroup).getAllByRole('radio')).toHaveLength(2);
  });

  it('delegates an exact shortfall radio value without self-owned state', async () => {
    const user = userEvent.setup();
    const callbacks = renderPane();
    const writeOff = screen.getByRole('radio', { name: t.remainder.WRITE_OFF });

    await user.click(writeOff);

    expect(callbacks.onRemainderDispositionChange).toHaveBeenCalledTimes(1);
    expect(callbacks.onRemainderDispositionChange).toHaveBeenCalledWith('WRITE_OFF');
    expect(writeOff).not.toBeChecked();
  });

  it('uses distinct radio groups for separate panes and isolates their callbacks', async () => {
    const user = userEvent.setup();
    const first = vi.fn();
    const second = vi.fn();
    const props = {
      completionJudgment: 'UNDER' as const,
      draft: { remainderDisposition: null, varianceReasonCode: '' },
      reasonOptions,
      reasonUnavailableReason: null,
      onVarianceReasonCodeChange: vi.fn(),
    };
    render(
      <>
        <WorkOrderCloseInputPane {...props} onRemainderDispositionChange={first} />
        <WorkOrderCloseInputPane {...props} onRemainderDispositionChange={second} />
      </>,
    );

    const groups = screen.getAllByRole('group', { name: t.remainder.legend });
    const firstRadios = within(groups[0]!).getAllByRole('radio');
    const secondRadios = within(groups[1]!).getAllByRole('radio');
    expect(firstRadios[0]?.getAttribute('name')).toBe(firstRadios[1]?.getAttribute('name'));
    expect(secondRadios[0]?.getAttribute('name')).toBe(secondRadios[1]?.getAttribute('name'));
    expect(firstRadios[0]?.getAttribute('name')).not.toBe(secondRadios[0]?.getAttribute('name'));

    await user.click(firstRadios[1]!);

    expect(first).toHaveBeenCalledWith('WRITE_OFF');
    expect(second).not.toHaveBeenCalled();
  });

  it('keeps caller option order and controlled reason selection', async () => {
    const user = userEvent.setup();
    const callbacks = renderPane({
      draft: { remainderDisposition: null, varianceReasonCode: 'reason-first' },
    });
    const select = screen.getByRole('combobox', { name: t.reason.label });

    expect(select).toHaveAttribute('aria-required');
    expect(select).toHaveTextContent('Synthetic first reason');
    await user.click(select);
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAccessibleName('Synthetic second reason');
    expect(options[1]).toHaveAccessibleName('Synthetic first reason');
    await user.click(screen.getByRole('option', { name: 'Synthetic second reason' }));

    expect(callbacks.onVarianceReasonCodeChange).toHaveBeenCalledTimes(1);
    expect(callbacks.onVarianceReasonCodeChange).toHaveBeenCalledWith('reason-second');
    expect(select).toHaveTextContent('Synthetic first reason');
  });

  it('omits the shortfall fieldset but keeps the overage reason select', () => {
    renderPane({ completionJudgment: 'OVER' });

    expect(screen.queryByRole('group', { name: t.remainder.legend })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: t.reason.label })).toBeEnabled();
  });

  it.each([
    ['nonempty options', reasonOptions],
    ['empty options', []],
  ] as [string, SelectItems][])(
    'prefers the supplied unavailable reason with %s and describes its disabled select',
    (_, options) => {
      renderPane({
        reasonOptions: options,
        reasonUnavailableReason: 'Synthetic unavailable reason',
      });

      const select = screen.getByRole('combobox', { name: t.reason.label });
      expect(select).toBeDisabled();
      expect(screen.getByText('Synthetic unavailable reason')).toBeVisible();
      expect(select).toHaveAccessibleDescription('Synthetic unavailable reason');
      expect(screen.queryByText(t.reason.empty)).not.toBeInTheDocument();
    },
  );

  it('uses the localized empty-options note when no supplied reason exists', () => {
    renderPane({ reasonOptions: [] });

    const select = screen.getByRole('combobox', { name: t.reason.label });
    expect(select).toBeDisabled();
    expect(screen.getByText(t.reason.empty)).toBeVisible();
    expect(select).toHaveAccessibleDescription(t.reason.empty);
  });

  it('omits a reason description when nonempty options are available', () => {
    renderPane();

    expect(screen.getByRole('combobox', { name: t.reason.label })).toBeEnabled();
    expect(screen.queryByText(t.reason.empty)).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: t.reason.label })).not.toHaveAttribute(
      'aria-describedby',
    );
  });
});
