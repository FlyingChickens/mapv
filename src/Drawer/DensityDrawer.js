/**
 * @file draw grad on the map
 * @author Mofei Zhu <zhuwenlong@baidu.com>
 */

/* globals Drawer mercatorProjection BMap util */

var min;
var max;

function DensityDrawer() {
    this.Scale;
    this.masker = {};
    this.mapv = null;
    this.ctx = null;
    Drawer.apply(this, arguments);
}

util.inherits(DensityDrawer, Drawer);

DensityDrawer.prototype.scale = function (scale) {
    var self = this;
    scale.change(function (min, max) {
        self.masker = {
            min: min,
            max: max
        };

        self.ctx.clearRect(0, 0, self.ctx.canvas.width, self.ctx.canvas.height);
        self.drawMap();
    });
    this.Scale = scale;
};

DensityDrawer.prototype.drawMap = function (mapv, ctx) {

    var self = this;
    mapv = this.mapv = this.mapv || mapv;
    ctx = this.ctx = this.ctx || ctx;

    // TODO: use workder
    // var data = mapv.geoData.getData();
    var data = this._layer.getData();

    var map = mapv.getMap();
    var zoom = map.getZoom();
    var zoomUnit = this.zoomUnit = Math.pow(2, 18 - zoom);

    var param = formatParam.call(this);
    var gridWidth = param.gridWidth;


    var mcCenter = mercatorProjection.lngLatToPoint(map.getCenter());
    var nwMcX = mcCenter.x - (map.getSize().width / 2) * zoomUnit;
    var nwMc = new BMap.Pixel(nwMcX, mcCenter.y + (map.getSize().height / 2) * zoomUnit);
    // 左上角墨卡托坐标

    window.console.time('computerMapData');
    var obj = {
        data: data,
        nwMc: nwMc,
        gridWidth: gridWidth,
        zoomUnit: zoomUnit,
        ctx: ctx
    };

    var gridsObj = {};
    if (this.drawOptions.gridType === 'honeycomb') {
        gridsObj = honeycombGrid(obj);
    } else {
        gridsObj = recGrids(obj);
    }

    var grids = gridsObj.grids;
    var max = gridsObj.max;
    var min = gridsObj.min;
    // console.log(gridsObj);
    window.console.timeEnd('computerMapData');

    window.console.time('drawMap');
    var obj = {
        gridWidth: gridWidth,
        zoomUnit: zoomUnit,
        max: max,
        min: min,
        ctx: ctx,
        grids: grids,
        fillColors: param.colors,
        sup: self
    };

    var gridsObj = {};
    if (this.drawOptions.gridType === 'honeycomb') {
        drawHoneycomb(obj);
    } else {
        drawRec(obj);
    }
    window.console.timeEnd('drawMap');

    this.Scale && this.Scale.set({
        max: max,
        min: min,
        colors: 'default'
    });
};

function recGrids(obj) {
    var data = obj.data;
    var nwMc = obj.nwMc;
    var gridWidth = obj.gridWidth;
    var zoomUnit = obj.zoomUnit;
    var max;
    var min;

    var grids = {};

    var gridStep = gridWidth / zoomUnit;

    var startXMc = parseInt(nwMc.x / gridWidth, 10) * gridWidth;

    var startX = (startXMc - nwMc.x) / zoomUnit;

    var stockXA = [];
    var stickXAIndex = 0;
    while ((startX + stickXAIndex * gridStep) < map.getSize().width) {
        var value = startX + stickXAIndex * gridStep;
        stockXA.push(value.toFixed(2));
        stickXAIndex++;
    }

    var startYMc = parseInt(nwMc.y / gridWidth, 10) * gridWidth + gridWidth;
    var startY = (nwMc.y - startYMc) / zoomUnit;
    var stockYA = [];
    var stickYAIndex = 0;
    while ((startY + stickYAIndex * gridStep) < map.getSize().height) {
        value = startY + stickYAIndex * gridStep;
        stockYA.push(value.toFixed(2));
        stickYAIndex++;
    }

    for (var i = 0; i < stockXA.length; i++) {
        for (var j = 0; j < stockYA.length; j++) {
            var name = stockXA[i] + '_' + stockYA[j];
            grids[name] = 0;
        }
    }

    for (var i = 0; i < data.length; i++) {
        var x = data[i].px;
        var y = data[i].py;
        var val = parseInt(data[i].count, 10);
        var isSmallX = x < stockXA[0];
        var isSmallY = y < stockYA[0];
        var isBigX = x > (Number(stockXA[stockXA.length - 1]) + Number(gridStep));
        var isBigY = y > (Number(stockYA[stockYA.length - 1]) + Number(gridStep));
        if (isSmallX || isSmallY || isBigX || isBigY) {
            continue;
        }
        for (var j = 0; j < stockXA.length; j++) {
            var dataX = Number(stockXA[j]);
            if ((x >= dataX) && (x < dataX + gridStep)) {
                for (var k = 0; k < stockYA.length; k++) {
                    var dataY = Number(stockYA[k]);
                    if ((y >= dataY) && (y < dataY + gridStep)) {
                        grids[stockXA[j] + '_' + stockYA[k]] += val;
                        val = grids[stockXA[j] + '_' + stockYA[k]];
                    }
                }
            }
        }
        min = min || val;
        max = max || val;
        min = min > val ? val : min;
        max = max < val ? val : max;
    }


    return {
        grids: grids,
        max: max,
        min: min
    };
}

function drawRec(obj) {
    var gridWidth = obj.gridWidth;
    var zoomUnit = obj.zoomUnit;
    var max = obj.max;
    var min = obj.min;
    var ctx = obj.ctx;
    var grids = obj.grids;
    var fillColors = obj.fillColors;
    var self = obj.sup;

    var gridStep = gridWidth / zoomUnit;
    var step = (max - min + 1) / 10;

    for (var i in grids) {
        var sp = i.split('_');
        var x = sp[0];
        var y = sp[1];
        var v = (grids[i] - min) / step;
        var color = fillColors[v | 0];

        var isTooSmall = self.masker.min && (grids[i] < self.masker.min);
        var isTooBig = self.masker.max && (grids[i] > self.masker.max);
        if (grids[i] === 0 || isTooSmall || isTooBig) {
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
        } else {
            ctx.fillStyle = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',0.4)';
        }
        ctx.fillRect(x, y, gridStep - 1, gridStep - 1);


        if (self.drawOptions.showNum) {

            ctx.save();
            // ctx.fillStyle = 'black';
            ctx.textBaseline = 'top';
            if (grids[i] !== 0 && !isTooSmall && !isTooBig) {
                ctx.fillStyle = 'rgba(0,0,0,0.8)';
                ctx.fillText(grids[i], x, y);
            }
            ctx.restore();
        }
    }
}

function honeycombGrid(obj) {
    var data = obj.data;
    var nwMc = obj.nwMc;
    var gridWidth = obj.gridWidth;
    var zoomUnit = obj.zoomUnit;
    var ctx = obj.ctx;
    var max;
    var min;

    var grids = {};

    var gridStep = gridWidth / zoomUnit;

    var depthX = gridStep;
    var depthY = gridStep * 3 / 4;

    var gridWidthY = 2 * gridWidth * 3 / 4;
    var startYMc = parseInt(nwMc.y / gridWidthY + 1, 10) * gridWidthY;
    var startY = (nwMc.y - startYMc) / zoomUnit;
    startY = parseInt(startY, 10);

    // var yIsOdd = !!(startYMc / gridWidthY % 2);

    var gridWidthX = depthX * gridWidth;
    var startXMc = parseInt(nwMc.x / gridWidthX, 10) * gridWidthX;
    var startX = (startXMc - nwMc.x) / zoomUnit;
    startX = parseInt(startX, 10);

    var endX = parseInt(ctx.canvas.width + gridWidthX / zoomUnit, 10);
    var endY = parseInt(ctx.canvas.height + gridWidthY / zoomUnit, 10);

    var pointX = startX;
    var pointY = startY;

    var odd = false;
    while (pointY < endY) {
        while (pointX < endX) {
            var x = odd ? pointX - depthX / 2 : pointX;
            x = parseInt(x, 10);
            grids[x + '|' + pointY] = grids[x + '|' + pointY] || {
                x: x,
                y: pointY,
                len: 0
            };

            pointX += depthX;
        }
        odd = !odd;
        pointX = startX;
        pointY += depthY;
    }

    for (var i in data) {
        var count = data[i].count;
        var pX = data[i].px;
        var pY = data[i].py;

        var fixYIndex = Math.round((pY - startY) / depthY);
        var fixY = fixYIndex * depthY + startY;
        var fixXIndex = Math.round((pX - startX) / depthX);
        var fixX = fixXIndex * depthX + startX;

        if (fixYIndex % 2) {
            fixX = fixX - depthX / 2;
        }
        if (fixX < startX || fixX > endX || fixY < startY || fixY > endY) {
            continue;
        }

        if (grids[fixX + '|' + fixY]) {
            grids[fixX + '|' + fixY].len += count;
            var num = grids[fixX + '|' + fixY].len;
            max = max || num;
            min = min || num;
            max = Math.max(max, num);
            min = Math.min(min, num);
        }
    }

    return {
        grids: grids,
        max: max,
        min: min
    };

}

function drawHoneycomb(obj) {
    // return false;
    var ctx = obj.ctx;
    var grids = obj.grids;
    var gridsW = obj.gridWidth / obj.zoomUnit;

    var color = obj.fillColors;
    var step = (obj.max - obj.min - 1) / color.length;

    // console.log()
    for (var i in grids) {
        var x = grids[i].x;
        var y = grids[i].y;
        var count = grids[i].len;
        var level = count / step | 0;
        level = level >= color.length ? color.length - 1 : level;
        level = level < 0 ? 0 : level;
        var useColor = 'rgba(' + color[level].join(',') + ',0.6)';

        var isTooSmall = obj.sup.masker.min && (obj.sup.masker.min > count);
        var isTooBig = obj.sup.masker.max && (obj.sup.masker.max < count);
        if (count > 0 && !isTooSmall && !isTooBig) {
            draw(x, y, gridsW - 1, useColor, ctx);
        } else {
            draw(x, y, gridsW - 1, 'rgba(0,0,0,0.2)', ctx);
        }

        if (obj.sup.drawOptions.showNum && !isTooSmall && !isTooBig) {
            ctx.save();
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillText(count, x, y);
            ctx.restore();
        }
    }
    // console.log(obj, step);
}

function draw(x, y, gridStep, color, ctx) {
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.moveTo(x, y - gridStep / 2);
    ctx.lineTo(x + gridStep / 2, y - gridStep / 4);
    ctx.lineTo(x + gridStep / 2, y + gridStep / 4);
    ctx.lineTo(x, y + gridStep / 2);
    ctx.lineTo(x - gridStep / 2, y + gridStep / 4);
    ctx.lineTo(x - gridStep / 2, y - gridStep / 4);
    ctx.fill();
    ctx.closePath();
}


/**
 * format param
 * @return {[type]} [description]
 */
function formatParam() {

    var options = this.drawOptions;
    // console.log(options)
    var fillColors = this.fillColors = [
        [73, 174, 34],
        [119, 191, 26],
        [160, 205, 18],
        [202, 221, 10],
        [248, 237, 1],
        [225, 222, 3],
        [254, 182, 10],
        [254, 126, 19],
        [254, 84, 27],
        [253, 54, 32]
    ];

    this.colorBar = {};
    for (var i = 0; i < fillColors.length; i++) {
        var pos = (i + 1) / fillColors.length;
        var r = fillColors[i][0];
        var g = fillColors[i][1];
        var b = fillColors[i][2];
        this.colorBar[pos] = 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    var gridWidth = options.gridWidth || '50';
    gridWidth = gridWidth + (options.gridUnit || 'px');
    if (/px$/.test(gridWidth)) {
        gridWidth = parseInt(gridWidth, 10) * this.zoomUnit;
    } else {
        gridWidth = parseInt(gridWidth, 10);
    }
    // console.log(gridWidth, options.gridWidth)
    return {
        gridWidth: gridWidth,
        colors: fillColors
    };
}