import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderScreen } from './screen-harness';

const t = messages.emergencyWorkOrderField.detail;

describe('단위 이름표', () => {
  it('쓰지 않게 된 단위도 이름을 낸다 — 지난 W/O 의 단위가 「모름」이 되지 않게', async () => {
    const { urls } = renderScreen();

    expect(await screen.findByText(`50 EA`)).toBeInTheDocument();

    const asked = urls.find((url) => url.startsWith('/mdm/uoms')) ?? '';
    expect(new URL(asked, 'http://api.test').searchParams.get('includeInactive')).toBe('true');
  });

  it('이름표 조회가 실패해도 숫자 식별자로 물러나지 않는다', async () => {
    renderScreen({ uomsStatus: 500 });

    expect(await screen.findByText(`50 ${t.unknown}`)).toBeInTheDocument();
    expect(screen.queryByText(/\b11\b/)).not.toBeInTheDocument();
  });
});
