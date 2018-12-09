var gulp = require('gulp');
var less = require('gulp-less');
var path = require('path');
var uglify = require('gulp-uglify');
var babel = require('gulp-babel')
var concat = require('gulp-concat')
var sourcemaps = require('gulp-sourcemaps');
var fs = require('fs');
const del = require('del');

function less_task(cb) {
    return gulp.src('src/**/*.less')
    .pipe(
        less({
            paths: [ path.join(__dirname, 'less', 'includes') ]
        })
    )
    .pipe(gulp.dest('build/css'));
}

function uglify_task(cb) {
    return gulp.src('./build/babel/**/*.js')
    .pipe(
        uglify()
    )
    .pipe(gulp.dest('./build/js/test.js'));
}  

function babel_task(cb) {
    return gulp.src('src/**/*.js')
    .pipe(babel({
        presets: ['@babel/env'],
        sourceType: "script"
    }))
    .pipe(gulp.dest('build/babel'))
} 

function final_concat_task(cb) {
    return gulp.src(['build/babel/header.js', 'build/source_final.js'])
    .pipe(
        concat('YTBSP.js')
    )
    .pipe(gulp.dest('./build'));
}

function concat_source_task(cb) {
    return gulp.src(['build/css/CSSString.js', 'src/YTBSP.js'])
    .pipe(
        concat('source_concat.js')
    )
    .pipe(gulp.dest('build'));
}

function wrap_source_with_function_task(cb) {
    const writable = fs.createWriteStream('build/source_final.js');
    writable.write('(function() {\n');
    const readable = fs.createReadStream('build/source_concat.js');
    readable.pipe(writable, { end: false });
    readable.on('end', () => {
        writable.end('\n})(window.unsafeWindow || window);');
        cb();
    });
}

function css_to_js_task(cb){
    var cssString = "var cssString = `";
    var fileContent = fs.readFileSync('build/css/ytbsp-stylesheet.css');
    cssString += fileContent.toString();
    cssString += '`';
    fs.writeFileSync('build/css/CSSString.js', cssString);
    cb();
}

function clean_task(cb){
    return del([
        'build/'
    ]);
}

exports.default = gulp.series(clean_task, gulp.parallel(less_task, babel_task), css_to_js_task, concat_source_task, wrap_source_with_function_task, final_concat_task);
exports.less = less_task;
exports.uglify = uglify_task;
exports.babel = babel_task;
exports.clean = clean_task;