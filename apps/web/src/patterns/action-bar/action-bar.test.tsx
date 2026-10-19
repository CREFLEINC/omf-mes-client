import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ActionBar } from './action-bar';

const t = messages.common.processPage;

describe('ActionBar (C-3·C-4·C-5)', () => {
  it('남은 일을 보이고 비활성 주 동작과 잇는다', () => {
    render(
      <ActionBar remaining="입고 창고를 고르세요." remainingId="r1">
        <Button disabled aria-describedby="r1">
          다음
        </Button>
      </ActionBar>,
    );

    expect(screen.getByRole('region', { name: t.actionBar })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다음' })).toHaveAccessibleDescription(
      `${t.remaining}: 입고 창고를 고르세요.`,
    );
  });
});
