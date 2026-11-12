import { IconButton, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState } from 'react';

import type { Location } from './types';
import { useAliasSave } from './use-alias-save';

const t = messages.warehouseLocation;

/** 서버 한도(#875) — 넘으면 400 INVALID 다. */
const ALIAS_MAX_LENGTH = 200;

export interface AliasInlineEditProps {
  location: Location;
  /** 저장했거나 취소했을 때 — 줄을 보기로 되돌린다. */
  onClose: () => void;
}

/**
 * 목록 줄 안의 별칭 입력칸(#267 FR-007 · 계약 §4). Enter · 확인은 저장, Esc 는 취소다. 저장 중에는 입력을 막는다.
 * 남이 먼저 고쳤으면(409 · 412) 최신 별칭을 칸에 다시 채우고 줄에 알린다 — 칸은 열어 둔다.
 */
export const AliasInlineEdit = ({ location, onClose }: AliasInlineEditProps) => {
  const { load, save } = useAliasSave();
  const [text, setText] = useState(location.aliasName ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const loaded = useRef<Promise<unknown> | null>(null);

  /* 여는 순간의 판을 잠금 기준으로 — 그 사이 남이 고쳤으면 저장이 걸린다. */
  useEffect(() => {
    loaded.current = load(location.locationId).catch(() => undefined);
  }, [load, location.locationId]);

  const label = t.aliasEdit.edit(location.locationCode);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    await loaded.current;
    const result = await save(location, text);
    setSaving(false);
    if (result.kind === 'saved') {
      onClose();
      return;
    }
    if (result.kind === 'conflict') {
      setText(result.latestAlias);
      setMessage(t.aliasEdit.conflict);
      return;
    }
    setMessage(result.message);
  };

  return (
    <div className="location-alias-edit">
      <div className="location-alias-edit-row">
        <TextField
          size="sm"
          containerClassName="location-alias-input"
          aria-label={label}
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
              /* 창 · 표가 Esc 를 받지 않게 — 고치던 값만 버린다. */
              event.preventDefault();
              event.stopPropagation();
              onClose();
            }
          }}
        />
        <IconButton
          size="sm"
          icon="check"
          aria-label={messages.common.save}
          disabled={saving}
          onClick={() => void submit()}
        />
        <IconButton
          size="sm"
          icon="close"
          aria-label={messages.common.cancel}
          disabled={saving}
          onClick={onClose}
        />
      </div>
      {message !== null && (
        <span role="alert" className="field-error">
          {message}
        </span>
      )}
    </div>
  );
};
