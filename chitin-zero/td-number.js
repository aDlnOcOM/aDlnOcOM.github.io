(function (root) {
  'use strict';
  // Logarithmic positive numbers: gameplay never turns huge balances into Infinity.
  // Zero is -Infinity internally and null in JSON. About 15 significant digits.
  class Amount {
    constructor(log = -Infinity) { this.log = Number.isFinite(log) ? log : -Infinity; }
    static from(value) { return value instanceof Amount ? value : new Amount(Number.isFinite(value) && value > 0 ? Math.log10(value) : -Infinity); }
    static power(base, exponent) { return new Amount(Math.log10(base) * exponent); }
    static load(value) { return new Amount(typeof value === 'number' && Number.isFinite(value) ? value : -Infinity); }
    add(value) {
      const b = Amount.from(value), hi = Math.max(this.log, b.log), lo = Math.min(this.log, b.log);
      return new Amount(hi === -Infinity || hi - lo > 16 ? hi : hi + Math.log10(1 + 10 ** (lo - hi)));
    }
    sub(value) {
      const b = Amount.from(value);
      if (this.log <= b.log) return new Amount();
      return new Amount(this.log - b.log > 16 ? this.log : this.log + Math.log10(1 - 10 ** (b.log - this.log)));
    }
    mul(value) { const b = Amount.from(value); return new Amount(this.log + b.log); }
    div(value) { const b = Amount.from(value); return b.log === -Infinity ? new Amount() : new Amount(this.log - b.log); }
    gte(value) { return this.log + 1e-12 >= Amount.from(value).log; }
    ratio(value) { const b = Amount.from(value); return this.log === -Infinity || b.log === -Infinity ? 0 : Math.min(1, 10 ** Math.min(0, this.log - b.log)); }
    number() { return this.log === -Infinity ? 0 : 10 ** Math.min(308, this.log); }
    format() {
      if (this.log === -Infinity || this.log < -3) return '0';
      if (this.log < 3) return this.number().toLocaleString('ru-RU', { maximumFractionDigits: this.log < 1 ? 1 : 0 });
      const group = Math.floor(this.log / 3), suffix = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
      if (group < suffix.length) return `${(10 ** (this.log - group * 3)).toFixed(1)}${suffix[group]}`;
      const exponent = Math.floor(this.log); return `${(10 ** (this.log - exponent)).toFixed(2)}e${exponent}`;
    }
    toJSON() { return Number.isFinite(this.log) ? this.log : null; }
  }
  root.TDNumber = Amount; if (typeof module !== 'undefined' && module.exports) module.exports = Amount;
})(typeof globalThis !== 'undefined' ? globalThis : this);
