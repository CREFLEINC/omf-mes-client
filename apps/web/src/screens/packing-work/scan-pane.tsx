import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
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
  /** 담기가 막혀 있으면 그 사유. 없으면 `null` */
  blockedReason: string | null;
  /** 스캔 코드가 목록에 없을 때의 인라인 오류. */
  scanError: string | null;
  /** 수량 입력의 인라인 오류. */
  quantityError: string | null;
  isAdding: boolean;
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
 * ⛔ **숫자 키패드를 여기 두지 않는다.** 그 부품은 `P-CO-01` 이 소유하고 있고, 여기서 또
 * 만들면 같은 것이 둘이 된다.
 */
export const ScanPane = ({
  selectedLotNo,
  quantity,
  onQuantityChange,
  onScan,
  onAdd,
  blockedReason,
  scanError,
  quantityError,
  isAdding,
}: ScanPaneProps) => {
  const [code, setCode] = useState('');
  const scanRef = useRef<HTMLInputElement>(null);

  /*
   * 담기가 끝나면 스캔 칸으로 포커스를 되돌린다. 처음 렌더에서도 한 번 걸리므로 화면에
   * 들어오자마자 읽을 수 있다 — 작업자가 칸을 눌러 줄 필요가 없다.
   */
  useEffect(() => {
    if (!isAdding) scanRef.current?.focus();
  }, [isAdding]);

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
          <Button type="submit" variant="outlined" size="xl" className={popTouchClass('normal')}>
            {t.scan.manualEntry}
          </Button>
        </div>
        {scanError !== null && <p className="field-error">{scanError}</p>}
        <p className="field-note">{t.scan.manualEntryNote}</p>
      </form>

      <div className="pack-work-add-row">
        <TextField
          label={t.scan.quantityLabel}
          value={quantity}
          inputMode="decimal"
          autoComplete="off"
          onChange={(event) => {
            onQuantityChange(event.target.value);
          }}
        />
        <Button
          type="button"
          variant="filled"
          size="xl"
          className={popTouchClass('critical')}
          disabled={blockedReason !== null || selectedLotNo === null || isAdding}
          onClick={onAdd}
        >
          {isAdding ? t.scan.creating : t.scan.submit}
        </Button>
      </div>

      {quantityError !== null && <p className="field-error">{quantityError}</p>}
      {blockedReason !== null && <p className="field-note">{blockedReason}</p>}
    </>
  );
};
