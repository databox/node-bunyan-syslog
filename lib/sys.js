'use strict';

// Copyright 2013 Mark Cavage, Inc.  All rights reserved.

var dgram = require('dgram');
var os = require('os');
var Stream = require('stream').Stream;
var util = require('util');

var assert = require('assert-plus');

var binding = require('../build/Release/syslog');


///--- Globals

var sprintf = util.format;

var HOSTNAME = os.hostname();

// Harcoded from https://github.com/trentm/node-bunyan so this module
// can have minimal dependencies
var bunyan = {
    FATAL: 60,
    ERROR: 50,
    WARN: 40,
    INFO: 30,
    DEBUG: 20,
    TRACE: 10,

    safeCycles: function safeCycles() {
        var seen = [];

        function bunyanCycles(k, v) {
            if (!v || typeof (v) !== 'object') {
                return (v);
            }
            if (seen.indexOf(v) !== -1) {
                return ('[Circular]');
            }
            seen.push(v);
            return (v);
        }

        return (bunyanCycles);
    }
};


// Syslog Levels
var LOG_EMERG = 0;
var LOG_ALERT = 1;
var LOG_CRIT = 2;
var LOG_ERR = 3;
var LOG_WARNING = 4;
var LOG_NOTICE = 5;
var LOG_INFO = 6;
var LOG_DEBUG = 7;


///--- Helpers

// Translates a Bunyan level into a syslog level
function level(l) {
    var sysl;

    switch (l) {
        case bunyan.FATAL:
            sysl = LOG_EMERG;
            break;

        case bunyan.ERROR:
            sysl = LOG_ERR;
            break;

        case bunyan.WARN:
            sysl = LOG_WARNING;
            break;

        case bunyan.INFO:
            sysl = LOG_INFO;
            break;

        default:
            sysl = LOG_DEBUG;
            break;
    }

    return (sysl);
}

function monologLevelNumber(l) {
    /*
     Bunyan:
     FATAL: 60,
     ERROR: 50,
     WARN: 40,
     INFO: 30,
     DEBUG: 20,
     TRACE: 10,

     PHP:
     const DEBUG = 100;
     const INFO = 200;
     const NOTICE = 250;
     const WARNING = 300;
     const ERROR = 400;
     const CRITICAL = 500;
     const ALERT = 550;
     const EMERGENCY = 600;
     */

    var out;
    switch (l) {
        case bunyan.FATAL:
            out = ['EMERGENCY', 600];
            break;

        case bunyan.ERROR:
            out = ['ERROR', 400];
            break;

        case bunyan.WARN:
            out = ['WARNING', 300];
            break;

        case bunyan.INFO:
            out = ['INFO', 200];
            break;

        case bunyan.TRACE:
            out = ['DEBUG', 100];
            break;

        default: // DEBUG
            out = ['DEBUG', 100];
            break;
    }

    return out;
}


function time(t) {
    return (new Date(t).toJSON());
}

function time2(t) {
    return (new Date(t)).toISOString().replace('T', ' ').substr(0, 19);
}


///--- API

function SyslogStream(opts) {
    assert.object(opts, 'options');
    assert.optionalNumber(opts.facility, 'options.facility');
    assert.optionalString(opts.name, 'options.name');

    Stream.call(this);

    this.facility = opts.facility || 1;
    this.name = opts.name || process.title || process.argv[0];
    this.writable = true;

    if (this.constructor.name === 'SyslogStream') {
        binding.openlog(this.name, binding.LOG_CONS, 0);
        process.nextTick(this.emit.bind(this, 'connect'));
    }
}
util.inherits(SyslogStream, Stream);
module.exports = SyslogStream;


// Overriden by TCP/UDP
SyslogStream.prototype.close = function close() {
    binding.closelog();
};


SyslogStream.prototype.destroy = function destroy() {
    this.writable = false;
    this.close();
};


SyslogStream.prototype.end = function end() {
    if (arguments.length > 0)
        this.write.apply(this, Array.prototype.slice.call(arguments));

    this.writable = false;
    this.close();
};


SyslogStream.prototype.write = function write(r) {
    if (!this.writable)
        throw new Error('SyslogStream has been ended already');

    var h;
    var l;
    var m;
    var t;

    if (Buffer.isBuffer(r)) {
        // expensive, but not expected
        m = r.toString('utf8');
    } else if (typeof (r) === 'object') {
        h = r.hostname;
        l = level(r.level);
        t = time(r.time);

        var monologLevel = monologLevelNumber(r.level);
        r.pid = process.pid;
        r.name = this.name;

        var v = {context: {}};
        v.message = r.hasOwnProperty('msg') ? r.msg : r.hasOwnProperty('message') ? r.message : r.name;
        v.context = r;
        v.level = monologLevel[1];
        v.level_name = monologLevel[0];
        v.channel = this.name;
        v.datetime = {
            date: time2(r.time),
            timezone_type: 3,
            timezone: "UTC"
        };

        if (v.context.hasOwnProperty('level')) {
            delete v.context.level;
        }

        if (v.context.hasOwnProperty('msg')) {
            delete v.context.msg;
        }

        v.extra = [];

        m = JSON.stringify(v, bunyan.safeCycles());
    } else if (typeof (r) === 'string') {
        m = r;
    } else {
        throw new TypeError('record (Object) required');
    }

    l = (this.facility * 8) + (l !== undefined ? l : level(bunyan.INFO));

    var hdr = sprintf('<%d>1 ', l);

    if (this._send) {
        var str = hdr + m;
        this._send(str);
        console.log(str);
        console.log();
        str = null;
    } else {
        binding.syslog(l, m);
    }
};


SyslogStream.prototype.toString = function toString() {
    var str = '[object SyslogStream<facility=' + this.facility;
    if (this.host)
        str += ', host=' + this.host;
    if (this.port)
        str += ', port=' + this.port;
    if (!/^Sys/.test(this.constructor.name)) {
        str += ', proto=' +
            (/UDP/.test(this.constructor.name) ? 'udp' : 'tcp');
    }
    str += '>]';

    return (str);
};
