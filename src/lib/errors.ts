const MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "Sesi login berakhir. Silakan login kembali.",
  ACCOUNT_INACTIVE: "Akun Anda tidak aktif. Hubungi panitia.",
  TOO_MANY_ATTEMPTS: "Terlalu banyak percobaan token. Coba lagi dalam 10 menit.",
  EXAM_NOT_AVAILABLE: "Ujian belum dibuka atau sudah ditutup.",
  ALREADY_STARTED: "Anda sudah memulai ujian.",
  INVALID_TOKEN: "Token tidak valid.",
  TOKEN_REQUIRED: "Masukkan token ujian terlebih dahulu.",
  INVALID_DEVICE: "Perangkat tidak dikenali. Muat ulang halaman.",
  SESSION_CLOSED: "Sesi ujian sudah berakhir.",
  DEVICE_MISMATCH: "Ujian sedang dibuka di perangkat lain.",
  NOT_FOUND: "Sesi ujian tidak ditemukan.",
  INVALID_PAYLOAD: "Data tidak valid.",
};

export function errorMessage(code: string | undefined | null, fallback = "Terjadi kesalahan. Coba lagi.") {
  if (!code) return fallback;
  return MESSAGES[code] ?? fallback;
}
