import mirvpgl from './mirvpgl';

const config = require("../config")
const client_live = new mirvpgl(config.hlae_server_port_live, config.hlae_server_path_live); 
const client_gotv = new mirvpgl(config.hlae_server_port_gotv, config.hlae_server_path_gotv); 

const kill_delay = config.gotv_delay - config.replay_rec_start_before_kill;
/*
const CSGOGSI = require("node-csgo-gsi");
let gsi = new CSGOGSI({
    port: 4000
});

gsi.on("all", function(data:any) {
	//console.log(data)
});
*/

client_live.emitter.on('gameEvent', (data) => {
	var obj = JSON.parse(data)
	if (obj.name == "player_death") {
		setTimeout(() => {
			var cmd = `spec_player_by_accountid ${obj.keys.attacker.xuid};spec_mode 1`
			console.log(cmd)
			client_gotv.sendcommand(cmd)
			client_live.sendcommand(cmd)
			record_clip()
		//},kill_delay)
		},2)
	}
})

client_live.emitter.on('error', (err) => {
	console.error(err)
})

function record_clip() {
	// VMIX?
	// TODO...
}