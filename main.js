#!/usr/bin/env node

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

function User() {
	this.join = this.part = moment(0);
}

function Message(nick, text) {
	this.nick = nick;
	this.text = text;
	this.timestamp = moment();
}

function History() {
	this.messages = new CBuffer(messageLimit);
	this.users = {};
}

History.prototype.query = function(nick, count) {
	count = Math.min(count, this.messages.size);
	for (var i = count - 1; i >= 0; --i) {
		var message = this.messages.get(this.messages.size - i - 1);
		client.say(nick, message.nick + ': ' + message.text);
	}
}

History.prototype.update = function(nick) {
	this.users[nick] = this.users[nick] || new User();
	var user = this.users[nick];
	if (user.part == user.join) {
		client.say(nick, 'You are up to date.');
		return;
	}

	for (var i = 0; i < this.messages.size; ++i) {
		var message = this.messages.get(i);
		if (message.timestamp.unix() > user.part.unix()) {
			break;
		}
	}

	for (; i < this.messages.size; ++i) {
		var message = this.messages.get(i);
		if (message.timestamp.unix() > user.join.unix()) {
			break;
		}
		client.say(nick, message.nick + ': ' + message.text);
	}

	user.join = user.part = moment();
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

	// Record joins/parts per users per channel
	var users = histories[i].users;
	client.addListener('join' + config.channels[i], function(nick, message) {
		users[nick] = users[nick] || new User();
		users[nick].join = moment();
	});

	client.addListener('part' + config.channels[i], function(nick, message, reason) {
		users[nick] = users[nick] || new User();
		users[nick].part = moment();
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
				history.query(nick, count);
			}
		}

		// Update missed messages for this channel
		if (args.length == 2 && args[0] == 'update') {
			var history = getHistory(args[1]);
			if (history) {
				history.update(nick);
			}
		}
	}
});