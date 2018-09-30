export default class RpcError extends Error {
  args: any[];
  cause: any;

  constructor(err: any, ...args) {
    super(err.message);
    this.stack = err.stack;
    this.cause = err.cause;
    this.args = args;
  }

  toJSON() {
    return JSON.stringify(this, null, 4);
  }
}