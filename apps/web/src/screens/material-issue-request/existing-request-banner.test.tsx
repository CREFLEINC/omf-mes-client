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
 * 요청 시각은 **공장 시각(베트남, UTC+7)** 으로 보인다(omf-all-around#20). offset 이 붙은 값은
 * 그 순간을 공장 시각으로 옮기고, 브라우저 시간대와는 상관없다.
 */
describe('formatRequiredAt (리뷰 m-3)', () => {
  it('offset 이 붙은 값을 공장 시각의 날짜와 분까지로 보인다', () => {
    expect(formatRequiredAt('2026-09-01T14:00:00+09:00')).toBe('2026-09-01 12:00');
  });

  it('같은 순간이면 offset 이 달라도 같은 공장 시각이다', () => {
    expect(formatRequiredAt('2026-09-01T05:00:00Z')).toBe('2026-09-01 12:00');
    expect(formatRequiredAt('2026-09-01T12:00:00+07:00')).toBe('2026-09-01 12:00');
  });

  it('다른 순간이면 글자가 같아도 다른 공장 시각이다 — 자정을 넘기면 날짜도 바뀐다', () => {
    expect(formatRequiredAt('2026-09-01T14:00:00Z')).toBe('2026-09-01 21:00');
    expect(formatRequiredAt('2026-09-01T20:00:00Z')).toBe('2026-09-02 03:00');
  });

  it('값이 없으면 빈 값 표시로 낸다', () => {
    expect(formatRequiredAt(null)).toBe(t.values.empty);
  });

  it('꼴을 못 알아보면 **건드리지 않는다** — 없는 시각을 지어내지 않는다', () => {
    expect(formatRequiredAt('언젠가')).toBe('언젠가');
  });
});
