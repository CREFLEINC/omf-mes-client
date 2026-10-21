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
const options = [
  { value: 'MAN', label: '사람' },
  { value: 'MATERIAL', label: '자재' },
];

/** omf-all-around#63 — IQC 판정 때 자재 LOT 의 4M 변경품. */
describe('4M 변경품 초안', () => {
  it('서버 기록이 없으면 체크 해제, 있으면 체크와 값을 채운다', () => {
    expect(fourMDraftOf(null)).toEqual(EMPTY_FOUR_M_CHANGE);
    expect(fourMDraftOf({ changeTypeCode: 'MAN' })).toEqual({
      checked: true,
      changeTypeCode: 'MAN',
      remarks: '',
    });
  });

  it('체크를 풀면 null(기록 삭제), 체크면 종류와 다듬은 내용을 싣는다', () => {
    expect(fourMBodyOf(EMPTY_FOUR_M_CHANGE)).toBeNull();
    expect(fourMBodyOf({ checked: true, changeTypeCode: 'MAN', remarks: '  ' })).toEqual({
      changeTypeCode: 'MAN',
    });
    expect(fourMBodyOf({ checked: true, changeTypeCode: 'MAN', remarks: ' 공급처 변경 ' })).toEqual(
      {
        changeTypeCode: 'MAN',
        remarks: '공급처 변경',
      },
    );
  });

  it('체크했는데 종류가 없으면 미완성이다', () => {
    expect(isFourMIncomplete({ checked: true, changeTypeCode: '', remarks: '' })).toBe(true);
    expect(isFourMIncomplete(EMPTY_FOUR_M_CHANGE)).toBe(false);
  });

  it('체크를 푼 둘은 남은 값과 무관하게 같다', () => {
    expect(
      isSameFourM(EMPTY_FOUR_M_CHANGE, { checked: false, changeTypeCode: 'MAN', remarks: 'x' }),
    ).toBe(true);
    expect(
      isSameFourM(
        { checked: true, changeTypeCode: 'MAN', remarks: '' },
        { checked: true, changeTypeCode: 'MATERIAL', remarks: '' },
      ),
    ).toBe(false);
  });
});

describe('FourMChange', () => {
  it('체크하기 전에는 종류·내용 칸이 없고, 체크하면 바뀐 초안을 올린다', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <FourMChange
        draft={EMPTY_FOUR_M_CHANGE}
        options={options}
        onChange={onChange}
        disabled={false}
      />,
    );

    expect(screen.queryByLabelText(t.changeType)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: t.label }));

    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FOUR_M_CHANGE, checked: true });
  });

  it('체크했는데 종류가 비면 오류 문구를 낸다', () => {
    renderWithProviders(
      <FourMChange
        draft={{ checked: true, changeTypeCode: '', remarks: '' }}
        options={options}
        onChange={vi.fn()}
        disabled={false}
      />,
    );

    expect(screen.getByText(t.changeTypeMissing)).toBeInTheDocument();
    expect(screen.getByLabelText(t.remarks)).toBeInTheDocument();
  });

  it('종류 목록이 비면 칸을 감추지 않고 사유를 밝힌다', () => {
    renderWithProviders(
      <FourMChange
        draft={{ checked: true, changeTypeCode: '', remarks: '' }}
        options={[]}
        onChange={vi.fn()}
        disabled={false}
      />,
    );

    expect(screen.getByText(t.noChangeTypes)).toBeInTheDocument();
  });
});
