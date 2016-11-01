"use strict"
var MailListener = require("mail-listener2");
var slackify = require('slackify-html');
var util = require("util");
var request = require("request");
var config = require("./config");

var ml = new MailListener(config.mail);


ml.on("server:connected", function() {
  console.log("Connected to IMAP server");
});

ml.on("server:disconnected", function() {
  console.log("Lost connection to IMAP server");
});

ml.on("error", function(e) {
  if (e.hasOwnProperty("code") && e.code == "ECONNRESET") {
    console.log("Connection timed out")
  } else if (e.hasOwnProperty("source") && e.source == "timeout-auth") {
    console.log("Auth timeout");
  } else {
    console.log("Error:");
    console.log(e);
    request.post({
      url: config.slack.webhook,
      body: JSON.stringify({
        "channel": "#"+config.slack.channel,
        "username": config.slack.username,
        "icon_emoji": config.slack.emoji,
        "text": "<@nander13> <@patriot_down> Help, I can't connect to the IMAP server!\n```"+util.inspect(e)+"```"
      })
    }, function(err, res, body) {
      if (err) {
        console.log("ERROR: Failed to notify Slack about previous error");
        console.log(err);
      }
      if (body == "ok") {
        console.log("OK: Posted error to Slack");
      } else {
        console.log(body)
      }
    })
  }
});

ml.on("mail", function(mail, seqno, attributes) {
  // Build list of senders/recipients
  var sender = "", 
      recipient = "", 
      cc = "", 
      bcc = "";
  var shortSender, shortRecipient, shortCC, shortBCC;

  // If I was a smarter man, I could collapse this into a smaller set of nested loops
  for (let i=0,len=mail.from.length; i < len; i++) {

    let person = mail.from[i];

    if ("name" in person && person.name.length > 0) {
      if (i == 0) {
        sender = util.format("%s <%s>", person.name, person.address);
        if (len > 1) {
          shortSender = util.format("%s and %s others", person.name, len);
        } else {
          shortSender = person.name;
        }
      } else {
        sender += util.format(", %s <%s>", person.name, person.address);
      }
    } else {
      if (i == 0) {
        sender = person.address;
        if (len > 1) {
          shortSender = util.format("%s and %s others", person.address, len);
        } else {
          shortSender = person.address;
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
        recipient = util.format("%s <%s>", person.name, person.address);
        if (len > 1) {
          shortRecipient = util.format("%s and %s others", person.name, len);
        } else {
          shortRecipient = person.name;
        }
      } else {
        recipient += util.format(", %s <%s>", person.name, person.address);
      }
    } else {
      if (i == 0) {
        recipient = person.address;
        if (len > 1) {
          shortRecipient = util.format("%s and %s others", person.address, len);
        } else {
          shortRecipient = person.address;
        }
      } else {
        recipient += ", " + person.address
      }
    }
  }

  if (mail.hasOwnProperty("cc")) {
    for (let i=0,len=mail.cc.length; i < len; i++) {
      let person = mail.cc[i];

      if ("name" in person && person.name.length > 0) {
        if (i == 0) {
          cc = util.format("%s <%s>", person.name, person.address);
          if (len > 1) {
            shortCC = util.format("%s and %s others", person.name, len);
          } else {
            shortCC = person.name;
          }
        } else {
          cc += util.format(", %s <%s>", person.name, person.address);
        }
      } else {
        if (i == 0) {
          cc = person.address;
          if (len > 1) {
            shortCC = util.format("%s and %s others", person.address, len);
          } else {
            shortCC = person.address;
          }
        } else {
          cc += ", " + person.address
        }
      }
    }
  }


  if (mail.hasOwnProperty("bcc")) {
    for (let i=0,len=mail.bcc.length; i < len; i++) {
      let person = mail.bcc[i];

      if ("name" in person && person.name.length > 0) {
        if (i == 0) {
          bcc = util.format("%s <%s>", person.name, person.address);
          if (len > 1) {
            shortBCC = util.format("%s and %s others", person.name, len);
          } else {
            shortBCC = person.name;
          }
        } else {
          bcc += util.format(", %s <%s>", person.name, person.address);
        }
      } else {
        if (i == 0) {
          bcc = person.address;
          if (len > 1) {
            shortBCC = util.format("%s and %s others", person.address, len);
          } else {
            shortBCC = person.address;
          }
        } else {
          bcc += ", " + person.address
        }
      }
    }
  }
  
  // Create set of defaults
  var channel       = config.slack.channel,
      icon_emoji    = config.slack.emoji,
      username      = config.slack.username,
      color         = config.slack.color,
      title_link    = config.slack.link,
      subject       = mail.subject;

  var fallback = util.format("Email from \"%s\" titled \"%s\"", shortSender, subject)

  if (cc.length > 0) {
    recipient += ", CC: "+cc;
  }
  if (bcc.length > 0) {
    recipient += ", BCC: "+bcc;
  }

  var message;
  var title_link = "https://mso365.gmu.edu/";
  if (mail.hasOwnProperty("html")) {
    message = mail.html;
    message = message.replace(/<br\s*\/?>/mg,"\n");
    message = slackify(message);
  } else {
    message = mail.text;
  }

  var fields = [];
  if (mail.hasOwnProperty("attachments")) {
    fields.push({ title: "Number Attachments", value: mail.attachments.length, short: true })
  }
  if (mail.hasOwnProperty("priority") && mail.priority != "normal") {
    fields.push({ title: "Priority", value: mail.priority, short: true });
  }

  // Handle Alerts emails.
  if  (mail.from.length == 1 && 
      (mail.from[0].address == "alert@gmu.edu" 
      || mail.from[0].address == "no-reply@getrave.com")) {
    channel       = config.slack.alertsChannel,
    icon_emoji    = config.slack.alertsEmoji,
    username      = config.slack.alertsUser,
    color         = config.slack.alertsColor,
    title_link    = config.slack.alertsLink
    message       = "<!channel>\n" + message;
    fallback      = util.format("%s", subject);
  }

  // Set timestamp
  var mailTs = new Date().getTime() / 1000;
  if (mail.hasOwnProperty("date")) {
    mailTs = mail.date / 1000;
  }

  request.post({
    url: config.slack.webhook,
    body: JSON.stringify({
      "channel": "#"+channel,
      "username": username,
      "icon_emoji": icon_emoji,
      "attachments": [
        {
          "author_name": sender,
          "author_link": "mailto:"+mail.from[0].address,
          "title": subject,
          "title_link": title_link,
          "fallback": fallback,
          "color": color,
          "text": message.trim(),
          "footer": recipient,
          "ts": mailTs,
          "mrkdwn_in": ["text", "pretext", "fields"],
          "fields": fields,
        }
      ]
    })
  }, function(err, res, body) {
    if (err) {
      console.log("ERROR: Failed to post \""+subject+"\" from <"+mail.from[0].address + ">");
      console.log(err);
    }
    if (body == "ok") {
      console.log("OK: Posted \""+subject+"\" from <"+mail.from[0].address + ">");
    } else {
      console.log(body)
    }
  })

});

ml.start();

