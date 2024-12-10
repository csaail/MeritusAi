/*
    STM32 F103 serial bus seems to properly initialize with quite a huge auto-baud range
    From 921600 down to 1200, i don't recommend getting any lower then that
    Official "specs" are from 115200 to 1200

    popular choices - 921600, 460800, 256000, 230400, 153600, 128000, 115200, 57600, 38400, 28800, 19200
*/
'use strict';



var STM32_protocol = function () {
    this.baud;
    this.options = {};
    this.callback; // ref
    this.hex; // ref
    this.verify_hex;

    this.receive_buffer=[];

    this.bytes_to_read; // ref
    this.read_callback; // ref

    this.upload_time_start;
    this.upload_process_alive;

    this.status = {
        ACK: 0x79, // y
        NACK: 0x1F
    };

    this.command = {
        get: 0x00, // Gets the version and the allowed commands supported by the current version of the bootloader
        get_ver_r_protect_s: 0x01, // Gets the bootloader version and the Read Protection status of the Flash memory
        get_ID: 0x02, // Gets the chip ID
        read_memory: 0x11, // Reads up to 256 bytes of memory starting from an address specified by the application
        go: 0x21, // Jumps to user application code located in the internal Flash memory or in SRAM
        write_memory: 0x31, // Writes up to 256 bytes to the RAM or Flash memory starting from an address specified by the application
        erase: 0x43, // Erases from one to all the Flash memory pages
        extended_erase: 0x44, // Erases from one to all the Flash memory pages using two byte addressing mode (v3.0+ usart).
        write_protect: 0x63, // Enables the write protection for some sectors
        write_unprotect: 0x73, // Disables the write protection for all Flash memory sectors
        readout_protect: 0x82, // Enables the read protection
        readout_unprotect: 0x92  // Disables the read protection
    };

    // Erase (x043) and Extended Erase (0x44) are exclusive. A device may support either the Erase command or the Extended Erase command but not both.

    this.available_flash_size = 0;
    this.page_size = 0;
    this.useExtendedErase = false;
};

// no input parameters
STM32_protocol.prototype.connect = function (hex) {

    var self = this;

    self.hex = hex;
    self.read_callback=initFunction;

    update_progressbar(10);

    socket.connect(function(result){


        console.log('In FlashCode connect Callback');

        if(result) {
        console.log('##Connected');

        AT.enableBootMode();

        setTimeout(function () {

            AT.setParity(AT_commands.AT_set_even_parity);

            setTimeout(function () {
                self.initialize();
            }, 1000);

        }, 4000)

        }
        else
        console.log('## Cant Connected');
       });



};

// initialize certain variables and start timers that oversee the communication
STM32_protocol.prototype.initialize = function () {
    var self = this;

    // reset and set some variables before we start
    self.receive_buffer = [];
    self.verify_hex = [];

    self.upload_time_start = new Date().getTime();
    self.upload_process_alive = false;

    self.bytes_to_read = 20;
    self.upload_procedure(1);
};

// no input parameters
// this method should be executed every 1 ms via interval timer
STM32_protocol.prototype.read = function (readData) {
    // routine that fills the buffer

    var data = new Uint8Array(readData);


    for (var i = 0; i < data.length; i++) {
        this.receive_buffer.push(data[i]);
    }

    // routine that fetches data from buffer if statement is true
    if (this.receive_buffer.length >= this.bytes_to_read && this.bytes_to_read != 0) {
        var data = this.receive_buffer.slice(0, this.bytes_to_read); // bytes requested
        this.receive_buffer.splice(0, this.bytes_to_read); // remove read bytes

        this.bytes_to_read = 0; // reset trigger
        this.read_callback(data);
  //  }
}

};

// we should always try to consume all "proper" available data while using retrieve
STM32_protocol.prototype.retrieve = function (n_bytes, callback) {
  //  console.log('Retreive ...#11');

    if (this.receive_buffer.length >= n_bytes) {
        // data that we need are there, process immediately
        var data = this.receive_buffer.slice(0, n_bytes);
        this.receive_buffer.splice(0, n_bytes); // remove read bytes
        callback(data);
    } else {
        // still waiting for data, add callback
        this.bytes_to_read = n_bytes;
        this.read_callback = callback;
    }
};

// Array = array of bytes that will be send over serial
// bytes_to_read = received bytes necessary to trigger read_callback
// callback = function that will be executed after received bytes = bytes_to_read
STM32_protocol.prototype.send = function (Array, bytes_to_read, callback) {

   // console.log("Sending Data");

    // flip flag
    this.upload_process_alive = true;

    var bufferOut = new ArrayBuffer(Array.length);
    var bufferView = new Uint8Array(bufferOut);

    // set Array values inside bufferView (alternative to for loop)
    bufferView.set(Array);

    // update references
    this.bytes_to_read = bytes_to_read;
    this.read_callback = callback;

    // empty receive buffer before next command is out
    this.receive_buffer = [];

    // send over the actual data
    socket.send(bufferOut, function (writeInfo) {
    });
};

// val = single byte to be verified
// data = response of n bytes from mcu (array)
// result = true/false
STM32_protocol.prototype.verify_response = function (val, data) {
    var self = this;

    if (val != data[0]) {
        var message = 'STM32 Communication failed, wrong response, expected: ' + val + ' (0x' + val.toString(16) + ') received: ' + data[0] + ' (0x' + data[0].toString(16) + ')';
        console.error(message);

        const options = {
          type: 'error',
          title: 'NXGBlocks',
          message: 'Firmware Flashing Failed, Try Again!',
        };

        dialog.showMessageBox(null, options);

        this.upload_procedure(99);

        return false;
    }
  //  console.log("Exiting verify response");
    return true;
};

// input = 16 bit value
// result = true/false
STM32_protocol.prototype.verify_chip_signature = function (signature) {
    switch (signature) {
        case 0x412: // not tested
            console.log('Chip recognized as F1 Low-density');
            break;
        case 0x410:
            console.log('Chip recognized as F1 Medium-density');
            this.available_flash_size = 131072;
            this.page_size = 1024;
            break;
        case 0x414: // not tested
            console.log('Chip recognized as F1 High-density');
            break;
        case 0x418: // not tested
            console.log('Chip recognized as F1 Connectivity line');
            break;
        case 0x420:  // not tested
            console.log('Chip recognized as F1 Medium-density value line');
            break;
        case 0x428: // not tested
            console.log('Chip recognized as F1 High-density value line');
            break;
        case 0x430: // not tested
            console.log('Chip recognized as F1 XL-density value line');
            break;
        case 0x416: // not tested
            console.log('Chip recognized as L1 Medium-density ultralow power');
            break;
        case 0x436: // not tested
            console.log('Chip recognized as L1 High-density ultralow power');
            break;
        case 0x427: // not tested
            console.log('Chip recognized as L1 Medium-density plus ultralow power');
            break;
        case 0x411: // not tested
            console.log('Chip recognized as F2 STM32F2xxxx');
            break;
        case 0x440: // not tested
            console.log('Chip recognized as F0 STM32F051xx');
            break;
        case 0x444: // not tested
            console.log('Chip recognized as F0 STM32F050xx');
            break;
        case 0x413: // not tested
            console.log('Chip recognized as F4 STM32F40xxx/41xxx');
            break;
        case 0x419: // not tested
            console.log('Chip recognized as F4 STM32F427xx/437xx, STM32F429xx/439xx');
            break;
        case 0x432: // not tested
            console.log('Chip recognized as F3 STM32F37xxx, STM32F38xxx');
            break;
        case 0x422:
            console.log('Chip recognized as F3 STM32F30xxx, STM32F31xxx');
            this.available_flash_size = 0x40000;
            this.page_size = 2048;
            break;
    }

    if (this.available_flash_size > 0) {
        if (this.hex.bytes_total < this.available_flash_size) {
            return true;
        } else {
            console.log('Supplied hex is bigger then flash available on the chip, HEX: ' + this.hex.bytes_total + ' bytes, limit = ' + this.available_flash_size + ' bytes');

            return false;
        }
    }

    console.log('Chip NOT recognized: ' + signature);

    return false;
};

// first_array = usually hex_to_flash array
// second_array = usually verify_hex array
// result = true/false
STM32_protocol.prototype.verify_flash = function (first_array, second_array) {
    for (var i = 0; i < first_array.length; i++) {
        if (first_array[i] != second_array[i]) {
            console.log('Verification failed on byte: ' + i + ' expected: 0x' + first_array[i].toString(16) + ' received: 0x' + second_array[i].toString(16));

            const options = {
              type: 'error',
              title: 'NXGBlocks',
              message: 'Firmware Flashing Failed, Try Again!',
            };

            dialog.showMessageBox(null, options);

            return false;
        }
    }

    console.log('Verification successful, matching: ' + first_array.length + ' bytes');

    return true;
};

// step = value depending on current state of upload_procedure
STM32_protocol.prototype.upload_procedure = function (step) {
    var self = this;

    switch (step) {
        case 1:
            // initialize serial interface on the MCU side, auto baud rate settings

            update_progressbar(5);

            var send_counter = 0;

                self.send([0x7F], 1, function (reply) {

                    if (reply[0] == 0x7F || reply[0] == self.status.ACK || reply[0] == self.status.NACK) {
                        console.log('STM32 - Serial interface initialized on the MCU side');
                        self.upload_procedure(2);
                    } else {
                        const options = {
                          type: 'error',
                          title: 'NXGBlocks',
                          message: 'Firmware Flashing Failed, Try Again!',
                        };

                        dialog.showMessageBox(null, options);
                        self.upload_procedure(99);
                    }
                });

            break;
        case 2:
            // get version of the bootloader and supported commands

            update_progressbar(5);

            self.send([self.command.get, 0xFF], 2, function (data) { // 0x00 ^ 0xFF
                if (self.verify_response(self.status.ACK, data)) {
                    self.retrieve(data[1] + 1 + 1, function (data) { // data[1] = number of bytes that will follow [– 1 except current and ACKs]
                        console.log('STM32 - Bootloader version: ' + (parseInt(data[0].toString(16)) / 10).toFixed(1)); // convert dec to hex, hex to dec and add floating point
                        self.useExtendedErase = (data[7] == self.command.extended_erase);
                        // proceed to next step
                        self.upload_procedure(3);
                    });
                }
                else {
                    const options = {
                      type: 'error',
                      title: 'NXGBlocks',
                      message: 'Firmware Flashing Failed, Try Again!',
                    };

                    dialog.showMessageBox(null, options);
                    self.upload_procedure(99);
                }
            });
            break;
        case 3:

                update_progressbar(5);

            self.send([self.command.get_ID, 0xFD], 2, function (data) { // 0x01 ^ 0xFF
                if (self.verify_response(self.status.ACK, data)) {
                    self.retrieve(data[1] + 1 + 1, function (data) { // data[1] = number of bytes that will follow [– 1 (N = 1 for STM32), except for current byte and ACKs]
                        var signature = (data[0] << 8) | data[1];
                        console.log('STM32 - Signature: 0x' + signature.toString(16)); // signature in hex representation

                        if (self.verify_chip_signature(signature)) {
                            // proceed to next step
                            self.upload_procedure(4);
                        } else {
                            // disconnect
                            const options = {
                              type: 'error',
                              title: 'NXGBlocks',
                              message: 'Firmware Flashing Failed, Try Again!',
                            };

                            dialog.showMessageBox(null, options);
                            self.upload_procedure(99);
                        }
                    });
                }
            });
            break;
        case 4:

                update_progressbar(5);

            if (self.useExtendedErase) {
                if (self.options.erase_chip) {

                    var message = 'Executing global chip erase (via extended erase)';
                    console.log(message);
                  //  $('span.progressLabel').text(message + ' ...');

                    self.send([self.command.extended_erase, 0xBB], 1, function (reply) {
                        if (self.verify_response(self.status.ACK, reply)) {
                            self.send([0xFF, 0xFF, 0x00], 1, function (reply) {
                                if (self.verify_response(self.status.ACK, reply)) {
                                    console.log('Executing global chip extended erase: done');
                                    self.upload_procedure(5);
                                }
                            });
                        }
                    });

                } else {
                    var message = 'Executing local erase (via extended erase)';
                    console.log(message);

                    self.send([self.command.extended_erase, 0xBB], 1, function (reply) {
                        if (self.verify_response(self.status.ACK, reply)) {

                            // For reference: https://code.google.com/p/stm32flash/source/browse/stm32.c#723

                            var max_address = self.hex.data[self.hex.data.length - 1].address + self.hex.data[self.hex.data.length - 1].bytes - 0x8000000,
                                erase_pages_n = Math.ceil(max_address / self.page_size),
                                buff = [],
                                checksum = 0;

                            var pg_byte;

                            pg_byte = (erase_pages_n - 1) >> 8;
                            buff.push(pg_byte);
                            checksum ^= pg_byte;
                            pg_byte = (erase_pages_n - 1) & 0xFF;
                            buff.push(pg_byte);
                            checksum ^= pg_byte;

                            for (var i = 0; i < erase_pages_n; i++) {
                                pg_byte = i >> 8;
                                buff.push(pg_byte);
                                checksum ^= pg_byte;
                                pg_byte = i & 0xFF;
                                buff.push(pg_byte);
                                checksum ^= pg_byte;
                            }

                            buff.push(checksum);

                              console.log('max_address' +max_address);
                            console.log('Erasing. pages: 0x00 - 0x' + erase_pages_n.toString(16) + ', checksum: 0x' + checksum.toString(16));

                            self.send(buff, 1, function (reply) {
                                if (self.verify_response(self.status.ACK, reply)) {
                                    console.log('Erasing: done');
                                    // proceed to next step
                                    self.upload_procedure(5);
                                }
                            });
                        }
                    });

                }
                break;
            }

            if (self.options.erase_chip) {
                var message = 'Executing global chip erase';
                console.log(message);
                $('span.progressLabel').text(message + ' ...');

                self.send([self.command.erase, 0xBC], 1, function (reply) { // 0x43 ^ 0xFF
                    if (self.verify_response(self.status.ACK, reply)) {
                        self.send([0xFF, 0x00], 1, function (reply) {
                            if (self.verify_response(self.status.ACK, reply)) {
                                console.log('Erasing: done');
                                // proceed to next step
                                self.upload_procedure(5);
                            }
                        });
                    }
                });
            } else {
                var message = 'Executing local erase';
                console.log(message);
                $('span.progressLabel').text(message + ' ...');

                self.send([self.command.erase, 0xBC], 1, function (reply) { // 0x43 ^ 0xFF
                    if (self.verify_response(self.status.ACK, reply)) {
                        // the bootloader receives one byte that contains N, the number of pages to be erased – 1
                        var max_address = self.hex.data[self.hex.data.length - 1].address + self.hex.data[self.hex.data.length - 1].bytes - 0x8000000,
                            erase_pages_n = Math.ceil(max_address / self.page_size),
                            buff = [],
                            checksum = erase_pages_n - 1;

                        buff.push(erase_pages_n - 1);

                        for (var i = 0; i < erase_pages_n; i++) {
                            buff.push(i);
                            checksum ^= i;
                        }

                        buff.push(checksum);

                        self.send(buff, 1, function (reply) {
                            if (self.verify_response(self.status.ACK, reply)) {
                                console.log('Erasing: done');
                                // proceed to next step
                                self.upload_procedure(5);
                            }
                        });
                    }
                });
            }
            break;
        case 5:
            console.log('Writing data ...');

           var progress=0;
           var previous_progress=0;


            var blocks = self.hex.data.length - 1,
                flashing_block = 0,
                address = self.hex.data[flashing_block].address,
                bytes_flashed = 0,
                bytes_flashed_total = 0; // used for progress bar

            var write = function () {
                if (bytes_flashed < self.hex.data[flashing_block].bytes) {
                    var bytes_to_write = ((bytes_flashed + 256) <= self.hex.data[flashing_block].bytes) ? 256 : (self.hex.data[flashing_block].bytes - bytes_flashed);


                    self.send([self.command.write_memory, 0xCE], 1, function (reply) { // 0x31 ^ 0xFF
                        if (self.verify_response(self.status.ACK, reply)) {
                            // address needs to be transmitted as 32 bit integer, we need to bit shift each byte out and then calculate address checksum
                            var address_arr = [(address >> 24), (address >> 16), (address >> 8), address];
                            var address_checksum = address_arr[0] ^ address_arr[1] ^ address_arr[2] ^ address_arr[3];

                            self.send([address_arr[0], address_arr[1], address_arr[2], address_arr[3], address_checksum], 1, function (reply) { // write start address + checksum
                                if (self.verify_response(self.status.ACK, reply)) {
                                    var array_out = new Array(bytes_to_write + 2); // 2 byte overhead [N, ...., checksum]
                                    array_out[0] = bytes_to_write - 1; // number of bytes to be written (to write 128 bytes, N must be 127, to write 256 bytes, N must be 255)

                                    var checksum = array_out[0];
                                    for (var i = 0; i < bytes_to_write; i++) {
                                        array_out[i + 1] = self.hex.data[flashing_block].data[bytes_flashed]; // + 1 because of the first byte offset
                                        checksum ^= self.hex.data[flashing_block].data[bytes_flashed];

                                        bytes_flashed++;
                                    }
                                    array_out[array_out.length - 1] = checksum; // checksum (last byte in the array_out array)

                                    address += bytes_to_write;
                                    bytes_flashed_total += bytes_to_write;

                                    self.send(array_out, 1, function (reply) {
                                        if (self.verify_response(self.status.ACK, reply)) {
                                            // flash another page
                                            write();
                                        }
                                    });

                                    // update progress bar

                                   console.log('###Math Log:'+Math.round((bytes_flashed_total / self.hex.bytes_total ) * 60));
                                   progress=Math.round((bytes_flashed_total / self.hex.bytes_total ) * 70);

                                   if(progress!==previous_progress)

                                   update_progressbar(1);

                                   previous_progress=progress;
                                }
                            });
                        }
                    });
                } else {
                    // move to another block
                    if (flashing_block < blocks) {
                        flashing_block++;

                        address = self.hex.data[flashing_block].address;
                        bytes_flashed = 0;

                        write();
                    } else {
                        // all blocks flashed
                        console.log('Writing: done');

                        // proceed to next step
                        self.upload_procedure(7);
                    }
                }
            };

            // start writing
            write();
            break;
        case 6:
            console.log('Verifying data ...');

            var blocks = self.hex.data.length - 1,
                reading_block = 0,
                address = self.hex.data[reading_block].address,
                bytes_verified = 0,
                bytes_verified_total = 0; // used for progress bar

                console.log('No of Blocks: '+blocks);

            // initialize arrays
            for (var i = 0; i <= blocks; i++) {
                self.verify_hex.push([]);
                console.log(' Blocks Size '+i+':'+self.hex.data[i].bytes);

            }
            console.log('Verifying data ...#1');



            var reading = function () {
                //  GUI.log("###### here 1")     ;
                if (bytes_verified < self.hex.data[reading_block].bytes) {
                    //  GUI.log("###### in if")  ;

                    console.log('Bytes Verified: '+bytes_verified);
                    console.log('Reading Block Size: '+ self.hex.data[reading_block].bytes);


                    var bytes_to_read = ((bytes_verified + 256) <= self.hex.data[reading_block].bytes) ? 256 : (self.hex.data[reading_block].bytes - bytes_verified);

                     console.log('STM32 - Reading from: 0x' + address.toString(16) + ', ' + bytes_to_read + ' bytes');

                    self.send([self.command.read_memory, 0xEE], 1, function (reply) { // 0x11 ^ 0xFF
                        if (self.verify_response(self.status.ACK, reply)) {

                            console.log('Verifying data ...#11');

                            var address_arr = [(address >> 24), (address >> 16), (address >> 8), address];
                            var address_checksum = address_arr[0] ^ address_arr[1] ^ address_arr[2] ^ address_arr[3];

                            self.send([address_arr[0], address_arr[1], address_arr[2], address_arr[3], address_checksum], 1, function (reply) { // read start address + checksum
                                if (self.verify_response(self.status.ACK, reply)) {
                                    var bytes_to_read_n = bytes_to_read - 1;

                                    console.log('Verifying data ...#22');


                                    console.log('Bytes To Read: '+bytes_to_read_n);



                                    self.send([bytes_to_read_n, (~bytes_to_read_n) & 0xFF], 1, function (reply) { // bytes to be read + checksum XOR(complement of bytes_to_read_n)
                                        if (self.verify_response(self.status.ACK, reply)) {
                                            console.log('Verifying data ...#33');

                                            self.retrieve(bytes_to_read, function (data) {
                                                for (var i = 0; i < data.length; i++) {
                                                    self.verify_hex[reading_block].push(data[i]);
                                                }

                                                address += bytes_to_read;
                                                bytes_verified += bytes_to_read;
                                                bytes_verified_total += bytes_to_read;


                                                console.log('Verifying data ...#44');
                                                // verify another page
                                                reading();
                                            });
                                        }
                                    });

                                 }
                            });
                        }
                    });
                } else {
                         console.log("###### in else")  ;
                    // move to another block
                    if (reading_block < blocks) {

                        console.log("###### in else 1")  ;
                        reading_block++;

                        address = self.hex.data[reading_block].address;
                        bytes_verified = 0;

                        reading();
                    } else {
                        // all blocks read, verify
                        console.log("###### in else 2")  ;
                        var verify = true;
                        for (var i = 0; i <= blocks; i++) {
                            console.log("###### in else 3")  ;

                            verify = self.verify_flash(self.hex.data[i].data, self.verify_hex[i]);

                            if (!verify) break;
                        }
                        console.log("###### in else 4")  ;

                        if (verify) {
                            console.log('Programming: SUCCESSFUL');
                            // proceed to next step
                            self.upload_procedure(7);
                        } else {
                            console.log('Programming: FAILED');

                            // disconnect
                            self.upload_procedure(99);
                        }
                    }
                }
            };

            // start reading
            reading();
            break;
        case 7:

            console.log('Sending GO command: 0x8000000');

            self.send([self.command.go, 0xDE], 1, function (reply) { // 0x21 ^ 0xFF
                if (self.verify_response(self.status.ACK, reply)) {
                    var gt_address = 0x8000000,
                        address = [(gt_address >> 24), (gt_address >> 16), (gt_address >> 8), gt_address],
                        address_checksum = address[0] ^ address[1] ^ address[2] ^ address[3];

                    self.send([address[0], address[1], address[2], address[3], address_checksum], 1, function (reply) {
                        if (self.verify_response(self.status.ACK, reply)) {
                            // disconnect
                            //alert("Firmware Flashed Successfully");
                            const options = {
                              type: 'info',
                              title: 'NXGBlocks',
                              message: 'Firmware Flashed Successfully',
                            };

                            dialog.showMessageBox(null, options);
                            self.upload_procedure(99);
                        }
                    });
                }
            });
            break;
        case 99:
            // disconnect

          setTimeout(function(){


            AT.setParity(AT_commands.AT_set_no_parity);
            // close connection

            setTimeout(function () {


            socket.disconnect(function (result) {

            });
        }, 1000);

            reset_progressBar();

            var timeSpent = new Date().getTime() - self.upload_time_start;

            console.log('Script finished after: ' + (timeSpent / 1000) + ' seconds');

        }, 10);
            break;
    }
};

// initialize object
var STM32 = new STM32_protocol();

var  progress_value=0;
var update_progressbar= function(progress){

    var progress_bar = $('.cssProgress-bar');
    var progress_label = $('.cssProgress-label2');
    progress_bar.css({'width': percentage, 'transition': 'none', '-webkit-transition': 'none', '-moz-transition': 'none'});

    if(progress!==-100){



    progress_value+=progress;

    console.log('progress: ' + progress);
    console.log('progress_value: ' + progress_value);

    var percentage = progress_value + '%';

   // progress_bar.css({'width': percentage, 'transition': 'none', '-webkit-transition': 'none', '-moz-transition': 'none'});

    progress_bar.animate({
        width: percentage
      }, {
        duration: 0,
        step: function(x) {
          progress_label.text(Math.round(x) + '%');
        }
      });


    }else{

      progress_bar.css('width', '0%');
      progress_label.text('0%');


    }
};


var reset_progressBar=function(){
    update_progressbar(-100);
    progress_value=0;

    $('.overlay').css('display','none');


    $('.modal').css('display','none');

};


var initFunction=function(){

};
