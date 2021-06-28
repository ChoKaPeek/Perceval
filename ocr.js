const { createWorker } = require('tesseract.js');
const cv = require("opencv");
const jimp = require('jimp');

let worker;

const templates = {
  gold: null,
  orn: null,
  florin: null,
  orn_gaunt: null
}

const root = 'ocr/';
const temp = root + 'tmp/';
const temp_jimp = temp + 'jimp.jpg';
const temp_cv = temp + 'cv.jpg';
const temp_win = temp + 'win.jpg';

const matchMethods = {
  "TM_SQDIFF": 0, "TM_SQDIFF_NORMED": 1, "TM_CCORR": 2,
  "TM_CCORR_NORMED": 3, "TM_CCOEFF": 4, "TM_CCOEFF_NORMED": 5
}

// example: convert("img.png", "img.js")
async function convert(src, dst) {
  Jimp.read(src, function (err, image) {
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
  templates.gold = await cv.readImage(root + "gold.jpg");
  templates.orn = await cv.readImage(root + "orn.jpg");
  templates.florin = await cv.readImage(root + "florin.jpg");

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
  const path = `${temp}${uniq}.jpg`;
  const win_info = await mat.crop(x, y, width, height);
  await win_info.save(path);

  return await worker.recognize(path).then((obj) => {
    let text = obj.data.text.split('\n');
    if (text)
    {
      let line = text[0].split(' ');
      if (line && line.length > 0)
        return line[line.length - 1]
    }
    return "Could not find the number"
  });

}

module.exports.readGuild = async (url) => {
  // read the url with an external lib
  // no choice but saving locally to be able to open the image
  // libraries binding opencv did not handle url cases
  const image = await jimp.read(url);
  await image.writeAsync(temp_jimp);

  let mat = await cv.readImage(temp_jimp);
  mat = await mat.crop(0, 0, mat.width(), Math.floor(mat.height() / 10));

  const gold = await templateMatch(mat, templates.gold);
  const orn = await templateMatch(mat, templates.orn);
  const florin = await templateMatch(mat, templates.florin);

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
