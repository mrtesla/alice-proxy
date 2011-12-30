var Buffer
;

exports.createBuffer = function(source) {
  return new Buffer(source);
};

Buffer = function(source){
  this.source = source;
  this.ops    = [];

  var ops   = this.ops
  ,   _this = this
  ;

  this.on_data = function(data){
    ops.push(['write', [data]]);
  };

  this.on_end = function(){
    ops.push(['end', []]);
    _this.break = true;
  };

  this.on_close = function(){
    ops.push(['close', []]);
    _this.break = true;
  };

  this.source.on('data',  this.on_data);
  this.source.on('end',   this.on_end);
  this.source.on('close', this.on_close);
};

Buffer.prototype.pipe = function(stream){
  this.source.removeListener('data',  this.on_data);
  this.source.removeListener('end',   this.on_end);
  this.source.removeListener('close', this.on_close);

  this.ops.forEach(function(op){
    stream[op[0]].apply(stream, op[1]);
  });

  this.ops = null;

  if (!this.break) {
    this.source.pipe(stream);
  };
};
