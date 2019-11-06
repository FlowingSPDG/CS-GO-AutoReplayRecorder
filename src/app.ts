import mirvpgl from './mirvpgl';
const { Connection } = require('vmix-js-utils')

const config = require("../config")
const client_live = new mirvpgl(config.hlae_server_port_live, config.hlae_server_path_live); 
const client_gotv = new mirvpgl(config.hlae_server_port_gotv, config.hlae_server_path_gotv); 
const vmix = new Connection(config.vmix_ip)

const kill_delay = (config.tv_delay *1000) - config.replay_rec_start_before_kill;

client_live.emitter.on('gameEvent', (data) => {
	var obj = JSON.parse(data)
	if (obj.name == "player_death") {
		setTimeout(() => {
			var cmd = `spec_player_by_accountid ${obj.keys.attacker.xuid};spec_mode 1`
			console.log(cmd)
			client_gotv.sendcommand(cmd)
			record_clip(config.replay_rec_end_after_kill)
		//},kill_delay)
		},2000) //2sec
	}
})

client_live.emitter.on('error', (err) => {
	console.error(err)
})

let onSuccess = function (response:any) {
    console.log('Performed command', response)
}
let onError = function (error:any) {
	console.log('Could not perform command', error)
}
   

function record_clip(markout:number) {
	vmix.send({ Function: 'ReplayLive' }, onSuccess, onError)
	vmix.send({ Function: 'ReplayMarkIn' }, onSuccess, onError)
	setTimeout(() => {
		vmix.send({ Function: 'ReplayMarkOut' }, onSuccess, onError)
	},markout)
}