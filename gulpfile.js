/* eslint-disable no-implicit-globals */
/* global require, exports, __dirname */

const gulp = require("gulp");
const less = require("gulp-less");
const path = require("path");
const uglify = require("gulp-uglify");
const babel = require("gulp-babel");
const concat = require("gulp-concat");
const rename = require("gulp-rename");
const download = require("gulp-download");
const fs = require("fs");
const del = require("del");

function cleanBuildTask() {
    return del([
        "build/"
    ]);
}

function cleanReleaseTask() {
    return del([
        "dist/"
    ]);
}

function copySrcTask() {
    return gulp.src(["src/**/*.*", "LICENSE.md"])
        .pipe(gulp.dest("build", {"overwrite": true}));
}

function lessTask() {
    return gulp.src("build/**/*.less")
        .pipe(less({
            "paths": [path.join(__dirname, "less", "includes")]
        }))
        .pipe(gulp.dest("build/css"));
}

function cssToJsTask(cb) {
    const writable = fs.createWriteStream("build/css/CSSString.js");
    writable.write("var cssString = `");
    const readable = fs.createReadStream("build/css/ytbsp-stylesheet.css");
    readable.pipe(writable, {"end": false});
    readable.on("end", () => {
        writable.end("`");
        cb();
    });
}

function uglifyTask() {
    return gulp.src("./build/source_final.js")
        .pipe(uglify())
        .pipe(gulp.dest("./build"));
}

function babelTask() {
    return gulp.src("./build/source_final.js")
        .pipe(babel({
            "presets": ["@babel/env"],
            "sourceType": "script"
        }))
        .pipe(gulp.dest("build", {"overwrite": true}));
}

function concatSourceTask() {
    return gulp.src(["build/Objects/Subscription.js", "build/Objects/Video.js", "build/Objects/Player.js", "build/css/CSSString.js", "build/main.js"])
        .pipe(concat("source_concat.js"))
        .pipe(gulp.dest("build"));
}

function wrapSourceWithFunctionTask(cb) {
    const writable = fs.createWriteStream("build/source_final.js");
    writable.write("(function() {\n");
    const readable = fs.createReadStream("build/source_concat.js");
    readable.pipe(writable, {"end": false});
    readable.on("end", () => {
        writable.end("\n})(window.unsafeWindow || window);");
        cb();
    });
}

function wrapLicenceAsCommentTask(cb) {
    const writable = fs.createWriteStream("build/license_final.js");
    writable.write("/*\n");
    const readable = fs.createReadStream("build/LICENSE.md");
    readable.pipe(writable, {"end": false});
    readable.on("end", () => {
        writable.end("*/\n");
        cb();
    });
}

function finalConcatTask() {
    return gulp.src(["build/header.js", "build/license_final.js", "build/globals.js", "build/source_final.js"])
        .pipe(concat("ytbsp.user.js"))
        .pipe(gulp.dest("./build"));
}

function createMetaFile() {
    return gulp.src("build/header.js")
        .pipe(rename("ytbsp.meta.js"))
        .pipe(gulp.dest("./build"));
}

function releaseScript() {
    return gulp.src(["build/ytbsp.user.js", "build/ytbsp.meta.js"])
        .pipe(gulp.dest("./dist", {"overwrite": true}));
}

function copyExtensionSrcToDistTask() {
    return gulp.src(["build/ext/*.*", "build/ytbsp.user.js"])
        .pipe(gulp.dest("./dist/ext", {"overwrite": true}));
}

function downloadExtensionLibsTask() {
    return download([
        "https://apis.google.com/js/api.js",
        "https://cdnjs.cloudflare.com/ajax/libs/jquery/3.3.1/jquery.slim.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.21.0/moment.min.js"
    ]).pipe(gulp.dest("./dist/ext/lib"));
}

function checkReleaseVersion() {
    return new Promise((resolve, reject) => {
        getVersionFromJson("./package.json", (packageVersion) => {
            getVersionFromHeader("./src/header.js", (scriptVersion) => {
                getVersionFromJson("./src/ext/manifest.json", (extVersion) => {
                    getVersionFromHeader("./dist/ytbsp.meta.js", (oldScriptVersion) => {
                        if (packageVersion === scriptVersion &&
                        packageVersion === extVersion &&
                        scriptVersion > oldScriptVersion) {
                            resolve();
                        } else {
                            reject(new Error(" Package, script and extension version must be equal " +
                            "and greater than old script version:\n" +
                            `\tpackage version   \t:\t${packageVersion}\n` +
                            `\tscript version    \t:\t${scriptVersion}\n` +
                            `\textension version \t:\t${extVersion}\n` +
                            `\told script version\t:\t${oldScriptVersion}\n`));
                        }
                    });
                });
            });
        });
    });
}

function getVersionFromJson(filePath, cb) {
    fs.readFile(filePath, "utf8", (e, json) => {
        if (e) {
            throw e;
        }
        cb(JSON.parse(json).version);
    });
}
function getVersionFromHeader(filePath, cb) {
    fs.readFile(filePath, "utf8", (e, header) => {
        if (e) {
            throw e;
        }
        const start = header.indexOf("version") + 7;
        const length = header.indexOf("\n", start) - start;
        cb(header.substr(start, length).trim());
    });
}


function watchTask(cb) {
    gulp.watch(["src/*"], exports.default);
    cb();
}

const baseTask = gulp.series(cleanBuildTask, copySrcTask, lessTask, cssToJsTask, concatSourceTask, gulp.parallel(wrapSourceWithFunctionTask, wrapLicenceAsCommentTask));
const releaseExtensionTask = gulp.parallel(copyExtensionSrcToDistTask, downloadExtensionLibsTask);
exports.default = gulp.series(baseTask, finalConcatTask);
exports.babel = gulp.series(baseTask, babelTask, finalConcatTask);
exports.uglify = gulp.series(baseTask, babelTask, uglifyTask, finalConcatTask);
exports.release = gulp.series(checkReleaseVersion, gulp.parallel(cleanReleaseTask, exports.uglify), createMetaFile, gulp.parallel(releaseScript, releaseExtensionTask));
exports.clean = cleanBuildTask;
exports.watch = watchTask;

