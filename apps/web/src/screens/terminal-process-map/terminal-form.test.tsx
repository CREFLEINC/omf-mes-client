import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import {
  codeSelectOptions,
  type CodeLookup,
  type LookupResult,
  type TerminalCodeNames,
} from './lookups';
import { EMPTY_TERMINAL, nextTerminalCode, terminalCodePrefix } from './terminal-draft';
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

const showForm = (isNew: boolean, codeNames: TerminalCodeNames = syntheticCodes) =>
  renderWithProviders(
    <TerminalForm
      draft={{ ...EMPTY_TERMINAL, statusCode: 'RUNNING' }}
      errors={{}}
      isNew={isNew}
      saveError={null}
      fieldErrors={{}}
      plants={emptyLookup}
      codeNames={codeNames}
      onChange={vi.fn()}
    />,
  );

describe('단말 등록·수정 폼의 운영 상태', () => {
  it('신규 등록에서는 운영 상태 입력을 보이지 않는다', () => {
    showForm(true);
    expect(screen.queryByLabelText('운영 상태')).toBeNull();
  });

  it('수정에서는 운영 상태를 고르지 않고 공통코드 이름으로 보이기만 한다', () => {
    showForm(false);
    expect(screen.getByLabelText('운영 상태')).toHaveTextContent('합성 가동');
    expect(screen.queryByRole('combobox', { name: '운영 상태' })).not.toBeInTheDocument();
  });

  it('공통코드를 못 받아도 지금 값은 코드 그대로 선택된 채 남는다', () => {
    showForm(false, noCodes);
    expect(screen.getByLabelText('운영 상태')).toHaveTextContent('RUNNING');
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

describe('설치 설비는 POP 단말에서만 (사용자 지시 2026-11-20 · #333)', () => {
  const showWith = (terminalTypeCode: string, onChange = vi.fn()) =>
    renderWithProviders(
      <TerminalForm
        draft={{ ...EMPTY_TERMINAL, terminalTypeCode, equipment: '7' }}
        errors={{}}
        isNew
        saveError={null}
        fieldErrors={{}}
        plants={emptyLookup}
        codeNames={syntheticCodes}
        onChange={onChange}
      />,
    );

  it('POP 이면 설치 설비를 고르고, 아니면 칸은 자리를 지킨 채 사유를 적고 잠긴다', () => {
    const { unmount } = showWith('POP');
    expect(screen.getByRole('combobox', { name: '설치 설비' })).toBeEnabled();
    unmount();

    showWith('MOBILE');
    const field = screen.getByRole('combobox', { name: '설치 설비' });
    expect(field).toBeDisabled();
    expect(field).toHaveTextContent('POP 단말만');
  });

  it('POP 에서 다른 유형으로 바꾸면 고르던 설비를 비운다', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    showWith('POP', onChange);

    /* 유형은 펼친 카드(라디오)로 한 번에 고른다(사용자 결정 2026-11-24). */
    await user.click(screen.getByRole('radio', { name: /합성 모바일/ }));

    expect(onChange).toHaveBeenLastCalledWith({
      terminalTypeCode: 'MOBILE',
      equipment: '',
      equipmentLabel: '',
    });
  });
});

describe('단말 추가 칸 순서 (사용자 결정 2026-11-24)', () => {
  it('유형을 고르기 전에는 단말 코드 칸이 잠겨 있다 — 유형으로 채워지는 값이라 맨 끝에 둔다', () => {
    showForm(true);
    expect(screen.getByLabelText('단말 코드')).toBeDisabled();
  });

  it('유형으로 채운 코드 그대로면 「자동」 표시를 붙인다', () => {
    renderWithProviders(
      <TerminalForm
        draft={{ ...EMPTY_TERMINAL, terminalTypeCode: 'MOBILE', terminalCode: 'MOBILE-001' }}
        errors={{}}
        isNew
        codeIsAuto
        saveError={null}
        fieldErrors={{}}
        plants={emptyLookup}
        codeNames={syntheticCodes}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('단말 코드')).toBeEnabled();
    expect(screen.getByText('자동')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /합성 모바일/ })).toBeChecked();
  });
});

describe('단말 코드 자동 채움 (사용자 지시 2026-11-20 · #333)', () => {
  it('그 유형의 일련번호 중 다음 번호를 세 자리로 낸다 — 다른 모양의 코드는 세지 않는다', () => {
    expect(nextTerminalCode('POP', [])).toBe('POP-001');
    expect(nextTerminalCode('POP', ['POP-001', 'POP-007', 'QC-DEMO-POP-EQ', 'POP-X'])).toBe(
      'POP-008',
    );
    expect(nextTerminalCode('MOBILE', ['POP-003', 'MOBILE-012'])).toBe('MOBILE-013');
  });

  it('PDA(유형 코드 MOBILE)는 「PDA-」로 채운다 — 다른 유형은 유형 코드 그대로', () => {
    expect(terminalCodePrefix('MOBILE')).toBe('PDA');
    expect(terminalCodePrefix('POP')).toBe('POP');
    expect(nextTerminalCode(terminalCodePrefix('MOBILE'), ['PDA-002', 'MOBILE-009'])).toBe(
      'PDA-003',
    );
  });
});
