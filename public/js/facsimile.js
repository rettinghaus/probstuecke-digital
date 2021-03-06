const manifests = {
  '1st': 'https://api.digitale-sammlungen.de/iiif/presentation/v2/bsb10527431/manifest',
  'de': 'https://api.digitale-sammlungen.de/iiif/presentation/v2/bsb10598495/manifest'
}

$(async function() {
  // collect all the affected canvas IDs from the AnnotationList
  let iiif;
  try {
    iiif = await $.get("/iiif/" + number + "/list/" + "facsimile_" + edition);
  } catch(e) {
    console.error("Could not load IIIF AnnotationList");
    return;
  }

  let windowObjects = [];
  iiif.resources.forEach(function(r) {
    let canvasUri = r.on;
    let target = r.resource['@id'];

    if (target.includes('pb')) {
      windowObjects.push({
        loadedManifest: manifests[edition],
        canvasID: canvasUri,
        viewType: "ImageView",
        displayLayout: false,
        bottomPanel: false,
        bottomPanelAvailable: false,
        bottomPanelVisible: false,
        sidePanel: false
      });
    }
  });

  // create the mirador instance
  myMiradorInstance = Mirador({
    "id": "viewer",
    "layout": "1x1",
    "buildPath": "",
    mainMenuSettings: {
      show: false
    },
    "data": [
      { "manifestUri": manifests[edition], "location": "BSB"}
    ],
    "windowObjects": windowObjects,
    "annotationEndpoint": { "name":"Local Storage", "module": "LocalStorageEndpoint" },
    "windowSettings": {
      "canvasControls": {
        "imageManipulation" : {
          "manipulationLayer" : false,
          "controls" : {
            "mirror" : true
          }
        }
      }
    }
  });
});
