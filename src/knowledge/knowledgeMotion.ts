export type DiagramPoint = { x: number; y: number };
export const hubBranchGeometry = (x: number, y: number) => {
  const start = { x: 664, y: 260 };
  const control = { x: x + 110, y: 260 };
  const end = { x: x + 110, y: y + 56 };
  return {
    start,
    control,
    end,
    path: `M${start.x} ${start.y} Q${control.x} ${control.y} ${end.x} ${end.y}`,
  };
};
export const quadraticBezierPoint = (
  geometry: { start: DiagramPoint; control: DiagramPoint; end: DiagramPoint },
  progress: number,
): DiagramPoint => {
  const t = Math.max(0, Math.min(1, progress)),
    rest = 1 - t;
  return {
    x:
      rest * rest * geometry.start.x +
      2 * rest * t * geometry.control.x +
      t * t * geometry.end.x,
    y:
      rest * rest * geometry.start.y +
      2 * rest * t * geometry.control.y +
      t * t * geometry.end.y,
  };
};
