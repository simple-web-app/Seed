let Parser = require('rss-parser');
let Axios = require('axios');
let parser = new Parser();

const COS = require('cos-nodejs-sdk-v5');
const cos = new COS({
  SecretId: process.env.COS_SECRETID,
  SecretKey: process.env.COS_SECRETKEY,
});

const path = require('path');

function uploadCOS(filename, data) {
  return new Promise((res, rej) => {
    cos.putObject({
      Bucket: 'simple-web-app-1251805302', /* 必须 */
      Region: 'ap-guangzhou',    /* 必须 */
      Key: filename,              /* 必须 */
      StorageClass: 'STANDARD',
      Body: data,
      onProgress: function(progressData) {},
    }, function(err, data) {
      if (!err) {
        // console.log(`Upload ${imgUrl} successfully`);
        res();
      } else {
        rej(err);
      }
    });
  });
}

(async () => {
  console.log('Login~');

  const axios = Axios.default;
  const TurndownService = require('turndown');

  let feed = await parser.parseURL('https://www.ithome.com/rss');

  for (const item of feed.items) {
    const turndown = new TurndownService();
    const md = turndown.turndown(item.content)
    item.md = md;

    const regExp = /(?<=!\[\]\()(https:\/\/img\.ithome\.com.*)(?=\))/g;
    const matchedURL = item.md.match(regExp);
    item.imgs = [];
    if (matchedURL) {
      for (const imgUrl of matchedURL) {
        console.log(`Downloading ${imgUrl}`);
        const { data } = await axios(imgUrl, {
          responseType: 'arraybuffer',
        });
        console.log(typeof data)
        require('fs').writeFileSync(path.basename(imgUrl), data);
        console.log(`Uploading ${imgUrl}`);
        await uploadCOS(path.basename(imgUrl), data);
        console.log(`Uploaded ${imgUrl}`);
        item.imgs.push(imgUrl);
      }
    }

    for (const img of item.imgs) {
      item.md = item.md.replace(img, `https://simple-web-app-1251805302.cos.ap-guangzhou.myqcloud.com/${path.basename(img)}`);
    }

    await axios('http://cahn233.cn:3333/api/article', {
      method: 'POST',
      data: {
        name: item.title,
        content: item.md,
        tags: [],
      },
    });
    console.log(`Added ${item.title}\n`)
  }

})();