export const LOG = {
  _start: 0,

  reset() {
    const d = new Date();
    this._start = d.getTime();
  },

  out(module, str) {
    const t = new Date();
    const ts = t.getTime() - this._start;
    //console.log(`{${ts}ms} [${module}] ${str}`);
    document.getElementById('msg').innerHTML += `{${ts}ms} [${module}] ${str}<br>`;
  }
};
