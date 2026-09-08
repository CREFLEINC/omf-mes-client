import { Button, TextField } from '@crefle/web-ui';
import { useEffect, useRef, useState } from 'react';

import './manual-entry.css';

interface ManualEntryProps {
  /** 여는 단추와 칸이 함께 쓰는 이름. */
  label: string;
  submitLabel: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  inputMode?: 'numeric' | 'decimal';
}

/**
 * 스캐너가 죽었을 때 손으로 넣는 길.
 *
 * 칸을 스캔 칸과 나란히 세워 두면 어느 쪽이 기본인지 흐려지고, 스캐너를 쥔 손이 쓸 일 없는
 * 칸이 화면을 차지한다. 고른 사람에게만 칸을 낸다 - POP 툴 사용 화면이 같은 결정을 했다.
 */
export const ManualEntry = ({
  label,
  submitLabel,
  value,
  onChange,
  onSubmit,
  inputMode,
}: ManualEntryProps) => {
  const [open, setOpen] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  /* 고른 뒤에 한 번 더 칸을 눌러야 한다면 단추를 둔 뜻이 없다. */
  useEffect(() => {
    if (open) {
      field.current?.focus();
    }
  }, [open]);

  if (!open) {
    return (
      <Button
        className="manual-entry__open"
        variant="text"
        size="xl"
        onClick={() => {
          setOpen(true);
        }}
      >
        {label}
      </Button>
    );
  }

  return (
    <div className="manual-entry">
      <TextField
        ref={field}
        label={label}
        size="xl"
        fullWidth
        inputMode={inputMode}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      <Button variant="outlined" size="xl" onClick={onSubmit}>
        {submitLabel}
      </Button>
    </div>
  );
};
