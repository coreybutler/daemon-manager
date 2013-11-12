// Basic Hello World
var http = require('http');

http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello World\n');
}).listen(1337, '127.0.0.1');

console.log('Server running at http://127.0.0.1:1337/');

// Handle messages sent from the wrapper
process.on('message',function(data){
  process.send(process.env.hasOwnProperty('TEST'));
});

// Force an error 2.5 seconds in.
setTimeout(function(){
  throw new Error('INTENTIONAL ERROR THROWN FOR TESTING PURPOSES');
},2500);
