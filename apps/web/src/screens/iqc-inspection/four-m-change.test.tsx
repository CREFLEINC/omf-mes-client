import { messages } from '@omf-mes/i18n';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import {
  EMPTY_FOUR_M_CHANGE,
  FourMChange,
  type FourMChangeDraft,
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
      <FourMChange draft={EMPTY_FOUR_M_CHANGE} onChange={onChange} disabled={false} />,
    );

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: t.label }));

    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FOUR_M_CHANGE, checked: true });
  });

  it('체크 전에는 [비고 입력]이 없다', () => {
    renderWithProviders(
      <FourMChange draft={EMPTY_FOUR_M_CHANGE} onChange={vi.fn()} disabled={false} />,
    );

    expect(screen.queryByRole('button', { name: t.remarksOpen })).not.toBeInTheDocument();
  });

  it('체크했는데 내용이 비면 [비고 입력] 창을 열 수 있고, 빨간 오류 문구는 없다 · 변경 종류 칸은 없다', async () => {
    renderWithProviders(
      <FourMChange draft={{ checked: true, remarks: '' }} onChange={vi.fn()} disabled={false} />,
    );

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t.remarksOpen }));
    expect(await screen.findByRole('dialog', { name: t.remarksTitle })).toBeInTheDocument();
    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: t.remarksDone }),
    ).toBeDisabled();
    expect(screen.getByRole('textbox', { name: t.remarks })).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('적은 비고는 창을 닫은 뒤에도 상자에 그대로 보인다(#197)', () => {
    renderWithProviders(
      <FourMChange draft={{ checked: true, remarks: '' }} onChange={vi.fn()} disabled={false} />,
    );
    expect(document.querySelector('.iqc-inspection-four-m-remarks')).toBeNull();
    cleanup();

    renderWithProviders(
      <FourMChange
        draft={{ checked: true, remarks: '사출 금형 교체' }}
        onChange={vi.fn()}
        disabled={false}
      />,
    );
    const shown = document.querySelector('.iqc-inspection-four-m-remarks');
    expect(shown).toHaveTextContent(t.remarks);
    expect(shown).toHaveTextContent('사출 금형 교체');
  });

  /** 부르는 쪽처럼 초안을 쥐는 틀 — 체크 · 비고가 실제로 바뀌는 흐름을 본다(#197). */
  const Controlled = ({ initial = EMPTY_FOUR_M_CHANGE }: { initial?: FourMChangeDraft }) => {
    const [draft, setDraft] = useState<FourMChangeDraft>(initial);
    return <FourMChange draft={draft} onChange={setDraft} disabled={false} />;
  };
  const remarksDialog = () => screen.queryByRole('dialog', { name: t.remarksTitle });

  it('체크하면 비고 입력 창이 바로 뜨고, 비고가 비면 [확정]이 꺼진다(#197)', async () => {
    renderWithProviders(<Controlled />);

    await userEvent.click(screen.getByRole('checkbox', { name: t.label }));
    const dialog = await screen.findByRole('dialog', { name: t.remarksTitle });
    const done = within(dialog).getByRole('button', { name: t.remarksDone });
    expect(done).toBeDisabled();

    await userEvent.type(within(dialog).getByRole('textbox', { name: t.remarks }), '설비 변경');
    expect(done).toBeEnabled();
    /* [확정] 전에는 적는 중인 비고를 상자에 보이지 않는다. */
    expect(document.querySelector('.iqc-inspection-four-m-remarks')).toBeNull();
    await userEvent.click(done);
    expect(remarksDialog()).toBeNull();
    expect(screen.getByRole('checkbox', { name: t.label })).toBeChecked();
    expect(document.querySelector('.iqc-inspection-four-m-remarks')).toHaveTextContent('설비 변경');
  });

  it('비고가 이미 있으면 체크해도 창이 뜨지 않고 비고를 그대로 보인다(#197)', async () => {
    renderWithProviders(<Controlled initial={{ checked: false, remarks: '금형 교체' }} />);

    await userEvent.click(screen.getByRole('checkbox', { name: t.label }));
    expect(remarksDialog()).toBeNull();
    expect(document.querySelector('.iqc-inspection-four-m-remarks')).toHaveTextContent('금형 교체');
  });

  it('막 체크하고 뜬 창에서 [취소]하면 체크가 풀린다 — 비고 없는 4M 변경품을 남기지 않는다(#197)', async () => {
    renderWithProviders(<Controlled />);

    await userEvent.click(screen.getByRole('checkbox', { name: t.label }));
    const dialog = await screen.findByRole('dialog', { name: t.remarksTitle });
    await userEvent.type(within(dialog).getByRole('textbox', { name: t.remarks }), '적다 만');
    await userEvent.click(within(dialog).getByRole('button', { name: t.remarksCancel }));

    expect(remarksDialog()).toBeNull();
    expect(screen.getByRole('checkbox', { name: t.label })).not.toBeChecked();
    expect(screen.queryByRole('button', { name: t.remarksOpen })).not.toBeInTheDocument();
  });

  it('비고가 있으면 [수정]으로 다시 열고, [취소]하면 열 때 비고로 돌아간다(#197)', async () => {
    renderWithProviders(<Controlled initial={{ checked: true, remarks: '금형 교체' }} />);

    expect(screen.queryByRole('button', { name: t.remarksOpen })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t.remarksEdit }));
    const dialog = await screen.findByRole('dialog', { name: t.remarksTitle });
    const box = within(dialog).getByRole('textbox', { name: t.remarks });
    await userEvent.clear(box);
    await userEvent.type(box, '다른 내용');
    await userEvent.click(within(dialog).getByRole('button', { name: t.remarksCancel }));

    expect(screen.getByRole('checkbox', { name: t.label })).toBeChecked();
    expect(document.querySelector('.iqc-inspection-four-m-remarks')).toHaveTextContent('금형 교체');
  });
});
