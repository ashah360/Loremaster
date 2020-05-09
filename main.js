const fs = require('fs');
const os = require('os');
const { Worker } = require('worker_threads');

const WORKER_COUNT = os.cpus.length;

const parseAccounts = () => {
  const accounts = fs.readFileSync('./accounts.txt', { encoding: 'utf-8' });

  return accounts.split('\n').map((account) => {
    account = account.split(':');
    return { username: account[0], password: account[1] };
  });
};

function chunkArray(arr, chunkCount) {
  const chunks = [];
  while (arr.length) {
    const chunkSize = Math.ceil(arr.length / chunkCount--);
    const chunk = arr.slice(0, chunkSize);
    chunks.push(chunk);
    arr = arr.slice(chunkSize);
  }
  return chunks;
}

const accounts = chunkArray(parseAccounts(), WORKER_COUNT);

const spawnWorkers = () => {
  for (accountList of accounts) {
    const port = new Worker(require.resolve('./worker.js'), {
      workerData: { accountList },
    });

    port.on('error', (e) => console.log(e));
    port.on('exit', (e) => console.log('Worker has completed all tasks'));
  }
};

(() => {
  spawnWorkers();
})();
