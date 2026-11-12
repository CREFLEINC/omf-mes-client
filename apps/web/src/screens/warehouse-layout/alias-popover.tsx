import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState } from 'react';

import { useAliasSave } from '../warehouse-location/use-alias-save';
import type { LocationView } from './types';

const t = messages.warehouseLayout;
const wl = messages.warehouseLocation;

/** 서버 한도(#875). */
const ALIAS_MAX_LENGTH = 200;

export interface AliasPopoverProps {
  location: LocationView;
  onClose: () => void;
  /** 저장했을 때 — 서버가 돌려준 위치. 표식 이름을 바로 바꾸는 데 쓴다. */
  onSaved: (location: LocationView) => void;
}

/**
 * 배치도 편집 창의 별칭 고치기(#267 FR-007a · 계약 §4 · plan R-5b). 목록 이름 칸이 좁아(약 100px) 줄 안 입력칸 대신 작은
 * 팝오버로 연다. 저장은 창고·Location 목록과 같은 훅(`use-alias-save` — 잠금 값 · 이름 규칙 · 충돌)이고, 배치도 편집
 * 상태(draft · dirty · 되돌리기 · 닫기 확인)와 상관없다. Enter 는 저장, Esc 는 이 팝오버만 닫는다(편집 창은 그대로).
 *
 * 입력칸은 팝오버 폭(300px)을 다 쓴다 — 좁게 눌린 입력칸은 IME 확정마다 커서가 맨 앞으로 간다(#267 K1 실동작).
 */
export const AliasPopover = ({ location, onClose, onSaved }: AliasPopoverProps) => {
  const { load, save } = useAliasSave();
  const [text, setText] = useState(location.aliasName ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const loaded = useRef<Promise<unknown> | null>(null);
  const titleId = useId();

  /* 여는 순간의 판을 잠금 기준으로 — 그 사이 남이 고쳤으면 저장이 걸린다. */
  useEffect(() => {
    loaded.current = load(location.locationId).catch(() => undefined);
  }, [load, location.locationId]);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    await loaded.current;
    const result = await save(location, text);
    setSaving(false);
    if (result.kind === 'saved') {
      onSaved(result.location);
      onClose();
      return;
    }
    if (result.kind === 'conflict') {
      setText(result.latestAlias);
      setMessage(wl.aliasEdit.conflict);
      return;
    }
    setMessage(result.message);
  };

  return (
    <div className="layout-alias-popover" role="dialog" aria-labelledby={titleId}>
      <strong id={titleId}>{t.aliasPopover.title(location.locationCode)}</strong>
      <TextField
        size="sm"
        fullWidth
        aria-label={wl.aliasEdit.edit(location.locationCode)}
        value={text}
        maxLength={ALIAS_MAX_LENGTH}
        disabled={saving}
        autoFocus
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void submit();
          }
          if (event.key === 'Escape') {
            /* 편집 창이 Esc 를 받지 않게 — 팝오버만 닫는다. */
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
        }}
      />
      {message === null ? (
        <span className="field-note">{t.aliasPopover.note}</span>
      ) : (
        <span role="alert" className="field-error">
          {message}
        </span>
      )}
      <div className="layout-alias-popover-actions">
        <Button variant="outlined" size="sm" disabled={saving} onClick={onClose}>
          {messages.common.cancel}
        </Button>
        <Button size="sm" loading={saving} disabled={saving} onClick={() => void submit()}>
          {messages.common.save}
        </Button>
      </div>
    </div>
  );
};
