import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..');
const KO = join(HERE, '..', '..', '..', '..', 'packages', 'i18n', 'src', 'ko');

const filesUnder = (root: string, ext: string): string[] => {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (path.endsWith(ext)) {
        found.push(path);
      }
    }
  };
  walk(root);
  return found;
};

const kebab = (name: string) => name.replace(/[A-Z]/g, (upper) => `-${upper.toLowerCase()}`);

/** 이 앱이 실제로 읽는 문구 파일만 본다. 관리웹과 POP 은 제 말을 따로 갖는다. */
const usedFiles = (): string[] => {
  const names = new Set<string>();
  for (const path of [...filesUnder(SRC, '.ts'), ...filesUnder(SRC, '.tsx')]) {
    if (path.endsWith('.test.ts') || path.endsWith('.test.tsx')) continue;
    for (const match of readFileSync(path, 'utf-8').matchAll(/messages\.([a-zA-Z]+)/g)) {
      names.add(kebab(match[1]!));
    }
  }
  return [...names].map((name) => join(KO, `${name}.ts`));
};

/** 주석은 만든 사람의 자리다. 화면에 나가는 것만 잰다. */
const shownStrings = (path: string): { line: number; text: string }[] => {
  const found: { line: number; text: string }[] = [];
  readFileSync(path, 'utf-8')
    .split('\n')
    .forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
      for (const match of line.matchAll(/'([^']{2,})'|`([^`]{2,})`/g)) {
        const text = match[1] ?? match[2];
        if (text !== undefined) {
          found.push({ line: index + 1, text });
        }
      }
    });
  return found;
};

/**
 * 만든 쪽의 말과 같은 것을 두 말로 부르는 것을 막는다.
 *
 * 화면마다 다른 말을 쓰면 작업자는 그것이 다른 것인 줄 안다. 실제로 기기와 단말, 보류와
 * 홀드, 발주와 P/O 가 갈려 있었고 파일을 하나씩 열어 보아서는 드러나지 않았다.
 *
 * 서버·공통코드·기준정보는 작업자가 확인할 길이 없는 것이라, 그것을 확인하라는 안내를
 * 받으면 할 수 있는 일이 없다.
 */
const BANNED: [string, string][] = [
  ['단말', '기기'],
  ['홀드', '보류'],
  ['미전송', '전송 대기'],
  ['P/O', 'ERP W/O'],
  ['공통코드', '관리자에게 문의'],
  ['기준정보', '작업자 정보 또는 관리자에게 문의'],
  ['서버', '보내다 · 등록되다'],
  ['줄', '라인'],
  ['자리', '위치'],
];

/** 예외는 여기에 적는다 - 적히지 않은 예외는 갈라진 것과 구별되지 않는다. */
const ALLOWED = [
  /* 관리웹이 이 값을 단말 코드로 보인다. 여기서만 다르게 부르면 안내와 어긋난다. */
  '관리자가 안내한 단말 코드와 같은지 확인하세요',
  /* 전표의 품목 행이 아니라 글자 한 줄이다. 증상을 길게 적지 말라는 뜻이라 바꿀 수 없다. */
  '무엇이 어떻게 되었는지 한 줄로 적어 주세요.',
  /* 아래 다섯은 보관 위치가 아니라 번호의 자릿수다. 라벨과 자릿수를 맞춰 세는 자리라 바꿀 수 없다. */
  '자재 LOT 번호는 34자리 숫자입니다 (현재 ${String(length)}자)',
  '자재 LOT은 ${String(required)}자리입니다. ${String(read)}자리를 읽었습니다.',
  '${length}/${total}자리',
  '자재 LOT 번호는 ${total}자리입니다 (현재 ${length}자리)',
  '라벨의 날짜 자리가 날짜가 아닙니다',
];

describe('화면에 나가는 말', () => {
  it('만든 쪽의 말을 쓰지 않는다', () => {
    const offenders: string[] = [];

    for (const path of usedFiles()) {
      const name = path.slice(KO.length + 1);
      for (const { line, text } of shownStrings(path)) {
        if (ALLOWED.includes(text)) continue;
        for (const [word, instead] of BANNED) {
          if (text.includes(word)) {
            offenders.push(`${name}:${String(line)} [${word} → ${instead}] ${text}`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
