const textEncoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function getDeviceSignal(): Promise<string> {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const shortSide = Math.min(screen.width, screen.height);
  const longSide = Math.max(screen.width, screen.height);

  const parts = [
    navigator.language,
    navigator.languages.join(","),
    navigator.platform,
    navigator.userAgent,
    String(navigator.hardwareConcurrency || 0),
    String(nav.deviceMemory || 0),
    `${shortSide}x${longSide}x${screen.colorDepth}`,
    String(navigator.maxTouchPoints || 0),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ];

  const digest = await crypto.subtle.digest(
    "SHA-256",
    textEncoder.encode(parts.join("|")),
  );

  return bytesToHex(new Uint8Array(digest));
}
