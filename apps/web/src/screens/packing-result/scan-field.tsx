import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { normalizeScanCode } from './packing-draft';

const t = messages.packingResult;

export interface ScanFieldProps {
  label: string;
  /** 조회가 나가는 중인가. 그동안 같은 코드가 두 번 나가지 않게 잠근다. */
  isScanning: boolean;
  /** 아직 읽을 차례가 아닌가. 잠기면 그 사유를 함께 낸다 — 감추지 않는다. */
  lockReason?: string;
  onScan: (code: string) => void;
}

/**
 * 스캔 입력 칸 — **디자인 시스템 부품의 조합**이다(갈래 c). 새 원시 요소가 아니므로
 * `ds-candidates/`에 두지 않는다.
 *
 * ⭐ **포커스를 되돌리는 것이 이 부품의 본론이다.** 작업자는 화면을 보지 않고 연달아 읽는다.
 * 조회가 끝난 뒤 포커스가 돌아오지 않으면 다음 스캔이 **아무 데도 들어가지 않고 사라진다.**
 *
 * ⚠ 이 화면은 칸이 **둘**이다(납품라벨·생산LOT). 부품 하나를 두 번 세우되 **포커스는 각자
 * 자기 칸으로** 돌아간다 — 한 칸이 두 스캔을 받으면 어느 것을 읽는 중인지 사라진다.
 */
export const ScanField = ({ label, isScanning, lockReason, onScan }: ScanFieldProps) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const locked = lockReason !== undefined;

  /*
   * 조회가 끝나면 포커스를 되돌린다. ⚠ **잠긴 칸으로는 옮기지 않는다** — 읽을 차례가 아닌
   * 칸이 포커스를 뺏으면 지금 읽어야 할 칸의 스캔이 그리로 들어간다.
   */
  useEffect(() => {
    if (!isScanning && !locked) inputRef.current?.focus();
  }, [isScanning, locked]);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    /* ⛔ 기본 제출을 막는다 — `<form>`의 기본 GET 제출은 읽은 코드를 주소로 올리고 화면을 새로 띄운다. */
    event.preventDefault();

    /* 버튼 잠금과 별개의 겹이다 — 버튼을 지나지 않는 제출로 겹친 조회가 나가는 것을 막는다. */
    if (isScanning || locked) return;

    const code = normalizeScanCode(value);
    if (code === null) return;

    /* **보내기 전에 비운다** — 조회가 끝난 뒤 비우면 그사이 읽힌 코드가 앞 코드 뒤에 이어 붙는다. */
    setValue('');
    onScan(code);

    inputRef.current?.focus();
  };

  return (
    <form onSubmit={submit}>
      {/*
       * ⭐ **한 줄에 셋을 놓는다** — 칸 · [읽기] · [직접 입력]. 스펙 §3 이 이 구획에 88px 만
       * 준다. 대체 경로(D-3)를 아래 줄로 내리면 구획이 두 배가 되고, 그만큼 ③ 포장 구성이
       * 줄어 표가 한 줄도 못 보이는 화면이 된다.
       */}
      <div className="scan-row">
        <TextField
          ref={inputRef}
          label={label}
          value={value}
          fullWidth
          autoComplete="off"
          /*
           * ⛔ **조회 중에는 칸을 잠그지 않는다.** 잠그면 포커스가 칸을 떠나고, 되돌리기 전에
           * 읽힌 코드가 사라진다. 읽을 «차례»가 아닐 때만 잠근다.
           */
          disabled={locked}
          onChange={(event) => {
            setValue(event.target.value);
          }}
        />
        {/* 장갑 낀 손으로 누른다 — 스펙 §3 액션바 예산이 전제하는 72px 하한을 건다. */}
        <Button
          type="submit"
          variant="filled"
          size="xl"
          className="pop-touch-target"
          disabled={isScanning || locked}
        >
          {isScanning ? t.scan.scanning : t.scan.submit}
        </Button>
        {/*
         * 스캔 실패의 대체 경로(공유계약 D-3). **칸으로 포커스를 옮기는 것이 전부다** — 코드는
         * 이미 손으로 칠 수 있고, 없던 것은 「어디를 눌러야 하는가」였다. 터치 단말에서는 이
         * 포커스가 화면 자판을 함께 띄운다.
         */}
        <Button
          type="button"
          variant="outlined"
          size="xl"
          className="pop-touch-target"
          disabled={locked}
          onClick={() => {
            inputRef.current?.focus();
          }}
        >
          {t.scan.manualEntry}
        </Button>
      </div>

      {/*
       * ⚠ 잠긴 사유만 낸다. 상시 안내(「직접 칠 수 있습니다」)는 [직접 입력] 버튼이 이미 눈에
       * 보이는 자리에 있어 없어도 길을 잃지 않고, 한 줄이 늘 때마다 ③ 포장 구성이 줄어든다.
       */}
      {locked && <p className="field-note">{lockReason}</p>}
    </form>
  );
};
