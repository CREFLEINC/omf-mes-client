import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { inspectionPlanVersionFixtures } from './fixtures';
import { VersionGuideDialog } from './version-guide-dialog';
import { versionToFormValues } from './version-mappers';
import { VersionSummary } from './version-summary';

const t = messages.inspectionStandard;

/** omf-all-around#252 — 안내 문구는 버전 요약의 언어별 「수정」 창에서 고친다. */
describe('안내 문구 언어별 수정', () => {
  const values = { ...versionToFormValues(inspectionPlanVersionFixtures[0]!), guideTextKo: '장갑 착용' };
  const summary = (onEditGuide?: (field: 'guideTextKo' | 'guideTextVi') => void) =>
    render(
      <VersionSummary
        values={values}
        inspectionFrequencyOptions={[]}
        frequencyIntervalUomOptions={[]}
        onEditGuide={onEditGuide}
      />,
    );

  it('고칠 수 있는 버전은 비어 있는 언어도 보이고 줄마다 수정 단추가 있다', async () => {
    const onEditGuide = vi.fn();
    const { container } = summary(onEditGuide);

    expect(
      [...container.querySelectorAll('.inspection-standard-guide-line dd')].map((dd) => dd.textContent),
    ).toEqual(['장갑 착용', t.versionSection.notSet]);
    await userEvent.click(
      screen.getByRole('button', { name: t.versionSection.editGuide(t.fields.guideTextVi) }),
    );
    expect(onEditGuide).toHaveBeenCalledWith('guideTextVi');
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
});
