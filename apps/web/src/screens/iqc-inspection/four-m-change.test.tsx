import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import {
  EMPTY_FOUR_M_CHANGE,
  FourMChange,
  fourMBodyOf,
  fourMDraftOf,
  isFourMIncomplete,
  isSameFourM,
} from './four-m-change';

const t = messages.iqcInspection.result.fourMChange;

/** omf-all-around#63 — IQC 판정 때 자재 LOT 의 4M 변경품. #133 부터 변경 종류 없이 내용만 적는다. */
describe('4M 변경품 초안', () => {
  it('서버 기록이 없으면 체크 해제, 있으면 체크와 내용을 채운다', () => {
    expect(fourMDraftOf(null)).toEqual(EMPTY_FOUR_M_CHANGE);
    expect(fourMDraftOf({ changeTypeCode: 'MAN', remarks: '공급처 변경' })).toEqual({
      checked: true,
      remarks: '공급처 변경',
    });
    expect(fourMDraftOf({})).toEqual({ checked: true, remarks: '' });
  });

  it('체크를 풀면 null(기록 삭제), 체크면 다듬은 내용만 싣는다', () => {
    expect(fourMBodyOf(EMPTY_FOUR_M_CHANGE)).toBeNull();
    expect(fourMBodyOf({ checked: true, remarks: ' 공급처 변경 ' })).toEqual({
      remarks: '공급처 변경',
    });
  });

  it('체크했는데 내용이 비면 미완성이다', () => {
    expect(isFourMIncomplete({ checked: true, remarks: '  ' })).toBe(true);
    expect(isFourMIncomplete({ checked: true, remarks: '공급처 변경' })).toBe(false);
    expect(isFourMIncomplete(EMPTY_FOUR_M_CHANGE)).toBe(false);
  });

  it('체크를 푼 둘은 남은 값과 무관하게 같다', () => {
    expect(isSameFourM(EMPTY_FOUR_M_CHANGE, { checked: false, remarks: 'x' })).toBe(true);
    expect(isSameFourM({ checked: true, remarks: 'a' }, { checked: true, remarks: 'b' })).toBe(
      false,
    );
  });
});

describe('FourMChange', () => {
  it('체크하기 전에는 내용 칸이 없고, 체크하면 바뀐 초안을 올린다', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <FourMChange
        draft={EMPTY_FOUR_M_CHANGE}
        missing={false}
        onChange={onChange}
        disabled={false}
      />,
    );

    expect(screen.queryByLabelText(t.remarks, { exact: false })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: t.label }));

    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FOUR_M_CHANGE, checked: true });
  });

  it('체크했는데 내용이 비면 오류 문구를 내고, 변경 종류 칸은 없다', () => {
    renderWithProviders(
      <FourMChange
        draft={{ checked: true, remarks: '' }}
        missing
        onChange={vi.fn()}
        disabled={false}
      />,
    );

    expect(screen.getByText(t.remarksMissing)).toBeInTheDocument();
    expect(screen.getByLabelText(t.remarks, { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
