/**
 * The visualization controller will works as a state machine.
 * See files under the `doc` folder for transition descriptions.
 * See https://github.com/jakesgordon/javascript-state-machine
 * for the document of the StateMachine module.
 */
var stepNumber = 0;
var openedList = [];
var closedList = [];
var textList = [];

var Controller = StateMachine.create({
    initial: 'none',
    events: [
        {
            name: 'init',
            from: 'none',
            to: 'ready'
        },
        {
            name: 'search',
            from: 'starting',
            to: 'searching'
        },
        {
            name: 'pause',
            from: 'searching',
            to: 'paused'
        },
        {
            name: 'finish',
            from: 'paused',
            to: 'finished'
        },
        {
            name: 'resume',
            from: 'paused',
            to: 'searching'
        },
        {
            name: 'cancel',
            from: 'paused',
            to: 'ready'
        },
        {
            name: 'modify',
            from: 'finished',
            to: 'modified'
        },
        {
            name: 'reset',
            from: '*',
            to: 'ready'
        },
        {
            name: 'clear',
            from: ['finished', 'modified'],
            to: 'ready'
        },
        {
            name: 'start',
            from: ['ready', 'modified', 'restarting'],
            to: 'starting'
        },
        {
            name: 'restart',
            from: ['searching', 'finished'],
            to: 'restarting'
        },
        {
            name: 'dragStart',
            from: ['ready', 'finished'],
            to: 'draggingStart'
        },
        {
            name: 'dragEnd',
            from: ['ready', 'finished'],
            to: 'draggingEnd'
        },
        {
            name: 'drawWall',
            from: ['ready', 'finished'],
            to: 'drawingWall'
        },
        {
            name: 'eraseWall',
            from: ['ready', 'finished'],
            to: 'erasingWall'
        },
        {
            name: 'rest',
            from: ['draggingStart', 'draggingEnd', 'drawingWall', 'erasingWall'],
            to: 'ready'
        },
    ],
});

$.extend(Controller, {
    gridSize: [16, 16], // number of nodes horizontally and vertically

    /**
     * Asynchronous transition from `none` state to `ready` state.
     */
    onleavenone: function () {
        var numCols = this.gridSize[0],
            numRows = this.gridSize[1];

        this.grid = new PF.Grid(numCols, numRows);

        View.init({
            numCols: numCols,
            numRows: numRows
        });
        View.generateGrid(function () {
            Controller.setDefaultStartEndPos();
            Controller.bindEvents();
            Controller.transition(); // transit to the next state (ready)
        });

        this.$buttons = $('.control_button');

        this.hookPathFinding();

        return StateMachine.ASYNC;
        // => ready
    },
    ondrawWall: function (event, from, to, gridX, gridY) {
        this.setWalkableAt(gridX, gridY, false);
        // => drawingWall
    },
    oneraseWall: function (event, from, to, gridX, gridY) {
        this.setWalkableAt(gridX, gridY, true);
        // => erasingWall
    },
    onsearch: function (event, from, to) {
        var grid,
            timeStart, timeEnd,
            finder = Panel.getFinder();

        timeStart = window.performance ? performance.now() : Date.now();
        grid = this.grid.clone();
        this.path = finder.findPath(
            this.startX, this.startY, this.endX, this.endY, grid
        );
        this.operationCount = this.operations.length;
        timeEnd = window.performance ? performance.now() : Date.now();
        this.timeSpent = (timeEnd - timeStart).toFixed(4);

        // => searching
    },
    onrestart: function () {
        // When clearing the colorized nodes, there may be
        // nodes still animating, which is an asynchronous procedure.
        // Therefore, we have to defer the `abort` routine to make sure
        // that all the animations are done by the time we clear the colors.
        // The same reason applies for the `onreset` event handler.
        setTimeout(function () {
            Controller.clearOperations();
            Controller.clearFootprints();
            Controller.start();
        }, View.nodeColorizeEffect.duration * 1.2);
        // => restarting
    },
    onpause: function (event, from, to) {
        // => paused
    },
    onresume: function (event, from, to) {
        this.step();
        // => searching
    },
    oncancel: function (event, from, to) {
        this.clearOperations();
        this.clearFootprints();
        // => ready
    },
    onfinish: function (event, from, to) {
        View.showStats({
            pathLength: PF.Util.pathLength(this.path),
            timeSpent: this.timeSpent,
            operationCount: this.operationCount,
            path: this.stringifyPath(),
        });
        View.drawPath(this.path);
        // => finished
    },
    onclear: function (event, from, to) {
        this.clearOperations();
        this.clearFootprints();
        // => ready
    },
    onmodify: function (event, from, to) {
        // => modified
    },
    onreset: function (event, from, to) {
        setTimeout(function () {
            Controller.clearOperations();
            Controller.clearAll();
            Controller.buildNewGrid();
        }, View.nodeColorizeEffect.duration * 1.2);
        // => ready
    },

    /**
     * The following functions are called on entering states.
     */
    onready: function () {
        console.log('=> ready');
        this.setButtonStates({
            id: 1,
            text: 'Comenzar',
            enabled: true,
            callback: $.proxy(this.start, this),
        }, {
                id: 2,
                text: 'Cancelar',
                enabled: false,
                callback: $.proxy(this.cancel, this),
            }, {
                id: 3,
                text: 'Limpiar',
                enabled: true,
                callback: $.proxy(this.reset, this),
            });
        // => [starting, draggingStart, draggingEnd, drawingStart, drawingEnd]
    },
    onstarting: function (event, from, to) {
        console.log('=> starting');
        // Clears any existing search progress
        this.clearFootprints();
        this.setButtonStates({
            id: 1,
            text: 'Siguiente Paso',
            enabled: true,
            callback: $.proxy(this.resume, this),
        }, {
                id: 2,
                enabled: true,
            });
        this.search();
        // => searching
    },
    onsearching: function () {
        console.log('=> searching');
        this.setButtonStates({
            id: 1,
            enabled: false,
        });
        this.pause();
        // => [paused, finished]
    },
    onpaused: function () {
        console.log('=> paused');
        this.setButtonStates({
            id: 1,
            enabled: true,
        }, {
                id: 2,
                text: 'Cancelar',
                enabled: true,
            });
        // => [searching, ready]
    },
    onfinished: function () {
        console.log('=> finished');
        this.setButtonStates({
            id: 1,
            text: "Finalizado",
            enabled: false,
        }, {
            id: 2,
            text: 'Reiniciar',
            enabled: true,
            callback: $.proxy(this.clear, this),
        });
    },
    onmodified: function () {
        console.log('=> modified');
        this.setButtonStates({
            id: 1,
            text: 'Comenzar',
            enabled: true,
            callback: $.proxy(this.start, this),
        }, {
                id: 2,
                text: 'Reiniciar',
                enabled: false,
            });
    },

    /**
     * Define setters and getters of PF.Node, then we can get the operations
     * of the pathfinding.
     */
    hookPathFinding: function () {
        PF.Node.prototype = {
            get opened() {
                return this._opened;
            },
            set opened(v) {
                console.log(this);
                this._opened = v;
                Controller.operations.push({
                    x: this.x,
                    y: this.y,
                    f: this.f,
                    parentX: (this.parent ? this.parent.x : null),
                    parentY: (this.parent ? this.parent.y : null),
                    attr: 'opened',
                    value: v,
                });
            },
            get closed() {
                return this._closed;
            },
            set closed(v) {
                console.log(this);
                this._closed = v;
                Controller.operations.push({
                    x: this.x,
                    y: this.y,
                    f: this.f,
                    parentX: (this.parent ? this.parent.x : null),
                    parentY: (this.parent ? this.parent.y : null),
                    attr: 'closed',
                    value: v,
                });
            },
            get tested() {
                return this._tested;
            },
            set tested(v) {
                this._tested = v;
                Controller.operations.push({
                    x: this.x,
                    y: this.y,
                    attr: 'tested',
                    value: v
                });
            },
        };

        this.operations = [];
    },
    bindEvents: function () {
        $('#draw_area').mousedown($.proxy(this.mousedown, this));
        $(window)
            .mousemove($.proxy(this.mousemove, this))
            .mouseup($.proxy(this.mouseup, this));
    },
    /*loop: function() {
        var interval = 1000 / this.operationsPerSecond;
        (function loop() {
            if (!Controller.is('searching')) {
                return;
            }
            Controller.step();
            setTimeout(loop, interval);
        })();
    },*/
    step: function () {
        var operations = this.operations,
            op, isSupported;
        
        do {
            if (!operations.length) {
                this.finish(); // transit to `finished` state
                return;
            }
            op = operations.shift();
            isSupported = View.supportedOperations.indexOf(op.attr) !== -1;
        } while (!isSupported);

        if (op.attr == 'opened') {
            this.addOpened(op);
        } else if (op.attr == 'closed') {
            this.addClosed(op);
        }
        
        if (op.f) {
            textList.push(op);
            xCoord = (op.x + 1) * 40;
            yCoord = (op.y + 1) * 40;
            element = document.getElementById("x" + op.x + "y" + op.y);
            if (element) element.parentNode.removeChild(element);
            var textElem = document.createElement('p');
            var textNode = document.createTextNode(op.f.toString().match(/^-?\d+(?:\.\d{0,2})?/)[0])
            textElem.setAttribute("id", "x" + op.x + "y" + op.y);
            textElem.appendChild(textNode);
            document.body.appendChild(textElem);
            textElem.style.position = 'absolute';
            textElem.style.left = xCoord + 'px';
            textElem.style.top = yCoord + 'px';
            textElem.style.fontSize = '0.8em';
            textElem.style.width = '40px';
            textElem.style.height = '40px';
            textElem.style.textAlign = 'center';
            textElem.style.verticalAlign = 'middle';
        }
        
        View.setAttributeAt(op.x, op.y, op.attr, op.value);
    },
    clearOperations: function () {
        this.operations = [];
        this.openedList = [];
        this.closedList = [];
        console.log(textList);
        for (var i = 0; i < textList.length; i++) {
            try {
                element = document.getElementById("x" + textList[i].x + "y" + textList[i].y);
                element.parentNode.removeChild(element);
            } catch (e) {}
        }
        textList = [];
        stepNumber = 0;
        var table = document.getElementById("step_table");
        $('#stats').text("");
        table.deleteRow(1);
        table.insertRow(1);
        this.clearLists();
    },
    clearFootprints: function () {
        View.clearFootprints();
        View.clearPath();
    },
    clearAll: function () {
        this.clearFootprints();
        View.clearBlockedNodes();
    },
    buildNewGrid: function () {
        this.grid = new PF.Grid(this.gridSize[0], this.gridSize[1]);
    },
    mousedown: function (event) {
        var coord = View.toGridCoordinate(event.pageX - 40, event.pageY - 40),
            gridX = coord[0],
            gridY = coord[1],
            grid = this.grid;
        console.log(event);
        console.log(event.pageX);
        console.log(event.pageY);
        console.log(coord);

        if (this.can('dragStart') && this.isStartPos(gridX, gridY)) {
            this.dragStart();
            return;
        }
        if (this.can('dragEnd') && this.isEndPos(gridX, gridY)) {
            this.dragEnd();
            return;
        }
        if (this.can('drawWall') && grid.isWalkableAt(gridX, gridY)) {
            this.drawWall(gridX, gridY);
            return;
        }
        if (this.can('eraseWall') && !grid.isWalkableAt(gridX, gridY)) {
            this.eraseWall(gridX, gridY);
        }
    },
    mousemove: function (event) {
        var coord = View.toGridCoordinate(event.pageX - 40, event.pageY - 40),
            grid = this.grid,
            gridX = coord[0],
            gridY = coord[1];

        if (this.isStartOrEndPos(gridX, gridY)) {
            return;
        }

        switch (this.current) {
            case 'draggingStart':
                if (grid.isWalkableAt(gridX, gridY)) {
                    this.setStartPos(gridX, gridY);
                }
                break;
            case 'draggingEnd':
                if (grid.isWalkableAt(gridX, gridY)) {
                    this.setEndPos(gridX, gridY);
                }
                break;
            case 'drawingWall':
                this.setWalkableAt(gridX, gridY, false);
                break;
            case 'erasingWall':
                this.setWalkableAt(gridX, gridY, true);
                break;
        }
    },
    mouseup: function (event) {
        if (Controller.can('rest')) {
            Controller.rest();
        }
    },
    setButtonStates: function () {
        $.each(arguments, function (i, opt) {
            var $button = Controller.$buttons.eq(opt.id - 1);
            if (opt.text) {
                $button.text(opt.text);
            }
            if (opt.callback) {
                $button
                    .unbind('click')
                    .click(opt.callback);
            }
            if (opt.enabled === undefined) {
                return;
            } else if (opt.enabled) {
                $button.removeAttr('disabled');
            } else {
                $button.attr({ disabled: 'disabled' });
            }
        });
    },
    setDefaultStartEndPos: function () {
        this.setStartPos(1, 1);
        this.setEndPos(14, 14);
    },
    setStartPos: function (gridX, gridY) {
        this.startX = gridX;
        this.startY = gridY;
        View.setStartPos(gridX, gridY);
    },
    setEndPos: function (gridX, gridY) {
        this.endX = gridX;
        this.endY = gridY;
        View.setEndPos(gridX, gridY);
    },
    setWalkableAt: function (gridX, gridY, walkable) {
        this.grid.setWalkableAt(gridX, gridY, walkable);
        View.setAttributeAt(gridX, gridY, 'walkable', walkable);
    },
    isStartPos: function (gridX, gridY) {
        return gridX === this.startX && gridY === this.startY;
    },
    isEndPos: function (gridX, gridY) {
        return gridX === this.endX && gridY === this.endY;
    },
    isStartOrEndPos: function (gridX, gridY) {
        return this.isStartPos(gridX, gridY) || this.isEndPos(gridX, gridY);
    },
    numberToCoord: function (x,y) {
        if (x === undefined || x === null) return "Ø";
        var alph = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"];
        return `${alph[x]}${y + 1}`;
    },
    addOpened: function (op) {
        var found = false;
        var i = 0;
        for(; i < openedList.length; i++) {
            if (openedList[i].x == op.x && openedList[i].y == op.y) {
                found = true;
                break;
            }
        }
        if (found) {openedList[i] = op}
        openedList.push(op);
        openedList.sort(function(a, b) {return a.f - b.f});
        this.printTable();
    },
    addClosed: function (op) {
        var found = false;
        var i = 0;
        for(; i < openedList.length; i++) {
            if (openedList[i].x == op.x && openedList[i].y == op.y) {
                found = true;
                break;
            }
        }
        if (found) {openedList.splice(i,1)}
        closedList.push(op);
        closedList.sort(function(a, b) {return a.f - b.f});
        this.printTable();
    },
    stringifyOp: function(op) {
        var coord = this.numberToCoord(op.x,op.y);
        var coordParent = this.numberToCoord(op.parentX, op.parentY);
        if(op.f){
            switch (op.attr) {
                case 'opened':
                return `${coord} ( ↶ ${coordParent} , ƒ=${op.f.toString().match(/^-?\d+(?:\.\d{0,2})?/)[0]} )`; // printeo abiertos
                case 'closed':
                return `${coord} ( ↶ ${coordParent} , ƒ=${op.f.toString().match(/^-?\d+(?:\.\d{0,2})?/)[0]} )`; // printeo cerrado
            }
        } else {
            switch (op.attr) {
                case 'opened':
                return `${coord} ( ↶ ${coordParent} )`; // printeo abiertos
                case 'closed':
                return `${coord} ( ↶ ${coordParent} )`; // printeo cerrado
            }
        }
    },
    printTable: function() {
        var strOpened = "", strClosed = "";
        for(var i = 0; i < openedList.length; i++) {
            strOpened += `${this.stringifyOp(openedList[i])}<br>`
        }
        for(var i = 0; i < closedList.length; i++) {
            strClosed += `${this.stringifyOp(closedList[i])}<br>`
        }
        
        var table = document.getElementById("step_table");
        table.deleteRow(1);
        var row = table.insertRow(1);
        var cell1 = row.insertCell(0);
        var cell2 = row.insertCell(1);
        var cell3 = row.insertCell(2);
        cell1.innerHTML = stepNumber;
        stepNumber++;
        cell2.innerHTML = strOpened;
        cell3.innerHTML = strClosed;
    },
    clearLists: function() {
        openedList = [];
        closedList = [];
    },
    stringifyPath: function() {
        pathLength = PF.Util.pathLength(this.path);
        strPath = "";
        for(var i = 0; i < pathLength; i++) {
            node = this.path[i];
            if (node[0] == this.endX && node[1] == this.endY) break;
            strPath += `${this.numberToCoord(node[0],node[1])} → `;
        }
        return strPath += `${this.numberToCoord(this.endX,this.endY)}`;
    }

});


