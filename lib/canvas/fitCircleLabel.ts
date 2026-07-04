// Font size is derived from the circle's radius (graph units), not divided by globalScale, so the
// label scales visually with the circle as the user zooms rather than staying a fixed screen size.
export function fitCircleLabelFontSize(ctx: CanvasRenderingContext2D, text: string, radius: number): number {
  const maxWidth = radius * 1.6;
  let fontSize = Math.max(radius * 0.5, 6);
  ctx.font = `600 ${fontSize}px sans-serif`;
  while (fontSize > 6 && ctx.measureText(text).width > maxWidth) {
    fontSize -= 1;
    ctx.font = `600 ${fontSize}px sans-serif`;
  }
  return fontSize;
}
