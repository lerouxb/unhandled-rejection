# unhandled-rejection

have a replset running on 27017: `npx mongodb-runner start -t replset -- --port 27017`

create a database and collection `myProject.documents`

import some data to that collection

in one terminal, run `node make-sessions.js`

in another, run `node kill-sessions.js`
