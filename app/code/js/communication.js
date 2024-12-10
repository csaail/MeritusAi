'use strict';
var net = require('net');

var commClient = new net.Socket();

var communication = {
    connectionId: false,
    openRequested: false,
    openCanceled: false,
    bitrate: 0,
    bytesReceived: 0,
    bytesSent: 0,
    failed: 0,
    transmitting: false,
    outputBuffer: [],
    connectionType: 'tcp',
    port:23,
    ipAddress:'192.168.4.1',
    socketOpen:false,
    errorCallback: null,

    connect: function (callback) {
        var self = this;

        commClient.connect(self.port, self.ipAddress, function() {
            self.socketOpen=true;
            console.log('Connected');
            commClient.setKeepAlive(true);
            commClient.setTimeout(50000);
            if(callback)
              callback(self.socketOpen);
        });

    },

    disconnect: function (callback) {
        var self = this;
        var result = 1;

        console.log("Disconnect:" + self.socketOpen);
        if (self.socketOpen) {
            self.emptyOutputBuffer();
            commClient.end();

            commClient.on('end', function() {
                self.socketOpen=false;
                console.log("Socket Disconnected");
            })

            self.connectionId = false;
            self.bitrate = 0;
        } else {
            // connection wasn't opened, so we won't try to close anything
            // instead we will rise canceled flag which will prevent connect from continueing further after being canceled
            self.openCanceled = true;
        }
        if(callback) {
            callback();
        }
    },
    emptyOutputBuffer: function () {
        this.outputBuffer = [];
        this.transmitting = false;
    },

    setErrorCallback: function (callback) {
        self.errorCallback = callback;
    }
};


commClient.on('data', function(data) {
      console.log('Received: ' + data);
      console.log('Bytes Read: ' + commClient.bytesRead);
      consoleDataHandlerObj.read(data);
});

commClient.on('timeout', function() {
    communication.disconnect();
    console.log('Socket TimeOUT' );
});

commClient.on('close', function() {
    self.socketOpen=false;
    console.log("Socket Closed");
});


commClient.on('error', function(ex) {
    alert("Communication With Drone Failed!");
    console.log("handled error");
    console.log(ex);
    self.socketOpen=false;

    if(self.errorCallback) {
      self.errorCallback();
    }
});

commClient.on('end', function() {
    console.log('disconnected from server');
});
