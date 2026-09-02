import { AlertBanner, Button, TextField } from '@crefle/web-ui';
import { NumericKeypad } from '@omf-mes/ui';
import { messages } from '@omf-mes/i18n';

import { POP_TOUCH_SIZE } from './touch-spec';
import { canSubmit, looksUnusual } from './worker-no';

/**
 * 좌측 《사번 입력》 구획 — 화면 스펙 §3 의 왼쪽 512 다.
 *
 * ⛔ **비밀번호 칸이 없다. 그것이 이 화면의 요점이다**(§5-1). 로그인 실패 잠금도, 세션
 * 만료도 두지 않는다 — 셋 다 「로그인 생략」 요구를 우회로 되살리는 것이고, 담을 자리도 없다.
 *
 * ⚠ **사번 칸은 읽기 전용이다.** 값은 키패드로만 들어온다 — 현장 단말은 전체 화면 키오스크라
 * 운영체제 키보드가 뜨면 화면을 덮는다.
 *
 * ⚠ **자릿수를 강제하지 않는다**(§5-2). 다르면 경고만 하고 **확인은 눌린다.**
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.workerAssignment.input;

export interface KeypadPanelProps {
  workerNo: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isChecking: boolean;
  /** 확인 결과의 오류 문구. 없으면 `null` */
  error: string | null;
  /** ⚠ 오프라인 안내. 연결돼 있으면 `null` — **막는 문구가 아니다**(§6) */
  offlineNote: string | null;
}

export const KeypadPanel = ({
  workerNo,
  onChange,
  onSubmit,
  isChecking,
  error,
  offlineNote,
}: KeypadPanelProps) => (
  <section className="pane pop-pane" aria-label={t.heading}>
    <h2 className="field-label">{t.heading}</h2>

    {/*
     * 읽기 전용 표시 칸이다. 높이는 `xl`(60px) — 터치 규격의 「56~60픽셀 급」이며,
     * ⚠ 「큰 글자」는 글자 크기 요구이지 높이 요구가 아니다(§7).
     */}
    <TextField
      label={t.workerNo}
      value={workerNo}
      size="xl"
      readOnly
      className="worker-no-field"
      onChange={() => undefined}
    />

    {/* ⚠ 경고일 뿐 확인을 막지 않는다. */}
    {looksUnusual(workerNo) && (
      <div className="banner-slot">
        <AlertBanner variant="warning">{t.unusual}</AlertBanner>
      </div>
    )}

    {/* ⚠ 오프라인이어도 확인은 눌린다 — 미리 받아 둔 목록으로 본다(§5-6). */}
    {offlineNote !== null && (
      <div className="banner-slot">
        <AlertBanner variant="info">{offlineNote}</AlertBanner>
      </div>
    )}

    {error !== null && (
      <div className="banner-slot">
        <AlertBanner variant="error">{error}</AlertBanner>
      </div>
    )}

    <NumericKeypad
      value={workerNo}
      onChange={onChange}
      label={t.keypad}
      backspaceLabel={t.backspace}
      clearLabel={t.clear}
      disabled={isChecking}
      keySize={POP_TOUCH_SIZE}
    />

    {/* 터치 규격 — 핵심 조작이라 72px(`2xl`)이다(E-3). */}
    <Button
      type="button"
      variant="filled"
      size={POP_TOUCH_SIZE}
      disabled={!canSubmit(workerNo) || isChecking}
      onClick={onSubmit}
    >
      {isChecking ? t.checking : t.submit}
    </Button>
  </section>
);
