module.exports = {
    gsi_auth : "SuperAuth", // GSI Auth token
    tv_delay : 20 , // Delay between live-server and GOTV match,tv_delay - ライブ試合鯖からのGOTV遅延 tv_delay
    hlae_server_port_live: 3500, // mirv_pgl server port - mirv_pglサーバーのポート番号
    hlae_server_path_live: "/replay_live", // mirv_pgl server path for live - mirv_pglサーバーのパス
    hlae_server_port_gotv: 3501, // mirv_pgl server port - mirv_pglサーバーのポート番号
    hlae_server_path_gotv: "/replay_gotv", // mirv_pgl server path for gotv - mirv_pglサーバーのパス
    replay_rec_start_before_kill: 2000, // Time to MarkIn clip before kill event(ms) - キル発生何秒前かリプレイを保存するか
    replay_rec_end_after_kill : 1500, // Time to MarkOut clip after kill event(ms) - キル発生何秒後までリプレイを保存するか
    vmix_ip : "localhost"  // Vmix Web API host IP
}