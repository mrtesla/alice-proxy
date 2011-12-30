var Http = require('http')
,   Url  = require('url')
,   FS   = require('fs')
,   Buf  = require('./buffer')
,   Router
,   Environment
;


exports.create = function(type, callback){
  return new Router(type, callback);
};


Router = function(type, callback){
  this._callback   = callback;

  this.agent  = new Http.Agent
  this.agent.maxSockets = 100;
  var agent = this.agent;

  this.server = Http.createServer();
  this.server.on('request', function(d_req, d_res){
    var options
    ,   url
    ,   env
    ,   u_req
    ;

    url = Url.format({
      'protocol' : 'http',
      'host'     : d_req.headers.host,
      'pathname' : d_req.url
    });

    //console.log('['+ d_req.method+']: '+url);

    if (d_req.url == ('/_alice/probe/'+type)) {
      d_res.writeHead(200);
      d_res.end();
      return;
    }

    env = new Environment(agent, d_req, d_res);
    env.buffer  = Buf.createBuffer(d_req);
    env.upstream_url = url;
    env.url     = Url.parse(url);
    env.headers = d_req.headers;
    env.method  = d_req.method;
    env.time    = new Date().getTime();

    callback(env);
  });
};

Router.prototype.listen = function(port){
  this.server.listen(port);
};

Environment = function(agent, d_req, d_res){
  this.agent = agent;
  this.d_req = d_req;
  this.d_res = d_res;
};

Environment.prototype.respond = function(status) {
  var file
  ;

  file = __dirname + "/../errors/"+status+".html";

  if (status == 'maintenance') {
    status = 503;
  }

  if (this.method == 'HEAD') {
    this.d_res.writeHead(status);
    this.d_res.end();
    return;
  }

  this.d_res.writeHead(status, {'Content-Type': 'text/html'});
  this.stream = FS.createReadStream(file);
  this.stream.pipe(this.d_res);
};

Environment.prototype.forward = function(host, port) {
  var options
  ,   u_req
  ,   env = this
  ;

  console.log('FWD['+host+':'+port+']: '+this.method+' '+this.upstream_url);

  options = {
    'agent'   : this.agent,
    'host'    : host,
    'port'    : port,
    'method'  : this.method,
    'path'    : this.url.path,
    'headers' : this.headers
  };

  this.u_req = Http.request(options);
  this.u_req.setHeader('host', this.headers.host);

  this.u_req.setTimeout(30000, function(){
    env.respond(503);
  });

  this.u_req.on('response', function(u_res){
    env.d_res.writeHead(u_res.statusCode, u_res.headers);

    if (u_res.statusCode >= 100 && u_res.statusCode < 200) {
      env.d_res.end();
    } else if (u_res.headers['content-length'] === undefined && u_res.headers['transfer-encoding'] === undefined) {
      env.d_res.end();
    } else if (u_res.headers['content-length'] === '0') {
      env.d_res.end();
    } else {
      u_res.pipe(env.d_res);
    }
    // handle trailers
  });

  this.u_req.on('error', function(){
    env.respond(503);
  });

  env.buffer.pipe(this.u_req);
  // handle trailers
};

