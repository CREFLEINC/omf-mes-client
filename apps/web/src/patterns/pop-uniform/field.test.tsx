import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PuScanField } from './field';
import { PuSearchBox } from './search-box';

const t = messages.popUniform;

/* [직접 입력] 창 — 제목 없이 칸 · 글자판 · 단추만, 칸 안 안내는 「… 을/를 입력하세요」(#295 · 사용자 지시 2026-11-19). */
describe('PuScanField [직접 입력] 창', () => {
  it('화면 칸에는 흐린 안내가 없고, 창은 제목 없이 「출하번호를 입력하세요」를 보인다', async () => {
    const onSubmit = vi.fn();
    render(
      <PuScanField label="출하번호" value="" onChange={() => undefined} onSubmit={onSubmit} />,
    );

    expect(screen.getByLabelText('출하번호').getAttribute('placeholder')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: t.scan.manual }));
    const dialog = screen.getByRole('dialog', { name: '출하번호 입력' });
    expect(dialog.querySelector('.pu-dialog-head')).toBeNull();
    const input = within(dialog).getByRole('textbox', { name: '출하번호' });
    expect(input.getAttribute('placeholder')).toBe('출하번호를 입력하세요');

    await userEvent.type(input, 'SH-1{Enter}');
    expect(onSubmit).toHaveBeenCalledWith('SH-1');
  });

  it('찾기 창은 단추가 [검색]이고 받침이 있으면 「을 입력하세요」', async () => {
    render(
      <PuScanField
        label="자재 관리 LOT 번호 또는 품목의 코드나 이름"
        value=""
        onChange={() => undefined}
        onSubmit={() => undefined}
        manual={{ search: true }}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: t.scan.manual }));
    expect(screen.getByRole('button', { name: t.scan.search })).toBeTruthy();
    const dialog = screen.getByRole('dialog', {
      name: '자재 관리 LOT 번호 또는 품목의 코드나 이름 입력',
    });
    expect(
      within(dialog)
        .getByRole('textbox', { name: '자재 관리 LOT 번호 또는 품목의 코드나 이름' })
        .getAttribute('placeholder'),
    ).toBe('자재 관리 LOT 번호 또는 품목의 코드나 이름을 입력하세요');
  });
});

describe('PuSearchBox', () => {
  it('넣을 값의 이름이 칸 위에 서고, 창 안 칸 안내는 「… 을/를 입력하세요」다', async () => {
    render(
      <PuSearchBox
        label="찾기"
        heading="공급사 또는 품목의 코드나 이름"
        value=""
        onChange={() => undefined}
      />,
    );

    expect(screen.getByText('공급사 또는 품목의 코드나 이름')).toBeTruthy();
    const box = screen.getByRole('searchbox', { name: '찾기' });
    expect(box.getAttribute('placeholder')).toBeNull();

    await userEvent.click(box);
    expect(screen.getByRole('dialog', { name: '찾기 입력' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: '찾기' }).getAttribute('placeholder')).toBe(
      '공급사 또는 품목의 코드나 이름을 입력하세요',
    );
  });
});
