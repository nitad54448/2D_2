/* Offline project reader. Only JSON data is read; archived HTML is never executed. */
(function (TE) {
  'use strict';
  const limit = 2 * 1024 * 1024 * 1024, jsonLimit = 256 * 1024 * 1024;
  TE.projectLimits = Object.freeze({archiveBytes: limit, jsonBytes: jsonLimit});
  const text = new TextDecoder('utf-8', {fatal: true});
  const crcTable = Uint32Array.from({length: 256}, (_, i) => {
    for (let k = 0; k < 8; k++) i = i & 1 ? 0xedb88320 ^ (i >>> 1) : i >>> 1;
    return i >>> 0;
  });
  const assert = TE.assert;
  const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const same = (a, b) => {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b, k) && same(a[k], b[k]));
  };
  // Project file format version written by exports and required on import.
  TE.projectVersion = 2;
  TE.checkEditorModel = c => {
    assert(object(c) && c.version === TE.modelVersion, `Unsupported model version: expected "version": ${TE.modelVersion}.`);
    TE.assertValid2DConfig(c);
    assert(c.materials.every(m => ['rho', 'Cp', 'k', 'sigma', 'alpha'].every(k => typeof m[k] === 'number')), 'The editor requires scalar material reference values.');
    assert([64, 128, 256, 512, 1024].includes(c.samples), 'Unsupported editor time-step count.');
    assert(c.materials.every(m => typeof m.name === 'string' && m.name.length <= 1000), 'Invalid material name.');
    assert(c.description === undefined || typeof c.description === 'string' && c.description.length <= 10000, 'Invalid model description.');
    if (c.sweep?.enabled) TE.validateSweep(c);
    return c;
  };
  TE.checkProjectResult = r => {
    assert(object(r) && object(r.config), 'Missing computed result or saved model.');
    TE.checkEditorModel(r.config);
    const c = r.config, nodes = (c.nx + 1) * (c.ny + 1), cells = c.nx * c.ny;
    assert(typeof r.method === 'string' && r.method.length < 300 && typeof r.converged === 'boolean', 'Invalid result method or convergence flag.');
    const periodic = r.method !== 'steady';
    assert(periodic === (c.mode === 'periodic'), 'Result method does not match its model.');
    const finite = (v, label) => assert(typeof v === 'number' && Number.isFinite(v), 'Invalid ' + label + '.');
    const vector = (v, length, label) => {
      assert(Array.isArray(v) && v.length === length, 'Incorrect dimensions for ' + label + '.');
      v.forEach(x => finite(x, label));
    };
    assert(object(r.mesh), 'Missing result mesh.');
    for (const key of ['nx', 'ny', 'lx', 'ly']) assert(r.mesh[key] === c[key], 'Result mesh disagrees with model.');
    vector(r.mesh.x, nodes, 'mesh x'); vector(r.mesh.y, nodes, 'mesh y');
    assert(same(r.mesh.materialMap, c.materialMap), 'Result materials disagree with model.');
    for (let i = 0; i < nodes; i++) {
      assert(Math.abs(r.mesh.x[i] - (i % (c.nx + 1)) * c.lx / c.nx) <= c.lx * 1e-12 &&
        Math.abs(r.mesh.y[i] - Math.floor(i / (c.nx + 1)) * c.ly / c.ny) <= c.ly * 1e-12, 'Incorrect mesh coordinates.');
    }
    const widths = {temperature: nodes, voltage: nodes, Jx: cells, Jy: cells, qx: cells, qy: cells};
    if (periodic) {
      assert(r.samples === c.samples && r.frequency === c.frequency, 'Result sampling disagrees with model.');
      assert(Number.isInteger(r.periods) && r.periods >= 1 && r.periods <= c.maxPeriods, 'Invalid completed-cycle count.');
      assert(r.periodicError === null || Number.isFinite(r.periodicError) && r.periodicError >= 0, 'Invalid periodic error.');
      assert(!r.converged || r.periodicError !== null && r.periodicError <= 1, 'Converged result has an invalid cycle error.');
      vector(r.time, r.samples, 'time');
      r.time.forEach((t, i) => assert(Math.abs(t - i / (r.samples * r.frequency)) <= 1e-10 / r.frequency, 'Invalid time sampling.'));
      vector(r.finalTemperature, nodes, 'final temperature');
      r.finalTemperature.forEach(v => TE.checkRange(v, 'temperature'));
      if (r.cycleStartTime !== undefined) { finite(r.cycleStartTime, 'cycle start time'); assert(r.cycleStartTime >= 0, 'Invalid cycle start time.'); }
      for (const [key, width] of Object.entries(widths)) {
        assert(Array.isArray(r[key]) && r[key].length === r.samples, 'Incorrect sample count for ' + key + '.');
        r[key].forEach(row => vector(row, width, key));
      }
      vector(r.current, r.samples, 'current'); vector(r.terminalVoltage, r.samples, 'terminal voltage');
      assert(object(r.harmonics), 'Missing harmonics.');
      const complex = z => { assert(object(z), 'Invalid complex value.'); finite(z.re, 'real component'); finite(z.im, 'imaginary component'); };
      for (const [key, width] of Object.entries({...widths, current: 0, terminalVoltage: 0})) {
        const hs = r.harmonics[key];
        assert(Array.isArray(hs) && hs.length === 4, 'Expected DC through 3ω for ' + key + '.');
        hs.forEach(row => {
          if (width) { assert(Array.isArray(row) && row.length === width, 'Incorrect harmonic dimensions.'); row.forEach(complex); }
          else complex(row);
        });
      }
      assert(Object.keys(r.harmonics).every(k => Object.hasOwn({...widths, current: 0, terminalVoltage: 0}, k)), 'Unknown harmonic field.');
    } else {
      for (const [key, width] of Object.entries(widths)) vector(r[key], width, key);
      finite(r.current, 'current'); finite(r.terminalVoltage, 'terminal voltage');
      finite(r.energyResidual, 'energy residual'); finite(r.electricalPower, 'electrical power');
    }
    if (r.diagnostics !== undefined) {
      assert(object(r.diagnostics), 'Invalid diagnostics.');
      for (const key of ['heatResidualNormalized', 'heatResidualWatts']) { finite(r.diagnostics[key], key); assert(r.diagnostics[key] >= 0, 'Negative residual.'); }
      if (periodic) for (const key of ['temperatureCycleError', 'terminalHarmonicError']) {
        assert(r.diagnostics[key] === null || Number.isFinite(r.diagnostics[key]) && r.diagnostics[key] >= 0, 'Invalid cycle diagnostic.');
      }
    }
    TE.checkResult(r);
    return r;
  };
  TE.readProjectZip = async blob => {
    assert(blob && blob.size >= 22 && blob.size <= limit, 'Project ZIP must be between 22 bytes and 2 GiB.');
    const tail = new Uint8Array(await blob.slice(Math.max(0, blob.size - 65557)).arrayBuffer());
    const tv = new DataView(tail.buffer);
    let end = -1;
    for (let i = tail.length - 22; i >= 0; i--) if (tv.getUint32(i, true) === 0x06054b50 && i + 22 + tv.getUint16(i + 20, true) === tail.length) {end = i; break;}
    assert(end >= 0, 'ZIP end directory is missing or truncated.');
    const count = tv.getUint16(end + 10, true), size = tv.getUint32(end + 12, true), offset = tv.getUint32(end + 16, true);
    assert(tv.getUint16(end + 4, true) === 0 && tv.getUint16(end + 6, true) === 0 && tv.getUint16(end + 8, true) === count, 'Multi-disk ZIP is unsupported.');
    assert(count > 0 && count < 65535 && size <= 16 * 1024 * 1024 && offset + size === blob.size - tail.length + end, 'Invalid or unsupported ZIP directory.');
    const directory = new Uint8Array(await blob.slice(offset, offset + size).arrayBuffer()), dv = new DataView(directory.buffer);
    const entries = new Map(); let p = 0;
    for (let i = 0; i < count; i++) {
      assert(p + 46 <= size && dv.getUint32(p, true) === 0x02014b50, 'Invalid ZIP entry.');
      const flags = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true), crc = dv.getUint32(p + 16, true),
        compressed = dv.getUint32(p + 20, true), length = dv.getUint32(p + 24, true),
        nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), local = dv.getUint32(p + 42, true);
      assert(p + 46 + nl + xl + cl <= size && dv.getUint16(p + 34, true) === 0, 'Invalid ZIP entry dimensions.');
      const name = text.decode(directory.subarray(p + 46, p + 46 + nl));
      assert(name && !name.startsWith('/') && !/[\\:\x00-\x1f]/.test(name) && !name.split('/').some(s => s === '..' || s === '.'), 'Unsafe archive filename.');
      assert(!entries.has(name), 'Duplicate archive filename: ' + name);
      assert(!(flags & 1) && [0, 8].includes(method) && length !== 0xffffffff && local + 30 <= offset && compressed <= offset - local - 30, 'Encrypted, ZIP64 or unsupported archive entry.');
      entries.set(name, {name, flags, method, crc, compressed, length, local});
      p += 46 + nl + xl + cl;
    }
    assert(p === size, 'ZIP directory size mismatch.');
    let jsonBytes = 0;
    const read = async name => {
      const e = entries.get(name); assert(e, 'Missing archive data: ' + name);
      jsonBytes += e.length;
      assert(e.length > 0 && jsonBytes <= jsonLimit, 'Project JSON exceeds the 256 MiB import limit.');
      const header = new Uint8Array(await blob.slice(e.local, e.local + 30).arrayBuffer()), h = new DataView(header.buffer);
      assert(h.getUint32(0, true) === 0x04034b50 && h.getUint16(6, true) === e.flags && h.getUint16(8, true) === e.method, 'ZIP local header mismatch.');
      const nl = h.getUint16(26, true), xl = h.getUint16(28, true), start = e.local + 30 + nl + xl;
      assert(start + e.compressed <= offset, 'ZIP data extends beyond the archive body.');
      assert(text.decode(new Uint8Array(await blob.slice(e.local + 30, e.local + 30 + nl).arrayBuffer())) === name, 'ZIP filename mismatch.');
      if (!(e.flags & 8)) assert(h.getUint32(14, true) === e.crc && h.getUint32(18, true) === e.compressed && h.getUint32(22, true) === e.length, 'ZIP local size or checksum mismatch.');
      let payload = blob.slice(start, start + e.compressed), bytes;
      if (e.method === 0) { assert(e.length === e.compressed, 'Stored ZIP size mismatch.'); bytes = new Uint8Array(await payload.arrayBuffer()); }
      else {
        assert(typeof DecompressionStream === 'function', 'This browser cannot read compressed ZIPs. Use the original ZIP exported by this app.');
        let stream;
        try { stream = payload.stream().pipeThrough(new DecompressionStream('deflate-raw')); }
        catch { throw new Error('This browser cannot read compressed ZIPs. Use the original ZIP exported by this app.'); }
        const reader = stream.getReader(), chunks = []; let total = 0;
        try { while (true) { const {done, value} = await reader.read(); if (done) break; total += value.length; assert(total <= e.length, 'Decompressed ZIP data exceeds its declared size.'); chunks.push(value); } }
        catch (error) { await reader.cancel().catch(() => {}); throw error; }
        assert(total === e.length, 'Decompressed ZIP size mismatch.');
        bytes = new Uint8Array(total); let at = 0; for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
      }
      let crc = 0xffffffff; for (let i = 0, n = bytes.length; i < n; i++) crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
      assert(((crc ^ 0xffffffff) >>> 0) === e.crc, 'Corrupt archive data: ' + name);
      try {
        return JSON.parse(text.decode(bytes), (key, value) => { assert(!['__proto__', 'constructor', 'prototype'].includes(key), 'Unsafe JSON property.'); return value; });
      } catch (error) { throw new Error('Invalid project JSON in ' + name + ': ' + error.message); }
    };
    assert(entries.has('project.json'), 'This ZIP is not a supported project: project.json is missing. Save projects with Save project / complete results ZIP.');
    const metadata = await read('project.json');
    assert(object(metadata) && metadata.format === 'thermoelectric-lab-project' && metadata.version === TE.projectVersion && ['single', 'sweep'].includes(metadata.kind), 'Unsupported project format/version.');
    const isSweep = metadata.kind === 'sweep';
    assert(isSweep === entries.has('sweep-model.json'), 'Project kind disagrees with archive data.');
    let result, sweep = null, selected = metadata.selectedIndex;
    assert(Number.isInteger(selected) && selected >= 0 && (isSweep || selected === 0), 'Invalid selected result.');
    if (isSweep) {
      const config = TE.checkEditorModel(await read('sweep-model.json')), status = await read('sweep-status.json');
      assert(config.sweep?.enabled && object(status), 'Invalid sweep model/status.');
      const frequencies = TE.validateSweep(config);
      assert(same(status.requestedFrequencies, frequencies) && Array.isArray(status.retainedFrequencies) && status.retainedFrequencies.length > 0 && status.retainedFrequencies.length <= frequencies.length, 'Invalid sweep frequency list.');
      assert(['running', 'stopped', 'complete'].includes(status.status), 'Invalid sweep status.');
      assert(status.message === undefined || typeof status.message === 'string' && status.message.length <= 10000, 'Invalid sweep message.');
      assert(TE.estimateRetainedBytes(config, status.retainedFrequencies.length) <= TE.retainedMemoryLimit, 'Sweep exceeds retained-data memory limit.');
      const results = [];
      for (let i = 0; i < status.retainedFrequencies.length; i++) {
        assert(status.retainedFrequencies[i] === frequencies[i], 'Retained sweep frequencies must be a prefix of the requested sweep.');
        const prefix = 'frequency-' + String(i + 1).padStart(3, '0') + '/';
        const r = TE.checkProjectResult(await read(prefix + 'results.json'));
        assert(r.method !== 'steady' && r.frequency === frequencies[i] && same(r.config, {...config, mode: 'periodic', frequency: frequencies[i], sweep: {...config.sweep, enabled: false}}), 'Sweep point does not match the saved sweep model.');
        results.push(r);
      }
      // A completed sweep may contain points that exhausted their cycle budget (kept as unconverged).
    assert(status.status !== 'complete' || results.length === frequencies.length, 'Incomplete data marked as a completed sweep.');
      assert(Number.isInteger(selected) && selected >= 0 && selected < results.length, 'Invalid selected sweep point.');
      result = results[selected];
      sweep = {config, frequencies, results, status: status.status === 'running' ? 'stopped' : status.status, message: status.message ?? 'Imported sweep snapshot.'};
    } else {
      const config = TE.checkEditorModel(await read('model.json'));
      result = TE.checkProjectResult(await read('results.json'));
      assert(same(config, result.config), 'Saved model does not match computed result.');
    }
    if (isSweep) TE.validateProjectBode(metadata.bodeOptions);
    const view = metadata.view;
    TE.validateProjectView(view, result);
    return {config: sweep ? sweep.config : result.config, result, sweep, selected, view, bodeOptions: metadata.bodeOptions};
  };
  TE.validateProjectView = (view, r) => {
    assert(object(view), 'Invalid saved view.');
    const choices = {field: ['temperature', 'voltage', 'J', 'Jx', 'Jy', 'qx', 'qy'], profileField: ['temperature', 'voltage', 'J', 'Jx', 'Jy', 'qx', 'qy'], representation: ['amplitude', 'phase', 'real', 'imaginary']};
    for (const [key, values] of Object.entries(choices)) if (view[key] !== undefined) assert(values.includes(view[key]), 'Invalid saved ' + key + '.');
    if (view.harmonic !== undefined) assert(Number.isInteger(view.harmonic) && view.harmonic >= 0 && view.harmonic <= 3, 'Invalid saved harmonic.');
    if (view.probe !== undefined) assert(Number.isInteger(view.probe) && view.probe >= 0 && view.probe < r.mesh.x.length, 'Invalid saved probe.');
    if (view.timeFraction !== undefined) assert(Number.isFinite(view.timeFraction) && view.timeFraction >= 0 && view.timeFraction < 1, 'Invalid saved time selection.');
    if (view.arrows !== undefined) assert(typeof view.arrows === 'boolean', 'Invalid saved arrows selection.');
    for (const key of ['x', 'y']) if (view[key] !== undefined) assert(Number.isFinite(view[key]) && view[key] >= 0 && view[key] <= 1, 'Invalid saved probe coordinate.');
  };
  TE.validateProjectBode = o => {
    assert(object(o), 'Invalid Bode options.');
    const choices = {quantity: ['terminalVoltage', 'current', 'impedance', 'temperature', 'voltage', 'Jx', 'Jy', 'qx', 'qy'], reference: ['drive', 'current', 'terminalVoltage', 'left', 'right', 'top', 'bottom', 'time'], normalization: ['raw', 'fundamental', 'power'], scale: ['physical', 'db']};
    for (const [key, values] of Object.entries(choices)) assert(values.includes(o[key]), 'Invalid Bode ' + key + '.');
    assert([1, 2, 3].includes(o.harmonic) && typeof o.unwrap === 'boolean', 'Invalid Bode harmonic/phase mode.');
    for (const key of ['x', 'y']) assert(Number.isFinite(o[key]) && o[key] >= 0 && o[key] <= 1, 'Invalid Bode probe.');
    assert(Number.isFinite(o.phaseFloor) && o.phaseFloor >= 0 && Number.isFinite(o.dbReference) && o.dbReference > 0, 'Invalid Bode threshold/reference.');
    assert(o.representation === undefined || ['polar', 'complex'].includes(o.representation), 'Invalid Bode representation.');
  };
})(globalThis.TE);
