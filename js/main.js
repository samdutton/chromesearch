var isReady;
var MINTRACKS = 250; // !!!hack to determine if getting/parsing data is complete
var numTracks = 0;
var trackPath = "tracks/";
var trackSuffix = ".srt";
var resultsDiv = $("#results");
var query;
var $query = $("#query");
var $numResults = $("#numResults");

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
		getYouTubeData(id); // update video data from the YouTube data API
	}
}

function handleGotAllTrackData(){
	isReady = true;
	var div = document.querySelector('div#queryExplanation');
	div.style.color = '#ccc';
	div.innerText =
		'Enter text to search transcripts, then click on a result to view video.';
	var input = document.querySelector('input#query');
	input.disabled = false;
	input.focus();
}

function addTrack(videoId, trackText){
	var lines = trackText.match(/^.*((\r\n|\n|\r)|$)/gm);
	var cues = videos[videoId].cues;
	var currentCue = {"text": "", "videoId": videoId};
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
				currentCue.text += line.replace(/\n/, " ");
			} else if (timings.length === 2) { // line is timing
				currentCue.startTime = toDecimalSeconds(timings[0]);
			}
		}
	}
	numTracks += 1;
	if (numTracks === MINTRACKS) {
		handleGotAllTrackData();
	}
}

// video data will also be updated from YouTube data API
function getCueData(videoId){
	videos[videoId].cues = [];
	var xhr = new XMLHttpRequest();
	xhr.open("GET", trackPath + videoId + trackSuffix);
	xhr.onreadystatechange = function() {
	  if (xhr.readyState === 4 && xhr.status === 200) {
	  	addTrack(videoId, xhr.responseText);
  	} // xhr.readyState === 4 && xhr.status === 200
  } // xhr.onreadystatechange
	xhr.send();
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

var youTubePlayer = document.querySelector(".youtube-player");
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

function displayResults(results) { // results is an array of cues
	document.querySelector("*").style.cursor = "";
	resultsDiv.empty();
  $("#numResults").empty();
	if ($query.val().length < 2) {
    return false;
  }

	var numResults = results.length;
	var currentVideoId, videoDiv, cuesDiv;
	var i;
	// enable searching for two letter combinations (for example)
	// but don't show results when there are too many matches
	if (numResults > 5000){
		$numResults.html(numResults + " results (too many to display)");
		return;
	} else {
		$numResults.html(numResults + " result(s)");
	}
  for (i = 0; i !== numResults; ++i) {
    var cue = results[i];
		// for each video (i.e. new currentVideoId)
		// create divs and add the video title,
		// then add a click handler to display video
		if (!currentVideoId || currentVideoId !== cue.videoId) {
			currentVideoId = cue.videoId;
			var video = videos[currentVideoId];
			videoDiv = $("<div class='video' />");

			var detailsDiv = $("<details class='videoDetails' />");
			detailsDiv.append("<summary class='videoTitle' title='Click to view video information'>" +
					video.title + "</summary>");
			detailsDiv.append("<img class='videoThumbnail' src='http://img.youtube.com/vi/" +
				currentVideoId + "/hqdefault.jpg' title='Default thumbnail image' />");
			if (!!video.summary){
				detailsDiv.append("<div class='videoSummary'>" + video.summary + "</div>");
			}
			detailsDiv.append("<div class='videoRating'><strong>Rating: </strong>" +
				video.rating + "</div>");
			detailsDiv.append("<div class='videoViewCount'><strong>View count: </strong>" +
				video.viewCount + "</div>");
			videoDiv.append(detailsDiv);

			if (video.speakers && video.speakers.length !== 0){
				videoDiv.append("<div class='speakers'>" + video.speakers.join(", ") + "</div>");
			}

			cuesDiv = $("<div class='cues' title='Click to play video at this point' />");
			videoDiv.append(cuesDiv);
			resultsDiv.append(videoDiv);
		}

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
}

function getResults(query){
	document.querySelector("*").style.cursor = "wait";
	$numResults.html("Searching...");
	var cues = [];
	for (id in videos){
		var video = videos[id];
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

