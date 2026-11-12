import { messages, setLocale } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { inspectionPlanVersionFixtures } from './fixtures';
import { VersionGuideDialog } from './version-guide-dialog';
import { versionToFormValues } from './version-mappers';
import { VersionGuideRow } from './version-setting-row';

const t = messages.inspectionStandard;

/** omf-all-around#252 · #261 — 지시문은 한 칸이다. 「검사 지시문」 줄(#258)에서 보이고 「지시문 수정」 창에서 고친다. */
describe('지시문 수정', () => {
  const values = {
    ...versionToFormValues(inspectionPlanVersionFixtures[0]!),
    guideText: '장갑 착용',
  };
  const summary = (onEditGuide?: (field: 'guideText') => void) =>
    render(<VersionGuideRow values={values} onEditGuide={onEditGuide} />);

  const guideLines = (container: HTMLElement) =>
    [...container.querySelectorAll('.inspection-standard-guide-text')].map(
      (line) => line.textContent,
    );

  it('지시문 한 칸을 보이고 고친다 — 화면 언어와 상관없다', async () => {
    setLocale('vi');
    try {
      const onEditGuide = vi.fn();
      const { container } = summary(onEditGuide);

      expect(guideLines(container)).toEqual(['장갑 착용']);
      await userEvent.click(
        screen.getByRole('button', { name: t.versionSection.editGuide(t.fields.guideText) }),
      );
      expect(onEditGuide).toHaveBeenCalledWith('guideText');
    } finally {
      setLocale('ko');
    }
  });

  it('비어 있으면 「등록된 지시문 없음」으로 보인다', () => {
    render(<VersionGuideRow values={{ ...values, guideText: '' }} onEditGuide={vi.fn()} />);

    expect(screen.getByText(t.versionSection.guideNoneTitle)).toBeInTheDocument();
    expect(screen.getByText(t.versionSection.guideNoneDescription)).toBeInTheDocument();
  });

  it('잠긴 버전은 수정 단추가 없다', () => {
    summary();

    expect(screen.queryByRole('button', { name: /수정/ })).toBeNull();
  });

  it('창은 보이는 값에서 시작하고, 바꾸기 전에는 확인을 막는다', async () => {
    const onSave = vi.fn();
    render(
      <VersionGuideDialog
        field="guideText"
        initialText="장갑 착용"
        onSave={onSave}
        onClose={() => {}}
      />,
    );

    const save = screen.getByRole('button', { name: messages.common.confirm });
    expect(save).toBeDisabled();

    await userEvent.type(screen.getByRole('textbox'), '\n도면 3번');
    await userEvent.click(save);
    expect(onSave).toHaveBeenCalledWith('장갑 착용\n도면 3번');
  });

  /* DS TextArea 는 maxLength 로 입력을 막지 않는다 — 3000자를 넘으면 확인을 막고 칸에 알린다. */
  it('3000자를 넘으면 확인을 막고 알린다', async () => {
    render(
      <VersionGuideDialog field="guideText" initialText="" onSave={() => {}} onClose={() => {}} />,
    );

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.paste('가'.repeat(3001));
    expect(screen.getByRole('button', { name: messages.common.confirm })).toBeDisabled();
    expect(screen.getByText(t.versionSection.guideTooLong(3000))).toBeInTheDocument();
  });
});
