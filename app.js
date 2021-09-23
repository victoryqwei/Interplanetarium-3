// Initialize server variables
var express = require('express');
var app = express();
var https = require('https');
var fs = require('fs');
var options = {
	key: fs.readFileSync('./bin/ia.key'),
	cert: fs.readFileSync('./bin/server.crt'),
	ca: fs.readFileSync('./bin/ca.crt')
}

// Create HTTPS server
var server = https.createServer(options, app);
var path = require('path');
var readline = require('readline'); // Command line input
var fs = require('fs');
var io = require('socket.io')(server);

// Set title
var setTitle = require('console-title');
setTitle('Interplanetarium 3');

// Create port
var serverPort = process.env.PORT || 3004;
server.listen(serverPort, function () {
	console.log('Started an https server on port ' + serverPort);
})
var public = __dirname + '/public/';
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res) => res.sendFile(`${__dirname}/public/index.html`))

// POPOPOPOPOPO

// Handle player connection
io.on('connection', function(socket) {

	// Disconnect
	socket.on("disconnect", () => {

	})
});



module.exports = app;