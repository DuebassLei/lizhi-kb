import { jsPDF } from "jspdf";
import { blobToUint8Array, saveBytesWithDialog } from "./writeExportBytes";
import { captureCardPng, yieldToUi } from "./exportImage";

export async function exportCardsAsPDF(
  cardEls: HTMLElement[],
  cardWidth: number,
  cardHeight: number,
  filename: string,
  scale: number = 2,
  onProgress?: (current: number, total: number) => void,
): Promise<boolean> {
  if (cardEls.length === 0) return false;

  const orientation = cardWidth > cardHeight ? "landscape" : "portrait";
  const pdf = new jsPDF({
    orientation,
    unit: "px",
    format: [cardWidth, cardHeight],
    hotfixes: ["px_scaling"],
  });

  for (let i = 0; i < cardEls.length; i += 1) {
    onProgress?.(i + 1, cardEls.length);
    await yieldToUi();
    const blob = await captureCardPng(cardEls[i]!, scale);
    const url = URL.createObjectURL(blob);
    try {
      if (i > 0) {
        pdf.addPage([cardWidth, cardHeight], orientation);
      }
      pdf.addImage(url, "PNG", 0, 0, cardWidth, cardHeight);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const pdfBlob = pdf.output("blob");
  const bytes = await blobToUint8Array(pdfBlob);
  const name = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  return saveBytesWithDialog(bytes, name, [
    { name: "PDF 文档", extensions: ["pdf"] },
  ]);
}
