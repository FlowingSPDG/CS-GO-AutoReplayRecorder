import * as http from "http";
const config = require("./config")

const gsi_host = "127.0.0.1"
const gsi_port = 3000
//let gsi: any = {};
const gsi_server = http.createServer(function (req, res) {
	if (req.method == 'POST') {
		// console.log("Handling POST request...");
		res.writeHead(200, { 'Content-Type': 'text/html' });

		var body = '';
		req.on('data', function (data) {
			body += data;
		});
		req.on('end', function () {
			// console.log("POST payload: " + body);
			res.end('');
			let jsonobj: any = JSON.parse(body);
			// console.dir(jsonobj);
			if (jsonobj.auth) {
				if (jsonobj.auth.token == config.gsi_auth) {
					if (jsonobj.map) {
						
					}
					else if (jsonobj.player) {

					}
				}
				else {
					console.log('GSI AUTH ERROR');
				}
			}
			else {
				console.log('GSI AUTH ERROR');
			}
		});
	}
	else {
		console.log("Not expecting other request types...");
		res.writeHead(200, { 'Content-Type': 'text/html' });
		var html: string = '<html><body>HTTP Server at http://' + gsi_host + ':' + gsi_port + '</body></html>';
		res.end(html);
	}
});
gsi_server.listen(gsi_port, gsi_host);