'use strict';
var net = require('net');

var client=new net.Socket();

var  socket = {
    connectionId: false,
    openRequested: false,
    openCanceled: false,
    bitrate: 0,
    bytesReceived: 0,
    bytesSent: 0,
    failed: 0,
    transmitting: false,
    outputBuffer: [],
    connectionType: 'tcp', // 'serial' or 'tcp',
    port:23,
    ipAddress:'192.168.4.1',
    socketOpen:false,

    connect: function (callback) {
        var self = this;

        client.connect(self.port, self.ipAddress, function() {

            self.socketOpen=true;
            console.log('Connected');
            client.setKeepAlive(true);
            client.setTimeout(50000);
            if(callback)
            callback(self.socketOpen);
        });

    },

    send: function (data, callback) {
        var self = this;
        this.outputBuffer.push({'data': data, 'callback': callback});

        console.log("data sent isTransmmiting: "+ self.transmitting );

        function send() {
            console.log('send isSocketOpen: '+self.socketOpen);

            if (self.socketOpen) {

            // store inside separate variables in case array gets destroyed
            var data =  Buffer.from( self.outputBuffer[0].data);

            callback = self.outputBuffer[0].callback;

            client.write(data, function (sendInfo) {
                // track sent bytes for statistics
                self.bytesSent = client.bytesWritten;
                console.log('data sent to buffer '+data+ client.bytesWritten);
                // fire callback
                if (callback) callback(sendInfo);

                // remove data for current transmission form the buffer
                self.outputBuffer.shift();

                // if there is any data in the queue fire send immediately, otherwise stop trasmitting
                if (self.outputBuffer.length) {
                    // keep the buffer withing reasonable limits
                    if (self.outputBuffer.length > 100) {
                        var counter = 0;

                        while (self.outputBuffer.length > 100) {
                            self.outputBuffer.pop();
                            counter++;
                        }

                        console.log('SERIAL: Send buffer overflowing, dropped: ' + counter + ' entries');
                    }

                    send();
                } else {
                    self.transmitting = false;
                }
            });


        } else
            self.transmitting = false;
        }

        if (!this.transmitting) {
            this.transmitting = true;
            send();
        }
    },


    sendTest: function(){

          AT.enableBootMode();

          setTimeout(function () {

              AT.setParity(AT_commands.AT_set_even_parity);

              setTimeout(function () {
                //  self.initialize();
              // client.write(new Uint8Array([0x7F,0xFF]));
              STM32_protocol.prototype.initialize();

          }, 1000);


          }, 3000)
    },

    disconnect: function (callback) {
        var self = this;
        var result = 1;

        console.log("Disconnect:"+self.socketOpen);
        if (self.socketOpen) {
            self.emptyOutputBuffer();


             client.end();

            client.on('end', function() {

                self.socketOpen=false;
                console.log("Socket Disconnected");

              //  callback();
            })

            //chromeType.disconnect(this.connectionId);
            self.connectionId = false;
            self.bitrate = 0;
        } else {
            // connection wasn't opened, so we won't try to close anything
            // instead we will rise canceled flag which will prevent connect from continueing further after being canceled
            self.openCanceled = true;
        }
    },
    emptyOutputBuffer: function () {
        this.outputBuffer = [];
        this.transmitting = false;
    }
};


client.on('data', function(data) {

  STM32.read(data);
});

client.on('timeout', function() {
  reset_progressBar();
  alert("Communication With Drone Failed!");
  socket.disconnect();
  console.log('Socket TimeOUT' );
});


client.on('close', function() {

  self.socketOpen=false;
  console.log("Socket Closed");
});


client.on('error', function(ex) {

    reset_progressBar();
    alert("Communication With Drone Failed!");
    console.log("handled error");
    console.log(ex);
});

client.on('end', function() {
    console.log('disconnected from server');
});
