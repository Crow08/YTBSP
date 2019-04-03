/* eslint-disable no-implicit-globals */
/* global require, exports, __dirname */

const gulp = require("gulp");
const less = require("gulp-less");
const path = require("path");
const uglify = require("gulp-uglify");
const babel = require("gulp-babel");
const concat = require("gulp-concat");
const rename = require('gulp-rename');
const fs = require("fs");
const del = require("del");

function cleanTask() {
    return del([
        "build/"
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
        .pipe(gulp.dest("./build/debug/uglify"))
        .pipe(gulp.dest("./build"));
}

function babelTask() {
    return gulp.src("./build/source_final.js")
        .pipe(babel({
            "presets": ["@babel/env"],
            "sourceType": "script"
        }))
        .pipe(gulp.dest("build/debug/babel"))
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

function renameHeaderTask() {
    return gulp.src("build/header.js")
        .pipe(rename("ytbsp.meta.js"))
        .pipe(gulp.dest("./build"));
}

function copyToDistTask() {
    return gulp.src(["build/ytbsp.user.js", "build/ytbsp.meta.js"])
        .pipe(gulp.dest("./dist", {"overwrite": true}));
}

function watchTask(cb) {
    gulp.watch(["src/*"], exports.default);
    cb();
}

const baseTask = gulp.series(cleanTask, copySrcTask, lessTask, cssToJsTask, concatSourceTask, gulp.parallel(wrapSourceWithFunctionTask, wrapLicenceAsCommentTask));
exports.default = gulp.series(baseTask, finalConcatTask);
exports.babel = gulp.series(baseTask, babelTask, finalConcatTask);
exports.uglify = gulp.series(baseTask, babelTask, uglifyTask, finalConcatTask);
exports.release = gulp.series(exports.uglify, renameHeaderTask, copyToDistTask);
exports.clean = cleanTask;
exports.watch = watchTask;

