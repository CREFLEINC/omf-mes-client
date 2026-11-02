import { Chip } from '@crefle/web-ui';

import { codeValueLabel } from './disposition-codes';
import type { DispositionLookup } from './lookups';

/**
 * 심각도 배지(사용자 지시 · omf-all-around#223) — 중대는 붉게, 중은 주황, 경은 회색. 모르는 코드도 회색에 코드 그대로(G-9).
 * 색만으로 말하지 않는다 — 배지 글자가 이름이다.
 */
const TONE: Record<string, 'error' | 'warning' | 'idle'> = {
  CRITICAL: 'error',
  MAJOR: 'warning',
  MINOR: 'idle',
};

export const SeverityBadge = ({
  severity,
  code,
}: {
  severity: DispositionLookup;
  code: string;
}) => (
  <Chip size="sm" status={TONE[code] ?? 'idle'}>
    {codeValueLabel(severity, code)}
  </Chip>
);
