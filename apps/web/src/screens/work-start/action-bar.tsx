import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { POP_TOUCH_SIZE } from './touch-spec';

const t = messages.workStart.actions;

export interface ActionBarProps {
  /** 재개인가 시작인가. 두 버튼은 **다른 경로**다 — 이름도 갈린다. */
  mode: 'start' | 'resume';
  /**
   * 막혔으면 그 사유. **회색 버튼만 두지 않는다**(G-3 · §9-2) — 왜 못 하는지와 무엇을 하면
   * 되는지를 함께 보인다.
   */
  blockReason: string | null;
  /** 다시 시도할 경로가 있으면 그 이름. 없으면 `null` — 사용자가 이 화면에서 풀 수 없다. */
  retryLabel: string | null;
  onRetry: () => void;
  isSaving: boolean;
  onReset: () => void;
  onSubmit: () => void;
}

/**
 * 액션바(스펙 §4 액션바 88).
 *
 * ⭐ **72픽셀 급이다** — 되돌릴 수 없는 조작이고, 디자인 시스템의 `2xl` 이 그 치수를 준다
 * (§7 「G-5 해소 2026-08-28」).
 *
 * ⛔ **막힌 이유를 버튼 색으로만 말하지 않는다.** 회색 버튼만 두면 작업자는 단말이 고장 난
 * 줄 안다 — 사유와 다음 행동을 글로 적는다.
 */
export const ActionBar = ({
  mode,
  blockReason,
  retryLabel,
  onRetry,
  isSaving,
  onReset,
  onSubmit,
}: ActionBarProps) => (
  <div className="work-start-actions">
    {blockReason !== null && (
      <div className="banner-slot">
        <AlertBanner variant="warning">
          {blockReason}
          {retryLabel !== null && (
            <>
              {' '}
              <Button type="button" variant="text" size="lg" onClick={onRetry}>
                {retryLabel}
              </Button>
            </>
          )}
        </AlertBanner>
      </div>
    )}

    <div className="work-start-actions-row">
      <Button type="button" variant="outlined" size={POP_TOUCH_SIZE} onClick={onReset}>
        {t.reset}
      </Button>

      <Button
        type="button"
        variant="filled"
        size={POP_TOUCH_SIZE}
        disabled={blockReason !== null || isSaving}
        onClick={onSubmit}
      >
        {isSaving ? t.starting : mode === 'resume' ? t.resume : t.start}
      </Button>
    </div>
  </div>
);
