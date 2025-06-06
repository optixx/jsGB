import { LOG } from './log.js';

export const KEY = {
  _keys: [0x0F, 0x0F],
  _colidx: 0,

  reset() {
    this._keys = [0x0F, 0x0F];
    this._colidx = 0;
    LOG.out('KEY', 'Reset.');
  },

  rb() {
    switch(this._colidx) {
      case 0x00: return 0x00;
      case 0x10: return this._keys[0];
      case 0x20: return this._keys[1];
      default: return 0x00;
    }
  },

  wb(v) {
    this._colidx = v & 0x30;
  },

  keydown(e) {
    switch(e.keyCode) {
      case 39: this._keys[1] &= 0xE; break;
      case 37: this._keys[1] &= 0xD; break;
      case 38: this._keys[1] &= 0xB; break;
      case 40: this._keys[1] &= 0x7; break;
      case 90: this._keys[0] &= 0xE; break;
      case 88: this._keys[0] &= 0xD; break;
      case 32: this._keys[0] &= 0xB; break;
      case 13: this._keys[0] &= 0x7; break;
    }
  },

  keyup(e) {
    switch(e.keyCode) {
      case 39: this._keys[1] |= 0x1; break;
      case 37: this._keys[1] |= 0x2; break;
      case 38: this._keys[1] |= 0x4; break;
      case 40: this._keys[1] |= 0x8; break;
      case 90: this._keys[0] |= 0x1; break;
      case 88: this._keys[0] |= 0x2; break;
      case 32: this._keys[0] |= 0x5; break;
      case 13: this._keys[0] |= 0x8; break;
    }
  }
};
