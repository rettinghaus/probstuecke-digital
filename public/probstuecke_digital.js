currentParams = {
  page: 1,
  nr: 1,
  display: [],
  modernClefs: false,
  emptyStaffsBelow: 0,
  emptyStaffsAbove: 0,
  lang: "de",
  exportFormat: "pdf"
};

// ------
// Helper functions
// ------


// TEMPORARY
function copyToClipboard(text) {
  if (!navigator.clipboard) {
    printError("no fallback");
    return;
  }
  navigator.clipboard.writeText(text).then(function() {
    //printError('Async: Copying to clipboard was successful!');
  }, function(err) {
    printError('Async: Could not copy text: ', err);
  });
}

function printError(message) {
  $("#error").text(message);
  $("#error").show().fadeOut("slow");
}

async function highlight(element) {
  if (element.length == 0) {
    currentParams.page = parseInt(currentParams.page, 10) + 1;
    await updateView(true);
    highlight(element);
    return;
  }
  element.addClass("highlight");
  setTimeout(function () {
    $(element).removeClass('highlight');
  }, 3000);
}

function getSvgElementBoxAsCss(target) {
  var bRect = target[0].getBoundingClientRect();
  return {
        top: bRect.top,
        left: bRect.left,
        width: bRect.width,
        height: bRect.height
  };
}

// ------
// MIDI player
// ------

var midiTimemap = {};
var midiData = {};

updateCounter = 1;
var midiUpdate = function(time) {
  // TODO time and the tstamps from midiTimemap are not identical.
  // An aprroximate lookup would be necessary.
}

// ------
// update view functions
// ------

let staffLabels = {
  "mattheson": "Matthson's annotations",
  "basse-fondamentale": "<i>basse fondamentale</i> (Rameau)",
  "fundamental-notes": "<i>Grund-Noten</i> (Mattheson)",
  "pfeffer": "by Niels Pfeffer"
};

function displayCheckboxes(block, group) {
  if (block) {
    for (var i=0; i<block.length; i++) {
      var blockName = block[i];
      if (i!=0) {
        $("#" + group).append('<br />');
      }
      
      $('<input type="checkbox" id="' + blockName + '" autocomplete="off">').appendTo("#" + group).change(function() {
        if ($(this).is(':checked')) {
          currentParams.display.push($(this).attr("id"));
        } else {
          currentParams.display.splice($.inArray($(this).attr("id"), currentParams.display), 1);
        }
        updateView(true);
      });
      $("#" + blockName)[0].checked = currentParams.display.includes(blockName);
      $("#" + group).append('<label for="' + blockName + '">' + staffLabels[blockName] + '</label>');
    }
  }
}

async function updateDescription() {
  let data;
  
  try {
    data = await $.get("description?nr=" + currentParams.nr);
  } catch (error) {
    printError("failed loading description: " + error);
  }
  
  $("#realizations").empty();
  $("#analysis").empty();
  $("#available-annotations").empty();
  
  var realizations = data.realizations;
  var analysis = data.analysis;
  var annotations = data.annotations;
  
  displayCheckboxes(realizations, "realizations");
  displayCheckboxes(analysis, "analysis");
  
  
  if (annotations) {
    $("#available-annotations").append('<select id="lang" name="lang" autocomplete="off">');
    for (var i=0; i<annotations.length; i++) {
      if (annotations[i] == "de") {
        $("#lang").append('<option value="de">Deutsch (second edition, Hamburg 1731)</option>');
      //} else if (annotations[i] == "facsimile") {
      //  $("#lang").append('<option value="facsimile">Facsimile (second edition)</option>');
      } else if (annotations[i] == "en") {
        $("#lang").append('<option value="en">English (second edition)</option>');
      } else if (annotations[i] == "1st") {
        $("#lang").append('<option value="1st">Deutsch (first edition, Hamburg 1719)</option>');
      } else if (annotations[i] == "comments") {
        $("#lang").append('<option value="comments">Comments</option>');
      }
    }
    $("#available-annotations").append('</select>');
    
    $("option[value='" + annotations[0] + "']")[0].selected = true;
    currentParams.lang = annotations[0];
    
    $("#lang").change(async function() {
      currentParams.lang = $(this).val();
      await Promise.all([updateAnnotations(), renderCurrentPage()]);
      reconnectCrossRefs();
    });
  }
}

async function updateAnnotations() {
  let data;
  
  try {
    data = await $.get("annotations?" + $.param({nr: currentParams.nr, lang: currentParams.lang}));
  } catch (error) {
    printError("failed updating annotations: " + error);
  }
  
  var cetei = new CETEI();
  cetei.domToHTML5(data, function(html) {
    $("#annotations-view").html(html);
    $("#annotations-view tei-facsimile img").hide();
  });
  

  // load the music examples, if there are any
  $("tei-notatedmusic").each(async function() {
    var notatedmusic = $(this);
    let svg;
  
    try {
      svg = await $.get("music-example?" + $.param({
        nr: currentParams.nr,
        filename: $(this).find("tei-ptr").attr("target"),
        modernClefs: currentParams.modernClefs
      }));
    } catch (error) {
      printError("failed loading embedded music example: " + error);
    }
  
    notatedmusic.find("tei-ptr").replaceWith(svg);
  
    var svg1 = notatedmusic.find("svg")[1];
    var bb=svg1.getBBox();
    var bbw=bb.width;
    var bbh=bb.height;
    svg1.setAttribute("viewBox", [bb.x,bb.y,bbw,bbh].join(" "));
    notatedmusic.find("svg").css({
      width: (bbw/1000)*28.34 + "px",
      height: (bbh/1000)*28.34 + "px"
    });
  });
}

async function renderCurrentPage() {
  let response;
  
  try {
    response = await $.get("render?" + $.param(currentParams));
  } catch (error) {
    printError("failed rendering page: " + error);
  }
  
  if (currentParams.page > response.pageCount) {
    currentParams.page = 1;
    updateView(false);
    return;
  }
  
  midiTimemap = response.timemap;
  console.log(midiTimemap);
  midiData = response.midi;
  var piece = 'data:audio/midi;base64,' + midiData;
  $("#player").show();
  $("#player").midiPlayer.load(piece);
  
  var svg = response.svg;
  
  $("#score-view").html(svg);
}

function reconnectCrossRefs() {
  $("tei-ref").each(function() {
    // find target in SVG
    let target = $("#score-view svg").find("#" + $(this).attr("target"));
    let teiRef = $(this);
    if (target.length === 0) {
      console.log("corresponding SVG element not found on this page.");
      return true; // nothing found, continue with next reference
    }
    
    // highlight the target
    var svg = SVG.get($(this).attr("target"));
    let bbox = svg.bbox();
    let rect = svg.rect(bbox.width,bbox.height).move(bbox.x,bbox.y).fill("#ffe47a").attr("class", "indicator");
    rect.back();
    
    // connect indicator with text
    rect.click(function() {
      // scroll to reference point and then highlight it
      var annotationView = $("#annotations-view");
      annotationView.animate({
          scrollTop: teiRef.offset().top - annotationView.offset().top + annotationView.scrollTop()
      }, 100, function() {
        highlight(teiRef);
      });
    });
    
    // connect text with an indicator
    $(this).find("a").click(function(e) {
      e.preventDefault();
      rect.animate(500).attr({opacity: 0}).animate().attr({opacity: 1});
    });
  });
}

function positionAtMouse(el, e) {
  el.css({
    position: "absolute",
    left: e.pageX+5,
    top: e.pageY+5
  });
  
  if (e.pageX+el.width()*0.6 > $(window).width()) {
    el.css({
      left: e.pageX-el.width()*0.6-20
    });
  }
  if (e.pageY+el.height()*0.6 > $(window).height()) {
    el.css({
      top: e.pageY-el.height()*0.6-20
    })
  }
}

function cleanUpTooltips() {
  $("#tooltips").empty();
  $(".tooltip-overlay").remove();
}

function connectTooltips() {
  cleanUpTooltips();
  
  if (!$("#show-tooltips").is(":checked")) {
    $(".tooltip-overlay").remove();
    return;
  }
  
  var keySig = $("#score-view svg").find(".keySig");
  if (keySig.length != 0) {
    var annotation = $("tei-note[type='on-key-signature'] span[data-original='']");
    
    $("<div class='tooltip-overlay' />").appendTo("body").css(getSvgElementBoxAsCss(keySig)).mouseenter(function(e) {
      let tooltips = $("#tooltips");
      $("<div class='tooltip tooltip-text' />").append(annotation.text()).appendTo("#tooltips");
      positionAtMouse(tooltips, e);
    }).mouseleave(function(e) {
      $("#tooltips").empty();
    });
    
    annotation.parent().remove();
  }
  
  var meterSig = $("#score-view svg").find(".meterSig");
  if (meterSig.length != 0) {
    var annotation = $("tei-note[type='on-meter'] span[data-original='']");
    
    $("<div class='tooltip-overlay' />").appendTo("body").css(getSvgElementBoxAsCss(meterSig)).mouseenter(function(e) {
      let tooltips = $("#tooltips");
      $("<div class='tooltip tooltip-text' />").append(annotation.text()).appendTo("#tooltips");
      positionAtMouse(tooltips, e);
    }).mouseleave(function(e) {
      $("#tooltips").empty();
    });
    
    annotation.parent().remove();
  }
  
  // ----
  // connecting transcription and facsimile
  // ----
  $("tei-body").find("tei-graphic img").on("load", function() {
    let surface = $(this).parent().parent();
    let zoom = $(this)[0].width / surface.attr("lrx");
    let url = $(this).attr("src");
    
    surface.children("tei-zone").each(function() {
      var zone = $(this);
      let ulx = zone.attr("ulx");
      let uly = zone.attr("uly");
      let lrx = zone.attr("lrx");
      let lry = zone.attr("lry");
      
      let corresp = $(this).attr("corresp");
      let prevCorresp = $(this).prev().attr("corresp");
      if (!prevCorresp) {
        prevCorresp = $(this).parent().prev().find("tei-zone").last().attr("corresp");
      }
      
      console.log("corresp: " + corresp);
      console.log("prevCorresp: " + prevCorresp);
      
      var target = $("body").find(corresp);
      if (target.length > 0) {
        if (prevCorresp != corresp) {
          target.off("mouseenter");
        }
        
        target.mouseenter(function(e) {
          if (prevCorresp != corresp) {
            positionAtMouse($("#tooltips"), e);
          } else {
            $("<div class='system-break'>⤶</div>").appendTo("#tooltips");
          }
          $("<div class='tooltip' />").css({
            backgroundImage: "url(" + url + ")",
            backgroundPosition: (-ulx) + "px " + (-uly) + "px",
            width: lrx-ulx,
            height: lry-uly
          }).appendTo("#tooltips");
          positionAtMouse($("#tooltips"), e);
        }).mouseleave(function() {
          $("#tooltips").empty();
        });
      }
    });
  }).each(function() {
    if(this.complete) { $(this).trigger('load'); }
  });
  
  
  // temporary code for allowing faster MEI editing
  //console.log("measures found:" + $("#score-view svg").find(".measure").length);
  //$("#score-view svg").find(".measure").on("click", function() {
  //  copyToClipboard("#" + $(this).attr("id"));
  //  printError("copied to clipboard");
  //});
  //  
  //meiStrings = [];
  //$("#score-view svg").find(".note, .rest").one("click", function() {
  //  console.log(meiStrings);
  //  let id = $(this).attr("id");
  //  printError("note " + id + " recognized");
  //  $("#copyright").empty();
  //  $("#copyright").append("<input type='text' id='figures'>");
  //  $("#figures").focus();
  //  $('#figures').keypress(function (e) {
  //    if (e.which == 13) {
  //      var figures = $(this).val().replace("b", "♭").replace("6/", "6⃥").replace("n", "♮").split(",");
  //      var meiString = "<harm place='above' staff='2' startid='" + id + "'><fb>";
  //      for (var i=0; i<figures.length; i++) {
  //        meiString += "<f>" + figures[i] + "</f>";
  //      }
  //      meiString +="</fb></harm>";
  //      meiStrings.push(meiString);
  //      printError("added");
  //      $(this).val("");
  //      return false;
  //    }
  //  });
  //  $("<button>copy to clipboard</button>").on("click", function() {
  //    copyToClipboard(meiStrings.join("\n"));
  //    printError("copied to clipboard");
  //    meiStrings = [];
  //  }).appendTo("#copyright");
  //});
  
}

async function updateView(resetting) {
  if (currentParams.page < 1) {
    currentParams.page = 1;
  }
  
  if (resetting) {
    await updateDescription();
  }
  await Promise.all([renderCurrentPage(),updateAnnotations()]);
  
  reconnectCrossRefs();
  connectTooltips();
}

async function updateScoreView() {
  await renderCurrentPage();
  reconnectCrossRefs();
  connectTooltips();
}

$(document).ready(function() {
  
  $("#player").midiPlayer({
      onUpdate: midiUpdate,
      width: 150
  });
  
  // ------
  // view controls
  // ------
  
  $("#nr").change(function() {
    currentParams.nr = $(this).val();
    currentParams.page = 1;
    updateView(true);
  });
  
  $("#staves-below").change(function() {
    currentParams.emptyStaffsBelow = $(this).val();
    updateScoreView();
  });
  
  $("#staves-above").change(function() {
    currentParams.emptyStaffsAbove = $(this).val();
    updateScoreView();
  });
  
  $("#show-fb").change(function() {
    $("#score-view svg").find(".fb").toggle($(this).is(':checked'));
  });
  
  $("#show-tooltips").change(function() {
    updateView(false);
  });
  
  $("#previous-page").click(function() {
    currentParams.page = parseInt(currentParams.page, 10) - 1;
    updateScoreView();
  });
  
  $("#next-page").click(function() {
    currentParams.page = parseInt(currentParams.page, 10) + 1;
    updateScoreView();
  });
  
  $("#modern-clefs").change(function() {
    currentParams.modernClefs = $(this).is(':checked');
    // a change in the cleffing may also affect examples in the annotations,
    // therefore a complete update is performed.
    updateView(false);
  });
  
  $("#export").click(function() {
    currentParams.exportFormat = $("#export-format").val();
    window.open("/download?" + $.param(currentParams), "about:blank");
  });
  
  updateView(true);
});
