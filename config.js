module.exports = {
    gsi_auth : "SuperUtageGSIAuth", // GSI Auth token
    gotv_delay : 20 , // Delay between live-server and GOTV match,tv_delay - ライブ試合鯖からのGOTV遅延 tv_delay
    killtime_before: 1.5 , // Time to record clip before kill event(sec) - キル発生何秒前かリプレイを保存するか
    hlae_server_port: 31337, // mirv_pgl server port - mirv_pglサーバーのポート番号
    hlae_server_path: "/replay" // mirv_pgl server path - mirv_pglサーバーのパス
}