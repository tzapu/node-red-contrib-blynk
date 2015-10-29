module.exports = function(RED) {
	"use strict";
	// require any external libraries we may need....
	var path = require('path');
	var Blynk = require('blynk-library');
	//var blynkConnections = [];
	//var blynkConfigNode = null;
	//var pins = [];
	// Provide context.global access to node info.
	//RED.settings.functionGlobalContext.blynkPins = pins;
	
	
	function setupStatusEvents (context) {
		context.server.blynk.on('connect', function() {
			console.log("Blynk connect event on node.");
			context.status({fill:"green",shape:"dot",text:"connected"});
			context.state = 'connected';
		});
		context.server.blynk.on('disconnect', function() {
			console.log("Blynk disconnected disconnect event on node.");
			if(context.state != 'errored') {
				context.status({fill:"red",shape:"ring",text:"disconnected"});
			}
			context.state = 'connected';
		});
		context.server.blynk.on('error', function(err) {
			console.log("Blynk error event on node.");
			console.log(context.status);
			//context.error(err, "");
			context.status({fill:"red",shape:"ring",text:err});
			context.state = 'errored';
		});
		
	}

	function BlynkServer(n) {
		console.log('blynk server init', n.key);
		RED.nodes.createNode(this, n);
		this.key = n.key;
		this.usessl = n.usessl;
		this.addr = n.host;
		this.port = n.port;
		this.pins = [];
		
		// initialize Blynk or fetch it from the global reference
		// (used across Node-Red deployments which recreate all the nodes)
		// so we only get to initialise one single Blynk connection 
		// only when the node.js VM is starting
		var blynkConfigNode = this;
		//TODO: this needs to be pooled, should be possible to add more than 1 blynk server
		
		if (typeof this.blynk === 'undefined') {
			
			console.log('New Blynk connection with key', this.key, this.usessl);
			var options = {};
			var connOptions = {};
			
			if(this.addr) {
				console.log('using host', this.addr);
				connOptions.addr = this.addr;
			}
			if(this.port) {
				console.log('using port', this.port);
				connOptions.port = this.port;
			}
			
			if(this.usessl) {
				options.connector = new Blynk.SslClient(connOptions);
			} else {
				options.connector = new Blynk.TcpClient(connOptions);
			}
			
			
			this.blynk = new Blynk.Blynk(this.key, options); /* Blynk events */
			//is this an ok way of doing it?
			this.blynk.setMaxListeners(100);

			this.blynk.on('connect', function() {
				console.log("Blynk ready.", blynkConfigNode.key);
				//todo: emit connect and disconnect event to nodes
			});
			this.blynk.on('disconnect', function() {
				console.log("Blynk Disconnect.", blynkConfigNode.key);
				//todo
			});
			this.blynk.on('error', function(err) {
				console.log('Blynk error.', blynkConfigNode.key, err);
			});
			
			//TODO: error handling
		} /* =============== Node-Red events ================== */
		this.on("close", function() {
			console.log('blynk server close', this.key);
			//TODO: cleanup
			//blynkConnection.disconnect();
			this.blynk.disconnect();
			this.blynk.removeAllListeners();
			this.pins = [];
			//cleanup retry timer
			if(this.blynk.timerConn) {
				clearInterval(this.blynk.timerConn);
			}
			this.blynk = null;
		});
	}
	RED.nodes.registerType("blynk-server", BlynkServer);

	function BlynkReadEventNode(n) {
		// Create a RED node
		RED.nodes.createNode(this, n);

		// Store local copies of the node configuration (as defined in the .html)
		this.server = RED.nodes.getNode(n.server);
		this.pin = n.pin;
		if (typeof this.server.pins[this.pin] === 'undefined') {
			// does not exist
			this.server.pins[this.pin] = new this.server.blynk.VirtualPin(this.pin);
		} else {
			// does exist
		}
		// copy "this" object in case we need it in context of callbacks of other functions.
		var node = this;
		setupStatusEvents (node);
		console.log('blynk virtual pin init', this.pin);
		this.server.pins[this.pin].on('read', function() {
			console.log('read on pin', node.pin);
			var msg = {};
			msg.pin = node.pin;
			msg.payload = node.pin;
			node.send(msg);
		});
	}
	// Register the node by name. This must be called before overriding any of the
	// Node functions.
	RED.nodes.registerType("blynk-read-event", BlynkReadEventNode);

	function BlynkWriteEventNode(n) {
		// Create a RED node
		RED.nodes.createNode(this, n);
		// Store local copies of the node configuration (as defined in the .html)
		this.server = RED.nodes.getNode(n.server);
		this.pin = n.pin;
		
		if (typeof this.server.pins[this.pin] === 'undefined') {
			// does not exist
			this.server.pins[this.pin] = new this.server.blynk.VirtualPin(this.pin);
		} else {
			// does exist
		}
		// copy "this" object in case we need it in context of callbacks of other functions.
		var node = this;
		setupStatusEvents (node);
		console.log('blynk virtual pin init', this.pin);
		this.server.pins[this.pin].on('write', function(p) {
			console.log('write on pin', p);
			var msg = {};
			msg.pin = node.pin;
			msg.payload = p;
			node.send(msg);
		});
	}
	// Register the node by name. This must be called before overriding any of the
	// Node functions.
	RED.nodes.registerType("blynk-write-event", BlynkWriteEventNode);
	
	
	function BlynkWriteNode(n) {
		// Create a RED node
		RED.nodes.createNode(this, n);
		//get config node
		this.server = RED.nodes.getNode(n.server);
		// Store local copies of the node configuration (as defined in the .html)
		this.pin = n.pin;
		
		if (typeof this.server.pins[this.pin] === 'undefined') {
			// does not exist
			this.server.pins[this.pin] = new this.server.blynk.VirtualPin(this.pin);
		} else {
			// does exist
		}
		// copy "this" object in case we need it in context of callbacks of other functions.
		var node = this;
		setupStatusEvents (node);
		console.log('blynk virtual pin write init', this.pin);
		this.on("input", function(msg) {
			console.log('input on virtual write');
			if (msg.hasOwnProperty("payload")) {
				this.server.pins[node.pin].write(msg.payload);
			} else {
				node.warn(RED._("blynk.errors.invalid-payload"));
			}
		});
	}
	// Register the node by name. This must be called before overriding any of the
	// Node functions.
	RED.nodes.registerType("blynk-write", BlynkWriteNode);


	function BlynkNotifyNode(n) {
		// Create a RED node
		RED.nodes.createNode(this, n);
		//get config node
		this.server = RED.nodes.getNode(n.server);
		// Store local copies of the node configuration (as defined in the .html)
		
		//if (typeof this.server.pins[this.pin] === 'undefined') {
			// does not exist
		//	this.server.pins[this.pin] = new this.server.blynk.VirtualPin(this.pin);
		//} else {
			// does exist
		//}
		// copy "this" object in case we need it in context of callbacks of other functions.
		var node = this;
		setupStatusEvents (node);
		console.log('blynk virtual pin write init', this.pin);
		this.on("input", function(msg) {
			console.log('push notification');
			if (msg.hasOwnProperty("payload")) {
				this.server.blynk.notify(msg.payload);
			} else {
				node.warn(RED._("blynk.errors.invalid-payload"));
			}
		});
	}
	// Register the node by name. This must be called before overriding any of the
	// Node functions.
	RED.nodes.registerType("blynk-notify", BlynkNotifyNode);


}