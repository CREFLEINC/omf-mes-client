import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { NumericKeypad } from '@omf-mes/ui';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { popTouchClass } from '../../patterns/pop-touch';

const t = messages.packingWork;

export interface ScanPaneProps {
  /** 지금 담을 대상으로 잡힌 LOT 번호. 목록에서 골랐거나 스캔으로 잡혔다. */
  selectedLotNo: string | null;
  quantity: string;
  onQuantityChange: (value: string) => void;
  /** 스캔·직접 입력으로 들어온 코드. 대상 잡기는 화면이 한다. */
  onScan: (code: string) => void;
  onAdd: () => void;
  /** 담기가 막혀 있는가 — **잠그는 축**이다. 무엇을 말할지는 아래 `blockedNote` 가 따로 정한다 */
  isBlocked: boolean;
  /**
   * 막힌 사유 중 **이 자리에서 말할 것**. 없으면 `null`.
   *
   * ⛔ **화면 위 띠가 이미 말하는 사유는 여기서 되풀이하지 않는다**(사용자 지적 2026-09-12).
   * 진입 인자가 없다는 말이 머리 띠·좌단·우단 세 곳에 동시에 섰다 — 같은 문장이 화면을
   * 채우면 정작 다른 사유가 떴을 때 그것이 눈에 띄지 않는다. 같은 판단이 이 화면의 확정
   * 사유에 이미 적용돼 있다(「유형 미선택·내용물 없음은 말로 적지 않는다」).
   */
  blockedNote: string | null;
  /** 스캔 코드가 목록에 없을 때의 인라인 오류. */
  scanError: string | null;
  /**
   * 담을 때마다 값이 바뀌는 표. 이 값이 바뀌면 포커스를 스캔 칸으로 되돌린다.
   *
   * ⛔ **담기 자체는 서버를 부르지 않는다** — 「보내는 중」 같은 상태가 없으므로 이 값이
   * 포커스를 되돌릴 유일한 계기다.
   */
  addedCount: number;
  /** 수량 입력의 인라인 오류. */
  quantityError: string | null;
  /**
   * 지금 담을 LOT 의 단위가 소수를 받는가 — **소수점 키를 열지 정한다.**
   *
   * ⛔ 화면이 정하지 않는다. 마스터의 자릿수를 그대로 따른다(`queries.ts` 머리 참조).
   */
  allowsDecimal: boolean;
}

/**
 * 좌단 《스캔》 — 스캔 칸·수량·담기.
 *
 * ⭐ **포커스를 되돌리는 것이 이 구획의 본론이다.** 작업자는 화면을 보지 않고 연달아 읽는다.
 * 담은 뒤 포커스가 돌아오지 않으면 다음 스캔이 **아무 데도 들어가지 않고 사라진다** — 작업자는
 * 읽었다고 믿고 넘어간다.
 *
 * ⚠ **수량 칸은 스펙 §3 그림에 없지만 없앨 수 없다.** 내용물의 수량이 필수(`> 0`)이고
 * (스펙 §4-B) 계약에도 그 값을 파생할 자리가 없다 — 사람이 넣는 수밖에 없다. §6 의
 * 「스캔 «수량» > LOT 잔여」도 이 칸을 전제한다.
 *
 * ⭐ **숫자 키패드를 여기 놓는다**(공유계약 D-4 — 「POP 숫자 입력은 화면 내장 키패드를 쓴다.
 * OS 터치 키보드에 의존하지 않는다 — 키오스크 창에서 화면을 덮고 제어가 어렵다」).
 *
 * ⛔ **한때 「부품을 `P-CO-01` 이 소유하니 여기 두지 않는다」고 적혀 있었는데 그 판단이
 * 틀렸다.** 부품은 이미 `@omf-mes/ui` 로 공용이고 POP 화면 아홉이 각자 **놓기만** 한다 —
 * 만드는 것과 놓는 것은 다른 축이다. 그 사이 이 화면만 OS 자판에 기대어, 키오스크로 잠긴
 * 현장 단말에서는 **수량을 넣을 방법이 아예 없었다**(88단계 2회차 · #1092).
 *
 * ⭐ **팝업이 아니라 상시로 선다** — D-4 가 「위치는 축이 아니다 · 팝업으로 그린 화면이 한
 * 곳도 없다」로 적었고, 팝업이던 두 화면(제품 검사·재작업 실적)이 명시적으로 상시로 되돌아왔다.
 */
export const ScanPane = ({
  selectedLotNo,
  quantity,
  onQuantityChange,
  onScan,
  onAdd,
  isBlocked,
  blockedNote,
  scanError,
  quantityError,
  allowsDecimal,
  addedCount,
}: ScanPaneProps) => {
  const [code, setCode] = useState('');
  const scanRef = useRef<HTMLInputElement>(null);

  /*
   * 담기가 끝나면 스캔 칸으로 포커스를 되돌린다. 처음 렌더에서도 한 번 걸리므로 화면에
   * 들어오자마자 읽을 수 있다 — 작업자가 칸을 눌러 줄 필요가 없다.
   */
  useEffect(() => {
    scanRef.current?.focus();
  }, [addedCount]);

  const submitScan = (event: FormEvent<HTMLFormElement>): void => {
    /*
     * ⛔ 기본 제출을 막는다. `<form>` 은 기본이 GET 제출이라 Enter 한 번에 읽은 코드가 질의
     * 문자열로 올라가고 화면이 통째로 다시 뜬다 — 담아 둔 내용물이 그 자리에서 사라진다.
     */
    event.preventDefault();

    const text = code.trim();
    if (text === '') return;

    /* **보내기 전에 비운다.** 뒤에 비우면 그사이 읽힌 다음 코드가 앞 코드에 이어 붙는다. */
    setCode('');
    onScan(text);
    scanRef.current?.focus();
  };

  return (
    <>
      <form onSubmit={submitScan}>
        <div className="scan-row">
          <TextField
            size="xl"
            ref={scanRef}
            label={t.scan.label}
            value={code}
            fullWidth
            autoComplete="off"
            /*
             * ⛔ **담는 중에도 칸을 잠그지 않는다.** 잠그면 그 순간 포커스가 칸을 떠나고,
             * 되돌려 놓기 전에 읽힌 코드가 사라진다 — 스캐너는 사람이 기다려 주지 않는다.
             */
            onChange={(event) => {
              setCode(event.target.value);
            }}
          />
          {/*
           * ⛔ **이 버튼은 «제출»이 아니라 «칸으로 옮기는» 버튼이다.**
           *
           * `type="submit"` 으로 두었더니 누를 때마다 빈 코드로 폼이 제출돼 **아무 일도
           * 일어나지 않았다** — 손으로 치려고 눌렀는데 칸에 커서가 안 갔다(사용자 지적).
           * 스캐너는 코드 끝에 Enter 를 붙여 보내므로 «제출»은 폼이 알아서 한다(칸이 하나뿐인
           * 폼은 Enter 로 제출된다). 이 버튼이 할 일은 **칸에 커서를 놓는 것**뿐이다.
           *
           * 자재 투입·포장 실적·러닝체인지가 이미 그렇게 서 있다 — 같은 이름의 버튼이
           * 화면마다 다르게 동작하지 않게 맞춘다.
           */}
          <Button
            type="button"
            variant="outlined"
            size="xl"
            className={popTouchClass('normal')}
            onClick={() => {
              scanRef.current?.focus();
            }}
          >
            {t.scan.manualEntry}
          </Button>
        </div>
        {/*
          ⛔ **늘 떠 있는 사용법 안내를 두지 않는다.** 스펙 §3 의 좌단은 스캔 칸과 [ 직접 입력 ]
          둘뿐이고, 이 화면은 좌단 세로가 모자라 «포장 대상» 목록이 화면 밖으로 밀려 있었다
          (실측 164px). 버튼 이름이 이미 그 일을 말한다.
        */}
        {scanError !== null && <p className="field-error">{scanError}</p>}
      </form>

      <div className="pack-work-add-row">
        <TextField
          size="xl"
          label={t.scan.quantityLabel}
          value={quantity}
          inputMode="decimal"
          autoComplete="off"
          /*
           * ⛔ **칸을 직접 치게 두지 않는다**(전례 `P-04-03` 재작업 실적). 포커스가 가면 단말의
           *    운영체제 키보드가 화면을 덮는데, 키오스크 창에서는 그것을 닫을 길이 마땅치 않다.
           *    값은 아래 키패드가 넣는다.
           */
          readOnly
          onChange={(event) => {
            onQuantityChange(event.target.value);
          }}
        />
        <Button
          type="button"
          variant="filled"
          size="xl"
          className={popTouchClass('critical')}
          disabled={isBlocked || selectedLotNo === null}
          onClick={onAdd}
        >
          {t.scan.submit}
        </Button>
      </div>

      {/*
       * ⭐ **수량 칸 바로 아래에 선다.** 손이 칸과 키 사이를 오가는 거리가 짧아야 하고, 이
       * 화면의 수량 칸은 좌단에 있다. ⚠ 좌단은 세로가 빠듯해(1024×768 실측 — 목록이 비어도
       * 넘쳤다) 키패드가 들어오면 《포장 대상》 목록이 밀린다 — 그래서 목록이 **구획 안에서**
       * 스크롤하도록 함께 걸었다(E-4 규칙 1 · `pop.css`).
       */}
      <NumericKeypad
        className="pack-work-keypad"
        label={t.scan.keypadLabel}
        value={quantity}
        onChange={onQuantityChange}
        dropLeadingZero
        /*
         * ⛔ **소수점 키를 늘 두지 않는다.** 개수로 세는 단위(EA·BOX)에 두면 서버가 거부할
         *    값을 넣게 되고, 세로가 빠듯한 이 구획에서 쓰지 않는 키 한 줄이 목록을 밀어낸다.
         *    ⚠ 반대로 무게·부피 단위(KG·L)에 없으면 값을 넣을 길이 사라진다 — 마스터의
         *    자릿수가 정한다(계약도 `decimalScale` 을 「수량 입력란의 소수 자릿수 판정」으로
         *    적어 두었다).
         */
        allowDecimal={allowsDecimal}
        decimalLabel={t.scan.keypadDecimal}
        backspaceLabel={t.scan.keypadBackspace}
        clearLabel={t.scan.keypadClear}
      />

      {quantityError !== null && <p className="field-error">{quantityError}</p>}
      {/* ⛔ 유형 미선택은 여기서 말하지 않는다 — 누르면 고칠 칸(오른쪽 「유형」)이 말한다. */}
      {blockedNote !== null && <p className="field-note">{blockedNote}</p>}
    </>
  );
};
