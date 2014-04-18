/* Modules */
var request = require('request'),
	urlHelp = require('url');

/* Crawler */

process.title = 'mighty-worker';

function sendMessage(msg) {
	msg.pid = process.pid;
	process.send(msg);
}

function workDone(url, matched, filteredUrls) {
	sendMessage({
		cmd: 'DONE',
		url: urlHelp.format(url),
		matched: matched,
		filteredUrls: filteredUrls
	});
}

function checkMatch(body, matches) {
	if (Array.isArray(matches)) {
		for (var i = 0; i < matches.length; i++) {
			var match = matches[i];

			if (typeof match === 'string' || match instanceof String) {
				var arr = body.match(new RegExp(match));
				if (arr !== null && arr.length > 0) {
					return true;
				}
			} else {
				console.error('Non-string matches not yet supported');
			}
		}
	}

	return false;
}

function checkFilter(tag, filter) {
	if (typeof filter === 'string' || filter instanceof String) {
		var arr = tag.match(new RegExp(filter));
		return arr === null ? false : arr.length > 0;
	} else if (Array.isArray(filter)) {
		for (var i = 0; i < filter.length; i++) {
			if (checkFilter(tag, filter[i])) {
				return true;
			}
		}
		return false;
	} else {
		console.error('Filter type not supported (%s)', JSON.strinfiy(filter));
		return false;
	}
}

function filterUrls(url, body, filters) {
	var tags = body.match(/(((http|https|ftp):\/\/([\w\-\d]+\.)+[\w\-\d]+){0,1}("\/[\w~,;\-\\./?%&+#=]*[^(.png|.jpg|.gif|.jpeg|.css|.ico)]"))/g) || [];

	tags = tags.map(function(el) {
		el = el.slice(1, -1);
		if (el.slice(-1) === '/') {
			el = el.slice(0, -1);
		}
		var parsedEl = urlHelp.parse(el, false, true);
		if (parsedEl.protocol === null) {
			parsedEl.protocol = url.protocol;
		}
		if (parsedEl.hostname === null) {
			parsedEl.hostname = url.hostname;
		}
		return urlHelp.format(parsedEl);
	});

	for (var i = 0; i < filters.length; i++) {
		tags = tags.filter((function(filter) {
			return function (el) {
				return checkFilter(el, filter);
			}
		})(filters[i]));
	}

	return tags;
}

function processPage(url, body, filter, match) {
	var matched = checkMatch(body, match),
		filteredUrls = filterUrls(url, body, filter);

	return workDone(url, matched, filteredUrls);
}

function checkUrl(url, filter, match) {
	console.log('checking ' + url);
	var parsedUrl = urlHelp.parse(url, false, true);

	if (url.hostname === null) {
		console.log('Bad url (%s)', JSON.stringify(parsedUrl));
		return workDone(parsedUrl, false, []);
	}

	var options = {
		url: parsedUrl,
		headers: {
			'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*.*,q=0.8',
			'Connection': 'keep-alive',
			'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537 (KHTML, like Gecko) Chrome/34.0.1847.116 Safari/537.36'
		},
		followRedirect: false
	};

	request(options, function (error, response, body) {
		if (error || response.statusCode !== 200) {
			console.error((error || 'Error: Status Code ' + response.statusCode) + ' (' + url + ')');
			return workDone(parsedUrl, false, []);
		} else if (!body) {
			console.error('No body!');
			return workDone(parsedUrl, false, []);
		}
		url = response.request.uri.href;

		processPage(parsedUrl, body, filter, match);
	});
}

function receiveMessage(msg) {
	if (msg.cmd) {
		if (msg.url && msg.filter && msg.match) {
			checkUrl(msg.url, msg.filter, msg.match);
		}
	}
}

process.on('message', receiveMessage);