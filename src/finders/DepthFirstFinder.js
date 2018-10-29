var Util = require('../core/Util');
var DiagonalMovement = require('../core/DiagonalMovement');

/**
 * Depth-First-Search path finder.
 * @constructor
 * @param {Object} opt
 * @param {boolean} opt.allowDiagonal Whether diagonal movement is allowed.
 *     Deprecated, use diagonalMovement instead.
 * @param {boolean} opt.dontCrossCorners Disallow diagonal movement touching
 *     block corners. Deprecated, use diagonalMovement instead.
 * @param {DiagonalMovement} opt.diagonalMovement Allowed diagonal movement.
 */
function DepthFirstFinder(opt) {
    opt = opt || {};
    this.allowDiagonal = opt.allowDiagonal;
    this.dontCrossCorners = opt.dontCrossCorners;
    this.diagonalMovement = opt.diagonalMovement;

    if (!this.diagonalMovement) {
        if (!this.allowDiagonal) {
            this.diagonalMovement = DiagonalMovement.Never;
        } else {
            if (this.dontCrossCorners) {
                this.diagonalMovement = DiagonalMovement.OnlyWhenNoObstacles;
            } else {
                this.diagonalMovement = DiagonalMovement.IfAtMostOneObstacle;
            }
        }
    }
}

/**
 * Find and return the the path.
 * @return {Array<Array<number>>} The path, including both start and
 *     end positions.
 */
DepthFirstFinder.prototype.findPath = function(startX, startY, endX, endY, grid) {
    var openList = [],
        diagonalMovement = this.diagonalMovement,
        startNode = grid.getNodeAt(startX, startY),
        endNode = grid.getNodeAt(endX, endY),
        neighbors, neighbor, node, i, l;

    // push the start pos into the stack
    openList.push(startNode);
    startNode.opened = true;

    // while the stack is not empty
    while (openList.length) {
        // take the front node from the stack
        node = openList.pop();
        node.closed = true;

        // reached the end position
        if (node === endNode) {
            return Util.backtrace(endNode);
        }

        neighbors = grid.getNeighbors(node, diagonalMovement);
        for (i = 0, l = neighbors.length; i < l; ++i) {
            neighbor = neighbors[i];

            // skip this neighbor if it has been inspected before
            if (neighbor.closed || neighbor.opened) {
                continue;
            }

            openList.push(neighbor);
            neighbor.parent = node;
            neighbor.opened = true;
        }
    }
    
    // fail to find the path
    return [];
};

module.exports = DepthFirstFinder;
