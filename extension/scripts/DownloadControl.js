'use strict';

// cache settings from storage for lifetime of event page
var w = null;


chrome.runtime.onInstalled.addListener(function (details) {
		var reason = details.reason;
		if (('install' === reason) || ('update' === reason)) {

			chrome.storage.sync.get(null, function (storage) {
					// quasi constants
					var cThisSettingsVersion = 1;

					// create settings if missing
					if (undefined === storage['settingsVersion'])
						storage.settingsVersion = cThisSettingsVersion;
					if (null == storage['conflictAction'])
						storage.conflictAction = 'prompt';
					if (null == storage['defaultPath'])
						storage.defaultPath = '';
					if (null == storage['rules_both'])
						storage.rules_both = [];
					if (null == storage['rules_url'])
						storage.rules_url = [];
					if (null == storage['rules_ext'])
						storage.rules_ext = [];

					// opportunity to update settings
					if (('update' === reason)
							&& parseInt(storage['settingsVersion']) < cThisSettingsVersion) {
						// ...
						// finaly update storage version
						storage.settingsVersion = cThisSettingsVersion;
					}
					
					// store created/updated settings
					chrome.storage.sync.set(storage); // assuming fast storage ;)
				} // storage handled
			);

			// show options page on install
			if ('install' === reason) { // only on new installs
				// { // alternatively on both, install and update
				chrome.tabs.create({
						url: 'options/options.html?ref=installed'
					}
				);
			}
		}
	}
);


chrome.storage.onChanged.addListener(function (changes, areaName) {
		// not our storeage area or storage gets freshly read next time it is used, anyway
		if (!w || (areaName !== 'sync')) return;
		
		// mirror updates to cache
		for (var k in changes) {
			w[k] = changes[k].newValue;
		}
	}
);


chrome.downloads.onDeterminingFilename.addListener(function (download, suggest) { // determine correct location

		// if settings already cached, use 'em
		if (w) return determineFilename(download, suggest);

		// get settings async'ly otherwise and cache them
		chrome.storage.sync.get(null, function (storage) {
				w = storage;
				return determineFilename(download, suggest);
			}
		);
});

chrome.downloads.onChanged.addListener( function(change){
		/*if(change.filename){ // check for manual change of download location:
			console.log("now: "+change.filename.current);
			console.log("path: "+path);
			if(change.filename.current.indexOf(path) === -1) console.log("location manually changed");
			else console.log("location unchanged");
		}*/
		return;
		
		
		if(!change.state) return;
		else if(change.state.current !== "complete") return;
		
		chrome.downloads.open(change.id);
		window.setTimeout( function(){ deleteFile(change.id); }, 5000);
});


// determine correct location
function determineFilename (download, suggest) {

	if (!w) { // shouldn't possibly ever happen
		console.warn('DownloadControl: Settings cache empty!');
		return false;
	}

	var path = "";
	var filetype = download.filename.substring(download.filename.lastIndexOf(".")+1);
	
	// check for matching rules with URL and file type first:
	for(var i = 0; i < w.rules_both.length; i++)
	{
		var regex = new RegExp(w.rules_both[i].url, "i"); // i = matches lower- & uppercase
		if(regex.test(download.url) && w.rules_both[i].ext.indexOf(filetype) !== -1)
		{
			path = w.rules_both[i].dir;
			break;
		}
	}
	
	// if no rules matched, check for URL only:
	if(path === "") for(var i = 0; i < w.rules_url.length; i++)
	{
		var regex = new RegExp(w.rules_url[i].url, "i");
		if(regex.test(download.url))
		{
			path = w.rules_url[i].dir;
			break;
		}
	}
	
	// else check for file type only rules:
	if(path === "") for(var i = 0; i < w.rules_ext.length; i++)
	{
		if(w.rules_ext[i].ext.indexOf(filetype) !== -1)
		{
			path = w.rules_ext[i].dir;
			break;
		}
	}
	
	// if no rule matched, take default path:
	if(path === "") path = w.defaultPath;
	
	// check if path contains variables and substitute them with appropriate values:
	path = path.replace(/%DOMAIN%/gi, download.url.split("/")[2]); // 2 because of "//" behind protocol
	path = path.replace(/%FILETYPE%/gi, filetype);
	
	suggest({ filename: path+download.filename, conflictAction: w.conflictAction });
	
}


// delete file from manager
function deleteFile (change_id) {
	chrome.downloads.search({id: change_id}, function(downloads){
		if(!downloads[0].exists)
		{
			chrome.downloads.erase({ id: downloads[0].id });
			console.log("deleted");
		}
		else
		{
			chrome.downloads.removeFile(downloads[0].id);
			window.setTimeout( function(){ deleteFile(downloads[0].id); }, 5000);
			console.log("still open");
		}
	});
}