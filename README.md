<p>Enter text to search the manual transcripts from the Edge Conference in London, 9 February 2013.</p>
  <p style="border-bottom: 1px solid #444; padding: 0 0 1em 0;">Click on a result to view video.</p>
  <p>A timed transcript file in SRT format for each video is stored in the <em>tracks</em> folder. SRT files look like this (each item is called a cue): </p>
  <pre>1
00:00:00,000 --> 00:00:05,550
2
00:00:05,550 --> 00:00:06,410
JAKE ARCHIBALD: Good
morning, everyone.
3
00:00:06,410 --> 00:00:11,140
Welcome to the offline
part of the day.
...</pre>
  <p>The <code>videos</code> object defined in <code>js/videos.js</code> has data for each video, updated via XHR using the YouTube Data API.</p>
  <p>An array of cues (captions) is added for each video by parsing the corresponding SRT file in the <code>tracks</code> folder. Each cue has a start time, text, and the YouTube ID of the video it belongs to.</p>
  <p>When text is entered in the query input element, the cues are searched and matches are displayed.</p>
  <p>When a result is clicked, the <code>src</code> is set for the embedded YouTube player, with a start value corresponding to the start time of the cue.</p>
  <p>YouTube caption files are available from URLs like this: <a href="http://video.google.com/timedtext?v=Oic22dQMRXQ&lang=en&format=srt" title="SRT file for EdgeConf offline video">video.google.com/timedtext?v=Oic22dQMRXQ&lang=en&format=srt</a>. (Both VTT and SRT format are available.)</p>
  <p>This app is based on <a href="samdutton.net/trackSearch" title="Chrome video search">samdutton.net/trackSearch</a>, which uses the track element to parse VTT files, storing and retrieving cue data via a Web SQL database.</p>
  <p>Source code is available from <a href = "https://github.com/samdutton/edgesearch">github.com/samdutton.com/tracksearch</a>.</p>
  <p>For more information about the track element, see <a href="http://www.html5rocks.com/en/tutorials/track/basics/" title="Getting started with the track element on HTML5 Rocks">Getting started with the track element</a> on HTML5 Rocks.</p>
