var Http = require('http')
,   Url  = require('url')
,   FS   = require('fs')
,   Buf  = require('./buffer')
,   Head = require('./headers')
,   Router
,   Environment
;


exports.create = function(type, callback){
  return new Router(type, callback);
};


Router = function(type, callback){
  var router = this;

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

    url = "http://"+d_req.headers.host+(d_req.url || '/');

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
    env.router_port = router.port;

    callback(env);
  });
};

Router.prototype.listen = function(port){
  this.port = port;
  this.server.listen(port);
};

Environment = function(agent, d_req, d_res){
  this.agent = agent;
  this.d_req = d_req;
  this.d_res = d_res;
};

Environment.prototype.respond = function(status) {
  var file
  ,   headers
  ;

  file = __dirname + "/../errors/"+status+".html";

  headers = {
    'Content-Type':  'text/html',
    'Cache-Control': 'max-age=0, private, must-revalidate'
  };

  if (typeof(status) == 'string') {
    status = 503;
  }

  if (this.method == 'HEAD') {
    this.d_res.writeHead(status, headers);
    this.d_res.end();
    return;
  }

  this.d_res.writeHead(status, headers);
  this.stream = FS.createReadStream(file);
  this.stream.pipe(this.d_res);
};

Environment.prototype.forward = function(host, port, res_headers) {
  var options
  ,   u_req
  ,   env = this
  ;

  options = {
    'agent'   : this.agent,
    'host'    : host,
    'port'    : port,
    'method'  : this.method,
    'path'    : this.url.path,
    'headers' : this.headers
  };

  Object.keys(this.headers).forEach(function(key){
    var name
    ;

    name = Head.headers[key] || key;
    options.headers[name] = env.headers[key];
  });

  if (options.headers['X-Forwarded-For']) {
    options.headers['X-Forwarded-For'] =
      options.headers['X-Forwarded-For'] + ', ' + this.d_req.connection.remoteAddress;
  } else {
    options.headers['X-Forwarded-For'] = this.d_req.connection.remoteAddress;
  }

  if (options.headers['X-Forwarded-Proto']) {
    options.headers['X-Forwarded-Proto'] =
      options.headers['X-Forwarded-Proto'] + ', http';
  } else {
    options.headers['X-Forwarded-Proto'] = 'http';
  }

  if (options.headers['X-Forwarded-Host']) {
    options.headers['X-Forwarded-Host'] =
      options.headers['X-Forwarded-Host'] + ', ' + this.url.host;
  } else {
    options.headers['X-Forwarded-Host'] = this.url.host;
  }

  if (options.headers['X-Forwarded-Port']) {
    options.headers['X-Forwarded-Port'] =
      options.headers['X-Forwarded-Port'] + ', ' + this.router_port;
  } else {
    options.headers['X-Forwarded-Port'] = this.router_port;
  }

  this.u_req = Http.request(options);
  this.u_req.setHeader('Host', this.url.host);

  this.u_req.setTimeout(30000, function(){
    env.respond(503);
  });

  this.u_req.on('response', function(u_res){
    var headers
    ;

    headers = {};
    Object.keys(u_res.headers).forEach(function(key){
      var name
      ;

      name = Head.headers[key] || key;
      headers[name] = u_res.headers[key];
    });

    if (res_headers) {
      Object.keys(res_headers).forEach(function(key){
        var name
        ;

        name = Head.headers[key] || key;
        headers[name] = res_headers[key];
      });
    }

    env.d_res.writeHead(u_res.statusCode, headers);

    if (u_res.statusCode >= 100 && u_res.statusCode < 200) {
      env.d_res.end();
    } else if (u_res.statusCode >= 304) {
      env.d_res.end();
    } else if (env.u_req.method === 'HEAD') {
      env.d_res.end();
    } else if (u_res.headers['content-length']    === undefined &&
               u_res.headers['transfer-encoding'] === undefined &&
               u_res.headers['connection']        !== 'close') {
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

