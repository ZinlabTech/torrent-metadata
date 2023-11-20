module.exports = {
    apps: [{
        name: "torrent-metadata",
        script: "pnpm",
        args: "start",
        instances: "1",
        exec_mode: "cluster",
    }]
}
