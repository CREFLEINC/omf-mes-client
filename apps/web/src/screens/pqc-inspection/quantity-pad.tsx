import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { NumericKeypad } from '@omf-mes/ui';
import { useEffect, useState } from 'react';

import { POP_TOUCH_SIZE } from './touch-spec';

const t = messages.pqcInspection.pad;

export interface QuantityPadProps {
  /** 어느 칸을 고치는가. 팝업 제목이 된다 — 열고 나면 뒤의 칸이 가려지기 때문이다. */
  label: string | null;
  /** 열릴 때의 값. */
  value: string;
  /** 단위. 없으면 붙이지 않는다. */
  uomCode: string | null;
  onCommit: (next: string) => void;
  onClose: () => void;
}

/**
 * 수량·측정값을 넣는 **화면 내장 키패드 팝업**.
 *
 * ⭐ **설계가 이 화면의 입력 수단을 키패드로 지정했다**(§7 DS 매핑 「측정값·수량 입력 — 키패드
 * · G-6」). 공유계약 D-4 도 「POP 숫자 입력은 화면 내장 키패드를 쓴다 — OS 터치 키보드에
 * 의존하지 않는다」로 못박았다. 단말에는 자판이 없어, 칸만 두면 **넣을 방법이 없다.**
 *
 * ⭐ **팝업으로 세운다.** 이 화면은 좌우 두 단에 세로 예산 슬랙이 0 이라(§3 · E-1) 키패드를
 * 상시로 세울 자리가 없다 — 세우면 종합 판정·처분이 화면 밖으로 밀린다. 칸을 누른 «그때»만
 * 뜬다.
 *
 * ⛔ **고치는 동안 원래 값을 바꾸지 않는다.** 팝업 안에서 임시 값을 들고 있다가 [ 확인 ]에서
 * 한 번에 넘긴다 — 누르는 중간값이 그대로 저장되면 합계 경고가 글자마다 깜빡인다.
 */
export const QuantityPad = ({ label, value, uomCode, onCommit, onClose }: QuantityPadProps) => {
  const [draft, setDraft] = useState(value);

  /* 다른 칸을 눌러 열면 그 칸의 값에서 시작한다 — 앞 칸의 값이 남으면 남의 수량을 고치게 된다. */
  useEffect(() => {
    setDraft(value);
  }, [value, label]);

  return (
    <Dialog
      open={label !== null}
      onClose={onClose}
      title={label === null ? undefined : `${label}${uomCode === null ? '' : ` (${uomCode})`}`}
      size="sm"
      footer={
        <>
          <Button variant="outlined" size={POP_TOUCH_SIZE} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button
            variant="filled"
            size={POP_TOUCH_SIZE}
            onClick={() => {
              onCommit(draft);
            }}
          >
            {t.confirm}
          </Button>
        </>
      }
    >
      <p className="pqc-pad-value">{draft === '' ? t.empty : draft}</p>

      <NumericKeypad
        value={draft}
        onChange={setDraft}
        keySize={POP_TOUCH_SIZE}
        label={t.keypadLabel}
        backspaceLabel={t.backspace}
        clearLabel={t.clear}
      />
    </Dialog>
  );
};
