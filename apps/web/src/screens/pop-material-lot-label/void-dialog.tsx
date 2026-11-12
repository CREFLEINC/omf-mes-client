import { AlertBanner, Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { popTouchClass } from '../../patterns/pop-touch';
import type { LabelLot } from './types';

const t = messages.popMaterialLotLabel.voidDialog;

export interface VoidDialogProps {
  /** 폐기할 대기 LOT(화면이 대기만 넘긴다). */
  lots: readonly LabelLot[];
  isSaving: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 대기 자재 관리 LOT 폐기 확인(US1-7 · FR-005 · screens/P-01-01.md 「폐기 확인」).
 *
 * ⭐ 라벨을 이미 출력한 LOT 이 있으면 떼어 버리라고 따로 말한다 — 폐기한 번호의 라벨이 상자에 남으면 PDA 가
 *    거부하는 까닭을 현장이 모른다.
 */
export const VoidDialog = ({ lots, isSaving, error, onCancel, onConfirm }: VoidDialogProps) => {
  const printed = lots.filter((lot) => lot.lastIssue !== null).length;

  return (
    <Dialog
      open
      /* POP 팝업은 바깥을 눌러 닫히지 않는다(#1005) — 장갑 낀 손이 창 밖을 스치면 사라졌다. */
      closeOnBackdropClick={false}
      onClose={onCancel}
      title={t.title(lots.length)}
      size="md"
      footer={
        <>
          <Button
            className={popTouchClass('normal')}
            variant="outlined"
            size="xl"
            onClick={onCancel}
          >
            {t.cancel}
          </Button>
          <Button
            className={popTouchClass('primary')}
            size="xl"
            loading={isSaving}
            onClick={onConfirm}
          >
            {t.confirm(lots.length)}
          </Button>
        </>
      }
    >
      <ul className="pop-mlot-void-list">
        {lots.map((lot) => (
          <li key={lot.lotId} className="pop-mlot-cell-lot">
            {lot.lotNo}
          </li>
        ))}
      </ul>
      <p className="pop-mlot-hint">
        {t.body}
        {printed > 0 ? <strong className="pop-mlot-warn-text"> {t.printed(printed)}</strong> : null}
      </p>
      {error === null ? null : <AlertBanner variant="error">{error}</AlertBanner>}
    </Dialog>
  );
};
