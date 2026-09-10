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
  /**
   * 이 화면에서 사번을 바꿀 수 있는가.
   *
   * ⛔ **단말 토큰이 정한 사번은 여기서 못 바꾼다** — `pop-identity` 가 정본이라 화면이
   * 비워도 값이 그대로 돌아온다. 눌러도 아무 일이 없는 버튼을 세우지 않는다.
   */
  canChange: boolean;
  /** 조회가 실패했을 때 다시 묻는 경로. ⛔ 문구가 「다시 시도해 주세요」이므로 수단이 있어야 한다. */
  onRetry: () => void;
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
  canChange,
  onRetry,
  isChecking,
  error,
}: WorkerPanelProps) => (
  /*
   * `pop-fixed` — **내용만큼만 선다**(`app/pop.css` 「내용만큼만 서는 구획」). 사번이 확인된
   * 뒤에는 이 구획에 한 줄만 남는데, 남는 높이를 나눠 받으면 그 한 줄이 빈 칸 가운데 떠서
   * 화면에서 가장 헐거운 자리가 된다. 남는 높이는 아래 작업지시 목록이 가져가는 편이 맞다.
   */
  <section className="pane pop-fixed work-start-worker" aria-label={t.title}>
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
            {/*
             * ⛔ **조회가 실패한 자리에만 준다.** 미등록·퇴사는 다시 물어도 답이 같다 —
             *    거기 「다시 시도」를 붙이면 없는 사람을 계속 찾게 한다.
             *
             * ⭐ 자리와 크기는 다른 POP 화면의 조회 실패 띠와 같다 — 띠의 조작 칸에 `sm`.
             */}
            <AlertBanner
              variant="error"
              action={
                error === t.lookupFailed ? (
                  <Button type="button" variant="outlined" size="sm" onClick={onRetry}>
                    {t.retry}
                  </Button>
                ) : undefined
              }
            >
              {error}
            </AlertBanner>
          </div>
        )}
      </>
    ) : (
      <p className="work-start-worker-confirmed">
        {messages.workStart.header.workerLabel(confirmed)}{' '}
        {canChange && (
          <Button type="button" variant="text" size="lg" onClick={onReset}>
            {t.change}
          </Button>
        )}
      </p>
    )}
  </section>
);
