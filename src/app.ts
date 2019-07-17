import * as http from "http";
import mirvpgl from './mirvpgl';

const config = require("../config")
const pgl = new mirvpgl(config.hlae_server_port, config.hlae_server_path); 

const CSGOGSI = require("node-csgo-gsi");
let gsi = new CSGOGSI();
gsi.on("event", function() {
 
});