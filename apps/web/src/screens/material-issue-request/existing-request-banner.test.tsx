import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ExistingRequestBanner } from './existing-request-banner';
import { existingRequestFixtures } from './fixtures';
import { toExistingRequestView } from './types';

const t = messages.materialIssueRequest;

/** 최소 갈래 — 0건이면 아무것도 그리지 않고, 있으면 요청번호를 그대로 나열한다. */

describe('ExistingRequestBanner', () => {
  it('0건이면 아무것도 그리지 않는다', () => {
    const { container } = render(<ExistingRequestBanner requests={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('2건이면 요청번호 둘이 보인다', () => {
    render(<ExistingRequestBanner requests={existingRequestFixtures.map(toExistingRequestView)} />);

    expect(screen.getByText(t.warnings.existingRequestsTitle)).toBeInTheDocument();
    expect(screen.getByText(/SAMPLE-MIR-0001/)).toBeInTheDocument();
    expect(screen.getByText(/SAMPLE-MIR-0002/)).toBeInTheDocument();
  });

  it('필요 시각이 없는 요청도 나열한다 — 상태 글자를 그대로 보인다', () => {
    render(<ExistingRequestBanner requests={existingRequestFixtures.map(toExistingRequestView)} />);

    expect(screen.getByText(/SAMPLE_MIR_S_B/)).toBeInTheDocument();
  });
});
