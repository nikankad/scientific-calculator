// Token-based line editor. Each token has a canonical text `t` (fed to the
// parser) and a display string `d`, so DEL removes "sin(" as one unit.

export class LineEditor {
  constructor(tokens = []) {
    this.tokens = tokens.map((t) => ({ ...t }));
    this.cursor = this.tokens.length;
    this.insert = true;
    this.history = [];
  }

  get empty() {
    return this.tokens.length === 0;
  }

  snapshot() {
    this.history.push({ tokens: this.tokens.slice(), cursor: this.cursor });
    if (this.history.length > 60) this.history.shift();
  }

  undo() {
    const s = this.history.pop();
    if (!s) return;
    this.tokens = s.tokens;
    this.cursor = s.cursor;
  }

  put(tok) {
    this.snapshot();
    if (!this.insert && this.cursor < this.tokens.length) this.tokens[this.cursor] = { ...tok };
    else this.tokens.splice(this.cursor, 0, { ...tok });
    this.cursor++;
  }

  del() {
    if (!this.tokens.length) return;
    this.snapshot();
    if (this.insert ? this.cursor === 0 : this.cursor < this.tokens.length) {
      this.tokens.splice(this.cursor, 1);
    } else {
      this.tokens.splice(this.cursor - 1, 1);
      this.cursor--;
    }
  }

  left() {
    this.cursor = this.cursor > 0 ? this.cursor - 1 : this.tokens.length;
  }

  right() {
    this.cursor = this.cursor < this.tokens.length ? this.cursor + 1 : 0;
  }

  end() {
    this.cursor = this.tokens.length;
  }

  clear() {
    if (this.tokens.length) this.snapshot();
    this.tokens = [];
    this.cursor = 0;
  }

  set(tokens) {
    this.snapshot();
    this.tokens = tokens.map((t) => ({ ...t }));
    this.cursor = this.tokens.length;
  }

  text() {
    return this.tokens.map((t) => t.t).join('');
  }

  display() {
    return this.tokens.map((t) => t.d).join('');
  }

  // Token index containing canonical character position `pos`.
  indexOfPos(pos) {
    if (pos < 0) return this.tokens.length;
    let acc = 0;
    for (let i = 0; i < this.tokens.length; i++) {
      acc += this.tokens[i].t.length;
      if (acc > pos) return i;
    }
    return this.tokens.length;
  }
}
