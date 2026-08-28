import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.workOrderProgress.basis;

export interface BasisBarProps {
  /**
   * 화면에 보이는 수가 **언제 받아 낸 것인가.**
   *
   * ⛔ 「지금」이 아니다. 조회가 실패해도 앞서 받은 것이 그대로 보이므로, 그때 기준을 「지금」
   * 으로 올리면 **낡은 수에 새 시각을 붙이게 된다** — 사용자는 방금 갱신된 값으로 읽는다.
   */
  basisAt: Date;
  onRefresh: () => void;
}

/**
 * 기준 시각과 새로고침.
 *
 * ⭐ **둘은 한 자리에 있어야 한다.** L-6 이 자동 갱신을 금지하므로 새로고침이 **유일한 갱신
 * 수단**이고, L-5 가 요구하는 기준 시각은 「그 수단을 마지막으로 쓴 때」다. 떨어뜨려 두면
 * 사용자가 시각을 보고도 무엇을 눌러야 새로워지는지 알 수 없다.
 *
 * ⛔ **자동으로 갱신되지 않는다는 사실을 적는다.** 적지 않으면 화면에 떠 있는 수를 「지금」
 * 으로 읽는다 — 조회 화면에서 가장 비싼 오해다.
 */
export const BasisBar = ({ basisAt, onRefresh }: BasisBarProps) => (
  <>
    <div className="form-actions">
      <p className="field-note form-actions-secondary">{t.label(basisAt.toLocaleString())}</p>
      <Button size="sm" variant="outlined" onClick={onRefresh}>
        {t.refresh}
      </Button>
    </div>
    <p className="field-note">{t.note}</p>
  </>
);
