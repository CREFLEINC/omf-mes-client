import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { inspectionPlanVersionFixtures } from './fixtures';
import { versionToFormValues } from './version-mappers';
import { VersionSummary } from './version-summary';

const t = messages.inspectionStandard;
const values = versionToFormValues(inspectionPlanVersionFixtures[0]!);

/* AQL 은 IQC 기준에서만 쓴다(사용자 지시 · omf-all-around#264). */
describe('VersionSummary — AQL 칸', () => {
  it('IQC 기준이면 AQL 칸을 낸다', () => {
    render(<VersionSummary values={values} showAql />);

    expect(screen.getByText(t.fields.aqlValue)).toBeInTheDocument();
  });

  it('IQC 기준이 아니면 AQL 칸을 내지 않는다', () => {
    render(<VersionSummary values={values} showAql={false} />);

    expect(screen.queryByText(t.fields.aqlValue)).not.toBeInTheDocument();
    expect(screen.getByText(t.versionSection.effectivePeriod)).toBeInTheDocument();
  });
});
