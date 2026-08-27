import { beforeEach, describe, expect, it, vi } from 'vitest';

const checkPermissions = vi.fn();
const requestPermissions = vi.fn();
const takePhoto = vi.fn();

vi.mock('@capacitor/camera', () => ({
  Camera: {
    checkPermissions: (...args: unknown[]) => checkPermissions(...args),
    requestPermissions: (...args: unknown[]) => requestPermissions(...args),
    takePhoto: (...args: unknown[]) => takePhoto(...args),
  },
}));

const { capturePhoto, CameraPermissionDenied } = await import('./photo-capture');

describe('사진 촬영', () => {
  beforeEach(() => {
    checkPermissions.mockReset();
    requestPermissions.mockReset();
    takePhoto.mockReset();
  });

  it('권한이 이미 있으면 다시 요청하지 않는다', async () => {
    checkPermissions.mockResolvedValue({ camera: 'granted', photos: 'granted' });
    takePhoto.mockResolvedValue({ type: 'image', saved: false, webPath: 'blob:syn-1' });

    await expect(capturePhoto()).resolves.toMatchObject({ webPath: 'blob:syn-1' });
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it('권한이 없으면 요청한 뒤 촬영한다', async () => {
    checkPermissions.mockResolvedValue({ camera: 'prompt', photos: 'prompt' });
    requestPermissions.mockResolvedValue({ camera: 'granted', photos: 'granted' });
    takePhoto.mockResolvedValue({ type: 'image', saved: false, webPath: 'blob:syn-2' });

    await expect(capturePhoto()).resolves.toMatchObject({ webPath: 'blob:syn-2' });
    expect(requestPermissions).toHaveBeenCalledWith({ permissions: ['camera'] });
  });

  it('권한이 거부되면 촬영하지 않고 그 사실을 알린다', async () => {
    checkPermissions.mockResolvedValue({ camera: 'prompt', photos: 'prompt' });
    requestPermissions.mockResolvedValue({ camera: 'denied', photos: 'denied' });

    await expect(capturePhoto()).rejects.toBeInstanceOf(CameraPermissionDenied);
    expect(takePhoto).not.toHaveBeenCalled();
  });

  it('촬영 실패를 삼키지 않는다', async () => {
    checkPermissions.mockResolvedValue({ camera: 'granted', photos: 'granted' });
    takePhoto.mockRejectedValue(new Error('카메라를 열지 못했습니다'));

    await expect(capturePhoto()).rejects.toThrow('카메라를 열지 못했습니다');
  });
});
