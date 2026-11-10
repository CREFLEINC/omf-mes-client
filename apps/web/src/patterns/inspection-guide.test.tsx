import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../test/api-harness';
import { InspectionGuideNotice, guideTextOf } from './inspection-guide';

/** omf-all-around#252 — 검사 기준 버전 안내 문구 띠. */
describe('검사 안내 문구', () => {
  it('화면 언어의 문구를 쓰고, 비었으면 다른 언어 문구를 쓴다', () => {
    const both = { guideTextKo: '장갑 착용', guideTextVi: 'Đeo găng tay' };
    expect(guideTextOf(both, 'ko')).toBe('장갑 착용');
    expect(guideTextOf(both, 'vi')).toBe('Đeo găng tay');
    expect(guideTextOf({ guideTextKo: '장갑 착용', guideTextVi: '  ' }, 'vi')).toBe('장갑 착용');
    expect(guideTextOf({ guideTextKo: null, guideTextVi: null }, 'ko')).toBeNull();
    expect(guideTextOf(undefined, 'ko')).toBeNull();
  });

  const renderNotice = (version: Record<string, unknown>) =>
    renderWithProviders(<InspectionGuideNotice inspectionPlanVersionId={13} />, {
      fetch: createStubFetch([
        {
          match: (request) =>
            new URL(request.url).pathname === '/quality/inspection-plan-versions/13',
          respond: () =>
            jsonResponse({
              inspectionPlanVersion: { inspectionPlanVersionId: 13, ...version },
              editability: { codeEditable: false, reason: 'REFERENCED', referenceCount: 1 },
            }),
        },
      ]),
    });

  it('기준 버전에 문구가 있으면 줄바꿈 그대로 안내 띠로 보인다', async () => {
    renderNotice({ guideTextKo: '장갑 착용\n도면 3번 확인', guideTextVi: null });

    const note = await screen.findByRole('note', { name: '검사 안내' });
    expect(note).toHaveTextContent('장갑 착용 도면 3번 확인');
    expect(note.querySelector('span:last-child')?.textContent).toBe('장갑 착용\n도면 3번 확인');
  });

  it('문구가 없으면 아무것도 그리지 않는다', async () => {
    const { container } = renderNotice({ guideTextKo: null, guideTextVi: null });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container.querySelector('.inspection-guide-note')).toBeNull();
  });
});
