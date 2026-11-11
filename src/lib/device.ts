"use client";

const KEY = "tryout-skd-device-id";

/** ID perangkat/browser acak. Bukan fingerprint; hanya penanda sesi untuk kunci satu perangkat. */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    const w = window as unknown as { __deviceId?: string };
    if (!w.__deviceId) w.__deviceId = crypto.randomUUID();
    return w.__deviceId;
  }
}
