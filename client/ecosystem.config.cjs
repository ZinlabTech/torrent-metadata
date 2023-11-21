module.exports = {
    apps: [{
        name: "torrents-metadata-client",
        script: "node_modules/next/dist/bin/next",
        args: "start -p 3032",
        instances: "1",
        exec_mode: "cluster",
    }]
}