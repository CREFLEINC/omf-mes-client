import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

  const renderNotice = (guides: Record<string, unknown>[] | undefined) =>
    renderWithProviders(<InspectionGuideNotice inspectionRequestId={7} />, {
      fetch: createStubFetch([
        {
          match: (request) => new URL(request.url).pathname === '/quality/inspection-requests/7',
          respond: () =>
            jsonResponse({
              inspectionRequestId: 7,
              ...(guides === undefined ? {} : { inspectionGuides: guides }),
            }),
        },
      ]),
    });

  it('품목 안내만 있으면 이름표 없이 줄바꿈 그대로 보인다', async () => {
    renderNotice([
      { scopeCode: 'ITEM', guideTextKo: '장갑 착용\n도면 3번 확인', guideTextVi: null },
    ]);

    const note = await screen.findByRole('note', { name: '검사 안내' });
    expect(note.querySelector('.inspection-guide-block span')?.textContent).toBe(
      '장갑 착용\n도면 3번 확인',
    );
    expect(note.querySelector('.inspection-guide-scope')).toBeNull();
  });

  it('공통 · 품목 안내가 함께 있으면 공통을 위에 이름표와 함께 보인다(#252)', async () => {
    renderNotice([
      { scopeCode: 'COMMON', guideTextKo: null, guideTextVi: 'Xác nhận NG' },
      { scopeCode: 'ITEM', guideTextKo: '도면 3번', guideTextVi: null },
    ]);

    const note = await screen.findByRole('note', { name: '검사 안내' });
    expect(
      [...note.querySelectorAll('.inspection-guide-scope')].map((el) => el.textContent),
    ).toEqual(['공통 안내', '품목 안내']);
    /* 한국어 화면이라도 한국어 칸이 비면 베트남어 문구를 보인다. */
    expect(note).toHaveTextContent('Xác nhận NG');
  });

  it('안내가 없으면 아무것도 그리지 않는다', async () => {
    const { container } = renderNotice(undefined);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container.querySelector('.inspection-guide-note')).toBeNull();
  });

  describe('2줄 접기', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    /* 시험 환경은 그리지 않는다 — 그려진 높이(scrollHeight > clientHeight)를 흉내 낸다. */
    const drawnLines = (lines: number) => {
      vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(lines * 16);
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(Math.min(lines, 2) * 16);
    };

    it('2줄 이하로 그려지면 「펼치기」가 없다', async () => {
      drawnLines(2);
      renderNotice([{ scopeCode: 'ITEM', guideTextKo: '장갑 착용\n도면 3번 확인', guideTextVi: null }]);

      await screen.findByRole('note', { name: '검사 안내' });
      expect(screen.queryByRole('button', { name: '펼치기' })).toBeNull();
    });

    it('2줄을 넘으면 「펼치기」로 펼치고 「접기」로 다시 접는다', async () => {
      drawnLines(5);
      renderNotice([{ scopeCode: 'ITEM', guideTextKo: '1\n2\n3\n4\n5', guideTextVi: null }]);

      const note = await screen.findByRole('note', { name: '검사 안내' });
      const body = note.querySelector('.inspection-guide-blocks');
      expect(body).not.toHaveAttribute('data-expanded');

      fireEvent.click(await screen.findByRole('button', { name: '펼치기' }));
      expect(body).toHaveAttribute('data-expanded', 'true');

      fireEvent.click(screen.getByRole('button', { name: '접기' }));
      expect(body).not.toHaveAttribute('data-expanded');
      expect(screen.getByRole('button', { name: '펼치기' })).toBeInTheDocument();
    });
  });
});
