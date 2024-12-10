'use strict';


var Projects = {};

const { remote } = require('electron');


Projects.bindClick = function(el, func) {
  if (typeof el == 'string') {
    el = document.getElementById(el);
  }
  el.addEventListener('click', func, true);
  el.addEventListener('touchend', func, true);
};



Projects.init = function () {

  const container = document.getElementById('projects');

  var arrProjectData = [];

  if(typeof(Storage) != "undefined") {
    for (var i = 0; i < localStorage.length; i++) {
        var project = localStorage.key(i);

        if(project.startsWith("Project")) {
         var data = JSON.parse(localStorage.getItem(project) || {});
          arrProjectData.push([project,data]);
        }
    }
  }

  if(arrProjectData && arrProjectData.length > 0) {
    arrProjectData.sort(function(a,b) {
        return - new Date(a[1].date).getTime() + new Date(b[1].date).getTime();
    });

    for (var i = 0; i < arrProjectData.length; i++) {
    const content = '<div class="card" id="project_card_' + i + '" onclick = Projects.projectClick("' + arrProjectData[i][0] +'")> <b class="project_name">' +
     arrProjectData[i][1].name + '</b> <h4 class="time"><b>' + timeDifference(new Date(), new Date(arrProjectData[i][1].date)) +  '</b></h4>' +
      '<button class="deleteProject" onclick = Projects.projectDelete("' + arrProjectData[i][0] +'",' + '"' +  encodeURIComponent(arrProjectData[i][1].name)  + '",' + '"project_card_' + i + '")>  <img src="../media/ic_delete_24dp.png" width="21" height="21">' +
       '</button> </div>';
      container.innerHTML += content;
    }
  }


  Projects.bindClick('new_project_card',
      function() {Projects.newProjectClick();});

}

Projects.newProjectClick = function() {
    localStorage.removeItem("current_project");
    location.replace("index.html");
}



Projects.projectClick = function(projectId) {
    localStorage.setItem("current_project", projectId);
    location.replace("index.html");
}


Projects.projectDelete = function(projectId, projectName, parentId) {
  const options = {
    type: 'question',
    buttons: ['Yes', 'Cancel'],
    defaultId: 0,
    title: 'NXGBlocks',
    message: 'Do you want to delete "' + decodeURIComponent(projectName) + '"?',
  };

  const { dialog } = require('electron').remote;

  dialog.showMessageBox(remote.getCurrentWindow(), options, (response) => {
    if(response == 0) {
      localStorage.removeItem(projectId);
      const parent = document.getElementById(parentId);
      parent.parentNode.removeChild(parent);
    }
  });

  event.stopPropagation();
}

function timeDifference(current, previous) {

    var msPerMinute = 60 * 1000;
    var msPerHour = msPerMinute * 60;
    var msPerDay = msPerHour * 24;
    var msPerMonth = msPerDay * 30;
    var msPerYear = msPerDay * 365;

    var elapsed = current.getTime() - previous.getTime();

    if (elapsed < msPerMinute) {
         return 'few seconds ago';
    }

    else if (elapsed < msPerHour) {
         var minute = Math.round(elapsed/msPerMinute);
         return minute + ((minute > 1) ? ' minutes ago' : ' minute ago');
    }

    else if (elapsed < msPerDay ) {
         var hour = Math.round(elapsed/msPerHour);
         return hour + ((hour > 1) ? ' hours ago' : ' hour ago');
    }

    else if (elapsed < msPerMonth) {
        var day = Math.round(elapsed/msPerDay);
        return day + ((day > 1) ? ' days ago' : ' day ago');
    }

    else if (elapsed < msPerYear) {
        var month = Math.round(elapsed/msPerMonth);
        return month + ((month > 1) ? ' months ago' : ' month ago');
    }

    else {
        var year = Math.round(elapsed/msPerYear);
        return year + ((year > 1) ? ' years ago' : ' year ago');
    }
}


window.addEventListener('load', Projects.init);
