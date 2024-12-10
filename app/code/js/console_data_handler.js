'use strict';


const IDLE = 0, HEADER_START = 1, HEADER_M = 2, HEADER_ARROW = 3, HEADER_SIZE = 4, HEADER_CMD = 5, HEADER_ERR = 6, HEADER_D= 7,  HEADER_D_SIZE=8;

var consoleDataHandler = function () {

  this.c_state = IDLE;
  this.err_rcvd = false;
  this.offset = 0;
  this.dataSize = 0;
  this.checksum = 0;
  this.debugString = [];
  this.receive_buffer = [];
};

consoleDataHandler.prototype.read = function (readData) {

  console.log("consoleDataHandler read");

    var data = new Uint8Array(readData);

    for (var i = 0; i < data.length; i++) {
        this.receive_buffer.push(data[i]);
    }

    var data = this.receive_buffer.slice(0, this.receive_buffer.length); // bytes requested
    this.receive_buffer.splice(0, this.receive_buffer.length); // remove read bytes
    this.processData(data);
};


// initialize object
var consoleDataHandlerObj = new consoleDataHandler();

consoleDataHandler.prototype.processData = function (data) {
  var data = new Uint8Array(data);

      for (var i = 0; i < data.length; i++) {

        if (this.c_state == IDLE) {
             this.c_state = (data[i] == 36) ? HEADER_START : IDLE;
             console.log("c state idle" + data[i]);

         } else if (this.c_state == HEADER_START) {
             this.c_state = (data[i] == 77) ? HEADER_M : IDLE;
             if(data[i] == 68)
            	 this.c_state =HEADER_D;

              console.log("c state HEADER_START" + this.c_state);
         } else if (this.c_state == HEADER_M) {
             if (data[i] == 62) {
                 this.c_state = HEADER_ARROW;
             } else if (data[i] == 33) {
                 this.c_state = HEADER_ERR;
             } else {
                 this.c_state = IDLE;
             }
         } else if (this.c_state == HEADER_ARROW || this.c_state == HEADER_ERR) {
				/* is this an error message? */
             this.err_rcvd = (this.c_state == HEADER_ERR); /*
													 * now we are expecting the
													 * payload size
													 */
             this.dataSize = (data[i] & 0xFF);

				/* reset index variables */
             this.offset = 0;
             this.checksum = 0;
             this.checksum ^= (data[i] & 0xFF);
				/* the command is to follow */
             this.c_state = HEADER_SIZE;
         } else if (this.c_state == HEADER_SIZE) {
             this.checksum ^= (data[i] & 0xFF);
             this.c_state = HEADER_CMD;
         } else if (this.c_state == HEADER_CMD && this.offset < this.dataSize) {
             this.checksum ^= (data[i] & 0xFF);
             console.log("adding data");
             this.offset++;

         } else if (this.c_state == HEADER_CMD && this.offset >= this.dataSize) {
				/* compare calculated and transferred checksum */
        	   console.log("checksum compare");

             if ((this.checksum & 0xFF) == (data[i] & 0xFF)) {
                 if (this.err_rcvd) {
                	 console.log("protocol error");
                 } else {
				        	 console.log("evaluating command");
                 }
             } else {
            	   console.log("checksome error");
              }
             this.c_state = IDLE;         }
         else if(this.c_state == HEADER_D)
         {

        	    this.dataSize = (data[i] & 0xFF);

        		/* reset index variables */
              this.offset = 0;
              this.checksum = 0;
              this.checksum ^= (data[i] & 0xFF);
 				/* the command is to follow */
              this.c_state = HEADER_D_SIZE;
         }
         else if( this.c_state == HEADER_D_SIZE && this.offset < this.dataSize)
         {
        	  this.checksum ^= (data[i] & 0xFF);
        	  this.debugString.push(String.fromCharCode(data[i]));
        	  this.offset++;
         }
         else if( this.c_state == HEADER_D_SIZE && this.offset >= this.dataSize)
         {
        	 if ((this.checksum & 0xFF) == (data[i] & 0xFF)) {
                 if (this.err_rcvd) {

                 } else {

                	 if(this.debugString[0] !='~')
                	 {
                        var command_log = $('div#log');
                        var d = new Date();
                        var date = d.toISOString().substring(0, 10);
                        var time = d.toLocaleTimeString();
                        var formattedDate = [date, time].join(' @ ');

                        $('div.wrapper', command_log).append('<p>' + formattedDate + ' -- ' + this.debugString.join("") + '</p>');
                        command_log.scrollTop($('div.wrapper', command_log).height());
                  }

               }
           }
        	 else
        	 {
        		   console.log("Checksum Error");
        	 }

        	  this.c_state = IDLE;
        	  this.debugString.splice(0,this.debugString.length)
         }
     }
}
