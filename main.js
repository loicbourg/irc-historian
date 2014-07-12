var irc = require('irc');
var moment = require('moment');
var CBuffer = require('CBuffer');
var fs = require('fs');

var argv = require('minimist')(process.argv.slice(2));
var file = argv['config'];
var config = JSON.parse(fs.readFileSync(file));

var messageLimit = 10000;

var client = new irc.Client(config.server, config.nick, {
	channels: config.channels,
	port: config.port
});

function Message(nick, text) {
	this.nick = nick;
	this.text = text;
}

function History() {
	this.messages = new CBuffer(messageLimit);
}

History.prototype.getMessages = function(nick, count) {
	count = Math.min(count, this.messages.size);
	for (var i = 0; i < count; ++i) {
		var message = this.messages.get(this.messages.size - i - 1);
		client.say(nick, message.nick + ': ' + message.text);
	}
}

function getHistory(channel) {
	for (var i = 0; i < config.channels.length; ++i) {
		if (config.channels[i] === channel)

		{
			return histories[i];
		}
	}

	return null;
}

var histories = [];
for (var i = 0; i < config.channels.length; ++i) {
	histories.push(new History());

	// Stores messages for each channel
	var messages = histories[i].messages;
	client.addListener('message' + config.channels[i], function(nick, text) {
		var message = new Message(nick, text);
		messages.push(message);
	});
}

// Service history requests
client.addListener('message', function(nick, to, text) {
	if (to === config.nick) {
		var args = text.split(' ');
		// Retrieve the last N messages for this channel
		if (args.length == 3 && args[0] == 'get') {
			var count = parseInt(args[2]);
			var history = getHistory(args[1]);
			if (history) {
				history.getMessages(nick, count);
			}
		}
	}
});