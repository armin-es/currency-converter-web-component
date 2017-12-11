const gulp = require('gulp');
const uglify = require('gulp-uglify'); // Minify JS files
const livereload = require('gulp-livereload');
const concat = require('gulp-concat');
const cleanCSS = require('gulp-clean-css'); // Minify CSS files
const autoprefixer = require('gulp-autoprefixer'); // CSS autoprefixer
const plumber = require('gulp-plumber'); // Error handler
const sourcemaps = require('gulp-sourcemaps');
const sass = require('gulp-sass');
const babel = require('gulp-babel');



const del = require('del');

const zip = require('gulp-zip');

//File paths
const PATH = {
	HTML: 'public/index.html',
	SCRIPTS: 'public/js/**/*.js',
	STYLES: 'public/scss/**/*.scss',
	DIST: 'public/dist',
}


//HTML
gulp.task('html', () => {
	console.log("starting html task");

	return gulp.src('public/index.html')
		.pipe(plumber(function(err) {
			console.log('Error in HTML');
			console.log(err);
			this.emit('end');
		}))
		.pipe(gulp.dest(PATH.DIST))
		.pipe(livereload());
});



//Styles
gulp.task('styles', () => {
	console.log("starting styles task");

	return gulp.src('public/scss/style.scss')
		.pipe(plumber(function(err) {
			console.log('Error in styles');
			console.log(err);
			this.emit('end');
		}))
		.pipe(sourcemaps.init())
		.pipe(autoprefixer({ browsers: ['last 2 versions']}))
		.pipe(sass())
		.pipe(sourcemaps.write())
		.pipe(gulp.dest(PATH.DIST))
		.pipe(livereload());
		// {outputStyle: 'compressed'}
});


//Scripts
gulp.task('scripts', () => {
	console.log('starting scripts task');

	return gulp.src(PATH.SCRIPTS)
		.pipe(plumber(function(err) {
			console.log('Error in scripts');
			console.log(err);
			this.emit('end');
		}))
		.pipe(sourcemaps.init())
		.pipe(babel({presets: ['env']}))
		// .pipe(uglify())
		.pipe(concat('script.js'))
		.pipe(sourcemaps.write())
		.pipe(gulp.dest(PATH.DIST))
		.pipe(livereload());
});



// Delete files and folders
gulp.task('clean', () => {
	return del.sync([PATH.DIST]);
});

// Export (zip)
gulp.task('export', () => {
	return gulp.src('./public/**/*')
		.pipe(zip('project.zip'))
		.pipe(gulp.dest('./'));
});

//Copy fonts
gulp.task('copy', () => {
	return gulp.src('./public/scss/fonts/*')
		.pipe(gulp.dest('./public/dist/fonts/'));
});

//Default
gulp.task('default', ['copy', 'html', 'styles', 'scripts'], () => {
	console.log("starting default task");
});

//watch
gulp.task('watch', ['default'], () => {
	console.log("starting watch task");
	require('./app.js');
	livereload.listen();
	gulp.watch(PATH.HTML, ['html']);
	gulp.watch(PATH.SCRIPTS, ['scripts']);
	gulp.watch(PATH.STYLES, ['styles']);
});