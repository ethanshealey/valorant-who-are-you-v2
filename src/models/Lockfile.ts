export default class Lockfile {
    name: string;
    pid: string;
    port: string;
    password: string;
    protocol: string;
    version: string;
    region: string;
    shard: string;


    constructor(
        name: string,
        pid: string,
        port: string,
        password: string,
        protocol: string,
        version: string,
        region: string,
        shard: string
    ){
        this.name = name;
        this.pid = pid;
        this.port = port;
        this.password = password;
        this.protocol = protocol;
        this.version = version;
        this.region = region;
        this.shard = shard;
    }

}