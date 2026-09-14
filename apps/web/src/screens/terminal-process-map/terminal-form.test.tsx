import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '../../patterns/request';
import { EMPTY_TERMINAL } from './terminal-draft';
import { TerminalForm } from './terminal-form';
import type { LookupResult } from './lookups';

const emptyLookup: LookupResult = {
  entries: [],
  truncated: false,
  isError: false,
  error: null,
  isLoading: false,
  refetch: vi.fn(),
};

const showForm = (isNew: boolean, equipments: LookupResult = emptyLookup) => render(
  <TerminalForm
    draft={{ ...EMPTY_TERMINAL, statusCode: 'RUNNING' }}
    errors={{}}
    isNew={isNew}
    isSaving={false}
    saveError={null}
    fieldErrors={{}}
    plants={emptyLookup}
    equipments={equipments}
    onChange={vi.fn()}
    onSubmit={vi.fn()}
    onCancel={vi.fn()}
  />,
);

describe('단말 등록·수정 폼의 운영 상태', () => {
  it('신규 등록에서는 운영 상태 입력을 보이지 않는다', () => {
    showForm(true);
    expect(screen.queryByLabelText('운영 상태')).toBeNull();
  });

  it('수정에서는 운영 상태를 명확한 이름으로 편집한다', () => {
    showForm(false);
    expect(screen.getByLabelText('운영 상태')).toHaveValue('RUNNING');
  });

  it('설비 조회 403은 미지정 선택지만 남더라도 빈 목록으로 숨기지 않는다', () => {
    const retry = vi.fn();
    showForm(true, {
      ...emptyLookup,
      isError: true,
      error: new ApiRequestError(
        { kind: 'validation', errors: [{ scope: 'screen', code: 'PERMISSION_DENIED', message: '이 기능을 쓸 권한이 없습니다.' }] },
        { httpStatus: 403 },
      ),
      refetch: retry,
    });

    expect(screen.getByText('이 기능을 쓸 권한이 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull();
    expect(retry).not.toHaveBeenCalled();
  });
});
