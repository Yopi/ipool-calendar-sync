const fs = require('fs');
const gcal = require('google-calendar')
const CONFIG = JSON.parse(fs.readFileSync('config.json', 'utf8'));

const { GoogleToken } = require('gtoken');
const gtoken = new GoogleToken({
  keyFile: './credentials.json',
  scope: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events']
});

async function getToken() {
  const tokens = await gtoken.getToken()
  return tokens;
}

async function listEvents(token) {
  return new Promise(function(resolve, reject) {
    gcal(token).events.list(CONFIG.CALENDAR_ID, {
      orderBy: 'startTime',
      timeMin: (new Date(new Date().setHours(0))).toISOString(),
      timeMax: (new Date(new Date().setMonth(new Date().getMonth() + 3))).toISOString(),
      singleEvents: true
    }, function(err, data) {
      if(err) reject(err);
      resolve(data.items);
    });
  });
}

async function addEvent(token, event) {
  return new Promise(function(resolve, reject) {
    gcal(token).events.insert(CONFIG.CALENDAR_ID, {
      start: {dateTime: event.start.dateTime, timeZone: 'Europe/Stockholm'},
      end: {dateTime: event.end.dateTime, timeZone: 'Europe/Stockholm'},
      summary: event.summary,
      description: event.description
    }, function(err, data) {
      if(err) {
        reject(err);
      }
      resolve(data);
    });
  });
}

async function removeEvent(token, eventId) {
  return new Promise(function(resolve, reject) {
    gcal(token).events.delete(CONFIG.CALENDAR_ID, eventId, function(err, data) {
      if(err) {
        console.log(err);
        reject(err);
      }
      resolve(data);
    });
  }); 
}

exports.getToken = getToken;
exports.listEvents = listEvents;
exports.addEvent = addEvent;
exports.removeEvent = removeEvent;
