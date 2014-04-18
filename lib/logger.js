var winston = require('winston'),
	config = require('../config');

var customLevels = {
	levels: {
		Match: 5,
		error: 5,
		warn: 4,
		info: 3,
		verbose: 2,
		debug: 1,
		silly: 0
	},
	colors: {
		Match: 'green',
		info: 'grey',
		debug: 'grey'
	}
};

winston.addColors(customLevels.colors);

winston.loggers.add('logger', {
	console: {
		level: config.logger.level || "info",
		colorize: config.logger.colorize || false,
		timestamp: true
	},
	file: {
		filename: 'log/output.log',
		silent: !config.logger.toFile || true,
		json: false
	}
}).setLevels(customLevels.levels);