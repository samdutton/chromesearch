var isReady;
var trackPath = "tracks/";
var trackSuffix = ".srt";
var resultsDiv = $("#results");
var query;
var $query = $("#query");
var $numResults = $("#numResults");
var youTubePlayer = document.querySelector(".youtube-player");
var speakerRegEx = /^([A-Z\s]+):/;
var videosWithoutCues = ['e1FCrmGQwv4', 'h-ge4RRl9Vk', 'LjDKQaRmkDc', 'SKGoBEhhWSU', 'Sn_3rJaexKc', 'TdPqPUkXJ8E', 'vFacaBinGZ0', 'WWYz71WOrPg'];


getVideoData()

// do query if URL has query string
var href = document.location.href;
var q = href.split("?q=")[1];
if (q){
  query = q.replace(/[^a-zA-Z]/g, " ");
  $query.css('color', '#ddd');
  $query.val(query);
  var interval = setInterval(function(){
    if (isReady){
    $query.css('color', '#444');
      $numResults.html("Searching...");
      getResults(query);
      clearInterval(interval);
    }
  }, 1000);
}

function getVideoData() {
  // the keys for the videos object, defined in videos.js, are YouTube IDs
  for (var id in videos) {
    getCueData(id); // get cue data from .srt files in tracks folder
//    getYouTubeData(id); // update video data from the YouTube data API
  }
}

// function handleVideosComplete(){
//  console.log("finished! ", videos);
// }

// for each video, get cue texts from the track file (.vtt or .srt)]
// add cue texts to the cues array for the video
// and build the paras array for the video
// used to build a human readable transcript
// video data will also be updated from the YouTube data API
function getCueData(videoId){
  if (!hasCues(videoId)){
    return;
  }
  var xhr = new XMLHttpRequest();
  xhr.open("GET", trackPath + videoId + trackSuffix);
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4 && xhr.status === 200) {
      var track = xhr.responseText;
      var cues = videos[videoId].cues = [];
      var paras = videos[videoId].paras = [];
      var lines = track.match(/^.*((\r\n|\n|\r)|$)/gm);
      var currentCue = {"text": "", "videoId": videoId};
      var currentPara = '';
      for (var i = 0; i != lines.length; ++i){
        var line = lines[i];
        // if line is just a cue ID (i.e. just digits)
        if (line.match(/^\d+\s*$/)){
          if (currentCue.text) {
            // get rid of redundant whitespace after combining lines
            currentCue.text.trim();
            cues.push(currentCue);
            currentCue = {"text": "", "videoId": videoId}; // remove text!
          }
        } else if (line.match(/^\s*$/)){ // line is empty
          continue;
        } else { // line is timings or text
          var timings = line.match(/\d\d:\d\d:\d\d.\d\d\d/g);
          if (!timings){ // line is text
            // replace return with a space: cues may be split between two lines
            line = line.replace(/\n/, " ");
            currentCue.text += line;
            // if  this line introduces a speaker, add currentPara to paras
            // then start a 'new' currentPara with the text of this line
            if (line.match(/^([A-Z\s]+:)|>+/)) {
              // get rid of >> and >>> at beginning of line
              // capitalize speaker names (Fred Nerk not FRED NERK)
              line = line.replace(speakerRegEx, capitalize('\\$1')).replace(/^>+/, '');
              if (currentPara !== '') {
                paras.push(currentPara.trim());
              }
              currentPara = line;
            } else {
              currentPara += line;
            }
          } else if (timings.length === 2) { // line is timing
            currentCue.startTime = toDecimalSeconds(timings[0]);
          }
        }
      }
      // push final paragraph
      paras.push(currentPara.trim());

      var isIncomplete = false;
      // check if finished
      for (id in videos){
        // check if there is a video without cues
        // skip those that don't have an .srt file
        if (typeof videos[id].cues === "undefined" && hasCues(id)){
          isIncomplete = true;
          break;
        }
      }
      if (!isIncomplete) {
        handleVideosComplete();
      }

    } // xhr.readyState === 4 && xhr.status === 200
  } // xhr.onreadystatechange
  xhr.send();
}

// return false for videos for which there is currently no .srt file
function hasCues(id){
  return videosWithoutCues.indexOf(id) === -1;
}

function handleVideosComplete(){
  isReady = true;
  var div = document.querySelector('div#queryExplanation');
  div.style.color = '#ccc';
  div.textContent =
    'Enter text to search transcripts, then click on a result to view video.';
  var input = document.querySelector('input#query');
  input.disabled = false;
  input.focus();
}

// update video data from YouTube data API
function getYouTubeData(videoId){
  try {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "http://gdata.youtube.com/feeds/api/videos/" + videoId + "?alt=json");
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        var obj = JSON.parse(xhr.responseText);
        videos[videoId].viewCount = obj.entry.yt$statistics.viewCount;
        if (obj.entry.gd$rating && obj.entry.gd$rating.average){
          videos[videoId].rating = obj.entry.gd$rating.average;
        } else {
          videos[videoId].rating = '';
        }
      }
    }
    xhr.send();
  } catch(e){
    console.log(e);
  }
}

// http://storage.googleapis.com/io2012/headshots/mkwst.jpg

function displayResults(results) { // results is an array of cues
  // get rid of wait cursor
  document.querySelector("*").style.cursor = "";
  resultsDiv.empty();
  $("#numResults").empty();

  // search is enabled for two or more characters
  if ($query.val().length < 2) {
    return false;
  }
  var numResults = results.length;
  // ...but results aren't displayed when there are too many matches
  if (numResults > 5000){
    $numResults.html(numResults + " results (too many to display)");
    return;
  } else {
    $numResults.html(numResults + " result(s)");
  }

  var videoId, videoDiv;
  // each result is a cue, each cue has the id of its video
  for (var i = 0; i !== numResults; ++i) {
    var cue = results[i];
    // for each new video id create a new videoDiv
    if (!videoId || videoId !== cue.videoId) {
      videoId = cue.videoId;
      videoDiv = $("<div class='video' />");
      var video = videos[videoId];
      displayVideo(videoDiv, video);
    }
    displayCue(videoDiv, cue);
  }
}

// create a new videoDiv and add video information
function displayVideo(videoDiv, video){
  var videoDetails = $("<details class='videoDetails' />");
  videoDetails.append("<summary class='videoTitle' title='Click to view video information'>" +
      video.title + "</summary>");
  videoDetails.append("<img class='videoThumbnail' src='http://img.youtube.com/vi/" +
    video.id + "/hqdefault.jpg' title='Default thumbnail image' />");
  if (!!video.summary){
    videoDetails.append("<div class='videoSummary'>" + video.summary + "</div>");
  }
  videoDetails.append("<div class='videoRating'><strong>Rating: </strong>" +
    video.rating + "</div>");
  videoDetails.append("<div class='videoViewCount'><strong>View count: </strong>" +
    video.viewCount + "</div>");
  videoDiv.append(videoDetails);

  if (video.speakers && video.speakers.length !== 0){
    videoDiv.append("<div class='speakers'>" + video.speakers.join(", ") + "</div>");
  }

  var transcriptDetails = $("<details class='transcript' />");
  transcriptDetails.append("<summary class='transcriptTitle' title='Click to view transcript'>Transcript</summary>");
  for (var i = 0; i !== video.paras.length; ++i) {
    var paraText = video.paras[i];
    transcriptDetails.append("<p>" + paraText + "</p>");
  }
  videoDiv.append(transcriptDetails);
  resultsDiv.append(videoDiv);
}

function displayCue(videoDiv, cue){
  cuesDiv = $("<div class='cues' title='Click to play video at this point' />");
  videoDiv.append(cuesDiv);

  var cueStartTimeHTML = "<span class='cueStartTime'>" +
    toHoursMinutesSeconds(cue.startTime) + ": </span>";
  var cueTextHTML = cue.text.replace(new RegExp("(" + query +
    ")", "gi"), "<em>$1</em>"); // empasise query
  cueTextHTML = "<span class='cueText'>" + cueTextHTML + "</span>";
  // add cue to div.cues
  var cueDiv =
    $("<div class='cue'>" +
    cueStartTimeHTML +
    cueTextHTML +
    "</div>");
  addClickHandler(cueDiv, cue);
  cuesDiv.append(cueDiv);
}

// toggle display of cue or query results
function addClickHandler(cueDiv, cue) {
  cueDiv.click(function() {
    // don't reload video if the clicked cue is for current video
    if (youTubePlayer.src.indexOf(cue.videoId) != -1){
      callPlayer("youTubePlayer", "seekTo", [cue.startTime]);
    } else {
      youTubePlayer.src =
        "http://www.youtube.com/embed/" + cue.videoId +
        "?start=" + cue.startTime +
        "&autoplay=1&enablejsapi=1"
    }
  });
}

function getResults(query){
  document.querySelector("*").style.cursor = "wait";
  $numResults.html("Searching...");
  var cues = [];
  for (id in videos){
    var video = videos[id];
    // a few videos currently don't have transcripts - see hasCues()
    if (!video.cues){
      continue;
    }
    for (var i = 0; i != video.cues.length; ++i) {
      var cue = video.cues[i];
      var re = new RegExp(query, "i");
      if (re.test(cue.text)) {
        cues.push(cue);
      }
    }
  }
  displayResults(cues);
}

$query.bind('input', function() {
  resultsDiv.empty();
  query = $(this).val();
  if (query.length < 2) {
    $numResults.empty();
    return false;
  }
  // add 300ms delay between getting keypresses
  if(typeof(window.inputTimeout) != "undefined"){
    window.clearTimeout(inputTimeout);
  }
  window.inputTimeout = window.setTimeout(function() {
    getResults(query);
  }, 300);
});

function elapsedTimer(message) {
    if (elapsedTimer.isStarted) {
        console.log(message, (Date.now() - elapsedTimer.startTime));
        elapsedTimer.startTime = Date.now();
    } else {
        elapsedTimer.startTime = Date.now();
        elapsedTimer.isStarted = true;
    }
}

// srt format is 01:01:58,310 (it's French, hence the comma)
// hours:minutes:seconds,milliseconds
function toDecimalSeconds(srtTime) {
  var split = srtTime.match(/\d{2}/g);
  // hours, minutes, seconds -- ignore milliseconds
  return split[0] * 3600 + split[1] * 60 + split[2] * 1; // must convert from string
}

// Convert decimal time to hh:mm:ss
// e.g. convert 123.3 to 2:03
function toHoursMinutesSeconds(decimalSeconds){
  var hours = Math.floor(decimalSeconds/3600);
  var mins = Math.floor((decimalSeconds - hours * 3600)/60);
  var secs = Math.floor(decimalSeconds % 60);
  if (secs < 10) {
    secs = "0" + secs
  };
  return hours + ":" + mins + ":" + secs;
}

// from stackoverflow.com/questions/17200640/javascript-capitalize-first-letter-of-each-word-in-a-string-only-if-lengh-2?rq=1
function capitalize(string){
  return string.toLowerCase().replace(/\b[a-z](?=[a-z]+)/g, function(letter) {
    return letter.toUpperCase(); } )
}
