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
    referenceCount: null,
    onEdit: vi.fn(),
    onDeactivate: vi.fn(),
    ...overrides,
  };

  render(<CodeDetailHead {...props} />);

  return { props, user: userEvent.setup() };
};

describe('CodeDetailHead (#209)', () => {
  it('제목 · 사용 칩과 이름표 상자(코드 · 명칭 · 구분 · 상위)를 낸다', () => {
    renderHead();

    expect(screen.getByRole('heading', { name: '불량코드 상세' })).toBeInTheDocument();
    expect(screen.getByText('사용')).toBeInTheDocument();
    expect(screen.getByText('DF-11')).toBeInTheDocument();
    expect(screen.getByText('스크래치')).toBeInTheDocument();
    expect(screen.getByText('상세')).toBeInTheDocument();
    expect(screen.getByText('DF-10 · 외관')).toBeInTheDocument();
  });

  it('한국어명 · 베트남어명 · 처분 유형 · 공정 · 사용 중 건수를 이름표 상자에 낸다(#209)', () => {
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
      referenceCount: 3,
    });

    expect(screen.getByText('스크래치 한글')).toBeInTheDocument();
    expect(screen.getByText('Trầy xước')).toBeInTheDocument();
    expect(screen.getByText('폐기')).toBeInTheDocument();
    expect(screen.getByText('P-10 · 조립')).toBeInTheDocument();
    expect(screen.getByText('3건')).toBeInTheDocument();
  });

  it('값이 없으면 「—」, 서버가 셀 수 없는 사용 건수는 칸을 내지 않는다', () => {
    renderHead();

    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText('사용된 기록')).not.toBeInTheDocument();
  });

  it('대분류에는 상위 칸이 없다', () => {
    renderHead({
      code: { id: 1001, code: 'DF-10', name: '외관', parentId: null, isActive: true },
      parentLabel: null,
    });

    expect(screen.getByText('대분류')).toBeInTheDocument();
    expect(screen.queryByText('상위 대분류')).not.toBeInTheDocument();
  });

  it('수정을 누르면 수정 창을 연다', async () => {
    const { props, user } = renderHead();

    await user.click(screen.getByRole('button', { name: '수정' }));

    expect(props.onEdit).toHaveBeenCalled();
  });

  it('사용 중인 코드는 사용 중지를 시작할 수 있다', async () => {
    const { props, user } = renderHead();

    await user.click(screen.getByRole('button', { name: '사용 중지' }));

    expect(props.onDeactivate).toHaveBeenCalled();
  });

  it('이미 미사용이면 사용 중지가 비활성이고 사유가 보인다', () => {
    renderHead({
      code: { id: 1002, code: 'DF-11', name: '스크래치', parentId: 1001, isActive: false },
    });

    const button = screen.getByRole('button', { name: '사용 중지' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-describedby');
    expect(screen.getByText('미사용')).toBeInTheDocument();
    expect(
      screen.getByText('사용 중지는 이미 미사용인 코드에는 할 수 없습니다.'),
    ).toBeInTheDocument();
  });
});
