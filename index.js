"use strict";
var fs = require('fs'),
    express = require("express"),
    nconf = require('nconf');

nconf
    .argv()
    .env()
    .use('memory');


nconf.defaults({
    'name': 'counter',
    'port': 49999,
    'file': 'config.json'
});

nconf.file(nconf.get('file'));


function Counter(name){
    this.last = 0;
    this.path = name + ".counter";
    this.queue = [];
    this.working = false;
    this.lockFilePath = "/tmp/counterman." + name + ".lock";

    if(fs.existsSync(this.lockFilePath)){
        throw new Error('Lock file at ' + this.lockFilePath + ' exists!  Wont start until you remove it.');
    }
    fs.writeFileSync(this.lockFilePath, '1');

    if(fs.existsSync(this.path)){
        this.last = Number(fs.readFileSync(this.path));
    }

    var self = this,
        queueCallback = function(){};

    this.persistInterval = setInterval(function(){
        self.persist();
    }, 10000);

    this.loopInterval = setInterval(function(){
        if(self.queue.length > 0 && self.working === false){
            self.working = true;
            while(queueCallback = self.queue.shift()){
                self.last++;
                queueCallback(self.last);
            }
            self.working = false;
        }
    }, 1);
    console.log('COUNTERMAN for ' + name + ' ready! Last is ' + this.last);
}

Counter.prototype.allocate = function(cb){
    this.queue.push(cb);
};

Counter.prototype.persist = function(cb){
    fs.writeFile(this.path, "" + this.last, function(err){
        if(cb){
            cb(err);
        }
    });
};

Counter.prototype.close = function(){
    clearInterval(this.persistInterval);
    clearInterval(this.loopInterval);

    // Clear lock file
    fs.unlinkSync(this.lockFilePath);
};

var app = express(),
    port = nconf.get('port'),
    counter = new Counter(nconf.get('name'));

app.configure(function(){
    app.use(app.router);
});

app.get('/', function(req, res){
    res.send(""+counter.last);
});

app.post('/', function(req, res){
    counter.allocate(function(id){
        res.send(""+id);
    });
});

app.listen(port, function(){
    console.log('COUNTERMAN for '+ nconf.get('name') +' listening on ' + port);
});

var shutdown = function(){
    counter.persist(function(){
        counter.close();
        process.exit(0);
    });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);