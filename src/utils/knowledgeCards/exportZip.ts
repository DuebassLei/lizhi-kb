import JSZip from "jszip";
import { captureCardPng, yieldToUi } from "./exportImage";
import { blobToUint8Array, saveBytesWithDialog } from "./writeExportBytes";

export async function exportCardsAsZIP(
  cardEls: HTMLElement[],
  baseFilename: string,
  scale: number = 2,
  onProgress?: (current: number, total: number) => void,
): Promise<boolean> {
  if (cardEls.length === 0) return false;

  const zip = new JSZip();
  const folder = zip.folder(baseFilename) ?? zip;

  for (let i = 0; i < cardEls.length; i += 1) {
    onProgress?.(i + 1, cardEls.length);
    await yieldToUi();
    const blob = await captureCardPng(cardEls[i]!, scale);
    const pageNum = String(i + 1).padStart(2, "0");
    folder.file(`${baseFilename}-${pageNum}.png`, blob);
  }

  onProgress?.(cardEls.length, cardEls.length);
  await yieldToUi();
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const bytes = await blobToUint8Array(zipBlob);
  const name = baseFilename.endsWith(".zip") ? baseFilename : `${baseFilename}.zip`;
  return saveBytesWithDialog(bytes, name, [
    { name: "ZIP 压缩包", extensions: ["zip"] },
  ]);
}
