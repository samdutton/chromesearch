var isReady;
var trackPath = "tracks/";
var trackSuffix = ".srt";
var transcriptPath = "transcripts/";
var transcriptSuffix = ".html";
var input = document.querySelector('input#query');
var searchButton = document.querySelector('button');
var progressElement = document.querySelector('progress');
progressElement.max = Object.keys(videos).length;
var queryExplanation = document.querySelector('div#queryExplanation');
var resultsDiv = document.querySelector("#results");
var query;
var $query = $("#query");
var $numResults = $("#numResults");
var youTubePlayer = document.querySelector(".youtube-player");
// TODO!
//var speakerRegEx = /^([A-Z\s]+):/;
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
      var speakers = videos[videoId].speakers = [];
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
            // console.log(currentCue.text);
            cues.push(currentCue);
            currentCue = {"text": "", "videoId": videoId}; // 'reset' currentCue
          }
        } else if (line.match(/^\s*$/)){ // line is empty
          continue;
        } else { // line is timings or text
          var timings = line.match(/\d\d:\d\d:\d\d.\d\d\d/g);
          if (!timings){ // line is text
            // replace return with a space: cues may be split between two lines
            // get rid of angle brackets at start of line (for speakers)
            line = line.
              replace(/\n/, " ").
              replace(/>>> /, 'Audience member: ').
              replace(/^>+/, '');
            // if  this line introduces a speaker, add currentPara to paras
            // then start a 'new' currentPara with the text of this line
            // speaker lines begin with a name followed by a colon
            // space and word character after colon is to avoid lines using colon for punctuation
            if (/^[A-Z][A-Za-z]+ ?[A-Za-z]*\-?[A-Za-z]*: [\w-]/.test(line) || (/^AUDIENCE/).test(line)) {
              var speakerName = line.match(/^([A-Za-z\-\s]+):/)[1];
              // capitalize speaker names: Fred Nerk not FRED NERK
              if (line.match(/^[A-Z\-\s]+:/)) {
                var allcaps = line.match(/^([A-Z\-\s]+):/)[1];
                speakerName = capitalize(allcaps);
                line = line.replace(/^([A-Z\-\s]+)/, speakerName);
              }
              speakerName = tweakName(speakerName);
              if (speakers.indexOf(speakerName) === -1 && ['Audience', 'Audience member', 'Male Speaker', 'Female Speaker', 'All', 'Playback', 'Man', 'Announcer', 'Moderator', 'Producer', 'Fundamentals', 'Female Voice'].indexOf(speakerName) === -1){
                speakers.push(speakerName);
              }

              line = line.replace(/^([A-Za-z\-\s]+):/,
                '<span class="speakerName">' + speakerName + '</span>:');
              // add startTime data attribute, used to make transcripts clickable
              line = '<span class="line" data-starttime="' + currentCue.startTime + '">' + line + '</span>';
              // a line introducing a speaker means a new currentPara
              // ...so push the 'old' currentPara
              if (currentPara !== '') {
                paras.push(currentPara.trim());
              }
              // ...and set the value for the 'new' one
              currentPara = line;
            } else {
              // if the current line does not introduce a speaker, add it to currentPara
              // add startTime data attribute, used to make transcripts clickable
              line = '<span class="line" data-startTime="' + currentCue.startTime + '">' + line + '</span>';
              currentPara += line;
            }
            currentCue.text += line;
          } else if (timings.length === 2) { // line is timing
            currentCue.startTime = toDecimalSeconds(timings[0]);
          }
        }
      }
      // push final paragraph
      paras.push(currentPara.trim());

      progressElement.value += 1;

      // Used when creating transcript files
      // downloadTranscript(videos[videoId], paras);

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

// Used when creating transcript files
// function downloadTranscript(video, paras){
//   var okParas = [];
//   for (var i = 0; i !== paras.length; ++i) {
//     var para = video.paras[i];
//     var MAXLENGTH = 1000 + Math.floor(Math.random() * 2000);
//     if (para.length < MAXLENGTH) {
//       okParas.push(para);
//     } else {
//       okParas = okParas.concat(split(para));
//     }
//   }
//   okParas = okParas.map(function(item){
//     if (item.indexOf('speakerName') > 0) {
//       return '<p class="speaker">' + item.trim() + '</p>';
//     } else {
//       return '<p>' + item.trim() + '</p>';
//     }
//   });

//   var downloadHTML = okParas.join('\n\n').replace(/--/g, ' &mdash; ');
//   var downloadLink = document.createElement('a');
//   downloadLink.classList.add('download');
//   downloadLink.download = video.id + '.html';
//   downloadLink.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(downloadHTML);
//   downloadLink.click();
// }

function handleVideosComplete(){
  isReady = true;
  searchButton.disabled = false;
  queryExplanation.style.color = '#ccc';
  queryExplanation.innerHTML =
    'Enter text then press Return or click the Search button.';
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
  $("#numResults").empty();

  var numResults = results.length;
  // ...but results aren't displayed when there are too many matches
  if (numResults > 5000){
    $numResults.html(numResults + " results (too many to display)");
    return;
  } else {
    queryExplanation.textContent = 'Click on a match to view video.';
    $numResults.html(numResults + " match(es)");
  }

  var cuesDiv, matchesDetails, videoId, videoDiv;
  // each result is a cue, each cue has the id of its video
  for (var i = 0; i !== numResults; ++i) {
    var cue = results[i];
    // for each new video id create a new videoDiv
    if (!videoId || videoId !== cue.videoId) {
      videoId = cue.videoId;
      videoDiv = document.createElement('div');
      videoDiv.classList.add('video');
      var video = videos[videoId];

      addVideoDetails(videoDiv, video);

      matchesDetails = document.createElement('details');
      matchesDetails.classList.add('matches');
      var summary = document.createElement('summary');
      summary.textContent = 'Matches';
      matchesDetails.appendChild(summary);
      videoDiv.appendChild(matchesDetails);

      addTranscriptDetails(videoDiv, video);
      resultsDiv.appendChild(videoDiv);
    } // end adding elements for new video

    // add individual match
    addMatch(matchesDetails, cue);
  }
}

// create a new details element and add video information
function addVideoDetails(videoDiv, video){
  var h2 = document.createElement('h2');
  h2.innerHTML = video.title; // title may include HTML
  videoDiv.appendChild(h2);

  if (video.speakers && video.speakers.length !== 0){
    var speakersDiv = document.createElement('div');
    speakersDiv.classList.add('speakers');
    speakersDiv.innerHTML =
      video.speakers.join(', ').replace(/([^,]) /g, '\$1&nbsp;');
    videoDiv.appendChild(speakersDiv);
  }

  var details = document.createElement('details');
  details.title = 'Click to view video';
  var summary = document.createElement('summary');
  summary.classList.add('video');
  summary.textContent = 'Video';
  details.appendChild(summary);

  var videoThumbnail = new Image();
  videoThumbnail.classList.add('videoThumbnail');
  videoThumbnail.title='Click to view video';
  videoThumbnail.src = 'http://img.youtube.com/vi/' + video.id + '/hqdefault.jpg';
  addClickHandler(videoThumbnail, video.id, 0);
  details.appendChild(videoThumbnail);

  if (!!video.summary){
    var summaryDiv = document.createElement('div');
    summaryDiv.classList.add('summary');
    summaryDiv.innerHTML = video.summary;
    details.appendChild(summaryDiv);
  }

  var videoRating = document.createElement('div');
  videoRating.classList.add('videoRating');
  videoRating.innerHTML = '<strong>Rating: </strong>' + video.rating;
  details.appendChild(videoRating);

  var videoViewCount = document.createElement('div');
  videoViewCount.classList.add('videoViewCount');
  videoViewCount.innerHTML = '<strong>View count: </strong>' + video.viewCount;
  details.appendChild(videoViewCount);

  videoDiv.appendChild(details);
}

// create a new details element and add the transcript
function addTranscriptDetails(videoDiv, video){
  var details = document.createElement('details');
  details.classList.add('transcript');
  var summary = document.createElement('summary');
  summary.classList.add('transcript');
  summary.title = 'Click to view transcript';
  summary.textContent = 'Transcript';
  details.appendChild(summary);
  var transcriptDiv = document.createElement('div');
  details.appendChild(transcriptDiv);

  var downloadLink = document.createElement('a');
  downloadLink.classList.add('download');
  downloadLink.download = video.title.replace(/ /g, '_').replace(/&mdash;/, '-') + '.html';
  downloadLink.textContent = 'download';
  videoDiv.appendChild(downloadLink);

  videoDiv.appendChild(details);

  var xhr = new XMLHttpRequest();
  xhr.open("GET", transcriptPath + video.id + transcriptSuffix);
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4 && xhr.status === 200) {

      var transcript = xhr.responseText;
      transcriptDiv.innerHTML = transcript;
      var lineSpans = transcriptDiv.querySelectorAll('span.line');
      for (var i = 0; i !== lineSpans.length; ++i) {
        var lineSpan = lineSpans[i];
        if (!lineSpan.onclick) {
          addClickHandler(lineSpan, video.id,
            lineSpan.dataset.starttime);
        }
      }

      var style = '<style>* {font-family: "Open Sans", sans-serif}\na {color: #77aaff}\na.video {border-bottom: 1px solid #ddd; display: block; margin: 0 0 2em 0; padding: 0 0 2em 0}\nh2 {color: #444; font-size: 18px;}\nspan.speakerName {color: black; font-weight: 900;}\nbody {padding: 2em}\np {color: #444; margin: 0; text-indent: 1.5em;}\np.speaker {margin: 1em 0 0 0; text-indent: 0;}\ndiv#transcript > p:first-child {text-indent: 0;}\n</style>\n\n';
      var downloadHTML = style +
        '<h1>' + video.title + '</h1>\n\n' +
        '<h2>' + video.speakers.join(', ') + '</h2>\n\n' +
        '<a class="video" href="http://youtu.be/' + video.id + '">youtu.be/' + video.id + '</a>' + '<div id="transcript">' +
        transcript + '</div>'
      downloadLink.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(downloadHTML);

    } // xhr.readyState === 4 && xhr.status === 200
  } // xhr.onreadystatechange
  xhr.send();
}

function split(para) {
  // split after the end of each sentence:
  // each sentence ends with a full stop
  // followed by a span closing tag
  var sentences = para.
    replace(/\. <\/span>/g, '. </span>%^&*').split('%^&*');
  var paras = [];
  var para = '';
  while (sentences.length > 0) {
    para += sentences.shift() + ' ';
    MAXLENGTH = 1000 + Math.floor(Math.random() * 2000);
    if (para.length > MAXLENGTH){
      paras.push(para);
      para = '';
    }
  }
  paras.push(para); // the last one, not over-length
  return paras;
}

function addMatch(matchesDetails, cue){

  var cueStartTimeHTML = "<span class='cueStartTime'>" +
    toHoursMinutesSeconds(cue.startTime) + ": </span>";
  var cueTextHTML = cue.text.replace(new RegExp("(" + query +
    ")", "gi"), "<em>$1</em>"); // empasise query
  cueTextHTML = "<span class='cueText'>" + cueTextHTML + "</span>";

  var cueDiv = document.createElement('div');
  cueDiv.classList.add('cue');
  cueDiv.innerHTML = cueStartTimeHTML + cueTextHTML;
  addClickHandler(cueDiv, cue.videoId, cue.startTime);
  matchesDetails.appendChild(cueDiv);
}

function addClickHandler(element, videoId, startTime) {
  element.onclick = function() {
    console.log(videoId, startTime);
    // don't reload video if the clicked cue is for current video
    if (youTubePlayer.src.indexOf(videoId) != -1){
      callPlayer("youTubePlayer", "seekTo", [startTime]);
    } else {
      youTubePlayer.src =
        "http://www.youtube.com/embed/" + videoId +
        "?start=" + startTime +
        "&autoplay=1&enablejsapi=1"
    }
  };
}

function getResults(query){
  document.querySelector("*").style.cursor = "wait";
  $numResults.html("Searching...");
  var cues = [];
  for (id in videos){
    var video = videos[id];
    // a few videos currently don't have transcripts - see hasCues()
    if (video.cues){
      for (var i = 0; i != video.cues.length; ++i) {
        var cue = video.cues[i];
        var re = new RegExp(query, "i");
        if (re.test(cue.text)) {
          cues.push(cue);
        }
      }
    }
  }
  displayResults(cues);
}

function search() {
  resultsDiv.innerHTML = '';
  // var firstChild = resultsDiv.firstChild;
  // while(firstChild) {
  //   resultsDiv.removeChild(firstChild);
  //   firstChild = resultsDiv.firstChild;
  // }

  query = input.value;
  if (query.length < 3) {
    $numResults.empty();
    return false;
  }
    getResults(query);
};

searchButton.onclick = search;
input.onkeydown = function(e){
  if (e.keyCode === 13) {
    search();
  }
}

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

function tweakName(name){
  return name.replace('Pete Lepage', 'Pete LePage'). replace('Colt Mcanlis', 'Colt McAnlis').replace('Matthew Mcnulty', 'Matthew McNulty').replace('John Mcgowan', 'John McGowan').replace('John Mccutchan', 'John McCutchan').replace('Pete Beverloo', 'Peter Beverloo').replace(/^Irish$/, 'Paul Irish').replace(/^Feldman$/, 'Pavel Feldman').replace(/^Fisher$/, 'Darin Fisher').replace('Tv Raman', 'TV Raman').replace('Matt Mcnulty', 'Matthew McNulty').replace('Wiltzius', 'Tom Wiltzius').replace(/^Kay$/, 'Erik Kay').replace(/^Cromwell$/, 'Ray Cromwell').replace(/^Wilson$/, 'Chris Wilson').replace('Kc Austin', 'KC Austin').replace('Chris Dibona', 'Chris DiBona');
}

// Close all details elements when left arrow clicked
document.body.onkeydown = function(e){
  if (e.keyCode === 39) {
    openDetails(true);
  } else if (e.keyCode === 37) {
    openDetails(false);
  }
}

function openDetails(doOpen) {
  var details =
    document.querySelectorAll('details.transcript, details.matches');
  for (var i = 0; i !== details.length; ++i) {
    // TODO: remove open, only do close
    if (doOpen) {
      if (details[i].offsetTop > window.scrollY) {
        details[i].open = 'open';
        return;
      }
    } else {
      details[i].removeAttribute('open');
    }
  }
}

function isMobile() {
  return navigator.appVersion.indexOf("Mobile") !== -1;
}
