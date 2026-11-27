from pathlib import Path
import subprocess


def test_workflow_arrangement_keeps_cards_apart_and_respects_graph_order():
    module = Path(__file__).resolve().parents[1] / "frontend/js/features/workflow/layout.js"
    script = f"import {{planWorkflowArrangement}} from {module.as_uri()!r};\n" + """
import assert from 'node:assert/strict';
const row = [
  {id:'output', x:970, y:180, width:300, height:411},
  {id:'tool', x:460, y:180, width:430, height:416},
  {id:'input', x:80, y:180, width:300, height:273},
];
const edges = [
  {from_node:'input', to_node:'tool'},
  {from_node:'tool', to_node:'output'},
];
for (const [mode, factor] of [['left',0], ['center',.5], ['right',1]]) {
  const moves = planWorkflowArrangement(row, mode, edges).sort((a, b) => a.nextY - b.nextY);
  assert.deepEqual(moves.map(node => node.id), ['input','tool','output']);
  assert.equal(new Set(moves.map(node => node.nextX + node.width * factor)).size, 1);
  for (let i = 1; i < moves.length; i++) {
    assert.ok(moves[i].nextY > moves[i-1].nextY + moves[i-1].height);
  }
}

const column = row.map((node, i) => ({...node, x:80, y:i*550}));
for (const [mode, factor] of [['top',0], ['middle',.5], ['bottom',1]]) {
  const moves = planWorkflowArrangement(column, mode, edges).sort((a, b) => a.nextX - b.nextX);
  assert.deepEqual(moves.map(node => node.id), ['input','tool','output']);
  assert.equal(new Set(moves.map(node => node.nextY + node.height * factor)).size, 1);
  for (let i = 1; i < moves.length; i++) {
    assert.ok(moves[i].nextX > moves[i-1].nextX + moves[i-1].width);
  }
}
assert.deepEqual(planWorkflowArrangement(column, 'left', edges).map(node => node.nextY), column.map(node => node.y));
assert.deepEqual(planWorkflowArrangement(row, 'top', edges).map(node => node.nextX), row.map(node => node.x));

for (const [mode, axis, size, next] of [
  ['space-x', 'x', 'width', 'nextX'],
  ['space-y', 'y', 'height', 'nextY'],
]) {
  const tightlyPacked = row.map((node, i) => ({...node, [axis]:i*50}));
  const moves = planWorkflowArrangement(tightlyPacked, mode, edges).sort((a,b) => a[next] - b[next]);
  const gaps = moves.slice(1).map((node, i) => node[next] - moves[i][next] - moves[i][size]);
  assert.ok(gaps[0] > 0);
  assert.ok(Math.abs(gaps[0] - gaps[1]) < 1e-8);
  assert.equal(moves[0][next] + moves.at(-1)[next] + moves.at(-1)[size],
    Math.min(...tightlyPacked.map(node => node[axis])) + Math.max(...tightlyPacked.map(node => node[axis] + node[size])));
}
"""
    result = subprocess.run(["node", "--input-type=module", "-e", script], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr


def test_workflow_edge_snapping_respects_zoom_proximity_and_release_distance():
    module = Path(__file__).resolve().parents[1] / "frontend/js/features/workflow/layout.js"
    script = f"import {{findWorkflowEdgeSnap, indexWorkflowSnapEdges}} from {module.as_uri()!r};\n" + """
import assert from 'node:assert/strict';
const moving = {x:50, y:200, width:100, height:80};
const target = {x:200, y:240, width:90, height:85};
const far = {x:150, y:900, width:100, height:80};
const index = indexWorkflowSnapEdges([target, far]);
const limits = {min:-1000, max:1000};
const magnet = findWorkflowEdgeSnap(index.x, 'x', moving, {x:44,y:0}, limits, 1);
assert.equal(magnet.offset, 50);
assert.equal(magnet.edge.box, target);
assert.equal(findWorkflowEdgeSnap(index.x, 'x', moving, {x:44,y:0}, limits, 2), null);
assert.equal(findWorkflowEdgeSnap(index.x, 'x', moving, {x:39,y:0}, limits, 1, magnet), magnet);
assert.equal(findWorkflowEdgeSnap(index.x, 'x', moving, {x:36,y:0}, limits, 1, magnet), null);
assert.equal(findWorkflowEdgeSnap(index.x, 'x', moving, {x:44,y:0}, {min:0,max:49}, 1), null);
assert.equal(findWorkflowEdgeSnap(index.x, 'x', moving, {x:0,y:0}, limits, 1), null);
const top = findWorkflowEdgeSnap(index.y, 'y', moving, {x:44,y:42}, limits, 1);
assert.equal(top.offset, 40);
assert.equal(top.edge.value, target.y);
const bottom = findWorkflowEdgeSnap(index.y, 'y', moving, {x:44,y:45}, limits, 1);
assert.equal(bottom.offset, 45);
assert.equal(bottom.edge.value, target.y + target.height);
"""
    result = subprocess.run(["node", "--input-type=module", "-e", script], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
