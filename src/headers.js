var headers = [
  'Accept',
  'Accept-Encoding',
  'Accept-Language',
  'Accept-Charset',
  'Cache-Control',
  'Connection',
  'Content-Encoding',
  'Content-Length',
  'Content-Type',
  'Cookie',
  'Date',
  'ETag',
  'Host',
  'If-Modified-Since',
  'If-None-Match',
  'Keep-Alive',
  'Location',
  'Referer',
  'Server',
  'Set-Cookie',
  'Transfer-Encoding',
  'User-Agent',
  'Vary',
  'X-Forwarded-For',
  'X-Forwarded-Host',
  'X-Forwarded-Port',
  'X-Forwarded-Proto'
];

exports.headers = {};

headers.forEach(function(name){
  var key
  ;

  key = name.toLowerCase();
  exports.headers[key] = name;
});
