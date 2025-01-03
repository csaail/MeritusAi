'use strict';
const { remote } = require('electron');
const app = remote.app;

/**
 * Create a namespace for the application.
 */
var Code = {};
var defaultXml;
const fs = require('fs')
const { dialog } = require('electron').remote;
var Dialogs = require('dialogs');

var showConnectWarning=true;

/**
 * Lookup for names of supported languages.  Keys should be in ISO 639 format.
 */
Code.LANGUAGE_NAME = {
  'ar': 'العربية',
  'be-tarask': 'Taraškievica',
  'br': 'Brezhoneg',
  'ca': 'Català',
  'cs': 'Česky',
  'da': 'Dansk',
  'de': 'Deutsch',
  'el': 'Ελληνικά',
  'en': 'English',
  'es': 'Español',
  'et': 'Eesti',
  'fa': 'فارسی',
  'fr': 'Français',
  'he': 'עברית',
  'hrx': 'Hunsrik',
  'hu': 'Magyar',
  'ia': 'Interlingua',
  'is': 'Íslenska',
  'it': 'Italiano',
  'ja': '日本語',
  'kab': 'Kabyle',
  'ko': '한국어',
  'mk': 'Македонски',
  'ms': 'Bahasa Melayu',
  'nb': 'Norsk Bokmål',
  'nl': 'Nederlands, Vlaams',
  'oc': 'Lenga d\'òc',
  'pl': 'Polski',
  'pms': 'Piemontèis',
  'pt-br': 'Português Brasileiro',
  'ro': 'Română',
  'ru': 'Русский',
  'sc': 'Sardu',
  'sk': 'Slovenčina',
  'sr': 'Српски',
  'sv': 'Svenska',
  'ta': 'தமிழ்',
  'th': 'ภาษาไทย',
  'tlh': 'tlhIngan Hol',
  'tr': 'Türkçe',
  'uk': 'Українська',
  'vi': 'Tiếng Việt',
  'zh-hans': '简体中文',
  'zh-hant': '正體中文'
};

/**
 * List of RTL languages.
 */
Code.LANGUAGE_RTL = ['ar', 'fa', 'he', 'lki'];

/**
 * Blockly's main workspace.
 * @type {Blockly.WorkspaceSvg}
 */
Code.workspace = null;

/**
 * Extracts a parameter from the URL.
 * If the parameter is absent default_value is returned.
 * @param {string} name The name of the parameter.
 * @param {string} defaultValue Value to return if parameter not found.
 * @return {string} The parameter value or the default value if not found.
 */
Code.getStringParamFromUrl = function(name, defaultValue) {
  var val = location.search.match(new RegExp('[?&]' + name + '=([^&]+)'));
  return val ? decodeURIComponent(val[1].replace(/\+/g, '%20')) : defaultValue;
};

/**
 * Get the language of this user from the URL.
 * @return {string} User's language.
 */
Code.getLang = function() {
  var lang = Code.getStringParamFromUrl('lang', '');
  if (Code.LANGUAGE_NAME[lang] === undefined) {
    // Default to English.
    lang = 'en';
  }
  return lang;
};

/**
 * Is the current language (Code.LANG) an RTL language?
 * @return {boolean} True if RTL, false if LTR.
 */
Code.isRtl = function() {
  return Code.LANGUAGE_RTL.indexOf(Code.LANG) != -1;
};

/**
 * Load blocks saved on App Engine Storage or in session/local storage.
 * @param {string} defaultXml Text representation of default blocks.
 */
Code.loadBlocks = function(defaultXml) {

  try {
    var loadOnce = window.sessionStorage.loadOnceBlocks;
  } catch(e) {
    // Firefox sometimes throws a SecurityError when accessing sessionStorage.
    // Restarting Firefox fixes this, so it looks like a bug.
    var loadOnce = null;
  }
  if ('BlocklyStorage' in window && window.location.hash.length > 1) {
    // An href with #key trigers an AJAX call to retrieve saved blocks.
    BlocklyStorage.retrieveXml(window.location.hash.substring(1));
  } else if (loadOnce) {
    // Language switching stores the blocks during the reload.
    delete window.sessionStorage.loadOnceBlocks;
    var xml = Blockly.Xml.textToDom(loadOnce);
    Blockly.Xml.domToWorkspace(xml, Code.workspace, false);
  } else if (defaultXml) {
    // Load the editor with default starting blocks.
    var xml = Blockly.Xml.textToDom(defaultXml);
    Blockly.Xml.domToWorkspace(xml, Code.workspace, false);
  } else if ('BlocklyStorage' in window) {
    // Restore saved blocks in a separate thread so that subsequent
    // initialization is not affected from a failed load.
    window.setTimeout(BlocklyStorage.restoreBlocks, 0);
  }
};


/**
 * Bind a function to a button's click event.
 * On touch enabled browsers, ontouchend is treated as equivalent to onclick.
 * @param {!Element|string} el Button element or ID thereof.
 * @param {!Function} func Event handler to bind.
 */
Code.bindClick = function(el, func) {
  if (typeof el == 'string') {
    el = document.getElementById(el);
  }
  el.addEventListener('click', func, true);
  el.addEventListener('touchend', func, true);
};

/**
 * Load the Prettify CSS and JavaScript.
 */
Code.importPrettify = function() {
  var script = document.createElement('script');
  script.setAttribute('src', 'https://cdn.rawgit.com/google/code-prettify/master/loader/run_prettify.js');
  document.head.appendChild(script);
};

/**
 * Compute the absolute coordinates and dimensions of an HTML element.
 * @param {!Element} element Element to match.
 * @return {!Object} Contains height, width, x, and y properties.
 * @private
 */
Code.getBBox_ = function(element) {
  var height = element.offsetHeight;
  var width = element.offsetWidth;
  var x = 0;
  var y = 0;
  do {
    x += element.offsetLeft;
    y += element.offsetTop;
    element = element.offsetParent;
  } while (element);
  return {
    height: height,
    width: width,
    x: x,
    y: y
  };
};

/**
 * User's language (e.g. "en").
 * @type {string}
 */
Code.LANG = Code.getLang();

/**
 * List of tab names.
 * @private
 */
Code.TABS_ = ['blocks', 'cake'];

Code.selected = 'blocks';

/**
 * Switch the visible pane when a tab is clicked.
 * @param {string} clickedName Name of tab clicked.
 */
Code.tabClick = function(clickedName) {

  if (document.getElementById('tab_blocks').className == 'tabon') {
    Code.workspace.setVisible(false);
  }
  // Deselect all tabs and hide all panes.
  for (var i = 0; i < Code.TABS_.length; i++) {
    var name = Code.TABS_[i];
    document.getElementById('tab_' + name).className = 'taboff';
    document.getElementById('content_' + name).style.visibility = 'hidden';
  }

  // Select the active tab.
  Code.selected = clickedName;
  document.getElementById('tab_' + clickedName).className = 'tabon';
  // Show the selected pane.
  document.getElementById('content_' + clickedName).style.visibility =
      'visible';
  Code.renderContent();
  if (clickedName == 'blocks') {
    Code.workspace.setVisible(true);
  }
  Blockly.svgResize(Code.workspace);
};

/**
 * Populate the currently selected pane with content generated from the blocks.
 */
Code.renderContent = function() {
  var content = document.getElementById('content_' + Code.selected);

  if (content.id == 'content_cake') {
    Code.attemptCodeGeneration(Blockly.cake);
  }
  if (typeof PR == 'object') {
    PR.prettyPrint();
  }

};

/**
 * Attempt to generate the code and display it in the UI, pretty printed.
 * @param generator {!Blockly.Generator} The generator to use.
 */
Code.attemptCodeGeneration = function(generator) {

  var content = document.getElementById('content_' + Code.selected);
  content.textContent = '';
  if (Code.checkAllGeneratorFunctionsDefined(generator)) {

    var code = generator.workspaceToCode(Code.workspace);

    content.textContent += code;
    // Remove the 'prettyprinted' class, so that Prettify will recalculate.
    content.className = content.className.replace('prettyprinted', '');

  } else {
    console.log("error_generator_fun_undef");
  }
};

/**
 * Check whether all blocks in use have generator functions.
 * @param generator {!Blockly.Generator} The generator to use.
 */
Code.checkAllGeneratorFunctionsDefined = function(generator) {
  var blocks = Code.workspace.getAllBlocks(false);
  var missingBlockGenerators = [];
  for (var i = 0; i < blocks.length; i++) {
    var blockType = blocks[i].type;
    if (!generator[blockType]) {
      if (missingBlockGenerators.indexOf(blockType) == -1) {
        missingBlockGenerators.push(blockType);
      }
    }
  }

  var valid = missingBlockGenerators.length == 0;
  if (!valid) {
    var msg = 'The generator code for the following blocks not specified for ' +
        generator.name_ + ':\n - ' + missingBlockGenerators.join('\n - ');

    const options = {
      type: 'error',
      title: 'NXGBlocks',
      message: msg,
    };
    dialog.showMessageBox(remote.getCurrentWindow(), options);
  }

  return valid;
};



var onresize = function(e) {
  var container = document.getElementById('content_area');
  var tableBlocks = document.getElementById('tableBlocks');

  var heightTable = tableBlocks.parentNode.parentElement.clientHeight - document.getElementById('log').clientHeight - 50;
  tableBlocks.style.height =  heightTable + 'px';

  var bBox = Code.getBBox_(container);
  for (var i = 0; i < Code.TABS_.length; i++) {
    var el = document.getElementById('content_' + Code.TABS_[i]);
    el.style.top = bBox.y + 'px';
    el.style.left = bBox.x + 'px';
    // Height and width need to be set, read back, then set again to
    // compensate for scrollbars.
    el.style.height = bBox.height + 'px';
    el.style.height = (2 * bBox.height - el.offsetHeight) + 'px';
    el.style.width = bBox.width + 'px';
    el.style.width = (2 * bBox.width - el.offsetWidth) + 'px';
  }
  // Make the 'Blocks' tab line up with the toolbox.
  if (Code.workspace && Code.workspace.toolbox_.width) {
    document.getElementById('tab_blocks').style.minWidth =
        (Code.workspace.toolbox_.width - 38) + 'px';
        // Account for the 19 pixel margin and on each side.
  }

    Blockly.svgResize(Code.workspace);
};

/**
 * Initialize Blockly.  Called on page load.
 */
Code.init = function() {
  try{

  var rtl = Code.isRtl();

  window.addEventListener('resize', onresize, false);

  // The toolbox XML specifies each category name using Blockly's messaging
  // format (eg. `<category name="%{BKY_CATLOGIC}">`).
  // These message keys need to be defined in `Blockly.Msg` in order to
  // be decoded by the library. Therefore, we'll use the `MSG` dictionary that's
  // been defined for each language to import each category name message
  // into `Blockly.Msg`.
  // TODO: Clean up the message files so this is done explicitly instead of
  // through this for-loop.
  for (var messageKey in MSG) {
    if (messageKey.indexOf('cat') == 0) {
      Blockly.Msg[messageKey.toUpperCase()] = MSG[messageKey];
    }
  }

  // Construct the toolbox XML, replacing translated variable names.
  var toolboxText = document.getElementById('toolbox').outerHTML;
  toolboxText = toolboxText.replace(/(^|[^%]){(\w+)}/g,
      function(m, p1, p2) {return p1 + MSG[p2];});
  var toolboxXml = Blockly.Xml.textToDom(toolboxText);

  Code.workspace = Blockly.inject('content_blocks',
      {grid:
          {spacing: 25,
           length: 3,
           colour: '#ccc',
           snap: true},
       media: '../media/',
       rtl: rtl,
       toolbox: toolboxXml,
       zoom:
           {controls: true,
            wheel: true}
      });

  Code.workspace.addChangeListener(Blockly.Events.disableOrphans);

  // Add to reserved word list: Local variables in execution environment (runJS)
  // and the infinite loop detection function.
  Blockly.JavaScript.addReservedWords('code,timeouts,checkTimeout');

  defaultXml =
         '<xml xmlns="https://developers.google.com/blockly/xml">' +
         '  <block type="pluto_on_start_loop" deletable="false" x="0" y="0">' +
         '  </block>' +
         '  <block type="pluto_loop" deletable="false" x="0" y="200">' +
         '  </block>' +
         '  <block type="pluto_on_stop_loop" deletable="false" x="0" y="400">' +
         '  </block>' +
         '</xml>';

  if(localStorage != undefined && localStorage.getItem("current_project")) {
    var data = JSON.parse(localStorage.getItem(localStorage.getItem("current_project")));
    document.getElementById("project_name").innerHTML = data.name;
    Code.loadBlocks(data.code);
  } else {
    Code.loadBlocks(defaultXml);
  }


  if ('BlocklyStorage' in window) {
    // Hook a save function onto unload.
    BlocklyStorage.backupOnUnload(Code.workspace);
  }

  Code.tabClick(Code.selected);

  Code.bindClick('homeButton', function() {Code.homeClicked()});

  Code.bindClick('buildButton',
      function() {Code.buildCode();});

  Code.bindClick('flashButton',
      function() {Code.flashCode();});

  Code.bindClick('saveButton',
      function() {Code.saveProject();});

  Code.bindClick('trashButton',
      function() {Code.discard(); Code.renderContent();});

  Code.bindClick('connectButton',
      function() {Code.connectPluto();});

  communication.setErrorCallback(function() {
      document.getElementById("connectImage").src = '../media/ic_connect.png';
      document.getElementById("wrapperLog").innerHTML = "";
      $('div.wrapper', $('div#log')).append('<p>' + 'Connect Drone to view the console data...' + '</p>');
  });
  Code.bindClick('export', function () { Code.exportProject(); });
  // Disable the link button if page isn't backed by App Engine storage.
  var linkButton = document.getElementById('linkButton');
  if ('BlocklyStorage' in window) {
    BlocklyStorage['HTTPREQUEST_ERROR'] = MSG['httpRequestError'];
    BlocklyStorage['LINK_ALERT'] = MSG['linkAlert'];
    BlocklyStorage['HASH_ERROR'] = MSG['hashError'];
    BlocklyStorage['XML_ERROR'] = MSG['xmlError'];
    Code.bindClick(linkButton,
        function() {BlocklyStorage.link(Code.workspace);});
  } else if (linkButton) {
    linkButton.className = 'disabled';
  }

  for (var i = 0; i < Code.TABS_.length; i++) {
    var name = Code.TABS_[i];
    Code.bindClick('tab_' + name,
        function(name_) {return function() {Code.tabClick(name_);};}(name));
  }
  onresize();
  // Lazy-load the syntax-highlighting.
  window.setTimeout(Code.importPrettify, 1);

} catch(err) {
  console.log(err.message);
}
};


Code.connectPluto = function() {
    if(!communication.socketOpen) {
      communication.connect(function() {
          document.getElementById("connectImage").src = '../media/ic_connected.png';
          document.getElementById("wrapperLog").innerHTML = "";
      });
    }

    else {
      communication.disconnect(function() {
          document.getElementById("wrapperLog").innerHTML = "";
          document.getElementById("connectImage").src = '../media/ic_connect.png';
          $('div.wrapper', $('div#log')).append('<p>' + 'Connect Drone to view the console data...' + '</p>');
      });
    }
};

/**
 * Execute the user's code.
 * Just a quick and dirty eval.  Catch infinite loops.
 */
Code.runJS = function() {
  Blockly.JavaScript.INFINITE_LOOP_TRAP = 'checkTimeout();\n';
  var timeouts = 0;
  var checkTimeout = function() {
    if (timeouts++ > 1000000) {
      throw MSG['timeout'];
    }
  };
  var code = Blockly.JavaScript.workspaceToCode(Code.workspace);
  Blockly.JavaScript.INFINITE_LOOP_TRAP = null;
  try {
    eval(code);
  } catch (e) {
    alert(MSG['badCode'].replace('%1', e));
  }
};

/**
 * Discard all blocks from the workspace.
 */
Code.discard = function() {
  var count = Code.workspace.getAllBlocks(false).length;

  count-=3;

  if(count > 0) {
    const options = {
      type: 'question',
      buttons: ['Ok', 'Cancel'],
      defaultId: 1,
      title: 'NXGBlocks',
      message: 'Delete all blocks?',
    };

    dialog.showMessageBox(remote.getCurrentWindow(), options, (response) => {
      if(response == 0) {
          Code.workspace.clear();
          if (window.location.hash) {
           window.location.hash = '';
          }
          Code.loadBlocks(defaultXml);
      }
    });
  }
};

/* Build the code */

Code.buildCode = function() {

  var code;

  const div = document.createElement('div');

  div.className = 'loader loader-curtain is-active';
  var att = document.createAttribute("data-colorful");

  div.setAttributeNode(att);

  div.setAttribute('data-curtain-text','Building Project');

  document.getElementsByTagName("BODY")[0].appendChild(div);

  if (Code.checkAllGeneratorFunctionsDefined(Blockly.cake)) {
    code = Blockly.cake.workspaceToCode(Code.workspace);
  } else {
    console.log("error_generator_fun_undef");
  }
  console.log("PATH: "+app.getAppPath());

  fs.writeFile('./pluto_project/src/main/PlutoPilot.cpp', code, (err) => {
    if (err) throw err;
    console.log('The file has been saved!');

    const exec = require('child_process').exec;
	  const child = exec('"./pluto_project/cygwin64/bin/make" -C ./pluto_project/',
        (error, stdout, stderr) => {
          document.getElementsByTagName("BODY")[0].removeChild(div);
          console.log(`stdout: ${stdout}`);
          console.log(`stderr: ${stderr}`);
          if (error !== null) {
              console.log(`exec error: ${error}`);
          }

          const options = {
            type: 'info',
            title: 'NXGBlocks',
            message: 'Build the project successfully',
          };

          dialog.showMessageBox(remote.getCurrentWindow(), options);
    });

  });

};



Code.flashCode = function() {
  $('.overlay').css('display','block');

  if(showConnectWarning===true)
  $('.modal1').css('display','block');
  else
     firmwareFlasher();
}


$(document).ready(function(){
  $("#confirm-button").click(function(){
    $('.modal1').css('display','none');
    firmwareFlasher();
  });
});

$(document).ready(function(){
$("#notAgain").change(function() {
  if(this.checked) {
      if(this.name==="appWarning"){
       showConnectWarning=false;
      }
  }
});
});

var firmwareFlasher= function() {

  $('.modal').css('display','block');

  var intel_hex = false, // standard intel hex in string format
  parsed_hex = false; // parsed raw hex in array format


  function parse_hex(str, callback) {
    // parsing hex in different thread
    var worker = new Worker('./js/hex_parser.js');

    // "callback"
    worker.onmessage = function (event) {
        callback(event.data);
    };

    // send data/string over for processing
    worker.postMessage(str);
}



  var reader = new FileReader();

  reader.onprogress = function (e) {
      if (e.total > 1048576) { // 1 MB
          // dont allow reading files bigger then 1 MB
          console.log('File limit (1 MB) exceeded, aborting');
          reader.abort();
      }
  };

  reader.onloadend = function(e) {
      if (e.total != 0 && e.total == e.loaded) {
          console.log('File loaded');

          intel_hex = e.target.result;

          parse_hex(intel_hex, function (data) {
              parsed_hex = data;

              if (parsed_hex) {
                console.log('##File Parsed');
                STM32.connect(parsed_hex);
              } else {
                console.log('#Cant PARSE FILE');
              }
          });
      }
  };

  const path = './pluto_project/obj/Experience_PLUTOX.hex';

  fs.access(path, fs.F_OK, (err) => {
    if (err) {
      console.error(err);
      console.log('## Firmware file doesnt exist');
      $('.overlay').css('display','none');


      $('.modal').css('display','none');

      const options = {
        type: 'error',
        title: 'NXGBlocks',
        message: 'No firmware file exist, build the code first!',
      };

      dialog.showMessageBox(remote.getCurrentWindow(), options);

      return;
    }
    // file exists
    console.log('## Firmware file exist');
    fs.readFile(path, 'utf8', function (err, file) {
      if (err) throw err;
      console.log('File is opened in read mode.');

      var mystring = "Hello World!";
      var myblob = new Blob([file.toString()], {
          type: 'text/plain'
      });

      reader.readAsText(myblob);
    });

  });
}

Code.homeClicked = function() {
  if(typeof(Storage) == "undefined" || !localStorage.getItem("current_project")) {

        Dialogs().prompt('Give Project a name', 'Untitled', projectName => {
           if(projectName) {
                var currentProject = localStorage.getItem("current_project");
                var id;

                if(currentProject) {
                   id = currentProject;
                } else {
                  id = "Project" + Math.floor(Date.now() / 1000);
                  localStorage.setItem("current_project", id);
                }

                var xml = Blockly.Xml.workspaceToDom(Code.workspace);
                var projectDetails= {
                  name: projectName,
                  date: new Date(),
                  code: Blockly.Xml.domToText(xml)
                };
                localStorage.setItem(id, JSON.stringify(projectDetails));
                location.replace("home.html");
           } else {
                 Code.saveProjectBeforeClose();
                 location.replace("home.html");
              }
        });
  }

   else {
     Code.saveProjectBeforeClose();
     location.replace("home.html");
  }
}


Code.saveProject = function() {

  if(typeof(Storage) != "undefined") {

      var defaultName = "Untitled";
      var currentProject = localStorage.getItem("current_project");

      if(currentProject) {
          defaultName = document.getElementById("project_name").innerText;
      }

    Dialogs().prompt('Project Name', defaultName, projectName => {
        if(projectName) {

          var id;

          if(currentProject) {
             id = currentProject;
          } else {
            id = "Project" + Math.floor(Date.now() / 1000);
            localStorage.setItem("current_project", id);
          }

          var xml = Blockly.Xml.workspaceToDom(Code.workspace);
          var projectDetails= {
            name: projectName,
            date: new Date(),
            code: Blockly.Xml.domToText(xml)
          };
          localStorage.setItem(id, JSON.stringify(projectDetails));
          document.getElementById("project_name").innerHTML = projectName;
        }
    });
  }
}

Code.saveProjectBeforeClose = function () {
  if(typeof(Storage) != "undefined") {

    var xml = Blockly.Xml.workspaceToDom(Code.workspace);

    var currentProject = localStorage.getItem("current_project");

    var name, id;

    if(currentProject) {
        name = JSON.parse(localStorage.getItem(localStorage.getItem("current_project"))).name;
        id = currentProject;
    } else {
      name = "Untitled";
      id = "Project" + Math.floor(Date.now() / 1000);
    }

    var projectDetails= {
      name: name,
      date: new Date(),
      code: Blockly.Xml.domToText(xml)
    };
    window.localStorage.setItem(id, JSON.stringify(projectDetails));
  }
}

Code.exportProject = function (projectId) {
  // Save the project first
    // Use current_project from localStorage if projectId is not provided
    if (!projectId) {
      projectId = localStorage.getItem("current_project");
      if (!projectId) {
        console.error("No projectId provided and no current project found in localStorage.");
        return;
      }
    }
  

  // Retrieve the project data from localStorage
  const projectData = JSON.parse(localStorage.getItem(projectId));

  if (projectData) {
    // Convert Blockly workspace to XML and store it as xmlData
    const xml = Blockly.Xml.workspaceToDom(Code.workspace);
    const xmlData = Blockly.Xml.domToText(xml);

    // Format the export data as per your requirements
    const exportData = {
      projectName: projectData.name, // Use projectName instead of name
      xmlData: xmlData               // Use xmlData instead of blocks or code
    };

    // Convert to JSON and prepare for download
    const jsonString = JSON.stringify(exportData);
    const blob = new Blob([jsonString], { type: "application/json" });

    // Use the project name as the filename
    const fileName = projectData.name.replace(/\s+/g, '_') + ".json";
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);

    console.log('Project exported:', fileName);
  } else {
    console.error('Project data not found for projectId:', projectId);
  }
};


function toggleLogView()
{
    if(document.getElementById('showlog').innerHTML == 'Show Log') {
      var logView = document.getElementById('log');
      var heightLog = logView.parentNode.parentElement.clientHeight * 0.3;
      logView.style.height =  heightLog + 'px';
      document.getElementById('showlog').innerHTML = 'Hide Log';
      onresize();
    } else {
      var logView = document.getElementById('log');
      var heightLog = logView.parentNode.parentElement.clientHeight * 0.05;
      logView.style.height =  heightLog + 'px';
      document.getElementById('showlog').innerHTML = 'Show Log';
      onresize();
    }
}


// Load the Code demo's language strings.
document.write('<script src="msg/' + Code.LANG + '.js"></script>\n');
// Load Blockly's language strings.
document.write('<script src="../msg/js/' + Code.LANG + '.js"></script>\n');

window.addEventListener('load', Code.init);

window.addEventListener('beforeunload', Code.saveProjectBeforeClose);
