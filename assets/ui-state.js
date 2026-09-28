/* Shared UI state; modules expose their operations on TEApp. */
globalThis.TEApp = {};
(function (app) {
  'use strict';
  app.$ = id => document.getElementById(id);
  app.esc = s => String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
  app.clock = null;
  app.checkpoint = null;
  app.lastMeshEdit = null;
  app.sweepResult = null;
  app.activeSweep = null;
  app.config = TE.default2D();
  app.selected = 0;
  app.result = null;
  app.worker = null;
  app.probe = 0;
  app.started = 0;
  app.paint = false;
  app.geomFrame = null;
  app.resultFrame = null;
  app.fmt = v => Math.abs(v) > 1e4 || v !== 0 && Math.abs(v) < .001 ? v.toExponential(3) : Number(v.toPrecision(5)).toString();
  app.amp = z => Math.hypot(z.re, z.im);
  app.phase = z => Math.atan2(z.im, z.re) * 180 / Math.PI;
  app.num = id => {
    const e = app.$(id);
    TE.assert(e.value.trim() !== '', `${id}: value required.`);
    return TE.readNumberInput(e);
  };
  app.exporting = false;
  app.timer = undefined;
})(globalThis.TEApp);
