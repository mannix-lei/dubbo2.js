
export default class RpcError extends Error{
  args: any[];

  constructor(err:Error,...args) {
    super(err.message);
    this.stack = err.stack;
    this.args = args;
  }

  toJSON(){
    return JSON.stringify(this,null,4);
  }
}