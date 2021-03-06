﻿/// <reference path="def/jquery.d.ts"/>
/// <reference path="def/interfaces.d.ts"/>

import constants = require('./constants');
import Direction = constants.Direction;
import MarioState = constants.MarioState;
import SizeState = constants.SizeState;
import GroundBlocking = constants.GroundBlocking;
import CollisionType = constants.CollisionType;
import DeathMode = constants.DeathMode;
import MushroomMode = constants.MushroomMode;
var setup = constants.setup;
var images = constants.images;

// Little Helpers
String.prototype.toUrl = function() {
	return 'url(' + this + ')';
};

Math.sign = function(x: number) {
	if (x > 0)
		return 1;
	else if (x < 0)
		return -1;
		
	return 0;
};

/*
 * -------------------------------------------
 * BASE CLASS
 * -------------------------------------------
 */
class Base implements Point, Size {
	frameCount: number;
	x: number;
	y: number;
	image: Picture;
	width: number;
	height: number;
	currentFrame: number;
	frameID: string;
	rewindFrames: boolean;
	frameTick: number;
	frames: number;
	view: JQuery;

	constructor(x: number = 0, y: number = 0) {
		this.setPosition(x, y);
		this.clearFrames();
		this.frameCount = 0;
	}
	setPosition(x: number, y: number) {
		this.x = x;
		this.y = y;
	}
	getPosition(): Point {
		return { x : this.x, y : this.y };
	}
	setImage(img: string, x: number, y: number) {
		this.image = {
			path : img,
			x : x,
			y : y
		};
	}
	setSize(width, height) {
		this.width = width;
		this.height = height;
	}
	getSize(): Size {
		return { width: this.width, height: this.height };
	}
	setupFrames(fps: number, frames: number, rewind: boolean, id?: string) {
		if (id) {
			if (this.frameID === id)
				return true;
			
			this.frameID = id;
		}
		
		this.currentFrame = 0;
		this.frameTick = frames ? (1000 / fps / setup.interval) : 0;
		this.frames = frames;
		this.rewindFrames = rewind;
		return false;
	}
	clearFrames() {
		this.frameID = undefined;
		this.frames = 0;
		this.currentFrame = 0;
		this.frameTick = 0;
	}
	playFrame() {
		if (this.frameTick && this.view) {
			this.frameCount++;
			
			if (this.frameCount >= this.frameTick) {			
				this.frameCount = 0;
				
				if (this.currentFrame === this.frames)
					this.currentFrame = 0;
					
				var $el = this.view;
				$el.css('background-position', '-' + (this.image.x + this.width * ((this.rewindFrames ? this.frames - 1 : 0) - this.currentFrame)) + 'px -' + this.image.y + 'px');
				this.currentFrame++;
			}
		}
	}
};


/*
 * -------------------------------------------
 * GAUGE CLASS
 * -------------------------------------------
 */
class Gauge extends Base {
	constructor(id: string, startImgX: number, startImgY: number, fps: number, frames: number, rewind: boolean) {
		super(0, 0);
		this.view = $('#' + id);
		this.setSize(this.view.width(), this.view.height());
		this.setImage(this.view.css('background-image'), startImgX, startImgY);
		this.setupFrames(fps, frames, rewind);
	}
};

/*
 * -------------------------------------------
 * LEVEL CLASS
 * -------------------------------------------
 */
class Level extends Base {
	world: JQuery;
	figures: Figure[];
	obstacles: Matter[][];
	decorations: Decoration[];
	items: Item[];
	lifes: number;
	liveGauge: Gauge;
	coinGauge: Gauge;
	active: boolean;
	nextCycles: number;
	loop: number;
	sounds: SoundManager;
	raw: LevelFormat;
	id: number;
	controls: Keys;

	constructor(id: string, controls: Keys) {
		this.world = $('#' + id);
		this.controls = controls;
		this.nextCycles = 0;
		super(0, 0);
		this.active = false;
		this.figures = [];
		this.obstacles = [];
		this.decorations = [];
		this.items = [];
		this.coinGauge = new Gauge('coin', 0, 0, 10, 4, true);
		this.liveGauge = new Gauge('live', 0, 430, 6, 6, true);
	}
	reload() {
		var settings: Settings = { };
		this.pause();
		
		for (var i = this.figures.length; i--; ) {
			this.figures[i].store(settings);
		}

		settings.lifes--;
		this.reset();
		
		if (settings.lifes < 0) {
			this.load(this.firstLevel());
		} else {		
			this.load(this.raw);
			
			for (var i = this.figures.length; i--; ) {
				this.figures[i].restore(settings);
			}
		}
		
		this.start();
	}
	nextLevel() {
		return this.raw;
	}
	firstLevel() {
		return this.raw;
	}
	load(level: LevelFormat) {
		if (this.active) {
			if (this.loop)
				this.pause();

			this.reset();
		}
			
		this.setPosition(0, 0);
		this.setSize(level.width * 32, level.height * 32);
		this.setBackground(level.background);
		this.raw = level;
		this.id = level.id;
		this.active = true;
		var data = level.data;
		
		for (var i = 0; i < level.width; i++) {
			var t = [];
			
			for (var j = 0; j < level.height; j++)
				t.push(undefined);
			
			this.obstacles.push(t);
		}
		
		for (var i = 0, width = data.length; i < width; i++) {
			var col = data[i];
			
			for (var j = 0, height = col.length; j < height; j++) {
				if (assets[col[j]])
					new (assets[col[j]])(i * 32, (height - j - 1) * 32, this);
			}
		}
	}
	next() {
		this.nextCycles = Math.floor(7000 / setup.interval);
	}
	nextLoad() {
		if (this.nextCycles)
			return;
		
		var settings : Settings = {};
		this.pause();
		
		for (var i = this.figures.length; i--; ) {
			this.figures[i].store(settings);
		}
		
		this.reset();
		this.load(this.nextLevel());
		
		for (var i = this.figures.length; i--; ) {
			this.figures[i].restore(settings);
		}
		
		this.start();
	}
	getGridWidth() {
		return this.raw.width;
	}
	getGridHeight() {
		return this.raw.height;
	}
	setSounds(manager: SoundManager) {
		this.sounds = manager;
	}
	playSound(label: string) {
		if (this.sounds)
			this.sounds.play(label);
	}
	playMusic(label: string) {
		if (this.sounds)
			this.sounds.sideMusic(label);
	}
	reset() {
		this.active = false;
		this.world.empty();
		this.figures = [];
		this.obstacles = [];
		this.items = [];
		this.decorations = [];
	}
	tick() {
		if (this.nextCycles) {
			this.nextCycles--;
			this.nextLoad();			
			return;
		}
		
		var i = 0, j = 0, figure, opponent;
		
		for (i = this.figures.length; i--; ) {
			figure = this.figures[i];
			
			if (figure.dead) {
				if (!figure.death()) {
					if (figure instanceof Mario)
						return this.reload();
						
					figure.view.remove();
					this.figures.splice(i, 1);
				} else
					figure.playFrame();
			} else {
				if (i) {
					for (j = i; j--; ) {
						if (figure.dead)
							break;
							
						opponent = this.figures[j];
						
						if (!opponent.dead && figure.q2q(opponent)) {
							figure.hit(opponent);
							opponent.hit(figure);
						}
					}
				}
			}
			
			if (!figure.dead) {
				figure.move();
				figure.playFrame();
			}
		}
		
		for (i = this.items.length; i--; )
			this.items[i].playFrame();
		
		this.coinGauge.playFrame();
		this.liveGauge.playFrame();
	}
	start() {
		this.controls.bind();
		this.loop = setInterval(() => this.tick(), setup.interval);
	}
	pause() {
		this.controls.unbind();
		clearInterval(this.loop);
		this.loop = undefined;
	}
	setPosition(x: number, y: number) {
		super.setPosition(x, y);
		this.world.css('left', -x);
	}
	setBackground(index: number) {
		var img = constants.basepath + 'backgrounds/' + ((index < 10 ? '0' : '') + index) + '.png';
		this.world.parent().css({
			backgroundImage : img.toUrl(),
			backgroundPosition : '0 -380px'
		});
		this.setImage(img, 0, 0);
	}
	setSize(width: number, height: number) {
		super.setSize(width, height);
	}
	setParallax(x: number) {
		this.setPosition(x, this.y);
		this.world.parent().css('background-position', '-' + Math.floor(x / 3) + 'px -380px');
	}
};

/*
 * -------------------------------------------
 * MATTER CLASS
 * -------------------------------------------
 */
class Matter extends Base {
	blocking: constants.GroundBlocking;
	level: Level;

	constructor(x: number, y: number, blocking: constants.GroundBlocking, level: Level) {
		this.blocking = blocking;
		this.view = $('<div />').addClass('matter').appendTo(level.world);
		this.level = level;
		super(x, y);
		this.setSize(32, 32);
		this.addToGrid(level);
	}
	addToGrid(level) {
		level.obstacles[this.x / 32][this.level.getGridHeight() - 1 - this.y / 32] = this;
	}
	setImage(img: string, x: number = 0, y: number = 0) {
		this.view.css({
			backgroundImage : img ? img.toUrl() : 'none',
			backgroundPosition : '-' + x + 'px -' + y + 'px',
		});
		super.setImage(img, x, y);
	}
	setPosition(x: number, y: number) {
		this.view.css({
			left: x,
			bottom: y
		});
		super.setPosition(x, y);
	}
};

/*
 * -------------------------------------------
 * FIGURE CLASS
 * -------------------------------------------
 */
class Figure extends Base implements GridPoint {
	dx: number;
	dy: number;
	onground: boolean;
	dead: boolean;
	vx: number;
	vy: number;
	level: Level;
	state: SizeState;
	direction: Direction;
	i: number;
	j: number;

	constructor(x: number, y: number, level: Level) {
		this.view = $('<div />').addClass('figure').appendTo(level.world);
		this.dx = 0;
		this.dy = 0;
		this.dead = false;
		this.onground = true;
		this.setState(SizeState.small);
		this.setVelocity(0, 0);
		this.direction = Direction.none;
		this.level = level;
		super(x, y);
		level.figures.push(this);
	}
	q2q(opponent: Figure) {
		if (this.x > opponent.x + 16)
			return false;		
		else if (this.x + 16 < opponent.x)
			return false;		
		else if (this.y + this.state * 32 - 4 < opponent.y)
			return false;		
		else if (this.y + 4 > opponent.y + opponent.state * 32)
			return false;
			
		return true;
	}
	setState(state: SizeState) {
		this.state = state;
	}
	hurt(opponent: Figure) {
	}
	store(settings: Settings) {
	}
	restore(settings: Settings) {
	}
	setImage(img: string, x: number = 0, y: number = 0) {
		this.view.css({
			backgroundImage : img ? img.toUrl() : 'none',
			backgroundPosition : '-' + x + 'px -' + y + 'px',
		});
		super.setImage(img, x, y);
	}
	setOffset(dx: number, dy: number) {
		this.dx = dx;
		this.dy = dy;
		this.setPosition(this.x, this.y);
	}
	setPosition(x: number, y: number) {
		this.view.css({
			left: x,
			bottom: y,
			marginLeft: this.dx,
			marginBottom: this.dy,
		});
		super.setPosition(x, y);
		this.setGridPosition(x, y);
	}
	setSize(width: number, height: number) {
		this.view.css({
			width: width,
			height: height
		});
		super.setSize(width, height);
	}
	setGridPosition(x: number, y: number) {
		this.i = Math.floor((x + 16) / 32);
		this.j = Math.ceil(this.level.getGridHeight() - 1 - y / 32);
		
		if (this.j > this.level.getGridHeight())
			this.die();
	}
	getGridPosition(x: number, y: number): GridPoint {
		return { i : this.i, j : this.j };
	}
	setVelocity(vx: number, vy: number) {
		this.vx = vx;
		this.vy = vy;
		
		if (vx > 0)
			this.direction = Direction.right;
		else if (vx < 0)
			this.direction = Direction.left;
	}
	getVelocity() {
		return { vx : this.vx, vy : this.vy };
	}
	hit(opponent: Figure) {
	}
	trigger(obj: Item) {
	}
	collides(is: number, ie: number, js: number, je: number, blocking: GroundBlocking) {
		if (is < 0 || ie >= this.level.obstacles.length)
			return true;
			
		if (js < 0 || je >= this.level.getGridHeight())
			return false;
			
		for (var i = is; i <= ie; i++) {
			for (var j = je; j >= js; j--) {
				var obj = this.level.obstacles[i][j];
				
				if (obj) {
					if (obj instanceof Item && (blocking === GroundBlocking.bottom || obj.blocking === GroundBlocking.none))
						this.trigger(<Item>obj);
					
					if ((obj.blocking & blocking) === blocking)
						return true;
				}
			}
		}
		
		return false;
	}
	move() {
		var vx = this.vx;
		var vy = this.vy - setup.gravity;
		
		var s = this.state;
		
		var x = this.x;
		var y = this.y;
		
		var dx = Math.sign(vx);
		var dy = Math.sign(vy);
		
		var is = this.i;
		var ie = is;
		
		var js = Math.ceil(this.level.getGridHeight() - s - (y + 31) / 32);
		var je = this.j;
		
		var d = 0, b = GroundBlocking.none;
		var onground = false;
		var t = Math.floor((x + 16 + vx) / 32);
		
		if (dx > 0) {
			d = t - ie;
			t = ie;
			b = GroundBlocking.left;
		} else if (dx < 0) {
			d = is - t;
			t = is;
			b = GroundBlocking.right;
		}
		
		x += vx;
		
		for (var i = 0; i < d; i++) {
			if (this.collides(t + dx, t + dx, js, je, b)) {
				vx = 0;
				x = t * 32 + 15 * dx;
				break;
			}
			
			t += dx;
			is += dx;
			ie += dx;
		}
		
		if (dy > 0) {
			t = Math.ceil(this.level.getGridHeight() - s - (y + 31 + vy) / 32);
			d = js - t;
			t = js;
			b = GroundBlocking.bottom;
		} else if (dy < 0) {
			t = Math.ceil(this.level.getGridHeight() - 1 - (y + vy) / 32);
			d = t - je;
			t = je;
			b = GroundBlocking.top;
		} else
			d = 0;
		
		y += vy;
		
		for (var i = 0; i < d; i++) {
			if (this.collides(is, ie, t - dy, t - dy, b)) {
				onground = dy < 0;
				vy = 0;
				y = this.level.height - (t + 1) * 32 - (dy > 0 ? (s - 1) * 32 : 0);
				break;
			}
			
			t -= dy;
		}
		
		this.onground = onground;
		this.setVelocity(vx, vy);
		this.setPosition(x, y);
	}
	death() {
		return false;
	}
	die() {
		this.dead = true;
	}
};

/*
 * -------------------------------------------
 * ITEMFIGURE CLASS
 * -------------------------------------------
 */
class ItemFigure extends Figure {
	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
	}
};

/*
 * -------------------------------------------
 * GROUND CLASS
 * -------------------------------------------
 */
class Ground extends Matter {
	constructor(x: number, y: number, blocking: GroundBlocking, level: Level) {
		super(x, y, blocking, level);
	}
};

/*
 * -------------------------------------------
 * GRASS CLASSES
 * -------------------------------------------
 */
class TopGrass extends Ground {
	constructor(x: number, y: number, level: Level) {
		var blocking = GroundBlocking.top;
		super(x, y, blocking, level);
		this.setImage(images.objects, 888, 404);
	}
};
class TopRightGrass extends Ground {
	constructor(x: number, y: number, level: Level) {
		var blocking = GroundBlocking.top + GroundBlocking.right;
		super(x, y, blocking, level);
		this.setImage(images.objects, 922, 404);
	}
};
class TopLeftGrass extends Ground {
	constructor(x: number, y: number, level: Level) {
		var blocking = GroundBlocking.left + GroundBlocking.top;
		super(x, y, blocking, level);
		this.setImage(images.objects, 854, 404);
	}
};
class RightGrass extends Ground {
	constructor(x: number, y: number, level: Level) {
		var blocking = GroundBlocking.right;
		super(x, y, blocking, level);
		this.setImage(images.objects, 922, 438);
	}
};
class LeftGrass extends Ground {
	constructor(x: number, y: number, level: Level) {
		var blocking = GroundBlocking.left;
		super(x, y, blocking, level);
		this.setImage(images.objects, 854, 438);
	}
};
class TopRightRoundedGrass extends Ground {
	constructor(x: number, y: number, level: Level) {
		var blocking = GroundBlocking.top;
		super(x, y, blocking, level);
		this.setImage(images.objects, 922, 506);
	}
};
class TopLeftRoundedGrass extends Ground {
	constructor(x: number, y: number, level: Level) {
		var blocking = GroundBlocking.top;
		super(x, y, blocking, level);
		this.setImage(images.objects, 854, 506);
	}
};

/*
 * -------------------------------------------
 * STONE CLASSES
 * -------------------------------------------
 */
class Stone extends Ground {
	constructor(x: number, y: number, level: Level) {
		var blocking = GroundBlocking.all;
		super(x, y, blocking, level);
		this.setImage(images.objects, 550, 160);
	}
};
class BrownBlock extends Ground {
	constructor(x: number, y: number, level: Level) {
		var blocking = GroundBlocking.all;
		super(x, y, blocking, level);
		this.setImage(images.objects, 514, 194);
	}
};

/*
 * -------------------------------------------
 * PIPE CLASSES
 * -------------------------------------------
 */
class RightTopPipe extends Ground {
	constructor(x: number, y: number, level: Level) {
		var blocking = GroundBlocking.all;
		super(x, y, blocking, level);
		this.setImage(images.objects, 36, 358);
	}
};
class LeftTopPipe extends Ground {
	constructor(x: number, y: number, level: Level) {
		var blocking = GroundBlocking.all;
		super(x, y, blocking, level);
		this.setImage(images.objects, 2, 358);
	}
};
class RightPipe extends Ground {
	constructor(x: number, y: number, level: Level) {
		var blocking = GroundBlocking.right + GroundBlocking.bottom;
		super(x, y, blocking, level);
		this.setImage(images.objects, 36, 390);
	}
};
class LeftPipe extends Ground {
	constructor(x: number, y: number, level: Level) {
		var blocking = GroundBlocking.left + GroundBlocking.bottom;
		super(x, y, blocking, level);
		this.setImage(images.objects, 2, 390);
	}
};

/*
 * -------------------------------------------
 * DECORATION CLASS
 * -------------------------------------------
 */
class Decoration extends Matter {
	constructor(x: number, y: number, level: Level) {
		super(x, y, GroundBlocking.none, level);
		level.decorations.push(this);
	}
	setImage(img: string, x: number = 0, y: number = 0) {
		this.view.css({
			backgroundImage : img ? img.toUrl() : 'none',
			backgroundPosition : '-' + x + 'px -' + y + 'px',
		});
		super.setImage(img, x, y);
	}
	setPosition(x: number, y: number) {
		this.view.css({
			left: x,
			bottom: y
		});
		super.setPosition(x, y);
	}
};

/*
 * -------------------------------------------
 * DECORATION GRASS CLASSES
 * -------------------------------------------
 */
class TopRightCornerGrass extends Decoration {
	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.setImage(images.objects, 612, 868);
	}
};
class TopLeftCornerGrass extends Decoration {
	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.setImage(images.objects, 648, 868);
	}
};

/*
 * -------------------------------------------
 * SOIL CLASSES
 * -------------------------------------------
 */
class Soil extends Decoration {
	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.setImage(images.objects, 888, 438);
	}
};
class RightSoil extends Decoration {
	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.setImage(images.objects, 922, 540);
	}
};
class LeftSoil extends Decoration {
	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.setImage(images.objects, 854,540);
	}
};

/*
 * -------------------------------------------
 * BUSH CLASSES
 * -------------------------------------------
 */
class RightBush extends Decoration {
	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.setImage(images.objects, 382, 928);
	}
};
class RightMiddleBush extends Decoration {
	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.setImage(images.objects, 314, 928);
	}
};
class MiddleBush extends Decoration {
	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.setImage(images.objects, 348, 928);
	}
};
class LeftMiddleBush extends Decoration {
	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.setImage(images.objects, 212, 928);
	}
};
class LeftBush extends Decoration {
	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.setImage(images.objects, 178, 928);
	}
};

/*
 * -------------------------------------------
 * GRASS-SOIL CLASSES
 * -------------------------------------------
 */
class TopRightGrassSoil extends Decoration {
	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.setImage(images.objects, 990, 506);
	}
};
class TopLeftGrassSoil extends Decoration {
	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.setImage(images.objects, 956, 506);
	}
};

/*
 * -------------------------------------------
 * PLANTED SOIL CLASSES
 * -------------------------------------------
 */
class RightPlantedSoil extends Decoration {
	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.setImage(images.objects, 782, 832);
	}
};
class MiddlePlantedSoil extends Decoration {
	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.setImage(images.objects, 748, 832);
	}
};
class LeftPlantedSoil extends Decoration {
	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.setImage(images.objects, 714, 832);
	}
};

/*
 * -------------------------------------------
 * PIPE DECORATION
 * -------------------------------------------
 */
class RightPipeGrass extends Decoration {
	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.setImage(images.objects, 36, 424);
	}
};
class LeftPipeGrass extends Decoration {
	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.setImage(images.objects, 2, 424);
	}
};
class RightPipeSoil extends Decoration {
	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.setImage(images.objects, 36, 458);
	}
};
class LeftPipeSoil extends Decoration {
	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.setImage(images.objects, 2, 458);
	}
};

/*
 * -------------------------------------------
 * ITEM CLASS
 * -------------------------------------------
 */
class Item extends Matter {
	isBouncing: boolean;
	bounceFrames: number;
	bounceStep: number;
	bounceDir: number;
	bounceCount: number;
	activated: boolean;
	isBlocking: boolean;

	constructor(x: number, y: number, isBlocking: boolean, level: Level) {
		this.isBouncing = false;
		this.bounceCount = 0;
		this.bounceFrames = Math.floor(50 / setup.interval);
		this.bounceStep = Math.ceil(10 / this.bounceFrames);
		this.bounceDir = 1;
		this.isBlocking = isBlocking;
		super(x, y, isBlocking ? GroundBlocking.all : GroundBlocking.none, level);
		this.activated = false;
		this.addToLevel(level);
	}
	addToLevel(level: Level) {
		level.items.push(this);
	}
	activate(from: Figure) {
		this.activated = true;
	}
	bounce() {
		this.isBouncing = true;
		
		for (var i = this.level.figures.length; i--; ) {
			var fig = this.level.figures[i];
			
			if (fig.y === this.y + 32 && fig.x >= this.x - 16 && fig.x <= this.x + 16) {
				if (fig instanceof ItemFigure)
					fig.setVelocity(fig.vx, setup.bounce);
				else
					fig.die();
			}
		}
	}
	playFrame() {
		if (this.isBouncing) {
			this.view.css({ 'bottom' : (this.bounceDir > 0 ? '+' : '-') + '=' + this.bounceStep + 'px' });
			this.bounceCount += this.bounceDir;
			
			if (this.bounceCount === this.bounceFrames)
				this.bounceDir = -1;
			else if (this.bounceCount === 0) {
				this.bounceDir = 1;
				this.isBouncing = false;
			}
		}
		
		super.playFrame();
	}
};

/*
 * -------------------------------------------
 * COIN CLASSES
 * -------------------------------------------
 */
class Coin extends Item {
	constructor(x: number, y: number, level: Level) {
		super(x, y, false, level);
		this.setImage(images.objects, 0, 0);
		this.setupFrames(10, 4, true);
	}
	activate(from: Mario) {
		if (!this.activated) {
			this.level.playSound('coin');
			from.addCoin();
			this.remove();
		}
		super.activate(from);
	}
	remove() {
		this.view.remove();
	}
};
class CoinBoxCoin extends Coin {
	count: number;
	step: number;

	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.setImage(images.objects, 96, 0);
		this.clearFrames();
		this.view.hide();
		this.count = 0;
		this.frames = Math.floor(150 / setup.interval);
		this.step = Math.ceil(30 / this.frames);
	}
	remove() { }
	addToGrid() { }
	addToLevel() { }
	activate(from: Mario) {
		super.activate(from);
		this.view.show().css({ 'bottom' : '+=8px' });
	}
	act() {
		this.view.css({ 'bottom' : '+=' + this.step + 'px' });
		this.count++;
		return (this.count === this.frames);
	}
};
class CoinBox extends Item {
	items: CoinBoxCoin[];
	actors: CoinBoxCoin[];

	constructor(x: number, y: number, level: Level, amount: number = 1) {
		super(x, y, true, level);
		this.setImage(images.objects, 346, 328);
		this.setAmount(amount);
	}
	setAmount(amount: number) {
		this.items = [];
		this.actors = [];
		
		for (var i = 0; i < amount; i++)
			this.items.push(new CoinBoxCoin(this.x, this.y, this.level));
	}
	activate(from: Mario) {
		if (!this.isBouncing) {
			if (this.items.length) {
				this.bounce();
				var coin = this.items.pop();
				coin.activate(from);
				this.actors.push(coin);
				
				if (!this.items.length)
					this.setImage(images.objects, 514, 194);
			}
		}
			
		super.activate(from);
	}
	playFrame() {
		for (var i = this.actors.length; i--; ) {
			if (this.actors[i].act()) {
				this.actors[i].view.remove();
				this.actors.splice(i, 1);
			}
		}
		
		super.playFrame();
	}
};
class MultipleCoinBox extends CoinBox {
	constructor(x: number, y: number, level: Level) {
		super(x, y, level, 8);
	}
};

/*
 * -------------------------------------------
 * STARBOX CLASS
 * -------------------------------------------
 */
class StarBox extends Item {
	star: Star;
	
	constructor(x: number, y: number, level: Level) {
		super(x, y, true, level);
		this.setImage(images.objects, 96, 33);
		this.star = new Star(x, y, level);
		this.setupFrames(8, 4, false);
	}
	activate(from: Figure) {
		if (!this.activated) {
			this.star.release();
			this.clearFrames();
			this.bounce();
			this.setImage(images.objects, 514, 194);
		}
		
		super.activate(from);
	}
};
class Star extends ItemFigure {
	active: boolean;
	taken: number;

	constructor(x: number, y: number, level: Level) {
		super(x, y + 32, level);
		this.active = false;
		this.setSize(32, 32);
		this.setImage(images.objects, 32, 69);
		this.view.hide();
	}
	release() {
		this.taken = 4;
		this.active = true;
		this.level.playSound('mushroom');
		this.view.show();
		this.setVelocity(setup.star_vx, setup.star_vy);
		this.setupFrames(10, 2, false);
	}
	collides(is: number, ie: number, js: number, je: number, blocking: GroundBlocking) {
		return false;
	}
	move() {
		if (this.active) {
			this.vy += this.vy <= -setup.star_vy ? setup.gravity : setup.gravity / 2;
			super.move();
		}
		
		if (this.taken)
			this.taken--;
	}
	hit(opponent: Figure) {
		if (!this.taken && this.active && opponent instanceof Mario) {
			(<Mario>opponent).invincible();
			this.die();
		}
	}
};

/*
 * -------------------------------------------
 * MUSHROOMBOX CLASS
 * -------------------------------------------
 */
class MushroomBox extends Item {
	max_mode: MushroomMode;
	mushroom: Mushroom;

	constructor(x: number, y: number, level: Level) {
		super(x, y, true, level);
		this.setImage(images.objects, 96, 33);
		this.max_mode = MushroomMode.plant;
		this.mushroom = new Mushroom(x, y, level);
		this.setupFrames(8, 4, false);
	}
	activate(from: Figure) {
		if (!this.activated) {
			if (from.state === SizeState.small || this.max_mode === MushroomMode.mushroom)
				this.mushroom.release(MushroomMode.mushroom);
			else
				this.mushroom.release(MushroomMode.plant);
			
			this.clearFrames();
			this.bounce();
			this.setImage(images.objects, 514, 194);
		}
			
		super.activate(from);
	}
};

class Mushroom extends ItemFigure {
	mode: MushroomMode;
	active: boolean;
	released: number;

	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.active = false;
		this.setSize(32, 32);
		this.setImage(images.objects, 582, 60);
		this.released = 0;
		this.view.css('z-index', 94).hide();
	}
	release(mode) {
		this.released = 4;
		this.level.playSound('mushroom');
		
		if (mode === MushroomMode.plant)
			this.setImage(images.objects, 548, 60);
			
		this.mode = mode;
		this.view.show();
	}
	move() {
		if(this.active) {
			super.move();
		
			if (this.mode === MushroomMode.mushroom && this.vx === 0)
				this.setVelocity(this.direction === Direction.right ? -setup.mushroom_v : setup.mushroom_v, this.vy);
		} else if (this.released) {
			this.released--;
			this.setPosition(this.x, this.y + 8);
			
			if (!this.released) {
				this.active = true;
				this.view.css('z-index', 99);
				
				if (this.mode === MushroomMode.mushroom)
					this.setVelocity(setup.mushroom_v, setup.gravity);
			}
		}
	}
	hit(opponent: Figure) {
		if (this.active && opponent instanceof Mario) {
			(<Mario>opponent).upgrade(this.mode);
			this.die();
		}
	}
};

/*
 * -------------------------------------------
 * HERO CLASS
 * -------------------------------------------
 */
class Hero extends Figure {
	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
	}
};

/*
 * -------------------------------------------
 * BULLET CLASS
 * -------------------------------------------
 */
class Bullet extends Figure {
	parent: Figure;
	life: number;
	speed: number;

	constructor(parent: Figure) {
		super(parent.x + 31, parent.y + 14, parent.level);
		this.parent = parent;
		this.setImage(images.sprites, 191, 366);
		this.setSize(16, 16);
		this.direction = parent.direction;
		this.vy = 0;
		this.life = Math.ceil(2000 / setup.interval);
		this.speed = setup.bullet_v;
		this.vx = this.direction === Direction.right ? this.speed : -this.speed;
	}
	setVelocity(vx: number, vy: number) {
		super.setVelocity(vx, vy);
	
		if (this.vx === 0) {
			var s = this.speed * Math.sign(this.speed);
			this.vx = this.direction === Direction.right ? -s : s;
		}
		
		if (this.onground)
			this.vy = setup.bounce;
	}
	move() {
		if (--this.life)
			super.move();
		else
			this.die();
	}
	hit(opponent: Figure) {
		if (opponent !== this.parent) {
			opponent.die();
			this.die();
		}
	}
};

/*
 * -------------------------------------------
 * MARIO CLASS
 * -------------------------------------------
 */
class Mario extends Hero implements DeathAnimation {
	deadly: number;
	cooldown: number;
	blinking: number;
	fast: boolean;
	crouching: boolean;
	deathBeginWait: number;
	deathEndWait: number;
	deathDir: number;
	deathCount: number;
	deathFrames: number;
	deathStepUp: number;
	deathStepDown: number;
	invulnerable: number;
	coins: number;
	lifes: number;
	marioState: MarioState;
	standSprites: Point[][][];
	crouchSprites: Point[][];

	constructor(x: number, y: number, level: Level) {
		this.standSprites = [
			[[{ x : 0, y : 81},{ x: 481, y : 83}],[{ x : 81, y : 0},{ x: 561, y : 83}]],
			[[{ x : 0, y : 162},{ x: 481, y : 247}],[{ x : 81, y : 243},{ x: 561, y : 247}]]
		];
		this.crouchSprites = [
			[{ x : 241, y : 0},{ x: 161, y : 0}],
			[{ x : 241, y : 162},{ x: 241, y : 243}]
		];
		this.deadly = 0;
		this.invulnerable = 0;
		this.width = 80;
		super(x, y, level);
		this.blinking = 0;
		this.setOffset(-24, 0);
		this.setSize(80, 80);
		this.cooldown = 0;
		this.setMarioState(MarioState.normal);
		this.setLifes(setup.start_lives);
		this.setCoins(0);
		this.deathCount = 0;
		this.deathBeginWait = Math.floor(700 / setup.interval);
		this.deathEndWait = 0;
		this.deathFrames = Math.floor(600 / setup.interval);
		this.deathStepUp = Math.ceil(200 / this.deathFrames);
		this.deathDir = 1;
		this.direction = Direction.right;
		this.setImage(images.sprites, 81, 0);
		this.crouching = false;
		this.fast = false;
	}
	setMarioState(state: MarioState) {
		this.marioState = state;
	}
	store(settings: Settings) {
		settings.lifes = this.lifes;
		settings.coins = this.coins;
		settings.state = this.state;
		settings.marioState = this.marioState;
	}
	restore(settings: Settings) {
		this.setLifes(settings.lifes || 0);
		this.setCoins(settings.coins || 0);
		this.setState(settings.state || SizeState.small);
		this.setMarioState(settings.marioState || MarioState.normal);
	}
	setState(state: SizeState) {
		if (state !== this.state) {
			this.setMarioState(MarioState.normal);
			super.setState(state);
		}
	}
	setPosition(x: number, y: number) {
		super.setPosition(x, y);
		var r = this.level.width - 640;
		var w = (this.x <= 210) ? 0 : ((this.x >= this.level.width - 230) ? r : r / (this.level.width - 440) * (this.x - 210));		
		this.level.setParallax(w);

		if (this.onground && this.x >= this.level.width - 128)
			this.victory();
	}
	trigger(obj: Item) {
		obj.activate(this);
	}
	input(keys: Keys) {
		this.fast = keys.accelerate;
		this.crouching = keys.down;
		
		if (!this.crouching) {
			if (this.onground && keys.up)
				this.jump();
				
			if (keys.accelerate && this.marioState === MarioState.fire)
				this.shoot();
				
			if (keys.right || keys.left)
				this.walk(keys.left, keys.accelerate);
			else
				this.vx = 0;
		}
	}
	victory() {
		this.level.playMusic('success');
		this.clearFrames();
		this.view.show();
		this.setImage(images.sprites, this.state === SizeState.small ? 241 : 161, 81);
		this.level.next();
	}
	shoot() {
		if (!this.cooldown) {
			this.cooldown = setup.cooldown;
			this.level.playSound('shoot');
			new Bullet(this);
		}
	}
	setVelocity(vx: number, vy: number) {
		if (this.crouching) {
			vx = 0;
			this.crouch();
		} else {
			if (this.onground && vx > 0)
				this.walkRight();
			else if (this.onground && vx < 0)
				this.walkLeft();
			else
				this.stand();
		}
	
		super.setVelocity(vx, vy);
	}
	blink(times: number) {
		this.blinking = Math.max(2 * times * setup.blinkfactor, this.blinking);
	}
	invincible() {
		this.level.playMusic('invincibility');
		this.deadly = Math.floor(setup.invincible / setup.interval);
		this.invulnerable = this.deadly;
		this.blink(Math.ceil(this.deadly / (2 * setup.blinkfactor)));
	}
	upgrade(mode: MushroomMode) {	
		if (mode === MushroomMode.mushroom)
			this.grow();
		else if (mode === MushroomMode.plant)
			this.shooter();
	}
	grow() {
		if (this.state === SizeState.small) {
			this.level.playSound('grow');
			this.setState(SizeState.big);
			this.blink(3);
		}
	}
	shooter() {
		if (this.state === SizeState.small)
			this.grow();
		else
			this.level.playSound('grow');
			
		this.setMarioState(MarioState.fire);
	}
	walk(reverse: boolean, fast: boolean) {
		this.vx = setup.walking_v * (fast ? 2 : 1) * (reverse ? - 1 : 1);
	}
	walkRight() {
		if (this.state === SizeState.small) {
			if (!this.setupFrames(8, 2, true, 'WalkRightSmall'))
				this.setImage(images.sprites, 0, 0);
		} else {
			if (!this.setupFrames(9, 2, true, 'WalkRightBig'))
				this.setImage(images.sprites, 0, 243);
		}
	}
	walkLeft() {
		if (this.state === SizeState.small) {
			if (!this.setupFrames(8, 2, false, 'WalkLeftSmall'))
				this.setImage(images.sprites, 80, 81);
		} else {
			if (!this.setupFrames(9, 2, false, 'WalkLeftBig'))
				this.setImage(images.sprites, 81, 162);
		}
	}
	stand() {
		var coords = this.standSprites[this.state - 1][this.direction === Direction.left ? 0 : 1][this.onground ? 0 : 1];
		this.setImage(images.sprites, coords.x, coords.y);
		this.clearFrames();
	}
	crouch() {
		var coords = this.crouchSprites[this.state - 1][this.direction === Direction.left ? 0 : 1];
		this.setImage(images.sprites, coords.x, coords.y);
		this.clearFrames();
	}
	jump() {
		this.level.playSound('jump');
		this.vy = setup.jumping_v;
	}
	move() {
		this.input(this.level.controls);		
		super.move();
	}
	addCoin() {
		this.setCoins(this.coins + 1);
	}
	playFrame() {		
		if (this.blinking) {
			if (this.blinking % setup.blinkfactor === 0)
				this.view.toggle();
				
			this.blinking--;
		}
		
		if (this.cooldown)
			this.cooldown--;
		
		if (this.deadly)
			this.deadly--;
		
		if (this.invulnerable)
			this.invulnerable--;
		
		super.playFrame();
	}
	setCoins(coins: number) {
		this.coins = coins;
		
		if(this.coins >= setup.max_coins) {
			this.addLife()
			this.coins -= setup.max_coins;
		}
				
		this.level.world.parent().children('#coinNumber').text(this.coins);
	}
	addLife() {
		this.level.playSound('liveupgrade');
		this.setLifes(this.lifes + 1);
	}
	setLifes(lifes) {
		this.lifes = lifes;
		this.level.world.parent().children('#liveNumber').text(this.lifes);
	}
	death() {
		if (this.deathBeginWait) {
			this.deathBeginWait--;
			return true;
		}
		
		if (this.deathEndWait)
			return !!(--this.deathEndWait);
		
		this.view.css({ 'bottom' : (this.deathDir > 0 ? '+' : '-') + '=' + (this.deathDir > 0 ? this.deathStepUp : this.deathStepDown) + 'px' });
		this.deathCount += this.deathDir;
		
		if (this.deathCount === this.deathFrames)
			this.deathDir = -1;
		else if (this.deathCount === 0)
			this.deathEndWait = Math.floor(1800 / setup.interval);
			
		return true;
	}
	die() {
		this.setMarioState(MarioState.normal);
		this.deathStepDown = Math.ceil(240 / this.deathFrames);
		this.setupFrames(9, 2, false);
		this.setImage(images.sprites, 81, 324);
		this.level.playMusic('die');
		super.die();
	}
	hurt(enemy: Figure) {
		if (this.deadly)
			enemy.die();
		else if (this.invulnerable)
			return;
		else if (this.state === SizeState.small) {
			this.die();
		} else {
			this.invulnerable = Math.floor(setup.invulnerable / setup.interval);
			this.blink(Math.ceil(this.invulnerable / (2 * setup.blinkfactor)));
			this.setState(SizeState.small);
			this.level.playSound('hurt');			
		}
	}
};

/*
 * -------------------------------------------
 * ENEMY CLASS
 * -------------------------------------------
 */
class Enemy extends Figure implements DeathAnimation {
	speed: number;
	invisible: boolean;
	deathMode: DeathMode;
	deathStep: number;
	deathCount: number;
	deathDir: number;
	deathFrames: number;
	deathStepUp: number;
	deathStepDown: number;

	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.speed = 0;
		this.deathMode = DeathMode.normal;
		this.deathCount = 0;
	}
	hide() {
		this.invisible = true;
		this.view.hide();
	}
	show() {	
		this.invisible = false;
		this.view.show();
	}
	move() {
		if (!this.invisible) {
			super.move();
		
			if (this.vx === 0) {
				var s = this.speed * Math.sign(this.speed);
				this.setVelocity(this.direction === Direction.right ? -s : s, this.vy);
			}
		}
	}
	collides(is: number, ie: number, js: number, je: number, blocking: GroundBlocking) {
		if (this.j + 1 < this.level.getGridHeight()) {
			for (var i = is; i <= ie; i++) {
				if (i < 0 || i >= this.level.getGridWidth())
					return true;
					
				var obj = this.level.obstacles[i][this.j + 1];
				
				if (!obj || (obj.blocking & GroundBlocking.top) !== GroundBlocking.top)
					return true;
			}
		}
		
		return super.collides(is, ie, js, je, blocking);
	}
	setSpeed(v: number) {
		this.speed = v;
		this.setVelocity(-v, 0);
	}
	hurt(from: Figure) {
		if (from instanceof TurtleShell)
			this.deathMode = DeathMode.shell;

		this.die();
	}
	hit(opponent: Figure) {
		if (this.invisible)
			return;
			
		if (opponent instanceof Mario) {
			if (opponent.vy < 0 && opponent.y - opponent.vy >= this.y + this.state * 32) {
				opponent.setVelocity(opponent.vx, setup.bounce);
				this.hurt(opponent);
			} else {
				opponent.hurt(this);
			}
		}
	}
};

/*
 * -------------------------------------------
 * GUMPA CLASS
 * -------------------------------------------
 */
class Gumpa extends Enemy {
	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.setSize(34, 32);
		this.setSpeed(setup.ballmonster_v);
	}
	setVelocity(vx: number, vy: number) {
		super.setVelocity(vx, vy);
		
		if (this.direction === Direction.left) {
			if (!this.setupFrames(6, 2, false, 'LeftWalk'))
				this.setImage(images.enemies, 34, 188);
		} else {
			if (!this.setupFrames(6, 2, true, 'RightWalk'))
				this.setImage(images.enemies, 0, 228);
		}
	}
	death() {
		if (this.deathMode === DeathMode.normal)
			return !!(--this.deathCount);
		
		this.view.css({ 'bottom' : (this.deathDir > 0 ? '+' : '-') + '=' + this.deathStep + 'px' });
		this.deathCount += this.deathDir;
		
		if (this.deathCount === this.deathFrames)
			this.deathDir = -1;
		else if (this.deathCount === 0)
			return false;
			
		return true;
	}
	die() {
		this.clearFrames();
		
		if (this.deathMode === DeathMode.normal) {
			this.level.playSound('enemy_die');
			this.setImage(images.enemies, 102, 228);
			this.deathCount = Math.ceil(600 / setup.interval);
		} else if (this.deathMode === DeathMode.shell) {
			this.level.playSound('shell');
			this.setImage(images.enemies, 68, this.direction === Direction.right ? 228 : 188);
			this.deathFrames = Math.floor(250 / setup.interval);
			this.deathDir = 1;
			this.deathStep = Math.ceil(150 / this.deathFrames);
		}
		
		super.die();
	}
};

/*
 * -------------------------------------------
 * TURTLESHELL CLASS
 * -------------------------------------------
 */
class TurtleShell extends Enemy {
	idle: number;
	
	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.setSize(34, 32);
		this.speed = 0;
		this.setImage(images.enemies, 0, 494);
	}
	activate(x: number, y: number) {
		this.setupFrames(6, 4, false)
		this.setPosition(x, y);
		this.show();
	}
	takeBack(where: Turtle) {
		if (where.setShell(this))
			this.clearFrames();
	}
	hit(opponent: Figure) {
		if (this.invisible)
			return;
			
		if (this.vx) {
			if (this.idle)
				this.idle--;
			else
				opponent.hurt(this);
		} else {
			if (opponent instanceof Mario) {
				this.setSpeed(opponent.direction === Direction.right ? -setup.shell_v : setup.shell_v);
				opponent.setVelocity(opponent.vx, setup.bounce);
				this.idle = 2;
			} else if (opponent instanceof GreenTurtle && opponent.state === SizeState.small)
				this.takeBack(<GreenTurtle>opponent);
		}
	}
	collides(is: number, ie: number, js: number, je: number, blocking: GroundBlocking) {		
		if (is < 0 || ie >= this.level.obstacles.length)
			return true;
			
		if (js < 0 || je >= this.level.getGridHeight())
			return false;
			
		for (var i = is; i <= ie; i++) {
			for (var j = je; j >= js; j--) {
				var obj = this.level.obstacles[i][j];
				
				if (obj && ((obj.blocking & blocking) === blocking))
					return true;
			}
		}
		
		return false;
	}
};

class Turtle extends Enemy {
	shell: TurtleShell;

	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
	}
	setShell(shell: TurtleShell) {
		return false;
	}
};

/*
 * -------------------------------------------
 * GREENTURTLE CLASS
 * -------------------------------------------
 */
class GreenTurtle extends Turtle {
	wait: number;
	walkSprites: Point[][];

	constructor(x: number, y: number, level: Level) {
		this.walkSprites = [
			[{ x : 34, y : 382 },{ x : 0, y : 437 }],
			[{ x : 34, y : 266 },{ x : 0, y : 325 }]
		];
		super(x, y, level);
		this.wait = 0;
		this.deathMode = DeathMode.normal;
		this.deathFrames = Math.floor(250 / setup.interval);
		this.deathStepUp = Math.ceil(150 / this.deathFrames);
		this.deathStepDown = Math.ceil(182 / this.deathFrames);
		this.deathDir = 1;
		this.deathCount = 0;
		this.setSize(34, 54);
		this.setShell(new TurtleShell(x, y, level));
	}
	setShell(shell: TurtleShell) {
		if (this.shell || this.wait)
			return false;
			
		this.shell = shell;
		shell.hide();
		this.setState(SizeState.big);
		return true;
	}
	setState(state: SizeState) {
		super.setState(state);
		
		if (state === SizeState.big)
			this.setSpeed(setup.big_turtle_v);
		else
			this.setSpeed(setup.small_turtle_v);
	}
	setVelocity(vx: number, vy: number) {
		super.setVelocity(vx, vy);
		var rewind = this.direction === Direction.right;
		var coords = this.walkSprites[this.state - 1][rewind ? 1 : 0];
		var label = Math.sign(vx) + '-' + this.state;
		
		if (!this.setupFrames(6, 2, rewind, label))
			this.setImage(images.enemies, coords.x, coords.y);
	}
	die() {
		super.die();
		this.clearFrames();
		
		if (this.deathMode === DeathMode.normal) {
			this.deathFrames = Math.floor(600 / setup.interval);
			this.setImage(images.enemies, 102, 437);
		} else if (this.deathMode === DeathMode.shell) {
			this.level.playSound('shell');
			this.setImage(images.enemies, 68, (this.state === SizeState.small ? (this.direction === Direction.right ? 437 : 382) : 325));
		}
	}
	death() {
		if (this.deathMode === DeathMode.normal)
			return !!(--this.deathFrames);
			
		this.view.css({ 'bottom' : (this.deathDir > 0 ? '+' : '-') + '=' + (this.deathDir > 0 ? this.deathStepUp : this.deathStepDown) + 'px' });
		this.deathCount += this.deathDir;
		
		if (this.deathCount === this.deathFrames)
			this.deathDir = -1;
		else if (this.deathCount === 0)
			return false;
			
		return true;
	}
	move() {
		if (this.wait)
			this.wait--;
			
		super.move();
	}
	hurt(opponent: Figure) {	
		this.level.playSound('enemy_die');
		
		if (this.state === SizeState.small)
			return this.die();
		
		this.wait = setup.shell_wait
		this.setState(SizeState.small);
		this.shell.activate(this.x, this.y);
		this.shell = undefined;
	}
};

/*
 * -------------------------------------------
 * SPIKEDTURTLE CLASS
 * -------------------------------------------
 */
class SpikedTurtle extends Turtle {
	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.setSize(34, 32);
		this.setSpeed(setup.spiked_turtle_v);
		this.deathFrames = Math.floor(250 / setup.interval);
		this.deathStepUp = Math.ceil(150 / this.deathFrames);
		this.deathStepDown = Math.ceil(182 / this.deathFrames);
		this.deathDir = 1;
		this.deathCount = 0;
	}
	setVelocity(vx: number, vy: number) {
		super.setVelocity(vx, vy);
		
		if (this.direction === Direction.left) {
			if (!this.setupFrames(4, 2, true, 'LeftWalk'))
				this.setImage(images.enemies, 0, 106);
		} else {
			if (!this.setupFrames(6, 2, false, 'RightWalk'))
				this.setImage(images.enemies, 34, 147);
		}
	}
	death() {
		this.view.css({ 'bottom' : (this.deathDir > 0 ? '+' : '-') + '=' + (this.deathDir > 0 ? this.deathStepUp : this.deathStepDown) + 'px' });
		this.deathCount += this.deathDir;
		
		if(this.deathCount === this.deathFrames)
			this.deathDir = -1;
		else if(this.deathCount === 0)
			return false;
			
		return true;
	}
	die() {
		this.level.playSound('shell');
		this.clearFrames();
		super.die();
		this.setImage(images.enemies, 68, this.direction === Direction.left ? 106 : 147);
	}
	hit(opponent: Figure) {
		if (this.invisible)
			return;
			
		if (opponent instanceof Mario)
			opponent.hurt(this);
	}
};

/*
 * -------------------------------------------
 * PLANT CLASS
 * -------------------------------------------
 */
class Plant extends Enemy {
	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.setSize(34, 42);
		this.setupFrames(5, 2, true);
		this.setImage(images.enemies, 0, 3);
	}
	setVelocity(vx: number, vy: number) {
		super.setVelocity(0, 0);
	}
	die() {
		this.level.playSound('shell');
		this.clearFrames();
		super.die();
	}
	hit(opponent: Figure) {
		if (this.invisible)
			return;
			
		if (opponent instanceof Mario)
			opponent.hurt(this);
	}
};

/*
 * -------------------------------------------
 * STATICPLANT CLASS
 * -------------------------------------------
 */
class StaticPlant extends Plant {
	constructor(x: number, y: number, level: Level) {
		super(x, y, level);
		this.deathFrames = Math.floor(250 / setup.interval);
		this.deathStepUp = Math.ceil(100 / this.deathFrames);
		this.deathStepDown = Math.ceil(132 / this.deathFrames);
		this.deathDir = 1;
		this.deathCount = 0;
	}
	die() {
		super.die();
		this.setImage(images.enemies, 68, 3);
	}
	death() {
		this.view.css({ 'bottom' : (this.deathDir > 0 ? '+' : '-') + '=' + (this.deathDir > 0 ? this.deathStepUp : this.deathStepDown) + 'px' });
		this.deathCount += this.deathDir;
		
		if (this.deathCount === this.deathFrames)
			this.deathDir = -1;
		else if (this.deathCount === 0)
			return false;
			
		return true;
	}
};

/*
 * -------------------------------------------
 * PIPEPLANT CLASS
 * -------------------------------------------
 */
class PipePlant extends Plant {
	deathFramesExtended: number;
	deathFramesExtendedActive: boolean;
	minimum: number;
	bottom: number;
	top: number;

	constructor(x: number, y: number, level: Level) {
		this.bottom = y - 48;
		this.top = y - 6;
		super(x + 16, y - 6, level);
		this.setDirection(Direction.down);
		this.setImage(images.enemies, 0, 56);
		this.deathFrames = Math.floor(250 / setup.interval);
		this.deathFramesExtended = 6;
		this.deathFramesExtendedActive = false;
		this.deathStep = Math.ceil(100 / this.deathFrames);
		this.deathDir = 1;
		this.deathCount = 0;
		this.view.css('z-index', 95);
	}
	setDirection(dir: Direction) {
		this.direction = dir;
	}
	setPosition(x: number, y: number) {
		if (y === this.bottom || y === this.top) {
			this.minimum = setup.pipeplant_count;
			this.setDirection(this.direction === Direction.up ? Direction.down : Direction.up);
		}
		
		super.setPosition(x, y);
	}
	blocked() {
		if (this.y === this.bottom) {
			var state = false;
			this.y += 48;
			
			for (var i = this.level.figures.length; i--; ) {
				if (this.level.figures[i] != this && this.q2q(this.level.figures[i])) {
					state = true;
					break;
				}
			}
			
			this.y -= 48;
			return state;
		}
		
		return false;
	}
	move() {
		if (this.minimum === 0) {
			if(!this.blocked())
				this.setPosition(this.x, this.y - (this.direction - 3) * setup.pipeplant_v);
		} else
			this.minimum--;
	}
	die() {		
		super.die();
		this.setImage(images.enemies, 68, 56);
	}
	death() {
		if (this.deathFramesExtendedActive) {
			this.setPosition(this.x, this.y - 8);
			return !!(--this.deathFramesExtended);
		}
		
		this.view.css({ 'bottom' : (this.deathDir > 0 ? '+' : '-') + '=' + this.deathStep + 'px' });
		this.deathCount += this.deathDir;
		
		if (this.deathCount === this.deathFrames)
			this.deathDir = -1;
		else if (this.deathCount === 0)
			this.deathFramesExtendedActive = true;
			
		return true;
	}
};

var assets = {
	pipeplant: PipePlant,
	staticplant: StaticPlant,
	greenturtle: GreenTurtle,
	spikedturtle: SpikedTurtle,
	shell: TurtleShell,
	ballmonster: Gumpa,
	mario: Mario,
	pipe_right_grass : RightPipeGrass,
	pipe_left_grass : LeftPipeGrass,
	pipe_right_soil : RightPipeSoil,
	pipe_left_soil : LeftPipeSoil,
	planted_soil_left : LeftPlantedSoil,
	planted_soil_middle : MiddlePlantedSoil,
	planted_soil_right : RightPlantedSoil,
	grass_top_right_rounded_soil : TopRightGrassSoil,
	grass_top_left_rounded_soil : TopLeftGrassSoil,
	bush_right : RightBush,
	bush_middle_right : RightMiddleBush,
	bush_middle : MiddleBush,
	bush_middle_left : LeftMiddleBush,
	bush_left : LeftBush,
	soil : Soil,
	soil_right : RightSoil,
	soil_left : LeftSoil,
	grass_top : TopGrass,
	grass_top_right : TopRightGrass,
	grass_top_left : TopLeftGrass,
	grass_right : RightGrass,
	grass_left : LeftGrass,
	grass_top_right_rounded : TopRightRoundedGrass,
	grass_top_left_rounded : TopLeftRoundedGrass,
	stone : Stone,
	brown_block : BrownBlock,
	pipe_top_right : RightTopPipe,
	pipe_top_left : LeftTopPipe,
	pipe_right : RightPipe,
	pipe_left : LeftPipe,
	grass_top_right_corner : TopRightCornerGrass,
	grass_top_left_corner : TopLeftCornerGrass,
	coin : Coin,
	coinbox : CoinBox,
	multiple_coinbox : MultipleCoinBox,
	starbox : StarBox,
	mushroombox : MushroomBox,
};

/*
 * -------------------------------------------
 * DOCUMENT READY STARTUP METHOD
 * -------------------------------------------
 */
export function run(levelData: LevelFormat, controls: Keys, sounds?: SoundManager) {
	var level = new Level('world', controls);
	level.load(levelData);

	if (sounds)
		level.setSounds(sounds);

	level.start();
};