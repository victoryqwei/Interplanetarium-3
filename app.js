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
setTitle('Lag Networking');

// Create port
var serverPort = process.env.PORT || 3004;
server.listen(serverPort, function () {
	console.log('Started an https server on port ' + serverPort);
})
var public = __dirname + '/public/';
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res) => res.sendFile(`${__dirname}/public/index.html`))

// Server input commands
/*const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Commmand line input
rl.on('line', (input) => {
  	if (input === 'refresh') {
  		io.emit('refresh');
  	}
});*/

const {performance} = require('perf_hooks');
var Vector = require('./modules/util/Vector.js');
var Util = require('./modules/util/Util.js');

let commands = [];

let bulletSnapshots = [];

var players = {

};



class Player {
	constructor(options) {
		var options = options || {};

		this.type = options.type || "player";
		this.color = options.color || "green";
		this.pos = options.pos || new Vector(1000, 800);
		this.size = 40;
		this.hp = 20;
		this.commandNumber = 0;
		this.lastCommandNumber = 0;
	}
}

players["bot"] = new Player({
	type: "bot",
	color: "orange",
	pos: new Vector(200, 800),
	flip: false,
});


// Handle player connection
io.on('connection', function(socket) {

	// Initialize player
	console.log("Connection", socket.id)
	players[socket.id] = new Player();

	socket.emit('serverInfo', {
		tickrate: tickrate,
	})

	// Incoming commands
	socket.on('command', function (data) {
		commands = commands.concat(data);
	})

	socket.on('tickLag', function (data) {

	})

	socket.on('shoot', function (data) {

		let client = players[socket.id];

		let packetLatency = data.clientTime - performance.now();
		let shootTime = performance.now() - packetLatency - data.lerpTime;

		// Perform lag compensation

		for (let i = 0; i < snapshots.length; i++) {

			let snapshot = snapshots[i];
			let snapshot2 = snapshots[i-1];

			if (snapshot.serverTime < shootTime || !snapshot2) continue;
			
			let pastPlayers = snapshot.players;


			for (let id in pastPlayers) {
				if (id != data.id && pastPlayers[id].hp > 0) {
					let player = pastPlayers[id];

					let amount = (snapshot.serverTime - shootTime)/(snapshot.serverTime - snapshot2.serverTime);
					player.pos = Util.interpolate(snapshot2.players[id].pos, player.pos, amount);

					// Check for collision
					let circle = {
						center: player.pos,
						radius: player.size/2,
					}

					let line = {
						p1: client.pos,
						p2: Vector.add(client.pos, Vector.mult(data.dir, 5000)),
					}

					if (Util.interceptCircleLineSeg(circle, line).length > 0) {
						players[id].hp -= 2;

						if (players["bot"].hp <= 0) {
							players["bot"].hp = 20;
						}
					}

					if (Util.interceptCircleLineSeg(circle, line).length > 0) {
						let color = "blue";

						// Add bullet snapshot
						bulletSnapshots.push({
							timestamp: data.clientTime,
							bullet: {
								color: color,
								pos: Vector.copy(client.pos),
								dir: Vector.copy(data.dir)
							},
							player: {
								color: color,
								pos: Vector.copy(player.pos),
								size: 40,
							}
						});
					}
				}
			}

			if (snapshot.serverTime >= shootTime) break;
		}

				
	})

	// Sync server clock with client clock
	socket.on('requestTime', function (data) {
		socket.emit('syncTime', {
			serverTime: performance.now(),
			clientTime: data
		})
	})

	// Disconnect
	socket.on("disconnect", () => {
		delete players[socket.id];
	})
});

let tickrate = 128; // Updates per second
let ticklength = Math.round(1000/tickrate); // Tick frequency (how long per tick)

let tick = 0;
let snapshots = [];
let delta, t = 0;

// Server loop
setInterval(function() {
	delta = performance.now()-t;
	t = performance.now();

	for (let id in players){
		let player = players[id];

		if (player.type == "bot") {

			// Number of commands
			let commandIterations = 3;

			let botSpeed = 1;

			let botVel = new Vector();
			if (player.flip) {
				botVel.x -= delta * botSpeed / commandIterations;
			} else {
				botVel.x += delta * botSpeed / commandIterations;
			}

			if (player.pos.x > 900) player.flip = true;
			if (player.pos.x < 100) player.flip = false;

			let command = {
				number: player.commandNumber,
				id: id,
				lerpTime: 100,
				msec: delta / commandIterations,
				vel: botVel,
				buttons: [],
				clientTime: performance.now(),
			}

			commands.push(command);
			player.commandNumber += 1;

			commands.push(command);
			player.commandNumber += 1;

			commands.push(command);
			player.commandNumber += 1;

			if (player.pos.x > 1000+player.size) player.pos.x = -player.size;
			if (player.pos.x < -player.size) player.pos.x = 1000+player.size;
			if (player.pos.y > 1000+player.size) player.pos.y = -player.size;
			if (player.pos.y < -player.size) player.pos.y = 1000+player.size;
		}
	}

	// Process commands
	for (let c of commands) {
		let player = players[c.id];

		if (!player)
			continue;

		if (c.vel) { // Move command
			let dV = Vector.mult(c.vel, 3/10);
			player.pos.add(dV);

			if (player.pos.x > 1000+player.size) player.pos.x = -player.size;
			if (player.pos.x < -player.size) player.pos.x = 1000+player.size;
			if (player.pos.y > 1000+player.size) player.pos.y = -player.size;
			if (player.pos.y < -player.size) player.pos.y = 1000+player.size;
		}

		players[c.id].lastCommandNumber = c.number;
	}

	// Send updated state to clients

	let updatedPlayers = JSON.parse(JSON.stringify(players));

	let snapshot = {
		tick: tick,
		serverTime: performance.now(),
		players: updatedPlayers,
		bulletSnapshots: bulletSnapshots,
	}

	io.emit('update', snapshot) // Emit state instead of players to prevent unnecessary information

	snapshot.commands = [];
	snapshot.commands = snapshot.commands.concat(commands);
	snapshots.push(snapshot);
	while (performance.now() - snapshots[0].serverTime > 400) snapshots.shift();

	commands = [];
	bulletSnapshots = [];
	
	tick += 1;

	let framerate = performance.now()-t;

}, ticklength);

module.exports = app;