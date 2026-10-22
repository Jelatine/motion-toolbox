/* angle = (pulse - offset) / (PPR × N) × 360° × dir + angle_offset
   At a fixed pulse the reading shifts 1:1 with angle_offset, so making the
   physical position that currently reads `current` read `target` instead needs
   new angle_offset = angle_offset + (target - current). */
(function (root) {
  'use strict';
  function offsetFor(angleOffset, target, current) {
    const delta = target - current;
    return {delta, angleOffset: angleOffset + delta};
  }
  const compute = rows => rows.map(r => offsetFor(r.angleOffset, r.target, r.current));
  /* Accepts comma / whitespace / semicolon separated lists, including full-width separators. */
  const parseList = text => String(text).trim().split(/[\s,;，；、]+/).filter(Boolean).map(Number);
  const api = {offsetFor, compute, parseList};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  else root.AngleOffsetMath=api;
})(globalThis);
