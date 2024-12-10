Blockly.cake.set_timer=function(a){
    var b=Blockly.cake.variableDB_.getName(a.getFieldValue("VAR"),Blockly.Variables.NAME_TYPE);
    Blockly.cake.Pluto_On_Start_AUTO_CODE[b+"_AUTO_INSERTION"]=b+".reset()";

    var c=a.getField("TIME")?String(Number(a.getFieldValue("TIME"))):Blockly.cake.valueToCode(a,"TIME",Blockly.cake.ORDER_ASSIGNMENT)||"0";
    a=a.getField("REPEAT")?String(Number(a.getFieldValue("REPEAT"))):Blockly.cake.valueToCode(a,"REPEAT",Blockly.cake.ORDER_ASSIGNMENT)||"true";
    return b+".set("+c+","+a+");\n"};



Blockly.Blocks.set_timer={init:function(){this.appendDummyInput().appendField("set").appendField(new Blockly.FieldVariable("T1","",["Interval"],"Interval"),"VAR");
this.appendValueInput("TIME").setCheck("Number").appendField("time (ms)");this.appendValueInput("REPEAT").setCheck("Boolean").appendField("repeat");
this.setPreviousStatement(!0,null);this.setNextStatement(!0,null);
this.setColour(50);this.setTooltip("");this.setHelpUrl("");this.setExtension("set_timer_on_start_check")}};



Blockly.cake.gpio_write={};

Blockly.cake.Pin_10=function(a){
    var b=Blockly.cake.variableDB_.getName(a.getFieldValue("NAME"),Blockly.Variables.NAME_TYPE);
    a="GPIO.write(Pin"+a.getFieldValue("NAME")+","+a.getFieldValue("STATE")+");\n";
    Blockly.cake.Pluto_init_AUTO_CODE[b+"_AUTO_INSERTION"]=b+".reset()";};
//Blockly.cake.Pluto_init_AUTO_CODE.LED_AUTO_INSERTION="";Blockly.cake.Pluto_init_AUTO_CODE.init_function.LED_AUTO_INSERTION=="GPIO.init("+b+",OUTPUT);\n"};
