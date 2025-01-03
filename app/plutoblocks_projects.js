'use strict';

var Projects = {};
var currentSort = ' ';

const { remote } = require('electron');
//const { dialog } = require('@electron/remote');  // Update this line to use @electron/remote

Projects.bindClick = function(el, func) {
  if (typeof el == 'string') {
    el = document.getElementById(el);
  }
  el.addEventListener('click', func, true);
  el.addEventListener('touchend', func, true);
};


Projects.init = function () {
  Projects.renderProjects(currentSort);

  Projects.bindClick('new_project_card', function () {
    Projects.newProjectClick();
  });
};

Projects.renderProjects = function (sortBy) {
  const container = document.getElementById('projects');
  container.innerHTML = '';

  // Add the "New Project" card
  const newProjectCard = `
    <div class="card" id="new_project_card">
      <img src='../media/add_project_48dp.png' width="48" height="48">
      <p><b>New Project</b></p>
    </div>`;
  container.innerHTML += newProjectCard;

  var arrProjectData = [];

  if (typeof (Storage) != "undefined") {
    for (var i = 0; i < localStorage.length; i++) {
      var project = localStorage.key(i);
      if (project.startsWith("Project")) {
        var data = JSON.parse(localStorage.getItem(project) || {});
        arrProjectData.push([project, data]);
      }
    }
  }

  if (arrProjectData && arrProjectData.length > 0) {
    if (sortBy === 'name') {
        arrProjectData.sort((a, b) => {
            const nameA = a[1].name || ''; // Use an empty string if name is undefined
            const nameB = b[1].name || ''; // Use an empty string if name is undefined
            return nameA.localeCompare(nameB);
        });
    } else {
        arrProjectData.sort((a, b) => new Date(b[1].date).getTime() - new Date(a[1].date).getTime());
    }

    for (let i = 0; i < arrProjectData.length; i++) {
      const content = `
        <div class="card" id="project_card_${i}" onmouseover="showIcons(${i})" onmouseout="hideIcons(${i})" onclick="Projects.projectClick('${arrProjectData[i][0]}')">
          <b class="project_name">${arrProjectData[i][1].name}</b>
          <p>${timeDifference(new Date(), new Date(arrProjectData[i][1].date))}</p>
          <div class="iconsContainer" id="icons_${i}">
            
          <div class="deleteProject" id="deleteIcon_${i}" style="margin-right: 10px;">
  <img src="../media/ic_delete_24dp.png" width="21" height="21" 
  style="display: none;" 
  onclick="event.stopPropagation(); Projects.projectDelete('${arrProjectData[i][0]}', 
  '${encodeURIComponent(arrProjectData[i][1].name)}', 
  'project_card_${i}');">
</div>

            <div class="exportProject" id="exportIcon_${i}" style="margin-right: 10px;">
              <img src="../media/export.png" width="21" height="21" style="display: none;" 
              onclick="Projects.exportProject(event, '${arrProjectData[i][0]}', '${encodeURIComponent(arrProjectData[i][1].name)}')">
            </div>
            <div class="duplicateProject" id="duplicateIcon_${i}">
              <img src="../media/duplicate.png" width="21" height="21" style="display: none;" 
              onclick="Projects.duplicateProject(event, '${arrProjectData[i][0]}', '${encodeURIComponent(arrProjectData[i][1].name)}', 'project_card_${i}')">
            </div>
          </div>
        </div>`;
      container.innerHTML += content;
    }
  };


};

Projects.projectDelete = function (projectId, projectName, parentId) {
  const options = {
    type: 'question',
    buttons: ['Yes', 'Cancel'],
    defaultId: 0,
    title: 'NXGBlocks',
    message: `Do you want to delete "${decodeURIComponent(projectName)}"?`,
  };

  const { dialog } = require('electron').remote;

  dialog.showMessageBox(remote.getCurrentWindow(), options, (response) => {
    if (response === 0) { // User clicked 'Yes'
      // Log the projectId, projectName, and parentId
      console.log(`Project ID: ${projectId}`);
      console.log(`Parent ID: ${parentId}`);
      console.log(`Project Name: ${decodeURIComponent(projectName)}`);

      // Remove the project from localStorage
      localStorage.removeItem(projectId);

      // Try to remove the selected project card
      const parent = document.getElementById(parentId);

      if (parent && parent.parentNode) {
        parent.parentNode.removeChild(parent);
        console.log(`Element with ID ${parentId} removed successfully.`);

        // Show "Removed successfully" popup
        dialog.showMessageBox({
          type: 'info',
          buttons: ['OK'],
          title: 'Success',
          message: `The project "${decodeURIComponent(projectName)}" has been removed successfully.`,
        });
      } else {
        console.error(`Element with ID ${parentId} not found or has no parent.`);
      }
    }
  });

  // Prevent further propagation of the event
  if (event) event.stopPropagation();
};




Projects.newProjectClick = function () {
  localStorage.removeItem("current_project");
  location.replace("index.html");
};

Projects.projectClick = function (projectId) {
  console.log('Opening project:', projectId);
  localStorage.setItem("current_project", projectId);
  location.replace("index.html");
};



Projects.sortProjects = function (sortBy) {
  currentSort = sortBy;
  Projects.renderProjects(sortBy);
};


Projects.exportProject = function (event, projectId, projectName) {
  event.stopPropagation(); // Prevent opening the project

  let projectData = JSON.parse(localStorage.getItem(projectId));

  if (projectData) {
    // Manually reorder the fields
    const orderedProjectData = {
      projectName: projectData.name,  // Rename 'name' to 'projectName'
      xmlData: projectData.code       // Rename 'code' to 'xmlData'
    };

    // Process Blockly workspace if it exists
    if (window.Blockly && Blockly.mainWorkspace) {
      const blocks = Blockly.Xml.workspaceToDom(Blockly.mainWorkspace);
      orderedProjectData.xmlData = Blockly.Xml.domToText(blocks);
    }

    const jsonString = JSON.stringify(orderedProjectData);
    const blob = new Blob([jsonString], { type: "application/json" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);

    console.log('Project exported:', orderedProjectData.projectName);
  } else {
    console.error('Project data not found');
  }
};

Projects.importProject = function () {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.onchange = function (event) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = function (e) {
      try {
        let projectData = JSON.parse(e.target.result);
        console.log('Parsed projectData:', projectData); // Log parsed data

        if (projectData) {
          // Rename fields to match old structure and set the current timestamp
          const adjustedProjectData = {
            name: projectData.projectName,  // Rename 'projectName' to 'name'
            timestamp: Date.now(),         // Store the exact time the project was imported
            code: projectData.xmlData      // Rename 'xmlData' to 'code'
          };
          console.log('Adjusted projectData:', adjustedProjectData); // Log adjusted data

          // Use a unique ID for imported projects
          const projectId = `Project_${adjustedProjectData.timestamp}`;
          localStorage.setItem(projectId, JSON.stringify(adjustedProjectData));

          // Process Blockly workspace if it exists
          if (adjustedProjectData.code && window.Blockly) {
            const xml = Blockly.Xml.textToDom(adjustedProjectData.code);

            if (xml) {
              Blockly.Xml.domToWorkspace(Blockly.mainWorkspace, xml);
            }
          }

          console.log('Project imported:', adjustedProjectData.name);
        } else {
          console.error('No data found in the imported project');
        }
      } catch (error) {
        Projects.renderProjects();
        console.error('Error importing project:', error);
      }
    };
    location.reload()
    reader.readAsText(file);
  };
  input.click();
};


Projects.duplicateProject = function (event, projectId) {
  event.stopPropagation(); // Prevent any default action

  // Get the project data from localStorage
  const projectData = JSON.parse(localStorage.getItem(projectId));

  if (projectData) {
    // Extract base name and find the next available number
    const projectName = projectData.name;
    let newProjectName = projectName;
    let counter = 1;

    // Get all existing project names from localStorage
    const allProjectNames = Object.keys(localStorage)
      .map(id => {
        try {
          const data = JSON.parse(localStorage.getItem(id));
          return data.name;
        } catch (e) {
          return null;
        }
      })
      .filter(name => name && name.startsWith(projectName));

    // Find the next available number
    while (allProjectNames.includes(newProjectName)) {
      newProjectName = `${projectName} (${counter++})`;
    }

    // Generate a new ID for the duplicated project
    const newProjectId = `Project_${Date.now()}`;
    const newProjectData = { ...projectData, name: newProjectName }; // Set the new name

    // Save the duplicated project data to localStorage
    localStorage.setItem(newProjectId, JSON.stringify(newProjectData));

    // Re-render the projects list to reflect the new duplicated project
    Projects.renderProjects();

    console.log('Project duplicated:', newProjectData.name);
  } else {
    console.error('Project data not found');
  }
};

function timeDifference(current, previous) {
  if (!previous || isNaN(new Date(previous).getTime())) {
    return 'few seconds ago';
  }
 
  var msPerMinute = 60 * 1000;
  var msPerHour = msPerMinute * 60;
  var msPerDay = msPerHour * 24;
  var msPerMonth = msPerDay * 30;
  var msPerYear = msPerDay * 365;

  var elapsed = current.getTime() - previous.getTime();

  if (elapsed < msPerMinute) {
    return 'few seconds ago';
  } else if (elapsed < msPerHour) {
    var minute = Math.round(elapsed / msPerMinute);
    return minute + ((minute > 1) ? ' minutes ago' : ' minute ago');
  } else if (elapsed < msPerDay) {
    var hour = Math.round(elapsed / msPerHour);
    return hour + ((hour > 1) ? ' hours ago' : ' hour ago');
  } else if (elapsed < msPerMonth) {
    var day = Math.round(elapsed / msPerDay);
    return day + ((day > 1) ? ' days ago' : ' day ago');
  } else if (elapsed < msPerYear) {
    var month = Math.round(elapsed / msPerMonth);
    return month + ((month > 1) ? ' months ago' : ' month ago');
  } else {
    var year = Math.round(elapsed / msPerYear);
    return year + ((year > 1) ? ' years ago' : ' year ago');
  }
}

function showIcons(index) {
  document.getElementById(`deleteIcon_${index}`).querySelector('img').style.display = 'block';
  document.getElementById(`exportIcon_${index}`).querySelector('img').style.display = 'block';
  document.getElementById(`duplicateIcon_${index}`).querySelector('img').style.display = 'block';
}

function hideIcons(index) {
  document.getElementById(`deleteIcon_${index}`).querySelector('img').style.display = 'none';
  document.getElementById(`exportIcon_${index}`).querySelector('img').style.display = 'none';
  document.getElementById(`duplicateIcon_${index}`).querySelector('img').style.display = 'none';
}

function toggleDropdown() {
  document.getElementById("dropdown").style.display = document.getElementById("dropdown").style.display === "block" ? "none" : "block";
}

window.onclick = function (event) {
  if (!event.target.matches('.sort-icon')) {
    var dropdowns = document.getElementsByClassName("dropdown");
    for (var i = 0; i < dropdowns.length; i++) {
      var openDropdown = dropdowns[i];
      if (openDropdown.style.display === "block") {
        openDropdown.style.display = "none";
      }
    }
  }
}



window.addEventListener('load', Projects.init);



