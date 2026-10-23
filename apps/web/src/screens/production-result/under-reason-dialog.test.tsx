import { setLocale } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UnderReasonDialog } from './under-reason-dialog';

const reason = (code: string, codeName: string, nameVi: string | null) => ({
  codeValueId: code.length,
  codeGroupId: 1,
  code,
  codeName,
  nameVi,
  displayOrder: 1,
  isActive: true,
});

afterEach(() => {
  setLocale('ko');
});

describe('UnderReasonDialog', () => {
  it('사유 이름은 화면 언어로, 없으면 기본 이름이다', () => {
    setLocale('vi');
    render(
      <UnderReasonDialog
        open
        reasons={[
          reason('MATERIAL_SHORT', '자재 부족', 'Thiếu vật tư'),
          reason('ETC', '기타', null),
        ]}
        isLoading={false}
        isError={false}
        error={null}
        summary="Mục tiêu 12 EA · Thực tế 7 EA"
        onPick={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Thiếu vật tư' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '기타' })).toBeInTheDocument();
    expect(within(dialog).getByText('Mục tiêu 12 EA · Thực tế 7 EA')).toBeInTheDocument();
  });
});
