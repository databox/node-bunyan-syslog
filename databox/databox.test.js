var bunyan = require('bunyan');
var bsyslog = require('bunyan-syslog');

var syslogHost = process.env.RSYSLOG_HOST || "10.240.58.73";

var logger = function (name) {
    return bunyan.createLogger({
        name: name,
        src: false,
        streams: [
            {
                level: 'debug',
                type: 'raw',
                stream: bsyslog.createBunyanStream({
                    type: 'udp',
                    facility: bsyslog.facility.local0,
                    host: syslogHost,
                    port: 6000
                })
            },
            {
                level: 'info',
                stream: process.stdout
            }, {
                level: 'error',
                stream: process.stderr
            }
        ]
    });
};

// module.exports = logger;

var t = logger('testing');

t.info("XXXX This is test");

// process.exit(1);

// t.info({name: "John", lastName: "Smith", value: "XXXX"});
// t.info({x: "Done", number: 123123, value: "XXXX"}, "Another test XXXX");
