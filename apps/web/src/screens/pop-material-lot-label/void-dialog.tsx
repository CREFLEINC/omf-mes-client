import { messages } from '@omf-mes/i18n';

import { PuConfirm, PuNote } from '../../patterns/pop-uniform';
import type { LabelLot } from './types';

const t = messages.popMaterialLotLabel.voidDialog;

export interface VoidDialogProps {
  /** 폐기할 입하 대기 LOT(화면이 입하 대기만 넘긴다). */
  lots: readonly LabelLot[];
  isSaving: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 입하 대기 자재 관리 LOT 폐기 확인(US1-7 · FR-005 · 규칙 13 — 되돌릴 수 없는 일은 확인 창).
 *
 * ⭐ 라벨을 이미 출력한 LOT 이 있으면 떼어 버리라고 따로 말한다 — 폐기한 번호의 라벨이 상자에 남으면 PDA 가
 *    거부하는 까닭을 현장이 모른다.
 */
export const VoidDialog = ({ lots, isSaving, error, onCancel, onConfirm }: VoidDialogProps) => {
  const printed = lots.filter((lot) => lot.lastIssue !== null).length;

  return (
    <PuConfirm
      title={t.title(lots.length)}
      confirmLabel={t.confirm(lots.length)}
      cancelLabel={t.cancel}
      busy={isSaving}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <ul className="pu-mono mll-void-list">
        {lots.map((lot) => (
          <li key={lot.lotId}>{lot.lotNo}</li>
        ))}
      </ul>
      <p className="pu-dialog-text">
        {t.body}
        {printed > 0 ? <strong className="mll-warn-text"> {t.printed(printed)}</strong> : null}
      </p>
      {error === null ? null : <PuNote tone="bad">{error}</PuNote>}
    </PuConfirm>
  );
};
