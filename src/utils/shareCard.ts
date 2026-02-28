export type ShareCardTemplate = "divination_decode" | "model_snapshot";

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyPngToClipboard(blob: Blob) {
  const w = (navigator as unknown as { clipboard?: { write?: (items: ClipboardItem[]) => Promise<void> } }).clipboard?.write;
  if (!w) return false;
  try {
    await w([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}
