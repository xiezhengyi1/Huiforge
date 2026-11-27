const WORKFLOW_ARRANGE_GAP = 40;

function workflowAlignmentOrder(moves, axis, size, tieAxis, edges) {
  const sorted = [...moves].sort((a, b) => a[axis] - b[axis] || a[tieAxis] - b[tieAxis]);
  const groups = new Map();
  const byId = new Map();
  let group = 0;
  let end = -Infinity;
  for (const move of sorted) {
    if (move[axis] >= end) group += 1;
    end = Math.max(end, move[axis] + move[size]);
    const id = move.id;
    groups.set(id, group);
    byId.set(id, move);
  }
  if (group === sorted.length) return null;

  // Within a collision group, keep a connected input ahead of its downstream cards.
  const parents = new Map();
  for (const edge of edges) {
    const group = groups.get(edge.to_node);
    if (!group || group !== groups.get(edge.from_node)) continue;
    if (!parents.has(edge.to_node)) parents.set(edge.to_node, []);
    parents.get(edge.to_node).push(edge.from_node);
  }
  const visited = new Set();
  const ordered = [];
  for (const move of sorted) {
    const pending = [{ id:move.id, emit:false }];
    while (pending.length) {
      const { id, emit } = pending.pop();
      if (emit) {
        ordered.push(byId.get(id));
      } else if (!visited.has(id)) {
        visited.add(id);
        pending.push({ id, emit:true });
        const inputs = parents.get(id) || [];
        for (let i = inputs.length - 1; i >= 0; i -= 1) pending.push({ id:inputs[i], emit:false });
      }
    }
  }
  return ordered;
}

function separateWorkflowAlignedNodes(moves, horizontal, edges) {
  const axis = horizontal ? "y" : "x";
  const size = horizontal ? "height" : "width";
  const nextAxis = horizontal ? "nextY" : "nextX";
  const ordered = workflowAlignmentOrder(moves, axis, size, horizontal ? "x" : "y", edges);
  if (!ordered) return true;

  // Subtract the required spacing, then merge colliding runs at their mean position.
  const offsets = [];
  const runs = [];
  let offset = 0;
  for (const move of ordered) {
    offsets.push(offset);
    runs.push({ sum:move[axis] - offset, count:1 });
    offset += move[size] + WORKFLOW_ARRANGE_GAP;
    while (runs.length > 1) {
      const left = runs.at(-2);
      const right = runs.at(-1);
      if (left.sum / left.count <= right.sum / right.count) break;
      left.sum += right.sum;
      left.count += right.count;
      runs.pop();
    }
  }
  const lastStart = offsets.at(-1);
  if (lastStart > 100000) return false;
  let index = 0;
  for (const { sum, count } of runs) {
    const start = Math.max(-50000, Math.min(50000 - lastStart, sum / count));
    const end = index + count;
    while (index < end) {
      ordered[index][nextAxis] = start + offsets[index];
      index += 1;
    }
  }
  return true;
}

export function planWorkflowArrangement(items, mode, edges = []) {
  const distribute = mode === "space-x" || mode === "space-y";
  if (items.length < (distribute ? 3 : 2)) return [];
  const horizontal = ["left", "center", "right", "space-x"].includes(mode);
  const axis = horizontal ? "x" : "y";
  const size = horizontal ? "width" : "height";
  const nextAxis = horizontal ? "nextX" : "nextY";
  const moves = items.map((item) => ({ ...item, nextX:item.x, nextY:item.y }));
  if (distribute) {
    moves.sort((a, b) => a[axis] - b[axis] || (horizontal ? a.y - b.y : a.x - b.x));
    const first = moves[0];
    const last = moves.at(-1);
    const end = Math.max(...moves.map((move) => move[axis] + move[size]));
    const occupied = moves.reduce((total, item) => total + item[size], 0);
    const gap = Math.max(WORKFLOW_ARRANGE_GAP, (end - first[axis] - occupied) / (moves.length - 1));
    const span = occupied - last[size] + gap * (moves.length - 1);
    if (span > 100000) return null;
    const centered = (first[axis] + end - span - last[size]) / 2;
    let position = Math.max(-50000, Math.min(50000 - span, centered));
    for (const move of moves) {
      move[nextAxis] = position;
      position += move[size] + gap;
    }
  } else {
    const factor = ["left", "top"].includes(mode) ? 0 : (["right", "bottom"].includes(mode) ? 1 : .5);
    const start = Math.min(...items.map((item) => item[axis]));
    const end = Math.max(...items.map((item) => item[axis] + item[size]));
    const minAnchor = Math.max(...items.map((item) => -50000 + item[size] * factor));
    const maxAnchor = Math.min(...items.map((item) => 50000 + item[size] * factor));
    const anchor = Math.max(minAnchor, Math.min(maxAnchor, start + (end - start) * factor));
    for (const move of moves) move[nextAxis] = anchor - move[size] * factor;
    if (!separateWorkflowAlignedNodes(moves, horizontal, edges)) return null;
  }
  return moves;
}

export function indexWorkflowSnapEdges(boxes) {
  const x = [];
  const y = [];
  for (const box of boxes) {
    x.push({ value:box.x, end:false, box }, { value:box.x + box.width, end:true, box });
    y.push({ value:box.y, end:false, box }, { value:box.y + box.height, end:true, box });
  }
  return { x:x.sort((a, b) => a.value - b.value), y:y.sort((a, b) => a.value - b.value) };
}

function firstSnapEdgeAtOrAfter(edges, value) {
  let start = 0;
  let end = edges.length;
  while (start < end) {
    const middle = (start + end) >>> 1;
    if (edges[middle].value < value) start = middle + 1;
    else end = middle;
  }
  return start;
}

export function findWorkflowEdgeSnap(edges, axis, moving, offset, limits, zoom, previous) {
  const horizontal = axis === "x";
  const cross = horizontal ? "y" : "x";
  const crossSize = horizontal ? "height" : "width";
  const size = horizontal ? "width" : "height";
  const crossStart = moving[cross] + offset[cross];
  const crossEnd = crossStart + moving[crossSize];
  const tolerance = 8 / zoom;
  const nearby = 144 / zoom;
  const distanceAcross = (box) => Math.max(0, box[cross] - crossEnd, crossStart - box[cross] - box[crossSize]);
  const validOffset = (value) => value >= limits.min && value <= limits.max;
  if (previous && Math.abs(previous.offset - offset[axis]) <= 12 / zoom && validOffset(previous.offset) &&
      distanceAcross(previous.edge.box) <= nearby) return previous;

  let closest = null;
  let bestDistance = Infinity;
  let bestAcross = Infinity;
  for (const end of [false, true]) {
    const origin = moving[axis] + (end ? moving[size] : 0);
    const current = origin + offset[axis];
    const start = firstSnapEdgeAtOrAfter(edges, current - tolerance);
    for (let i = start; i < edges.length && edges[i].value <= current + tolerance; i += 1) {
      const edge = edges[i];
      const nextOffset = edge.value - origin;
      const across = distanceAcross(edge.box);
      if (across > nearby || !validOffset(nextOffset)) continue;
      const distance = Math.abs(edge.value - current);
      const sameSide = end === edge.end;
      if (!closest || distance < bestDistance || (distance === bestDistance &&
          (sameSide === closest.sameSide ? across < bestAcross : sameSide))) {
        closest = { edge, offset:nextOffset, sameSide };
        bestDistance = distance;
        bestAcross = across;
      }
    }
  }
  return closest;
}
