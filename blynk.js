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
	function logInfo(node, message) {
		if(RED.settings.verbose) {
			node.log(message);
		}
	}
	function logWarn(node, message) {
		if(RED.settings.verbose) {
			node.warn(message);
		}
	}
	function logError(node, message) {
		//if(RED.settings.verbose) {
			node.error(message);
		//}
	}
	
	function setupStatusEvents (context) {
		context.server.blynk.on('connect', function() {
			logInfo(context, "connected");
			context.status({fill:"green",shape:"dot",text:"connected"});
			if(context.type == 'bridge' ) {
                                context.bridge.setAuthToken(context.target);
                        }
			context.state = 'connected';
		});
		context.server.blynk.on('disconnect', function() {
			logInfo(context, "disconnected");
			if(context.state != 'errored') {
				context.status({fill:"red",shape:"ring",text:"disconnected"});
			}
			context.state = 'disconnected';
		});
		context.server.blynk.on('error', function(err) {
			logError(context, "errored");
			//logError(context, context.status);
			//context.error(err, "");
			context.status({fill:"red",shape:"ring",text:err});
			context.state = 'errored';
		});
		
	}

	function BlynkServer(n) {
		//console.log('blynk server init', n.key);
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
			this.warn("#### \n node-red-contrib-blynk is deprecated. use node-red-contrib-blynk-websockets . \n####");
			logInfo(blynkConfigNode,'new connection with key: ' + this.key + ' SSL: ' + this.usessl);
			var options = {};
			var connOptions = {};
			
			if(this.addr) {
				logInfo(blynkConfigNode, 'using host ' + this.addr);
				connOptions.addr = this.addr;
			}
			if(this.port) {
				logInfo(blynkConfigNode, 'using port ' + this.port);
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
				//console.log("Server ready.", blynkConfigNode.key);
				blynkConfigNode.log('key: ' + blynkConfigNode.key + ' connected');
				//todo: emit connect and disconnect event to nodes
			});
			this.blynk.on('disconnect', function() {
				//logWarn(blynkConfigNode, "key: " + blynkConfigNode.key + ' disconnected');
				blynkConfigNode.log("key: " + blynkConfigNode.key + ' disconnected');
				//todo
			});
			this.blynk.on('error', function(err) {
				logError(blynkConfigNode, 'key: ' +  blynkConfigNode.key + ' reason: ' + err);
			});
			
			//TODO: error handling
		} /* =============== Node-Red events ================== */
		this.on("close", function() {
			logInfo(this, 'key: '+  this.key + ' node-red close');
			//TODO: cleanup
			//blynkConnection.disconnect();
			this.blynk.disconnect(false);
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
		logInfo(node, 'on pin ' + this.pin + ' added');
		this.server.pins[this.pin].on('read', function() {
			logInfo(node, 'on pin ' +  node.pin + ' requested');
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
		logInfo(node, 'on pin ' + this.pin + ' added');
		this.server.pins[this.pin].on('write', function(p) {
			logInfo(node, 'on pin ' +  node.pin + ' received ' + p);
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

		logInfo(node, 'on pin ' +  node.pin + ' added');

		this.on("input", function(msg) {
			if (msg.hasOwnProperty("payload")) {
				logInfo(node, 'on pin ' +  node.pin + ' writing ' + msg.payload);
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
		logInfo(node, 'on pin ' +  node.pin + ' added');
		
		this.on("input", function(msg) {
			if (msg.hasOwnProperty("payload")) {
				logInfo(node, 'on pin ' +  node.pin + ' notifying ' + msg.payload);
				this.server.blynk.notify(msg.payload);
			} else {
				node.warn(RED._("blynk.errors.invalid-payload"));
			}
		});
	}
	// Register the node by name. This must be called before overriding any of the
	// Node functions.
	RED.nodes.registerType("blynk-notify", BlynkNotifyNode);


	function BlynkLCDPrintNode(n) {
		RED.nodes.createNode(this, n);
		//get config node
		this.server = RED.nodes.getNode(n.server);
		// Store local copies of the node configuration (as defined in the .html)
		this.pin = n.pin;
		if (typeof this.server.pins[this.pin] === 'undefined') {
			// does not exist
			this.server.pins[this.pin] = new this.server.blynk.WidgetLCD(this.pin);
		} else {
			// does exist
			this.warn(RED._("LCD Pin already in use"));
		}
		// copy "this" object in case we need it in context of callbacks of other functions.
		var node = this;
		setupStatusEvents (node);

		logInfo(node, 'on pin ' +  node.pin + ' added');

		this.on("input", function(msg) {
			if (msg.hasOwnProperty("payload")) {
				if(msg.payload == 'clear-lcd') {
					logInfo(node, 'on pin ' +  node.pin + ' printing ' + msg.payload);
					this.server.pins[node.pin].clear();
					
				} else {
					var line = 0;
					if (msg.topic && !isNaN(msg.topic)){
						line = msg.topic;						
					}

					logInfo(node, 'on pin ' +  node.pin + ' printing ' + msg.payload);
					this.server.pins[node.pin].print(0, line, msg.payload);
				}
			} else {
				node.warn(RED._("blynk.errors.invalid-payload"));
			}
		});	
	}
	RED.nodes.registerType("blynk-lcd-print", BlynkLCDPrintNode);

	 function BlynkBridgeNode(n) {
		RED.nodes.createNode(this, n);
		//get config node
		this.server = RED.nodes.getNode(n.server);
		// Store local copies of the node configuration (as defined in the .html)
		this.pin = n.pin;
                this.type = 'bridge';
                this.target = n.target;
		if (typeof this.server.pins[this.pin] === 'undefined') {
			// does not exist
                        this.bridge =  new this.server.blynk.WidgetBridge(this.pin);
		} else {
			// does exist
			this.warn(RED._("Bridge Pin already in use"));
		}
		// copy "this" object in case we need it in context of callbacks of other functions.
         
		var node = this;
		setupStatusEvents (node);

		logInfo(node, 'on pin ' +  node.pin + ' added');

		this.on("input", function(msg) {
			if (msg.hasOwnProperty("payload")) {
				this.bridge.virtualWrite(msg.pin, msg.payload);
			} else {
				node.warn(RED._("blynk.errors.invalid-payload"));
			}
		});	
	}
	RED.nodes.registerType("blynk-bridge", BlynkBridgeNode);

}
