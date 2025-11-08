const gulp = require("gulp");
const { parallel, series } = require("gulp");
const bs = require("browser-sync").create();
const concat = require("gulp-concat");
const minify = require("gulp-minify");
var uglify = require("gulp-uglify");
const cleanCss = require("gulp-clean-css");
const purgecss = require("gulp-purgecss");
const rename = require("gulp-rename");

const config = {
    cssBuildPath: "assets/dist/css/",
    jsBuildPath: "assets/dist/js/",
};

const paths = {
    syncFiles: ["index.html", "assets/js/**/*.js", "assets/css/*.css"],
    css: [
        "assets/css/bootstrap.min.css",
        "assets/css/core.css",
        "assets/css/components.css",
        "assets/css/icons.css",
        "assets/css/responsive.css",
        "assets/plugins/chosen/chosen.min.css",
        "assets/plugins/daterangepicker/daterangepicker.css",
        "assets/plugins/dataTables/jquery.dataTables.min.css",
        "assets/plugins/dataTables/dataTables.bootstrap.min.css",
        "assets/css/pages.css",
    ],
    js: [
        "node_modules/moment/min/moment.min.js",
        "renderer.js",
        "assets/plugins/bootstrap/bootstrap.min.js",
        "assets/plugins/chosen/chosen.jquery.min.js",
        "assets/plugins/jquery-ui/jquery.form.min.js",
        "assets/plugins/daterangepicker/daterangepicker.min.js",
        "assets/plugins/dataTables/jquery.dataTables.min.js",
        "assets/plugins/dataTables/dataTables.bootstrap.min.js",
        "assets/plugins/dataTables/dataTables.buttons.min.js",
        "assets/plugins/dataTables/buttons.html5.min.js",
        "assets/plugins/dataTables/pdfmake.min.js",
        "assets/plugins/dataTables/vfs_fonts.js",
    ],
};

const options = {
    uglify: {
        compress: { dead_code: true, drop_console: true },
    },
};

function packCss() {
    return gulp
        .src(paths.css)
        .pipe(cleanCss({ rebaseTo: config.cssBuildPath }))
        .pipe(concat("bundle.min.css"))
        .pipe(purgecss({ content: [].concat(paths.syncFiles, paths.js) }))
        .pipe(gulp.dest(config.cssBuildPath));
}

function packJs() {
    return gulp
        .src(paths.js)
        .pipe(concat("bundle.min.js"))
        .pipe(uglify())
        .pipe(gulp.dest(config.jsBuildPath));
}

function sync() {
    gulp.watch([].concat(paths.css, paths.syncFiles), gulp.series(packCss));
    gulp.watch(paths.js, gulp.series(packJs));
}

function reload(done) {
    bs.reload();
    done();
}

const watch = () => gulp.watch(paths.syncFiles, gulp.series(reload));
exports.default = gulp.parallel(watch, sync);
exports.packJs = packJs;
exports.packCss = packCss;
