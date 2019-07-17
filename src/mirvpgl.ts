import { EventEmitter } from "events";

import * as readline from 'readline';
import * as events from 'events';
import * as util from 'util';
import * as WebSocket from 'ws';
const WebSocketServer = WebSocket.Server;
import * as http from 'http';
const bigInt = require("big-integer");
// MIRV PROCESS
//const readline = require('readline'),
//const events = require('events'),
//const util = require('util'),
//const WebSocketServer = require('ws').Server,
// const http = require('http'),


/*
  Prerequisites:

    1. Install node.js and npm ( I used node-v10.15.3-x64.msi )
    2. npm install

  See also,

    http://einaros.github.com/ws/

  To run,
    (npm update if you haven't in a long time)
    node server.js

  Hints:

  - Text entered (with enter) is sent to client as exec.
  - You might want to whitelist / blacklist events from being transmitted if you need to reduce the data transmitted.
*/

//"use strict"; // http://ejohn.org/blog/ecmascript-5-strict-mode-json-and-more/


////////////////////////////////////////////////////////////////////////////////

class BufferReader {
	buffer: Buffer;
	index: number;
	constructor(buffer:Buffer) {
		this.buffer = buffer
		this.index = 0;
	}

	readBigUInt64LE() {
		var lo = this.readUInt32LE()
		var hi = this.readUInt32LE();

		return bigInt(lo).or(bigInt(hi).shiftLeft(32));
	}

	readUInt32LE() {
		var result = this.buffer.readUInt32LE(this.index);
		this.index += 4;

		return result;
	}

	readInt32LE() {
		var result = this.buffer.readInt32LE(this.index);
		this.index += 4;

		return result;
	};

	readInt16LE() {
		var result = this.buffer.readInt16LE(this.index);
		this.index += 2;

		return result;
	};

	readInt8() {
		var result = this.buffer.readInt8(this.index);
		this.index += 1;

		return result;
	};

	readUInt8() {
		var result = this.buffer.readUInt8(this.index);
		this.index += 1;

		return result;
	};

	readBoolean() {
		return 0 != this.readUInt8();
	};

	readFloatLE() {
		var result = this.buffer.readFloatLE(this.index);
		this.index += 4;

		return result;
	};

	readCString() {
		var delim = this.findDelim(this.buffer, this.index);
		if (this.index <= delim) {
			var result = this.buffer.toString('utf8', this.index, delim);
			this.index = delim + 1;
			return result;
		}

		this.readCString();
	}

	eof() {
		return this.index >= this.buffer.length;
	}

	private findDelim(buffer:Buffer, idx:number): number {
		var delim = -1;
		for (var i = idx; i < buffer.length; ++i) {
			if (0 == buffer[i]) {
				delim = i;
				break;
			}
		}
		return delim;
	}
}

// GameEventUnserializer ///////////////////////////////////////////////////////

class GameEventDescription {
	eventId: number;
	eventName: string | undefined;
	keys: any[]
	enrichments: any;

	constructor(bufferReader:BufferReader) {
		this.eventId = bufferReader.readInt32LE();
		this.eventName = bufferReader.readCString();
		this.keys = [];
		this.enrichments = null;

		while (bufferReader.readBoolean()) {
			var keyName = bufferReader.readCString();
			var keyType = bufferReader.readInt32LE();
			this.keys.push({
				name: keyName,
				type: keyType
			});
		}
	}

	unserialize(bufferReader:BufferReader) {
		var clientTime = bufferReader.readFloatLE();

		var result:any = {
			name: this.eventName,
			clientTime: clientTime,
			keys: {}
		};

		for (var i = 0; i < this.keys.length; ++i) {
			var key = this.keys[i];

			var keyName = key.name;

			var keyValue:any;

			switch (key.type) {
				case 1:
					keyValue = bufferReader.readCString();
					break;
				case 2:
					keyValue = bufferReader.readFloatLE();
					break;
				case 3:
					keyValue = bufferReader.readInt32LE();
					break;
				case 4:
					keyValue = bufferReader.readInt16LE();
					break;
				case 5:
					keyValue = bufferReader.readInt8();
					break;
				case 6:
					keyValue = bufferReader.readBoolean();
					break;
				case 7:
					keyValue = bufferReader.readBigUInt64LE();
					break;
				default:
					GameEventDescription.prototype.unserialize(bufferReader);
			}

			if (this.enrichments && this.enrichments[keyName]) {
				keyValue = this.enrichments[keyName].unserialize(bufferReader, keyValue);
			}

			result.keys[key.name] = keyValue;
		}

		return result;
	}
}

class UseridEnrichment{
	enrichments:any;
	constructor(){
		this.enrichments = [
			'useridWithSteamId'
			, 'useridWithEyePosition'
			, 'useridWithEyeAngles'
		];
	}
	unserialize(bufferReader:BufferReader, keyValue:any) {
		var xuid = bufferReader.readBigUInt64LE().toString();
		var eyeOrigin = [bufferReader.readFloatLE(), bufferReader.readFloatLE(), bufferReader.readFloatLE()];
		var eyeAngles = [bufferReader.readFloatLE(), bufferReader.readFloatLE(), bufferReader.readFloatLE()];
	
		return {
			value: keyValue,
			xuid: xuid,
			eyeOrigin: eyeOrigin,
			eyeAngles: eyeAngles,
		};
	}
}

class EntitynumEnrichment{
	enrichments:any;
	constructor(){
		this.enrichments = [
			'entnumWithOrigin'
			, 'entnumWithAngles'
		];
	}
	unserialize(bufferReader:any, keyValue:any) {
		var origin:number[] = [bufferReader.readFloatLE(), bufferReader.readFloatLE(), bufferReader.readFloatLE()];
		var angles:number[] = [bufferReader.readFloatLE(), bufferReader.readFloatLE(), bufferReader.readFloatLE()];
	
		return {
			value: keyValue,
			origin: origin,
			angles: angles,
		};
	}
}

class GameEventUnserializer{
	enrichments:any;
	knownEvents:any;
	constructor(enrichments:any){
		this.enrichments = enrichments;
		this.knownEvents = {}; // id -> description	
	}
	unserialize(bufferReader:any) {
		var eventId = bufferReader.readInt32LE();
		var gameEvent:any;
		if (0 == eventId) {
			gameEvent = new GameEventDescription(bufferReader);
			this.knownEvents[gameEvent.eventId] = gameEvent;
	
			if (this.enrichments[gameEvent.eventName]) gameEvent.enrichments = this.enrichments[gameEvent.eventName];
		}
		else gameEvent = this.knownEvents[gameEvent!.eventId];
	
		if (undefined === gameEvent) this.unserialize(bufferReader);
	
		return gameEvent.unserialize(bufferReader);
	}
}

////////////////////////////////////////////////////////////////////////////////

class Console extends EventEmitter {
	/*
	if (!(this instanceof console)){
		return new console();
	}
	*/
	
	stdin = process.stdin;
	stdout = process.stdout;
	readlineInterface: any;

	constructor() {
		super();
		var self:any = this;
		this.readlineInterface = readline.createInterface(this.stdin, this.stdout)
		this.stdin = process.stdin;
		this.stdout = process.stdout;
		this.readlineInterface.on('line', function line(data:any) {
			self.emit('line', data);
		})
			.on('close', function close() {
				self.emit('close');
			});
	}
	public print(msg: string): void {
		this.stdout.write(msg + '\n');
	}
	//util.inherits(Console, events.EventEmitter);
}

export default class mirvpgl {
	emitter: EventEmitter;
	private ws:any = null;
	private wsConsole:any;
	private server:http.Server;
	private wss:any;

	public sendcommand(cmd:string){
		if (this.ws) {
			this.ws.send(new Uint8Array(Buffer.from('exec\0' + cmd.trim() + '\0', 'utf8')), { binary: true });
		}
		else{
			this.wsConsole.print("ws is not active");
		}
	}

	constructor(port:number,path_in:string){
		var path:string;
		if(!(path_in.indexOf('\/') == 0)){
			path = "\/" + path_in;
		}
		else {
			path = path_in;
		}
		//console.log(path);
		var self:any = this;
		this.emitter = new EventEmitter();
		this.ws = null;
		this.wsConsole = new Console();
		this.wsConsole.print(`Listening on port ${port}, path ${path} ...`);
		this.server = http.createServer();
		this.server.listen(port);
		this.wss = new WebSocketServer({ server: this.server, path: path });

		this.wsConsole.on('close', function close() {
			if (self.ws) self.ws.close();
			process.exit(0);
		});
		
		this.wsConsole.on('line',(data:string)=> {
			this.sendcommand(data);
		});

		this.wss.on('connection', function (newWs:any) {
			if (self.ws) {
				self.ws.close();
				self.ws = newWs;
			}
		
			self.ws = newWs;
		
			self.wsConsole.print(`${path} connected`);
		
			var gameEventUnserializer = new GameEventUnserializer(enrichments);
		
			self.ws.on('message', function (data:any) {
				if (data instanceof Buffer) {
					var bufferReader:any = new BufferReader(Buffer.from(data));
		
					try {
						while (!bufferReader.eof()) {
							var cmd = bufferReader.readCString();
							//self.wsConsole.print(cmd);
							self.emitter.emit("cmd",cmd)
		
							switch (cmd) {
								case 'hello':
									{
										var version = bufferReader.readUInt32LE();
										//self.wsConsole.print('version = ' + version);
										self.emitter.emit("version",version);
										if (2 != version) throw "Error: version mismatch";
		
										self.ws.send(new Uint8Array(Buffer.from(
											'transBegin\0'
											, 'utf8')), { binary: true });
		
										self.ws.send(new Uint8Array(Buffer.from(
											'exec\0mirv_pgl events enrich clientTime 1\0', 'utf8'
										)), { binary: true });
		
										for (var eventName in enrichments) {
											for (var keyName in enrichments[eventName]) {
												var arrEnrich = enrichments[eventName][keyName].enrichments;
		
												for (var i = 0; i < arrEnrich.length; ++i) {
													self.ws.send(new Uint8Array(Buffer.from(
														`exec\0mirv_pgl events enrich eventProperty "${arrEnrich[i]}" "${eventName}" "${keyName}"\0`
														, 'utf8')), { binary: true });
												}
											}
										}
		
										self.ws.send(new Uint8Array(Buffer.from(
											'exec\0mirv_pgl events enabled 1\0' // enable event
											, 'utf8')), { binary: true });
		
										self.ws.send(new Uint8Array(Buffer.from(
											'transEnd\0'
											, 'utf8')), { binary: true });
									}
									break;
								case 'dataStart':
									break;
								case 'dataStop':
									break;
								case 'levelInit':
									{
										var map = bufferReader.readCString();
										//self.wsConsole.print('map = ' + map);
										self.emitter.emit("map",map)
									}
									break;
								case 'levelShutdown':
									break;
								case 'cam':
									{
										var camdata:any = {}
										camdata.time = bufferReader.readFloatLE();
										camdata.xPosition = bufferReader.readFloatLE();
										camdata.yPosition = bufferReader.readFloatLE();
										camdata.zPosition = bufferReader.readFloatLE();
										camdata.xRotation = bufferReader.readFloatLE();
										camdata.yRotation = bufferReader.readFloatLE();
										camdata.zRotation = bufferReader.readFloatLE();
										camdata.fov = bufferReader.readFloatLE();

										self.emitter.emit("cam",camdata);
									}
									break;
								case 'gameEvent':
									{
										var gameEvent = gameEventUnserializer.unserialize(bufferReader);
										//self.wsConsole.print(JSON.stringify(gameEvent));
										self.emitter.emit("gameEvent",JSON.stringify(gameEvent))
									}
									break;
								default:
									throw "Error: unknown message";
							}
						}
					}
					catch (err) {
						self.wsConsole.print('Error: ' + err.toString() + ' at ' + bufferReader.index + '.');
						self.emitter.emit('error','Error: ' + err.toString() + ' at ' + bufferReader.index + '.')
					}
				}
			});
			self.ws.on('close', function () {
				//self.wsConsole.print('Connection closed!');
				self.emitter.emit('close')
			});
			self.ws.on('error', function (e:any) {
				self.emitter.emit('error',e)
			});
		});
	}
}


var useridEnrichment = new UseridEnrichment();
var entitynumEnrichment = new EntitynumEnrichment();

// ( see https://wiki.alliedmods.net/Counter-Strike:_Global_Offensive_Events )

interface Ievents{
	[userid:string]:UseridEnrichment | EntitynumEnrichment,
}
interface Ienrichments{
	[key:string]:Ievents;
}

var enrichments:Ienrichments = {
	'player_death': {
		'userid': useridEnrichment,
		'attacker': useridEnrichment,
		'assister': useridEnrichment,
	},
	'other_death': {
		'attacker': useridEnrichment,
	},
	'player_hurt': {
		'userid': useridEnrichment,
		'attacker': useridEnrichment,
	},
	'item_purchase': {
		'userid': useridEnrichment,
	},
	'bomb_beginplant': {
		'userid': useridEnrichment,
	},
	'bomb_abortplant': {
		'userid': useridEnrichment,
	},
	'bomb_planted': {
		'userid': useridEnrichment,
	},
	'bomb_defused': {
		'userid': useridEnrichment,
	},
	'bomb_exploded': {
		'userid': useridEnrichment,
	},
	'bomb_pickup': {
		'userid': useridEnrichment,
	},
	'bomb_dropped': {
		'userid': useridEnrichment,
		'entindex': entitynumEnrichment,
	},
	'defuser_dropped': {
		'entityid': entitynumEnrichment,
	},
	'defuser_pickup': {
		'entityid': entitynumEnrichment,
		'userid': useridEnrichment,
	},
	'bomb_begindefuse': {
		'userid': useridEnrichment,
	},
	'bomb_abortdefuse': {
		'userid': useridEnrichment,
	},
	'hostage_follows': {
		'userid': useridEnrichment,
		'hostage': entitynumEnrichment,
	},
	'hostage_hurt': {
		'userid': useridEnrichment,
		'hostage': entitynumEnrichment,
	},
	'hostage_killed': {
		'userid': useridEnrichment,
		'hostage': entitynumEnrichment,
	},
	'hostage_rescued': {
		'userid': useridEnrichment,
		'hostage': entitynumEnrichment,
	},
	'hostage_stops_following': {
		'userid': useridEnrichment,
		'hostage': entitynumEnrichment,
	},
	'hostage_call_for_help': {
		'hostage': entitynumEnrichment,
	},
	'vip_escaped': {
		'userid': useridEnrichment,
	},
	'player_radio': {
		'userid': useridEnrichment,
	},
	'bomb_beep': {
		'entindex': entitynumEnrichment,
	},
	'weapon_fire': {
		'userid': useridEnrichment,
	},
	'weapon_fire_on_empty': {
		'userid': useridEnrichment,
	},
	'grenade_thrown': {
		'userid': useridEnrichment,
	},
	'weapon_outofammo': {
		'userid': useridEnrichment,
	},
	'weapon_reload': {
		'userid': useridEnrichment,
	},
	'weapon_zoom': {
		'userid': useridEnrichment,
	},
	'silencer_detach': {
		'userid': useridEnrichment,
	},
	'inspect_weapon': {
		'userid': useridEnrichment,
	},
	'weapon_zoom_rifle': {
		'userid': useridEnrichment,
	},
	'player_spawned': {
		'userid': useridEnrichment,
	},
	'item_pickup': {
		'userid': useridEnrichment,
	},
	'item_pickup_failed': {
		'userid': useridEnrichment,
	},
	'item_remove': {
		'userid': useridEnrichment,
	},
	'ammo_pickup': {
		'userid': useridEnrichment,
		'index': entitynumEnrichment,
	},
	'item_equip': {
		'userid': useridEnrichment,
	},
	'enter_buyzone': {
		'userid': useridEnrichment,
	},
	'exit_buyzone': {
		'userid': useridEnrichment,
	},
	'enter_bombzone': {
		'userid': useridEnrichment,
	},
	'exit_bombzone': {
		'userid': useridEnrichment,
	},
	'enter_rescue_zone': {
		'userid': useridEnrichment,
	},
	'exit_rescue_zone': {
		'userid': useridEnrichment,
	},
	'silencer_off': {
		'userid': useridEnrichment,
	},
	'silencer_on': {
		'userid': useridEnrichment,
	},
	'buymenu_open': {
		'userid': useridEnrichment,
	},
	'buymenu_close': {
		'userid': useridEnrichment,
	},
	'round_end': {
		'winner': useridEnrichment,
	},
	'grenade_bounce': {
		'userid': useridEnrichment,
	},
	'hegrenade_detonate': {
		'userid': useridEnrichment,
	},
	'flashbang_detonate': {
		'userid': useridEnrichment,
	},
	'smokegrenade_detonate': {
		'userid': useridEnrichment,
	},
	'smokegrenade_expired': {
		'userid': useridEnrichment,
	},
	'molotov_detonate': {
		'userid': useridEnrichment,
	},
	'decoy_detonate': {
		'userid': useridEnrichment,
	},
	'decoy_started': {
		'userid': useridEnrichment,
	},
	'tagrenade_detonate': {
		'userid': useridEnrichment,
	},
	'decoy_firing': {
		'userid': useridEnrichment,
	},
	'bullet_impact': {
		'userid': useridEnrichment,
	},
	'player_footstep': {
		'userid': useridEnrichment,
	},
	'player_jump': {
		'userid': useridEnrichment,
	},
	'player_blind': {
		'userid': useridEnrichment,
		'entityid': entitynumEnrichment,
	},
	'player_falldamage': {
		'userid': useridEnrichment,
	},
	'door_moving': {
		'entityid': entitynumEnrichment,
		'userid': useridEnrichment,
	},
	'spec_target_updated': {
		'userid': useridEnrichment,
	},
	'player_avenged_teammate': {
		'avenger_id': useridEnrichment,
		'avenged_player_id': useridEnrichment,
	},
	'round_mvp': {
		'userid': useridEnrichment,
	},
	'player_decal': {
		'userid': useridEnrichment,
	},

	// ... left out the gg / gungame shit, feel free to add it ...

	'player_reset_vote': {
		'userid': useridEnrichment,
	},
	'start_vote': {
		'userid': useridEnrichment,
	},
	'player_given_c4': {
		'userid': useridEnrichment,
	},
	'player_become_ghost': {
		'userid': useridEnrichment,
	},

	// ... left out the tr shit, feel free to add it ...

	'jointeam_failed': {
		'userid': useridEnrichment,
	},
	'teamchange_pending': {
		'userid': useridEnrichment,
	},
	'ammo_refill': {
		'userid': useridEnrichment,
	},

	// ... left out the dangerzone shit, feel free to add it ...

	// others:

	'weaponhud_selection': {
		'userid': useridEnrichment,
	},
};