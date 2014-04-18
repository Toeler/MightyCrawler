/* Modules */
var cluster = require('cluster'),
	fs = require('fs'),
	winston = require('winston'),
	logger = winston.loggers.get('logger'),
	config = require('../config');

/* Cluster */
var numWorkers = !isNaN(config.master.workers) ? parseInt(config.master.workers, 10) : 1,
	workers = {};

/* Crawler */
var time = {},
	idleWorkers = [],
	rules = [],
	currentRule,
	queue = [],
	checkedUrls = [],
	matches = [];

process.title = 'mighty-master';
cluster.setupMaster({
	exec: 'lib/worker.js',
	silent: true
});

function getRules() {
	logger.info('Loading rules');
	var rules = [];
	fs.readdirSync('./rules').forEach(function(filename) {
		if (filename.substr(-5) === '.json') {
			var file = require('../rules/' + filename);
			file.name = filename.substring(0, filename.length - 5);
			rules.push(file);
		}
	});
	return rules;
}

function saveProgress() {
	if (!fs.existsSync('./progress')) {
		fs.mkdirSync('./progress');
	}
	fs.writeFileSync('./progress/' + currentRule.name + '.queue', queue.join('\r\n'));
	fs.writeFileSync('./progress/' + currentRule.name + '.checked', checkedUrls.join('\r\n'));

	printStats();

	setTimeout(saveProgress, 10000);
}

function loadProgress() {
	if (fs.existsSync('./progress/' + currentRule.name + '.queue')) {
		queue = fs.readFileSync('./progress/' + currentRule.name + '.queue').toString().split('\r\n');
	}
	if (fs.existsSync('./progress/' + currentRule.name + '.checked')) {
		checkedUrls = fs.readFileSync('./progress/' + currentRule.name + '.checked').toString().split('\r\n');
	}
}

function sendMessage(workerPid, msg) {
	workers[workerPid].worker.send(msg);
}

function sendWork(workerPid, url) {
	checkedUrls.push(url);
	sendMessage(workerPid, {
		cmd: 'WORK',
		url: url,
		filter: currentRule.filter || {},
		match: currentRule.match
	});
}

function receiveMessage(msg) {
	if (msg.cmd) {
		logger.debug('[Worker %s] Message: %s', msg.pid, msg.cmd);
		if (msg.cmd === 'DONE') {
			if (msg.matched === true) {
				logger.Match('Match found at %s', msg.url);
				matches.push(msg.url);

				if (!fs.existsSync('./matches/')) {
					fs.mkdirSync('./matches');
				}
				fs.appendFileSync('./matches/' + currentRule.name + '.match', msg.url + '\r\n');
			}
			for (var i = 0; i < msg.filteredUrls.length; i++) {
				var url = msg.filteredUrls[i];
				if (checkedUrls.indexOf(url) === -1 && queue.indexOf(url) === -1) {
					queue.push(msg.filteredUrls[i]);
				}
			}
			idleWorkers.push(msg.pid);
		}
	}
}

function startWorker() {
	var worker;
	worker = cluster.fork();
	workers[worker.process.pid] = {
		worker: worker
	};

	worker.on('message', receiveMessage);
	if (worker.process.stdout) {
		worker.process.stdout.on('data', function (chunk) {
			logger.info('[Worker %s] %s', worker.process.pid, chunk.toString('utf8'));
		});
	}
	if (worker.process.stderr) {
		worker.process.stderr.on('data', function (chunk) {
			logger.error('[Worker %s] %s', worker.process.pid, chunk.toString('utf8'));
		});
	}

	worker.on('exit', function() {
		logger.error('[Worker %s] Died. Stopping to prevent queue loss.', worker.process.pid);
		process.exit(1);
	})
}

function poll() {
	logger.debug('Starting poll');
	if (idleWorkers.length === numWorkers && currentRule == null && rules.length === 0) {
		logger.info('All rules completed.');
		process.exit(0);
	}

	if (currentRule != null && currentRule.matchesExpected > 0 && matches.length === currentRule.matchesExpected) {
		logger.info('All matches found for this rule.');
		logger.info('Idle: %s - Total: %s - Rule: %s - Rules: %s', idleWorkers.length, numWorkers, currentRule.name, rules.length);
		queue = [];
	}

	for (var i = 0; i < idleWorkers.length; i++) {
		if (currentRule != null && queue.length > 0) {
			sendWork(idleWorkers[i], queue.shift());
			idleWorkers.splice(i--, 1);
		} else if (idleWorkers.length === numWorkers) {
			// Rule complete and no more work in queue, next rule.
			checkedUrls = [];
			currentRule = rules.shift();
			if (currentRule != null && currentRule.root && currentRule.match) {
				loadProgress();
				logger.debug('Starting next rule: %s', currentRule.name);
				sendWork(idleWorkers[i], currentRule.root);
				idleWorkers.splice(i--, 1);
			}
		}
	}

	setTimeout(poll, 100);
}

function getSpaces(separator, text) {
	return [
		Math.floor((separator.length - 2 - text.length) / 2),
		Math.ceil((separator.length - 2 - text.length) / 2)
	];
}

function printStats() {
	var separator = '--------------------------------------------';
	var matchText = 'Matches: ' + matches.length;
	if (currentRule.matchesExpected > 0) {
		matchText += '/' + currentRule.matchesExpected;
	}
	var queueText = 'Queue: ' + queue.length;
	var checkedText = 'Checked: ' + checkedUrls.length;
	var timeText = 'Uptime: ' + Math.round(process.hrtime(time.start)[0]) + 's';
	logger.info(separator);
	logger.info('|%s%s%s|', ' '.repeat(getSpaces(separator, matchText)[0]), matchText, ' '.repeat(getSpaces(separator, matchText)[1]));
	logger.info('|%s%s%s|', ' '.repeat(getSpaces(separator, queueText)[0]), queueText, ' '.repeat(getSpaces(separator, queueText)[1]));
	logger.info('|%s%s%s|', ' '.repeat(getSpaces(separator, checkedText)[0]), checkedText, ' '.repeat(getSpaces(separator, checkedText)[1]));
	logger.info('|%s%s%s|', ' '.repeat(getSpaces(separator, timeText)[0]), timeText, ' '.repeat(getSpaces(separator, timeText)[1]));
	logger.info(separator);
}

module.exports.start = function start() {
	rules = getRules();

	for (var workerPid in workers) {
		if (workers.hasOwnProperty(workerPid)) {
			idleWorkers.push(workerPid);
		}
	}

	time.start = process.hrtime();
	poll();
	setTimeout(saveProgress, 10000);
};

for (var i = 0; i < numWorkers; i++) {
	startWorker();
}




String.prototype.repeat = function(times) {
	return new Array(times + 1).join(this);
};