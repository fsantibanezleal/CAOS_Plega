import type { DrawingPage, Ink } from "./drawing";
import fontLicense from "./assets/OFL.txt?raw";

export const xml = (text: string): string =>
  text
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&apos;");
const n = (value: number) => Number(value.toFixed(6)).toString();
function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export function drawingSvg(page: DrawingPage, font: Uint8Array): string {
  const metadata = {
    ...page.metadata,
    embeddedFont: {
      family: "Noto Sans",
      license: "OFL-1.1",
      notice: fontLicense,
    },
  };
  const clips = page.ink.flatMap((ink, index) =>
    ink.clip
      ? [
          `<clipPath id="clip-${index}"><rect x="${n(ink.clip.min[0])}" y="${n(page.height - ink.clip.max[1])}" width="${n(ink.clip.max[0] - ink.clip.min[0])}" height="${n(ink.clip.max[1] - ink.clip.min[1])}"/></clipPath>`,
        ]
      : [],
  );
  const render = (ink: Ink, index: number): string => {
    const identity = `data-entity="${xml(ink.id)}" data-layer="${xml(ink.layer)}"`,
      clip = ink.clip ? ` clip-path="url(#clip-${index})"` : "";
    if (ink.kind === "text")
      return `<g ${identity}${clip}><text transform="translate(${n(ink.position[0])} ${n(page.height - ink.position[1])}) rotate(${-ink.rotation})" font-family="PlegaNotoSans" font-size="${n(ink.size)}" fill="#161616">${xml(ink.text)}</text></g>`;
    const d =
      ink.points
        .map((p, i) => `${i ? "L" : "M"}${n(p[0])} ${n(page.height - p[1])}`)
        .join(" ") + (ink.closed ? " Z" : "");
    return `<path ${identity}${clip} d="${d}" fill="${ink.fill ?? "none"}" stroke="${ink.width > 0 ? ink.stroke : "none"}" stroke-width="${n(ink.width)}"${ink.dash?.length ? ` stroke-dasharray="${ink.dash.map(n).join(" ")}"` : ""}/>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${n(page.width)}mm" height="${n(page.height)}mm" viewBox="0 0 ${n(page.width)} ${n(page.height)}" role="img" aria-labelledby="sheet-title"><title id="sheet-title">${xml("PLEGA - " + page.id)}</title><metadata>${xml(JSON.stringify(metadata))}</metadata><defs><style>@font-face{font-family:PlegaNotoSans;src:url(data:font/ttf;base64,${base64(font)}) format('truetype');font-weight:400;font-style:normal}</style>${clips.join("")}</defs><rect width="100%" height="100%" fill="white"/>${page.ink.map(render).join("")}\n</svg>\n`;
}
