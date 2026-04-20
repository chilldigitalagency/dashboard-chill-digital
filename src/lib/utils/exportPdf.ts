export async function exportToPdf(element: HTMLElement, filename: string) {
  const [{ toPng }, { default: jsPDF }] = await Promise.all([
    import("html-to-image"),
    import("jspdf"),
  ]);

  // Expand table scroll containers so no scrollbar appears in the capture
  type Patch = { el: HTMLElement; prev: string };
  const patches: Patch[] = [];
  element.querySelectorAll<HTMLElement>('[class*="overflow-x-auto"], [class*="overflow-x-scroll"]').forEach((el) => {
    patches.push({ el, prev: el.style.overflow });
    el.style.overflow = "visible";
    el.style.overflowX = "visible";
  });
  // Also suppress scrollbar via injected style
  const noScrollStyle = document.createElement("style");
  noScrollStyle.textContent = "* { scrollbar-width: none !important; } *::-webkit-scrollbar { display: none !important; }";
  element.prepend(noScrollStyle);

  let dataUrl: string;
  try {
    dataUrl = await toPng(element, {
      pixelRatio: 2,
      backgroundColor: "#0d0c1a",
      skipFonts: true,
      includeQueryParams: true,
    });
  } finally {
    // Restore overflow
    patches.forEach(({ el, prev }) => {
      el.style.overflow = prev;
      el.style.overflowX = "";
    });
    noScrollStyle.remove();
  }

  const img = new Image();
  await new Promise<void>((resolve) => { img.onload = () => resolve(); img.src = dataUrl; });

  const pdfWidth  = img.naturalWidth  / 2;
  const pdfHeight = img.naturalHeight / 2;

  const pdf = new jsPDF({
    orientation: pdfWidth > pdfHeight ? "landscape" : "portrait",
    unit: "px",
    format: [pdfWidth, pdfHeight],
    hotfixes: ["px_scaling"],
  });

  pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);
  pdf.save(filename);
}
