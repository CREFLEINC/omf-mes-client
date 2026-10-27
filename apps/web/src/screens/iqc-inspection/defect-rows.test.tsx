import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { DefectRows } from './defect-rows';
import { EMPTY_DEFECT, resolveDefects, type DefectDraft } from './rejection-reason';

const t = messages.iqcInspection.result.rejection;
const codes = [
  { defectCodeId: 1, defectCode: 'A', defectName: '외관', isActive: true },
  { defectCodeId: 3, defectCode: 'B', defectName: '치수', isActive: true },
];
const row = (majorId: string, qty: string): DefectDraft => ({ ...EMPTY_DEFECT, majorId, qty });

/** 불량 내역 — 불량 유형이 여럿일 수 있어 줄마다 코드 · 수량을 받는다(사용자 지시 2026-10-28 · #197). */
describe('resolveDefects', () => {
  it('줄마다 불량 기록 하나 — 합계가 불합격 수량과 맞으면 그대로 싣는다', () => {
    expect(resolveDefects(codes, [row('1', '2'), row('3', '1')], 3)).toEqual({
      rows: [
        { defectCodeId: 1, defectQty: 2, defectDescription: null },
        { defectCodeId: 3, defectQty: 1, defectDescription: null },
      ],
    });
  });

  it('합계가 불합격 수량과 다르면 막는다', () => {
    expect(resolveDefects(codes, [row('1', '2')], 3)).toEqual({ blocked: t.defectSumMismatch });
  });

  it('수량이 비거나 코드가 비면 막는다', () => {
    expect(resolveDefects(codes, [row('1', '')], 3)).toEqual({ blocked: t.defectQtyRequired });
    expect(resolveDefects(codes, [row('', '3')], 3)).toEqual({ blocked: t.required });
  });
});

describe('DefectRows', () => {
  const Controlled = () => {
    const [rows, setRows] = useState<DefectDraft[]>([row('1', '2')]);
    const [checked, setChecked] = useState(false);
    return (
      <DefectRows
        checked={checked}
        onCheckedChange={setChecked}
        codes={codes}
        causes={[]}
        rows={rows}
        onChange={setRows}
        uomCode="EA"
        disabled={false}
        notSaved={false}
      />
    );
  };

  it('「불합격 존재」를 체크해야 불량 내역이 선다', async () => {
    render(<Controlled />);

    expect(screen.queryByLabelText(t.defectQty)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: t.hasDefects }));
    expect(screen.getByLabelText(t.defectQty)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: t.hasDefects }));
    expect(screen.queryByLabelText(t.defectQty)).not.toBeInTheDocument();
  });

  it('[불량 추가]로 줄을 더하고 [삭제]로 뺀다 — 합계는 표 아래에 다시 적지 않는다(수량 줄의 자동 합산이 보인다 · #197)', async () => {
    render(<Controlled />);
    await userEvent.click(screen.getByRole('checkbox', { name: t.hasDefects }));

    /* 한 줄이어도 휴지통이 있다 — 지우면 빈 표 대신 그 줄을 비운다(#197). */
    await userEvent.click(screen.getByRole('button', { name: t.removeDefect }));
    expect(screen.getAllByLabelText(t.defectQty)).toHaveLength(1);
    expect(screen.getByLabelText(t.defectQty)).toHaveValue('');
    await userEvent.click(screen.getByRole('button', { name: t.addDefect }));
    expect(screen.getAllByLabelText(t.defectQty)).toHaveLength(2);
    await userEvent.type(screen.getAllByLabelText(t.defectQty)[1] as HTMLElement, '1');
    expect(screen.getAllByLabelText(t.defectQty)[1]).toHaveValue('1');

    await userEvent.click(
      screen.getAllByRole('button', { name: t.removeDefect })[1] as HTMLElement,
    );
    expect(screen.getAllByLabelText(t.defectQty)).toHaveLength(1);
  });

  it('칸마다 라벨이 있어 표 모양이어도 화면 읽기가 칸 이름을 읽는다(#197)', async () => {
    render(<Controlled />);
    await userEvent.click(screen.getByRole('checkbox', { name: t.hasDefects }));

    expect(screen.getByLabelText(t.major)).toBeInTheDocument();
    expect(screen.getByLabelText(t.defectQty)).toHaveValue('2');
    expect(screen.getByLabelText(t.cause)).toBeInTheDocument();
    expect(screen.getByLabelText(t.description)).toBeInTheDocument();
  });
});
