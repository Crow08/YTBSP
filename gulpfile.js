var gulp = require('gulp');
var less = require('gulp-less');
var path = require('path');
var uglify = require('gulp-uglify');
var babel = require('gulp-babel')
var concat = require('gulp-concat')
var sourcemaps = require('gulp-sourcemaps');
var fs = require('fs');
const del = require('del');

function lessTask(cb) {
    return gulp.src('src/**/*.less')
    .pipe(
        less({
            paths: [ path.join(__dirname, 'less', 'includes') ]
        })
    )
    .pipe(gulp.dest('build/css'));
}

function uglifyTask(cb) {
    return gulp.src('./build/babel/**/*.js')
    .pipe(
        uglify()
    )
    .pipe(gulp.dest('./build/js/test.js'));
}  

function babelTask(cb) {
    return gulp.src('src/**/*.js')
    .pipe(babel({
        presets: ['@babel/env'],
        sourceType: "script"
    }))
    .pipe(gulp.dest('build/babel'))
} 

function concatTask(cb) {
    return gulp.src(['build/babel/header.js', 'build/css/CSSString.js', 'build/babel/YTBSP.js'])
    .pipe(
        concat('YTBSP.js')
    )
    .pipe(gulp.dest('./build'));
} 

function cssFileToJSStringTask(cb){
    var cssString = "var cssString = `";
    var fileContent = fs.readFileSync('build/css/ytbsp-stylesheet.css');
    cssString += fileContent.toString();
    cssString += '`';
    fs.writeFileSync('build/css/CSSString.js', cssString);
    cb();
}

function cleanTask(cb){
    return del([
        'build/'
    ]);
}

exports.default = gulp.series(cleanTask, gulp.parallel(lessTask, babelTask), cssFileToJSStringTask, concatTask);
exports.less = lessTask;
exports.uglify = uglifyTask;
exports.babel = babelTask;
exports.concat = concatTask;
exports.cssFileToJSString = cssFileToJSStringTask;
exports.clean = cleanTask;