class GPU {
  constructor() {
    // Initialize all properties in constructor
    this._vram = [];
    this._oam = [];
    this._reg = [];
    this._tilemap = [];
    this._objdata = [];
    this._objdatasorted = [];
    this._palette = {bg: [], obj0: [], obj1: []};
    this._scanrow = [];

    this._curline = 0;
    this._curscan = 0;
    this._linemode = 0;
    this._modeclocks = 0;

    this._yscrl = 0;
    this._xscrl = 0;
    this._raster = 0;
    this._ints = 0;
    
    this._lcdon = 0;
    this._bgon = 0;
    this._objon = 0;
    this._winon = 0;

    this._objsize = 0;

    this._bgtilebase = 0x0000;
    this._bgmapbase = 0x1800;
    this._wintilebase = 0x1800;

    this.reset();
  }

  reset() {
    for(let i = 0; i < 8192; i++) {
      this._vram[i] = 0;
    }
    for(let i = 0; i < 160; i++) {
      this._oam[i] = 0;
    }
    for(let i = 0; i < 4; i++) {
      this._palette.bg[i] = 255;
      this._palette.obj0[i] = 255;
      this._palette.obj1[i] = 255;
    }
    for(let i = 0; i < 512; i++) {
      this._tilemap[i] = [];
      for(let j = 0; j < 8; j++) {
        this._tilemap[i][j] = [];
        for(let k = 0; k < 8; k++) {
          this._tilemap[i][j][k] = 0;
        }
      }
    }

    LOG.out('GPU', `Initialising screen.`);
    const c = document.getElementById('screen');
    if(c && c.getContext) {
      this._canvas = c.getContext('2d');
      if(!this._canvas) {
        throw new Error('GPU: Canvas context could not be created.');
      } else {
        if(this._canvas.createImageData)
          this._scrn = this._canvas.createImageData(160,144);
        else if(this._canvas.getImageData)
          this._scrn = this._canvas.getImageData(0,0,160,144);
        else
          this._scrn = {width:160, height:144, data:new Array(160*144*4)};

        for(let i = 0; i < this._scrn.data.length; i++)
          this._scrn.data[i] = 255;

        this._canvas.putImageData(this._scrn, 0,0);
      }
    }

    this._curline = 0;
    this._curscan = 0;
    this._linemode = 2;
    this._modeclocks = 0;
    this._yscrl = 0;
    this._xscrl = 0;
    this._raster = 0;
    this._ints = 0;

    this._lcdon = 0;
    this._bgon = 0;
    this._objon = 0;
    this._winon = 0;

    this._objsize = 0;
    for(let i = 0; i < 160; i++) this._scanrow[i] = 0;

    for(let i = 0; i < 40; i++) {
      this._objdata[i] = {y:-16, x:-8, tile:0, palette:0, yflip:0, xflip:0, prio:0, num:i};
    }

    // Set to values expected by BIOS, to start
    this._bgtilebase = 0x0000;
    this._bgmapbase = 0x1800;
    this._wintilebase = 0x1800;

    LOG.out('GPU', `Reset.`);
  }

  checkline() {
    this._modeclocks += Z80._r.m;
    switch(this._linemode) {
      // In hblank
      case 0:
        if(this._modeclocks >= 51) {
          // End of hblank for last scanline; render screen
          if(this._curline == 143) {
            this._linemode = 1;
            this._canvas.putImageData(this._scrn, 0,0);
            MMUInstance._if |= 1;
          } else {
            this._linemode = 2;
          }
          this._curline++;
          this._curscan += 640;
          this._modeclocks = 0;
        }
        break;

      // In vblank
      case 1:
        if(this._modeclocks >= 114) {
          this._modeclocks = 0;
          this._curline++;
          if(this._curline > 153) {
            this._curline = 0;
            this._curscan = 0;
            this._linemode = 2;
          }
        }
        break;

      // In OAM-read mode
      case 2:
        if(this._modeclocks >= 20) {
          this._modeclocks = 0;
          this._linemode = 3;
        }
        break;

      // In VRAM-read mode
      case 3:
        // Render scanline at end of allotted time
        if(this._modeclocks >= 43) {
          this._modeclocks = 0;
          this._linemode = 0;
          if(this._lcdon) {
            if(this._bgon) {
              let linebase = this._curscan;
              let mapbase = this._bgmapbase + ((((this._curline+this._yscrl)&255)>>3)<<5);
              let y = (this._curline+this._yscrl)&7;
              let x = this._xscrl&7;
              let t = (this._xscrl>>3)&31;
              let w = 160;

              if(this._bgtilebase) {
                let tile = this._vram[mapbase+t];
                if(tile < 128) tile = 256 + tile;
                let tilerow = this._tilemap[tile][y];
                do {
                  this._scanrow[160-x] = tilerow[x];
                  this._scrn.data[linebase+3] = this._palette.bg[tilerow[x]];
                  x++;
                  if(x == 8) { 
                    t = (t+1)&31; 
                    x = 0; 
                    tile = this._vram[mapbase+t]; 
                    if(tile < 128) tile = 256 + tile; 
                    tilerow = this._tilemap[tile][y]; 
                  }
                  linebase += 4;
                } while(--w);
              } else {
                let tilerow = this._tilemap[this._vram[mapbase+t]][y];
                do {
                  this._scanrow[160-x] = tilerow[x];
                  this._scrn.data[linebase+3] = this._palette.bg[tilerow[x]];
                  x++;
                  if(x == 8) { 
                    t = (t+1)&31; 
                    x = 0; 
                    tilerow = this._tilemap[this._vram[mapbase+t]][y]; 
                  }
                  linebase += 4;
                } while(--w);
              }
            }
            if(this._objon) {
              let cnt = 0;
              if(this._objsize) {
                for(let i = 0; i < 40; i++) {
                  // TODO: Implement tall sprites
                }
              } else {
                let tilerow;
                let obj;
                let pal;
                let linebase = this._curscan;
                for(let i = 0; i < 40; i++) {
                  obj = this._objdatasorted[i];
                  if(obj.y <= this._curline && (obj.y+8) > this._curline) {
                    if(obj.yflip)
                      tilerow = this._tilemap[obj.tile][7-(this._curline-obj.y)];
                    else
                      tilerow = this._tilemap[obj.tile][this._curline-obj.y];

                    pal = obj.palette ? this._palette.obj1 : this._palette.obj0;

                    linebase = (this._curline*160+obj.x)*4;
                    if(obj.xflip) {
                      for(let x = 0; x < 8; x++) {
                        if(obj.x+x >= 0 && obj.x+x < 160) {
                          if(tilerow[7-x] && (obj.prio || !this._scanrow[x])) {
                            this._scrn.data[linebase+3] = pal[tilerow[7-x]];
                          }
                        }
                        linebase += 4;
                      }
                    } else {
                      for(let x = 0; x < 8; x++) {
                        if(obj.x+x >= 0 && obj.x+x < 160) {
                          if(tilerow[x] && (obj.prio || !this._scanrow[x])) {
                            this._scrn.data[linebase+3] = pal[tilerow[x]];
                          }
                        }
                        linebase += 4;
                      }
                    }
                    cnt++; 
                    if(cnt > 10) break;
                  }
                }
              }
            }
          }
        }
        break;
    }
  }

  updatetile(addr, val) {
    const saddr = addr & 1 ? addr - 1 : addr;
    const tile = (addr >> 4) & 511;
    const y = (addr >> 1) & 7;
    
    for(let x = 0; x < 8; x++) {
      const sx = 1 << (7 - x);
      this._tilemap[tile][y][x] = 
        ((this._vram[saddr] & sx) ? 1 : 0) | 
        ((this._vram[saddr + 1] & sx) ? 2 : 0);
    }
  }

  updateoam(addr, val) {
    addr -= 0xFE00;
    const obj = addr >> 2;
    if(obj < 40) {
      switch(addr & 3) {
        case 0: this._objdata[obj].y = val - 16; break;
        case 1: this._objdata[obj].x = val - 8; break;
        case 2:
          this._objdata[obj].tile = this._objsize ? (val & 0xFE) : val;
          break;
        case 3:
          this._objdata[obj].palette = (val & 0x10) ? 1 : 0;
          this._objdata[obj].xflip = (val & 0x20) ? 1 : 0;
          this._objdata[obj].yflip = (val & 0x40) ? 1 : 0;
          this._objdata[obj].prio = (val & 0x80) ? 1 : 0;
          break;
      }
    }
    this._objdatasorted = [...this._objdata];
    this._objdatasorted.sort((a, b) => {
      if(a.x > b.x) return -1;
      if(a.num > b.num) return -1;
      return 0;
    });
  }

  rb(addr) {
    const gaddr = addr - 0xFF40;
    switch(gaddr) {
      case 0:
        return (this._lcdon ? 0x80 : 0) |
               (this._bgtilebase == 0x0000 ? 0x10 : 0) |
               (this._bgmapbase == 0x1C00 ? 0x08 : 0) |
               (this._objsize ? 0x04 : 0) |
               (this._objon ? 0x02 : 0) |
               (this._bgon ? 0x01 : 0);

      case 1:
        return (this._curline == this._raster ? 4 : 0) | this._linemode;

      case 2:
        return this._yscrl;

      case 3:
        return this._xscrl;

      case 4:
        return this._curline;

      case 5:
        return this._raster;

      default:
        return this._reg[gaddr];
    }
  }

  wb(addr, val) {
    const gaddr = addr - 0xFF40;
    this._reg[gaddr] = val;
    switch(gaddr) {
      case 0:
        this._lcdon = (val & 0x80) ? 1 : 0;
        this._bgtilebase = (val & 0x10) ? 0x0000 : 0x0800;
        this._bgmapbase = (val & 0x08) ? 0x1C00 : 0x1800;
        this._objsize = (val & 0x04) ? 1 : 0;
        this._objon = (val & 0x02) ? 1 : 0;
        this._bgon = (val & 0x01) ? 1 : 0;
        break;

      case 2:
        this._yscrl = val;
        break;

      case 3:
        this._xscrl = val;
        break;

      case 5:
        this._raster = val;
        break;

      // OAM DMA
      case 6:
        for(let i = 0; i < 160; i++) {
          const v = MMUInstance.rb((val << 8) + i);
          this._oam[i] = v;
          this.updateoam(0xFE00 + i, v);
        }
        break;

      // BG palette mapping
      case 7:
        for(let i = 0; i < 4; i++) {
          switch((val >> (i * 2)) & 3) {
            case 0: this._palette.bg[i] = 255; break;
            case 1: this._palette.bg[i] = 192; break;
            case 2: this._palette.bg[i] = 96; break;
            case 3: this._palette.bg[i] = 0; break;
          }
        }
        break;

      // OBJ0 palette mapping
      case 8:
        for(let i = 0; i < 4; i++) {
          switch((val >> (i * 2)) & 3) {
            case 0: this._palette.obj0[i] = 255; break;
            case 1: this._palette.obj0[i] = 192; break;
            case 2: this._palette.obj0[i] = 96; break;
            case 3: this._palette.obj0[i] = 0; break;
          }
        }
        break;

      // OBJ1 palette mapping
      case 9:
        for(let i = 0; i < 4; i++) {
          switch((val >> (i * 2)) & 3) {
            case 0: this._palette.obj1[i] = 255; break;
            case 1: this._palette.obj1[i] = 192; break;
            case 2: this._palette.obj1[i] = 96; break;
            case 3: this._palette.obj1[i] = 0; break;
          }
        }
        break;
    }
  }
}

// Export GPU class and instance
window.GPU = GPU;
window.GPUInstance = new GPU();
