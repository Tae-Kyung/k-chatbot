/**
 * Minimal DOMMatrix/DOMPoint polyfill for pdfjs-dist text extraction
 * in serverless environments (Vercel) where @napi-rs/canvas is unavailable.
 */

class DOMPointPolyfill {
  x: number;
  y: number;
  z: number;
  w: number;
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }
  static fromPoint(p: { x?: number; y?: number; z?: number; w?: number }) {
    return new DOMPointPolyfill(p.x, p.y, p.z, p.w);
  }
}

class DOMMatrixPolyfill {
  m11: number; m12: number; m13: number; m14: number;
  m21: number; m22: number; m23: number; m24: number;
  m31: number; m32: number; m33: number; m34: number;
  m41: number; m42: number; m43: number; m44: number;
  is2D: boolean;

  constructor(init?: string | number[] | Float32Array | Float64Array) {
    // Identity matrix
    this.m11 = 1; this.m12 = 0; this.m13 = 0; this.m14 = 0;
    this.m21 = 0; this.m22 = 1; this.m23 = 0; this.m24 = 0;
    this.m31 = 0; this.m32 = 0; this.m33 = 1; this.m34 = 0;
    this.m41 = 0; this.m42 = 0; this.m43 = 0; this.m44 = 1;
    this.is2D = true;

    if (typeof init === 'string') {
      return; // CSS transform string - not needed for text extraction
    }

    if (init && (Array.isArray(init) || ArrayBuffer.isView(init))) {
      const v = Array.from(init as ArrayLike<number>);
      if (v.length === 6) {
        this.m11 = v[0]; this.m12 = v[1];
        this.m21 = v[2]; this.m22 = v[3];
        this.m41 = v[4]; this.m42 = v[5];
        this.is2D = true;
      } else if (v.length === 16) {
        this.m11 = v[0];  this.m12 = v[1];  this.m13 = v[2];  this.m14 = v[3];
        this.m21 = v[4];  this.m22 = v[5];  this.m23 = v[6];  this.m24 = v[7];
        this.m31 = v[8];  this.m32 = v[9];  this.m33 = v[10]; this.m34 = v[11];
        this.m41 = v[12]; this.m42 = v[13]; this.m43 = v[14]; this.m44 = v[15];
        this.is2D = false;
      }
    }
  }

  // 2D aliases
  get a() { return this.m11; } set a(v) { this.m11 = v; }
  get b() { return this.m12; } set b(v) { this.m12 = v; }
  get c() { return this.m21; } set c(v) { this.m21 = v; }
  get d() { return this.m22; } set d(v) { this.m22 = v; }
  get e() { return this.m41; } set e(v) { this.m41 = v; }
  get f() { return this.m42; } set f(v) { this.m42 = v; }

  get isIdentity() {
    return this.m11 === 1 && this.m12 === 0 && this.m13 === 0 && this.m14 === 0 &&
           this.m21 === 0 && this.m22 === 1 && this.m23 === 0 && this.m24 === 0 &&
           this.m31 === 0 && this.m32 === 0 && this.m33 === 1 && this.m34 === 0 &&
           this.m41 === 0 && this.m42 === 0 && this.m43 === 0 && this.m44 === 1;
  }

  multiply(other: DOMMatrixPolyfill) {
    const r = new DOMMatrixPolyfill();
    r.m11 = this.m11 * other.m11 + this.m12 * other.m21 + this.m13 * other.m31 + this.m14 * other.m41;
    r.m12 = this.m11 * other.m12 + this.m12 * other.m22 + this.m13 * other.m32 + this.m14 * other.m42;
    r.m13 = this.m11 * other.m13 + this.m12 * other.m23 + this.m13 * other.m33 + this.m14 * other.m43;
    r.m14 = this.m11 * other.m14 + this.m12 * other.m24 + this.m13 * other.m34 + this.m14 * other.m44;
    r.m21 = this.m21 * other.m11 + this.m22 * other.m21 + this.m23 * other.m31 + this.m24 * other.m41;
    r.m22 = this.m21 * other.m12 + this.m22 * other.m22 + this.m23 * other.m32 + this.m24 * other.m42;
    r.m23 = this.m21 * other.m13 + this.m22 * other.m23 + this.m23 * other.m33 + this.m24 * other.m43;
    r.m24 = this.m21 * other.m14 + this.m22 * other.m24 + this.m23 * other.m34 + this.m24 * other.m44;
    r.m31 = this.m31 * other.m11 + this.m32 * other.m21 + this.m33 * other.m31 + this.m34 * other.m41;
    r.m32 = this.m31 * other.m12 + this.m32 * other.m22 + this.m33 * other.m32 + this.m34 * other.m42;
    r.m33 = this.m31 * other.m13 + this.m32 * other.m23 + this.m33 * other.m33 + this.m34 * other.m43;
    r.m34 = this.m31 * other.m14 + this.m32 * other.m24 + this.m33 * other.m34 + this.m34 * other.m44;
    r.m41 = this.m41 * other.m11 + this.m42 * other.m21 + this.m43 * other.m31 + this.m44 * other.m41;
    r.m42 = this.m41 * other.m12 + this.m42 * other.m22 + this.m43 * other.m32 + this.m44 * other.m42;
    r.m43 = this.m41 * other.m13 + this.m42 * other.m23 + this.m43 * other.m33 + this.m44 * other.m43;
    r.m44 = this.m41 * other.m14 + this.m42 * other.m24 + this.m43 * other.m34 + this.m44 * other.m44;
    r.is2D = this.is2D && other.is2D;
    return r;
  }

  multiplySelf(other: DOMMatrixPolyfill) {
    const r = this.multiply(other);
    this.m11 = r.m11; this.m12 = r.m12; this.m13 = r.m13; this.m14 = r.m14;
    this.m21 = r.m21; this.m22 = r.m22; this.m23 = r.m23; this.m24 = r.m24;
    this.m31 = r.m31; this.m32 = r.m32; this.m33 = r.m33; this.m34 = r.m34;
    this.m41 = r.m41; this.m42 = r.m42; this.m43 = r.m43; this.m44 = r.m44;
    this.is2D = r.is2D;
    return this;
  }

  translate(tx = 0, ty = 0, tz = 0) {
    const t = new DOMMatrixPolyfill();
    t.m41 = tx; t.m42 = ty; t.m43 = tz;
    if (tz !== 0) t.is2D = false;
    return this.multiply(t);
  }

  scale(sx = 1, sy?: number, sz = 1, ox = 0, oy = 0, oz = 0) {
    if (sy === undefined) sy = sx;
    const s = new DOMMatrixPolyfill();
    s.m11 = sx; s.m22 = sy; s.m33 = sz;
    if (sz !== 1 || oz !== 0) s.is2D = false;
    if (ox || oy || oz) {
      return this.translate(ox, oy, oz).multiply(s).translate(-ox, -oy, -oz);
    }
    return this.multiply(s);
  }

  inverse() {
    const m = this;
    const det = m.m11 * m.m22 - m.m12 * m.m21;
    if (Math.abs(det) < 1e-10) {
      // Return NaN matrix for singular matrix
      const nan = new DOMMatrixPolyfill();
      nan.m11 = NaN; nan.m12 = NaN; nan.m21 = NaN; nan.m22 = NaN;
      nan.m41 = NaN; nan.m42 = NaN;
      return nan;
    }
    const inv = new DOMMatrixPolyfill();
    inv.m11 = m.m22 / det;
    inv.m12 = -m.m12 / det;
    inv.m21 = -m.m21 / det;
    inv.m22 = m.m11 / det;
    inv.m41 = (m.m21 * m.m42 - m.m22 * m.m41) / det;
    inv.m42 = (m.m12 * m.m41 - m.m11 * m.m42) / det;
    return inv;
  }

  transformPoint(point?: { x?: number; y?: number; z?: number; w?: number }) {
    const x = point?.x ?? 0, y = point?.y ?? 0, z = point?.z ?? 0, w = point?.w ?? 1;
    return new DOMPointPolyfill(
      this.m11 * x + this.m21 * y + this.m31 * z + this.m41 * w,
      this.m12 * x + this.m22 * y + this.m32 * z + this.m42 * w,
      this.m13 * x + this.m23 * y + this.m33 * z + this.m43 * w,
      this.m14 * x + this.m24 * y + this.m34 * z + this.m44 * w,
    );
  }

  toFloat64Array() {
    return new Float64Array([
      this.m11, this.m12, this.m13, this.m14,
      this.m21, this.m22, this.m23, this.m24,
      this.m31, this.m32, this.m33, this.m34,
      this.m41, this.m42, this.m43, this.m44,
    ]);
  }

  static fromMatrix(other: DOMMatrixPolyfill) {
    const m = new DOMMatrixPolyfill();
    m.m11 = other.m11; m.m12 = other.m12; m.m13 = other.m13; m.m14 = other.m14;
    m.m21 = other.m21; m.m22 = other.m22; m.m23 = other.m23; m.m24 = other.m24;
    m.m31 = other.m31; m.m32 = other.m32; m.m33 = other.m33; m.m34 = other.m34;
    m.m41 = other.m41; m.m42 = other.m42; m.m43 = other.m43; m.m44 = other.m44;
    m.is2D = other.is2D;
    return m;
  }

  static fromFloat64Array(arr: Float64Array) {
    return new DOMMatrixPolyfill(Array.from(arr));
  }

  static fromFloat32Array(arr: Float32Array) {
    return new DOMMatrixPolyfill(Array.from(arr));
  }
}

class DOMRectPolyfill {
  x: number; y: number; width: number; height: number;
  constructor(x = 0, y = 0, width = 0, height = 0) {
    this.x = x; this.y = y; this.width = width; this.height = height;
  }
  get top() { return this.y; }
  get left() { return this.x; }
  get bottom() { return this.y + this.height; }
  get right() { return this.x + this.width; }
  static fromRect(r: { x?: number; y?: number; width?: number; height?: number }) {
    return new DOMRectPolyfill(r.x, r.y, r.width, r.height);
  }
}

export function applyDOMPolyfills() {
  if (typeof globalThis.DOMMatrix === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).DOMMatrix = DOMMatrixPolyfill;
  }
  if (typeof globalThis.DOMPoint === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).DOMPoint = DOMPointPolyfill;
  }
  if (typeof globalThis.DOMRect === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).DOMRect = DOMRectPolyfill;
  }
}
