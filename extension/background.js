var testmode = false; //set to true to avoid path test
var minutebacks = false; //set to true to allow backs every minute for testing

var testfilecontent = "This is a test file for savetiddlers extension";

function datesArray(now,andHours,andMinutes)
{
	var date = [now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()];
	if (andHours) {
		date.push(now.getUTCHours());
	}
	if (andMinutes) {
		date.push(now.getUTCMinutes());
	}
	return date;
}

function equalDateArrays(Ar1,Ar2) {
	if (Ar1.length !== Ar2.length) {
		return false;
	}
	for (var i = 0; i < Ar1.length; i++){
		if (Ar1[i] !== Ar2[i]) return false;
	}
	return true;
}
	
chrome.runtime.getPlatformInfo( function(info) {if(info.os == "win") { $["/"] = "\\"; }

var round = '59723833'; //by rotating this string of digits we can have 8 unique named test files for simutaneous use
						//ie testpath = testbase+round+'.html';rotate(round) for next test file
var rlen = round.length - 1;

var defaultlocations = "tiddlywikilocations";
var  $ = {"/":"/"};

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
    console.log("savetiddlers: background got message.twdl");
    
    function dodownload (msg, tiddlywikilocations){					
	chrome.downloads.download({
		url: URL.createObjectURL(new Blob([msg.txt], {type: 'text/plain'})),
		filename: tiddlywikilocations+$["/"]+ msg.path,
		conflictAction: 'overwrite'
	},
	function(id) {
		console.log("savetiddlers: saved "+msg.path);
		if (msg.backuppath||msg.backupdir) {
			var backupdir = msg.backupdir?msg.backupdir+$["/"]:"";
			var backuppath =msg.backuppath?msg.backuppath:msg.path;
			console.log("back control by tw");
			chrome.downloads.download({
				url: URL.createObjectURL(new Blob([msg.txt], {type: 'text/plain'})),
				filename: tiddlywikilocations+$["/"]+backupdir+backuppath,
				conflictAction: 'overwrite'
			}, function(id) {sendResponse("backupsaved");});
		}	
		else chrome.storage.local.get({backup:false,periodchoice:"day",period:[],backupdir:"backupdir",backedup:{}}, function(items) {
			var newvals={}, newdate = new Date(), 
				date = datesArray(newdate,items.periodchoice == "hour",minutebacks), 
				bkdate = newdate.toISOString().slice(0,10);
			if (items.backup === false) {
				sendResponse ("saved");
				return;
			}
			if (equalDateArrays(date, items.period)) {
				if (items.backedup[msg.path]) { 
					sendResponse ("saved");
					return;// already save in this period
				}
				// continue with this peroid
				newvals.backedup = items.backedup;
				newvals.period = items.period;
			} else {
				// new time period
				newvals.backedup = {};
				newvals.period = date;
			} 
			// remember we backedup on this filepath
			newvals.backedup[msg.path] = true;
			chrome.downloads.download({
					url: URL.createObjectURL(new Blob([msg.txt], {type: 'text/plain'})),
					filename: tiddlywikilocations+$["/"]+items.backupdir+$["/"]+msg.path.replace(new RegExp('.{' + msg.path.lastIndexOf(".")  + '}'), '$&' + bkdate),
					conflictAction: 'overwrite'
				},function(id){sendResponse("backupsaved");});
			console.log("savetiddlers: backedup "+msg.path);
			chrome.storage.local.set(newvals);
		});
	});
}

////////////////////////// start ///////////////////////////////
if (msg.type === "start") {
	var path, 
	tiddlywikilocations = msg.locations||defaultlocations,
	firstloc = msg.filePath.indexOf($["/"]+tiddlywikilocations+$["/"]),
	testbase =	tiddlywikilocations+$["/"]+'readTiddlySaverInstruction';
	
	msg.fPath = msg.filePath.substring(0, firstloc);
	if (firstloc === -1) {
		console.log("file not in a sudir to "+tiddlywikilocations+", it will be saved to the download dir");
		path = msg.filePath.split($["/"]);
		msg.path = path[path.length-1];
		msg.twdl = false;
	}
	else {
		msg.path = msg.filePath.slice(firstloc+tiddlywikilocations.length + "//".length);
		msg.twdl = true;
	}

    // show the choose file dialogue when tw not under 'tiddlywikilocations'
	if (!msg.twdl) {
		console.log("savetiddlers: not in "+tiddlywikilocations+msg.path);
		sendResponse("failedloc");
	} else if (testmode) {
		console.log("savetiddlers: avoid path testing");
		dodownload(msg, tiddlywikilocations);//avoid path testing
	} else{ 
		// first download check our destination is valid by download a dummy file first and then reading back the filepath	
		round = round[rlen] + round.substring(0, rlen);
		chrome.downloads.download({
			url: URL.createObjectURL(new Blob([testfilecontent], {type: 'text/plain'})),
			filename: testbase+round+'.html',
			conflictAction: 'overwrite'
			},function(id){chrome.downloads.onChanged.addListener(function hearchange(deltas){
				// wait for completion
				if (deltas.id == id && deltas.state && deltas.state.current === "complete") {
					chrome.downloads.onChanged.removeListener(hearchange);
					chrome.downloads.search({id:id}, function(x){
						if (msg.fPath == x[0].filename.split($["/"]+testbase)[0]) {
							// All tests passed!
							dodownload(msg,tiddlywikilocations);
						} else {				
							console.log("savetiddlers: failed path "+msg.fPath +"!="+x[0].filename.split($["/"]+testbase)[0]);
							sendResponse("failedpath");
						}
						
						chrome.downloads.removeFile(id,function(){chrome.downloads.erase({id:id})});
					});
							
				}
				//
			})}
		)
	}
	return true;
} else {
		var path = msg.filePath.split($["/"]);
		path = path[path.length-1];
		chrome.downloads.download({
			url: URL.createObjectURL(new Blob([msg.txt], {type: 'text/plain'})),
			filename: path,
			saveAs : true
		},function(id){sendResponse("saved");});
}
})
});
