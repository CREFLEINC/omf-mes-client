import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_REJECTION, RejectionReason, type RejectionDraft } from './rejection-reason';

const t = messages.iqcInspection.result.rejection;
const codes = [
  { defectCodeId: 1, defectCode: 'A', defectName: '대분류-상세있음', isActive: true },
  { defectCodeId: 2, defectCode: 'A-1', defectName: '상세', parentDefectCodeId: 1, isActive: true },
  { defectCodeId: 3, defectCode: 'B', defectName: '대분류-상세없음', isActive: true },
];

const renderReason = (draft: RejectionDraft) =>
  render(
    <RejectionReason codes={codes} causes={[]} draft={draft} onChange={vi.fn()} disabled={false} />,
  );

/* 3단계 검증 — 대분류·상세 2열 + 사유 전체 폭, 라벨은 입력 위, 필수 누락은 그 칸 아래(omf-all-around#106). */
describe('RejectionReason 배치', () => {
  it('처음에는 대분류 아래에 누락을 말하고, 상세 칸은 없으며 사유 칸에는 안내 글이 없다', () => {
    renderReason(EMPTY_REJECTION);

    expect(screen.getByRole('group', { name: t.heading })).toBeInTheDocument();
    expect(screen.getByLabelText(t.major)).toHaveAccessibleDescription(t.majorMissing);
    expect(screen.queryByLabelText(t.minor)).not.toBeInTheDocument();
    expect(screen.queryByText(t.minorMissing)).not.toBeInTheDocument();
    /* 사유 글은 판정 줄 끝 입력칸이다 — 선택 입력이라 비어도 오류 표시가 없다(#185). */
    expect(screen.getByLabelText(t.description)).toHaveValue('');
    /* 추정 원인(#130)은 선택 입력 — 필수 표시도 누락 안내도 없다. */
    expect(screen.getByLabelText(t.cause)).toHaveTextContent(t.causeNone);
    expect(screen.getByLabelText(t.cause)).not.toHaveAccessibleDescription();
  });

  it('상세가 있는 대분류를 고르면 상세가 열리고 그 칸 아래에 누락을 말한다', () => {
    renderReason({ ...EMPTY_REJECTION, majorId: '1' });

    expect(screen.queryByText(t.majorMissing)).not.toBeInTheDocument();
    expect(screen.getByLabelText(t.minor)).toBeEnabled();
    expect(screen.getByLabelText(t.minor)).toHaveAccessibleDescription(t.minorMissing);
  });

  it('상세가 없는 대분류면 상세 칸이 없고 누락도 말하지 않는다', () => {
    renderReason({ ...EMPTY_REJECTION, majorId: '3' });

    expect(screen.queryByLabelText(t.minor)).not.toBeInTheDocument();
    expect(screen.queryByText(t.minorMissing)).not.toBeInTheDocument();
  });
});
