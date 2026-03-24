import { PDFDocument, rgb, degrees } from 'pdf-lib';

/**
 * Add a watermark with request ID to a PDF file
 * Returns the watermarked PDF as Uint8Array
 */
export async function addWatermark(
  pdfBytes: Uint8Array | ArrayBuffer,
  trackingCode: string,
  extraText?: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  const watermarkText = `${trackingCode}${extraText ? ` | ${extraText}` : ''} | ${new Date().toISOString().slice(0, 10)}`;

  for (const page of pages) {
    const { width, height } = page.getSize();

    // Semi-transparent diagonal watermark
    page.drawText(watermarkText, {
      x: width * 0.1,
      y: height * 0.5,
      size: 10,
      color: rgb(0.7, 0.7, 0.7),
      opacity: 0.3,
      rotate: degrees(45),
    });

    // Small footer watermark
    page.drawText(watermarkText, {
      x: 10,
      y: 10,
      size: 6,
      color: rgb(0.8, 0.8, 0.8),
      opacity: 0.5,
    });
  }

  // Also add to PDF metadata
  pdfDoc.setTitle(pdfDoc.getTitle() ?? 'Document');
  pdfDoc.setSubject(`Tracking: ${trackingCode}`);
  pdfDoc.setKeywords([trackingCode]);

  return pdfDoc.save();
}
