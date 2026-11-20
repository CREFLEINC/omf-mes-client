import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import {
  PuButton,
  PuField,
  PuInput,
  PuKeypad,
  PuNote,
  applyKeypadKey,
  type PuTone,
} from '../../../patterns/pop-uniform';
import { canSubmit } from './worker-no';

/**
 * 좌측 《사번 입력》 구획(#295 로그인 시안) — 사번 칸 · 한 줄 안내 · 키패드 · [사번 확인].
 *
 * ⛔ **비밀번호 칸이 없다. 그것이 이 화면의 요점이다**(§5-1). 로그인 실패 잠금도, 세션
 * 만료도 두지 않는다 — 셋 다 「로그인 생략」 요구를 우회로 되살리는 것이고, 담을 자리도 없다.
 *
 * ⚠ **6자리 숫자가 아니면 [사번 확인] 때 다시 입력하게 한다**(사용자 지시 2026-11-17 ·
 * omf-all-around#288). 판정은 화면(`screen.tsx`)이 하고, 이 구획은 안내만 보인다.
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
  /**
   * 확인을 마친 현재 작업자의 사번. 있으면 칸에 그 사번만 보이고 키패드·확인은 접는다
   * (omf-all-around#288 「사번 확인 후」 시안). 바꾸려면 오른쪽 [작업자 변경]을 누른다.
   */
  confirmedWorkerNo: string | null;
  /** [사번 확인]을 눌렀는데 6자리 숫자가 아니었다. 다시 칠 때까지 사번 칸 아래에 안내한다. */
  isUnusualShown: boolean;
}

export const KeypadPanel = ({
  workerNo,
  onChange,
  onSubmit,
  isChecking,
  error,
  offlineNote,
  confirmedWorkerNo,
  isUnusualShown,
}: KeypadPanelProps) => {
  const titleId = useId();
  const inputId = useId();
  const isConfirmed = confirmedWorkerNo !== null;
  /*
   * 사번 칸 바로 아래 한 줄 — 6자리 아님(노랑) · 확인 결과 오류(빨강) · 오프라인(파랑) 중 하나.
   * 확인을 마친 뒤에는 세우지 않는다(키패드와 함께 접힌다).
   */
  const note: { tone: PuTone; text: string } | null = isConfirmed
    ? null
    : isUnusualShown
      ? { tone: 'warn', text: t.unusual }
      : error !== null
        ? { tone: 'bad', text: error }
        : offlineNote !== null
          ? { tone: 'info', text: offlineNote }
          : null;

  return (
    <section className="pu-card wa-left" aria-labelledby={titleId}>
      <div className="pu-card-head">
        <h2 id={titleId}>{t.heading}</h2>
      </div>
      <div className="pu-card-body wa-left-body">
        {/*
         * ⭐ **키보드로도 칠 수 있다.** 자판이 붙은 단말과 개발 중 확인에서 숫자를 쳐도 받는다.
         * 넣는 길이 둘이어도 값의 주인은 하나(`workerNo`)라 서로 어긋나지 않는다.
         *
         * ⛔ **숫자만 받는다.** 사번은 숫자라 그 밖의 글자는 «치는 순간» 버린다.
         */}
        <PuField label={t.workerNo} required htmlFor={inputId}>
          <PuInput
            id={inputId}
            className="wa-no"
            aria-label={t.workerNo}
            value={confirmedWorkerNo ?? workerNo}
            need={!isConfirmed && workerNo === ''}
            inputMode="numeric"
            autoComplete="off"
            readOnly={isConfirmed}
            onChange={(event) => {
              onChange(event.target.value.replace(/\D/gu, ''));
            }}
          />
        </PuField>

        {/*
         * 알림 자리 — **비어 있을 때도 높이를 지킨다.** 안내가 뜨고 지는 대로 키패드가 위아래로
         * 움직이면, 다음 숫자를 누르려던 손가락이 한 줄 옆의 키를 누른다(실측으로 잡았다).
         */}
        <div className="wa-slot">
          {note !== null && <PuNote tone={note.tone}>{note.text}</PuNote>}
        </div>

        {!isConfirmed && (
          <div className="wa-pad">
            <PuKeypad
              targetLabel={t.workerNo}
              showTarget={false}
              decimal={false}
              clearInPad
              disabled={isChecking}
              onKey={(key) => {
                onChange(applyKeypadKey(workerNo, key, { decimal: false }));
              }}
              onClearAll={() => {
                onChange('');
              }}
            />
            <PuButton
              variant="primary"
              className="wa-submit"
              disabled={!canSubmit(workerNo) || isChecking}
              onClick={onSubmit}
            >
              {isChecking ? t.checking : t.submit}
            </PuButton>
          </div>
        )}
      </div>
    </section>
  );
};
