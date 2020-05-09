const { parentPort, workerData } = require('worker_threads');
const Task = require('./classes/TriviaTask');

const { accountList } = workerData;

const quizzes = [
  'wizard101-wizard-city-trivia',
  'wizard101-marleybone-trivia',
  'wizard101-spellbinding-trivia',
  'wizard101-mystical-trivia',
  'wizard101-spells-trivia',
  'wizard101-adventuring-trivia',
  'wizard101-conjuring-trivia',
  'wizard101-zafaria-trivia',
  'wizard101-magical-trivia',
  'pirate101-valencia-trivia',
];

const spawnTask = async (username, password) => {
  const tasks = quizzes.map((quiz) => new Task(quiz, username, password));

  await Promise.all(tasks.map(async (task) => await task.start()));
};

(async () => {
  console.log('Spawned Worker');
  for ({ username, password } of accountList) {
    await spawnTask(username, password);
  }
})();
