/**
 * BinFileReader.js
 * You can find more about this function at
 * http://nagoon97.com/reading-binary-files-using-ajax/
 *
 * Copyright (c) 2008 Andy G.P. Na <nagoon97@naver.com>
 * The source code is freely distributable under the terms of an MIT-style license.
 */
export class BinFileReader {
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