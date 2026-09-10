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
     * 높이는 `xl`(60px) — 터치 규격의 「56~60픽셀 급」이며, ⚠ 「큰 글자」는 글자 크기 요구이지
     * 높이 요구가 아니다(§7).
     *
     * ⭐ **키보드로도 칠 수 있다.** 한때 읽기 전용이라 키패드로만 값이 들어왔는데, 자판이 붙은
     * 단말과 개발 중 확인에서 **숫자를 쳐도 아무 일이 없었다.** 넣는 길이 둘이어도 값의 주인은
     * 하나(`workerNo`)라 서로 어긋나지 않는다.
     *
     * ⛔ **숫자만 받는다.** 사번은 숫자라 그 밖의 글자는 «치는 순간» 버린다 — 받아 두고 나중에
     *    「형식이 다릅니다」로 되돌리면, 다 치고 나서야 틀린 것을 안다.
     */}
    <TextField
      label={t.workerNo}
      value={workerNo}
      size="xl"
      inputMode="numeric"
      autoComplete="off"
      className="worker-no-field"
      onChange={(event) => {
        onChange(event.target.value.replace(/\D/gu, ''));
      }}
    />

    {/*
     * 알림 자리 — **비어 있을 때도 높이를 지킨다.**
     *
     * 배너가 뜨고 지는 대로 키패드가 위아래로 움직이면, 다음 숫자를 누르려던 손가락이 한 줄
     * 옆의 키를 누른다(실측으로 잡았다: 「6자리와 다릅니다」 경고가 뜬 순간 키패드가 밀렸다).
     * `.scan-outcome` 이 스캔 결과 줄에서 같은 문제를 같은 방법으로 막고 있다.
     */}
    <div className="worker-no-notice">
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
    </div>

    <NumericKeypad
      value={workerNo}
      onChange={onChange}
      label={t.keypad}
      backspaceLabel={t.backspace}
      clearLabel={t.clear}
      disabled={isChecking}
      keySize={POP_TOUCH_SIZE}
    />

    {/*
     * 터치 규격 — 핵심 조작이라 72px(`2xl`)이다(E-3).
     *
     * ⭐ **오른쪽 구획의 [교대]·[개발용 화면 이동]과 같은 크기로 선다**(사용자 지시
     * 2026-09-10). 크기 맞춤은 `pop.css` 가 이 이름으로 한다 — 두 구획의 폭이 같아
     * 「구획의 절반」이 곧 저쪽 버튼 하나의 폭이다.
     */}
    <Button
      type="button"
      variant="filled"
      size={POP_TOUCH_SIZE}
      className="worker-no-submit"
      disabled={!canSubmit(workerNo) || isChecking}
      onClick={onSubmit}
    >
      {isChecking ? t.checking : t.submit}
    </Button>
  </section>
);
