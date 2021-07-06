const { createWorker } = require('tesseract.js');
const cv = require("opencv");
const jimp = require('jimp');

let worker;

const templates = {};

const root = 'ocr/';
const temp = root + 'tmp/';
const temp_jimp = temp + 'jimp.jpg';
const temp_cv = temp + 'cv.jpg';
const temp_win = temp + 'win.jpg';

const matchMethods = {
  "TM_SQDIFF": 0, "TM_SQDIFF_NORMED": 1, "TM_CCORR": 2,
  "TM_CCORR_NORMED": 3, "TM_CCOEFF": 4, "TM_CCOEFF_NORMED": 5
}

const devices = {
  "720x1600": "normal",
  "1080x2340": "large"
}

// example: convert("img.png", "img.jpg")
async function convert(src, dst) {
  jimp.read(src, function (err, image) {
    if (err) {
      console.log(err)
    } else {
      image.write(dst)
    }
  })
}

async function init(message) {
  console.log("Initialising OCR...")

  worker = createWorker();
  await worker.load();
  await worker.loadLanguage('eng');
  await worker.initialize('eng');
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789', // could be used to match numbers
  });

  templates.orn_gaunt = await cv.readImage(root + "orn_gaunt.jpg");
  templates.orn_gaunt.convertGrayscale();
  await Object.keys(devices).forEach(async (key) => {
    templates[devices[key]] = {};
    templates[devices[key]].gold = await cv.readImage(root + devices[key] + "_gold.jpg");
    templates[devices[key]].orn = await cv.readImage(root + devices[key] + "_orn.jpg");
    templates[devices[key]].florin = await cv.readImage(root + devices[key] + "_florin.jpg");
  });

  //await module.exports.readGuild('https://cdn.discordapp.com/attachments/800731875290513488/859195099569324042/mowiss_guild.png');
  console.log("OCR initialised.")
}

init();

async function destruct(message) {
  await worker.terminate();
}

async function templateMatch(mat, template, save=false) {
  const method = matchMethods["TM_SQDIFF"];
  const res = mat.matchTemplateByMatrix(template, method);
  const { minVal, maxVal, minLoc, maxLoc } = res.minMaxLoc();

  let top_left = (method == matchMethods["TM_SQDIFF"]
    || method == matchMethods["TM_SQDIFF_NORMED"])
    ? minLoc : maxLoc;
  top_left = [top_left.x, top_left.y];
  const sizes = [template.width(), template.height()];

  if (save)
  {
    mat.rectangle(top_left, sizes, [255, 255, 255, 100], 4);
    await mat.save(temp_cv);
  }

  return {top_left, sizes};
}

async function getNumberIn(mat, x, y, width, height, uniq="default") {
  if (x <= 0 || y <= 0 || width <= 0 || height <= 0)
    return "Could not find the number";

  const win_info = await mat.crop(x, y, width, height);

  // forced to save then reload for the picture to be in jpg format...
  const path = `${temp}${uniq}.jpg`;
  await win_info.save(path);

  return await worker.recognize(path).then((obj) => {
    let text = obj.data.text.split('\n');
    if (text)
    {
      let line = text[0].split(' ');
      if (line && line.length > 0)
        return line[line.length - 1];
    }
    return "Could not find the number";
  });

}

module.exports.readGuild = async (url) => {
  // read the url with an external lib
  // no choice but saving locally to be able to open the image
  // libraries binding opencv did not handle url cases
  const image = await jimp.read(url);
  await image.writeAsync(temp_jimp);

  let mat = await cv.readImage(temp_jimp);

  // device-specific choice of template
  const template = templates[devices[`${mat.width()}x${mat.height()}`]];
  console.log(template);

  mat = await mat.crop(0, 0, mat.width(), Math.floor(mat.height() / 10));

  const gold = await templateMatch(mat, template.gold);
  const orn = await templateMatch(mat, template.orn);
  const florin = await templateMatch(mat, template.florin);

  const number_gold = await getNumberIn(mat, gold.top_left[0] + gold.sizes[0],
    gold.top_left[1], orn.top_left[0] - gold.top_left[0] - gold.sizes[0], gold.sizes[1], "gold");
  const number_orn = await getNumberIn(mat, orn.top_left[0] + orn.sizes[0],
    orn.top_left[1], florin.top_left[0] - orn.top_left[0] - orn.sizes[0], orn.sizes[1], "orn");
  const number_florin = await getNumberIn(mat, florin.top_left[0] + florin.sizes[0],
    florin.top_left[1], mat.width() - florin.top_left[0] - florin.sizes[0], florin.sizes[1], "florin");

  return { gold: number_gold, orn: number_orn, florin: number_florin };
}

module.exports.readImage = async (url) => {
  // read the url with an external lib
  // no choice but saving locally to be able to open the image
  // libraries binding opencv did not handle url cases
  const image = await jimp.read(url);
  await image.writeAsync(temp_jimp);

  let mat = await cv.readImage(temp_jimp);
  mat = await mat.crop(0, Math.floor(mat.height() / 10), mat.width(), Math.floor(mat.height() / 3));
  mat.convertGrayscale();

  const {top_left, sizes} = await templateMatch(mat, templates.orn_gaunt);

  return await getNumberIn(mat, top_left[0] + sizes[0], top_left[1], mat.width() - top_left[0] - sizes[0], sizes[1]);
}
