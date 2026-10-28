import { Button, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { BomTreeRow } from './bom-tree';
import { OneLine } from './po-board';

/** 줄 칸의 문구 — 화면마다 제 문구 묶음에서 넘긴다. */
export interface BomTreeCellLabels {
  loading: string;
  failed: string;
  cycle: string;
  depthLimit: string;
  expand: (label: string) => string;
  collapse: (label: string) => string;
  retry: (label: string) => string;
}

export interface BomTreeCellProps {
  row: BomTreeRow;
  /** 품목코드 — 받기 전 · 못 받음이면 `null` 이고 `name` 자리에 그 사정을 낸다. */
  code: string | null;
  name: string;
  labels: BomTreeCellLabels;
  onToggle: (key: string) => void;
  /** 하위 구성을 받지 못한 줄의 다시 시도. */
  onRetry: () => void;
}

/** 하이라키 칸 — 단계만큼 들여 쓰고, 하위 구성이 있으면 펼치고 접는 단추를 앞에 둔다. */
export const BomTreeCell = ({ row, code, name, labels, onToggle, onRetry }: BomTreeCellProps) => {
  const label = code === null ? name : `${code} · ${name}`;
  const canToggle = row.state === 'expanded' || row.state === 'collapsed';
  const note =
    row.state === 'loading'
      ? labels.loading
      : row.state === 'failed'
        ? labels.failed
        : row.state === 'cycle'
          ? labels.cycle
          : row.state === 'depthLimit'
            ? labels.depthLimit
            : null;

  return (
    <span className="bom-tree-cell">
      {/* 연결선 — 윗 단계마다 세로선(이어지면 │, 끝났으면 빈칸), 그다음 이 줄의 가지선(├ · └). 뿌리는 없다. */}
      {row.rails.map((pass, level) => (
        <span
          /* 단계 자리라 순서가 곧 열쇠다. */
          key={level}
          className="bom-tree-rail"
          data-line={pass ? 'pass' : 'none'}
          aria-hidden="true"
        />
      ))}
      {row.depth > 0 && (
        <span
          className="bom-tree-rail"
          data-line={row.isLast ? 'elbow' : 'tee'}
          aria-hidden="true"
        />
      )}
      {canToggle ? (
        <button
          type="button"
          className="bom-tree-toggle"
          aria-expanded={row.state === 'expanded'}
          aria-label={row.state === 'expanded' ? labels.collapse(label) : labels.expand(label)}
          onClick={() => {
            onToggle(row.key);
          }}
        >
          <Icon name={row.state === 'expanded' ? 'expand_more' : 'chevron_right'} size={18} />
        </button>
      ) : (
        /* 하위 구성이 없는 줄은 가지선을 이름 앞까지 끌어온다. */
        <span
          className="bom-tree-spacer"
          data-branch={row.depth > 0 ? 'true' : undefined}
          aria-hidden="true"
        />
      )}
      {/* 품목코드는 굵게(사용자 지시 2026-10-27) — 이름은 넘치면 말줄임. */}
      {code !== null && <span className="bom-tree-code">{code}</span>}
      <OneLine text={code === null ? name : `· ${name}`} />
      {note !== null && <span className="field-note bom-tree-note">{note}</span>}
      {row.state === 'failed' && (
        <Button variant="text" size="sm" aria-label={labels.retry(label)} onClick={onRetry}>
          {messages.common.retry}
        </Button>
      )}
    </span>
  );
};
