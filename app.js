"use strict"
var MailListener = require("mail-listener2");
var util = require("util");
var request = require("request");
var config = {
	"slack-hook": "https://hooks.slack.com/services/xxxxxxxxx/xxxxxxxxx/xxxxxxxxxxxxxxxxxxxxxxxx",
	"slack-channel": "general"
}

var ml = new MailListener({
	username: "yer@email.here",
	password: "s00per-s33kr1t_p@$$w0rd",
	host: "mail.server.com",
	port: 993, // imap port
	tls: true,
	tlsOptions: { rejectUnauthorized: false },
	mailbox: "inbox", // mailbox to monitor
//	searchFilter: ["UNSEEN", "FLAGGED"], // the search filter being used after an IDLE notification has been retrieved
	markSeen: true, // all fetched email willbe marked as seen and not fetched next time
	fetchUnreadOnStart: true, // use it only if you want to get all unread email on lib start. Default is `false`,
});


ml.on("server:connected", function() {
	console.log("Connected to IMAP server");
});

ml.on("server:disconnected", function() {
	console.log("Lost connection to IMAP server");
});

ml.on("error", function(e) {
	console.log("Error:");
	console.log(e);
});

ml.on("mail", function(mail, seqno, attributes) {

	for (let i=0,len=mail.from.length; i < len; i++) {

		let person = mail.from[i];

		if ("name" in person && person.name.length > 0) {
			if (i == 0) {
				var sender = util.format("%s <%s>", person.name, person.address);
				if (len > 1) {
					var shortSender = util.format("%s and %s others", person.name, len);
				} else {
					var shortSender = person.name;
				}
			} else {
				sender += util.format(", %s <%s>", person.name, person.address);
			}
		} else {
			if (i == 0) {
				var sender = person.address;
				if (len > 1) {
					var shortSender = util.format("%s and %s others", person.address, len);
				} else {
					var shortSender = person.address;
				}
			} else {
				sender += ", " + person.address
			}
		}
	}

	for (let i=0,len=mail.to.length; i < len; i++) {
		let person = mail.to[i];

		if ("name" in person && person.name.length > 0) {
			if (i == 0) {
				var recipient = util.format("%s <%s>", person.name, person.address);
				if (len > 1) {
					var shortRecipient = util.format("%s and %s others", person.name, len);
				} else {
					var shortRecipient = person.name;
				}
			} else {
				recipient += util.format(", %s <%s>", person.name, person.address);
			}
		} else {
			if (i == 0) {
				var recipient = person.address;
				if (len > 1) {
					var shortRecipient = util.format("%s and %s others", person.address, len);
				} else {
					var shortRecipient = person.address;
				}
			} else {
				recipient += ", " + person.address
			}
		}
	}

	var subject = mail.subject
	var message = mail.text


	request.post({
	  url: config["slack-hook"],
	  body: JSON.stringify({
	    "channel": "#"+config["slack-channel"],
	    "username": "Email Bot",
	    "icon_emoji": ":dancing_penguin:",
	    "attachments": [
	      {
	        "fallback": util.format("Email from \"%s\" titled \"%s\"", shortSender, subject),
	        "color": "#2ab27b",
	        "text": util.format("*%s*\n_%s_\n```%s```", subject, sender, message),
	        "mrkdwn_in": ["text", "pretext", "fields"],
//	        "fields": [
//	        	{
//	        		"value": util.format("```%s```", message),
//	        		"short": false
//	        	}
//	        ]
	      }
	    ]
	  })
	}, function(err, res, body) {
	  console.log(err);
	  console.log(body);
	})
});

ml.start();
