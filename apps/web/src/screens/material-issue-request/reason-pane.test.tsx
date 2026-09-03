import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { LookupResult } from './lookups';
import { reasonCodeValueFixtures } from './fixtures';
import { ReasonPane } from './reason-pane';

const t = messages.materialIssueRequest;

/**
 * 최소 갈래 — **사유 선택기가 잠기지 않는가**가 이 파일의 요점이다(함정 1의 회귀 감지기).
 *
 * 이 그룹은 값이 확정된 고객 마스터(G-31)라 「값 미확정 → 비활성」 패턴을 적용하면 틀린다.
 */

const reasons: LookupResult = {
  entries: reasonCodeValueFixtures.map((value) => ({
    value: value.code,
    label: value.codeName,
    isActive: true,
  })),
  truncated: false,
  isError: false,
  isLoading: false,
  refetch: vi.fn(),
};

const emptyReasons: LookupResult = { ...reasons, entries: [], refetch: vi.fn() };

const renderPane = (override: Partial<Parameters<typeof ReasonPane>[0]> = {}) =>
  render(
    <ReasonPane
      reasons={reasons}
      reasonCode=""
      onChangeReason={vi.fn()}
      remarks=""
      onChangeRemarks={vi.fn()}
      isLocked={false}
      {...override}
    />,
  );

describe('ReasonPane', () => {
  it('사유 입력을 제목이 있는 구획으로 구분한다', () => {
    renderPane();

    expect(screen.getByRole('heading', { level: 2, name: t.panes.reason })).toBeInTheDocument();
  });

  it('사유 라디오가 **비활성이 아니다**', () => {
    renderPane();

    const radios = screen.getAllByRole('radio');

    expect(radios).toHaveLength(reasonCodeValueFixtures.length);
    for (const radio of radios) expect(radio).toBeEnabled();
  });

  it('코드값이 0건이어도 잠기지 않는다 — 비고만으로도 발행할 수 있다', () => {
    renderPane({ reasons: emptyReasons });

    expect(screen.getByLabelText(t.formFields.remarks)).toBeEnabled();
    expect(screen.getByText(t.codes.reasonEmpty)).toBeInTheDocument();
  });

  it('조회가 실패해도 잠그지 않고 다시 시도를 낸다', () => {
    renderPane({ reasons: { ...emptyReasons, isError: true } });

    expect(screen.getByText(t.codes.reasonFailed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.retry })).toBeEnabled();
  });

  it('한 그룹으로 돈다 — 하나를 고르면 앞서 고른 것이 풀린다', async () => {
    const user = userEvent.setup();
    const onChangeReason = vi.fn<(value: string) => void>();

    renderPane({ reasonCode: reasonCodeValueFixtures[0]!.code, onChangeReason });

    const [first, second] = screen.getAllByRole('radio');

    expect(first).toBeChecked();
    expect(second).not.toBeChecked();

    await user.click(second!);

    expect(onChangeReason).toHaveBeenCalledWith(reasonCodeValueFixtures[1]!.code);
  });

  it('비고 칸이 선다 — 사유를 담을 자리는 사유 코드이고 비고는 별개다', () => {
    renderPane();

    expect(screen.getByLabelText(t.formFields.remarks)).toBeInTheDocument();
  });
});
