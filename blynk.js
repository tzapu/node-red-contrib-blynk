/**
 * Copyright 2014 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

// If you use this as a template, update the copyright with your own name.

// Sample Node-RED node file


module.exports = function(RED) {
    "use strict";
    // require any external libraries we may need....
	var path = require('path');
	var Blynk = require('blynk-library');

	var blynkConnection = null;
	var blynkConfigNode = null;

	var pins = [];
	
	// Provide context.global access to node info.
	RED.settings.functionGlobalContext.blynkPins = pins;


	function BlynkServer(n) {
		console.log('blynk server init');
		RED.nodes.createNode(this,n);
		this.key = n.key;

		// initialize Blynk or fetch it from the global reference
		// (used across Node-Red deployments which recreate all the nodes)
		// so we only get to initialise one single Blynk connection 
		// only when the node.js VM is starting
		blynkConfigNode = this;
		
		if (!blynkConnection) {
			console.log('New Blynk connection with key', this.key);
			var options = {certs_path : path.dirname(require.resolve('blynk-library')) + '/certs/'};
			blynkConnection = new Blynk.Blynk(this.key, options);
			
			/* Blynk events */
			blynkConnection.on('connect', function() { console.log("Blynk ready."); });
			blynkConnection.on('disconnect', function() { console.log("Blynk Disconnect"); });
			//TODO: error handling
		}

		/* =============== Node-Red events ================== */
		this.on("close", function() {
			console.log('blynk server close');
			//TODO: cleanup
	    });
	}

	RED.nodes.registerType("blynk-server", BlynkServer);

	
    function BlynkWriteNode(n) {
        // Create a RED node
        RED.nodes.createNode(this, n);

        // Store local copies of the node configuration (as defined in the .html)
        this.pin = n.pin;

		if(typeof pins[this.pin] === 'undefined') {
			// does not exist
			pins[this.pin] = new blynkConnection.VirtualPin(this.pin);
		} else {
		    // does exist
		    
		}

        // copy "this" object in case we need it in context of callbacks of other functions.
        var node = this;
        
        console.log('blynk virtual pin write init', this.pin);

		this.on("input", function(msg) {
			console.log('input on virtual write');
            if ( msg.hasOwnProperty("payload")) {
				pins[node.pin].write(new Date().getSeconds());
            } else {
	            node.warn(RED._("blynk.errors.invalid-payload")); 
            }	        
        });
    }

    // Register the node by name. This must be called before overriding any of the
    // Node functions.
    RED.nodes.registerType("blynk-write", BlynkWriteNode);


	
    function BlynkReadEventNode(n) {
        // Create a RED node
        RED.nodes.createNode(this, n);

        // Store local copies of the node configuration (as defined in the .html)
        this.pin = n.pin;

		if(typeof pins[this.pin] === 'undefined') {
			// does not exist
			pins[this.pin] = new blynkConnection.VirtualPin(this.pin);
		} else {
		    // does exist
		    
		}


        // copy "this" object in case we need it in context of callbacks of other functions.
        var node = this;
        
        console.log('blynk virtual pin init', this.pin);

		pins[this.pin].on('read', function() {
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
        this.pin = n.pin;

		if(typeof pins[this.pin] === 'undefined') {
			// does not exist
			pins[this.pin] = new blynkConnection.VirtualPin(this.pin);
		} else {
		    // does exist
		    
		}


        // copy "this" object in case we need it in context of callbacks of other functions.
        var node = this;
        
        console.log('blynk virtual pin init', this.pin);

		pins[this.pin].on('write', function(p) {
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


}