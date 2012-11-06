"use strict";
var fs = require('fs'),
    EventEmitter = require('events').EventEmitter,
    util = require('util');


function Counter(name, initHandler, persistHandler){
    this.last = 0;
    this.persistHandler = persistHandler || function(counter, val, cb){
        fs.writeFile(counter.name + ".counter", "" + val, function(err){
            if(cb){
                cb(err);
            }
        });
    };
    this.initHandler = initHandler || function(counter, cb){
        fs.readFile(counter.path, function(err, data){
            cb(Number(data));
        });
    };

    this.queue = [];
    this.working = false;
}
util.inherits(Counter, EventEmitter);

Counter.prototype.start = function(){
    var self = this;
    function loop(){
        self.persistInterval = setInterval(function(){
            self.persist();
        }, 10000);

        self.loopInterval = setInterval(function(){
            self.processQueue();
        }, 1);
    }

    this.initHandler(this, function(id){
        self.last = id;
        self.emit('ready');
        loop();
    });
};

Counter.prototype.allocate = function(cb){
    this.queue.push(cb);
};

Counter.prototype.processQueue = function(){
    var queueCallback = function(){};
    if(this.queue.length > 0 && this.working === false){
        this.working = true;
        while(queueCallback = this.queue.shift()){
            this.last++;
            queueCallback(this.last);
        }
        this.working = false;
    }
};

Counter.prototype.persist = function(cb){
    this.persistHandler(this, this.last, function(err){
        if(cb){
            cb(err);
            this.emit('persist', err);
        }
    }.bind(this));
};

module.exports = Counter;