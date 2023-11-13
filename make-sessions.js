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
  const maxSeconds = 2;
  // random amount of time up to maxSeconds
  const waitTime = Math.random()*maxSeconds;
  console.log(`pausing ${waitTime.toFixed(2)} seconds`);
  return new Promise((resolve) => { setTimeout(resolve, waitTime*1000)});
};

async function run({ client, db, collection}) {
  while (true) {
    const startTime = Date.now();
    try {
      const session = client.startSession();
      const sessionJSON = EJSON.stringify(session.id);
      console.log(sessionJSON);
      await fs.writeFile('./latest-session', sessionJSON, 'utf-8');
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

    // this is just here to slow things down so you can read the output. the fact that it is semi-random is vestigial
    await pause();
  }
}

main()
  .then(console.log)
  .catch(console.error)
  .finally(() => client.close());