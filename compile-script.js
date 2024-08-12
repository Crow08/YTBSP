/* eslint-disable */
const fs = require("fs");

console.log("delete old dist files ...");
if (fs.existsSync("./dist/ytbsp.meta.js")) {
    fs.unlinkSync("./dist/ytbsp.meta.js");
}
if (fs.existsSync("./dist/ytbsp.user.js")) {
    fs.unlinkSync("./dist/ytbsp.user.js");
}

console.log("concat templates and build file ...");
var packageFile = fs.readFileSync("./package.json", "utf8");
var headerFile = fs.readFileSync("./user-script-header.js", "utf8");
var licenseFile = fs.readFileSync("./LICENSE", "utf8");
var licenseVendorFile = fs.readFileSync("./dist/main.js.LICENSE.txt", "utf8");
var mainFile = fs.readFileSync("./dist/main.js", "utf8");

var version = JSON.parse(packageFile)["version"];
headerFile = headerFile.replace("{VERSION}", version);
licenseFile = "/*\n" + licenseFile + "*/\n";

// Workaround for TrustedTypes:
// replace htmlPrefilter of JQuery
mainFile = mainFile.replace("htmlPrefilter:function(t){return t}",
    "htmlPrefilter:function(t){if(typeof trustedTypes === 'undefined' || trustedTypes === null){return t;}var p=trustedTypes.createPolicy('foo',{createHTML:(input)=>input});return p.createHTML(t);}");

fs.writeFileSync("./dist/ytbsp.meta.js", headerFile, console.error);
fs.writeFileSync("./dist/ytbsp.user.js", [headerFile, licenseFile, licenseVendorFile, mainFile].join("\n"), console.error);

console.log("cleanup build file ...");
fs.unlinkSync("./dist/main.js");
fs.unlinkSync("./dist/main.js.LICENSE.txt");


console.log("Successfully build YTBSP script!");
