import { LOG } from './log.js';
import { GPUInstance } from './gpu.js';
import { MMUInstance } from './mmu.js';
import { KEY } from './key.js';
import { TIMER } from './timer.js';
import { Z80 } from './z80.js';
import { tabMagic } from './tabs.js';

/**
 * BinFileReader.js
 * You can find more about this function at
 * http://nagoon97.com/reading-binary-files-using-ajax/
 *
 * Copyright (c) 2008 Andy G.P. Na <nagoon97@naver.com>
 * The source code is freely distributable under the terms of an MIT-style license.
 */
class BinFileReader {
  constructor() {
      this.filePointer = 0;
      this.fileSize = -1;
      this.fileContents = new Uint8Array();
  }

  async loadFile(file) {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
              this.fileContents = new Uint8Array(e.target.result);
              this.fileSize = this.fileContents.length;
              resolve(this);
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
      });
  }

  // Maintain compatibility with old API
  readString(size, offset) {
      let result = '';
      for(let i = 0; i < size; i++) {
          result += String.fromCharCode(this.fileContents[i]);
      }
      return result;
  }

  getFileSize() {
      return this.fileSize;
  }

  getFilePointer() {
      return this.filePointer;
  }

  movePointerTo(to) {
      if (to < 0) {
          this.filePointer = 0;
      } else if (to > this.fileSize) {
          throw new Error("Error: EOF reached");
      } else {
          this.filePointer = to;
      }
      return this.filePointer;
  }

  movePointer(offset) {
      return this.movePointerTo(this.filePointer + offset);
  }

  readByteAt(pos) {
      if (pos < 0 || pos >= this.fileSize) {
          throw new Error("Error: Attempt to read outside file bounds");
      }
      return this.fileContents[pos];
  }

  readNumber(numBytes = 1, from = this.filePointer) {
      if (from + numBytes > this.fileSize) {
          throw new Error("Error: Attempt to read past EOF");
      }
      
      let result = 0;
      for (let i = 0; i < numBytes; i++) {
          result |= this.readByteAt(from + i) << (i * 8);
      }
      this.movePointerTo(from + numBytes);
      return result;
  }
}


const jsGB = {
  run_interval: 0,
  trace: '',

  frame() {
    const fclock = Z80._clock.m + 17556;
    const brk = document.getElementById('breakpoint').value;
    const t0 = new Date();
    do {
      if(Z80._halt) Z80._r.m=1;
      else {
        Z80._map[MMUInstance.rb(Z80._r.pc++)]();
        Z80._r.pc &= 65535;
      }
      if(Z80._r.ime && MMUInstance._ie && MMUInstance._if) {
        Z80._halt=0; Z80._r.ime=0;
        const ifired = MMUInstance._ie & MMUInstance._if;
        if(ifired & 1) { MMUInstance._if &= 0xFE; Z80._ops.RST40(); }
        else if(ifired & 2) { MMUInstance._if &= 0xFD; Z80._ops.RST48(); }
        else if(ifired & 4) { MMUInstance._if &= 0xFB; Z80._ops.RST50(); }
        else if(ifired & 8) { MMUInstance._if &= 0xF7; Z80._ops.RST58(); }
        else if(ifired & 16) { MMUInstance._if &= 0xEF; Z80._ops.RST60(); }
        else { Z80._r.ime = 1; }
      }
      Z80._clock.m += Z80._r.m;
      GPUInstance.checkline();
      TIMER.inc();
      if((brk && parseInt(brk,16)==Z80._r.pc) || Z80._stop) {
        jsGB.pause();
        break;
      }
    } while(Z80._clock.m < fclock);

    const t1 = new Date();
    document.getElementById('fps').innerHTML = Math.round(10000 / (t1 - t0)) / 10;
  },
  
  reset() {
    LOG.reset(); GPUInstance.reset(); MMUInstance.reset(); Z80.reset(); KEY.reset(); TIMER.reset();
    Z80._r.pc = 0x100; MMUInstance._inbios = 0; Z80._r.sp = 0xFFFE; Z80._r.hl = 0x014D; Z80._r.c = 0x13; Z80._r.e = 0xD8; Z80._r.a = 1;
    
    jsGB.dbgupdate();
    jsGB.dbgtile();
    jsGB.trace = '';
    tabMagic.init();
    jsGB.pause();
    
    LOG.out('MAIN', 'Reset.');
  },

  run() {
    Z80._stop = 0;
    jsGB.run_interval = setInterval(jsGB.frame, 1);
    document.getElementById('op_run').innerHTML = 'Pause';
    document.getElementById('op_run').onclick = jsGB.pause;
  },
  
  pause() {
    clearInterval(jsGB.run_interval);
    Z80._stop = 1;
    jsGB.dbgupdate();
    
    document.getElementById('op_run').innerHTML = 'Run';
    document.getElementById('op_run').onclick = jsGB.run;
  },

  dbgupdate() {
    const t = document.getElementById('reg').getElementsByTagName('td');
    let x, j, k;
    for(let i = 0; i < t.length; i++) {
      if(t[i].className=='reg') {
        switch(t[i].getAttribute('rel')) {
          case 'a': case 'b': case 'c': case 'd': case 'e':
            x = Z80._r[t[i].getAttribute('rel')].toString(16);
            if(x.length === 1) x = `0${x}`;
            break;
          case 'pc': case 'sp':
            x = Z80._r[t[i].getAttribute('rel')].toString(16);
            if(x.length < 4) x = x.padStart(4, '0');
            break;
          case 'hl':
            k = (Z80._r.h << 8) + Z80._r.l;
            x = k.toString(16).padStart(4, '0');
            break;
          case 'f':
            x = (Z80._r.f >> 4).toString(2).padStart(4, '0');
            break;
        }
        t[i].innerHTML = x;
      } else if(t[i].className=='io') {
        j = parseInt(t[i].getAttribute('rel'),16);
        x = MMUInstance.rb(0xFF00+j).toString(16);
        if(typeof(x) != 'undefined') {
          if(x.length==1) x='0'+x;
          t[i].innerHTML = x;
        }
      }
    }
  },
  
  dbgtrace() {
    const pad2 = n => n.toString(16).padStart(2, '0');
    const pad4 = n => n.toString(16).padStart(4, '0');
    
    const a = pad2(Z80._r.a);
    const b = pad2(Z80._r.b);
    const c = pad2(Z80._r.c);
    const d = pad2(Z80._r.d);
    const e = pad2(Z80._r.e);
    const f = pad2(Z80._r.f);
    const h = pad2(Z80._r.h);
    const l = pad2(Z80._r.l);
    const pc = pad4(Z80._r.pc);
    const sp = pad4(Z80._r.sp);
    
    jsGB.trace += `A${a}/B${b}/C${c}/D${d}/E${e}/F${f}/H${h}/L${l}/PC${pc}/SP${sp}\n`;
  },

  dbgtile() {
    const tn = parseInt(document.getElementById('tilenum').value);
    const t = GPUInstance._tilemap[tn];
    const c = ['#ffffff', '#c0c0c0', '#606060', '#000000'];
    const container = document.getElementById('tilepixels');
    
    if (!container || !t) return;
    
    const d = container.getElementsByTagName('div');
    if (d.length < 64) return; // Ensure we have all 8x8 pixels

    for(let y = 0; y < 8; y++) {
      for(let x = 0; x < 8; x++) {
        if (d[y*8+x]) {
          d[y*8+x].style.backgroundColor = c[t[y][x]];
        }
      }
    }
  },

  step() {
    if(Z80._r.ime && MMUInstance._ie && MMUInstance._if) {
      Z80._halt = 0; 
      Z80._r.ime = 0;
      if((MMUInstance._ie & 1) && (MMUInstance._if & 1)) {
        MMUInstance._if &= 0xFE; 
        Z80._ops.RST40();
      }
    } else {
      if(Z80._halt) { 
        Z80._r.m = 1; 
      } else {
        Z80._r.r = (Z80._r.r + 1) & 127;
        Z80._map[MMUInstance.rb(Z80._r.pc++)]();
        Z80._r.pc &= 65535;
      }
    }
    Z80._clock.m += Z80._r.m; 
    Z80._clock.t += (Z80._r.m * 4);
      GPUInstance.checkline();
    if(Z80._stop) {
      jsGB.pause();
    }
    jsGB.dbgupdate();
  },

  init() {
    jsGB.reset();
    
    // File input handler
    document.getElementById('file').onchange = handleFileInput;

    // Button handlers
    document.getElementById('op_reset').onclick = jsGB.reset;
    document.getElementById('op_run').onclick = jsGB.run;
    document.getElementById('op_step').onclick = jsGB.step;

    // Tile controls
    document.getElementById('tilenum').onupdate = jsGB.dbgtile;
    document.getElementById('tileprev').onclick = handleTilePrev;
    document.getElementById('tilenext').onclick = handleTileNext;

    // Display scale handler
    document.getElementById('display-scale').onchange = handleDisplayScale;

    // Initialize tile pixels
    initializeTilePixels();
  }
};

// DOM event handlers
function initializeTilePixels() {
    document.getElementById('tilepixels').innerHTML = '';
    let tp = document.createElement('div');
    for(let i = 0; i < 64; i++) {
        document.getElementById('tilepixels').appendChild(tp);
        tp = tp.cloneNode(false);
    }
}

function handleDisplayScale() {
    const scale = parseInt(this.value);
    const container = document.getElementById('out');
    container.style.transform = `scale(${scale})`;
    container.style.marginBottom = `${(scale - 1) * 144}px`;
}

function handleTilePrev() {
    let t = parseInt(document.getElementById('tilenum').value); 
    t--; 
    if(t < 0) t = 383;
    document.getElementById('tilenum').value = t.toString();
    jsGB.dbgtile();
}

function handleTileNext() {
    let t = parseInt(document.getElementById('tilenum').value);
    t++;
    if(t > 383) t = 0;
    document.getElementById('tilenum').value = t.toString();
    jsGB.dbgtile();
}

async function handleFileInput(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
        const reader = new BinFileReader();
        await reader.loadFile(file);
        MMUInstance.loadROM(reader);
        LOG.out('MAIN', 'ROM loaded successfully');
    } catch (err) {
        LOG.out('ERROR', 'Failed to load ROM: ' + err.message);
    }
}

window.onkeydown = KEY.keydown.bind(KEY);
window.onkeyup = KEY.keyup.bind(KEY);

document.addEventListener('DOMContentLoaded', jsGB.init);
