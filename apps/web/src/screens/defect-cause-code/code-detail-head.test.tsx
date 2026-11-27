import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { defectCodeAdapter } from './adapters';
import { CodeDetailHead, type CodeDetailHeadProps } from './code-detail-head';

const renderHead = (overrides: Partial<CodeDetailHeadProps> = {}) => {
  const props: CodeDetailHeadProps = {
    adapter: defectCodeAdapter,
    code: { id: 1002, code: 'DF-11', name: '스크래치', parentId: 1001, isActive: true },
    parentLabel: 'DF-10 · 외관',
    processLabel: null,
    ...overrides,
  };

  render(<CodeDetailHead {...props} />);

  return { props, user: userEvent.setup() };
};

describe('CodeDetailHead (#209)', () => {
  it('제목과 이름표 상자(코드 · 명칭 · 구분 · 상위)를 낸다', () => {
    renderHead();

    expect(screen.getByRole('heading', { name: '불량코드 상세' })).toBeInTheDocument();
    expect(screen.getByText('DF-11')).toBeInTheDocument();
    expect(screen.getByText('스크래치')).toBeInTheDocument();
    expect(screen.getByText('상세')).toBeInTheDocument();
    expect(screen.getByText('DF-10 · 외관')).toBeInTheDocument();
  });

  it('한국어명 · 베트남어명 · 처분 유형 · 공정을 이름표 상자에 낸다(#209)', () => {
    renderHead({
      code: {
        id: 1002,
        code: 'DF-11',
        name: '스크래치',
        parentId: 1001,
        isActive: true,
        nameKo: '스크래치 한글',
        nameVi: 'Trầy xước',
        processId: 7001,
        dispositionTypeCode: 'SCRAP',
      },
      processLabel: 'P-10 · 조립',
    });

    expect(screen.getByText('스크래치 한글')).toBeInTheDocument();
    expect(screen.getByText('Trầy xước')).toBeInTheDocument();
    expect(screen.getByText('폐기')).toBeInTheDocument();
    expect(screen.getByText('P-10 · 조립')).toBeInTheDocument();
  });

  /* 사용 여부 · 사용된 기록 · 사용 중지/재사용 · 수정은 목록 줄로 옮겼다(#360). */
  it('값이 없으면 「—」, 사용 칩 · 사용된 기록 · 사용 중지 · 수정은 상세에 없다', () => {
    renderHead();

    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText('사용된 기록')).not.toBeInTheDocument();
    expect(screen.queryByText('사용')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '수정' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '사용 중지' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '재사용' })).not.toBeInTheDocument();
  });

  it('대분류에는 상위 칸이 없다', () => {
    renderHead({
      code: { id: 1001, code: 'DF-10', name: '외관', parentId: null, isActive: true },
      parentLabel: null,
    });

    expect(screen.getByText('대분류')).toBeInTheDocument();
    expect(screen.queryByText('상위 대분류')).not.toBeInTheDocument();
  });

  it('미사용 대분류에는 하위 코드 추가 단추와 안내 문구가 없다(#209)', () => {
    renderHead({
      code: { id: 1001, code: 'DF-10', name: '외관', parentId: null, isActive: false },
      parentLabel: null,
      onAddChild: vi.fn(),
    });

    expect(screen.queryByRole('button', { name: '하위 코드 추가' })).not.toBeInTheDocument();
    expect(screen.queryByText(/할 수 없습니다/)).not.toBeInTheDocument();
  });

  it('사용 중인 대분류는 하위 코드 추가를 누를 수 있다', async () => {
    const { props, user } = renderHead({
      code: { id: 1001, code: 'DF-10', name: '외관', parentId: null, isActive: true },
      parentLabel: null,
      onAddChild: vi.fn(),
    });

    await user.click(screen.getByRole('button', { name: '하위 코드 추가' }));
    expect(props.onAddChild).toHaveBeenCalledTimes(1);
  });
});
