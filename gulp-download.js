/* global require, module, Buffer */

const through = require("through");
const File = require("vinyl");
const request = require("request");

module.exports = (urls) => {
    const stream = through(function(file, enc, cb) {
        this.push(file);
        cb();
    });
    const download = (url) => {
        const fileName = url.split("/").pop();
        console.log(`[\x1b[90m${(new Date()).toLocaleTimeString()}\x1b[0m] ` +
        `Download started   : '\x1b[36m${fileName}\x1b[0m'...`);
        request({"url": url, "encoding": null}, (err, res, body) => {
            if (err) {
                console.error(err);
            } else {
                const file = new File({"path": fileName, "contents": Buffer.from(body)});
                stream.queue(file);
                console.log(`[\x1b[90m${(new Date()).toLocaleTimeString()}\x1b[0m] ` +
                `Download completed : '\x1b[36m${fileName}\x1b[0m'`);
            }
            if (0 < urlArray.length) {
                download(urlArray.shift());
            } else {
                stream.emit("end");
            }
        });
    };
    const urlArray = "string" === typeof urls ? [urls] : urls;
    download(urlArray.shift());
    return stream;
};
