/* SI units. No dependencies; shared by browser, worker and Node tests. */
(function (TE) {
  'use strict';
  TE.assert = (ok, message) => { if (!ok) throw new Error(message); };
  TE.finite = (x, name) => { TE.assert(Number.isFinite(x), `${name} must be finite.`); return x; };
  TE.law = (p, T) => {
    if (typeof p === 'function') return p(T);
    if (typeof p === 'number') return p;
    TE.assert(p && ['linear', 'inverseLinear'].includes(p.type), 'Unknown material law.');
    const v = p.value, slope = p.slope ?? 0, ref = p.reference ?? 300;
    return p.type === 'linear' ? v + slope * (T - ref) : v / (1 + slope * (T - ref));
  };
  class ThermoelectricMaterial {
    constructor({rho, Cp, k, sigma, alpha, name = 'Material', dalpha_dT = null}) {
      Object.assign(this, {rho, Cp, k, sigma, alpha, name, derivative: dalpha_dT});
    }
    evaluate(key, T) {
      TE.assert(Number.isFinite(T) && T > 0, 'Temperature must be finite and > 0 K.');
      const v = TE.finite(TE.law(this[key], T), `${this.name}: ${key}`);
      TE.assert(key === 'alpha' || v > 0, `${this.name}: ${key} must be positive.`);
      return v;
    }
    density(T) { return this.evaluate('rho', T); }
    heatCapacity(T) { return this.evaluate('Cp', T); }
    thermalConductivity(T) { return this.evaluate('k', T); }
    electricalConductivity(T) { return this.evaluate('sigma', T); }
    seebeck(T) { return this.evaluate('alpha', T); }
    electricalResistivity(T) { return 1 / this.electricalConductivity(T); }
    peltier(T) { return T * this.seebeck(T); }
    dalphaDT(T) {
      if (this.derivative !== null) return TE.law(this.derivative, T);
      if (typeof this.alpha === 'number') return 0;
      const h = Math.min(T / 2, Math.max(1, T) * 6e-6);
      return (this.seebeck(T + h) - this.seebeck(T - h)) / (2 * h);
    }
    thomson(T) { return T * this.dalphaDT(T); }
    ZT(T) { return this.seebeck(T) ** 2 * this.electricalConductivity(T) * T / this.thermalConductivity(T); }
  }
  class MaterialCollection {
    constructor(material) { this.materials = [material]; }
    get material() { return this.materials[0]; }
    addMaterial(m) { this.materials.push(m); }
  }
  Object.assign(TE, {ThermoelectricMaterial, MaterialCollection});
})(globalThis.TE = globalThis.TE || {});
