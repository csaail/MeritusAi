/**
 * Created by dronaaviation on 20/09/16.
 */

var AT_commands={

    AT_set_even_parity:'E',
    AT_set_no_parity: 'N'



};

var AT={




    send_message: function(data)
    {

        var bufferOut,
            bufView;

        if (data) {

            bufferOut =new ArrayBuffer(data.length);
            bufView = new Uint8Array(bufferOut);


         //   GUI.log(data);
            //var encoding = new data();

            //bufView=encoding.GetBytes(data);
            for(var i= 0;i<data.length;i++)
                bufView[i]=data.charCodeAt(i);

         //   GUI.log(bufferOut.toString());
            socket.send(bufferOut,false);

        } else {


          //  GUI.log("no data");

        }





    }






};


AT.setParity=function(parity){
   // GUI.log("set parity 1");
    var data="+++AT BAUD 115200 8 "+parity+" 1";
  //  var data="K";
   // GUI.log("set parity 2");
    AT.send_message(data);

   // GUI.log("set parity 3");


};





AT.enableBootMode=function()
{


    AT.send_message("+++AT GPIO13 1\r\n");

setTimeout(function(){




        AT.send_message("+++AT GPIO12 0\r\n");




        setTimeout(function()
            {



                AT.send_message("+++AT GPIO12 1\r\n");

                setTimeout(function()
                {



                    AT.send_message("+++AT GPIO13 0\r\n");


                },1000);




            },1000);





    },1000);





};



