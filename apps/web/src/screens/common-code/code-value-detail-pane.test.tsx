import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CodeValueDetailPane } from './code-value-detail-pane';
import type { CodeValueFormValues } from './code-value-types';

const values: CodeValueFormValues = {
  code: 'SYN-CV-01',
  codeName: '합성 코드값 A',
  displayOrder: '10',
  effectiveFrom: '2026-07-01',
  effectiveTo: '',
};

const renderPane = (overrides: Partial<Parameters<typeof CodeValueDetailPane>[0]> = {}) => {
  const onDeactivate = vi.fn<() => void>();
  const onEdit = vi.fn<() => void>();

  render(
    <CodeValueDetailPane
      values={values}
      deactivateDisabledReason={null}
      onDeactivate={onDeactivate}
      onEdit={onEdit}
      {...overrides}
    />,
  );

  return { onDeactivate, onEdit, user: userEvent.setup() };
};

describe('CodeValueDetailPane — 읽기 전용 보기', () => {
  it('편집 폼과 같은 칸 이름으로 값을 글자로만 보인다', () => {
    renderPane();

    expect(screen.getByLabelText('코드')).toHaveTextContent('SYN-CV-01');
    expect(screen.getByLabelText('코드명')).toHaveTextContent('합성 코드값 A');
    expect(screen.getByLabelText('정렬 순서')).toHaveTextContent('10');
    expect(screen.getByLabelText('유효 시작')).toHaveTextContent('2026-07-01');
    // 비어 있는 값은 「—」로 표시한다.
    expect(screen.getByLabelText('유효 종료')).toHaveTextContent('—');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument();
  });

  it('[사용 중지] · [수정]을 낸다', async () => {
    const { onDeactivate, onEdit, user } = renderPane();

    await user.click(screen.getByRole('button', { name: '사용 중지' }));
    await user.click(screen.getByRole('button', { name: '수정' }));

    expect(onDeactivate).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('이미 미사용이면 사용 중지가 막히고 사유를 보인다', () => {
    renderPane({
      deactivateDisabledReason: '사용 중지는 이미 미사용인 코드값에 다시 할 수 없습니다.',
    });

    expect(screen.getByRole('button', { name: '사용 중지' })).toBeDisabled();
  });
});
