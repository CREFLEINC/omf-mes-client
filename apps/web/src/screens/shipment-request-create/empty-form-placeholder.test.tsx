import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmptyFormPlaceholder } from './empty-form-placeholder';

const t = messages.shipmentRequestCreate;

describe('EmptyFormPlaceholder', () => {
  it('안내만 낸다 — [ERP S/O 없이 생성]은 조회 조건 줄로 옮겼다(#360)', () => {
    render(<EmptyFormPlaceholder />);

    expect(screen.getByText(t.empty.noTargetTitle)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.actions.startStandalone })).toBeNull();
  });
});
