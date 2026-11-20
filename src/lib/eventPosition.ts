export function clampEventPosition(p: {x:number;y:number}, width: number, height: number) {
  return {x: Math.max(8, Math.min(width - 72, p.x)), y: Math.max(36, Math.min(height - 90, p.y))};
}
