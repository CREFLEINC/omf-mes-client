import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LocationField, type LocationFieldProps } from './location-field';
import type { LookupResult } from './lookups';
import type { SelectOption } from './types';

const t = messages.stocktaking;

const OPTIONS: SelectOption[] = [
  { value: '9701', label: 'SAMPLE-LOC-01 · 합성 위치 가' },
  { value: '9702', label: `SAMPLE-LOC-02 · 합성 위치 나${t.values.inactiveSuffix}` },
];

const lookup = (overrides: Partial<LookupResult> = {}): LookupResult => ({
  entries: [],
  isError: false,
  isLoading: false,
  truncated: false,
  refetch: () => undefined,
  ...overrides,
});

const renderField = (overrides: Partial<LocationFieldProps> = {}) => {
  const onChange = vi.fn<(locationId: number | null) => void>();
  const onRetry = vi.fn<() => void>();

  render(
    <LocationField
      lookup={lookup()}
      options={OPTIONS}
      value=""
      isLocked={false}
      onChange={onChange}
      onRetry={onRetry}
      {...overrides}
    />,
  );

  return { onChange, onRetry, user: userEvent.setup() };
};

const trigger = (): HTMLElement => screen.getByLabelText(t.fields.location);

describe('LocationField — 결과 등록의 축', () => {
  it('고른 위치를 번호로 알린다', async () => {
    const { onChange, user } = renderField();

    await user.click(trigger());
    await user.click(screen.getByRole('option', { name: 'SAMPLE-LOC-01 · 합성 위치 가' }));

    expect(onChange).toHaveBeenCalledWith(9701);
  });

  /*
   * **「고르지 않음」이 값이 빈 선택지로 있어야 해제할 수 있다.** 없으면 한 번 고른 뒤에
   * 라인 구획을 닫을 방법이 칸 안에 없어지고, 사용자는 실사 선택을 풀게 된다.
   */
  it('빈 선택지를 고르면 해제로 알린다', async () => {
    const { onChange, user } = renderField({ value: '9701' });

    await user.click(trigger());
    await user.click(screen.getByRole('option', { name: t.values.locationNotChosen }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  /** **미사용 위치를 빼지 않고 표식만 붙인다** — 빼면 그 위치의 라인을 볼 방법이 사라진다. */
  it('미사용 표식이 붙은 선택지도 고를 수 있다', async () => {
    const { onChange, user } = renderField();

    await user.click(trigger());
    await user.click(
      screen.getByRole('option', {
        name: `SAMPLE-LOC-02 · 합성 위치 나${t.values.inactiveSuffix}`,
      }),
    );

    expect(onChange).toHaveBeenCalledWith(9702);
  });

  /*
   * **전송 중에는 위치를 바꿀 수 없다**(수명 표 18행 · 감지기 M41의 첫째 겹).
   * 열어 두면 사용자가 다른 위치로 옮긴 뒤 **앞 요청의 결과가 그 위치의 맥락에 나타난다.**
   */
  it('전송 중에는 잠긴다', () => {
    renderField({ isLocked: true });

    expect(trigger()).toBeDisabled();
  });

  it('목록이 잘리면 안내가 붙는다', () => {
    renderField({ lookup: lookup({ truncated: true }) });

    expect(screen.getByText(t.filters.lookupTruncated)).toBeInTheDocument();
  });

  /*
   * **복구 버튼이 이 칸에 붙는다**(계획 결정 17). 위치를 못 받으면 라인 표 자체가 열리지 않아
   * 표 아래에 두면 보이지도 않는 실패의 복구 버튼이 된다.
   */
  it('불러오기에 실패하면 사유와 다시 시도가 함께 선다', async () => {
    const { onRetry, user } = renderField({ lookup: lookup({ isError: true }) });

    expect(screen.getByText(t.reasons.locationReferenceFailed)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('실패하지 않으면 다시 시도를 내지 않는다', () => {
    renderField();

    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });
});
