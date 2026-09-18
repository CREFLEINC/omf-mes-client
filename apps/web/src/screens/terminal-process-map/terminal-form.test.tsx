import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '../../patterns/request';
import {
  codeSelectOptions,
  type CodeLookup,
  type LookupResult,
  type TerminalCodeNames,
} from './lookups';
import { EMPTY_TERMINAL } from './terminal-draft';
import { TerminalForm } from './terminal-form';

const emptyLookup: LookupResult = {
  entries: [],
  truncated: false,
  isError: false,
  error: null,
  isLoading: false,
  refetch: vi.fn(),
};

const codeLookup = (entries: CodeLookup['entries']): CodeLookup => ({
  nameOf: (code) => entries.find((entry) => entry.value === code)?.label ?? code,
  entries,
});

/* 공통코드 — 합성 이름. 운영 상태에는 사용 중지 코드 하나를 섞는다. */
const syntheticCodes: TerminalCodeNames = (() => {
  const typeLookup = codeLookup([{ value: 'MOBILE', label: '합성 모바일', isActive: true }]);
  const statusLookup = codeLookup([
    { value: 'RUNNING', label: '합성 가동', isActive: true },
    { value: 'STOPPED', label: '합성 정지', isActive: true },
    { value: 'SYN-OLD', label: '합성 옛 상태', isActive: false },
  ]);
  return { type: typeLookup.nameOf, status: statusLookup.nameOf, typeLookup, statusLookup };
})();

const noCodes: TerminalCodeNames = (() => {
  const empty = codeLookup([]);
  return { type: empty.nameOf, status: empty.nameOf, typeLookup: empty, statusLookup: empty };
})();

const showForm = (
  isNew: boolean,
  equipments: LookupResult = emptyLookup,
  codeNames: TerminalCodeNames = syntheticCodes,
) =>
  render(
    <TerminalForm
      draft={{ ...EMPTY_TERMINAL, statusCode: 'RUNNING' }}
      errors={{}}
      isNew={isNew}
      isSaving={false}
      saveError={null}
      fieldErrors={{}}
      plants={emptyLookup}
      equipments={equipments}
      codeNames={codeNames}
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

  it('수정에서는 운영 상태를 코드가 아니라 공통코드 이름으로 고른다', () => {
    showForm(false);
    expect(screen.getByLabelText('운영 상태')).toHaveTextContent('합성 가동');
  });

  it('공통코드를 못 받아도 지금 값은 코드 그대로 선택된 채 남는다', () => {
    showForm(false, emptyLookup, noCodes);
    expect(screen.getByLabelText('운영 상태')).toHaveTextContent('RUNNING');
  });

  it('설비 조회 403은 미지정 선택지만 남더라도 빈 목록으로 숨기지 않는다', () => {
    const retry = vi.fn();
    showForm(true, {
      ...emptyLookup,
      isError: true,
      error: new ApiRequestError(
        {
          kind: 'validation',
          errors: [
            {
              scope: 'screen',
              code: 'PERMISSION_DENIED',
              message: '이 기능을 쓸 권한이 없습니다.',
            },
          ],
        },
        { httpStatus: 403 },
      ),
      refetch: retry,
    });

    expect(screen.getByText('이 기능을 쓸 권한이 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull();
    expect(retry).not.toHaveBeenCalled();
  });
});

describe('공통코드 선택지', () => {
  const lookup = syntheticCodes.statusLookup;

  it('사용 중인 코드만 고를 수 있고, 지금 값이 사용 중지 코드면 「(미사용)」을 붙여 남긴다', () => {
    expect(codeSelectOptions(lookup, 'RUNNING').map((option) => option.value)).toEqual([
      'RUNNING',
      'STOPPED',
    ]);
    expect(codeSelectOptions(lookup, 'SYN-OLD')).toContainEqual({
      value: 'SYN-OLD',
      label: '합성 옛 상태 (미사용)',
    });
  });

  it('목록에 없는 지금 값은 코드 그대로 선택지에 더한다', () => {
    expect(codeSelectOptions(lookup, 'SYN-UNKNOWN')).toContainEqual({
      value: 'SYN-UNKNOWN',
      label: 'SYN-UNKNOWN',
    });
    expect(codeSelectOptions(lookup, '')).toHaveLength(2);
  });
});
