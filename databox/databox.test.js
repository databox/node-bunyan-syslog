var bunyan = require('bunyan');
var bsyslog = require('bunyan-syslog');

var syslogHost = process.env.RSYSLOG_HOST || "10.240.58.73";
syslogHost = "10.240.0.4";

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

var t = logger('testing');

t.info("Message sent to info");
console.log("---");

t.error(new Error("This is error"));
console.log("---");

t.debug("To je debug");
console.log("---");

t.info({number: 42, id: 11, test: "Demo"}, "Message sent to info");
console.log("---");

// process.exit(0);
