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

function pause(waitSeconds) {
  console.log(`pausing ${waitSeconds} seconds`);
  return new Promise((resolve) => { setTimeout(resolve, waitSeconds*1000)});
};

function killTimeout() {
  return Math.random(100); // milliseconds
}


async function run({ client, db, collection}) {
  let lastSession;

  const killSession = async () => {
    // uncomment to get lots more errors
    //if (lastSession.inTransaction()) {
      // abort it
      //await lastSession.abortTransaction();
      // end it
      //await lastSession.endSession();
    //}

    // then kill it
    const command = {
      killSessions: [lastSession.id]
    }
    const result = await client.db('admin').command(command);
    //console.log(command, '=>', result);
    setTimeout(killSession, killTimeout());
  };

  setTimeout(killSession, killTimeout());

  while (true) {
    const startTime = Date.now();
    try {
      lastSession = client.startSession();
      console.log(EJSON.stringify(lastSession.id));
      const result = await lastSession.withTransaction(async () => {
        const docs = await collection
          .find({ /* user's filter goes here */ }, { session: lastSession })
          .sort({ _id: 1 })
          .limit(10)
          .toArray();

        const ids = docs.map((doc) => doc.id);
        await collection.updateMany(
          { _id: { $in: ids } },
          { $set: { foo: 'bar' } }, // user's update goes here
          { session: lastSession }
        );

        const changedDocs = await collection
          .find(
            { _id: { $in: ids } },
            { session: lastSession }
          )
          .sort({ _id: 1 })
          .toArray();
        const changes = docs.map((before, idx) => ({
          before,
          after: changedDocs[idx],
        }));

        if (lastSession.inTransaction()) {
          await lastSession.abortTransaction();
          await lastSession.endSession();
        }

        return { changes };
      });

      console.log('resolve');
      //console.log(EJSON.stringify(result));
    } catch (err) {
      console.log('reject');
      console.error(err.stack);
    }
    console.log('elapsed', Date.now() - startTime);

    // just slow things long enough that you can see what's going on
    await pause(2);
  }
}

main()
  .then(console.log)
  .catch(console.error)
  .finally(() => client.close());