const dns = require('dns');
const { promises: fs } = require('fs');
const { MongoClient } = require('mongodb');
const { EJSON } = require('bson');

// https://github.com/nodejs/node/issues/40537
dns.setDefaultResultOrder('ipv4first');

// Connection URL
const url = 'mongodb://localhost:27017';
const client = new MongoClient(url);

// Database Name
const dbName = 'myProject';

async function main() {
  // Use connect method to connect to the server
  await client.connect();
  console.log('Connected successfully to server');
  const db = client.db(dbName);
  const collection = db.collection('documents');

  // the following code examples can be pasted here...
  await run({ client, db, collection});

  return 'done.';
}

function pause() {
  return new Promise((resolve) => {
    setTimeout(resolve, 50);
  });
}

async function run({ client, db, collection}) {
  let latestSession;
  while (true) {
    const newLatestSession = await fs.readFile('./latest-session', 'utf8');
    console.log(newLatestSession);
    // it is always the same session
    //if (newLatestSession === latestSession) {
    //  console.log('newLatestSession === latestSession');
    //  await pause();
    //  continue;
    //}

    latestSession = newLatestSession;

    // make sure we can parse it in case it was still being written
    try {
      EJSON.parse(latestSession)
    } catch(err) {
      console.error(err.stack);
      await pause();
      continue;
    }

    console.log('killing', EJSON.parse(latestSession));
    const command = {
      killSessions: [EJSON.parse(latestSession) ]
    }
    console.log(await client.db('admin').command(command));

    //await pause(); // just pause before killing the same session again
  }
}

main()
  .then(() => console.log)
  .catch((err) => console.error(err.stack))
  .finally(() => client.close());