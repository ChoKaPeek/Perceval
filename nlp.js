const path = require('path');
const tf = require('@tensorflow/tfjs-node');
const natural = require('natural');
natural.LancasterStemmer.attach(); // str.stem() str.tokenizeAndStem()
const tokenizer = new natural.WordTokenizer();

const fs = require('fs');
const intents = require('./intents.json');

const MODEL = './model.tflearn';

// promisify fs.readFile() fs.writeFile()
fs.readFileAsync = function (filename) {
    return new Promise((resolve, reject) => {
        fs.readFile(filename, (err, buffer) => {
            if (err) reject(err); else resolve(buffer);
        });
    });
};

fs.writeFileAsync = function (filename, object) {
    return new Promise((resolve, reject) => {
        fs.writeFile(filename, object, (err, buffer) => {
            if (err) reject(err); else resolve(buffer);
        });
    });
};

let saved_data = null;
let model = null;

async function initialise() {
  saved_data = await getData();
  model = await getModel();
}

async function createData() {
  let words = [];
  const labels = [];
  const docs_x = [];
  const docs_y = [];

  const intents = await fs.readFileAsync('./intents.json')
    .then((success) => JSON.parse(success))
    .catch((err) => console.error(err));

  if (!intents) {
    console.error("No intention parsed");
    return null;
  }

  intents["intents"].forEach((intent) => {
    intent["patterns"].forEach((pattern) => {
      const tmp_words = tokenizer.tokenize(pattern);
      words = words.concat(tmp_words);
      docs_x.push(tmp_words);
      docs_y.push(intent["tag"]);
    });
    if (labels.find((e) => e === intent["tag"]) === undefined) {
      labels.push(intent["tag"]);
    }
  });

  words = [...new Set(words.map((w) => w.toLowerCase().stem()))];
  words.sort();
  labels.sort();

  const training = [];
  const output = [];

  docs_x.forEach((doc, x) => {
    const tmp_words = doc.map((w) => w.toLowerCase().stem());

    training.push(words.map((w) => tmp_words.find(tw => tw === w) === undefined ? 0 : 1));

    const output_row = new Array(labels.length).fill(0);
    output_row[labels.indexOf(docs_y[x])] = 1;
    output.push(output_row);
  });

  writeData({words, labels, training, output});

  return {words, labels, training, output};
}

function writeData(data) {
  const json_data = JSON.stringify(data);

  return fs.writeFileAsync('./data.json', json_data)
    .then((success) => console.log("Data stored"))
    .catch((err) => console.error(err));
}

function getData() {
  return fs.readFileAsync('./data.json')
    .then((success) => JSON.parse(success))
    .catch((err) => {
      if (err.code === 'ENOENT') {
        return createData();
      }
      console.error(err);
      return null;
    });
}

function getModel() {
  try {
    fs.accessSync(MODEL, fs.F_OK);

    return tf.loadLayersModel("file://" + path.join(MODEL, "model.json"));
  } catch (err) {
    if (err.code === "ENOENT") {
      // File does not exist, let's create a tf model
      const model = tf.sequential({
        layers: [
          tf.layers.dense({units: 8, inputShape: [saved_data["training"][0].length]}),
          tf.layers.dense({units: 8}),
          tf.layers.dense({units: saved_data["output"][0].length, activation: "softmax"})
        ]
      });

      model.compile({loss: 'meanSquaredError', optimizer: 'adam'});

      return model.fit(tf.tensor2d(saved_data["training"]), tf.tensor2d(saved_data["output"]), {epochs: 100, batchSize: 8})
        .then((history) => {
          model.save("file://" + MODEL); // don't wait
          return model;
        });
    } else {
      console.error(err);
    }
  }
  return null;
}

function saveModel() {
  model.save("file://" + MODEL);
}

function bag_of_words(s, words) {
  const s_words = s.tokenizeAndStem();
  const bag = words.map((w) => s_words.find(sw => sw === w) === undefined ? 0 : 1);
  return tf.tensor2d(bag, [bag.length, 1]).reshape([-1, bag.length]);
}

async function chat(input) {
  if (!model) {
    await initialise();
  }

  const result = model.predict(bag_of_words(input, saved_data["words"]));
  const max_value_index = result.argMax(1).arraySync()[0];
  const array_result = result.arraySync()[0];
  const tag = saved_data["labels"][max_value_index];
  if (array_result[max_value_index] > 0.7) {
    // return
  } else {
    console.log("Intention detected: " + tag + " " + array_result[max_value_index]);
    console.log("  Input: " + input);
 }
}
