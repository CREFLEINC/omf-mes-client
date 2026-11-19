import { messages } from '@omf-mes/i18n';

import { PuButton, PuDialog, PuIcon, PuNote } from '../../patterns/pop-uniform';
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

  /* 모양은 사용자 지정(2026-11-19): 제목 · 「폐기 대상 · N건」 · LOT 번호 · 경고 한 줄 · [취소] [폐기]. */
  return (
    <PuDialog
      title={t.title}
      onClose={onCancel}
      footer={
        <>
          <PuButton onClick={onCancel} disabled={isSaving}>
            {t.cancel}
          </PuButton>
          <PuButton variant="danger" onClick={onConfirm} disabled={isSaving}>
            {t.confirm}
          </PuButton>
        </>
      }
    >
      <div className="mll-void">
        <span className="pu-label">{t.target(lots.length)}</span>
        <ul className="pu-mono mll-void-list">
          {lots.map((lot) => (
            <li key={lot.lotId}>{lot.lotNo}</li>
          ))}
        </ul>
        <p className="mll-void-warn">
          <PuIcon name="warn" />
          <span>
            {t.body}
            {printed > 0 ? <strong> {t.printed(printed)}</strong> : null}
          </span>
        </p>
        {error === null ? null : <PuNote tone="bad">{error}</PuNote>}
      </div>
    </PuDialog>
  );
};
