const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('DATA_DIR/gestionale.db'); // Wait, earlier I fixed DATA_DIR to be /var/lib/data on Render, but here I can test locally. Actually I don't have the live DB here. Let's just write a script to run on Render!
