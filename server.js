"use strict";

var express = require('express'),
    Counter = require('./'),
    mambo = require('mambo'),
    junto = require('junto'),
    nurse = require('nurse'),
    Schema = mambo.Schema,
    StringField = mambo.StringField,
    NumberField = mambo.NumberField;

var counterSchema = new Schema('Counterman', 'counter', 'id', {
    'id': StringField,
    'last_count': NumberField
});

var Model = new mambo.Model(counterSchema);
Model.save = function(id, count, cb){
    this.update('counter', id)
        .set({'last_count': count})
        .commit()
        .then(function(){
            cb();
        });
};

Model.latest = function(id, cb){
    var self = this;
    self.get('counter', id).then(function(c){
        if(!c){
            self.insert('counter')
                .set({'id': id, 'last_count': '1'})
                .commit()
                .then(function(){
                    cb(1);
                });
        }
        else{
            cb(c.last_count);
        }
    });
};


var app = express(),
    counter,
    serviceName = process.env.SERVICE_NAME || 'randomcounter',
    nodeEnv = process.env.NODE_ENV || 'development',
    name = serviceName + "-" + nodeEnv,
    server;

junto(process.env.NODE_ENV).then(function(config){
    Model.connect(config.aws.key, config.aws.secret);

    counter = new Counter(name,
        function(counter, cb){
            Model.latest(name, function(v){
                cb(v);
            });
        },
        function(counter, val, cb){
            Model.save(name, val, function(){
                cb(val);
            });
        }
    );

    counter.on('ready', function(){
        server = app.listen(8080, function(){
            console.log("Counter " + name + " listening on 8080");
        });
    });
    counter.start();
});

app.configure(function(){
    app.use(app.router);
});

app.get('/health-check', function(req, res){
    res.send(nurse({'ok': true, 'server': server}));
});

app.get('/', function(req, res){
    res.send(""+counter.last);
});

app.post('/', function(req, res){
    counter.allocate(function(id){
        res.send(""+id);
    });
});

var shutdown = function(){
    counter.persist(function(){
        console.log('Persisted.  Goodbye.');
        process.exit(0);
    });
};

process.on('SIGINT', shutdown);
process.on('SIGQUIT', shutdown);
process.on('SIGTERM', shutdown);