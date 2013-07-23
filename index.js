var localCouchName = 'videos';
var localHost = 'http://localhost:5984';
var remoteHost = 'https://chrome.iriscouch.com';
var dbName = 'videos';
var remoteCouchURL = 'https://chrome.iriscouch.com/videos';
var localCouchDB;
var presentationURLs;
var isReplicated = false;

var jsdom = require('jsdom');
var fs = require('fs');
var nano = require('nano')(localHost);
var request = require('request');


var numVideos;
var numCues = 0;
// to determine if getting data is complete
var numTracks = fs.readdirSync('tracks').length;
var numTracksRetrieved = 0;
var numYouTubeDataRetrieved = 0;
var trackPath = "http://localhost/chromesearch/tracks/";
var trackSuffix = ".srt";
var videos = {};

console.time('Time taken: ');
nano.db.destroy(localCouchName, function() {
  nano.db.create(localCouchName, function() {
    localCouchDB = nano.use(localCouchName);
    init();
  });
});

function replicate(){
  nano = require('nano')(remoteHost);
  nano.db.destroy(dbName, function() {
    nano.db.create(dbName, function() {
      nano = require('nano')(localHost);
      nano.db.replicate(dbName, remoteCouchURL, {create_target: true},
        function(error, body) {
          if (error) {
            console.log('>>> nano.db.replicate() error:', error);
          } else {
            nano.db.get(localCouchName, function(error, body) {
              if (error) {
                console.log('nano.db.get error:', error);
              } else {
                console.log('Created remote database, doc_count:', body.doc_count);
                console.timeEnd('Time taken: ');
              }
            });
          }
      });
    });
  });
}


function insertOrUpdateDoc(db, doc, key, isInsertAttempted) {
  db.insert(doc, function (error, body, header) {
    if (error) {
      if (error.error === 'conflict' && !isInsertAttempted) {
        return db.get(key, function(error, doc) {
          doc._rev = doc._rev;
          insertOrUpdateDoc(db, doc, key, true);
        });
      } else {
        console.log('>>> insertOrUpdateDoc() error:', error);
      }
    } else {
        if (doc.videoId === '07HaQwxAo5s'){
         console.log(doc);
        }

        // console.log('Inserted ', doc.url);
        nano.db.get(localCouchName, function(error, body) {
        if (error) {
          console.log('nano.db.get error:', error);
        } else {
          if (body.doc_count === numVideos && !isReplicated) {
            // maybe add timeout to replicate regardless
            // in case of XHR problems getting data
            isReplicated = true; //
            console.log('Created local database, doc_count:', body.doc_count);
            replicate();
          }
        }
      });
    }
  });
}

function insertOrUpdateVideo(video){
  insertOrUpdateDoc(localCouchDB, video, video.videoId, false);
}

function init(){
  // before adding transcript data and updating from YouTube data API,
  // get static video metadata from data/videos.json
  request(
    {uri: 'http://localhost/chromesearch/data/videos.json'},
    function(error, response, body){
      if (error) {
        console.log('>>> Error getting video data', error)
      } else if (response.statusCode == 200) {
      	videos = JSON.parse(body);
        numVideos = Object.keys(videos).length;
        console.log(numVideos + ' videos');
  			// console.log(videos['07HaQwxAo5s']);
  	    getVideoData();
      }
    }
  );
}

function getVideoData() {
	// the keys for the videos object, defined in videos.js, are YouTube IDs
	for (var videoId in videos) {
		getCueData(videoId); // get cue data from .srt files in tracks folder
    getYouTubeData(videoId); // update video data from the YouTube data API
	}
}

function maybeGotAllData(){
  if (numTracksRetrieved === numTracks &&
      numYouTubeDataRetrieved === numVideos) {
    console.log(numCues + ' cues');
    console.timeEnd('Time taken: ');
    for (videoId in videos) {
      insertOrUpdateVideo(videos[videoId]);
    }
  }
}

function addTrack(videoId, trackText){
	// if (videoId === '07HaQwxAo5s'){
	// 	console.log(videos['07HaQwxAo5s']);
	// 	console.log('trackText for -07HaQwxAo5s: ', trackText);
	// }
	var cues = videos[videoId].cues = [];
	var lines = trackText.match(/^.*((\r\n|\n|\r)|$)/gm);
	var currentCue = {"text": "", "videoId": videoId};
	for (var i = 0; i != lines.length; ++i){
		// if (i == (lines.length - 1)){
		// 	console.log('last line: ' + currentCue.text);
		// }
		var line = lines[i];
		// if line is just a cue ID (i.e. just digits)
		// or if this is the last line -- then add the cue
		if (line.match(/^\d+\s*$/) || i == lines.length - 1){
			if (currentCue.text) {
				// get rid of redundant whitespace after combining lines
				currentCue.text.trim();
        ++numCues;
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

	numTracksRetrieved += 1;
  // console.log('numTracksRetrieved: ', numTracksRetrieved);
	if (numTracksRetrieved === numVideos) {
		maybeGotAllData();
	}
}

function getCueData(videoId){
	request(
	  {uri: trackPath + videoId + trackSuffix},
	  function(error, response, body){
	    if (error) {
	      console.log('>>> Error getting cue data', error)
	    } else if (response.statusCode == 200) {
				addTrack(videoId, body);
	    }
	  }
	);
}

// update video data (rating and view count) from YouTube data API
function getYouTubeData(videoId){
	try {
		request(
		  {uri: "http://gdata.youtube.com/feeds/api/videos/" + videoId + "?alt=json"},
		  function(error, response, body){
		    if (error) {
		      console.log('>>> Error getting YouTube data for ' + videoId, error)
		    } else if (response.statusCode == 200) {
			    var obj = JSON.parse(body);
			  	videos[videoId].viewCount = obj.entry.yt$statistics.viewCount;
			  	if (obj.entry.gd$rating && obj.entry.gd$rating.average){
				    videos[videoId].rating = obj.entry.gd$rating.average;
				  } else {
				  	videos[videoId].rating = '';
				  }
		    } else {
          // console.log('Response code: ', response.statusCode);
        }
        numYouTubeDataRetrieved += 1;
        // console.log('numYouTubeDataRetrieved: ', numYouTubeDataRetrieved);
        if (numYouTubeDataRetrieved === numVideos) {
          maybeGotAllData();
        }
		  }
		);
	} catch(e){
		console.log(e);
	}
}

// srt format is 01:01:58,310 (it's French, hence the comma)
// hours:minutes:seconds,milliseconds
function toDecimalSeconds(srtTime) {
	var split = srtTime.match(/\d{2}/g);
	// hours, minutes, seconds -- ignore milliseconds
	return split[0] * 3600 + split[1] * 60 + split[2] * 1; // must convert from string
}
