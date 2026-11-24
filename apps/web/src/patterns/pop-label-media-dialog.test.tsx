import { messages } from '@omf-mes/i18n';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PopLabelMediaDialog } from './pop-label-media-dialog';
import type { LabelMediaState, LabelSettings } from './pop-label-media';

const t = messages.popChrome.labelMedia;

const STATE: LabelMediaState = {
  printer: 'HT800',
  hasPrinter: true,
  media: {
    widthMm: 82.6,
    heightMm: 39.9,
    kind: 'gap',
    gapMm: 2,
    offsetMm: 0,
    speed: 4,
    density: 8,
    linerWidthMm: null,
  },
  sizeSource: 'driver',
  driver: { widthMm: 82.6, heightMm: 39.9 },
  saved: null,
  envPinned: false,
};

const SAVED: LabelSettings = {
  size: { widthMm: 80, heightMm: 40 },
  kind: 'gap',
  gapMm: 2,
  offsetMm: 0,
  speed: 4,
  density: 8,
  linerWidthMm: 82.6,
};

interface FakeShell {
  read: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  calibrate: ReturnType<typeof vi.fn>;
  renditionSave: ReturnType<typeof vi.fn>;
}

const installShell = (state: LabelMediaState = STATE): FakeShell => {
  const read = vi.fn().mockResolvedValue(state);
  const save = vi.fn((settings: LabelSettings | null): Promise<LabelMediaState> => {
    if (settings === null) return Promise.resolve({ ...state, saved: null });

    const { size, ...rest } = settings;

    return Promise.resolve({
      ...state,
      saved: settings,
      sizeSource: size === null ? state.sizeSource : 'saved',
      media: { ...state.media, ...rest, ...(size ?? {}) },
    });
  });
  const calibrate = vi.fn().mockResolvedValue(undefined);
  const renditionSave = vi.fn().mockResolvedValue('C:/out/lot-sample.prn');
  (window as unknown as { pop: unknown }).pop = {
    rendition: { save: renditionSave },
    labelMedia: { read, save, calibrate },
  };
  return { read, save, calibrate, renditionSave };
};

afterEach(() => {
  delete (window as unknown as { pop?: unknown }).pop;
});

const dialog = () => screen.getByRole('dialog', { name: t.title });

describe('라벨지 설정 창', () => {
  it('셸에서 지금 쓰는 값을 읽어 보여 준다 — 서버를 부르지 않는다', async () => {
    const shell = installShell();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<PopLabelMediaDialog onClose={vi.fn()} />);

    expect(await within(dialog()).findByText('HT800')).toBeInTheDocument();
    expect(within(dialog()).getByText(t.source.driver)).toBeInTheDocument();
    expect(
      within(dialog()).getByRole('radio', {
        name: `${t.followDriver} (${t.sizeValue(82.6, 39.9)})`,
      }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(shell.read).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('⭐ 크기를 직접 정해 저장하면 셸에 남긴다 — 다음 인쇄부터 따른다', async () => {
    const user = userEvent.setup();
    const shell = installShell();
    render(<PopLabelMediaDialog onClose={vi.fn()} />);

    await user.click(await within(dialog()).findByRole('radio', { name: t.manual }));
    await user.click(within(dialog()).getByRole('radio', { name: t.sizeValue(80, 40) }));
    await user.click(within(dialog()).getByRole('button', { name: t.save }));

    await waitFor(() => {
      expect(shell.save).toHaveBeenCalledWith(SAVED, undefined);
    });
    expect(await within(dialog()).findByText(t.source.saved)).toBeInTheDocument();
  });

  it('⭐ 이형지 폭은 처음에 프린터 설정 가로(82.6)로 채운다 — 라벨 크기만 넣어도 찍히는 자리가 그대로다', async () => {
    const user = userEvent.setup();
    installShell();
    render(<PopLabelMediaDialog onClose={vi.fn()} />);

    await user.click(await within(dialog()).findByRole('radio', { name: t.manual }));

    expect(within(dialog()).getByLabelText(new RegExp(`^${t.linerWidth}`, 'u'))).toHaveValue(
      '82.6',
    );
    expect(within(dialog()).getByText(t.linerHint)).toBeInTheDocument();
  });

  it('⛔ 이형지가 라벨보다 좁으면 저장하지 않는다 · 비우면 라벨 가로와 같게 저장한다', async () => {
    const user = userEvent.setup();
    const shell = installShell();
    render(<PopLabelMediaDialog onClose={vi.fn()} />);

    await user.click(await within(dialog()).findByRole('radio', { name: t.manual }));
    await user.click(within(dialog()).getByRole('radio', { name: t.sizeValue(80, 40) }));
    const liner = within(dialog()).getByLabelText(new RegExp(`^${t.linerWidth}`, 'u'));
    await user.clear(liner);
    await user.type(liner, '79');

    expect(within(dialog()).getByText(t.linerNarrow)).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: t.save })).toBeDisabled();

    await user.clear(liner);
    await user.click(within(dialog()).getByRole('button', { name: t.save }));
    await waitFor(() => {
      expect(shell.save).toHaveBeenCalledWith({ ...SAVED, linerWidthMm: null }, undefined);
    });
  });

  it('[100 × 60]을 고르면 좁아진 이형지 폭을 비운다', async () => {
    const user = userEvent.setup();
    installShell();
    render(<PopLabelMediaDialog onClose={vi.fn()} />);

    await user.click(await within(dialog()).findByRole('radio', { name: t.manual }));
    await user.click(within(dialog()).getByRole('radio', { name: t.sizeValue(100, 60) }));

    expect(within(dialog()).getByLabelText(new RegExp(`^${t.linerWidth}`, 'u'))).toHaveValue('');
  });

  it('키패드로 칸 값을 넣는다 — 속도 · 농도는 정수만', async () => {
    const user = userEvent.setup();
    const shell = installShell();
    render(<PopLabelMediaDialog onClose={vi.fn()} />);

    const speed = await within(dialog()).findByLabelText(new RegExp(`^${t.speed}`, 'u'));
    await user.click(speed);
    await user.click(
      within(dialog()).getByRole('button', { name: messages.popUniform.keypad.backspace }),
    );
    await user.click(within(dialog()).getByRole('button', { name: '3' }));

    expect(speed).toHaveValue('3');
    expect(within(dialog()).getByRole('button', { name: '.' })).toBeDisabled();

    await user.click(within(dialog()).getByRole('button', { name: t.save }));
    await waitFor(() => {
      expect(shell.save).toHaveBeenCalledWith(
        { ...SAVED, size: null, linerWidthMm: null, speed: 3 },
        undefined,
      );
    });
  });

  it('⛔ 범위를 벗어난 값은 저장하지 않고 그 칸을 알린다', async () => {
    const user = userEvent.setup();
    const shell = installShell();
    render(<PopLabelMediaDialog onClose={vi.fn()} />);

    const density = await within(dialog()).findByLabelText(new RegExp(`^${t.density}`, 'u'));
    await user.clear(density);
    await user.type(density, '20');

    expect(within(dialog()).getByText(t.outOfRange(t.density, 0, 15))).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: t.save })).toBeDisabled();
    expect(shell.save).not.toHaveBeenCalled();
  });

  it('바꾼 채 저장하지 않았으면 보정 · 견본을 끄고 「저장한 뒤」를 알린다', async () => {
    const user = userEvent.setup();
    installShell();
    render(<PopLabelMediaDialog onClose={vi.fn()} />);

    await user.click(await within(dialog()).findByRole('radio', { name: t.kinds.bline }));

    expect(within(dialog()).getByRole('button', { name: t.calibrate })).toBeDisabled();
    expect(within(dialog()).getByRole('button', { name: t.sample })).toBeDisabled();
    expect(within(dialog()).getByText(t.saveFirst)).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: t.cancel })).toBeInTheDocument();
  });

  it('[라벨지 보정] · [견본 인쇄]는 단추로 보낸다(숨은 단축키를 대신한다)', async () => {
    const user = userEvent.setup();
    const shell = installShell({ ...STATE, saved: SAVED, sizeSource: 'saved' });
    render(<PopLabelMediaDialog onClose={vi.fn()} />);

    await user.click(await within(dialog()).findByRole('button', { name: t.calibrate }));
    await waitFor(() => {
      expect(shell.calibrate).toHaveBeenCalledTimes(1);
    });

    await user.click(within(dialog()).getByRole('button', { name: t.sample }));
    await waitFor(() => {
      expect(shell.renditionSave).toHaveBeenCalledTimes(1);
    });
    expect(shell.renditionSave.mock.calls[0]?.[3]).toBe('tspl');
  });

  it('[저장한 값 지우기]는 셸에 null 을 보낸다 — 프린터 설정 · 환경값 · 기본으로 돌아간다', async () => {
    const user = userEvent.setup();
    const shell = installShell({ ...STATE, saved: SAVED, sizeSource: 'saved' });
    render(<PopLabelMediaDialog onClose={vi.fn()} />);

    await user.click(await within(dialog()).findByRole('button', { name: t.clear }));

    await waitFor(() => {
      expect(shell.save).toHaveBeenCalledWith(null, undefined);
    });
  });
});
