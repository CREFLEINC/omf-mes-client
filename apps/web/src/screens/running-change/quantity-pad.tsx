import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { NumericKeypad } from '@omf-mes/ui';
import { useEffect, useState } from 'react';

const t = messages.runningChange.pad;

/**
 * 앞자리 0 을 턴다 — `011` → `11`.
 *
 * ⛔ **친 값과 보낼 값이 달라지는 것을 막는다.** 계약이 받는 것은 «수»라 `011` 은 `11` 로
 * 실린다. 화면이 `011` 을 그대로 보여 주면 작업자는 자기가 친 대로 들어갔다고 믿는데, 원장에
 * 남는 것은 다른 글자다 — 교체 기록은 지워지지 않아 그 어긋남이 그대로 남는다(§5-2).
 *
 * ⚠ `0` 하나와 `0.5` 는 건드리지 않는다 — 앞이 0 인 것이 «값의 일부»인 경우다.
 */
export const stripLeadingZeros = (value: string): string => value.replace(/^0+(?=\d)/u, '');

export interface QuantityPadProps {
  /** 열려 있는가. 닫혀 있으면 `false` — 창은 자리만 지키고 그리지 않는다. */
  open: boolean;
  /** 열릴 때의 값. */
  value: string;
  /**
   * 소수를 받는 단위인가. 스캔한 LOT 의 단위가 정한다 — 개수로 세는 자재에 소수점 키를
   * 두면 넣을 수 없는 값을 넣게 되고, 무게로 재는 자재에 없으면 값을 넣을 길이 없다.
   */
  allowDecimal: boolean;
  onCommit: (next: string) => void;
  onClose: () => void;
}

/**
 * 투입 수량을 넣는 **화면 내장 키패드 팝업**.
 *
 * ⭐ **공유계약 D-4 가 이 자리를 정한다** — 「POP 숫자 입력(수량·측정값·사번)은 화면 내장
 * 키패드를 쓴다. OS 터치 키보드에 의존하지 않는다」. 키오스크 창에서 OS 자판은 화면을 덮고
 * 닫기 제어가 어렵다. 단말에는 자판이 없어, 칸만 두면 **넣을 방법이 없다.**
 *
 * ⭐ **팝업으로 세운다**(사용자 결정 2026-09-07). 설계 §3 도면이 이 화면에 키패드 자리를
 * 그리지 않았고, 오른쪽 단은 스캔·대상·수량·사유·안내·등록이 이미 차 있다 — 상시로 세우면
 * [ 교체 등록 ]이 화면 밖으로 밀린다. 칸을 누른 «그때»만 뜬다(전례 `P-04-05` PQC 제품 검사).
 *
 * ⛔ **고치는 동안 원래 값을 바꾸지 않는다.** 팝업 안에서 임시 값을 들고 있다가 [ 확인 ]에서
 * 한 번에 넘긴다 — 누르는 중간값이 그대로 저장되면 칸 아래 경고가 글자마다 깜빡인다.
 */
export const QuantityPad = ({ open, value, allowDecimal, onCommit, onClose }: QuantityPadProps) => {
  const [draft, setDraft] = useState(value);

  /* 다시 열 때는 지금 칸에 있는 값에서 시작한다 — 앞서 누르던 값이 남으면 남의 수량을 고친다. */
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t.title}
      size="sm"
      /*
       * ⛔ **팝업 바깥을 눌러 닫히지 않는다**(사용자 지시 2026-09-10 · #1005). 터치 단말에서
       *    팝업은 화면 대부분을 덮어 손이 스치기 쉽고, 스크림 클릭이 닫기로 이어지면
       *    「누른 적 없는데 닫힌다」가 된다. 닫는 길은 아래 단추다.
       */
      closeOnBackdropClick={false}
      /*
       * ⛔ **X 를 두지 않는다**(사용자 지시 2026-09-07). 바닥에 [ 취소 ]가 이미 있어 닫는
       *    길이 둘이 되는데, 장갑 낀 손에는 작은 X 가 «잘못 눌리는» 자리다.
       */
      showCloseButton={false}
      footer={
        <>
          <Button variant="outlined" size="2xl" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button
            variant="filled"
            size="2xl"
            onClick={() => {
              onCommit(draft);
            }}
          >
            {t.confirm}
          </Button>
        </>
      }
    >
      {/*
       * 지금 누른 값. ⛔ **비었을 때 표식을 그리지 않는다**(사용자 지시 2026-09-07) — 「—」가
       *    눌린 값처럼 보였다. 자리는 그대로 지킨다(높이 고정) — 첫 자를 누를 때 키패드가
       *    아래로 밀리면 손이 다른 키를 누른다.
       */}
      <p className="pop-rc-pad-value">{draft}</p>

      <NumericKeypad
        value={draft}
        onChange={(next) => {
          setDraft(stripLeadingZeros(next));
        }}
        allowDecimal={allowDecimal}
        decimalLabel={t.decimal}
        keySize="2xl"
        label={t.keypadLabel}
        backspaceLabel={t.backspace}
        clearLabel={t.clear}
      />
    </Dialog>
  );
};
