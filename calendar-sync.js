const fs = require('fs');
const puppeteer = require('puppeteer');
const dateFormat = require('dateformat');
const { getToken, listEvents, addEvent, removeEvent } = require('./calendar');

const CONFIG = JSON.parse(fs.readFileSync('config.json', 'utf8'));

async function getSchedule(username, password, fromDate, toDate) {
  const browser = await puppeteer.launch({headless: true});
  const page = await browser.newPage();

  // Login
  await page.goto('https://app.ipool.se/login_cms.aspx');

  await page.type('#tbUserName', username);
  await page.type('#tbPassword', password);
  await page.click('#btLogin');

  // Get scheduled work
  const schedule = await page.evaluate((fromDate, toDate) => {
    async function postData(url = '', data = {}) {
      // Default options are marked with *
      const response = await fetch(url, {
        method: 'POST', // *GET, POST, PUT, DELETE, etc.
        mode: 'cors', // no-cors, *cors, same-origin
        cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'same-origin', // include, *same-origin, omit
        headers: {
          'Content-Type': 'application/json'
        },
        redirect: 'follow', // manual, *follow, error
        referrerPolicy: 'no-referrer', // no-referrer, *client
        body: JSON.stringify(data) // body data type must match "Content-Type" header
      });
      return await response.json(); // parses JSON response into native JavaScript objects
    };
    return postData('https://app.ipool.se/full_schedule.aspx/LoadStaffSchedule', 
    	{"DateFr":fromDate,"DateTo":toDate});
   }, fromDate, toDate);

  await browser.close();
  return schedule;
};


function parseSchedule(scheduleResponse) {
  const schedule = eval(scheduleResponse['d']);
  return schedule.map((event, i) => {
    return {
      start: {
        dateTime: dateFormat(event['DateFr'], "isoDateTime")
      },
      end: {
        dateTime: dateFormat(event['DateTo'], "isoDateTime")
      },
      summary: `Jobb [${event['Short']}]`,
      description: `ID: ${event['ID']} (Tillagd av script)`
    }
  })
}

(async () => {
  const fromDate = dateFormat(new Date(new Date().setHours(0)), "yyyy-mm-dd HH:MM:ss");
  const toDate = dateFormat(new Date(new Date().setMonth(new Date().getMonth() + 3)), "yyyy-mm-dd HH:MM:ss");
  const schedule = await getSchedule(CONFIG.USERNAME, CONFIG.PASSWORD, fromDate, toDate)
  const token = await getToken();
  var events = [];
  try {
    events = await listEvents(token['access_token']);
  } catch (err) {
    console.log(err);
  }

  var eventsToAdd = parseSchedule(schedule);
  var eventsToDelete = events.filter((e, i) => {
    return (e.description && e.description.match(/script/i));
  });


  // Make filtering of new / old events a bit smarter
  var eventsToAddIDs = eventsToAdd.map((e) => e.description.match(/ID: (.+) \(Tillagd av script\)/i)[1])
  var eventsToDeleteIDs = eventsToDelete.map((e) => e.description.match(/ID: (.+) \(Tillagd av script\)/i)[1])

  var actualEventsToAddIDs = eventsToAddIDs.filter((id) => !eventsToDeleteIDs.includes(id));
  var actualEventsToDeleteIDs = eventsToDeleteIDs.filter((id) => !eventsToAddIDs.includes(id));

  eventsToAdd = eventsToAdd.filter((e) => {
    return actualEventsToAddIDs.includes(e.description.match(/ID: (.+) \(Tillagd av script\)/i)[1]);
  });

  eventsToDelete = eventsToDelete.filter((e) => {
    return actualEventsToDeleteIDs.includes(e.description.match(/ID: (.+) \(Tillagd av script\)/i)[1]);
  });



  console.log(`Tar bort ${eventsToDelete.length} arbetspass`);
  try {
    for(var i = 0; i < eventsToDelete.length; i++) {
      await removeEvent(token['access_token'], eventsToDelete[i].id);
    }
  } catch(err) {
    console.log("Kunde inte ta bort arbetspass");
    console.log(err);
  }

  console.log(`Lägger till ${eventsToAdd.length} arbetspass`);
  try {
    for(var i = 0; i < eventsToAdd.length; i++) {
      await addEvent(token['access_token'], eventsToAdd[i]);
    }
  } catch(err) {
    console.log("Kunde inte lägga till arbetspass");
    console.log(err);
  }
  console.log("Klar!");

})();
