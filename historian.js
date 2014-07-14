#!/usr/bin/env node

var irc = require('irc');
var moment = require('moment');
var CBuffer = require('CBuffer');

var argv = require('yargs')
	.demand(['s', 'c'])
	.options('s', {
		alias: 'server',
		describe: 'Server url ex. "irc.yourserver.com".'
	})
	.options('c', {
		alias: 'channels',
		describe: 'Comma delineated list of channels to monitor.'
	})
	.options('n', {
		alias: 'nick',
		describe: 'Desired IRC nickname.',
		default: 'historian'
	})
	.options('p', {
		alias: 'port',
		describe: 'The server port.',
		default: '6667'
	})
	.argv;

var channels = argv.channels.split(',');

var messageLimit = 10000;

var client = new irc.Client(argv.server, argv.nick, {
	channels: channels,
	port: argv.port
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
	for (var i = 0; i < channels.length; ++i) {
		if (channels[i] === channel)

		{
			return histories[i];
		}
	}

	return null;
}

function logChannel(channel, position) {
	histories.push(new History());

	// Stores messages for each channel
	var messages = histories[position].messages;
	client.addListener('message' + channel, function(nick, text) {
		var message = new Message(nick, text);
		messages.push(message);
	});

	// Record joins/parts per users per channel
	var users = histories[position].users;
	client.addListener('join' + channel, function(nick, message) {
		users[nick] = users[nick] || new User();
		users[nick].join = moment();
	});

	client.addListener('part' + channel, function(nick, message, reason) {
		users[nick] = users[nick] || new User();
		users[nick].part = moment();
	});
}

var histories = [];
for (var i = 0; i < channels.length; ++i) {
	logChannel(channels[i], i);
}

// Service history requests
client.addListener('message', function(nick, to, text) {
	if (to === argv.nick) {
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
		
		if (args.length == 2 && args[0] == 'join') {
			client.join(args[1]);
			logChannel(args[1], histories.length);
		}
	}
});
