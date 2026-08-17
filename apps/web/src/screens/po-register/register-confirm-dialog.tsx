import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.poRegister;

/** 확인 창이 되보일 것 전부. **내부 번호는 하나도 담기지 않는다**(`omf-mes#44`). */
export interface RegisterSummary {
  /** 공급사 **이름** — 화면이 참조로 푼 글자 그대로다. 창이 다시 풀지 않는다 */
  supplier: string;
  /** 발주일 — 친 글자 그대로 */
  orderDate: string;
  lineCount: number;
  /** 합계 발주수량 표기. **낼 수 없으면 그 사실이 글자로** 온다 — 0으로 접지 않는다 */
  totalQtyText: string;
  /** 줄마다 단위가 갈리는가. 합계가 한 단위의 수량이 아니라는 사실을 창이 밝힌다 */
  hasMixedUom: boolean;
}

export interface RegisterConfirmDialogProps {
  summary: RegisterSummary;
  /**
   * 나가는 중인가. **두 버튼을 함께 잠근다** — 실행 버튼만 잠그면 사용자가 닫고 다시 눌러
   * 전표를 두 벌 만든다(공통 훅이 호출마다 새 멱등 키를 만든다).
   */
  isSaving: boolean;
  /**
   * 저장 실패 배너 슬롯. **창을 닫지 않고 이유를 보여야** 다시 시도할 수 있다 —
   * 닫아 버리면 무엇이 막았는지 모른 채 같은 버튼을 다시 누른다(완료 조건 C25).
   */
  banner: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * 등록 확인 — **이 화면에서 되돌릴 수 없는 조작 앞의 마지막 층이다.**
 *
 * **등록만 한다.** 이 확인 한 번이 결재 상신까지 잇지 않는다(착수 이슈 §6 ③ · 계획 결정 9) —
 * 그 사실을 창이 적는 이유는, 적지 않으면 사용자가 올리지 않은 발주를 올린 것으로 믿은 채
 * 화면을 떠나기 때문이다. 전례의 상신 확인 창과 **갈리는 자리**다.
 *
 * **되돌릴 수 없다.** 만들어진 발주를 이 화면에서 취소하는 경로가 없고, 취소는 승인을 탄다 —
 * 그래서 무엇이 만들어지는지를 값으로 되보인다.
 *
 * **값을 다시 계산하지 않는다.** 합계와 이름은 화면이 이미 만든 글자를 받는다 — 창이 따로
 * 셈하면 「사용자가 확인한 값」과 「요청에 실리는 값」이 갈린다.
 *
 * **스크림·X로 닫히지 않는다**(`closeOnBackdropClick={false}`·`showCloseButton={false}` ·
 * 사본 체크리스트 5번). Escape는 디자인 시스템이 막을 수단을 주지 않으므로, 그 길로 닫혀도
 * 무너지지 않게 화면이 **나가는 중인 쓰기를 끊지 않는** 규율을 진다.
 *
 * **창 안에 선택칸을 두지 않는다**(`omf-mes#45`) — 글자와 버튼뿐이다. 고칠 것이 있으면 닫고
 * 폼에서 고친다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const RegisterConfirmDialog = ({
  summary,
  isSaving,
  banner,
  onConfirm,
  onClose,
}: RegisterConfirmDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="md"
    closeOnBackdropClick={false}
    showCloseButton={false}
    title={t.dialog.registerTitle}
    footer={
      <>
        {/* 문구가 「확인/취소」가 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */}
        <Button variant="outlined" disabled={isSaving} onClick={onClose}>
          {t.actions.keepEditing}
        </Button>
        <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
          {t.actions.confirmRegister}
        </Button>
      </>
    }
  >
    {banner}

    <p>{t.dialog.registerLead}</p>

    <dl className="filter-bar">
      <div className="field-cell">
        <dt className="field-label">{t.fields.supplier}</dt>
        <dd>{summary.supplier}</dd>
      </div>
      <div className="field-cell">
        <dt className="field-label">{t.fields.orderDate}</dt>
        <dd>{summary.orderDate}</dd>
      </div>
      <div className="field-cell">
        <dt className="field-label">{t.dialog.totalOrderedQty}</dt>
        <dd>{summary.totalQtyText}</dd>
      </div>
    </dl>

    <p>{t.dialog.lineCount(summary.lineCount)}</p>

    {summary.hasMixedUom && <p className="field-note">{t.dialog.mixedUom}</p>}

    {/* 무엇이 일어나는지가 실행 버튼 바로 위에 선다. */}
    <p>{t.dialog.registerIsNotApproval}</p>
    <p>{t.dialog.registerNoUndo}</p>
  </Dialog>
);
