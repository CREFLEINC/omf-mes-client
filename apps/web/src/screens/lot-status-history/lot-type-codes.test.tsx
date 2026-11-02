import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderWithProviders } from '../../test/api-harness';
import { useLotTypeCodes } from './queries';

const Probe = ({ lotIds }: { lotIds: number[] }) => {
  const codes = useLotTypeCodes(lotIds);
  return <p>{[...codes.entries()].map(([id, code]) => `${String(id)}:${code}`).join(',')}</p>;
};

const detail = (lotId: number) => ({
  lot: {
    lotId,
    lotNo: `LOT-${String(lotId)}`,
    itemId: 1,
    lotTypeCode: lotId === 1 ? 'MATERIAL' : 'PRODUCTION',
    statusCode: 'NORMAL',
    initialQty: 1,
    uomId: 1,
    sourceTypeCode: 'RECEIPT',
    sourceId: 1,
  },
});

describe('useLotTypeCodes — LOT 상태 이력의 유형 라벨', () => {
  it('보이는 줄의 LOT 만, 같은 LOT 은 한 번만 상세를 읽는다', async () => {
    const paths: string[] = [];
    renderWithProviders(<Probe lotIds={[1, 2, 1]} />, {
      fetch: (request) => {
        const path = new URL(request.url).pathname;
        paths.push(path);
        return Promise.resolve(jsonResponse(detail(Number(path.split('/').pop()))));
      },
    });

    expect(await screen.findByText('1:MATERIAL,2:PRODUCTION')).toBeInTheDocument();
    expect(paths.filter((path) => path.startsWith('/trace/lots/')).sort()).toEqual([
      '/trace/lots/1',
      '/trace/lots/2',
    ]);
  });
});
