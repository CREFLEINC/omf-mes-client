import { AlertBanner, Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { NumericKeypad } from '@omf-mes/ui';

import { POP_TOUCH_SIZE } from './touch-spec';

const t = messages.workStart.worker;

export interface WorkerPanelProps {
  /** 지금 치고 있는 값. */
  draft: string;
  /** 확인이 끝난 사번. 있으면 입력 대신 그 사실을 보인다. */
  confirmed: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  isChecking: boolean;
  /** 확인 결과의 오류 문구. 없으면 `null` */
  error: string | null;
}

/**
 * ① 사번 구획(스펙 §4 ① · 96px).
 *
 * ⛔ **비밀번호 칸이 없다.** POP 은 로그인을 생략하고 사번만 받는다(REQ-PR-0023) — 이 화면이
 * 하는 것은 인증이 아니라 **귀속**이다. 「누가 한 일로 기록할 것인가」만 정한다.
 *
 * ⚠ **사번 칸은 읽기 전용이다.** 값은 키패드로만 들어온다 — 현장 단말은 전체 화면 키오스크라
 * 운영체제 키보드가 뜨면 화면을 덮는다.
 *
 * ⛔ **확인 전에는 목록을 고를 수 없다**(§5-5 「지시 선택 — 사번 확인됨」). 쓰기가 사번 헤더를
 * 요구하므로, 고르게 해 두면 마지막에 가서야 막힌다.
 */
export const WorkerPanel = ({
  draft,
  confirmed,
  onChange,
  onSubmit,
  onReset,
  isChecking,
  error,
}: WorkerPanelProps) => (
  <section className="pane work-start-worker" aria-label={t.title}>
    <h2 className="pane-title">{t.title}</h2>

    {confirmed === null ? (
      <>
        <TextField
          label={t.fieldLabel}
          value={draft}
          size="xl"
          readOnly
          onChange={() => undefined}
        />

        <NumericKeypad
          value={draft}
          onChange={onChange}
          label={t.keypadLabel}
          backspaceLabel={t.backspace}
          clearLabel={t.clear}
          disabled={isChecking}
          keySize={POP_TOUCH_SIZE}
        />

        <Button
          type="button"
          variant="filled"
          size={POP_TOUCH_SIZE}
          disabled={draft.trim() === '' || isChecking}
          onClick={onSubmit}
        >
          {isChecking ? t.checking : t.confirm}
        </Button>

        {error !== null && (
          <div className="banner-slot">
            <AlertBanner variant="error">{error}</AlertBanner>
          </div>
        )}
      </>
    ) : (
      <p className="work-start-worker-confirmed">
        {messages.workStart.header.workerLabel(confirmed)}{' '}
        <Button type="button" variant="text" size="lg" onClick={onReset}>
          {t.change}
        </Button>
      </p>
    )}
  </section>
);
