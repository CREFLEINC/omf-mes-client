import { messages, setLocale } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { inspectionPlanVersionFixtures } from './fixtures';
import { VersionGuideDialog } from './version-guide-dialog';
import { versionToFormValues } from './version-mappers';
import { VersionSummary } from './version-summary';

const t = messages.inspectionStandard;

/** omf-all-around#252 — 지시문은 버전 요약에서 화면 언어 칸 하나만 보이고 「수정」 창에서 고친다. */
describe('지시문 수정', () => {
  const values = {
    ...versionToFormValues(inspectionPlanVersionFixtures[0]!),
    guideTextKo: '장갑 착용',
  };
  const summary = (onEditGuide?: (field: 'guideTextKo' | 'guideTextVi') => void) =>
    render(
      <VersionSummary
        values={values}
        inspectionFrequencyOptions={[]}
        frequencyIntervalUomOptions={[]}
        onEditGuide={onEditGuide}
      />,
    );

  const guideLines = (container: HTMLElement) =>
    [...container.querySelectorAll('.inspection-standard-guide-line dd')].map(
      (dd) => dd.textContent,
    );

  it('한국어 화면은 한국어 지시문만 보이고 고친다', async () => {
    const onEditGuide = vi.fn();
    const { container } = summary(onEditGuide);

    expect(guideLines(container)).toEqual(['장갑 착용']);
    expect(screen.queryByText(t.fields.guideTextVi)).toBeNull();
    await userEvent.click(
      screen.getByRole('button', { name: t.versionSection.editGuide(t.fields.guideTextKo) }),
    );
    expect(onEditGuide).toHaveBeenCalledWith('guideTextKo');
  });

  it('베트남어 화면은 베트남어 지시문만 — 비어 있어도 고칠 수 있게 미설정으로 보인다', async () => {
    setLocale('vi');
    try {
      const onEditGuide = vi.fn();
      const { container } = summary(onEditGuide);

      expect(guideLines(container)).toEqual([t.versionSection.notSet]);
      await userEvent.click(
        screen.getByRole('button', { name: t.versionSection.editGuide(t.fields.guideTextVi) }),
      );
      expect(onEditGuide).toHaveBeenCalledWith('guideTextVi');
    } finally {
      setLocale('ko');
    }
  });

  it('잠긴 버전은 수정 단추가 없고 빈 언어 줄을 두지 않는다', () => {
    summary();

    expect(screen.queryByRole('button', { name: /수정/ })).toBeNull();
    expect(screen.queryByText(t.fields.guideTextVi)).toBeNull();
  });

  it('창은 저장값에서 시작하고, 바꾸기 전에는 저장을 막는다', async () => {
    const onSave = vi.fn();
    render(
      <VersionGuideDialog
        field="guideTextKo"
        initialText="장갑 착용"
        isSaving={false}
        banner={null}
        onSave={onSave}
        onClose={() => {}}
      />,
    );

    const save = screen.getByRole('button', { name: messages.common.save });
    expect(save).toBeDisabled();

    await userEvent.type(screen.getByRole('textbox'), '\n도면 3번');
    await userEvent.click(save);
    expect(onSave).toHaveBeenCalledWith('장갑 착용\n도면 3번');
  });

  /* DS TextArea 는 maxLength 로 입력을 막지 않는다 — 3000자를 넘으면 저장을 막고 칸에 알린다. */
  it('3000자를 넘으면 저장을 막고 알린다', async () => {
    render(
      <VersionGuideDialog
        field="guideTextKo"
        initialText=""
        isSaving={false}
        banner={null}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.paste('가'.repeat(3001));
    expect(screen.getByRole('button', { name: messages.common.save })).toBeDisabled();
    expect(screen.getByText(t.versionSection.guideTooLong(3000))).toBeInTheDocument();
  });
});
