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


async function run({ client, db, collection}) {
  let lastSessionId;

  const killSession = async () => {
    const command = {
      killSessions: [lastSessionId]
    }
    const result = await client.db('admin').command(command);
    //console.log(command, '=>', result);
    setTimeout(killSession, 0);
  };

  setTimeout(killSession, 0);

  while (true) {
    const startTime = Date.now();
    try {
      const session = client.startSession();
      lastSessionId = session.id;
      const sessionJSON = EJSON.stringify(lastSessionId);
      console.log(sessionJSON);
      const result = await session.withTransaction(async () => {
        const docs = await collection
          .find({ /* user's filter goes here */ }, { session })
          .sort({ _id: 1 })
          .limit(10)
          .toArray();

        const ids = docs.map((doc) => doc.id);
        await collection.updateMany(
          { _id: { $in: ids } },
          { $set: { foo: 'bar' } }, // user's update goes here
          { session }
        );

        const changedDocs = await collection
          .find(
            { _id: { $in: ids } },
            { session }
          )
          .sort({ _id: 1 })
          .toArray();
        const changes = docs.map((before, idx) => ({
          before,
          after: changedDocs[idx],
        }));

        if (session.inTransaction()) {
          await session.abortTransaction();
          await session.endSession();
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