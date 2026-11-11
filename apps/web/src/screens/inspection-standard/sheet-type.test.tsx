import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { InspectionStandardRoute } from './sheet-type';

/* 화면 본체는 각자 테스트가 있다 — 여기서는 검사 기준 탭이 어느 화면을 붙이는지만 본다(#255). */
const oaSheet = vi.hoisted(() => ({ on: false }));
vi.mock('./type-options', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./type-options')>()),
  useSheetForPqc: () => oaSheet.on,
}));
vi.mock('./screen', () => ({ InspectionStandardScreen: () => <p>검사 기준 화면</p> }));
/* 실제 화면처럼 붙을 때의 값만 기억한다 — 이동 기록에서 값을 지운 뒤에도 새 편집은 열린 채다. */
vi.mock('../inspection-sheet-template/screen', async () => {
  const { useState } = await import('react');
  return {
    InspectionSheetTemplateScreen: ({ startBasics }: { startBasics?: { itemLabel: string } }) => {
      const [label] = useState(startBasics?.itemLabel);
      return (
        <p>{label === undefined ? '검사표 기준 화면' : `검사표 기준 화면 · 새 편집 ${label}`}</p>
      );
    },
  };
});

const render = (search: string) =>
  renderWithProviders(<InspectionStandardRoute />, {
    route: `/master-data/inspection-standard${search}`,
    dataRouter: true,
  });

describe('InspectionStandardRoute — OA 공장 계정의 PQC(#255)', () => {
  afterEach(() => {
    oaSheet.on = false;
  });

  it('OA 공장 계정이 PQC 를 고르면 검사표 기준 화면을 연다', () => {
    oaSheet.on = true;
    render('?type=PQC');

    expect(screen.getByText('검사표 기준 화면')).toBeInTheDocument();
  });

  it('부품 공장 계정은 PQC 를 골라도 검사 기준 화면이다', () => {
    render('?type=PQC');

    expect(screen.getByText('검사 기준 화면')).toBeInTheDocument();
  });

  it('「기준 추가」 창에서 채운 검사표 기본 정보를 들고 넘어오면 새 편집을 열고 이동 기록에서 지운다', async () => {
    oaSheet.on = true;
    const { router } = render('');

    await act(() =>
      router?.navigate('/master-data/inspection-standard?type=PQC', {
        state: {
          sheetBasics: {
            templateCode: 'SYN-SHEET-01',
            templateName: '합성 검사표',
            itemId: 7,
            itemLabel: '모델 A',
            businessUnitId: 1,
            formLayoutCode: 'OP',
          },
        },
      }),
    );

    expect(screen.getByText('검사표 기준 화면 · 새 편집 모델 A')).toBeInTheDocument();
    await waitFor(() => {
      expect(router?.state.location.state).toBeNull();
    });
    expect(router?.state.location.search).toBe('?type=PQC');
  });
});
