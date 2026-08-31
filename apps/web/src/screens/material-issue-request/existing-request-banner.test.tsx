import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ExistingRequestBanner, formatRequiredAt } from './existing-request-banner';
import { existingRequestFixtures } from './fixtures';
import { toExistingRequestView } from './types';

const t = messages.materialIssueRequest;

/** 최소 갈래 — 0건이면 아무것도 그리지 않고, 있으면 요청번호를 그대로 나열한다. */

const requests = existingRequestFixtures.map(toExistingRequestView);

describe('ExistingRequestBanner', () => {
  it('0건이면 아무것도 그리지 않는다', () => {
    const { container } = render(<ExistingRequestBanner requests={[]} total={0} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('2건이면 요청번호 둘이 보인다', () => {
    render(<ExistingRequestBanner requests={requests} total={requests.length} />);

    expect(screen.getByText(t.warnings.existingRequestsTitle)).toBeInTheDocument();
    expect(screen.getByText(/SAMPLE-MIR-0001/)).toBeInTheDocument();
    expect(screen.getByText(/SAMPLE-MIR-0002/)).toBeInTheDocument();
  });

  it('필요 시각이 없는 요청도 나열한다 — 상태 글자를 그대로 보인다', () => {
    render(<ExistingRequestBanner requests={requests} total={requests.length} />);

    expect(screen.getByText(/SAMPLE_MIR_S_B/)).toBeInTheDocument();
  });

  /**
   * ⚠ **건수는 쪽 길이가 아니라 전체다**(리뷰 m-2). 쪽 크기를 서버가 정하므로 첫 쪽 길이로
   * 말하면 요청이 쌓인 W/O 에서 실제보다 적게 단언한다 — 중복 경고의 값이 그만큼 깎인다.
   */
  it('보이는 줄보다 전체가 많으면 전체 건수로 말하고 잘렸음을 밝힌다', () => {
    render(<ExistingRequestBanner requests={requests} total={9} />);

    expect(screen.getByText(t.warnings.existingRequests(9))).toBeInTheDocument();
    expect(screen.getByText(t.warnings.existingRequestsTruncated)).toBeInTheDocument();
  });

  it('전체가 보이는 줄과 같으면 잘림 안내를 내지 않는다', () => {
    render(<ExistingRequestBanner requests={requests} total={requests.length} />);

    expect(screen.queryByText(t.warnings.existingRequestsTruncated)).not.toBeInTheDocument();
  });
});

/**
 * ⛔ **다시 계산하지 않고 자르기만 한다.** 서버가 offset 을 붙여 보낸 값이라 그 자리의 시각이
 * 정본이고, `Date` 로 파싱해 되찍으면 브라우저 시간대에 따라 다른 순간으로 보인다.
 */
describe('formatRequiredAt (리뷰 m-3)', () => {
  it('offset 을 뗀 날짜와 분까지만 보인다', () => {
    expect(formatRequiredAt('2026-09-01T14:00:00+09:00')).toBe('2026-09-01 14:00');
  });

  it('시간대가 달라도 글자를 옮기지 않는다 — 자르기만 한다', () => {
    expect(formatRequiredAt('2026-09-01T14:00:00Z')).toBe('2026-09-01 14:00');
  });

  it('값이 없으면 빈 값 표시로 낸다', () => {
    expect(formatRequiredAt(null)).toBe(t.values.empty);
  });

  it('꼴을 못 알아보면 **건드리지 않는다** — 없는 시각을 지어내지 않는다', () => {
    expect(formatRequiredAt('언젠가')).toBe('언젠가');
  });
});
